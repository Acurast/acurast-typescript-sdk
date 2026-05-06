// Project / config types (preserve surface of the legacy `src/types.ts`).
export type {
  AcurastProjectConfig,
  AcurastDeployment,
  AcurastCliConfig,
  JobRegistration,
} from './project.js'
export {
  AssignmentStrategyVariant,
  RestartPolicy,
  DeploymentRuntime,
  ScriptMutability,
  MultiOrigin,
  RequiredModules,
  DeploymentError,
} from './project.js'

// On-chain / env-encryption types (preserve surface of the legacy
// `src/acurast/env/types.ts`). `MultiOrigin` and `AssignmentStrategyVariant`
// intentionally resolve to the project-level definitions above.
export type {
  EnvVar,
  AcurastEnvironment,
  AcurastEnvironments,
  EncryptedValue,
  EnvVarEncrypted,
  JobEnvironmentEncrypted,
  JobEnvironmentsEncrypted,
  PubKey,
  ExecutionSpecifier,
  JobAssignmentSla,
  JobAssignment,
  JobSchedule,
  JobModule,
  JobRegistrationExtra,
  JobRequirements,
  ProcessorVersionRequirements,
  Version,
  AssignmentStrategy,
  PlannedExecution,
  Job,
  JobId,
  JobAssignmentInfo,
  EncKeyCurve,
  ProcessorEncryptionKey,
} from './env.js'
export { CUSTOM_TYPES } from './env.js'

export { DeploymentStatus } from './deployment-status.js'

export { acurastProjectConfigSchema, validateConfig } from './validate-config.js'
