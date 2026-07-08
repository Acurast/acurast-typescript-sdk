import { convertConfigToJob } from '@acurast/sdk/chain'
import {
  AssignmentStrategyVariant,
  DeploymentRuntime,
  RequiredModules,
  type AcurastProjectConfig,
} from '@acurast/sdk/types'
import { generateTunnelKeypair, computeClientId } from './keypair.js'
import { VPS_IMAGE_PRESETS } from './images.js'
import type { VpsRequest, VpsDeploymentPlan } from './types.js'

/**
 * IPFS CID of the tunnel bundle shipped in `../tunnel/` (start.sh + tunnel.py +
 * callback.sh + getifaddrs_override.c). The bundle expects the deploy agent to
 * inject `TUNNEL_KEY` (P-256 PKCS#8 base64) and `SSH_AUTHORIZED_KEY`, and
 * exposes dropbear on 2222 behind the secondary tunnel.
 *
 * Populated by the release flow: tar `tunnel/` → pin → paste the CID here →
 * publish. The interface in this file and the script version are then locked
 * together per `@acurast/vps` release.
 */
export const TUNNEL_SCRIPT_IPFS = 'ipfs://QmWzeuQM55UrHR9WWv7tEcpwYrM4NWmw7oWvSoxgXqoH9D'

const DEFAULT_REWARD = 48_686_320_000

/**
 * Build a VPS deployment plan from a `vps: {}` request body:
 * 1. Generates a P-256 keypair and precomputes the tunnel clientId
 * 2. Constructs the Acurast JobRegistration for the Shell/tunnel runtime
 * 3. Returns env vars to inject after the job is matched
 *
 * Usage:
 *   const plan = buildVpsJob({ sshKey: '...', image: 'ubuntu' })
 *   const txHash = await registerJob(api, signer, plan.job, callback)
 *   // after WaitingForMatch, inject plan.envVars via setEnvVars
 *   return { domain: `https://${plan.clientId}.acu.run`, txHash }
 */
export function buildVpsJob(options: VpsRequest): VpsDeploymentPlan {
  const scriptCid = options.scriptCid ?? TUNNEL_SCRIPT_IPFS
  if (!scriptCid) {
    throw new Error(
      'No tunnel script IPFS CID configured. Pass scriptCid in the request or set VPS_TUNNEL_SCRIPT_CID in the environment.',
    )
  }

  const imageName = options.image ?? 'ubuntu'
  const image = VPS_IMAGE_PRESETS[imageName]

  const tunnelKey = generateTunnelKeypair()
  const clientId = computeClientId(tunnelKey.publicKeyCompressed)

  const config: AcurastProjectConfig = {
    projectName: 'acurast-vps',
    fileUrl: scriptCid,
    entrypoint: 'start.sh',
    runtime: DeploymentRuntime.Shell,
    image,
    network: options.network ?? 'mainnet',
    onlyAttestedDevices: true,
    startAt: { msFromNow: 120_000 },
    assignmentStrategy: { type: AssignmentStrategyVariant.Single },
    execution: {
      type: 'onetime',
      maxExecutionTimeInMs: 2 * 60 * 60 * 1000,
    },
    maxAllowedStartDelayInMs: 10_000,
    usageLimit: { maxMemory: 0, maxNetworkRequests: 0, maxStorage: 0 },
    numberOfReplicas: 1,
    requiredModules: [RequiredModules.Shell],
    minProcessorReputation: 0,
    maxCostPerExecution: options.reward ?? DEFAULT_REWARD,
    minProcessorVersions: { android: '1.26.0' },
    includeEnvironmentVariables: ['TUNNEL_KEY', 'SSH_AUTHORIZED_KEY', 'NETWORK'],
    benchmarkFilters: {
      minRamTotalBytes: options.minMemory,
      minCpuSingleCoreScore: options.minCpu,
    },
  }

  const job = convertConfigToJob(config)

  const envVars = [
    { key: 'TUNNEL_KEY', value: tunnelKey.privateKeyPkcs8.toString('base64') },
    { key: 'SSH_AUTHORIZED_KEY', value: options.sshKey },
  ]

  return { job, tunnelKey, clientId, envVars }
}
