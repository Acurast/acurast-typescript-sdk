import type { BenchmarkPoolIds } from '../types/project.js'

export type AcurastNetwork = 'mainnet' | 'canary'

/**
 * Metric pool IDs as registered on each Acurast network's `acurastCompute` pallet.
 * Verified against chain state on 2026-05-25 via `acurastCompute.metricPools` storage.
 *
 * Mainnet has 4 pools; canary/devnet have 6 (with extra `ram_speed` / `storage_speed`
 * pools at IDs 4 and 6). The SDK only exposes filters for pools that exist on every
 * network, so `storage_avail` is the only ID that diverges (4 on mainnet, 5 on canary).
 */
const MAINNET_POOL_IDS: BenchmarkPoolIds = {
  cpuSingleCore: 1,
  cpuMultiCore: 2,
  ramTotal: 3,
  storageAvail: 4,
}

const CANARY_POOL_IDS: BenchmarkPoolIds = {
  cpuSingleCore: 1,
  cpuMultiCore: 2,
  ramTotal: 3,
  storageAvail: 5,
}

export function getDefaultBenchmarkPoolIds(network: AcurastNetwork): BenchmarkPoolIds {
  return network === 'mainnet' ? { ...MAINNET_POOL_IDS } : { ...CANARY_POOL_IDS }
}
