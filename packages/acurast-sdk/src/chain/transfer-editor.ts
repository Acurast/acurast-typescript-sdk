import '@polkadot/api-augment'
import type { ApiPromise } from '@polkadot/api'
import type { KeyringPair } from '@polkadot/keyring/types'
import type { MultiOrigin } from '../types/project.js'
import { type TransactionQueue, getDefaultQueue } from './tx-queue.js'

/**
 * Transfers editor permissions for a mutable deployment.
 *
 * @param api Connected ApiPromise
 * @param injector Signer keypair
 * @param deploymentId Tuple [origin, address, deploymentNumber]
 * @param newEditor AccountId32 address of the new editor (or null to clear)
 * @param queue Submission authority; defaults to the shared per-account queue.
 * @returns Transaction hash (in-block)
 */
export const transferEditor = async (
  api: ApiPromise,
  injector: KeyringPair,
  deploymentId: [MultiOrigin, string, number],
  newEditor: string | null,
  queue?: TransactionQueue,
): Promise<string> => {
  const jobId = [{ acurast: deploymentId[1] }, deploymentId[2]]

  const newEditorOption = newEditor === null ? { None: null } : { Some: newEditor }

  const tx = api.tx.acurastMarketplace.transferEditor(jobId, newEditorOption)
  const hash = await (queue ?? getDefaultQueue(api, injector)).enqueue(tx)

  return hash.toString()
}
