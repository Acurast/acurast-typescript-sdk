import { type AcurastProjectConfig, type JobRegistration } from '../types/project.js'
import type { DeploymentStatus } from '../types/deployment-status.js'
import type { EnvVar } from '../types/env.js'
import type { KeyStore } from '../chain/key-store.js'
import type { AcurastSigner } from '../chain/signer.js'
import type { Logger } from './logger.js'
import { deployProjectCore } from './deploy-core.js'
import { zipProjectBrowser, type BrowserBundleFiles } from './bundle.browser.js'
import { uploadBlob, type IpfsUploadOptions } from '../ipfs/upload.browser.js'

export interface DeployProjectBrowserOptions {
  /** Wallet that signs the deploy extrinsic (injected browser-extension signer). */
  wallet: AcurastSigner
  /** WebSocket RPC endpoint for the target Acurast chain. */
  rpcEndpoint: string
  /** IPFS pinning service configuration (used by the default `resolveScript`). */
  ipfs?: IpfsUploadOptions
  /**
   * In-memory project files to bundle when `config.fileUrl` is not already an
   * `ipfs://` hash. Keyed by in-bundle path; the entrypoint comes from
   * `config.entrypoint` (default `index.js`).
   */
  files?: BrowserBundleFiles
  /** Environment variables to be encrypted + submitted after acknowledgement. */
  envVars?: EnvVar[]
  /** When true, bundle + upload but skip the on-chain `deploy` extrinsic. */
  onlyUpload?: boolean
  /** Per-stage progress callback. */
  statusCallback: (status: DeploymentStatus, data?: any) => void
  /** Persistent storage for ECDH keypairs used when encrypting env vars. */
  keyStore?: KeyStore
  /** Optional debug logger. */
  logger?: Logger
  /**
   * Override the script-resolution step entirely — e.g. to upload via the
   * hub's own `IpfsService` instead of the SDK's `fetch` upload. When provided,
   * `files`/`ipfs` are ignored.
   */
  resolveScript?: (config: AcurastProjectConfig) => Promise<string>
}

/**
 * Browser counterpart of `deployProject`: bundles in-memory files with JSZip,
 * uploads via `fetch` (or a caller-supplied `resolveScript`), then runs the
 * shared {@link deployProjectCore} orchestration (chain registration + env-var
 * encryption) using an injected wallet signer. Emits identical
 * `DeploymentStatus` stages to the CLI.
 */
export const deployProjectBrowser = async (
  config: AcurastProjectConfig,
  job: JobRegistration,
  options: DeployProjectBrowserOptions,
): Promise<JobRegistration> => {
  const resolveScript =
    options.resolveScript ??
    (async (cfg: AcurastProjectConfig): Promise<string> => {
      if (cfg.fileUrl.startsWith('ipfs://')) {
        return cfg.fileUrl
      }
      if (!options.ipfs) {
        throw new Error(
          'deployProjectBrowser: `ipfs` options or a `resolveScript` override is required',
        )
      }
      const entrypoint = cfg.entrypoint ?? 'index.js'
      const files: BrowserBundleFiles = options.files ?? { [entrypoint]: '' }
      const blob = await zipProjectBrowser(files, {
        projectName: cfg.projectName,
        entrypoint,
        restartPolicy: cfg.restartPolicy,
        image: cfg.image,
      })
      return uploadBlob(blob, options.ipfs)
    })

  return deployProjectCore(config, job, {
    wallet: options.wallet,
    rpcEndpoint: options.rpcEndpoint,
    envVars: options.envVars,
    onlyUpload: options.onlyUpload,
    statusCallback: options.statusCallback,
    keyStore: options.keyStore,
    logger: options.logger,
    resolveScript,
  })
}
