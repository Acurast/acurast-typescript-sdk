import { Keyring } from '@polkadot/keyring'
import { cryptoWaitReady } from '@polkadot/util-crypto'
import type { Signer as PolkadotSigner } from '@polkadot/api/types'
import {
  isInjectedSigner,
  getSignerAddress,
  resolveSigner,
  type InjectedAcurastSigner,
} from '../src/chain/signer.js'

const fakeSigner = {
  signPayload: async () => ({ id: 1, signature: '0x00' as const }),
} as unknown as PolkadotSigner

describe('AcurastSigner', () => {
  let pair: ReturnType<Keyring['addFromUri']>

  beforeAll(async () => {
    await cryptoWaitReady()
    pair = new Keyring({ type: 'sr25519' }).addFromUri('//Alice')
  })

  describe('isInjectedSigner', () => {
    test('true for an injected wallet signer', () => {
      const injected: InjectedAcurastSigner = { address: pair.address, signer: fakeSigner }
      expect(isInjectedSigner(injected)).toBe(true)
    })

    test('false for a KeyringPair (no signer property)', () => {
      expect(isInjectedSigner(pair)).toBe(false)
    })
  })

  describe('getSignerAddress', () => {
    test('returns the address for both kinds', () => {
      expect(getSignerAddress(pair)).toBe(pair.address)
      expect(getSignerAddress({ address: pair.address, signer: fakeSigner })).toBe(pair.address)
    })
  })

  describe('resolveSigner', () => {
    test('KeyringPair → (pair, {})', () => {
      const { account, options } = resolveSigner(pair)
      expect(account).toBe(pair)
      expect(options).toEqual({})
    })

    test('injected → (address, { signer })', () => {
      const injected: InjectedAcurastSigner = { address: pair.address, signer: fakeSigner }
      const { account, options } = resolveSigner(injected)
      expect(account).toBe(pair.address)
      expect(options.signer).toBe(fakeSigner)
    })
  })
})
