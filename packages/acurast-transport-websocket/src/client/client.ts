import { type Message } from '../message/messages'
import { Crypto } from '../crypto'
import { type WebSocketSession } from '../websocket'

import { type KeyPair, type MessageListener } from './types'
import {
  type ProcessorAction,
  type MessageProcessor,
  type NotifyProcessorAction,
  type SendProcessorAction,
  type ConnectedProcessorAction
} from './processor/message-processor'
import { V1MessageProcessor } from './processor/v1-message.processor'
import { Deferred } from '../utils/deferred'
import { log } from '../utils/log'
import { timeoutPromise } from '../utils/promise'
import { PayloadMessage } from '../index.browser'

export abstract class WebSocketTransportClient {
  private readonly version = 1 // Somehow get the highest supported version of the counterparty?
  private readonly isConnected: Deferred = new Deferred()

  private messageProcessors: Record<number, MessageProcessor> = {}
  private messageListeners: MessageListener[] = []
  private lastSelectedURL: string | undefined

  protected constructor(
    private readonly urls: string[],
    private readonly connectionTimeoutMillis: number,
    private readonly session: WebSocketSession,
    private readonly crypto: Crypto = new Crypto(),
    private readonly maxPayloadLogLength: number = 100,
    private readonly enableLogging: boolean = false
  ) {}

  private async tryConnectingToUrls(): Promise<void> {
    let lastError: Error | null = null

    // First, try to connect to lastSelectedURL if it's set
    if (this.lastSelectedURL) {
      try {
        await this.session.open(this.lastSelectedURL)
        this.log(`Connected to: ${this.lastSelectedURL}`)
        return // Exit the function if connection is successful
      } catch (error: any) {
        this.log(`Failed to connect to: ${this.lastSelectedURL}`)
        lastError = error
      }
    }

    const urls = this.urls.filter((url) => url !== this.lastSelectedURL)

    for (const url of urls) {
      try {
        this.lastSelectedURL = url
        await this.session.open(url)
        this.log(`Connected to ${url}`)
        return
      } catch (error: any) {
        this.log(`Failed to connect to ${url}`)
        lastError = error
      }
    }

    // If this point is reached, all connections have failed
    if (lastError) {
      throw new Error(`All connections failed: ${lastError.message}`)
    } else {
      throw new Error('No URL provided.')
    }
  }

  public async connect(keyPair: KeyPair): Promise<void> {
    await this.tryConnectingToUrls()

    this.log('Session opened')

    const normalizedKeyPair: KeyPair = {
      secretKey: keyPair.secretKey,
      publicKey: this.crypto.compressP256PublicKey(keyPair.publicKey)
    }

    const sender = this.crypto.senderId(normalizedKeyPair.publicKey)

    this.messageProcessors = {
      1: new V1MessageProcessor(sender, this.crypto)
    }

    this.session.onMessage(async (message: Message) => {
      this.log(
        'Got message',
        message.type !== 'payload'
          ? message
          : {
              ...message,
              payload: (message as PayloadMessage).payload.slice(0, this.maxPayloadLogLength)
            }
      )
      const processor: MessageProcessor | undefined = this.messageProcessors[message.version]
      if (processor === undefined) {
        return
      }

      const action: ProcessorAction | undefined = await processor.processMessage(
        message,
        normalizedKeyPair
      )
      await this.onAction(action)
    })

    this.session.onClose(() => {
      setTimeout(() => {
        this.connect(keyPair)
      }, 200)
    })

    const processor: MessageProcessor | undefined = this.messageProcessors[this.version]
    if (processor === undefined) {
      return
    }

    const action: ProcessorAction | undefined = await processor.init()
    await this.onAction(action)

    await timeoutPromise(this.connectionTimeoutMillis, this.isConnected.promise).catch(() => {
      throw new Error(`The connection with ${this.lastSelectedURL} could not be established.`)
    })

    this.log('Connected')
  }

  public async send(publicKeyOrSenderId: Uint8Array, payload: Uint8Array): Promise<void> {
    const processor: MessageProcessor | undefined = this.messageProcessors[this.version]
    if (processor === undefined) {
      return
    }

    const recipient: Uint8Array = this.crypto.senderId(publicKeyOrSenderId)
    const message: Message = await processor.prepareMessage(recipient, payload)

    await this.session.send(message)

    this.log(
      'Sent payload',
      'Sent',
      this.maxPayloadLogLength > 0 ? payload.slice(0, this.maxPayloadLogLength) : payload,
      'to',
      publicKeyOrSenderId
    )
  }

  public onMessage(listener: MessageListener): void {
    this.messageListeners.push(listener)
  }

  public async close(): Promise<void> {
    this.messageListeners = []
    await this.session.close()
  }

  public idFromPublicKey(publicKey: Uint8Array): Uint8Array {
    return this.crypto.senderId(publicKey)
  }

  private async onAction(action: ProcessorAction | undefined): Promise<void> {
    switch (action?.type) {
      case 'connected':
        this.onConnected(action)
        break
      case 'send':
        await this.onSend(action)
        break
      case 'notify':
        this.onNotify(action)
        break
    }
  }

  private onConnected(_action: ConnectedProcessorAction): void {
    this.isConnected.resolve()
  }

  private async onSend(action: SendProcessorAction): Promise<void> {
    await this.session.send(action.message)
  }

  private onNotify(action: NotifyProcessorAction): void {
    this.messageListeners.forEach((listener: MessageListener) => {
      void listener(action.message)
    })
  }

  private log(event: string, ...data: any[]): void {
    if (this.enableLogging) {
      log(`[ACURAST-TRANSPORT-WEBSOCKET:${this.lastSelectedURL}] ${event}`, ...data)
    } 
  }
}
