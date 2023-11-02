# Acurast Transport Websocket

[![npm](https://img.shields.io/npm/v/@acurast/transport-websocket.svg?colorB=brightgreen)](https://www.npmjs.com/package/@acurast/transport-websocket)

An implementation of the Acurast P2P WebSocket Transport.

## Installation

```bash
$ npm install @acurast/transport-websocket
```

## Documentation

### `WebSocketTransportClient`

A client that can communicate with the Acurast P2P network using WebSocket.

To create a new instance call it constuctor and provide an Acurast P2P WebSocket server `url` and an optional `connectionTimeoutMillis`.

The connection timeout is the number of milliseconds to wait for an initial response from the server. If the server does not respond within the specified time, an error is thrown.

```typescript
constructor(url: string, connectionTimeoutMillis: number)
```

#### `connect`

Opens a connection between the client and the server using the calling peer's P256 `keyPair`.

```typescript
/*
interface KeyPair {
  publicKey: Uint8Array
  secretKey: Uint8Array
}
*/

connect(keyPair: KeyPair): Promise<void>
```

#### `onMessage`

Registers a new `listener` which will be notified on incoming `message`.

```typescript
/*
interface Message {
  sender: Uint8Array
  recipient: Uint8Array
  payload: Uint8Array
}
*/

onMessage(listener: (message: Message) => void | Promise<void>): void
```

#### `send`

Sends a new message with the `payload` to a peer that identifies with the `publicKey`.

```typescript
send(publicKey: Uint8Array, payload: Uint8Array): Promise<void>
```

#### `close`

Terminates the ongoing connection.

```typescript
close(): Promise<void>
```
