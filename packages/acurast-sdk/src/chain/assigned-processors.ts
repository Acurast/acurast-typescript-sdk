import type { ApiPromise } from '@polkadot/api'
import type { JobId } from '../types/env.js'

/** Normalize chain JSON (e.g. from job id event) to SDK `JobId`. */
export function jobIdFromChainJson(raw: unknown): JobId {
  if (!Array.isArray(raw) || raw.length < 2) {
    throw new Error('Invalid job id payload from chain')
  }
  const originRaw = raw[0] as Record<string, string>
  const num = Number(raw[1])
  if (Number.isNaN(num)) {
    throw new Error('Invalid job id number in chain payload')
  }
  const acurast =
    originRaw.acurast ?? originRaw.Acurast ?? (originRaw as { acurast?: string }).acurast
  const tezos = originRaw.tezos ?? originRaw.Tezos
  if (acurast !== undefined) {
    return [{ acurast }, num]
  }
  if (tezos !== undefined) {
    return [{ tezos }, num]
  }
  throw new Error('Unsupported MultiOrigin in job id payload')
}

/**
 * Lists processor `AccountId`s assigned to a job from `acurastMarketplace.assignedProcessors`.
 * Values are `Option<Null>`; processor addresses are read from the composite storage key only.
 */
export async function listAssignedProcessorAddressesForJob(
  api: ApiPromise,
  jobId: JobId,
): Promise<string[]> {
  const entries = await api.query.acurastMarketplace.assignedProcessors.entries(jobId)
  const addresses: string[] = []
  for (const [key] of entries) {
    const processor = api.createType('AccountId', key.args[1])
    addresses.push(processor.toString())
  }
  return addresses
}
