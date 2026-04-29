import '@polkadot/api-augment'
import type { ApiPromise } from '@polkadot/api'
import type { KeyringPair } from '@polkadot/keyring/types'
import type { MultiOrigin } from '../types/project.js'

/**
 * Transfers editor permissions for a mutable deployment.
 *
 * @param api Connected ApiPromise
 * @param injector Signer keypair
 * @param deploymentId Tuple [origin, address, deploymentNumber]
 * @param newEditor AccountId32 address of the new editor (or null to clear)
 * @returns Transaction hash
 */
export const transferEditor = async (
  api: ApiPromise,
  injector: KeyringPair,
  deploymentId: [MultiOrigin, string, number],
  newEditor: string | null,
): Promise<string> => {
  const jobId = [{ acurast: deploymentId[1] }, deploymentId[2]]

  const newEditorOption = newEditor === null ? { None: null } : { Some: newEditor }

  const tx = api.tx.acurastMarketplace.transferEditor(jobId, newEditorOption)
  const signedTx = await tx.signAsync(injector)
  const hash = await signedTx.send()

  return hash.toString()
}
