import '@polkadot/api-augment'
import type { ApiPromise } from '@polkadot/api'
import type { SubmittableExtrinsic, VoidFn } from '@polkadot/api/types'
import type { DispatchError } from '@polkadot/types/interfaces'
import type { Hash } from '@polkadot/types/interfaces/runtime'
import type { ISubmittableResult } from '@polkadot/types/types'
import { type AcurastSigner, resolveSigner, getSignerAddress } from './signer.js'

/**
 * Optional per-submission hooks. `onResult` receives every
 * {@link ISubmittableResult} that `signAndSend` emits for the batch this call
 * was included in, letting callers (e.g. `registerJob`) extract events / drive
 * their own follow-up subscriptions without owning the submission itself.
 */
export interface EnqueueHandlers {
  onResult?(result: ISubmittableResult): void | Promise<void>
}

/**
 * A single submission authority for one account. Every extrinsic the SDK sends
 * on behalf of a given signer should flow through one `TransactionQueue` so
 * that nonces never collide (the `Transaction has too low priority to replace
 * another transaction` / 1014 error).
 *
 * The public contract is intentionally tiny — `enqueue` plus introspection.
 * The `dequeue` / `prepareNonce` / `submit` seams live on
 * {@link BaseTransactionQueue} as protected hooks so both the bundled adapters
 * and bring-your-own implementations share the same processing loop.
 */
export interface TransactionQueue {
  /** Submit one extrinsic. Resolves with the in-block hash; rejects on dispatchError. */
  enqueue(call: SubmittableExtrinsic<'promise'>, handlers?: EnqueueHandlers): Promise<Hash>
  /** Pending item count — for health / introspection. */
  readonly size: number
  /** Tear down any background timers/subscriptions. Optional (Sequential has none). */
  stop?(): void | Promise<void>
}

export interface QueuedItem {
  call: SubmittableExtrinsic<'promise'>
  handlers?: EnqueueHandlers
  resolve(hash: Hash): void
  reject(error: unknown): void
  /** Block height when enqueued — used by block-age flushing (Batching only). */
  enqueuedAtBlock?: number
}

const humanReadableError = (api: ApiPromise, dispatchError: DispatchError): string => {
  if (dispatchError.isModule) {
    const { docs, name, section } = api.registry.findMetaError(dispatchError.asModule)
    return `${section}.${name}: ${docs.join(' ')}`
  }
  return dispatchError.toString()
}

/**
 * Shared machinery for {@link SequentialTransactionQueue} and
 * {@link BatchingTransactionQueue}. Holds the item list and runs a single,
 * non-overlapping processing loop: `dequeue()` → `prepareNonce()` →
 * `combine()` → sign+send → await in-block → resolve/reject. Subclasses
 * override the three protected hooks to change batching / nonce strategy.
 */
export abstract class BaseTransactionQueue implements TransactionQueue {
  protected readonly queue: QueuedItem[] = []
  protected processing = false

  constructor(
    protected readonly api: ApiPromise,
    protected readonly signer: AcurastSigner,
  ) {}

  get size(): number {
    return this.queue.length
  }

  async enqueue(call: SubmittableExtrinsic<'promise'>, handlers?: EnqueueHandlers): Promise<Hash> {
    return await new Promise<Hash>((resolve, reject) => {
      const item: QueuedItem = { call, handlers, resolve, reject }
      this.queue.push(item)
      this.onEnqueue(item)
      void this.runOnce()
    })
  }

  /** Hook fired synchronously when an item is added (Batching stamps the block). */
  protected onEnqueue(_item: QueuedItem): void {}

  /**
   * Select the items to submit this round. Return `[]` to submit nothing yet
   * (e.g. Batching waiting for its size/age threshold). Selected items must be
   * removed from `this.queue`.
   */
  protected abstract dequeue(): QueuedItem[]

