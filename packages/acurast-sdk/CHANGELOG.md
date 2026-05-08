# Changelog

## 1.1.1

### Added

- **Benchmark deployment filters** — optional minimum processor metrics aligned with the marketplace `deploy` extrinsic and matcher `matches/check`:
  - `AcurastProjectConfig.benchmarkFilters`: `minMemoryBytes`, `minCpuSingleCoreScore`, `minStorageBytes`, `minStorageIoScore`, and optional `poolIds` overrides for compute-pallet metric pool IDs.
  - `@acurast/sdk/chain`: `parseByteSize`, `buildBenchmarkMetricTriples`, `benchmarkTriplesToMatcherJson`, `hasBenchmarkFilters`, `buildMinMetricsForDeploy`, `DEFAULT_BENCHMARK_POOL_IDS`, `jobIdFromChainJson`, `listAssignedProcessorAddressesForJob` (reads `acurastMarketplace.assignedProcessors` map entries; processor SS58 from key only).
  - `registerJob` accepts optional `{ projectConfig }` so `deployProject` can submit encoded `min_metrics` with the job.
  - `@acurast/sdk/matcher`: `jobToMatchCheckParams` sends `min_metrics` when filters are set; exported `jsonRpcCall`.

### Fixed

- Matcher `min_metrics` JSON: send `(pool_id, value)` pairs for `matches/check`, matching the matcher’s expected array shape (the chain `deploy` extrinsic still uses `(pool_id, numerator, denominator)` triples).

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
