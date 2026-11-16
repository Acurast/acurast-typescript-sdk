# Changelog

## Unreleased

### Added

- **`computeCidV0`** (`@acurast/sdk/ipfs`, `@acurast/sdk/browser`) computes the CIDv0 kubo assigns to a file with the default importer settings, plus the `isCidV0` / `isWellFormedCid` format checks.
- `IpfsUploadOptions.verifyCid` (default `true`) to opt out of the CID comparison for pinning services with a different DAG layout.
- `ZipFolderOptions` (`includeDotfiles`, `exclude`), accepted by `zipFolder` as an optional last argument and by `deployProject` as `options.bundle`.
- **`validateRpcEndpoint`**, `isLoopbackHost` and the `RpcEndpointOptions` type (`@acurast/sdk/chain`, `@acurast/sdk/browser`). `AcurastService` takes `RpcEndpointOptions` as an optional second constructor argument, and `SetEnvVarsOptions`, `DeployProjectOptions`, `DeployProjectBrowserOptions` and `DeployProjectCoreOptions` accept `allowInsecureRpcEndpoint`.

### Changed

- **Behaviour change: dotfiles are no longer bundled.** When a folder is deployed, `zipFolder` now leaves out every file or folder whose name starts with `.` (`.env`, `.git/`, `.npmrc`, `.acurast/`, ...), because the bundle is pinned publicly on IPFS. It warns with the list of excluded paths. Projects that need dotfiles at runtime must set `includeDotfiles: true`. Single-file deployments are unaffected.
- **Behaviour change: insecure RPC endpoints are rejected.** Env vars are encrypted to processor keys read from the RPC endpoint, so a plaintext connection lets an attacker on the network path substitute their own key. `new AcurastService(endpoint)`, `setEnvVars`, `deployProject`, `deployProjectBrowser` and `deployProjectCore` now throw before connecting unless the endpoint is `wss://`, or `ws://` on a loopback host (`localhost`, `127.0.0.0/8`, `[::1]`). Plaintext `ws://` to other hosts requires `allowInsecureRpcEndpoint: true`. Malformed URLs, other schemes and URLs with embedded credentials are always rejected. `setEnvVars` validates the endpoint even when there are no env vars to set. The deploy functions check the endpoint first, before bundling, uploading to IPFS or registering the job, and pass the opt-in on to the env-var step. The README now documents that the RPC endpoint is trusted with env-var confidentiality.
- **Behaviour change: `projectName` is restricted.** It becomes the bundle file name, so `validateConfig` now only accepts 1-64 characters of `A-Z`, `a-z`, `0-9`, `.`, `_` and `-` (not `.` or `..`). `zipFolder` rejects a deployment name that contains a path separator or NUL byte, is `.` or `..`, or would otherwise place the zip outside the output folder; previously a name like `../../x` wrote `x.zip` above it.
- **Behaviour change: stricter config validation.** `validateConfig` now checks `processorWhitelist` entries and `assignmentStrategy.instantMatch[].processor` as addresses (an SS58 address with a valid checksum, or a `0x`-prefixed 32-byte hex account id); previously every string was accepted. `image.url` must be an `https://` URL and `image.sha256` 64 hexadecimal characters. When `onlyAttestedDevices` is `false` and `includeEnvironmentVariables` is not empty, an additional warning note says the env vars will be decrypted on unattested devices.
- **Behaviour change: `fetchDeviceVersions` only adds entries.** The downloaded table no longer overwrites bundled (or previously fetched) build numbers. A new entry is accepted only if its build number is higher than every known build of that platform, its version string is not already mapped, and keys and values are well formed (`1.2.3` or `1.2.3-rc1`); anything else is ignored. A response that is not a JSON object throws. This keeps a modified remote file from changing what an existing `minProcessorVersions` version string resolves to.

### Fixed

