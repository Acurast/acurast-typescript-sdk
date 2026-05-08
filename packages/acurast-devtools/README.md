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

const { viewKey, deploymentId } = await getDevtoolsViewKey(jobId, {
  apiUrl: 'https://api.devtools.acurast.com',
  mnemonic: process.env.MNEMONIC!
})

const url = buildDevtoolsUrl('https://devtools.acurast.com', deploymentId, viewKey)
```

Requests are signed with an ed25519 keypair derived from the provided `mnemonic`.

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

## API

- `getDevtoolsViewKey(jobId, options)` → `Promise<ViewKeyResponse>`
- `buildDevtoolsUrl(devtoolsUrl, deploymentId, viewKey)` → `string`
- `injectDevtoolsSnippet(zipPath, entrypoint, devtoolsApiUrl, snippetDir?)` → `Promise<string>`

Exported types: `ViewKeyResponse`, `DevtoolsOptions`.
