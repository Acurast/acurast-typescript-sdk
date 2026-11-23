import { JobEnvironmentService } from '../src/chain/env-encryption.js'
import { InMemoryKeyStore } from '../src/chain/key-store.js'
import type { EncKeyCurve } from '../src/types/env.js'

// Generated with the elliptic-based implementation (SDK 1.6.0). Processors decrypt with
// keys derived this way, so the output must stay byte-identical. Note: the shared secret
// is the ECDH x-coordinate WITHOUT leading zero bytes (bn.js toArray()), see the
// "leading zero" cases.
const FIXTURES: {
  curve: EncKeyCurve
  case: string
  privateKeyHex: string
  ownPublicKeyHex: string
  processorPublicKeyHex: string
  sharedSecretHex: string
  sharedKeyHex: string
}[] = [
  {
    curve: 'p256',
    case: 'plain',
    privateKeyHex: 'c3ac1a127c2f711684401995f43fb4889a222215d5e197d6bcd369b3271a1628',
    ownPublicKeyHex: '02e4b4ca5c732802d88770992c2c07d4ce129d8d020491769d6d80ef7886958858',
    processorPublicKeyHex: '037b3b19e57eab914dc3c637cadfc4bd69457280718afced1a7f45712f244a8c08',
    sharedSecretHex: 'bc904be0f0f04db283973f627bbdd074c74e4e0fd04aaf59be2d293323c03cfd',
    sharedKeyHex: 'd04dc0ac07cf9d83f3f325408e5488bfdc7e601649c52f79e8912c77c5802627',
  },
  {
    curve: 'p256',
    case: 'shared x has leading zero byte',
    privateKeyHex: '078477aaea1d33a475a5e5cdfd2b9f66e1a9340d6e2a2171864ffafd1add8152',
    ownPublicKeyHex: '02808e9c81127d8f9eca48c15a5e859a0920a8c0e2de02fec834a5b946a2f583d9',
    processorPublicKeyHex: '03b367cefff5867852d87d695d738cb8e808b85914e52dcc8e931842ca36b73935',
    sharedSecretHex: 'a57a9341ae54655f0eb4ccced8aaf7a2f1e9f4c4251810cd7e9888c41be384',
    sharedKeyHex: 'fbd6431c21312ce1c438e8f4bfaa96e01594c6d88909804c65dc710f3c85c922',
  },
  {
    curve: 'p256',
    case: 'stored private key hex shorter than 64 chars',
    privateKeyHex: '370aed07ad76624c78c62e033b4424cab9c1d5756796bcf15f15a24fb5574d',
    ownPublicKeyHex: '03dc30489a14fea4519838aa411cc7fd3d14454cf0ca4422d3d80c4369f53aecb0',
    processorPublicKeyHex: '02f29f9b9248fd991050957ec701d6b4792b7d88ad505592ba53e655519c58b38e',
    sharedSecretHex: '9df842f6dc98f46cf773cde2efc7d963abcd6ae9344f8ead62d2b23b52a829fe',
    sharedKeyHex: '650dadb476c9755d0f78739ef266c0df71ed01aff0c6f9d6e01d0211b2ed9147',
  },
  {
    curve: 'secp256k1',
    case: 'plain',
    privateKeyHex: '5da2a85dfe0a306af96a7b5b4f7ff772befda01f6b2b095e718cb55c81a7fd31',
    ownPublicKeyHex: '02fca4784276d53cb72b8e6ae87081a59418bcf580a33f44daf2fba98ab698c056',
    processorPublicKeyHex: '0314c6752590fb2cc99700b72e8e9ebd5ee7ad6d43e2f146cc56bb5b32aae6017b',
    sharedSecretHex: 'bf9c66f203a8b1dfc1b137956c0e637c535745235689c4f2d75a797e6fb3c93d',
    sharedKeyHex: '27578a8c66de8725f4c11d3e2f366cbf80d1305fb0c037e35455719dfc176ec7',
  },
  {
    curve: 'secp256k1',
    case: 'shared x has leading zero byte',
    privateKeyHex: '08e21007ad2d0ef86fed2c8a07d995f511660cf14400a67be188fea95b9ed8d7',
    ownPublicKeyHex: '03537485909dbb919f196d49144252c7d99f37c6e87282da7f9c74d6a423164115',
    processorPublicKeyHex: '024bb498b3468385900b0c4ff04fb04426d65ebe3a3a6b1d503e6486d62c660b97',
    sharedSecretHex: '5fa5d0b656eca77363cdc6ff4b7f84391308ae76bc8927c7903a1e094abfce',
    sharedKeyHex: 'c14cf64492116d77ec07c6cf643a71baa0e59e45d23099f1cda98a29bbca4d7d',
  },
  {
    curve: 'secp256k1',
    case: 'stored private key hex shorter than 64 chars',
    privateKeyHex: '8617d3c7b34868119e6abe44b54fd4c3ebf8b1e36ed73b04e114f2bc813c72',
    ownPublicKeyHex: '0349dd04fa07d20255227fae95654dd2c84ff35b81fba19bef5b74b9306fe04ff8',
    processorPublicKeyHex: '0201659004c0e4aa90bb87c862ad5c77bc49a422245e540a8ca55cea33a30dc244',
    sharedSecretHex: '303e3e6307f800aaffa45cfddd6506df2c4375a32b6c6f2389cd8be4f1119ac6',
    sharedKeyHex: 'a9bb25eb4dfbcaa3c14e22f7d732f4d6f27a86e53a77a5029997395477c1cea4',
  },
]

describe('JobEnvironmentService key agreement', () => {
  it.each(FIXTURES.map((f) => [`${f.curve}: ${f.case}`, f] as const))('%s', async (_, f) => {
    const svc = new JobEnvironmentService({
      acurastService: {} as any,
      keyStore: new InMemoryKeyStore(),
    })
    svc.setPrivateKey(f.privateKeyHex, f.curve)

    expect(await svc.generateSharedSecret(f.processorPublicKeyHex, f.curve)).toEqual(
      f.sharedSecretHex,
    )
    expect(
      Buffer.from(await svc.generateSharedKey(f.processorPublicKeyHex, f.curve)).toString('hex'),
    ).toEqual(f.sharedKeyHex)
  })

  it.each(['p256', 'secp256k1'] as const)(
    'creates and stores a key pair on first use (%s)',
    async (curve) => {
      const svc = new JobEnvironmentService({
        acurastService: {} as any,
        keyStore: new InMemoryKeyStore(),
      })
      const other = FIXTURES.find((f) => f.curve === curve)!

      await svc.generateSharedSecret(other.ownPublicKeyHex, curve)
      const privateKeyHex = svc.getPrivateKey(curve)!
      const publicKeyHex = svc.getPublicKey(curve)!
      expect(publicKeyHex).toMatch(/^0[23][0-9a-f]{64}$/)

      // the stored pair is consistent: the counterparty derives the same secret
      const peer = new JobEnvironmentService({
        acurastService: {} as any,
        keyStore: new InMemoryKeyStore(),
      })
      peer.setPrivateKey(other.privateKeyHex, curve)
      const fresh = new JobEnvironmentService({
        acurastService: {} as any,
        keyStore: new InMemoryKeyStore(),
      })
      fresh.setPrivateKey(privateKeyHex, curve)
      expect(await fresh.generateSharedSecret(other.ownPublicKeyHex, curve)).toEqual(
        await peer.generateSharedSecret(publicKeyHex, curve),
      )
    },
  )
})