- `setEnvVars` (via `JobEnvironmentService.setEnvironmentVariablesMulti`) now throws instead of submitting an empty `setEnvironments` extrinsic and reporting success when none of the assigned processors has a usable encryption key.
- `uploadScript` no longer rethrows the raw `AxiosError` when the pinning request fails. That error kept the request config, so logging it (or `util.inspect` / `JSON.stringify` of it) exposed the `Authorization: Bearer <apiKey>` header. Both `uploadScript` and `uploadBlob` now reject with an `Error` (`name: 'IpfsUploadError'`) whose message holds the HTTP status, status text and a short, redacted excerpt of the response body (or the network error code), with a numeric `status` property when a response was received and no `cause`, config or request attached. The API key is removed from the excerpt if the service echoes it.
- `uploadScript` and `uploadBlob` no longer trust the CID returned by the pinning service: a missing or malformed CID (previously returned as `ipfs://undefined`) or a CID that does not match the uploaded bytes now throws.
- `uploadScript` no longer stages the content in a fixed `temp_script.js` in the working directory, so concurrent uploads cannot receive each other's CID.
- `zipFolder` output no longer depends on the machine's timezone: entries were stamped with a UTC instant that adm-zip converts to local DOS date/time, so the zip bytes (and the IPFS CID) differed per `TZ`. Bundles are now identical everywhere and match what a UTC machine produced before.

## 1.6.0

### Added

- **`resetExitCode`** — optional `AcurastProjectConfig` field (integer 1-125) for the Shell runtime. When the entrypoint exits with this code, the processor resets the container: stops all processes, restores the rootfs from the image and reruns the entrypoint, without ending the execution (Android Processor 1.29.0+). The value is validated and written to the bundle's `manifest.json` as `"resetExitCode"`; unset by default. Setting it for a non-Shell runtime yields a validation note and the field is ignored.
- `createManifest` and `zipProjectBrowser` accept an optional `resetExitCode`.

## 1.5.0

### Added

- **Config validation for runtime schedule limits** — limits the Acurast runtime enforces on chain are now caught at validation time with actionable messages instead of failing on submission:
  - Each execution must run for at least 1 minute (`MIN_EXECUTION_DURATION_MS`). For interval executions without an explicit `maxExecutionTimeInMs`, the derived duration (`intervalInMs` minus the gap between executions) is checked and the error explains how to fix it.
  - Deployments cannot be scheduled to start more than 24 hours in the future (`MAX_START_TIME_FROM_NOW_MS`), for both `startAt.msFromNow` and `startAt.timestamp`.
- New `@acurast/sdk/chain` exports: `MIN_EXECUTION_DURATION_MS`, `MAX_START_TIME_FROM_NOW_MS`, and `getScheduleDurationMs` (the per-execution duration that ends up as `schedule.duration` on chain).

### Changed

- `DEFAULT_DURATION_MS` raised from 10 seconds to 1 minute, matching the runtime's minimum execution duration.

## 1.4.0

### Added

- **Transaction queue** — a per-account submission authority that serializes extrinsics through a single nonce source, eliminating the `Transaction has too low priority to replace another transaction` / 1014 races when a deploy and its follow-up `setEnvironments` (or successive deploys) are submitted from the same signer.
  - New `@acurast/sdk/chain` exports: `SequentialTransactionQueue` and `BatchingTransactionQueue` adapters, the `BaseTransactionQueue` base for bring-your-own implementations, and `getDefaultQueue` / `setDefaultQueue` for the shared per-account default.
  - New types: `TransactionQueue`, `EnqueueHandlers`, `QueuedItem`, `BatchingQueueOptions`.
  - `registerJob`, `setEnvVars`, and `deployProjectCore` accept an optional `queue`. Left unset, they use the shared per-account queue, so the deploy and its background env-var write (and any following deploy) never collide on the nonce. Pass a custom queue (e.g. `BatchingTransactionQueue`) to change the strategy.

## 1.3.0

### Added

