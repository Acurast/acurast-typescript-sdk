import { VPS_IMAGE_PRESETS } from './images.js'
import type { VpsRequest } from './types.js'

/**
 * Runtime validation of a {@link VpsRequest}. `buildVpsJob` is meant to be fed
 * a request body, so every field that ends up in an env var for the tunnel
 * bundle (and from there in `authorized_keys`, the sslh config or a `curl`
 * call) is checked here. Error messages never echo the rejected value.
 */

/** Key types dropbear accepts in `authorized_keys`. */
const SSH_KEY_TYPES = new Set([
  'ssh-ed25519',
  'ssh-rsa',
  'ecdsa-sha2-nistp256',
  'ecdsa-sha2-nistp384',
  'ecdsa-sha2-nistp521',
  'sk-ssh-ed25519@openssh.com',
  'sk-ecdsa-sha2-nistp256@openssh.com',
])

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/

/** Printable ASCII and spaces only, for the optional key comment. */
const KEY_COMMENT = /^[\x20-\x7e]*$/

/** CIDv0 (`Qm` + 44 base58btc characters) behind an `ipfs://` prefix. */
const IPFS_CID_V0_URI = /^ipfs:\/\/Qm[1-9A-HJ-NP-Za-km-z]{44}$/

const MIN_HTTP_PORT = 1024
const MAX_HTTP_PORT = 65535

const invalid = (field: string, expectation: string): Error =>
  new Error(`Invalid VPS request: ${field} ${expectation}.`)

/**
 * Checks that `sshKey` is a single OpenSSH public key line:
 * `<type> <base64 blob> [comment]`, where `type` is a key type dropbear
 * supports and the blob encodes that same type. Surrounding whitespace is
 * removed; anything that would add another `authorized_keys` line or an
 * options prefix (`command=...`) is rejected. Returns the trimmed key.
 */
export const validateSshKey = (sshKey: unknown): string => {
  const expectation = 'must be a single-line OpenSSH public key ("<type> <base64> [comment]")'
  if (typeof sshKey !== 'string') throw invalid('sshKey', expectation)

  const key = sshKey.trim()
  if (key === '' || /[\x00-\x1f\x7f]/.test(key)) throw invalid('sshKey', expectation)

  const [type, blob, ...comment] = key.split(' ')
  if (!SSH_KEY_TYPES.has(type)) {
    throw invalid(
      'sshKey',
      `must start with a supported key type (${[...SSH_KEY_TYPES].join(', ')})`,
    )
  }
  if (blob === undefined || !BASE64.test(blob) || !KEY_COMMENT.test(comment.join(' '))) {
    throw invalid('sshKey', expectation)
  }

  // The blob starts with the key type as an SSH string (uint32 length + bytes).
  const decoded = Buffer.from(blob, 'base64')
  const typeLength = decoded.length >= 4 ? decoded.readUInt32BE(0) : -1
  if (
    typeLength !== Buffer.byteLength(type) ||
    decoded.subarray(4, 4 + typeLength).toString('latin1') !== type ||
    decoded.length <= 4 + typeLength
  ) {
    throw invalid('sshKey', 'has a key blob that does not match its key type')
  }

  return key
}

/** Integer port in 1024-65535 (the proot sandbox cannot bind lower ports). */
export const validateHttpPort = (httpPort: unknown): number => {
  if (
    typeof httpPort !== 'number' ||
    !Number.isInteger(httpPort) ||
    httpPort < MIN_HTTP_PORT ||
    httpPort > MAX_HTTP_PORT
  ) {
    throw invalid('httpPort', `must be an integer between ${MIN_HTTP_PORT} and ${MAX_HTTP_PORT}`)
  }
  return httpPort
}

/** `https://` URL without embedded credentials. Returns the URL unchanged. */
export const validateCallbackUrl = (callbackUrl: unknown): string => {
  const expectation = 'must be an https:// URL without credentials'
  if (typeof callbackUrl !== 'string' || /[\x00-\x20\x7f]/.test(callbackUrl)) {
    throw invalid('callbackUrl', expectation)
  }
  let url: URL
  try {
    url = new URL(callbackUrl)
  } catch {
    throw invalid('callbackUrl', expectation)
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') {
    throw invalid('callbackUrl', expectation)
  }
  return callbackUrl
}

/** `ipfs://` followed by a CIDv0 (`Qm...`). */
export const validateScriptCid = (scriptCid: unknown): string => {
  if (typeof scriptCid !== 'string' || !IPFS_CID_V0_URI.test(scriptCid)) {
    throw invalid('scriptCid', 'must be ipfs:// followed by a CIDv0 (Qm...)')
  }
  return scriptCid
}

/**
 * Validates the fields of `request` that reach the tunnel bundle or select
 * what runs. Throws on the first invalid field.
 */
export const validateVpsRequest = (request: VpsRequest): void => {
  if (request == null || typeof request !== 'object') {
    throw new Error('Invalid VPS request: expected an object.')
  }
  validateSshKey(request.sshKey)
  if (request.httpPort !== undefined) validateHttpPort(request.httpPort)
  // An empty callbackUrl has always meant "no callback".
  if (request.callbackUrl) validateCallbackUrl(request.callbackUrl)
  if (request.scriptCid != null) validateScriptCid(request.scriptCid)
  if (
    request.network !== undefined &&
    request.network !== 'mainnet' &&
    request.network !== 'canary'
  ) {
    throw invalid('network', 'must be "mainnet" or "canary"')
  }
  if (
    request.image !== undefined &&
    !Object.prototype.hasOwnProperty.call(VPS_IMAGE_PRESETS, request.image)
  ) {
    throw invalid('image', `must be one of ${Object.keys(VPS_IMAGE_PRESETS).join(', ')}`)
  }
}
