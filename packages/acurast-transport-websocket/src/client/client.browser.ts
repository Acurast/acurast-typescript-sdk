import { WebSocketSession } from '../websocket'

import { WebSocketTransportClient } from './client'

class BrowserWebSocketSession extends WebSocketSession {
  private _ws: WebSocket | undefined
  private get ws(): WebSocket {
    if (this._ws === undefined) {
      throw new Error('WebSocket implementation not found')
    }

    return this._ws
  }

  public override async open(url: string): Promise<void> {
    this._ws = new WebSocket(url)
    this.ws.binaryType = 'arraybuffer'

    await new Promise<void>((resolve, reject) => {
      const onError = (event: Event): void => {
        this.ws.onerror = null
        this.ws.onopen = null
        reject(event)
      }

      const onOpen = (): void => {
        this.ws.onerror = null
        this.ws.onopen = null
        resolve()
      }

      this.ws.onopen = onOpen
      this.ws.onerror = onError
    })
  }

  public override async close(): Promise<void> {
    this.ws.onclose = null
    this._ws?.close()
  }

  protected override onRawMessage(listener: (data: Uint8Array) => void | Promise<void>): void {
    this.ws.addEventListener('message', (event: MessageEvent) => {
      void listener(Buffer.from(event.data))
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

export class BrowserWebSocketTransportClient extends WebSocketTransportClient {
  public constructor(
    urls: string[],
    connectionTimeoutMillis: number,
    maxPayloadLogLength: number = 100,
    enableLogging: boolean = false
  ) {
    super(
      urls,
      connectionTimeoutMillis,
      new BrowserWebSocketSession(),
      undefined,
      maxPayloadLogLength,
      enableLogging
    )
  }
}
