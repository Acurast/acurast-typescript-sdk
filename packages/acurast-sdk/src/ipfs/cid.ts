// Browser-safe CIDv0 computation for files pinned with `cidVersion: 0`.
//
// No `fs`, no Node-only imports: hashing uses WebCrypto (`globalThis.crypto`),
// which is available in browsers and in Node 18+. This lets both the Node
// `uploadScript` and the browser `uploadBlob` check the CID a pinning service
// returns against the bytes that were actually uploaded.
//
// The DAG layout mirrors the kubo / go-unixfs importer defaults that a
// `cidVersion: 0` upload uses:
//   - UnixFS `File` nodes encoded as dag-pb, no raw leaves
//   - fixed-size chunks of 262144 bytes
//   - balanced DAG with at most 174 links per node
//   - sha2-256 multihash, base58btc string encoding (`Qm...`)

/** Chunk size of the kubo default chunker (`size-262144`). */
export const IPFS_CHUNK_SIZE = 262144
/** Maximum number of links per node of the kubo balanced layout. */
export const IPFS_MAX_LINKS = 174

const UNIXFS_TYPE_FILE = 2

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

const CID_V0_PATTERN = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/
// CIDv1 in its default multibase (base32, lowercase, `b` prefix).
const CID_V1_BASE32_PATTERN = /^b[a-z2-7]{58,}$/

/** Returns true if `value` is a syntactically valid CIDv0 string (`Qm...`). */
export const isCidV0 = (value: unknown): value is string =>
  typeof value === 'string' && CID_V0_PATTERN.test(value)

/**
 * Returns true if `value` looks like a CID string: a CIDv0 (`Qm...`) or a
 * base32 CIDv1 (`b...`). This is a format check only.
 */
export const isWellFormedCid = (value: unknown): value is string =>
  typeof value === 'string' && (CID_V0_PATTERN.test(value) || CID_V1_BASE32_PATTERN.test(value))

