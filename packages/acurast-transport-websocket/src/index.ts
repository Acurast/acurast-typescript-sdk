import { type WebSocketTransportClient as AbstractWebSocketTransportClient } from './client/client'

export declare class WebSocketTransportClient extends AbstractWebSocketTransportClient {
  public constructor(urls: string[], connectionTimeoutMillis: number, maxPayloadLogLength?: number)
}

export { type Message } from './message/messages'
export {
  type InitMessage,
  type ChallengeMessage,
  type ResponseMessage,
  type AcceptedMessage,
  type PayloadMessage,
  type Permissions,
  createInitMessage,
  createChallengeMessage,
  createResponseMessage,
  createAcceptedMessage,
  createPayloadMessage
} from './message/v1-messages'
export { parseMessage } from './message/parser/parser'
export { forgeMessage } from './message/forger/forger'

export { log } from './utils/log'
export { verifyDifficulty } from './utils/proof-of-work'
