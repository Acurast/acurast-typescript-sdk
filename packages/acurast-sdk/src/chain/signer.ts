import type { AddressOrPair, SignerOptions } from '@polkadot/api/types'
import type { Signer as PolkadotSigner } from '@polkadot/api/types'
import type { KeyringPair } from '@polkadot/keyring/types'

/**
 * A signer backed by an external wallet (browser extension, or the CLI's
 * remote-signing bridge). Holds the SS58 address plus a `@polkadot/api`
 * `Signer` that performs the actual `signPayload`/`signRaw`.
 */
export interface InjectedAcurastSigner {
  address: string
  signer: PolkadotSigner
}

/**
 * Anything that can sign an Acurast extrinsic. Either a mnemonic-derived
 * `KeyringPair` (Node / CLI default) or an injected wallet signer (browser
 * extension in the Playground, or the CLI remote-signing bridge).
 */
export type AcurastSigner = KeyringPair | InjectedAcurastSigner

export const isInjectedSigner = (signer: AcurastSigner): signer is InjectedAcurastSigner =>
  'signer' in signer && (signer as InjectedAcurastSigner).signer !== undefined

/** SS58 address of the signer, regardless of which kind it is. */
export const getSignerAddress = (signer: AcurastSigner): string => signer.address

/**
 * Normalise an {@link AcurastSigner} into the `(account, options)` pair that
 * `@polkadot/api`'s `signAndSend` expects:
 *   - `KeyringPair`        → `(pair, {})`
 *   - injected wallet      → `(address, { signer })`
 *
 * A `KeyringPair` is already a valid `AddressOrPair`, so the mnemonic path is
 * unchanged from before this abstraction existed.
 */
export const resolveSigner = (
  signer: AcurastSigner,
): { account: AddressOrPair; options: Partial<SignerOptions> } => {
  if (isInjectedSigner(signer)) {
    return { account: signer.address, options: { signer: signer.signer } }
  }
  return { account: signer, options: {} }
}
