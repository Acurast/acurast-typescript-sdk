import '@polkadot/api-augment'
import type { ApiPromise } from '@polkadot/api'
import type { KeyringPair } from '@polkadot/keyring/types'
import {
  AssignmentStrategyVariant,
  DeploymentError,
  type AcurastProjectConfig,
  type JobRegistration,
} from '../types/project.js'
import { DeploymentStatus } from '../types/deployment-status.js'
import { buildMinMetricsForDeploy } from './benchmark-filters.js'

export interface RegisterJobOptions {
  projectConfig?: AcurastProjectConfig
}

export const registerJob = (
  api: ApiPromise,
  injector: KeyringPair,
  job: JobRegistration,
  statusCallback: (status: DeploymentStatus, data?: JobRegistration | any) => void,
  registerOptions?: RegisterJobOptions,
): Promise<string> => {
  const script = `0x${Buffer.from(new TextEncoder().encode(job.script)).toString('hex')}`
  return new Promise(async (resolve, reject) => {
    const jobRegistration = api.createType('AcurastCommonJobRegistration', {
      script: api.createType('Bytes', script),
      allowedSources: job.allowedSources
        ? api.createType('Option<Vec<AccountId>>', job.allowedSources)
        : api.createType('Option<Vec<AccountId>>', undefined),
      allowOnlyVerifiedSources: job.allowOnlyVerifiedSources,
      schedule: {
        duration: api.createType('u64', job.schedule.duration),
        startTime: api.createType('u64', job.schedule.startTime),
        endTime: api.createType('u64', job.schedule.endTime),
        interval: api.createType('u64', job.schedule.interval),
        maxStartDelay: api.createType('u64', job.schedule.maxStartDelay),
      },
      memory: api.createType('u32', job.memory),
      networkRequests: api.createType('u32', job.networkRequests),
      storage: api.createType('u32', job.storage),
      requiredModules: api.createType('Vec<AcurastCommonJobModule>', job.requiredModules ?? []),
      extra: api.createType('PalletAcurastMarketplaceRegistrationExtra', {
        requirements: api.createType('PalletAcurastMarketplaceJobRequirements', {
          assignmentStrategy:
            job.extra.requirements.assignmentStrategy.variant == AssignmentStrategyVariant.Single
              ? api.createType('PalletAcurastMarketplaceAssignmentStrategy', {
                  single: job.extra.requirements.assignmentStrategy.instantMatch
                    ? api.createType(
                        'Option<Vec<PalletAcurastMarketplacePlannedExecution>>',
                        job.extra.requirements.assignmentStrategy.instantMatch.map((item) => ({
                          source: api.createType('AccountId', item.source),
                          startDelay: api.createType('u64', item.startDelay.toFixed()),
                        })),
                      )
                    : api.createType('Option<bool>', undefined),
                })
              : api.createType('PalletAcurastMarketplaceAssignmentStrategy', {
                  competing: '',
                }),
          slots: api.createType('u8', job.extra.requirements.slots),
          reward: api.createType('u128', job.extra.requirements.reward),
          minReputation: job.extra.requirements.minReputation
            ? api.createType('Option<u128>', job.extra.requirements.minReputation)
            : api.createType('Option<u128>', undefined),
          processorVersion: job.extra.requirements.processorVersion
            ? api.createType(
                'Option<PalletAcurastMarketplaceProcessorVersionRequirements>',
                job.extra.requirements.processorVersion,
              )
            : api.createType(
                'Option<PalletAcurastMarketplaceProcessorVersionRequirements>',
                undefined,
              ),
          instantMatch: job.extra.requirements.instantMatch
            ? api.createType(
                'Option<Vec<PalletAcurastMarketplacePlannedExecution>>',
                job.extra.requirements.instantMatch.map((item: any) => ({
                  source: api.createType('AccountId', item.source),
                  startDelay: api.createType('u64', item.startDelay),
                })),
              )
            : api.createType('Option<bool>', undefined),
          runtime: api.createType(
            'PalletAcurastMarketplaceRuntime',
            job.extra.requirements.runtime,
          ),
        }),
      }),
    })

    const mutability = api.createType('AcurastCommonScriptMutability', job.mutability)
    const reuseKeysFrom = job.reuseKeysFrom
      ? api.createType('Option<(AcurastCommonMultiOrigin, u128)>', [
          api.createType('AcurastCommonMultiOrigin', {
            acurast: job.reuseKeysFrom[1],
          }),
          api.createType('u128', job.reuseKeysFrom[2]),
        ])
      : api.createType('Option<(AcurastCommonMultiOrigin, u128)>', undefined)
    const minMetrics = registerOptions?.projectConfig
      ? buildMinMetricsForDeploy(api, registerOptions.projectConfig)
      : api.createType('Option<Vec<(u8, u128, u128)>>', [])

    try {
      const unsub = await api.tx['acurastMarketplace']
        ['deploy'](jobRegistration, mutability, reuseKeysFrom, minMetrics)
        .signAndSend(injector, async ({ status, events, txHash, dispatchError }) => {
          const jobRegistrationEvents = events.filter((event) => {
            return (
              event.event.section === 'acurast' && event.event.method === 'JobRegistrationStoredV2'
            )
          })
          const jobIds = jobRegistrationEvents.map((jobRegistrationEvent) => {
            return jobRegistrationEvent.event.data[0]
          })

          if (jobIds.length > 0) {
            statusCallback(DeploymentStatus.WaitingForMatch, {
              jobIds: jobIds.map((jobId) => jobId.toJSON()),
            })
            const unsubStoredJobStatus = await api.query.acurastMarketplace.storedJobStatus.multi(
              jobIds,
              (statuses) => {
                const stat = api.registry.createType(
                  'Vec<Option<PalletAcurastMarketplaceJobStatus>>',
                  statuses,
                )
                stat
                  .map((value, index) => {
                    if (value.isSome) {
                      const statusValue = value.unwrap() as any
                      if (statusValue.isMatched) {
                        statusCallback(DeploymentStatus.Matched, {
                          jobIds: jobIds.map((id) => id.toJSON()),
                        })
                        return { id: jobIds[index], status: 'Matched' }
                      } else if (statusValue.isAssigned) {
                        statusCallback(DeploymentStatus.Acknowledged, {
                          acknowledged: statusValue.asAssigned.toNumber(),
                        })
                        unsubStoredJobStatus()
                        return {
                          id: jobIds[index],
                          status: JSON.stringify({
                            assigned: statusValue.asAssigned.toNumber(),
                          }),
                        }
                      }
                      return { id: jobIds[index], status: 'Open' }
                    }
                    return undefined
                  })
                  .filter((value) => value !== undefined)
              },
            )
          }

          if (status.isInBlock || status.isFinalized) {
            unsub()
          }

          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule)
              const { docs, name, section } = decoded

              reject(
                new DeploymentError(`${docs.join(' ')}`, `${section}.${name}`, {
                  section,
                  name,
                  docs,
                }),
              )
            } else {
              const error = dispatchError.toHuman() || dispatchError.toString()
              reject(
                new DeploymentError(error, 'TransactionError', {
                  originalError: error,
                }),
              )
            }
          } else if (status.isInBlock) {
            resolve(txHash.toHex())
          }
        })
    } catch (e) {
      reject(
        new DeploymentError(
          e instanceof Error ? e.message : 'Unknown error during job deployment',
          'DeploymentError',
          { originalError: e },
        ),
      )
    }
  })
}
