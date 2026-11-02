import { z, type ZodIssue } from 'zod'
import {
  AssignmentStrategyVariant,
  type AcurastProjectConfig,
  RestartPolicy,
  DeploymentRuntime,
  RequiredModules,
  ScriptMutability,
  MultiOrigin,
} from './project.js'
import {
  getScheduleDurationMs,
  isStartAtMsFromNow,
  isStartAtTimestamp,
  MIN_EXECUTION_DURATION_MS,
  MAX_START_TIME_FROM_NOW_MS,
  DEFAULT_TIME_BETWEEN_EXECUTIONS_MS,
} from '../chain/config-to-job.js'

const isAcurastAddress = (val: string) => {
  // TODO: Add address validation
  return true
}
const isNotAcurastAddressMessage: string = 'Invalid Acurast address'

export const acurastProjectConfigSchema = z
  .object({
    projectName: z.string(),
    fileUrl: z.string(),
    entrypoint: z.string().optional(),
    image: z
      .object({
        url: z.string(),
        sha256: z.string(),
      })
      .optional(),
    network: z.union([z.literal('mainnet'), z.literal('canary')]),
    onlyAttestedDevices: z.boolean(),
    startAt: z
      .union([
        z.object({ msFromNow: z.number().min(0) }),
        z.object({
          timestamp: z.union([
            z
              .number()
              .refine(
                (val) => {
                  const date = new Date(val)
                  return !isNaN(date.getTime())
                },
                { message: 'Invalid timestamp' },
              )
              .refine(
                (val) => {
                  return val >= Date.now()
                },
                { message: 'Timestamp cannot be in the past' },
              ),
            z.string().datetime(),
          ]),
        }),
      ])
      .optional(),
    assignmentStrategy: z.union([
      z.object({
        type: z.literal(AssignmentStrategyVariant.Single),
        instantMatch: z
          .array(
            z.object({
              processor: z.string().refine(isAcurastAddress, isNotAcurastAddressMessage),
              maxAllowedStartDelayInMs: z.number().min(0),
            }),
          )
          .optional(),
      }),
      z.object({
        type: z.literal(AssignmentStrategyVariant.Competing),
      }),
    ]),
    execution: z.union([
      z
        .object({
          type: z.literal('onetime'),
          maxExecutionTimeInMs: z.number().min(1),
        })
        .strict(),
      z
        .object({
          type: z.literal('interval'),
          intervalInMs: z.number().min(1),
          numberOfExecutions: z.number().min(1),
          maxExecutionTimeInMs: z.number().min(1).optional(),
        })
        .strict()
        .refine(
          (data) => {
            if (data.maxExecutionTimeInMs === undefined) return true
            return data.maxExecutionTimeInMs < data.intervalInMs
          },
          {
            message: 'maxExecutionTimeInMs must be less than intervalInMs',
            path: ['maxExecutionTimeInMs'],
          },
        ),
    ]),
    maxAllowedStartDelayInMs: z.number().min(0),
    usageLimit: z.object({
      maxMemory: z.number().min(0),
      maxNetworkRequests: z.number().min(0),
      maxStorage: z.number().min(0),
    }),
    numberOfReplicas: z.number().min(1).max(64),
    requiredModules: z.array(z.nativeEnum(RequiredModules)).optional(),
    minProcessorReputation: z.number().min(0),
    maxCostPerExecution: z.number().min(0),
    includeEnvironmentVariables: z.array(z.string()).optional(),
    processorWhitelist: z
      .array(z.string().refine(isAcurastAddress, isNotAcurastAddressMessage))
      .optional(),
    minProcessorVersions: z
      .union([
        z.object({
          android: z.union([z.string(), z.number()]),
          ios: z.union([z.string(), z.number()]).optional(),
        }),
        z.object({
          android: z.union([z.string(), z.number()]).optional(),
          ios: z.union([z.string(), z.number()]),
        }),
        z.object({
          android: z.union([z.string(), z.number()]),
          ios: z.union([z.string(), z.number()]),
        }),
      ])
      .optional(),
    restartPolicy: z.nativeEnum(RestartPolicy).optional(),
    resetExitCode: z
      .number({ invalid_type_error: 'resetExitCode must be an integer between 1 and 125' })
      .int('resetExitCode must be an integer between 1 and 125')
      .min(1, 'resetExitCode must be an integer between 1 and 125')
      .max(125, 'resetExitCode must be an integer between 1 and 125')
      .optional(),
    runtime: z.nativeEnum(DeploymentRuntime).optional(),
    mutability: z.nativeEnum(ScriptMutability).optional(),
    reuseKeysFrom: z.tuple([z.nativeEnum(MultiOrigin), z.string(), z.number()]).optional(),
    benchmarkFilters: z
      .object({
        minRamTotalBytes: z.number().min(0).optional(),
        minCpuSingleCoreScore: z.number().min(0).optional(),
        minCpuMultiCoreScore: z.number().min(0).optional(),
        minStorageAvailBytes: z.number().min(0).optional(),
        poolIds: z
          .object({
            cpuSingleCore: z.number().int().min(0).max(255).optional(),
            cpuMultiCore: z.number().int().min(0).max(255).optional(),
            ramTotal: z.number().int().min(0).max(255).optional(),
            storageAvail: z.number().int().min(0).max(255).optional(),
          })
          .optional(),
      })
      .optional(),
  })
  .refine(
    (data) => {
      if (
        data.assignmentStrategy.type === AssignmentStrategyVariant.Single &&
        data.assignmentStrategy.instantMatch != null &&
        data.assignmentStrategy.instantMatch.length > 0
      ) {
        return data.assignmentStrategy.instantMatch.length === data.numberOfReplicas
      }
      return true
    },
    {
      message:
        'The number of instantMatch entries must equal numberOfReplicas. Each slot requires exactly one matched processor.',
      path: ['assignmentStrategy', 'instantMatch'],
    },
  )
  .superRefine((data, context) => {
    // Limits enforced by the Acurast runtime; catching them here gives a
    // clear message before the job is submitted and rejected on chain.
    const durationMs = getScheduleDurationMs(data.execution)
    if (durationMs < MIN_EXECUTION_DURATION_MS) {
      const hint =
        data.execution.type === 'interval' && data.execution.maxExecutionTimeInMs === undefined
          ? `Without "execution.maxExecutionTimeInMs", the duration is derived from "execution.intervalInMs" (interval minus ${DEFAULT_TIME_BETWEEN_EXECUTIONS_MS + 1}ms). Set "execution.maxExecutionTimeInMs" to at least ${MIN_EXECUTION_DURATION_MS} or increase "execution.intervalInMs" to at least ${MIN_EXECUTION_DURATION_MS + DEFAULT_TIME_BETWEEN_EXECUTIONS_MS + 1}.`
          : `Set "execution.maxExecutionTimeInMs" to at least ${MIN_EXECUTION_DURATION_MS} (1 minute).`
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Each execution must run for at least 1 minute, but the configured duration is ${durationMs}ms. ${hint}`,
        path: ['execution', 'maxExecutionTimeInMs'],
      })
    }

    if (data.startAt) {
      let startsInMs: number | undefined
      let startAtPath: string | undefined
      if (isStartAtMsFromNow(data.startAt)) {
        startsInMs = data.startAt.msFromNow
        startAtPath = 'msFromNow'
      } else if (isStartAtTimestamp(data.startAt)) {
        startsInMs = new Date(data.startAt.timestamp).getTime() - Date.now()
        startAtPath = 'timestamp'
      }
      if (startsInMs !== undefined && startsInMs > MAX_START_TIME_FROM_NOW_MS) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Deployments cannot be scheduled to start more than 24 hours in the future, but "startAt" is ${Math.round(startsInMs / 3_600_000)} hours from now. Choose a start time within the next 24 hours.`,
          path: ['startAt', startAtPath!],
        })
      }
    }
  })