  /**
   * Resolve the nonce for the next submission. Return `undefined` to let
   * `signAndSend` fetch a fresh `accountNextIndex` (Sequential). Return a
   * number for client-side nonce management (Batching).
   *
   * Kept separate from `dequeue` because nonce prep is an async, account-scoped
   * concern independent of which items are picked.
   */
  protected abstract prepareNonce(): Promise<number | undefined>

  /** Combine selected items into one extrinsic. Default: single, else forceBatch. */
  protected combine(items: QueuedItem[]): SubmittableExtrinsic<'promise'> {
    if (items.length === 1) return items[0].call
    return this.api.tx.utility.forceBatch(items.map((i) => i.call))
  }

  /**
   * Called when a submission attempt throws. Default: reject every item.
   * Batching overrides to reset the nonce and re-queue on nonce errors.
   */
  protected onSubmitError(error: unknown, items: QueuedItem[]): void {
    for (const item of items) item.reject(error)
  }

  protected async runOnce(): Promise<void> {
    if (this.processing) return
    const items = this.dequeue()
    if (items.length === 0) return
    this.processing = true
    try {
      const nonce = await this.prepareNonce()
      const call = this.combine(items)
      const hash = await this.send(call, nonce, items)
      for (const item of items) item.resolve(hash)
    } catch (error) {
      this.onSubmitError(error, items)
    } finally {
      this.processing = false
      if (this.queue.length > 0) {
        queueMicrotask(() => {
          void this.runOnce()
        })
      }
    }
  }

  /** Sign + send `call`, forwarding every result to each item's `onResult`. */
  protected async send(
    call: SubmittableExtrinsic<'promise'>,
    nonce: number | undefined,
    items: QueuedItem[],
  ): Promise<Hash> {
    const { account, options } = resolveSigner(this.signer)
    const signOptions = nonce === undefined ? options : { ...options, nonce }
    return await new Promise<Hash>((resolve, reject) => {
      let unsub: VoidFn | undefined
      let settled = false
      call
        .signAndSend(account, signOptions, (result: ISubmittableResult) => {
          // Each item sees a result scoped to its own submission. For a batch
          // this is that item's slice of the events (see BatchingTransactionQueue)
          // so callers like registerJob don't mistake a sibling's events for
          // their own; for a single submission it's the full result.
          const scoped = this.scopeResults(result, items)
          items.forEach((item, i) => {
            void item.handlers?.onResult?.(scoped[i])
          })
          const { status, dispatchError } = result
          if (dispatchError != null) {
            settled = true
            unsub?.()
            reject(new Error(humanReadableError(this.api, dispatchError)))
            return
          }
          if (status.isInBlock) {
            settled = true
            unsub?.()
            resolve(result.txHash)
          }
        })
        .then((u) => {
          unsub = u
          // The callback may have already fired before this resolved; unsub now.
          if (settled) u()
        })
        .catch(reject)
    })
  }

  /**
   * Map a submission result to a per-item view. Base: every item sees the full
   * result (correct for one-call-per-tx). {@link BatchingTransactionQueue}
   * overrides this to give each item only its own slice of a batch's events.
   */
  protected scopeResults(result: ISubmittableResult, items: QueuedItem[]): ISubmittableResult[] {
    return items.map(() => result)
  }
}

/**
 * Split a `utility.forceBatch` extrinsic's events into one group per inner
 * call, using the `ItemCompleted`/`ItemFailed` markers the pallet deposits
 * after each call (in call order). Batch-level markers are dropped. Returns one
 * group per completed item, aligned with the order the calls were batched.
 */
function sliceBatchEvents(events: readonly any[]): any[][] {
  const groups: any[][] = []
  let current: any[] = []
  for (const record of events) {
    const section = record?.event?.section
    const method = record?.event?.method
    if (section === 'utility' && (method === 'ItemCompleted' || method === 'ItemFailed')) {
      groups.push(current)
      current = []
    } else if (
      section === 'utility' &&
      (method === 'BatchCompleted' ||
        method === 'BatchCompletedWithErrors' ||
        method === 'BatchInterrupted')
    ) {
      // Batch-level marker — belongs to no single item.
    } else {
      current.push(record)
    }
  }
  return groups
}

