import { createHash } from 'crypto'
import { computeCidV0, IPFS_CHUNK_SIZE, isCidV0, isWellFormedCid } from '../src/ipfs/cid.js'

/** Deterministic pseudo-random bytes (sha256 counter stream). */
const deterministicBytes = (length: number): Uint8Array => {
  const out = new Uint8Array(length)
  let offset = 0
  for (let counter = 0; offset < length; counter++) {
    const block = createHash('sha256').update(`acurast-cid-test-${counter}`).digest()
    out.set(block.subarray(0, Math.min(block.length, length - offset)), offset)
    offset += block.length
  }
  return out
}

describe('computeCidV0', () => {
  it('computes the kubo CID of an empty file', async () => {
    expect(await computeCidV0(new Uint8Array(0))).toBe(
      'QmbFMke1KXqnYyBBWxB74N4c5SBnJMVAiMNRcGu6x1AwQH',
    )
  })

  it('computes the kubo CID of "hello world\\n"', async () => {
    expect(await computeCidV0(new TextEncoder().encode('hello world\n'))).toBe(
      'QmT78zSuBmuS4z925WZfrqQ1qHaJ56DQaTfyMUF7F8ff5o',
    )
  })

  it('accepts a Buffer', async () => {
    expect(await computeCidV0(Buffer.from('hello world\n'))).toBe(
      'QmT78zSuBmuS4z925WZfrqQ1qHaJ56DQaTfyMUF7F8ff5o',
    )
  })

  it('keeps a file of exactly one chunk in a single node', async () => {
    const cid = await computeCidV0(deterministicBytes(IPFS_CHUNK_SIZE))
    expect(isCidV0(cid)).toBe(true)
    expect(cid).not.toBe(await computeCidV0(deterministicBytes(IPFS_CHUNK_SIZE + 1)))
  })

  // NOTE: the expected values below were produced by this implementation and
  // have NOT been checked against kubo (no `ipfs` binary was available when
  // they were recorded). They guard against regressions in the multi-chunk
  // layout, not against a wrong layout. Verify with
  // `ipfs add --only-hash --cid-version=0 <file>` when kubo is at hand and
  // update them if they differ.
  it('computes a stable CID for a multi-chunk file (balanced DAG, depth 1)', async () => {
    const bytes = deterministicBytes(2 * IPFS_CHUNK_SIZE + 1000)
    expect(await computeCidV0(bytes)).toBe('QmPK7JcgJjLuoYPZq1yPVEhAdcwDXA4YcbobLro1TvPchZ')
  })

  it('computes a stable CID for a file needing a depth-2 DAG (> 174 chunks)', async () => {
    const bytes = new Uint8Array(175 * IPFS_CHUNK_SIZE + 1)
    expect(await computeCidV0(bytes)).toBe('QmXP8oNvhw1DiUqoH4sTYvVUKt7wUdzNEYNSBkNiXJGXk9')
  })
})

describe('CID format checks', () => {
  it('recognises CIDv0 strings', () => {
    expect(isCidV0('QmT78zSuBmuS4z925WZfrqQ1qHaJ56DQaTfyMUF7F8ff5o')).toBe(true)
    expect(isCidV0('QmT78zSuBmuS4z925WZfrqQ1qHaJ56DQaTfyMUF7F8ff5')).toBe(false)
    expect(isCidV0('QmT78zSuBmuS4z925WZfrqQ1qHaJ56DQaTfyMUF7F8ff5O')).toBe(false)
    expect(isCidV0(undefined)).toBe(false)
    expect(isCidV0('undefined')).toBe(false)
  })

  it('accepts base32 CIDv1 as well formed', () => {
    expect(isWellFormedCid('bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi')).toBe(
      true,
    )
    expect(isWellFormedCid('../../etc/passwd')).toBe(false)
    expect(isWellFormedCid(42)).toBe(false)
  })
})
