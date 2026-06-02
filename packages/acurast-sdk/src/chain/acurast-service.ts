import '@polkadot/api-augment'
import { ApiPromise, WsProvider } from '@polkadot/api'
import type { SubmittableExtrinsic, UnsubscribePromise, VoidFn } from '@polkadot/api/types'
import type { DispatchError } from '@polkadot/types/interfaces'
import type { Event } from '@polkadot/types/interfaces/system'
import { type AcurastSigner, resolveSigner } from './signer.js'
import '@polkadot/api-augment'
import type { Hash } from '@polkadot/types/interfaces/runtime'
import type { Codec } from '@polkadot/types/types'
import { BigNumber } from 'bignumber.js'
import {
  AssignmentStrategyVariant,
  CUSTOM_TYPES,
  type AssignmentStrategy,
  type Job,
  type JobAssignment,
  type JobAssignmentInfo,
  type JobEnvironmentEncrypted,
  type JobEnvironmentsEncrypted,
  type JobId,
  type MultiOrigin,
} from '../types/env.js'

export const ACURAST_DECIMALS: number = 12

export type UnsubEvent = () => void
export interface EventSub<T> {
  filter: (event: Event) => boolean
  map: (event: Event) => T
  sub: (data: T) => void
}

const getHumanReadableError = (api: ApiPromise, dispatchError: DispatchError | undefined) => {
  if (!dispatchError) {
    return
  }
  if (dispatchError.isModule) {
    const decoded = api.registry.findMetaError(dispatchError.asModule)
    const { docs, name, section } = decoded
    return `${section}.${name}: ${docs.join(' ')}`
  } else {
    return dispatchError.toString()
  }
}

/**
 * Thin wrapper over a `@polkadot/api` `ApiPromise` configured with the
 * Acurast chain's custom type registry. Holds connection state so repeated
 * queries on the same service instance share one websocket.
 *
 * The RPC endpoint must be supplied explicitly — this class never reads
 * `process.env`.
 */
export class AcurastService {
  public api?: ApiPromise

  private readonly wsProvider: WsProvider
  private connectPromise?: Promise<ApiPromise>

  private eventSubs: Map<string, EventSub<any>> = new Map()
  private unsubEvents?: VoidFn

  constructor(rpcEndpoint: string) {
    this.wsProvider = new WsProvider(rpcEndpoint)
  }

  public async connect(): Promise<ApiPromise> {
    if (this.api !== undefined) {
      return this.api
    }
    if (this.connectPromise !== undefined) {
      return await this.connectPromise
    }

    this.connectPromise = ApiPromise.create({
      provider: this.wsProvider,
      noInitWarn: true,
      types: {
        ...CUSTOM_TYPES,
      },
      rpc: {
        marketplace: {
          filterMatchingSources: {
            description: 'Filters possible matches',
            params: [
              {
                name: 'registration',
                type: 'PalletAcurastMarketplacePartialJobRegistration',
              },
              { name: 'sources', type: 'Vec<AccountId>' },
              {
                name: 'consumer',
                type: 'Option<AcurastCommonMultiOrigin<AccountId>>',
              },
              { name: 'latest_seen_after', type: 'Option<u128>' },
            ],
            type: 'Option<Vec<AccountId>>',
          },
        },
      },
    })
    this.api = await this.connectPromise
    this.connectPromise = undefined

    return this.api
  }

  public async disconnect(): Promise<void> {
    if (this.api) {
      await this.api.disconnect()
      this.api = undefined
    }
  }

  public async getAllJobs(): Promise<Job[]> {
    const api = await this.connect()
    const jobEntries = await api.query['acurast']['storedJobRegistration'].entries()
    return jobEntries.map(([key, value]) => {
      const origin = api.createType('AcurastCommonMultiOrigin', key.args.at(0)!)
      const id = api.createType('u128', key.args.at(1)!)
      const job = api.createType('Option<AcurastCommonJobRegistration>', value).unwrap()
      return {
        id: [this.codecToMultiOrigin(origin), id.toNumber()],
        registration: this.codecToJobRegistration(job),
      }
    })
  }

  public async subscribeToEvent<T>(eventSub: EventSub<T>): Promise<UnsubEvent> {
    const subId: string = Math.random().toString()
    this.eventSubs.set(subId, eventSub)
    if (this.unsubEvents === undefined) {
      const api = await this.connect()
      this.unsubEvents = (await (api.query.system as any).events((events: any) => {
        const subs = Array.from(this.eventSubs.values())
        events.forEach((record: any) => {
          const { event } = record
          for (const sub of subs) {
            if (sub.filter(event)) {
              sub.sub(sub.map(event))
            }
          }
        })
      })) as VoidFn
    }
    return () => {
      this.eventSubs.delete(subId)
      if (this.eventSubs.size === 0 && this.unsubEvents !== undefined) {
        this.unsubEvents()
        this.unsubEvents = undefined
      }
    }
  }

