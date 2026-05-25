import { AcurastService } from './acurast-service.js'
import { JobEnvironmentService } from './env-encryption.js'
import type { EnvVar, Job, JobAssignmentInfo, JobId } from '../types/env.js'
import { toNumber } from './job-to-number.js'
import type { KeyringPair } from '@polkadot/keyring/types'
import type { KeyStore } from './key-store.js'
import { NOOP_LOGGER, type Logger } from '../deploy/logger.js'

export interface SetEnvVarsOptions {
  /** Wallet used to sign the `setEnvironments` extrinsic(s). */
  wallet: KeyringPair
  /** WebSocket RPC endpoint for the Acurast chain. */
  rpcEndpoint: string
  /** Persistent ECDH keypair storage. Defaults to in-memory. */
  keyStore?: KeyStore
  /**
   * Max attempts to fetch processor pubKeys before throwing.
   * Default: 20 (≈10 minutes at the default delay).
   */
  maxRetries?: number
  /** Delay between retry attempts in ms. Default: 30_000. */
  retryDelayMs?: number
  /**
   * Absolute timestamp (ms epoch). If `Date.now() >= abortIfPastStartMs`
   * before processors have published their pubKeys, the call aborts with
   * a descriptive error. Callers typically pass `startTime - 60_000` so
   * the helper bails once env vars can no longer reach the processor in
   * time. Leave unset to disable the time-based escape.
   */
  abortIfPastStartMs?: number
  /** Optional debug logger. */
  logger?: Logger
}

export const setEnvVars = async (
  job: Job & { envVars?: EnvVar[] },
  options: SetEnvVarsOptions,
): Promise<{ hash?: string }> => {
  const envVars = job.envVars ?? []
  if (envVars.length === 0) {
    return {}
  }

  const maxRetries = options.maxRetries ?? 20
  const retryDelayMs = options.retryDelayMs ?? 30_000
  const logger = options.logger ?? NOOP_LOGGER

  const acurast = new AcurastService(options.rpcEndpoint)

  let jobAssignmentInfos: JobAssignmentInfo[] = []

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (options.abortIfPastStartMs !== undefined && Date.now() >= options.abortIfPastStartMs) {
      throw new Error(
        `setEnvVars aborted: passed abortIfPastStartMs (${new Date(
          options.abortIfPastStartMs,
        ).toISOString()}) before processors published encryption keys.`,
      )
    }

    logger.debug(`setEnvVars: attempt ${attempt}/${maxRetries} fetching processor pubKeys`)

    let hasPubKeys = false
    try {
      const assignedProcessors = await acurast.assignedProcessors([
        [{ acurast: job.id[0].acurast }, Number(toNumber(job.id[1]))],
      ])

      const keys: Array<[string, JobId]> = Array.from(assignedProcessors.entries()).flatMap(
        ([_, [jobId, processors]]) =>
          processors.map<[string, JobId]>((account) => [account, jobId]),
      )

      jobAssignmentInfos = await acurast.jobAssignments(keys)

      hasPubKeys =
        jobAssignmentInfos.length > 0 &&
        jobAssignmentInfos.some((info) => info.assignment.pubKeys.length > 0)
    } catch (err) {
      logger.warn(
        `setEnvVars: attempt ${attempt}/${maxRetries} RPC error: ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
    }

    if (hasPubKeys) {
      logger.debug(`setEnvVars: pubKeys available after ${attempt} attempt(s)`)
      break
    }

    if (attempt === maxRetries) {
      throw new Error(
        `setEnvVars aborted: gave up after ${maxRetries} attempts — no assigned processor has published encryption keys.`,
      )
    }

    logger.debug(`setEnvVars: no pubKeys yet, retrying in ${retryDelayMs}ms`)
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
  }

  const jobEnvironmentService = new JobEnvironmentService({
    acurastService: acurast,
    keyStore: options.keyStore,
  })
  const res = await jobEnvironmentService.setEnvironmentVariablesMulti(
    options.wallet,
    jobAssignmentInfos,
    Number(toNumber(job.id[1] as any)),
    envVars,
  )

  return { hash: res.hash }
}
