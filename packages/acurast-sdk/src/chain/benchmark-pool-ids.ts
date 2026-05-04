import type { BenchmarkPoolIds } from '../types/project.js'

/**
 * Default compute-pallet metric pool IDs used when translating high-level
 * benchmark filters into on-chain `min_metrics` / matcher `min_metrics`.
 *
 * Override per deployment via {@link AcurastProjectConfig.benchmarkFilters} `.poolIds`
 * if your chain’s governance assigned different IDs.
 */
export const DEFAULT_BENCHMARK_POOL_IDS: BenchmarkPoolIds = {
  cpuSingleCore: 1,
  ramTotalBytes: 2,
  storageTotalBytes: 3,
  storageIo: 4,
}
