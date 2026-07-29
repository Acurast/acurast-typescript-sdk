import type { SubmittableExtrinsic } from '@polkadot/api/types'
import type { ApiPromise } from '@polkadot/api'
import {
  SequentialTransactionQueue,
  BatchingTransactionQueue,
  getDefaultQueue,
  setDefaultQueue,
  type TransactionQueue,
} from '../src/chain/tx-queue.js'
import type { AcurastSigner } from '../src/chain/signer.js'

// A signer only needs `.address` here; resolveSigner treats a plain object
// without a `signer` field as a KeyringPair-style signer -> options `{}`.
const signer = { address: '5FakeAddr' } as unknown as AcurastSigner

const inBlockResult = (hash: string): any => ({
  status: { isInBlock: true, isFinalized: false, hash },
  dispatchError: undefined,
  txHash: { toHex: () => hash },
  events: [],
})

describe('SequentialTransactionQueue', () => {
  test('submits one at a time (never overlaps) and preserves FIFO order', async () => {
    let active = 0
    let maxActive = 0
    const started: string[] = []

    const makeCall = (id: string): SubmittableExtrinsic<'promise'> =>
      ({
        signAndSend: async (_account: unknown, _options: any, cb: (r: any) => void) => {
          started.push(id)
          active += 1
          maxActive = Math.max(maxActive, active)
          setTimeout(() => {
            active -= 1
            cb(inBlockResult(id))
          }, 5)
          return await Promise.resolve(() => {})
        },
      }) as unknown as SubmittableExtrinsic<'promise'>

    const queue = new SequentialTransactionQueue({} as unknown as ApiPromise, signer)

    const results = await Promise.all([
      queue.enqueue(makeCall('a')),
      queue.enqueue(makeCall('b')),
      queue.enqueue(makeCall('c')),
    ])

    expect(maxActive).toBe(1)
    expect(started).toEqual(['a', 'b', 'c'])
    expect(results.map((h: any) => h.toHex())).toEqual(['a', 'b', 'c'])
  })

  test('does not set an explicit nonce (fresh from node each time)', async () => {
    let capturedNonce: unknown = 'unset'
    const call = {
      signAndSend: async (_account: unknown, options: any, cb: (r: any) => void) => {
        capturedNonce = options.nonce
        void Promise.resolve().then(() => {
          cb(inBlockResult('x'))
        })
        return await Promise.resolve(() => {})
      },
    } as unknown as SubmittableExtrinsic<'promise'>

    const queue = new SequentialTransactionQueue({} as unknown as ApiPromise, signer)
    await queue.enqueue(call)
    expect(capturedNonce).toBeUndefined()
  })
})

describe('default-queue registry', () => {
  const api = { genesisHash: { toHex: () => '0xgenesis' } } as unknown as ApiPromise

  test('lazily creates one shared instance per account', () => {
    const a = getDefaultQueue(api, { address: '5RegistryA' } as unknown as AcurastSigner)
    const b = getDefaultQueue(api, { address: '5RegistryA' } as unknown as AcurastSigner)
    expect(a).toBe(b) // same account -> same instance
  })

  test('setDefaultQueue installs the instance every fallback path resolves to', () => {
    const signer = { address: '5RegistryB' } as unknown as AcurastSigner
    const custom = { enqueue: jest.fn(), size: 0 } as unknown as TransactionQueue
    setDefaultQueue(api, signer, custom)
    expect(getDefaultQueue(api, signer)).toBe(custom) // no second authority to race
  })
})

