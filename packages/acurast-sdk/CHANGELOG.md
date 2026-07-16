# Changelog

## 1.4.0-beta.0

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