  public async subscribeToJobAssignmentEvents(
    sub: (assignment: JobAssignmentInfo) => void,
  ): Promise<UnsubEvent> {
    const eventSub: EventSub<JobAssignmentInfo> = {
      filter: (event) =>
        event.section === 'acurastMarketplace' && event.method === 'JobRegistrationAssigned',
      map: (event) => ({
        id: this.codectToJobId(event.data.at(0)!),
        processor: event.data.at(1)!.toString(),
        assignment: this.codecToJobAssignment(event.data.at(2)!),
      }),
      sub,
    }
    return await this.subscribeToEvent(eventSub)
  }

  public async assignedProcessors(jobIds: JobId[]): Promise<Map<string, [JobId, string[]]>> {
    const api = await this.connect()
    const result = new Map<string, [JobId, string[]]>()
    const assignedProcessors = (
      await Promise.all(
        jobIds.map((jobId) => api.query['acurastMarketplace']['assignedProcessors'].entries(jobId)),
      )
    ).flat()
    assignedProcessors.forEach(([key, _]) => {
      const jobIdJSON: any = key.args[0].toJSON()
      const jobId: JobId = [
        jobIdJSON[0].acurast ? { acurast: jobIdJSON[0].acurast } : { tezos: jobIdJSON[0].tezos },
        jobIdJSON[1],
      ]
      const processor = api.createType('AccountId', key.args[1])
      const mapKey = this.jobIdToString(jobId)
      const processors = result.get(mapKey)?.[1] ?? []
      processors.push(processor.toString())
      result.set(mapKey, [jobId, processors])
    })
    return result
  }

  public jobIdToString(jobId: JobId): string {
    if (jobId[0].acurast) {
      return `Acurast#${jobId[1]}`
    }
    return `Tezos#${jobId[1]}`
  }

  public async jobAssignments(keys: [string, JobId][]): Promise<JobAssignmentInfo[]> {
    const api = await this.connect()
    const assignments = await api.query['acurastMarketplace']['storedMatches'].multi(keys)
    const values = api.registry.createType(
      'Vec<Option<PalletAcurastMarketplaceAssignment>>',
      assignments,
    )
    const result: (JobAssignmentInfo | undefined)[] = values
      .map((value, index) => {
        if (value.isSome) {
          const assignment = value.unwrap()
          return {
            id: keys[index][1],
            processor: keys[index][0],
            assignment: this.codecToJobAssignment(assignment),
          }
        }
        return undefined
      })
      .filter((value) => value !== undefined)
    return result as JobAssignmentInfo[]
  }

  private jobEnvironmentToCodec(api: ApiPromise, jobEnvironment: JobEnvironmentEncrypted): Codec {
    const publicKey = `0x${jobEnvironment.publicKey}`
    const variables = jobEnvironment.variables.map((variable) => {
      const key = `0x${Buffer.from(variable.key).toString('hex')}`
      const value = `0x${variable.encryptedValue.iv}${variable.encryptedValue.ciphertext}${variable.encryptedValue.authTag}`
      return [key, value]
    })

    return api.createType('AcurastCommonEnvironment', {
      publicKey: api.createType('Bytes', publicKey),
      variables: api.createType('Vec<(Bytes, Bytes)>', variables),
    })
  }

  public async setEnvironment(
    keyring: AcurastSigner,
    jobId: number,
    jobEnvironment: JobEnvironmentEncrypted,
  ): Promise<Hash> {
    const api = await this.connect()
    const acurastJobEnvironment = this.jobEnvironmentToCodec(api, jobEnvironment)
    return this.signAndSend(api, keyring, [
      api.tx['acurast']['setEnvironment'](jobId, keyring.address, acurastJobEnvironment),
    ])
  }

  public async setEnvironments(
    keyring: AcurastSigner,
    jobId: number,
    jobEnvironments: JobEnvironmentsEncrypted,
  ): Promise<Hash> {
    const api = await this.connect()
    const acurastJobEnvironments = jobEnvironments.map((x) => [
      x.processor,
      this.jobEnvironmentToCodec(api, x.jobEnvironment),
    ])

    return this.signAndSend(api, keyring, [
      api.tx['acurast']['setEnvironments'](jobId, acurastJobEnvironments),
    ])
  }