const acurastProjectConfigSchemaWithNotes = acurastProjectConfigSchema.superRefine(
  (data, context) => {
    if (!data.onlyAttestedDevices) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Note: onlyAttestedDevices is set to false. This means that the deployment will run on all devices, including unattested devices. This is not recommended for production deployments.',
        path: ['onlyAttestedDevices'],
      })
    }
    if (data.startAt) {
      if ('msFromNow' in data.startAt) {
        if (
          data.assignmentStrategy.type === AssignmentStrategyVariant.Single &&
          !data.assignmentStrategy.instantMatch &&
          data.startAt.msFromNow < 300_000
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'The start time is less than 5 minutes from now. This can lead to the deployment not running.',
            path: ['startAt', 'msFromNow'],
          })
        }
        if (
          data.assignmentStrategy.type === AssignmentStrategyVariant.Single &&
          data.assignmentStrategy.instantMatch &&
          data.startAt.msFromNow < 120_000
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'The start time is less than 2 minutes from now. Even with an instantMatch provided, this can lead to the deployment not running.',
            path: ['startAt', 'msFromNow'],
          })
        }
      }
      if ('timestamp' in data.startAt) {
        if (
          data.assignmentStrategy.type === AssignmentStrategyVariant.Single &&
          data.assignmentStrategy.instantMatch &&
          new Date(data.startAt.timestamp).getTime() - Date.now() < 120_000
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'The start time is less than 5 minutes from now. This can lead to the deployment not running.',
            path: ['startAt', 'timestamp'],
          })
        }
      }
    }

    if (data.runtime === DeploymentRuntime.Shell && !data.image) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'image is required when runtime is Shell',
        path: ['image'],
      })
    }

    if (data.resetExitCode !== undefined && data.runtime !== DeploymentRuntime.Shell) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Warning: resetExitCode only applies to the Shell runtime and is ignored for other runtimes.',
        path: ['resetExitCode'],
      })
    }

    if (
      data.execution.type === 'interval' &&
      data.execution.maxExecutionTimeInMs !== undefined &&
      data.execution.maxExecutionTimeInMs > data.execution.intervalInMs - 10_000
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Warning: maxExecutionTimeInMs should be at least 10s shorter than intervalInMs to allow enough time between executions.',
        path: ['execution', 'maxExecutionTimeInMs'],
      })
    }
  },
)

export const validateConfig = (
  config: unknown,
):
  | { success: true; data: AcurastProjectConfig; notes?: ZodIssue[] }
  | { success: false; error: any; notes?: ZodIssue[] } => {
  const result = {
    ...acurastProjectConfigSchema.safeParse(config),
    notes: acurastProjectConfigSchemaWithNotes.safeParse(config).error?.issues,
  }

  return result
}
