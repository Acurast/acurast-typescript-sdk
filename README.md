# Acurast TypeScript SDK

A TypeScript library to interact with the Acurast network.

## Packages

| Name                                                                   | Description                                                       |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [@acurast/sdk](./packages/acurast-sdk/)                                 | Programmatic SDK for interacting with the Acurast Cloud           |
| [@acurast/cli](https://github.com/Acurast/acurast-cli)                  | Command-line interface for deploying and managing Acurast jobs    |
| [@acurast/dapp](./packages/acurast-dapp/)                               | ⚠️ Deprecated — tools useful in dApp development                  |
| [@acurast/transport-websocket](./packages/acurast-transport-websocket/) | ⚠️ Deprecated — implementation of the Acurast P2P WebSocket Transport |

This repo also contains [`@acurast/devtools`](./packages/acurast-devtools/), an internal package used by the CLI. It is not intended for direct consumption.

## Usage

### Deploy a project to the Acurast Cloud

```bash
$ npm install @acurast/sdk
```

```typescript
import { deployProject, loadAcurastConfig } from '@acurast/sdk/deploy'

const config = await loadAcurastConfig('./acurast.json')
await deployProject({ config /* ... */ })
```

See [`@acurast/sdk`](./packages/acurast-sdk/) for the full set of modules (`/deploy`, `/chain`, `/ipfs`, `/matcher`, `/types`).

### Other

Navigate to a specific package, or see [`examples`](./examples/) for detailed instructions on how to use the library.
