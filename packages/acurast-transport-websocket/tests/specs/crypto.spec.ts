import { expect } from 'chai'

import { Crypto } from '../../src/crypto'

describe('Crypto', function() {
  it('creates random bytes', function() {
    const size: number = 16

    const crypto = new Crypto()
    const a: Uint8Array = crypto.getRandomValues(size)
    const b: Uint8Array = crypto.getRandomValues(size)

    expect(a.length).eq(size)
    expect(b.length).eq(size)
    expect(Buffer.from(a).toString('hex')).not.eq(Buffer.from(b).toString('hex'))
  })

  it('creates SHA-256 hash', function() {
    const data: Buffer = Buffer.from('90cace2932470ec1af20c53ae24abfce', 'hex')

    const crypto = new Crypto()
    const hash: Uint8Array = crypto.sha256(data)

    expect(Buffer.from(hash).toString('hex')).eq(
      '1fe2cb1a03f0d66b31da77084822e5b3d9d7460c017a90d870ca5c5c30fa1783'
    )
  })

  it('compresses a P-256 public key', function () {
    const publicKey: Buffer = Buffer.from(
      '04155021b8a2c4ce508fc480cb2db723bed3c8619389ac4a3c5f7e1bcbbd55d30f2699c5ed9468fdcea93e437798052f008b9e71aa6990265c615db5df13bd1379',
      'hex'
    )

    const crypto = new Crypto()
    const compressedPublicKey: Uint8Array = crypto.compressP256PublicKey(publicKey)

    expect(Buffer.from(compressedPublicKey).toString('hex')).eq(
      '03155021b8a2c4ce508fc480cb2db723bed3c8619389ac4a3c5f7e1bcbbd55d30f'
    )
  })

  it('creates a P-256 signature', function() {
    const data: Buffer = Buffer.from(
      'bb67a3ba9ac64fb89ab480f634755f0d92c263f980b8705dbb24b3010a3b1e69',
      'hex'
    )
    const secretKey: Buffer = Buffer.from(
      '4372f787773fb0669c4ba453768573c61e20ad09616043df3cf16ab7e6bfb94b',
      'hex'
    )

    const crypto = new Crypto()
    const signature: Uint8Array = crypto.signP256(data, secretKey)

    expect(Buffer.from(signature).toString('hex')).to.eq('e0fdb186b140de795f73c30ed8c269a2a71ba4c062502c8befe85d38044fd9ec4a3246b6ba7fb06045a2d121e4f6c8e2aa90be01b5a96502e8e53407bbb13bc2')
  })
})
