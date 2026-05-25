import { BigNumber } from 'bignumber.js'
import { convertConfigToJob } from '../chain/config-to-job.js'
import { hasBenchmarkFilters } from '../chain/benchmark-filters.js'
import {
  AssignmentStrategyVariant,
  type AcurastProjectConfig,
  type JobRegistration,
} from '../types/project.js'
import {
  checkMatch,
  checkMatchWithReward,
  getAveragePrice,
  getPriceDistribution,
  type PriceDistributionBucket,
} from './api.js'
import { analyzePricing, type PricingAdvice } from './pricing-advisor.js'

/**
 * Fetch match feasibility, average price, and price distribution from the
 * matcher API and roll them into a single `PricingAdvice`.
 *
 * Returns `undefined` when:
 * - no matcher URL is configured (e.g. local dev)
 * - the project uses an instant-match (distribution lookup is meaningless)
 * - any of the three upstream calls fail
 *
 * This function is side-effect free: it never logs, prints, or manipulates
 * spinners. CLI-layer callers are responsible for presenting the result.
 */
export async function fetchPricingAdvice(
  config: AcurastProjectConfig,
  walletAddress: string,
  matcherUrl: string | undefined,
): Promise<PricingAdvice | undefined> {
  const hasInstantMatch =
    config.assignmentStrategy.type === AssignmentStrategyVariant.Single &&
    config.assignmentStrategy.instantMatch != null &&
    config.assignmentStrategy.instantMatch.length > 0

  if (!matcherUrl || hasInstantMatch) {
    return undefined
  }

  const job = convertConfigToJob(config)

  const [matchResult, avgPriceResult, distResult] = await Promise.all([
    checkMatch(matcherUrl, config, job, walletAddress),
    getAveragePrice(matcherUrl, job.schedule.duration),
    getPriceDistribution(matcherUrl, job.schedule.duration, 10),
  ])

  if (!matchResult.ok || !avgPriceResult.ok || !distResult.ok) {
    return undefined
  }

  const advice = analyzePricing(
    matchResult.data,
    distResult.data.buckets,
    avgPriceResult.data,
    new BigNumber(config.maxCostPerExecution),
    config.numberOfReplicas,
  )

  if (!hasBenchmarkFilters(config)) {
    return advice
  }

  const benchmarkAwareSuggested = await computeBenchmarkAwareSuggestedPrice(
    matcherUrl,
    config,
    job,
    walletAddress,
    distResult.data.buckets,
    config.numberOfReplicas,
  )

  return {
    ...advice,
    suggestedPrice: benchmarkAwareSuggested,
    status: resolveStatus(
      advice.matchedProcessors,
      config.numberOfReplicas,
      advice.currentPrice,
      benchmarkAwareSuggested,
    ),
  }
}

/**
 * Lowest bucket boundary whose reward yields >= required processors when
 * the matcher applies the project's benchmark filters. Returns `null` when
 * no boundary qualifies.
 */
async function computeBenchmarkAwareSuggestedPrice(
  matcherUrl: string,
  config: AcurastProjectConfig,
  job: JobRegistration,
  accountId: string,
  buckets: PriceDistributionBucket[],
  requiredProcessors: number,
): Promise<BigNumber | null> {
  if (buckets.length === 0) return null

  for (const bucket of buckets) {
    const candidate = bucket.range_max
    const res = await checkMatchWithReward(matcherUrl, config, job, accountId, candidate)
    if (res.ok && res.data.matched_processors >= requiredProcessors) {
      return new BigNumber(candidate)
    }
  }

  return null
}

function resolveStatus(
  matchedProcessors: number,
  requiredProcessors: number,
  currentPrice: BigNumber,
  suggestedPrice: BigNumber | null,
): PricingAdvice['status'] {
  if (matchedProcessors < requiredProcessors) {
    return 'insufficient'
  }
  if (suggestedPrice != null && currentPrice.gt(suggestedPrice.times(1.5))) {
    return 'overpaying'
  }
  return 'sufficient'
}