describe('BatchingTransactionQueue', () => {
  const makeBatchingApi = (nonceSeed: number): any => {
    const accountNextIndex = jest.fn(async () => ({ toNumber: () => nonceSeed }))
    const forceBatch = jest.fn(
      (_calls: unknown[]) =>
        ({
          signAndSend: async (_a: unknown, options: any, cb: (r: any) => void) => {
            ;(forceBatch as any).lastNonce = options.nonce
            void Promise.resolve().then(() => {
              cb(inBlockResult('batch'))
            })
            return await Promise.resolve(() => {})
          },
        }) as unknown as SubmittableExtrinsic<'promise'>,
    )
    const api = {
      tx: { utility: { forceBatch } },
      rpc: {
        chain: { subscribeNewHeads: async (_cb: unknown) => await Promise.resolve(() => {}) },
        system: { accountNextIndex },
      },
    } as unknown as ApiPromise
    return { api, forceBatch, accountNextIndex }
  }

  test('batches multiple calls into forceBatch with a client-managed nonce', async () => {
    const { api, forceBatch } = makeBatchingApi(5)
    const queue = new BatchingTransactionQueue(api, signer, { maxBatchSize: 2 })

    const dummy = (): SubmittableExtrinsic<'promise'> =>
      ({ signAndSend: jest.fn() }) as unknown as SubmittableExtrinsic<'promise'>
    const results = await Promise.all([queue.enqueue(dummy()), queue.enqueue(dummy())])

    expect(forceBatch).toHaveBeenCalledTimes(1)
    expect(forceBatch.mock.calls[0][0].length).toBe(2)
    expect(forceBatch.lastNonce).toBe(5) // seeded from accountNextIndex, not auto
    expect(results.map((h: any) => h.toHex())).toEqual(['batch', 'batch'])

    queue.stop()
  })

  test('on a priority/nonce error, resets the nonce from chain and retries', async () => {
    const { api, accountNextIndex } = makeBatchingApi(9)

    let attempts = 0
    const flaky = {
      signAndSend: async (_a: unknown, _options: any, cb: (r: any) => void) => {
        attempts += 1
        if (attempts === 1) {
          return await Promise.reject(
            new Error('Priority is too low to replace another transaction'),
          )
        }
        void Promise.resolve().then(() => {
          cb(inBlockResult('recovered'))
        })
        return await Promise.resolve(() => {})
      },
    } as unknown as SubmittableExtrinsic<'promise'>

    // maxBatchSize 1 -> single call, flushes immediately (no forceBatch wrapper).
    const queue = new BatchingTransactionQueue(api, signer, { maxBatchSize: 1 })
    const hash: any = await queue.enqueue(flaky)

    expect(hash.toHex()).toBe('recovered')
    expect(attempts).toBe(2) // first failed, retried once
    expect(accountNextIndex.mock.calls.length).toBeGreaterThanOrEqual(2) // seed + reset

    queue.stop()
  })

  test('scopes batch events per item so each onResult sees only its own', async () => {
    const accountNextIndex = jest.fn(async () => ({ toNumber: () => 1 }))
    const ev = (section: string, method: string, data: any[]): any => ({
      event: { section, method, data },
    })
    // A forceBatch result: call-0 events, ItemCompleted, call-1 events,
    // ItemCompleted, then batch-level markers.
    const batchEvents = [
      ev('acurast', 'JobRegistrationStoredV2', ['job-A']),
      ev('utility', 'ItemCompleted', []),
      ev('acurast', 'JobRegistrationStoredV2', ['job-B']),
      ev('utility', 'ItemCompleted', []),
      ev('utility', 'BatchCompleted', []),
      ev('system', 'ExtrinsicSuccess', []),
    ]
    const forceBatch = jest.fn(
      () =>
        ({
          signAndSend: async (_a: unknown, _o: any, cb: (r: any) => void) => {
            void Promise.resolve().then(() => {
              cb({
                status: { isInBlock: true, hash: 'batch' },
                dispatchError: undefined,
                txHash: { toHex: () => 'batch' },
                events: batchEvents,
              })
            })
            return await Promise.resolve(() => {})
          },
        }) as unknown as SubmittableExtrinsic<'promise'>,
    )
    const api = {
      tx: { utility: { forceBatch } },
      rpc: {
        chain: { subscribeNewHeads: async () => await Promise.resolve(() => {}) },
        system: { accountNextIndex },
      },
    } as unknown as ApiPromise

    const queue = new BatchingTransactionQueue(api, signer, { maxBatchSize: 2 })
    const seen: Record<string, string[]> = { A: [], B: [] }
    const dummy = (): SubmittableExtrinsic<'promise'> =>
      ({ signAndSend: jest.fn() }) as unknown as SubmittableExtrinsic<'promise'>
    const collect = (key: string) => (r: any) => {
      for (const rec of r.events) {
        if (rec.event.method === 'JobRegistrationStoredV2') seen[key].push(rec.event.data[0])
      }
    }
    await Promise.all([
      queue.enqueue(dummy(), { onResult: collect('A') }),
      queue.enqueue(dummy(), { onResult: collect('B') }),
    ])

    // Each item saw exactly its own registration event, not the sibling's.
    expect(seen.A).toEqual(['job-A'])
    expect(seen.B).toEqual(['job-B'])

    queue.stop()
  })
})
