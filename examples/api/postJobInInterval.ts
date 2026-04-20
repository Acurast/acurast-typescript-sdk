import { type DeploymentStatus, createJob } from './acurast/createJob.js'
import { AssignmentStrategyVariant } from './types.js'

let jobCounter = 0

const MONITORING_URL = ''

const jobStatus: Map<
  number,
  Array<{ status: DeploymentStatus; data: any; timestamp: number }>
> = new Map()

const postJob = () => {
  const localJobCounter = jobCounter
  jobCounter++
  // console.log('Job monitoring is running', localJobCounter)
  createJob(
    {
      projectName: 'report',
      fileUrl: 'examples/ip.js',
      network: 'canary',
      onlyAttestedDevices: true,
      startAt: {
        msFromNow: 300000
      },
      assignmentStrategy: {
        type: AssignmentStrategyVariant.Single
      },
      execution: {
        type: 'onetime',
        maxExecutionTimeInMs: 10000
      },
      maxAllowedStartDelayInMs: 60000,
      usageLimit: {
        maxMemory: 0,
        maxNetworkRequests: 0,
        maxStorage: 0
      },
      numberOfReplicas: 10,
      requiredModules: [],
      minProcessorReputation: 0,
      maxCostPerExecution: 10000000000,
      includeEnvironmentVariables: [],
      processorWhitelist: []
    },
    (status, data) => {
      const entry = jobStatus.get(localJobCounter)
      if (entry == null) {
        jobStatus.set(localJobCounter, [{ status, data, timestamp: Date.now() }])
      } else {
        entry.push({ status, data, timestamp: Date.now() })
        jobStatus.set(localJobCounter, entry)
      }
      console.log(localJobCounter, new Date().toISOString(), 'Status', status)
    }
  )
}

const JOB_INTERVAL = 60_000 * 30 // 30 minutes

postJob()
setInterval(() => {
  postJob()
}, JOB_INTERVAL)

// setTimeout(() => {
//   setInterval(() => {
//     console.log(jobStatus)
//   }, 30_000)
// }, 5_000)
