import { AcurastService } from './acurast-service.js'
import { JobEnvironmentService } from './env-encryption.js'
import type { EnvVar, Job, JobId } from '../types/env.js'
import { toNumber } from './job-to-number.js'
import type { KeyringPair } from '@polkadot/keyring/types'
import type { KeyStore } from './key-store.js'

export interface SetEnvVarsOptions {
  /** Wallet used to sign the `setEnvironments` extrinsic(s). */
  wallet: KeyringPair
  /** WebSocket RPC endpoint for the Acurast chain. */
  rpcEndpoint: string
  /** Persistent ECDH keypair storage. Defaults to in-memory. */
  keyStore?: KeyStore
}

export const setEnvVars = async (
  job: Job & { envVars?: EnvVar[] },
  options: SetEnvVarsOptions,
): Promise<{ hash?: string }> => {
  const acurast = new AcurastService(options.rpcEndpoint)

  const assignedProcessors = await acurast.assignedProcessors([
    [{ acurast: job.id[0].acurast }, Number(toNumber(job.id[1]))],
  ])

  const keys: [string, JobId][] = Array.from(assignedProcessors.entries()).flatMap(
    ([_, [jobId, processors]]) => processors.map<[string, JobId]>((account) => [account, jobId]),
  )

  const jobAssignmentInfos = await acurast.jobAssignments(keys)

  const envVars = job.envVars ?? []

  if (envVars.length === 0) {
    return {}
  }

  if (
    jobAssignmentInfos.length === 0 ||
    jobAssignmentInfos.every((info) => info.assignment.pubKeys.length === 0)
  ) {
    // Match happened but hasn't been acknowledged yet — wait and retry.
    await new Promise((resolve) => setTimeout(resolve, 30_000))
    return setEnvVars(job, options)
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
