import Keyring from '@polkadot/keyring'
import { waitReady } from '@polkadot/wasm-crypto'
import type { KeyringPair } from '@polkadot/keyring/types'

/**
 * Derive an sr25519 `KeyringPair` from a BIP39 mnemonic.
 *
 * Mnemonic must be supplied explicitly — this package never reads
 * `process.env`. Callers are responsible for sourcing the value.
 */
export const walletFromMnemonic = async (
  mnemonic: string,
  options: { name?: string } = {},
): Promise<KeyringPair> => {
  await waitReady()
  const keyring = new Keyring({ type: 'sr25519' })
  return keyring.addFromMnemonic(mnemonic, {
    name: options.name ?? 'AcurastSdk',
  })
}