- **Browser support & injectable signers** — run deployments from a browser (e.g. the CLI Playground) without Node-only dependencies.
  - New `@acurast/sdk/browser` entry point. Re-exports `types`, `chain`, and `matcher`, plus browser-safe deploy primitives — no `fs`, `adm-zip`, `form-data`, or `node:path`.
  - Injectable signer abstraction in `@acurast/sdk/chain`: `AcurastSigner` (a mnemonic-derived `KeyringPair` **or** an `InjectedAcurastSigner`), with `isInjectedSigner`, `getSignerAddress`, and `resolveSigner`. Lets a browser-extension or remote-signing bridge sign extrinsics; the mnemonic path is unchanged.
  - Shared, environment-agnostic deploy orchestrator `deployProjectCore` (`DeployProjectCoreOptions`), used by both the Node and browser entry points.
  - Browser deploy/bundle/upload helpers: `deployProjectBrowser`, `zipProjectBrowser` (JSZip-based), and `uploadBlob` (IPFS upload via `fetch`).
  - New `browser` / `./browser` package `exports` and a `jszip` dependency.

### Fixed

- `setEnvVars` reliability: reworked the assigned-processor handling and encryption flow in `set-env-vars.ts` / `deploy-project.ts`.
- Config validation: for the `Single` assignment strategy, the number of `instantMatch` entries must equal `numberOfReplicas` (each slot needs exactly one matched processor).

### Changed

- `registerJob` now submits via the transaction queue instead of owning its own `signAndSend`. The rich `DeploymentError` (with the `section.name` dispatch-error code) is captured in the submission callback so it survives the generic queue rejection, and the job-status subscription is guarded against duplicate setup.

## 1.2.2

### Changed

- **Corrected benchmark filter fields and pool IDs.** Renamed `AcurastProjectConfig.benchmarkFilters` keys to match the compute pallet, and made default pool IDs network-aware:
  - `minMemoryBytes` → `minRamTotalBytes`, `minStorageBytes` → `minStorageAvailBytes`; added `minCpuMultiCoreScore`; removed `minStorageIoScore`. `minCpuSingleCoreScore` unchanged.
  - `DEFAULT_BENCHMARK_POOL_IDS` replaced by `getDefaultBenchmarkPoolIds(network)` with an `AcurastNetwork` parameter; metric-triple builders now take the target network.

## 1.2.1

### Added

- **Benchmark pricing** — `@acurast/sdk/matcher` `fetchPricingAdvice` now factors benchmark-filtered processor availability into its cost/fee recommendations.

### Fixed

- `setEnvVars`: fixed the per-processor submission loop so env vars are sent to all assigned processors.

## 1.2.0

### Added

- **Benchmark deployment filters** — optional minimum processor metrics aligned with the marketplace `deploy` extrinsic and matcher `matches/check`:
  - `AcurastProjectConfig.benchmarkFilters`: `minMemoryBytes`, `minCpuSingleCoreScore`, `minStorageBytes`, `minStorageIoScore`, and optional `poolIds` overrides for compute-pallet metric pool IDs. _(Field names corrected in 1.2.2.)_
  - `@acurast/sdk/chain`: `parseByteSize`, `buildBenchmarkMetricTriples`, `benchmarkTriplesToMatcherJson`, `hasBenchmarkFilters`, `buildMinMetricsForDeploy`, `DEFAULT_BENCHMARK_POOL_IDS`, `jobIdFromChainJson`, `listAssignedProcessorAddressesForJob` (reads `acurastMarketplace.assignedProcessors` map entries; processor SS58 from key only).
  - `registerJob` accepts optional `{ projectConfig }` so `deployProject` can submit encoded `min_metrics` with the job.
  - `@acurast/sdk/matcher`: `jobToMatchCheckParams` sends `min_metrics` when filters are set; exported `jsonRpcCall`.

### Fixed

- Matcher `min_metrics` JSON: send `(pool_id, value)` pairs for `matches/check`, matching the matcher’s expected array shape (the chain `deploy` extrinsic still uses `(pool_id, numerator, denominator)` triples).
- Benchmark metric thresholds use `bigint` (u128) arithmetic to avoid precision loss on large byte values.