  public async deregisterJob(keyring: AcurastSigner, localJobId: number): Promise<Hash> {
    const api = await this.connect()
    return this.signAndSend(api, keyring, [api.tx['acurast']['deregister'](localJobId)])
  }

  private codecToMultiOrigin(codec: Codec): MultiOrigin {
    const multiOriginJSON = codec.toJSON() as any
    return multiOriginJSON.acurast
      ? { acurast: multiOriginJSON.acurast }
      : { tezos: multiOriginJSON.tezos }
  }

  private async signAndSend(
    api: ApiPromise,
    keyring: AcurastSigner,
    calls: SubmittableExtrinsic<'promise', any>[],
  ): Promise<Hash> {
    let call: SubmittableExtrinsic<'promise', any>
    if (calls.length > 1) {
      call = api.tx.utility.batch(calls)
    } else {
      call = calls[0]
    }

    const { account, options } = resolveSigner(keyring)

    return new Promise(async (resolve, reject) => {
      const unsub = await call
        .signAndSend(account, options, ({ status, events: _events, dispatchError }) => {
          if (dispatchError) {
            const humanReadableError = getHumanReadableError(api, dispatchError)
            if (unsub) unsub()
            reject(new Error(humanReadableError))
            return
          }
          if (status.isInBlock) {
            if (unsub) unsub()
            resolve(status.hash)
            return
          }
        })
        .catch(reject)
    })
  }

  private codectToJobId(codec: Codec): JobId {
    const jobIdJSON = codec.toJSON() as any
    return [
      jobIdJSON[0].acurast ? { acurast: jobIdJSON[0].acurast } : { tezos: jobIdJSON[0].tezos },
      jobIdJSON[1],
    ]
  }

  private codecToJobRegistration(codec: Codec): any {
    const data = codec as any
    return {
      script: new TextDecoder().decode(Buffer.from(data.script.toHex().slice(2), 'hex')),
      allowedSources: data.allowedSources.unwrapOr(undefined)?.toJSON(),
      allowOnlyVerifiedSources: data.allowOnlyVerifiedSources.toJSON(),
      schedule: {
        duration: data.schedule.duration.toNumber(),
        startTime: new Date(data.schedule.startTime.toNumber()),
        endTime: new Date(data.schedule.endTime.toNumber()),
        interval: new BigNumber(data.schedule.interval.toBigInt()),
        maxStartDelay: data.schedule.maxStartDelay.toNumber(),
      },
      memory: data.memory.toNumber(),
      networkRequests: data.networkRequests.toNumber(),
      storage: data.storage.toNumber(),
      requiredModules: data.requiredModules.toJSON() ?? undefined,
      extra: {
        requirements: {
          assignmentStrategy: this.codecToAssignmentStrategy(
            data.extra.requirements.assignmentStrategy,
          ),
          slots: data.extra.requirements.slots.toNumber(),
          reward: new BigNumber(data.extra.requirements.reward.toBigInt()),
          minReputation: (() => {
            const rep = data.extra.requirements.minReputation.unwrapOr(undefined)?.toBigInt()
            if (rep) {
              return new BigNumber(rep)
            }
            return undefined
          })(),
        },
      },
    }
  }

  private codecToAssignmentStrategy(codec: Codec): AssignmentStrategy {
    const data = codec as any
    if (data.isSingle) {
      return {
        variant: AssignmentStrategyVariant.Single,
        instantMatch: data.asSingle.toJSON()?.map((value: any) => ({
          source: value.source,
          startDelay: new BigNumber(value.startDelay),
        })),
      }
    } else if (data.isCompeting) {
      return { variant: AssignmentStrategyVariant.Competing }
    }

    throw new Error(`unsupported AssignmentStrategy variant: ${codec.toString()}`)
  }

  private codecToJobAssignment(codec: Codec): JobAssignment {
    const json = codec.toJSON() as any
    return {
      slot: json.slot,
      startDelay: json.startDelay,
      feePerExecution: new BigNumber(json.feePerExecution),
      acknowledged: json.acknowledged,
      sla: {
        total: new BigNumber(json.sla.total),
        met: new BigNumber(json.sla.met),
      },
      pubKeys: json.pubKeys.map((value: any) => ({
        SECP256r1: value.secp256r1,
        SECP256k1: value.secp256k1,
        ED25519: value.ed25519,
        SECP256r1Encryption: value.secp256r1Encryption,
        SECP256k1Encryption: value.secp256k1Encryption,
      })),
      execution: {
        All: json.execution.all,
        Index: json.execution.index,
      },
    }
  }
}
