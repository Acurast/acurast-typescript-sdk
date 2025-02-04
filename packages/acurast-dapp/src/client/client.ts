import { WebSocketTransportClient } from '@acurast/transport-websocket'

import { type KeyPair } from '../types/key-pair'
import { type Message } from '../types/message'
import { uint8ArrayFrom } from '../utils/bytes'

const CONNECTION_TIMEOUT_MS = 15 * 1000 // 15s

type MessageListener = (message: Message) => void | Promise<void>

export class AcurastClient {
  private _transport: WebSocketTransportClient | undefined
  private get transport(): WebSocketTransportClient {
    if (this._transport === undefined) {
      throw new Error('AcurastClient has not started yet')
    }

    return this._transport
  }

  private messageListenerBuffer: MessageListener[] = []

  public constructor(private readonly urls: string[], private readonly connectionTimeoutMillis: number = CONNECTION_TIMEOUT_MS, private readonly maxPayloadLogLength: number = 100, private readonly enableLogging: boolean = false) {}

  public async start(keyPair: KeyPair): Promise<void> {
    if (this._transport !== undefined) {
      return
    }

    const transport = new WebSocketTransportClient(this.urls, this.connectionTimeoutMillis, this.maxPayloadLogLength, this.enableLogging)
    
    this.messageListenerBuffer.forEach((listener: MessageListener) => {
      transport.onMessage(listener)
    })
    this.messageListenerBuffer = []

    await transport.connect({
      secretKey: uint8ArrayFrom(keyPair.secretKey),
      publicKey: uint8ArrayFrom(keyPair.publicKey)
    })
    
    this._transport = transport
  }

  public onMessage(listener: MessageListener): void {
    if (this._transport === undefined) {
      this.messageListenerBuffer.push(listener)
    } else {
      this._transport.onMessage(listener)
    }
  }

  public async send(publicKeyOrSenderId: string | Uint8Array, payload: string | Uint8Array): Promise<void> {
    await this.transport.send(uint8ArrayFrom(publicKeyOrSenderId), uint8ArrayFrom(payload))
  }

  public async close(): Promise<void> {
    await this._transport?.close()
    this._transport = undefined
  }

  public idFromPublicKey(publicKey: string | Uint8Array): string {
    const id = this.transport.idFromPublicKey(uint8ArrayFrom(publicKey))
    return Buffer.from(id).toString('hex')
  }
}