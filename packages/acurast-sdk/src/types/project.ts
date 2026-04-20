import type { EnvVar, Job, JobEnvironmentsEncrypted, JobId } from './env.js'

export interface AcurastProjectConfig {
  // The name of the project.
  projectName: string

  // The path to the bundled file, including all dependencies (e.g., dist/bundle.js).
  // 3 separate types are accepted:
  // 1. A local file path (single file)
  // 2. A local folder path (folder will be zipped and uploaded)
  // 3. An IPFS hash (ipfs://...)
  fileUrl: string

  // The file that will be started during execution. Defaults to "index.js"
  entrypoint?: string

  // The network on which the project will be deployed.
  network: 'mainnet' | 'canary'

  // A boolean to specify if only attested devices are allowed to run the app.
  onlyAttestedDevices: boolean

  // The start time of the deployment.
  startAt?:
    | {
        // The deployment will start the specified number of milliseconds from now.
        msFromNow: number
      }
    | {
        // The deployment will start at the specified timestamp.
        timestamp: number | string
      }

  // Defines the assignment strategy.
  assignmentStrategy:
    | {
        type: AssignmentStrategyVariant.Single
        instantMatch?: {
          processor: string
          maxAllowedStartDelayInMs: number
        }[]
      }
    | {
        type: AssignmentStrategyVariant.Competing
      }
  execution:
    | {
        type: 'onetime'
        maxExecutionTimeInMs: number
      }
    | {
        type: 'interval'
        intervalInMs: number
        numberOfExecutions: number
        maxExecutionTimeInMs?: number
      }
  maxAllowedStartDelayInMs: number
  usageLimit: {
    maxMemory: number
    maxNetworkRequests: number
    maxStorage: number
  }
  numberOfReplicas: number
  requiredModules?: RequiredModules[]
  minProcessorReputation: number
  maxCostPerExecution: number
  includeEnvironmentVariables?: string[]
  processorWhitelist?: string[]
  minProcessorVersions?: {
    android?: string | number
    ios?: string | number
  }
  restartPolicy?: RestartPolicy
  runtime?: DeploymentRuntime
  mutability?: ScriptMutability
  reuseKeysFrom?: [MultiOrigin, string, number]
  enableDevtools?: boolean
}

export interface AcurastDeployment {
  deployedAt: string

  assignments: {
    processorId: string
    status: 'matched' | 'acknowledged' | 'failed'
  }[]

  status: 'init' | 'deployed' | 'failed'
  config: AcurastProjectConfig
  registration: JobRegistration
  deploymentId?: JobId

  envInfo?: {
    localPubKey: string
    envEncrypted: JobEnvironmentsEncrypted
  }
}

export interface AcurastCliConfig {
  projects: {
    [projectName: string]: AcurastProjectConfig
  }
}

export enum AssignmentStrategyVariant {
  Single = 'Single',
  Competing = 'Competing',
}

export interface JobRegistration {
  script: string
  allowedSources?: string[]
  allowOnlyVerifiedSources: boolean
  schedule: {
    duration: number
    startTime: number
    endTime: number
    interval: number
    maxStartDelay: number
  }
  memory: number
  networkRequests: number
  storage: number
  requiredModules?: any[]
  mutability: ScriptMutability
  reuseKeysFrom?: [MultiOrigin, string, number]
  extra: {
    requirements: {
      assignmentStrategy: {
        variant: AssignmentStrategyVariant
        instantMatch?: { source: string; startDelay: number }[]
      }
      slots: number
      reward: number
      minReputation?: number
      instantMatch?: { source: string; startDelay: number }[]
      processorVersion?: {
        min: {
          platform: number
          buildNumber: number
        }[]
      }
      runtime: DeploymentRuntime
    }
  }
}

export enum RestartPolicy {
  /**
   * The execution will not be restarted, it will run once and then stop. If it fails, it will not be restarted.
   */
  No = 'no',

  /**
   * The execution will be restarted only if it fails. It will restart 3 times per execution to prevent a crash-loop. If it succeeds, it will not be restarted. NOTE: There will be no failure reports on the first and second failure. Only the third failure will be reported.
   */
  OnFailure = 'onFailure',

  /**
   * The execution will be restarted if it fails or succeeds during the execution window, for a maximum of 3 times per execution. NOTE: There will be no execution reports for the first and second termination. Only the third termination will be reported.
   */
  Always = 'always',
}

export enum DeploymentRuntime {
  NodeJS = 'NodeJS',
  NodeJSWithBundle = 'NodeJSWithBundle',
}

export enum ScriptMutability {
  Immutable = 'Immutable',
  Mutable = 'Mutable',
}

export enum MultiOrigin {
  Acurast = 'Acurast',
}

export enum RequiredModules {
  DataEncryption = 'DataEncryption',
  LLM = 'LLM',
}

export class DeploymentError extends Error {
  constructor(
    messageOrError: unknown,
    public readonly code: string,
    public readonly details?: any,
  ) {
    super(
      messageOrError instanceof Error
        ? messageOrError.message
        : typeof messageOrError === 'string'
          ? messageOrError
          : JSON.stringify(messageOrError),
    )
    this.name = 'DeploymentError'
  }
}

// Re-export env types to keep legacy imports working through `@acurast/sdk/types`.
export type { EnvVar, Job, JobEnvironmentsEncrypted, JobId }
