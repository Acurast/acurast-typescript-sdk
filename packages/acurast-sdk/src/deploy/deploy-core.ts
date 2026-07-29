import '@polkadot/api-augment'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { type AcurastProjectConfig, type JobRegistration } from '../types/project.js'
import { DeploymentStatus } from '../types/deployment-status.js'
import type { EnvVar, JobId } from '../types/env.js'
import { registerJob } from '../chain/register-job.js'
import { setEnvVars } from '../chain/set-env-vars.js'
import type { KeyStore } from '../chain/key-store.js'
import type { AcurastSigner } from '../chain/signer.js'
import { type TransactionQueue, getDefaultQueue } from '../chain/tx-queue.js'
import { NOOP_LOGGER, type Logger } from './logger.js'

export interface DeployProjectCoreOptions {
  /** Wallet that signs the deploy extrinsic (mnemonic pair or injected signer). */
  wallet: AcurastSigner
  /** WebSocket RPC endpoint for the target Acurast chain. */
  rpcEndpoint: string
  /** Environment variables to be encrypted + submitted after acknowledgement. */
  envVars?: EnvVar[]
  /** When true, resolve the script (bundle + upload) but skip the on-chain deploy. */
  onlyUpload?: boolean
  /** Per-stage progress callback. */
  statusCallback: (status: DeploymentStatus, data?: any) => void
  /** Persistent storage for ECDH keypairs used when encrypting env vars. */
  keyStore?: KeyStore
  /** Optional debug logger. */
  logger?: Logger
  /**
   * Submission authority shared by the deploy extrinsic and the follow-up
   * `setEnvironments` extrinsic. Defaults to the shared per-account queue, so
   * successive deploys and their background env-var writes never collide on
   * the nonce. Pass a custom queue (e.g. `BatchingTransactionQueue`) to change
   * the strategy.
   */
  queue?: TransactionQueue
  /**
   * Resolve `config` to an `ipfs://<cid>` URI. Encapsulates the
   * environment-specific bundling + upload (fs/adm-zip in Node, JSZip/fetch in
   * the browser) and the `ipfs://` pass-through case. Called exactly once.
   */
  resolveScript: (config: AcurastProjectConfig) => Promise<string>
}

/**
 * Environment-agnostic deploy orchestrator: resolve script → chain registration
 * → env-var encryption. The only environment-specific step (bundling + IPFS
 * upload) is injected via `resolveScript`, so the CLI (Node) and the Playground
 * (browser) share this exact flow and emit identical `DeploymentStatus` stages.
 */
export const deployProjectCore = async (
  config: AcurastProjectConfig,
  job: JobRegistration,
  options: DeployProjectCoreOptions,
): Promise<JobRegistration> => {
  const logger = options.logger ?? NOOP_LOGGER

  const wsProvider = new WsProvider(options.rpcEndpoint)
  const api = await ApiPromise.create({
    provider: wsProvider,
    noInitWarn: true,
  })

  // One submission authority for both the deploy and its later setEnvironments
  // extrinsic, so they (and any following deploy) share a single nonce source.
  const queue = options.queue ?? getDefaultQueue(api, options.wallet)

  const ipfsHash = await options.resolveScript(config)
  logger.debug(`ipfsHash: ${ipfsHash}`)

  options.statusCallback(DeploymentStatus.Uploaded, { ipfsHash })
  config.fileUrl = ipfsHash
  job.script = ipfsHash

  options.statusCallback(DeploymentStatus.Prepared, { job })

  let envHasBeenSet = false
  const TWO_MINUTES = 2 * 60 * 1000
  let timeout: ReturnType<typeof setTimeout> | undefined

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
              abortIfPastStartMs: job.schedule.startTime - 60_000,
              logger,
              queue,
            },
          )

          logger.debug(
            `Setting Environment Variables: Done ${envs.hash ? `(hash: ${envs.hash})` : ''}`,
          )
          options.statusCallback(DeploymentStatus.EnvironmentVariablesSet, envs)
        }

        const handleEnvError = (err: unknown): void => {
          const error = err instanceof Error ? err : new Error(String(err))
          logger.error(`Setting Environment Variables failed: ${error.message}`)
          options.statusCallback(DeploymentStatus.EnvironmentVariablesSet, { error })
        }

        if (data.acknowledged >= config.numberOfReplicas) {
          logger.debug(
            'Setting Environment Variables: Have all acknowledgements, so we can set the env vars now.',
          )
          setEnv().catch(handleEnvError)
        } else if (timeToJobStart <= TWO_MINUTES) {
          logger.debug(
            'Setting Environment Variables: Start is scheduled within 2 minutes, so we do it now.',
          )
          setEnv().catch(handleEnvError)
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
            setEnv().catch(handleEnvError)
          }, timeToJobStart - TWO_MINUTES)
        }
      }

      options.statusCallback(status, data)
    }

    const result = await registerJob(api, options.wallet, job, statusCallbackWrapper, {
      projectConfig: config,
      queue,
    })

    options.statusCallback(DeploymentStatus.Submit, { txHash: result })
  }

  return job
}
