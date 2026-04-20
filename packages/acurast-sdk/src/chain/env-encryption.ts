import pkg from 'elliptic'
const { ec } = pkg

import * as crypto from 'crypto'

import { getProcessorEncryptionKey } from './env-utils.js'
import type {
  EncKeyCurve,
  EncryptedValue,
  EnvVar,
  EnvVarEncrypted,
  JobAssignmentInfo,
  JobEnvironmentEncrypted,
  JobEnvironmentsEncrypted,
} from '../types/env.js'
import { AcurastService } from './acurast-service.js'
import type { KeyringPair } from '@polkadot/keyring/types'
import type { KeyStore } from './key-store.js'
import { InMemoryKeyStore } from './key-store.js'

export class JobEnvironmentService {
  private readonly acurastService: AcurastService
  private readonly keyStore: KeyStore

  constructor(options: { acurastService: AcurastService; keyStore?: KeyStore }) {
    this.acurastService = options.acurastService
    this.keyStore = options.keyStore ?? new InMemoryKeyStore()
  }

  private keyStorageId(type: 'publicKey' | 'privateKey', curve: EncKeyCurve): string {
    return curve === 'p256' && this.keyStore.getItem(type)
      ? type // backwards compatiblity
      : `${type}_${curve}`
  }

  public getPublicKey(curve: EncKeyCurve): string | undefined {
    return this.keyStore.getItem(this.keyStorageId('publicKey', curve)) ?? undefined
  }

  public setPublicKey(key: string, curve: EncKeyCurve) {
    this.keyStore.setItem(this.keyStorageId('publicKey', curve), key)
  }

  public getPrivateKey(curve: EncKeyCurve): string | undefined {
    return this.keyStore.getItem(this.keyStorageId('privateKey', curve)) ?? undefined
  }

  public setPrivateKey(key: string, curve: EncKeyCurve) {
    this.keyStore.setItem(this.keyStorageId('privateKey', curve), key)
  }

  public async generateSharedSecret(
    processorPublicKeyHex: string,
    curve: EncKeyCurve,
  ): Promise<string> {
    const EC = new ec(curve)

    let keyPair
    const storedPrivateKeyHex = this.getPrivateKey(curve)
    if (storedPrivateKeyHex) {
      keyPair = EC.keyFromPrivate(storedPrivateKeyHex, 'hex')
    } else {
      keyPair = EC.genKeyPair()
      this.setPrivateKey(keyPair.getPrivate('hex'), curve)
      this.setPublicKey(keyPair.getPublic(true, 'hex'), curve)
    }

    const processorKey = EC.keyFromPublic(processorPublicKeyHex, 'hex')
    const sharedSecret = keyPair.derive(processorKey.getPublic())
    return Buffer.from(sharedSecret.toArray()).toString('hex')
  }

  public async generateSharedKey(processorPublicKeyHex: string, curve: EncKeyCurve) {
    const sharedSecret = Buffer.from(
      await this.generateSharedSecret(processorPublicKeyHex, curve),
      'hex',
    )
    const sharedSecretSalt = Buffer.alloc(16)

    const EC = new ec(curve)

    let keyPair
    const storedPrivateKeyHex = this.getPrivateKey(curve)
    if (storedPrivateKeyHex) {
      keyPair = EC.keyFromPrivate(storedPrivateKeyHex, 'hex')
    } else {
      keyPair = EC.genKeyPair()
      this.setPrivateKey(keyPair.getPrivate('hex'), curve)
      this.setPublicKey(keyPair.getPublic(true, 'hex'), curve)
    }

    const publicKey = Buffer.from(keyPair.getPublic(true, 'hex'), 'hex')
    const processorPublicKey = Buffer.from(processorPublicKeyHex, 'hex')

    const publicKeys = [publicKey, processorPublicKey].sort((a, b) => {
      if (a.length !== b.length) {
        return a.length - b.length
      } else {
        for (let i = 0; i < a.length; i++) {
          if (a[i] !== b[i]) {
            return a[i] - b[i]
          }
        }
        return 0
      }
    })

    const sharedCurveName =
      curve === 'p256' ? 'secp256r1' : curve === 'secp256k1' ? 'secp256k1' : ''

    const info = Buffer.concat([
      Buffer.from(`ECDH ${sharedCurveName} AES-256-GCM-SIV`, 'utf-8'),
      ...publicKeys,
    ])

    const derivedKey = await this.hkdf(sharedSecret, sharedSecretSalt, info, 32)
    return Buffer.from(derivedKey)
  }

