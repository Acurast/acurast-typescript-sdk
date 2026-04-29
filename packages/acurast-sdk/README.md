# Acurast SDK

[![npm](https://img.shields.io/npm/v/@acurast/sdk.svg?colorB=brightgreen)](https://www.npmjs.com/package/@acurast/sdk)

Programmatic SDK for interacting with the Acurast Cloud.

`@acurast/sdk` is the main entry point for developers who want to deploy and manage deployments on Acurast from TypeScript/JavaScript. It bundles everything needed to upload a project to IPFS, register a job on-chain, match it with processors, and manage deployments.

## Installation

```bash
$ npm install @acurast/sdk
```

The SDK relies on `@polkadot/*` packages as peer dependencies:

```bash
$ npm install @polkadot/api @polkadot/api-augment @polkadot/keyring \
              @polkadot/types @polkadot/types-codec @polkadot/util \
              @polkadot/util-crypto @polkadot/wasm-crypto
```

## Modules

The SDK is split into subpath exports so you can import only the parts you need.

### `@acurast/sdk/deploy`

High-level deployment utilities. Zip a local project, upload it to IPFS, and register the job on the Acurast chain in a single call.

```typescript
import { deployProject, loadAcurastConfig } from '@acurast/sdk/deploy'

const config = await loadAcurastConfig('./acurast.json')
await deployProject({ config /* ... */ })
```

Also exports `zipFolder`, `createManifest`, `checkIsFolder`, and a `Logger` interface with a `NOOP_LOGGER` default.

### `@acurast/sdk/chain`

Direct access to the Acurast chain: wallets, balances, job registration, assignments, environment variables, and app versions.

```typescript
import {
  walletFromMnemonic,
  getBalance,
  registerJob,
  jobAssignments,
  AcurastService,
  setEnvVars
} from '@acurast/sdk/chain'
```

Helpers include `convertConfigToJob`, duration constants (`second`, `minute`, `hour`, `day`), sensible defaults (`DEFAULT_REWARD`, `DEFAULT_REPLICAS`, ...), the `JobEnvironmentService` for encrypted env vars, and an `InMemoryKeyStore`.

### `@acurast/sdk/ipfs`

Upload deployment scripts to IPFS.

```typescript
import { uploadScript } from '@acurast/sdk/ipfs'

const cid = await uploadScript({
  /* IpfsUploadOptions */
})
```

### `@acurast/sdk/matcher`

Pricing and matching helpers for jobs: check whether a job has matching processors, analyze fees, and get pricing advice.

```typescript
import {
  checkMatch,
  checkMatchWithReward,
  getAveragePrice,
  getPriceDistribution,
  getProcessorCount,
  suggestCostPerExecution,
  getFeeAnalysis,
  analyzePricing,
  fetchPricingAdvice
} from '@acurast/sdk/matcher'
```

### `@acurast/sdk/types`

Shared TypeScript types used across the SDK.

## Runtimes

Set `runtime` on `AcurastProjectConfig` to pick the execution environment:

- `DeploymentRuntime.NodeJSWithBundle` (default) — Node.js, bundled file deployment.
- `DeploymentRuntime.NodeJS` — Node.js, single-file deployment.
- `DeploymentRuntime.Shell` — native binary inside a Linux distro image (PRoot-isolated). Requires `image: { url, sha256 }` on the config; the SDK auto-adds `RequiredModules.Shell` to `requiredModules` and embeds the image reference in `manifest.json`.

```ts
import { DeploymentRuntime } from '@acurast/sdk/types'

const config = {
  runtime: DeploymentRuntime.Shell,
  entrypoint: 'acurast.sh',
  image: {
    url: 'https://github.com/termux/proot-distro/releases/download/v4.30.1/ubuntu-questing-aarch64-pd-v4.30.1.tar.xz',
    sha256: '5ab35b90cd9a9f180656261ba400a135c4c01c2da4b74522118342f985c2d328',
  },
  // ...
}
```

## Examples

See the [`examples/`](../../examples/) folder for end-to-end usage.
