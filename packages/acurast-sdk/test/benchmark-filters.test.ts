import { convertConfigToJob } from '../src/chain/config-to-job.js'
import { buildBenchmarkMetricTriples, parseByteSize } from '../src/chain/benchmark-filters.js'
import { jobToMatchCheckParams } from '../src/matcher/api.js'
import type { AcurastProjectConfig } from '../src/types/project.js'
import { AssignmentStrategyVariant } from '../src/types/project.js'

const baseConfig = (): AcurastProjectConfig => ({
  projectName: 't',
  fileUrl: 'ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdGti',
  network: 'canary',
  onlyAttestedDevices: true,
  assignmentStrategy: { type: AssignmentStrategyVariant.Competing },
  execution: { type: 'onetime', maxExecutionTimeInMs: 10_000 },
  maxAllowedStartDelayInMs: 10_000,
  usageLimit: { maxMemory: 0, maxNetworkRequests: 0, maxStorage: 0 },
  numberOfReplicas: 1,
  minProcessorReputation: 0,
  maxCostPerExecution: 100_000_000_000,
})

describe('parseByteSize', () => {
  test('parses GB and gib', () => {
    expect(parseByteSize('4GB')).toBe(4_000_000_000n)
    expect(parseByteSize('4GiB')).toBe(4n * 1024n ** 3n)
    expect(parseByteSize('512 mb')).toBe(512_000_000n)
  })

  test('preserves precision for fractional TiB input', () => {
    expect(parseByteSize('1.5TiB')).toBe((3n * 1024n ** 4n) / 2n)
    expect(parseByteSize('0.1GiB')).toBe(1024n ** 3n / 10n)
  })

  test('throws on unknown unit', () => {
    expect(() => parseByteSize('5xb')).toThrow()
  })
})

describe('buildBenchmarkMetricTriples', () => {
  test('combines filters with default pool IDs', () => {
    const triples = buildBenchmarkMetricTriples({
      minMemoryBytes: 4096,
      minCpuSingleCoreScore: 1000,
      minStorageBytes: 1024,
      minStorageIoScore: 500,
    })
    expect(triples).toEqual([
      [2, 4096n, 1n],
      [1, 1000n, 1n],
      [3, 1024n, 1n],
      [4, 500n, 1n],
    ])
  })

  test('respects poolIds overrides', () => {
    const triples = buildBenchmarkMetricTriples({
      minCpuSingleCoreScore: 100,
      poolIds: { cpuSingleCore: 9 },
    })
    expect(triples).toEqual([[9, 100n, 1n]])
  })
})

describe('jobToMatchCheckParams min_metrics', () => {
  test('includes encoded triples when benchmark filters set', () => {
    const config = {
      ...baseConfig(),
      benchmarkFilters: {
        minMemoryBytes: 4_000_000_000,
        minCpuSingleCoreScore: 1000,
      },
    }
    const job = convertConfigToJob(config)
    const params = jobToMatchCheckParams(config, job, '5FHneW46xGXgs5mUyeUd4oWuhVRfBgjXqUfeXUaTcpt')
    expect(params.min_metrics).toEqual([
      [2, '4000000000'],
      [1, '1000'],
    ])
  })

  test('null min_metrics when no filters', () => {
    const config = baseConfig()
    const job = convertConfigToJob(config)
    const params = jobToMatchCheckParams(config, job, '5FHneW46xGXgs5mUyeUd4oWuhVRfBgjXqUfeXUaTcpt')
    expect(params.min_metrics).toBeNull()
  })
})
