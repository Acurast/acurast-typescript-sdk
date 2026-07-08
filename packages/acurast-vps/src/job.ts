import { convertConfigToJob } from '@acurast/sdk/chain'
import {
  AssignmentStrategyVariant,
  DeploymentRuntime,
  RequiredModules,
  type AcurastProjectConfig,
} from '@acurast/sdk/types'
import { generateTunnelKeypair, computeClientId } from './keypair.js'
import { VPS_IMAGES } from './images.js'
import type { VpsOptions, VpsDeploymentPlan } from './types.js'

/**
 * IPFS CID of the pre-uploaded cargo tunnel app bundle (start.sh + tunnel.py + www/).
 * Based on https://github.com/Acurast/acurast-example-apps/tree/main/apps/app-tunnel/cargo
 * TODO: replace with the canonical published CID once uploaded.
 */
export const TUNNEL_SCRIPT_IPFS = ''

const DEFAULT_REWARD = 48_686_320_000

/**
 * Build a VPS deployment plan:
 * 1. Generates a P-256 keypair and precomputes the tunnel clientId
 * 2. Constructs the Acurast JobRegistration for the Shell/tunnel runtime
 * 3. Returns the env vars to inject after the job is matched
 *
 * Usage:
 *   const plan = buildVpsJob({ sshAuthorizedKey: '...' })
 *   const txHash = await registerJob(api, signer, plan.job, callback)
 *   // after WaitingForMatch, inject plan.envVars via setEnvVars
 *   return { domain: `https://${plan.clientId}.acu.run`, txHash }
 */
export function buildVpsJob(options: VpsOptions): VpsDeploymentPlan {
  const scriptCid = options.scriptCid ?? TUNNEL_SCRIPT_IPFS
  if (!scriptCid) {
    throw new Error(
      'No tunnel script IPFS CID configured. Pass scriptCid in VpsOptions or set TUNNEL_SCRIPT_IPFS.',
    )
  }

  const tunnelKey = generateTunnelKeypair()
  const clientId = computeClientId(tunnelKey.publicKeyCompressed)

  const config: AcurastProjectConfig = {
    projectName: 'acurast-vps',
    fileUrl: scriptCid,
    entrypoint: 'start.sh',
    runtime: DeploymentRuntime.Shell,
    image: VPS_IMAGES.ubuntuAarch64,
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
    { key: 'SSH_AUTHORIZED_KEY', value: options.sshAuthorizedKey },
  ]

  return { job, tunnelKey, clientId, envVars }
}
