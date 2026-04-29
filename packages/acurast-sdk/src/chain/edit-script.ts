import '@polkadot/api-augment'
import type { ApiPromise } from '@polkadot/api'
import type { KeyringPair } from '@polkadot/keyring/types'
import type { MultiOrigin } from '../types/project.js'

/**
 * Updates the script of a mutable deployment.
 *
 * @param api Connected ApiPromise
 * @param injector Signer keypair
 * @param deploymentId Tuple [origin, address, deploymentNumber]
 * @param script IPFS URI of the new script (must start with "ipfs://")
 * @returns Transaction hash
 */
export const editScript = async (
  api: ApiPromise,
  injector: KeyringPair,
  deploymentId: [MultiOrigin, string, number],
  script: string
): Promise<string> => {
  if (!script.startsWith('ipfs://')) {
    throw new Error('Script must be an IPFS hash starting with "ipfs://"')
  }

  const jobId = [
    { acurast: deploymentId[1] },
    deploymentId[2],
  ]

  const ipfsHash = script.replace('ipfs://', '')
  const scriptBytes = `0x${Buffer.from(ipfsHash, 'utf8').toString('hex')}`

  const tx = api.tx.acurastMarketplace.editScript(jobId, scriptBytes)
  const signedTx = await tx.signAsync(injector)
  const hash = await signedTx.send()

  return hash.toString()
}
