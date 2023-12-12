import _WebSocket from 'ws'

import { WebSocketSession } from '../websocket'

import { WebSocketTransportClient } from './client'

class NodeWebSocketSession extends WebSocketSession {
  private _ws: _WebSocket | undefined
  private get ws(): _WebSocket {
    if (this._ws === undefined) {
      throw new Error('WebSocket implementation not found')
    }

    return this._ws
  }

  public override async open(url: string): Promise<void> {
    this._ws = new _WebSocket(url)
    this.ws.binaryType = 'nodebuffer'

    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error): void => {
        this.ws.removeAllListeners('open')
        reject(error)
      }

      const onOpen = (): void => {
        this.ws.removeAllListeners('open')
        this.ws.removeListener('error', onError)
        resolve()
      }

      this.ws.on('open', onOpen)
      this.ws.on('error', onError)
    })
  }

  public override async close(): Promise<void> {
    this.ws.onclose = null
    this._ws?.close()
  }

  protected override onRawMessage(listener: (data: Uint8Array) => void | Promise<void>): void {
    this.ws.on('message', (data: _WebSocket.RawData) => {
      const bytes: Buffer | undefined = Buffer.isBuffer(data)
        ? data
        : data instanceof ArrayBuffer
        ? Buffer.from(data)
        : undefined

      if (bytes !== undefined) {
        void listener(bytes)
      }
    })
  }

  protected override async sendRaw(data: Uint8Array): Promise<void> {
    this.ws.send(data)
  }

  override onClose(listener: Function): void {
    this.ws.onclose = () => {
      this.ws.onopen = null
      this.ws.onerror = null
      listener()
    }
  }
}

export class NodeWebSocketTransportClient extends WebSocketTransportClient {
  public constructor(
    urls: string[],
    connectionTimeoutMillis: number,
    maxPayloadLogLength: number = 100
  ) {
    super(urls, connectionTimeoutMillis, new NodeWebSocketSession(), undefined, maxPayloadLogLength)
  }
}
