# Acurast DevTools

[![npm](https://img.shields.io/npm/v/@acurast/devtools.svg?colorB=brightgreen)](https://www.npmjs.com/package/@acurast/devtools)

> ℹ️ **Internal only.** This package is primarily consumed by [`@acurast/cli`](https://github.com/Acurast/acurast-cli) to wire deployments into Acurast DevTools. It has no stability guarantees for external consumers — if you're building on Acurast, you most likely want [`@acurast/sdk`](../acurast-sdk/) or the CLI instead.

Client and bundle snippet injection for [Acurast DevTools](https://devtools.acurast.com).

This package lets you:

- Authenticate against the Acurast DevTools HTTP API and fetch short-lived view-keys for a deployment.
- Build a shareable DevTools URL for a deployment.
- Inject the DevTools runtime snippet into a deployment bundle so logs and diagnostics are forwarded to DevTools from a running job.

## Installation

```bash
$ npm install @acurast/devtools
```

Requires the following peer dependencies:

```bash
$ npm install @polkadot/keyring @polkadot/util @polkadot/wasm-crypto
```

## Usage

### Request a view-key and build a DevTools URL

```typescript
import { getDevtoolsViewKey, buildDevtoolsUrl } from '@acurast/devtools'

// jobId: the full `Acurast:<owner>:<number>` deployment id
const { viewKey, jobNumber } = await getDevtoolsViewKey(jobId, {
  apiUrl: 'https://api.devtools.acurast.com',
  signer, // the account that owns the deployment
})

const url = buildDevtoolsUrl('https://devtools.acurast.com', jobId, viewKey)
```

Requests are signed by `signer` (a `KeyringPair` or a wallet signer with `signRaw`); the deprecated `mnemonic` option derives an sr25519 pair. The signature authorises a view key for that deployment, so `apiUrl` must be the DevTools API you trust: it has to be `https://` (`http://` is accepted only for `localhost`, `127.0.0.0/8` and `[::1]`).

### Inject the DevTools snippet into a deployment bundle

```typescript
import { injectDevtoolsSnippet } from '@acurast/devtools'

await injectDevtoolsSnippet(
  zipPath,
  'index.js', // entrypoint inside the bundle
  'https://api.devtools.acurast.com'
)
```

This prepends the compiled DevTools snippet to the entrypoint file inside the zip bundle, so logs are forwarded to DevTools once the job runs.

**Everything the deployment logs leaves the processor.** The snippet wraps `console.log`, `warn`, `error`, `info` and `debug` and sends every call's arguments to the DevTools API. Do not log secrets (for example values of environment variables) in a deployment with DevTools enabled.

`devtoolsApiUrl` must be an `https://` URL without credentials, query string or fragment (`http://` is accepted only for `localhost`, `127.0.0.0/8` and `[::1]`). Any other value is rejected before the bundle is modified.

## API

- `getDevtoolsViewKey(jobId, options)` → `Promise<ViewKeyResponse>`
- `buildDevtoolsUrl(devtoolsUrl, deploymentId, viewKey)` → `string`
- `injectDevtoolsSnippet(zipPath, entrypoint, devtoolsApiUrl, snippetDir?)` → `Promise<string>`

Exported types: `ViewKeyResponse`, `DevtoolsOptions`.
