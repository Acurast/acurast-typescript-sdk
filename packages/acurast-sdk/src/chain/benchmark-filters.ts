import type { ApiPromise } from '@polkadot/api'
import type { AcurastProjectConfig, BenchmarkPoolIds } from '../types/project.js'
import { DEFAULT_BENCHMARK_POOL_IDS } from './benchmark-pool-ids.js'

export type { BenchmarkPoolIds }

/** Rational metric minimum: `pool_id` + FixedU128 = numerator / denominator (see acurast-common `MinMetric`). */
export type MetricTriple = readonly [poolId: number, numerator: bigint, denominator: bigint]

const BYTE_UNIT: Record<string, bigint> = {
  b: 1n,
  kb: 1000n,
  kib: 1024n,
  mb: 1000n ** 2n,
  mib: 1024n ** 2n,
  gb: 1000n ** 3n,
  gib: 1024n ** 3n,
  tb: 1000n ** 4n,
  tib: 1024n ** 4n,
}

/**
 * Parse human-readable byte sizes (`4GB`, `64gib`, `512 MB`) into an integer byte count.
 * Accepts optional space between number and unit; unit is case-insensitive.
 */
export function parseByteSize(input: string): bigint {
  const s = input.trim().replace(/\s+/g, '')
  const m = /^(\d+(?:\.\d+)?)\s*([a-z]*)$/i.exec(s)
  if (!m) {
    throw new Error(`Invalid byte size: "${input}"`)
  }
  const val = Number.parseFloat(m[1])
  if (!Number.isFinite(val) || val < 0) {
    throw new Error(`Invalid number in byte size: "${input}"`)
  }
  const unitRaw = m[2]?.toLowerCase() ?? ''
  const unit = unitRaw === '' ? 'b' : unitRaw
  const mult = BYTE_UNIT[unit]
  if (mult === undefined) {
    throw new Error(`Unknown byte unit "${m[2]}" in "${input}"`)
  }
  const bytes = Math.round(val * Number(mult))
  return BigInt(bytes)
}

function resolvedPoolIds(
  filters: NonNullable<AcurastProjectConfig['benchmarkFilters']>,
): BenchmarkPoolIds {
  return {
    ...DEFAULT_BENCHMARK_POOL_IDS,
    ...filters.poolIds,
  }
}

function toU128String(n: bigint): string {
  if (n < 0n) {
    throw new Error('Metric value must be non-negative')
  }
  return n.toString()
}

/**
 * Build `(pool_id, numerator, denominator)` triples for deploy / matcher APIs.
 * Integer thresholds use denominator `1`.
 */
export function buildBenchmarkMetricTriples(
  filters: NonNullable<AcurastProjectConfig['benchmarkFilters']>,
): MetricTriple[] {
  const pools = resolvedPoolIds(filters)
  const triples: MetricTriple[] = []

  if (filters.minMemoryBytes !== undefined) {
    const b = BigInt(filters.minMemoryBytes)
    triples.push([pools.ramTotalBytes, b, 1n])
  }
  if (filters.minCpuSingleCoreScore !== undefined) {
    const v = BigInt(Math.floor(filters.minCpuSingleCoreScore))
    triples.push([pools.cpuSingleCore, v, 1n])
  }
  if (filters.minStorageBytes !== undefined) {
    const b = BigInt(filters.minStorageBytes)
    triples.push([pools.storageTotalBytes, b, 1n])
  }
  if (filters.minStorageIoScore !== undefined) {
    const v = BigInt(Math.floor(filters.minStorageIoScore))
    triples.push([pools.storageIo, v, 1n])
  }

  return triples
}

/**
 * JSON form of min metrics for the matcher `matches/check` API.
 * The matcher expects `(pool_id, min_value)` pairs (length-2 arrays), not the
 * on-chain `(pool_id, numerator, denominator)` triple used by `deploy`.
 */
export function benchmarkTriplesToMatcherJson(triples: MetricTriple[]): [number, string][] {
  return triples.map(([poolId, num, den]) => {
    if (den !== 1n) {
      throw new Error(
        'Matcher min_metrics only supports integer thresholds (denominator 1); use on-chain deploy for arbitrary rationals.',
      )
    }
    return [poolId, toU128String(num)]
  })
}

export function hasBenchmarkFilters(config: AcurastProjectConfig): boolean {
  const f = config.benchmarkFilters
  if (!f) return false
  return (
    f.minMemoryBytes !== undefined ||
    f.minCpuSingleCoreScore !== undefined ||
    f.minStorageBytes !== undefined ||
    f.minStorageIoScore !== undefined
  )
}

/**
 * Encodes `Option<Vec<(u8, u128, u128)>>` for `acurastMarketplace.deploy`.
 * When no benchmark filters are set, returns the same empty encoding as before (`[]`).
 */
export function buildMinMetricsForDeploy(
  api: ApiPromise,
  config: AcurastProjectConfig,
): ReturnType<ApiPromise['createType']> {
  if (!hasBenchmarkFilters(config) || !config.benchmarkFilters) {
    return api.createType('Option<Vec<(u8, u128, u128)>>', [])
  }
  const triples = buildBenchmarkMetricTriples(config.benchmarkFilters)
  if (triples.length === 0) {
    return api.createType('Option<Vec<(u8, u128, u128)>>', [])
  }
  const encoded = triples.map(([poolId, num, den]) => [
    poolId,
    toU128String(num),
    toU128String(den),
  ])
  return api.createType('Option<Vec<(u8, u128, u128)>>', encoded)
}