  public async hkdf(
    keyMaterial: Buffer,
    salt: Uint8Array,
    info: Uint8Array,
    length: number,
  ): Promise<ArrayBuffer> {
    const key = await crypto.subtle.importKey('raw', keyMaterial, { name: 'HKDF' }, false, [
      'deriveBits',
    ])
    return await crypto.subtle.deriveBits(
      { name: 'HKDF', salt, info, hash: 'SHA-256' },
      key,
      length * 8,
    )
  }

  public encrypt(data: string, key: Buffer): EncryptedValue {
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

    let encrypted = cipher.update(data, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    return {
      ciphertext: encrypted,
      iv: iv.toString('hex'),
      authTag: cipher.getAuthTag().toString('hex'),
    }
  }

  public processEncryptedHex(hex: string): EncryptedValue {
    hex = hex.replace('0x', '')
    const iv: string = hex.substring(0, 24)
    const ciphertext: string = hex.substring(24, hex.length - 32)
    const authTag: string = hex.substring(hex.length - 32)
    return { ciphertext, iv, authTag }
  }

  public decrypt(data: EncryptedValue, key: Buffer): string {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(data.iv, 'hex'))
    decipher.setAuthTag(Buffer.from(data.authTag, 'hex'))

    let decrypted = decipher.update(data.ciphertext, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  }

  public async setEnvironmentVariables(
    keyring: KeyringPair,
    assignment: JobAssignmentInfo,
    jobId: number,
    jobEnvironmentVariables: EnvVar[],
  ) {
    const processorEncryptionKey = getProcessorEncryptionKey(assignment)
    if (processorEncryptionKey !== undefined) {
      const sharedKey = await this.generateSharedKey(
        processorEncryptionKey.publicKey,
        processorEncryptionKey.curve,
      )

      const encryptedEnvironment: EnvVarEncrypted[] = jobEnvironmentVariables.map(
        (envVar: EnvVar) => ({
          key: envVar.key,
          encryptedValue: this.encrypt(envVar.value, sharedKey),
        }),
      )

      const publicKey = this.getPublicKey(processorEncryptionKey.curve)
      if (publicKey !== undefined) {
        const jobEnvironment: JobEnvironmentEncrypted = {
          publicKey,
          variables: encryptedEnvironment,
        }
        return this.setEnvironment(keyring, jobId, jobEnvironment)
      }
      return undefined
    }
    return undefined
  }

  private async setEnvironment(
    keyring: KeyringPair,
    jobId: number,
    jobEnvironment: JobEnvironmentEncrypted,
  ): Promise<{ hash: string }> {
    const hash = await this.acurastService.setEnvironment(keyring, jobId, jobEnvironment)
    return { hash: hash.toString() }
  }

  public async setEnvironmentVariablesMulti(
    keyring: KeyringPair,
    assignments: JobAssignmentInfo[],
    jobId: number,
    jobEnvironmentVariables: EnvVar[],
  ) {
    const jobEnvironments: JobEnvironmentsEncrypted = []

    for (const assignment of assignments) {
      const processorEncryptionKey = getProcessorEncryptionKey(assignment)

      if (processorEncryptionKey !== undefined) {
        const sharedKey = await this.generateSharedKey(
          processorEncryptionKey.publicKey,
          processorEncryptionKey.curve,
        )

        const encryptedEnvironment: EnvVarEncrypted[] = jobEnvironmentVariables.map(
          (envVar: EnvVar) => ({
            key: envVar.key,
            encryptedValue: this.encrypt(envVar.value, sharedKey),
          }),
        )

        const publicKey = this.getPublicKey(processorEncryptionKey.curve)
        if (publicKey !== undefined) {
          const jobEnvironment: JobEnvironmentEncrypted = {
            publicKey,
            variables: encryptedEnvironment,
          }

          jobEnvironments.push({
            processor: assignment.processor,
            jobEnvironment,
          })
        }
      }
    }

    return this.setEnvironments(keyring, jobId, jobEnvironments)
  }

  private async setEnvironments(
    keyring: KeyringPair,
    jobId: number,
    jobEnvironments: JobEnvironmentsEncrypted,
  ): Promise<{ hash: string }> {
    const hash = await this.acurastService.setEnvironments(keyring, jobId, jobEnvironments)
    return { hash: hash.toString() }
  }
}
