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
  test('canary: storage_avail is pool 5', () => {
    const triples = buildBenchmarkMetricTriples('canary', {
      minRamTotalBytes: 4096,
      minCpuSingleCoreScore: 1000,
      minCpuMultiCoreScore: 2000,
      minStorageAvailBytes: 1024,
    })
    expect(triples).toEqual([
      [3, 4096n, 1n], // ram_total
      [1, 1000n, 1n], // cpu_single_core
      [2, 2000n, 1n], // cpu_multi_core
      [5, 1024n, 1n], // storage_avail (canary)
    ])
  })

  test('mainnet: storage_avail is pool 4', () => {
    const triples = buildBenchmarkMetricTriples('mainnet', {
      minRamTotalBytes: 4096,
      minCpuSingleCoreScore: 1000,
      minCpuMultiCoreScore: 2000,
      minStorageAvailBytes: 1024,
    })
    expect(triples).toEqual([
      [3, 4096n, 1n],
      [1, 1000n, 1n],
      [2, 2000n, 1n],
      [4, 1024n, 1n],
    ])
  })

  test('respects poolIds overrides', () => {
    const triples = buildBenchmarkMetricTriples('mainnet', {
      minCpuSingleCoreScore: 100,
      poolIds: { cpuSingleCore: 9 },
    })
    expect(triples).toEqual([[9, 100n, 1n]])
  })
})

describe('jobToMatchCheckParams min_metrics', () => {
  test('canary: ram filter maps to pool 3', () => {
    const config = {
      ...baseConfig(),
      benchmarkFilters: {
        minRamTotalBytes: 4_000_000_000,
        minCpuSingleCoreScore: 1000,
      },
    }
    const job = convertConfigToJob(config)
    const params = jobToMatchCheckParams(config, job, '5FHneW46xGXgs5mUyeUd4oWuhVRfBgjXqUfeXUaTcpt')
    expect(params.min_metrics).toEqual([
      [3, '4000000000'],
      [1, '1000'],
    ])
  })

  test('mainnet ram filter maps to pool 3, not pool 2', () => {
    const config: AcurastProjectConfig = {
      ...baseConfig(),
      network: 'mainnet',
      benchmarkFilters: { minRamTotalBytes: 12_000_000_000 },
    }
    const job = convertConfigToJob(config)
    const params = jobToMatchCheckParams(config, job, '5FHneW46xGXgs5mUyeUd4oWuhVRfBgjXqUfeXUaTcpt')
    expect(params.min_metrics).toEqual([[3, '12000000000']])
  })

  test('mainnet storage filter maps to pool 4', () => {
    const config: AcurastProjectConfig = {
      ...baseConfig(),
      network: 'mainnet',
      benchmarkFilters: { minStorageAvailBytes: 1_000_000_000 },
    }
    const job = convertConfigToJob(config)
    const params = jobToMatchCheckParams(config, job, '5FHneW46xGXgs5mUyeUd4oWuhVRfBgjXqUfeXUaTcpt')
    expect(params.min_metrics).toEqual([[4, '1000000000']])
  })

  test('canary storage filter maps to pool 5', () => {
    const config: AcurastProjectConfig = {
      ...baseConfig(),
      network: 'canary',
      benchmarkFilters: { minStorageAvailBytes: 1_000_000_000 },
    }
    const job = convertConfigToJob(config)
    const params = jobToMatchCheckParams(config, job, '5FHneW46xGXgs5mUyeUd4oWuhVRfBgjXqUfeXUaTcpt')
    expect(params.min_metrics).toEqual([[5, '1000000000']])
  })

  test('null min_metrics when no filters', () => {
    const config = baseConfig()
    const job = convertConfigToJob(config)
    const params = jobToMatchCheckParams(config, job, '5FHneW46xGXgs5mUyeUd4oWuhVRfBgjXqUfeXUaTcpt')
    expect(params.min_metrics).toBeNull()
  })
})
