# Acurast TypeScript SDK

A TypeScript library to interact with the Acurast network.

## Packages

| Name                             | Description                                              |
| -------------------------------- | -------------------------------------------------------- |
| [@acurast/dapp]()                | Tools useful in dApp development                         |
| [@acurast/transport-websocket]() | An implementation of the Acurast P2P WebSocket Transport |

## Usage

### Send messages to Acurast Processor

```bash
$ npm install @acurast/dapp 
```

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

### Other

Navigate to a specific package, or see [`examples`]() for detailed instructions on how to use the library.