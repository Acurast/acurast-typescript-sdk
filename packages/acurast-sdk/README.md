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

## Examples

See the [`examples/`](../../examples/) folder for end-to-end usage.
