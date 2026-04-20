import axios from 'axios'
import Keyring from '@polkadot/keyring'
import { u8aToHex } from '@polkadot/util'
import { waitReady } from '@polkadot/wasm-crypto'

export interface ViewKeyResponse {
  viewKey: string
  jobId: string
  expiresAt: string
}

export interface DevtoolsOptions {
  /** Base URL of the DevTools HTTP API (e.g. https://api.devtools.acurast.com). */
  apiUrl: string
  /** Mnemonic used to derive the ed25519 keypair that signs requests. */
  mnemonic: string
  /** Optional debug logger. */
  logger?: {
    debug(message: string): void
    error(message: string): void
  }
}

/**
 * Build a DevTools web URL for a given deployment id and view-key.
 */
export function buildDevtoolsUrl(
  devtoolsUrl: string,
  deploymentId: string,
  viewKey: string,
): string {
  return `${devtoolsUrl}/deployment/${deploymentId}?viewKey=${viewKey}`
}

/**
 * Derives an ed25519 keypair from the supplied mnemonic. The devtools API
 * accepts ed25519 (32-byte) public keys, not sr25519.
 */
async function getEd25519Wallet(mnemonic: string) {
  await waitReady()
  const keyring = new Keyring({ type: 'ed25519' })
  return keyring.addFromMnemonic(mnemonic)
}

/**
 * Request a viewer key from the DevTools API for the given `jobId`. The
 * response contains a short-lived token scoped to that job.
 */
export async function getDevtoolsViewKey(
  jobId: string,
  options: DevtoolsOptions,
): Promise<ViewKeyResponse> {
  const wallet = await getEd25519Wallet(options.mnemonic)

  const publicKeyHex = u8aToHex(wallet.publicKey).slice(2) // no 0x prefix
  const timestamp = Math.floor(Date.now() / 1000).toString()

  // Message format expected by devtools API: "publicKeyHex:timestamp"
  const message = `${publicKeyHex}:${timestamp}`
  const encoder = new TextEncoder()
  const signature = u8aToHex(wallet.sign(encoder.encode(message))).slice(2)

  options.logger?.debug(
    `DevTools view-key request: POST ${options.apiUrl}/v1/auth/view-key jobId=${jobId} publicKey=${publicKeyHex}`,
  )

  try {
    const response = await axios.post<ViewKeyResponse>(
      `${options.apiUrl}/v1/auth/view-key`,
      { jobId },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': signature,
          'X-PublicKey': publicKeyHex,
          'X-Timestamp': timestamp,
        },
        timeout: 10_000,
      },
    )

    return response.data
  } catch (error: any) {
    const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message
    options.logger?.error(`DevTools view-key failed: ${error.response?.status} ${detail}`)
    throw new Error(`DevTools API ${error.response?.status ?? 'error'}: ${detail}`)
  }
}
