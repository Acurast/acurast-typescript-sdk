import '@polkadot/api-augment'
import { basename } from 'node:path'
import { type AcurastProjectConfig, type JobRegistration, RestartPolicy } from '../types/project.js'
import type { EnvVar } from '../types/env.js'
import type { KeyStore } from '../chain/key-store.js'
import type { AcurastSigner } from '../chain/signer.js'
import { uploadScript, type IpfsUploadOptions } from '../ipfs/upload.js'
import { zipFolder, createManifest, checkIsFolder } from './bundle.js'
import { NOOP_LOGGER, type Logger } from './logger.js'
import { deployProjectCore } from './deploy-core.js'

const BUNDLE_FOLDER = '.acurast/bundles'

export interface DeployProjectOptions {
  /** Wallet that signs the deploy extrinsic. */
  wallet: AcurastSigner
  /** WebSocket RPC endpoint for the target Acurast chain. */
  rpcEndpoint: string
  /** IPFS pinning service configuration. */
  ipfs: IpfsUploadOptions
  /** Environment variables to be encrypted + submitted after acknowledgement. */
  envVars?: EnvVar[]
  /** When true, upload to IPFS but skip the on-chain `deploy` extrinsic. */
  onlyUpload?: boolean
  /** Per-stage progress callback. */
  statusCallback: (
    status: import('../types/deployment-status.js').DeploymentStatus,
    data?: any,
  ) => void
  /** Persistent storage for ECDH keypairs used when encrypting env vars. */
  keyStore?: KeyStore
  /** Optional debug logger. */
  logger?: Logger
  /**
   * Optional bundle-transform hook, invoked after `zipFolder` and before
   * IPFS upload. The hook may return a new zip path (e.g. one with a
   * DevTools snippet injected).
   */
  transformBundle?: (opts: { zipPath: string; entrypoint: string }) => Promise<string>
  /** Override for the temp-bundle directory. Defaults to `.acurast/bundles`. */
  bundleFolder?: string
}

/**
 * End-to-end deploy flow: bundle → IPFS → chain registration → env-var
 * encryption. Mirrors the behaviour of the legacy `createJob()` function in
 * the CLI, but takes all configuration explicitly.
 *
 * The orchestration is shared with the browser via {@link deployProjectCore};
 * this Node entry supplies the fs/adm-zip bundling + IPFS upload step.
 */
export const deployProject = async (
  config: AcurastProjectConfig,
  job: JobRegistration,
  options: DeployProjectOptions,
): Promise<JobRegistration> => {
  const logger = options.logger ?? NOOP_LOGGER
  const bundleFolder = options.bundleFolder ?? BUNDLE_FOLDER

  const resolveScript = async (cfg: AcurastProjectConfig): Promise<string> => {
    if (cfg.fileUrl.startsWith('ipfs://')) {
      if (cfg.enableDevtools) {
        logger.warn(
          'enableDevtools is ignored when fileUrl is an IPFS hash — the devtools snippet can only be injected into local bundles.',
        )
      }
      logger.debug(`config.fileUrl is an IPFS hash, so we use this: ${cfg.fileUrl}`)
      return cfg.fileUrl
    }

    logger.debug(`config.fileUrl is not an IPFS hash, so we zip it: ${cfg.fileUrl}`)

    const isFolder = await checkIsFolder(cfg.fileUrl)
    if (isFolder) {
      if (!cfg.entrypoint) {
        logger.error('entrypoint is required for folders')
        throw new Error('entrypoint is required for folders')
      }
      logger.debug(`config.fileUrl is a folder, so we use the entrypoint: ${cfg.entrypoint}`)
    }

    const entrypoint = cfg.entrypoint ?? basename(cfg.fileUrl)

    let { zipPath } = await zipFolder(
      cfg.fileUrl,
      bundleFolder,
      createManifest(
        cfg.projectName,
        entrypoint,
        cfg.restartPolicy ?? RestartPolicy.OnFailure,
        cfg.image,
      ),
      cfg.projectName,
      logger,
    )

    if (options.transformBundle) {
      zipPath = await options.transformBundle({ zipPath, entrypoint })
    }

    logger.log(`zipPath ${zipPath}`)

    return uploadScript({ file: zipPath }, options.ipfs)
  }

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
