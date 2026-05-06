import { BigNumber } from 'bignumber.js'
import { convertConfigToJob } from '../chain/config-to-job.js'
import { AssignmentStrategyVariant, type AcurastProjectConfig } from '../types/project.js'
import { checkMatch, getAveragePrice, getPriceDistribution } from './api.js'
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
    config.assignmentStrategy.instantMatch &&
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

  if (matchResult.ok && avgPriceResult.ok && distResult.ok) {
    return analyzePricing(
      matchResult.data,
      distResult.data.buckets,
      avgPriceResult.data,
      new BigNumber(config.maxCostPerExecution),
      config.numberOfReplicas,
    )
  }

  return undefined
}
