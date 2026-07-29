import axios from 'axios'
import Keyring from '@polkadot/keyring'
import type { KeyringPair } from '@polkadot/keyring/types'
import { u8aToHex, u8aToU8a } from '@polkadot/util'
import { waitReady } from '@polkadot/wasm-crypto'

/**
 * A signer for devtools requests. Either a mnemonic-derived `KeyringPair` (the
 * CLI's local mode) or a wallet-backed signer exposing `signRaw` (browser
 * extension, or the CLI's remote-signing bridge).
 *
 * Structurally compatible with `AcurastSigner` from @acurast/sdk; declared
 * here so this package does not depend on it.
 */
export interface InjectedDevtoolsSigner {
  address: string
  signer: {
    signRaw?: (payload: {
      address: string
      data: string
      type: 'bytes'
    }) => Promise<{ signature: string }>
  }
}

export type DevtoolsSigner = KeyringPair | InjectedDevtoolsSigner

const isInjected = (signer: DevtoolsSigner): signer is InjectedDevtoolsSigner =>
  'signer' in signer && (signer as InjectedDevtoolsSigner).signer !== undefined

export interface ViewKeyResponse {
  viewKey: string
  /** Plain deployment number the key is scoped to. */
  jobNumber: string
  /** Network the key is scoped to. */
  network: string
  expiresAt: string
}

export interface DevtoolsOptions {
  /** Base URL of the DevTools HTTP API (e.g. https://api.devtools.acurast.com). */
  apiUrl: string
  /**
   * Signer for the request. Must be the account that owns the deployment: the
   * API verifies the signature against the owner recorded on chain.
   */
  signer?: DevtoolsSigner
  /**
   * Mnemonic to derive a signer from.
   *
   * @deprecated Pass `signer` instead. A mnemonic is derived as sr25519 to
   * match how deployments are registered; an account using another scheme, or
   * remote signing, must supply `signer`.
   */
  mnemonic?: string
  /** Network the deployment lives on. Defaults to mainnet server-side. */
  network?: string
  /** Optional debug logger. */
  logger?: {
    debug(message: string): void
    error(message: string): void
  }
}

/**
 * Build a DevTools web URL for a given deployment id and view-key.
 *
 * The view key goes in the fragment rather than the query string: a fragment
 * is never sent to the server, so the credential stays out of access logs,
 * Referer headers and browser history.
 */
export function buildDevtoolsUrl(
  devtoolsUrl: string,
  deploymentId: string,
  viewKey: string,
): string {
  return `${devtoolsUrl}/deployment/${encodeURIComponent(deploymentId)}#viewKey=${encodeURIComponent(viewKey)}`
}

/**
 * Derive the signing pair from a mnemonic.
 *
 * sr25519, because that is what `walletFromMnemonic` in @acurast/sdk uses to
 * register deployments — the key must be the same one that owns the job, or
 * the API will not recognise it as the owner.
 */
async function walletFromMnemonic(mnemonic: string): Promise<KeyringPair> {
  await waitReady()
  return new Keyring({ type: 'sr25519' }).addFromMnemonic(mnemonic)
}

async function resolveSigner(options: DevtoolsOptions): Promise<DevtoolsSigner> {
  if (options.signer !== undefined) return options.signer
  if (options.mnemonic !== undefined) return walletFromMnemonic(options.mnemonic)
  throw new Error('DevTools: either `signer` or `mnemonic` must be provided')
}

/** Sign a message, whichever kind of signer this is. */
async function signMessage(signer: DevtoolsSigner, message: string): Promise<string> {
  const bytes = new TextEncoder().encode(message)

  if (isInjected(signer)) {
    const signRaw = signer.signer.signRaw
    if (signRaw === undefined) {
      throw new Error('DevTools: the provided wallet cannot sign raw messages')
    }
    // Wallets wrap raw payloads in <Bytes>…</Bytes> before signing; the API
    // verifies with @polkadot's signatureVerify, which accounts for that.
    const { signature } = await signRaw({
      address: signer.address,
      data: u8aToHex(bytes),
      type: 'bytes',
    })
    return signature.replace(/^0x/, '')
  }

  await waitReady()
  return u8aToHex(u8aToU8a(signer.sign(bytes))).slice(2)
}

/**
 * Request a view key for a deployment.
 *
 * `jobId` should be the full `Acurast:<owner>:<number>` deployment id. The API
 * resolves the owner from it and requires the signature to come from that
 * account; a bare number still works but relies on an indexer lookup that is
 * being retired.
 */
export async function getDevtoolsViewKey(
  jobId: string,
  options: DevtoolsOptions,
): Promise<ViewKeyResponse> {
  const signer = await resolveSigner(options)
  const address = signer.address
  const timestamp = Math.floor(Date.now() / 1000).toString()

  // Bound to the deployment so a captured signature cannot be replayed
  // against another of the same owner's jobs.
  const message = `${address}:${jobId}:${timestamp}`
  const signature = await signMessage(signer, message)

  options.logger?.debug(
    `DevTools view-key request: POST ${options.apiUrl}/v1/auth/view-key jobId=${jobId} address=${address}`,
  )

  try {
    const response = await axios.post<ViewKeyResponse>(
      `${options.apiUrl}/v1/auth/view-key`,
      { jobId, ...(options.network !== undefined ? { network: options.network } : {}) },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': signature,
          'X-Address': address,
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
