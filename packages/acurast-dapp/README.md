# Acurast DApp

[![npm](https://img.shields.io/npm/v/@acurast/dapp.svg?colorB=brightgreen)](https://www.npmjs.com/package/@acurast/dapp)

Tools useful in dApp development.

## Installation

```bash
$ npm install @acurast/dapp
```

## Documentation

### `AcurastClient`

A client that can communicate with the Acurast P2P network.

To create a new instance call it constuctor and provide an Acurast P2P WebSocket server `url` and an optional `connectionTimeoutMillis`.

The connection timeout is the number of milliseconds to wait for an initial response from the server. If the server does not respond within the specified time, an error is thrown. If this parameter is omitted, the default value of 15 seconds is used.

```typescript
constructor(url: string, connectionTimeoutMillis?: number /* default: 15s */)
```

#### `start`

Opens a connection between the client and the server using the dApp's P256 `keyPair`.

```typescript
/*
interface KeyPair {
  publicKey: string | Uint8Array
  secretKey: string | Uint8Array
}
*/

start(keyPair: KeyPair): Promise<void>
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

If `payload` is not a valid raw bytes value (`Uint8Array` or a hex string), it will be encoded to UTF-8 bytes before sending.

```typescript
send(publicKey: string | Uint8Array, payload: string | Uint8Array): Promise<void>
```

#### `close`

Terminates the ongoing connection.

```typescript
close(): Promise<void>
```

#### Usage

##### Send messages to Acurast Processor

```typescript
import { AcurastClient, Message } from '@acurast/dapp'

const acurastClient = new AcurastClient('wss://example.com' /* Acurast P2P WebSocket Server */)

await acurastClient.start({
    secretKey: 'f816e59353c58627039fbf5e96747a871244194b9db12095189554e78a6d4a45',
    publicKey: '04ae00462e82af267b42b477493450b04b8ed05e510eca2a40c6f7679b14e364b9d6f9c867a7e72b4880f9632450e5c2c03bd69424f786e10bb77e9bd09e322ef3'
} /* P256 key pair */)

acurastClient.onMessage(async (message: Message) => {
    console.log('Received Message', message)
    await acurastClient.close()
})

await acurastClient.send(
    '028aad55a45e1eba230e38243ee9221d765cdb59fde684bad516bffcc9970f3c15' /* processor's public key */,
    'my message'
)
```

### Example

See the [example dApp](../../examples/dapp/).