/**
 * Default adapter: submit exactly one extrinsic at a time, only starting the
 * next once the previous is in a block, letting the node hand out a fresh
 * `accountNextIndex` for each. No client-side nonce state, so it is
 * self-correcting — the safe choice for correctness over throughput.
 */
export class SequentialTransactionQueue extends BaseTransactionQueue {
  protected dequeue(): QueuedItem[] {
    const next = this.queue.shift()
    return next != null ? [next] : []
  }

  protected async prepareNonce(): Promise<number | undefined> {
    return undefined // signAndSend fetches a fresh nonce from the node
  }
}

export interface BatchingQueueOptions {
  /** Max extrinsics per `utility.forceBatch`. Default 20. */
  maxBatchSize?: number
  /** Flush once the oldest queued item is this many blocks old. Default 2. */
  maxBlockAge?: number
  /** How often the flush timer checks the queue, in ms. Default 3000. */
  pollIntervalMs?: number
  /** Max consecutive nonce-error retries before giving up. Default 3. */
  maxNonceRetries?: number
}

const NONCE_ERROR_PATTERNS = [
  '1010',
  '1014',
  'invalid transaction',
  'transaction is outdated',
  'priority is too low',
  'stale',
]

const isNonceError = (error: unknown): boolean => {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase()
  return NONCE_ERROR_PATTERNS.some((p) => message.includes(p))
}

/**
 * Advanced adapter (blueprint: hyperdrive-relayer's transaction queue, minus
 * its `process.exit` / `api.disconnect` behavior). Auto-batches queued
 * extrinsics into `utility.forceBatch`, flushing when the queue reaches
 * `maxBatchSize` or the oldest item is `maxBlockAge` blocks old. Manages the
 * nonce client-side (seeded from `accountNextIndex`, incremented per batch) and
 * resets it from chain + re-queues on a nonce/priority error.
 *
 * Note: all enqueued calls should be built on the same `api` as this queue —
 * `forceBatch` wraps them with this queue's `api`. Per-item on-chain failures
 * surface as `utility.ItemFailed`/`BatchInterrupted` events (visible via
 * `onResult`), not a rejected `enqueue` promise.
 */
export class BatchingTransactionQueue extends BaseTransactionQueue {
  private readonly maxBatchSize: number
  private readonly maxBlockAge: number
  private readonly pollIntervalMs: number
  private readonly maxNonceRetries: number

  private currentBlock = 0
  private currentNonce: number | null = null
  private nonceRetries = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private unsubHeads: VoidFn | null = null

  constructor(api: ApiPromise, signer: AcurastSigner, options: BatchingQueueOptions = {}) {
    super(api, signer)
    this.maxBatchSize = options.maxBatchSize ?? 20
    this.maxBlockAge = options.maxBlockAge ?? 2
    this.pollIntervalMs = options.pollIntervalMs ?? 3000
    this.maxNonceRetries = options.maxNonceRetries ?? 3
  }

  protected onEnqueue(item: QueuedItem): void {
    item.enqueuedAtBlock = this.currentBlock
    this.ensureStarted()
  }

  private ensureStarted(): void {
    if (this.timer !== null) return
    // Track the head so block-age flushing and item stamping stay cheap (no
    // per-enqueue RPC). Kicks a flush check on every new block, too.
    void this.api.rpc.chain
      .subscribeNewHeads((header) => {
        this.currentBlock = header.number.toNumber()
        void this.runOnce()
      })
      .then((u) => {
        this.unsubHeads = u
      })
    this.timer = setInterval(() => {
      void this.runOnce()
    }, this.pollIntervalMs)
  }

