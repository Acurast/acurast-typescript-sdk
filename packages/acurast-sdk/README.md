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

#### What goes into the bundle

When `fileUrl` is a folder, it is zipped and pinned **publicly** on IPFS, and the CID is written on chain. Anything in the bundle can be read by anyone and cannot be withdrawn. To avoid leaking secrets, files and folders whose name starts with `.` (`.env`, `.git/`, `.npmrc`, `.acurast/`, ...) are left out by default, at any depth. A warning lists what was excluded, and the bundled files are logged at debug level.

Use the `bundle` option of `deployProject` (or the last argument of `zipFolder`) to change this:

```typescript
await deployProject(config, job, {
  // ...
  bundle: {
    includeDotfiles: true, // opt back in to dotfiles (default: false)
    exclude: (relPath) => relPath === 'node_modules' || relPath.endsWith('.map'),
  },
})
```

`exclude` is called with paths relative to the folder, using `/` and no trailing slash, for every file and folder and for each parent folder, so excluding a folder excludes everything in it. `node_modules` is bundled by default because the unbundled NodeJS and Shell runtimes may need it; exclude it there if your entrypoint is self-contained. Pointing `fileUrl` at a build output folder rather than the project root is still the safest setup.

### `@acurast/sdk/chain`

Direct access to the Acurast chain: wallets, balances, job registration, assignments, environment variables, and app versions.

```typescript
import {
  walletFromMnemonic,
  getBalance,
  registerJob,
  jobAssignments,
  AcurastService,
  setEnvVars,
} from '@acurast/sdk/chain'
```

Helpers include `convertConfigToJob`, duration constants (`second`, `minute`, `hour`, `day`), sensible defaults (`DEFAULT_REWARD`, `DEFAULT_REPLICAS`, ...), the `JobEnvironmentService` for encrypted env vars, and an `InMemoryKeyStore`.

#### RPC endpoint security

The RPC endpoint is trusted with the confidentiality of your environment variables. `setEnvVars` reads the assigned processors and their public keys from that endpoint and encrypts the variables to those keys; the SDK does not yet check that the keys belong to an attested processor. A malicious RPC node, or anyone who can intercept a plaintext connection to it, can return its own key and decrypt the variables once they are on chain. Only use RPC nodes you trust.

`AcurastService` and `setEnvVars` therefore check the endpoint before connecting (with `validateRpcEndpoint`, also exported):

- `wss://` is accepted for any host.
- Plaintext `ws://` is accepted only for loopback hosts (`localhost`, `127.0.0.0/8`, `[::1]`), so local dev nodes keep working.
- Plaintext `ws://` to any other host throws, unless you pass `allowInsecureRpcEndpoint: true`.
- Malformed URLs, other schemes (`http://`, `https://`, ...) and URLs with a username or password always throw. Error messages include only the scheme and host, never credentials, path or query.

```typescript
new AcurastService('wss://archive.mainnet.acurast.com') // ok
new AcurastService('ws://127.0.0.1:9944') // ok, loopback
new AcurastService('ws://10.0.0.5:9944') // throws
new AcurastService('ws://10.0.0.5:9944', { allowInsecureRpcEndpoint: true }) // ok, at your own risk

await setEnvVars(job, { wallet, rpcEndpoint: 'ws://10.0.0.5:9944', allowInsecureRpcEndpoint: true })
```

`deployProject`, `deployProjectBrowser` and `deployProjectCore` apply the same check as their first step, before connecting, bundling, uploading to IPFS or registering the job, so a rejected endpoint fails the whole deploy without side effects. They accept the same `allowInsecureRpcEndpoint` option and pass it on to the env-var step:

```typescript
await deployProject(config, job, {
  // ...
  rpcEndpoint: 'ws://10.0.0.5:9944',
  allowInsecureRpcEndpoint: true, // at your own risk
})
```

### `@acurast/sdk/ipfs`

Upload deployment scripts to IPFS.

```typescript
import { uploadScript } from '@acurast/sdk/ipfs'

const uri = await uploadScript(
  { file: './dist/bundle.zip' }, // or { script: '...' }
  { endpoint: 'https://api.pinata.cloud', apiKey: '...' },
)
```

The CID returned by the pinning service is not trusted: the upload fails if the response has no well-formed CID, or if the CID differs from the CIDv0 computed locally from the uploaded bytes (`computeCidV0`, kubo importer defaults). For a pinning service that builds a different DAG layout, pass `verifyCid: false` in the options; the format check still applies. The browser `uploadBlob` behaves the same.

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
  fetchPricingAdvice,
} from '@acurast/sdk/matcher'
```

### `@acurast/sdk/types`

Shared TypeScript types used across the SDK.

## Runtimes

Set `runtime` on `AcurastProjectConfig` to pick the execution environment:

- `DeploymentRuntime.NodeJSWithBundle` (default) — Node.js, bundled file deployment.
- `DeploymentRuntime.NodeJS` — Node.js, single-file deployment.
- `DeploymentRuntime.Shell` — native binary inside a Linux distro image (PRoot-isolated). Requires `image: { url, sha256 }` on the config; the SDK auto-adds `RequiredModules.Shell` to `requiredModules` and embeds the image reference in `manifest.json`.

Shell deployments can also set `resetExitCode` (integer 1-125): when the entrypoint exits with that code, the processor resets the container (rootfs restored from the image, entrypoint rerun, execution keeps going). The value is written to `manifest.json`; it is not set by default and ignored for other runtimes. Requires Android Processor 1.29.0+.

```ts
import { DeploymentRuntime } from '@acurast/sdk/types'

const config = {
  runtime: DeploymentRuntime.Shell,
  entrypoint: 'acurast.sh',
  resetExitCode: 82,
  image: {
    url: 'https://github.com/termux/proot-distro/releases/download/v4.30.1/ubuntu-questing-aarch64-pd-v4.30.1.tar.xz',
    sha256: '5ab35b90cd9a9f180656261ba400a135c4c01c2da4b74522118342f985c2d328',
  },
  // ...
}
```

## Examples

See the [`examples/`](../../examples/) folder for end-to-end usage.