const varint = (value: number): number[] => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Cannot varint-encode ${value}`)
  }
  const out: number[] = []
  let n = value
  while (n >= 0x80) {
    out.push((n % 0x80) | 0x80)
    n = Math.floor(n / 0x80)
  }
  out.push(n)
  return out
}

const concat = (parts: (Uint8Array | number[])[]): Uint8Array => {
  const length = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

/** Protobuf length-delimited field (wire type 2). */
const bytesField = (fieldNumber: number, value: Uint8Array): Uint8Array =>
  concat([varint((fieldNumber << 3) | 2), varint(value.length), value])

/** Protobuf varint field (wire type 0). */
const varintField = (fieldNumber: number, value: number): number[] => [
  ...varint(fieldNumber << 3),
  ...varint(value),
]

const sha256 = async (data: Uint8Array): Promise<Uint8Array> => {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    throw new Error('Computing an IPFS CID requires WebCrypto (globalThis.crypto.subtle)')
  }
  // Copy into a fresh ArrayBuffer-backed view: `digest` rejects views over
  // SharedArrayBuffer and some typings reject generic ArrayBufferLike views.
  const digest = await subtle.digest('SHA-256', new Uint8Array(data))
  return new Uint8Array(digest)
}

const base58btc = (bytes: Uint8Array): string => {
  const digits: number[] = [0]
  for (const byte of bytes) {
    let carry = byte
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8
      digits[i] = carry % 58
      carry = Math.floor(carry / 58)
    }
    while (carry > 0) {
      digits.push(carry % 58)
      carry = Math.floor(carry / 58)
    }
  }
  let out = ''
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    out += BASE58_ALPHABET[0]
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    out += BASE58_ALPHABET[digits[i]]
  }
  return out
}

interface DagNode {
  /** sha2-256 multihash of the serialized block (`0x12 0x20 <digest>`). */
  multihash: Uint8Array
  /** Cumulative size: serialized block plus the cumulative sizes of all children. */
  cumulativeSize: number
  /** Number of file bytes in this subtree. */
  fileSize: number
}

const toNode = async (block: Uint8Array, childrenCumulativeSize: number, fileSize: number) => {
  const digest = await sha256(block)
  const multihash = concat([[0x12, 0x20], digest])
  return { multihash, cumulativeSize: block.length + childrenCumulativeSize, fileSize }
}

/** dag-pb leaf: a PBNode with only `Data` = UnixFS { Type: File, Data, filesize }. */
const leafNode = async (chunk: Uint8Array): Promise<DagNode> => {
  const unixfs = concat([
    varintField(1, UNIXFS_TYPE_FILE),
    // go-unixfs omits the Data field for an empty file.
    chunk.length > 0 ? bytesField(2, chunk) : [],
    varintField(3, chunk.length),
  ])
  return toNode(bytesField(1, unixfs), 0, chunk.length)
}

/**
 * dag-pb internal node: PBNode { Links (field 2) ..., Data (field 1) } with
 * Data = UnixFS { Type: File, filesize, blocksizes... }. dag-pb serializes the
 * links before the data. Each link carries Hash, an empty Name and Tsize, as
 * go-merkledag writes them.
 */
const internalNode = async (children: DagNode[]): Promise<DagNode> => {
  const fileSize = children.reduce((sum, child) => sum + child.fileSize, 0)
  const links = children.map((child) =>
    bytesField(
      2,
      concat([
        bytesField(1, child.multihash),
        bytesField(2, new Uint8Array(0)),
        varintField(3, child.cumulativeSize),
      ]),
    ),
  )
  const unixfs = concat([
    varintField(1, UNIXFS_TYPE_FILE),
    varintField(3, fileSize),
    ...children.map((child) => varintField(4, child.fileSize)),
  ])
  const block = concat([...links, bytesField(1, unixfs)])
  const childrenCumulativeSize = children.reduce((sum, child) => sum + child.cumulativeSize, 0)
  return toNode(block, childrenCumulativeSize, fileSize)
}

/**
 * Compute the CIDv0 (`Qm...`) that kubo assigns to `content` when it is added
 * as a single file with the default importer settings (and `cidVersion: 0`).
 */
export const computeCidV0 = async (content: Uint8Array): Promise<string> => {
  if (content.length <= IPFS_CHUNK_SIZE) {
    return base58btc((await leafNode(content)).multihash)
  }

  let offset = 0
  const done = () => offset >= content.length
  const nextLeaf = () => {
    const chunk = content.subarray(offset, offset + IPFS_CHUNK_SIZE)
    offset += chunk.length
    return leafNode(chunk)
  }

  // Balanced layout (go-unixfs importer/balanced): every child of a node at
  // depth d is a full-depth subtree of depth d-1, filled left to right.
  const fill = async (depth: number, first?: DagNode): Promise<DagNode> => {
    const children: DagNode[] = first ? [first] : []
    while (children.length < IPFS_MAX_LINKS && !done()) {
      children.push(depth === 1 ? await nextLeaf() : await fill(depth - 1))
    }
    return internalNode(children)
  }

  let root = await nextLeaf()
  for (let depth = 1; !done(); depth++) {
    root = await fill(depth, root)
  }
  return base58btc(root.multihash)
}

/**
 * Turn a pinning-service response into an `ipfs://<cid>` URI, checking that it
 * carries a well-formed CID and, when `verify` is true, that the CID matches
 * the one computed locally from the uploaded bytes.
 *
 * @internal Shared by `uploadScript` and `uploadBlob`.
 */
export const checkPinnedCid = async (
  response: unknown,
  content: Uint8Array,
  verify: boolean,
): Promise<string> => {
  const returned = (response as { IpfsHash?: unknown } | null | undefined)?.IpfsHash
  if (!isWellFormedCid(returned)) {
    const shown = String(JSON.stringify(returned)).slice(0, 100)
    throw new Error(
      `IPFS upload failed: the pinning service did not return a valid CID (IpfsHash: ${shown})`,
    )
  }
  if (verify) {
    const expected = await computeCidV0(content)
    if (returned !== expected) {
      throw new Error(
        `IPFS upload failed: the pinning service returned CID ${returned}, but the uploaded content has CID ${expected}. ` +
          'Set `verifyCid: false` only if the service is known to use a different DAG layout.',
      )
    }
  }
  return `ipfs://${returned}`
}
