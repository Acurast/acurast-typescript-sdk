import '@polkadot/api-augment'
import { ApiPromise, WsProvider } from '@polkadot/api'
import type { KeyringPair } from '@polkadot/keyring/types'
import { basename } from 'node:path'
import { type AcurastProjectConfig, type JobRegistration, RestartPolicy } from '../types/project.js'
import { DeploymentStatus } from '../types/deployment-status.js'
import type { EnvVar, JobId } from '../types/env.js'
import { registerJob } from '../chain/register-job.js'
import { setEnvVars } from '../chain/set-env-vars.js'
import type { KeyStore } from '../chain/key-store.js'
import { uploadScript, type IpfsUploadOptions } from '../ipfs/upload.js'
import { zipFolder, createManifest, checkIsFolder } from './bundle.js'
import { NOOP_LOGGER, type Logger } from './logger.js'

const BUNDLE_FOLDER = '.acurast/bundles'

export interface DeployProjectOptions {
  /** Wallet that signs the deploy extrinsic. */
  wallet: KeyringPair
  /** WebSocket RPC endpoint for the target Acurast chain. */
  rpcEndpoint: string
  /** IPFS pinning service configuration. */
  ipfs: IpfsUploadOptions
  /** Environment variables to be encrypted + submitted after acknowledgement. */
  envVars?: EnvVar[]
  /** When true, upload to IPFS but skip the on-chain `deploy` extrinsic. */
  onlyUpload?: boolean
  /** Per-stage progress callback. */
  statusCallback: (status: DeploymentStatus, data?: any) => void
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
 */
export const deployProject = async (
  config: AcurastProjectConfig,
  job: JobRegistration,
  options: DeployProjectOptions,
): Promise<JobRegistration> => {
  const logger = options.logger ?? NOOP_LOGGER
  const bundleFolder = options.bundleFolder ?? BUNDLE_FOLDER

  const wsProvider = new WsProvider(options.rpcEndpoint)
  const api = await ApiPromise.create({
    provider: wsProvider,
    noInitWarn: true,
  })

  let ipfsHash: string | undefined

  if (config.fileUrl.startsWith('ipfs://')) {
    ipfsHash = config.fileUrl
    if (config.enableDevtools) {
      logger.warn(
        'enableDevtools is ignored when fileUrl is an IPFS hash — the devtools snippet can only be injected into local bundles.',
      )
    }
    logger.debug(`config.fileUrl is an IPFS hash, so we use this: ${ipfsHash}`)
  } else {
    logger.debug(`config.fileUrl is not an IPFS hash, so we zip it: ${config.fileUrl}`)

    const isFolder = await checkIsFolder(config.fileUrl)
    if (isFolder) {
      if (!config.entrypoint) {
        logger.error('entrypoint is required for folders')
        throw new Error('entrypoint is required for folders')
      }
      logger.debug(`config.fileUrl is a folder, so we use the entrypoint: ${config.entrypoint}`)
    }

    const entrypoint = config.entrypoint ?? basename(config.fileUrl)

    let { zipPath } = await zipFolder(
      config.fileUrl,
      bundleFolder,
      createManifest(
        config.projectName,
        entrypoint,
        config.restartPolicy ?? RestartPolicy.OnFailure,
      ),
      config.projectName,
      logger,
    )

    if (options.transformBundle) {
      zipPath = await options.transformBundle({ zipPath, entrypoint })
    }

    logger.log(`zipPath ${zipPath}`)

    ipfsHash = await uploadScript({ file: zipPath }, options.ipfs)

    logger.debug(`ipfsHash: ${ipfsHash}`)
  }

  options.statusCallback(DeploymentStatus.Uploaded, { ipfsHash })
  config.fileUrl = ipfsHash
  job.script = ipfsHash

  options.statusCallback(DeploymentStatus.Prepared, { job })

  let envHasBeenSet = false
  const TWO_MINUTES = 2 * 60 * 1000
  let timeout: NodeJS.Timeout | undefined

  if (!options.onlyUpload) {
    let jobId: JobId | undefined

    const statusCallbackWrapper = (status: DeploymentStatus, data?: any) => {
      if (status === DeploymentStatus.WaitingForMatch) {
        jobId = data.jobIds[0]
      }
      if (status === DeploymentStatus.Acknowledged) {
        if (envHasBeenSet) {
          logger.log(
            'Setting Environment Variables: Env has been set, but new acks have been received.',
          )
          return options.statusCallback(status, data)
        }

        const timeToJobStart = job.schedule.startTime - Date.now()

        const setEnv = async () => {
          envHasBeenSet = true
          if (timeout) {
            clearTimeout(timeout)
          }
          timeout = undefined
          logger.debug('Setting Environment Variables: Preparing transaction')

          if (!jobId) {
            logger.error('Setting Environment Variables: JobId not set')
            throw new Error('DeploymentId not set')
          }

          const envs = await setEnvVars(
            {
              id: jobId,
              registration: job,
              envVars: options.envVars,
            },
            {
              wallet: options.wallet,
              rpcEndpoint: options.rpcEndpoint,
              keyStore: options.keyStore,
            },
          )

          logger.debug(
            `Setting Environment Variables: Done ${envs.hash ? `(hash: ${envs.hash})` : ''}`,
          )
          options.statusCallback(DeploymentStatus.EnvironmentVariablesSet, envs)
        }

        if (data.acknowledged >= config.numberOfReplicas) {
          logger.debug(
            'Setting Environment Variables: Have all acknowledgements, so we can set the env vars now.',
          )
          setEnv()
        } else if (timeToJobStart <= TWO_MINUTES) {
          logger.debug(
            'Setting Environment Variables: Start is scheduled within 2 minutes, so we do it now.',
          )
          setEnv()
        } else if (!timeout) {
          logger.debug(
            `Setting Environment Variables: Start is in the future, timeout will trigger in ${
              timeToJobStart - TWO_MINUTES
            }ms, 2 minutes before start time.`,
          )
          timeout = setTimeout(() => {
            logger.debug(
              'Setting Environment Variables: Was in the future, timeout was awaited, now it will be set.',
            )
            setEnv()
          }, timeToJobStart - TWO_MINUTES)
        }
      }

      options.statusCallback(status, data)
    }

    const result = await registerJob(api, options.wallet, job, statusCallbackWrapper)

    options.statusCallback(DeploymentStatus.Submit, { txHash: result })
  }

  return job
}