### Changed

- `registerJob` passes `{ jobIds }` with `DeploymentStatus.Matched` so callers can query on-chain assignments after match.

## 1.1.0

### Added

- Shell runtime support. Deploy native binaries / shell scripts that run inside a Linux distro image on the processor (PRoot-isolated).
  - New `DeploymentRuntime.Shell` value.
  - New `RequiredModules.Shell` value (auto-injected into `requiredModules` when `runtime === Shell`).
  - New optional `image: { url, sha256 }` field on `AcurastProjectConfig`. Required when `runtime` is `Shell`. Embedded in `manifest.json` and verified by SHA256 on the processor.
  - `createManifest` accepts the `image` field and emits it in `manifest.json`.

  Example config:

  ```ts
  {
    runtime: DeploymentRuntime.Shell,
    entrypoint: 'acurast.sh',
    image: {
      url: 'https://github.com/termux/proot-distro/releases/download/v4.30.1/ubuntu-questing-aarch64-pd-v4.30.1.tar.xz',
      sha256: '5ab35b90cd9a9f180656261ba400a135c4c01c2da4b74522118342f985c2d328',
    },
    // ...
  }
  ```

## 1.0.1

Initial release of `@acurast/sdk`. Programmatic SDK for interacting with the Acurast Cloud, split into subpath exports.

### `@acurast/sdk/deploy`

- `deployProject` — end-to-end flow: zip a local project (file or folder), upload to IPFS, register the job on-chain, and submit encrypted environment variables after acknowledgement.
- `loadAcurastConfig` — load and parse `acurast.json`.
- `zipFolder`, `createManifest`, `checkIsFolder` — bundle helpers (deterministic zip with fixed timestamps for reproducible IPFS CIDs).
- `Logger` interface with a `NOOP_LOGGER` default.

### `@acurast/sdk/chain`

- `registerJob` — submit a deployment to the Acurast marketplace and stream registration / match / acknowledgement status.
- `setEnvVars` — encrypt environment variables with each assigned processor's ECDH key and submit them on-chain.
- `convertConfigToJob` — translate `AcurastProjectConfig` into the chain-level `JobRegistration`.
- `walletFromMnemonic`, `getBalance` — wallet helpers.
- `jobAssignments`, `AcurastService` — query assignments and deployment state.
- `JobEnvironmentService`, `KeyStore` (with `InMemoryKeyStore`) — manage ephemeral ECDH keypairs used for env-var encryption.
- Duration constants (`second`, `minute`, `hour`, `day`) and defaults (`DEFAULT_REWARD`, `DEFAULT_REPLICAS`, `DEFAULT_MAX_ALLOWED_START_DELAY_MS`, ...).
- App-version helpers (`deviceVersions`) for resolving min Android / iOS versions to build numbers.

### `@acurast/sdk/ipfs`

- `uploadScript` — pin a bundle to IPFS via a configurable pinning service (Pinata-compatible).

### `@acurast/sdk/matcher`

- `checkMatch`, `checkMatchWithReward` — query the matcher API to verify a job has eligible processors.
- `getAveragePrice`, `getPriceDistribution`, `getProcessorCount` — price discovery helpers.
- `suggestCostPerExecution`, `getFeeAnalysis`, `analyzePricing`, `fetchPricingAdvice` — fee modelling and pricing recommendations.

### `@acurast/sdk/types`

- `AcurastProjectConfig`, `JobRegistration`, `EnvVar`, `JobId`, `DeploymentStatus`, `DeploymentError`.
- Enums: `DeploymentRuntime` (`NodeJS`, `NodeJSWithBundle`), `RequiredModules` (`DataEncryption`, `LLM`), `RestartPolicy`, `ScriptMutability`, `AssignmentStrategyVariant`, `MultiOrigin`.
- Zod schema (`acurastProjectConfigSchema`) and `validateConfig` helper for project config validation with cross-field warnings.
