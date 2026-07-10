import { generateKeyPairSync, createHash } from 'node:crypto'
import type { VpsKeypair } from './types.js'

/**
 * Generate a fresh P-256 (SECP256R1) keypair for the Acurast tunnel primary connection.
 *
 * The private key is serialised as PKCS8 DER — the same format tunnel.py passes to
 * `TunnelSpec.primaryKey`. The public key is returned in SEC1 compressed form (33 bytes)
 * so callers can precompute the tunnel clientId without waiting for the processor to start.
 */
export function generateTunnelKeypair(): VpsKeypair {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })

  const privateKeyPkcs8 = privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer

  // P-256 SPKI DER is always exactly 91 bytes:
  //   [0-1]   SEQUENCE header (30 59)
  //   [2-22]  AlgorithmIdentifier SEQUENCE (ecPublicKey + prime256v1 OIDs)
  //   [23-24] BIT STRING header (03 42)
  //   [25]    unused-bits octet (00)
  //   [26]    uncompressed-point prefix (04)
  //   [27-58] x-coordinate (32 bytes)
  //   [59-90] y-coordinate (32 bytes)
  const spkiDer = publicKey.export({ type: 'spki', format: 'der' }) as Buffer
  if (spkiDer.length !== 91) {
    throw new Error(`Unexpected SPKI DER length ${spkiDer.length} for P-256 key`)
  }
  const x = spkiDer.subarray(27, 59)
  const y = spkiDer.subarray(59, 91)
  const prefix = (y[31] & 1) === 0 ? 0x02 : 0x03
  const publicKeyCompressed = Buffer.concat([Buffer.from([prefix]), x])

  return { privateKeyPkcs8, publicKeyCompressed }
}

/**
 * Derive the Acurast tunnel clientId from a SEC1 compressed P-256 public key.
 * Formula (mirrors the relay-server implementation):
 *   clientId = hex(sha256(pubkey_sec1_compressed)[0..8])
 */
export function computeClientId(publicKeyCompressed: Buffer): string {
  const hash = createHash('sha256').update(publicKeyCompressed).digest()
  return hash.subarray(0, 8).toString('hex')
}
