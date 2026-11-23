import { p256 } from '@noble/curves/p256'
import { sha256 } from '@noble/hashes/sha2'
import { randomBytes } from '@noble/hashes/utils'

export class Crypto {
  public getRandomValues(size: number): Uint8Array {
    return randomBytes(size)
  }

  public sha256(data: Uint8Array): Uint8Array {
    return sha256(data)
  }

  public compressP256PublicKey(publicKey: Uint8Array): Uint8Array {
    return Buffer.from(p256.ProjectivePoint.fromHex(publicKey).toRawBytes(true))
  }

  public signP256(data: Uint8Array, secretKey: Uint8Array): Uint8Array {
    // Same as elliptic before: `data` is signed as given (no prehash) and high-S is kept.
    return Buffer.from(
      p256.sign(data, secretKey, { prehash: false, lowS: false }).toCompactRawBytes(),
    )
  }

  public senderId(publicKeyOrSenderId: Uint8Array): Uint8Array {
    if (publicKeyOrSenderId.length === 16) {
      return publicKeyOrSenderId
    }
    const pkh = this.sha256(publicKeyOrSenderId)
    return pkh.slice(0, 16)
  }
}