  protected dequeue(): QueuedItem[] {
    if (this.queue.length === 0) return []
    const oldest = this.queue[0]
    const age = this.currentBlock - (oldest.enqueuedAtBlock ?? this.currentBlock)
    const ready = this.queue.length >= this.maxBatchSize || age >= this.maxBlockAge
    if (!ready) return []
    return this.queue.splice(0, this.maxBatchSize)
  }

  protected async prepareNonce(): Promise<number | undefined> {
    if (this.currentNonce === null) {
      await this.resetNonce()
    }
    const nonce = this.currentNonce!
    this.currentNonce = nonce + 1
    return nonce
  }

  private async resetNonce(): Promise<void> {
    const address = getSignerAddress(this.signer)
    const next = await this.api.rpc.system.accountNextIndex(address)
    this.currentNonce = next.toNumber()
  }

  protected onSubmitError(error: unknown, items: QueuedItem[]): void {
    if (isNonceError(error) && this.nonceRetries < this.maxNonceRetries) {
      this.nonceRetries += 1
      this.currentNonce = null // force a fresh seed on next prepareNonce
      this.queue.unshift(...items) // retry at the front
      return
    }
    this.nonceRetries = 0
    for (const item of items) item.reject(error)
  }

  protected combine(items: QueuedItem[]): SubmittableExtrinsic<'promise'> {
    if (items.length === 1) return items[0].call
    return this.api.tx.utility.forceBatch(items.map((i) => i.call))
  }

  /**
   * De-multiplex a `forceBatch` result so each item's `onResult` sees only its
   * own call's events. Without this, a batched `registerJob` would read every
   * job's `JobRegistrationStoredV2` event and latch onto the wrong job id.
   * `combine` batches items in order, so the i-th event group maps to items[i].
   */
  protected scopeResults(result: ISubmittableResult, items: QueuedItem[]): ISubmittableResult[] {
    if (items.length <= 1) return [result]
    const groups = sliceBatchEvents(result.events)
    return items.map((_, i) => {
      const view = Object.create(result) as ISubmittableResult
      // Shadow `events` with this item's slice; status/dispatchError/txHash
      // still resolve through the prototype (the shared batch result).
      Object.defineProperty(view, 'events', { value: groups[i] ?? [], enumerable: true })
      return view
    })
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.unsubHeads?.()
    this.unsubHeads = null
  }
}

// ---------------------------------------------------------------------------
// Default per-account queue registry
// ---------------------------------------------------------------------------

const defaultQueues: Map<string, TransactionQueue> = new Map()

const registryKey = (api: ApiPromise, address: string): string =>
  `${api.genesisHash.toHex()}::${address}`

/**
 * Returns the queue shared by every submission for the given account on the
 * given chain. If a consumer installed one via {@link setDefaultQueue}, that
 * instance is returned; otherwise a {@link SequentialTransactionQueue} is
 * lazily created. This is what lets all SDK code paths (registerJob,
 * setEnvVars, editScript, …) share one nonce authority without threading a
 * queue object through every call.
 *
 * Per-call/per-service `queue` overrides still win over this — pass one to
 * deviate a single operation onto a different queue.
 */
export function getDefaultQueue(api: ApiPromise, signer: AcurastSigner): TransactionQueue {
  const key = registryKey(api, getSignerAddress(signer))
  let queue = defaultQueues.get(key)
  if (queue == null) {
    queue = new SequentialTransactionQueue(api, signer)
    defaultQueues.set(key, queue)
  }
  return queue
}

/**
 * Installs `queue` as *the* default for the given account+chain, so every SDK
 * path that doesn't receive an explicit queue resolves to this one instance.
 * Call once at startup with your chosen adapter (e.g. a
 * {@link BatchingTransactionQueue}) to guarantee a single nonce authority per
 * account — otherwise mixing an injected queue on some calls with the
 * lazily-created default on others would create two authorities that race.
 */
export function setDefaultQueue(
  api: ApiPromise,
  signer: AcurastSigner,
  queue: TransactionQueue,
): void {
  defaultQueues.set(registryKey(api, getSignerAddress(signer)), queue)
}
