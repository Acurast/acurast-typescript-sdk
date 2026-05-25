import type { ApiPromise } from '@polkadot/api'
import type { AcurastProjectConfig, BenchmarkPoolIds } from '../types/project.js'
import { type AcurastNetwork, getDefaultBenchmarkPoolIds } from './benchmark-pool-ids.js'

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
 * Arithmetic is done in BigInt to avoid float precision loss at TiB scale.
 */
export function parseByteSize(input: string): bigint {
  const s = input.trim().replace(/\s+/g, '')
  const m = /^(\d+)(?:\.(\d+))?\s*([a-z]*)$/i.exec(s)
  if (!m) {
    throw new Error(`Invalid byte size: "${input}"`)
  }
  const wholePart = m[1]
  const fracPart = m[2] ?? ''
  const unitRaw = m[3]?.toLowerCase() ?? ''
  const unit = unitRaw === '' ? 'b' : unitRaw
  const mult = BYTE_UNIT[unit]
  if (mult === undefined) {
    throw new Error(`Unknown byte unit "${m[3]}" in "${input}"`)
  }
  const whole = BigInt(wholePart)
  if (fracPart === '') {
    return whole * mult
  }
  const fracDigits = BigInt(fracPart)
  const scale = 10n ** BigInt(fracPart.length)
  const numerator = whole * scale * mult + fracDigits * mult
  const half = scale / 2n
  return (numerator + half) / scale
}

function resolvedPoolIds(
  network: AcurastNetwork,
  filters: NonNullable<AcurastProjectConfig['benchmarkFilters']>,
): BenchmarkPoolIds {
  return {
    ...getDefaultBenchmarkPoolIds(network),
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
  network: AcurastNetwork,
  filters: NonNullable<AcurastProjectConfig['benchmarkFilters']>,
): MetricTriple[] {
  const pools = resolvedPoolIds(network, filters)
  const triples: MetricTriple[] = []

  if (filters.minRamTotalBytes !== undefined) {
    triples.push([pools.ramTotal, BigInt(filters.minRamTotalBytes), 1n])
  }
  if (filters.minCpuSingleCoreScore !== undefined) {
    triples.push([pools.cpuSingleCore, BigInt(Math.floor(filters.minCpuSingleCoreScore)), 1n])
  }
  if (filters.minCpuMultiCoreScore !== undefined) {
    triples.push([pools.cpuMultiCore, BigInt(Math.floor(filters.minCpuMultiCoreScore)), 1n])
  }
  if (filters.minStorageAvailBytes !== undefined) {
    triples.push([pools.storageAvail, BigInt(filters.minStorageAvailBytes), 1n])
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
    f.minRamTotalBytes !== undefined ||
    f.minCpuSingleCoreScore !== undefined ||
    f.minCpuMultiCoreScore !== undefined ||
    f.minStorageAvailBytes !== undefined
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
  const triples = buildBenchmarkMetricTriples(config.network, config.benchmarkFilters)
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
