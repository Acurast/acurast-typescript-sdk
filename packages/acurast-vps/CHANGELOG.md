# Changelog

All notable changes to `@acurast/vps` are documented here. This project follows
[Semantic Versioning](https://semver.org/).

## [0.2.0]

### Changed

- `VpsRequest.reward` is now **required** — the `DEFAULT_REWARD` fallback was
  removed. The right price is deployment- and market-specific, so silently
  defaulting risked over- or under-paying.
- `VpsRequest.maxExecutionTimeInMs` is now **required**. It bounds total cost.
- Replaced `VpsRequest.startDelayMs?: number` with
  `VpsRequest.startAt?: { msFromNow: number } | { timestamp: number | string }`,
  mirroring `@acurast/sdk`'s own `startAt` union so an absolute planned start
  can be pinned as well as a relative lead time. Defaults to
  `{ msFromNow: 3 * 60_000 }`.

### Added

- `VpsRequest.minProcessorReputation?: number` — optional processor-reputation
  filter (unset = no filter), alongside the existing benchmark filters.
- `start.sh` installs `bash` + `bash-completion` and sets bash as root's login
  shell so interactive SSH sessions get tab completion.

## [0.1.0] — Initial release

First public release. Battle-tested via the
[acurast-deploy-agent](https://github.com/Acurast/acurast-deploy-agent) against
mainnet processors.

### Added

- `generateTunnelKeypair()` — P-256 (SECP256R1) PKCS#8 keypair for the
  Acurast primary tunnel.
- `computeClientId(publicKeyCompressed)` — `hex(sha256(pubkey)[0..8])`
  derivation, so `<clientId>.acu.run` is known off-chain before job match.
- `buildVpsJob(request)` — returns `{ config, job, tunnelKey, clientId, envVars }`.
  Config targets the pinned tunnel bundle CID and lists the env-var contract.
- `probeVpsReady(domain, options?)` — TLS + banner probe for tunnel
  readiness, returning `{ ready, banner, cert, error }`.
- Pinned tunnel bundle (`tunnel/`, published inside the package):
  - `start.sh` — installs dropbear + Python + optional sslh, wires
    dropbear key-only auth from `SSH_AUTHORIZED_KEY`, starts the reverse
    tunnel targeting either dropbear (`:2222`) directly or sslh (`:2000`)
    for HTTP multiplexing.
  - `tunnel.py` — opens the Acurast primary reverse tunnel via the local
    JSON-RPC bridge socket. Reads the tunnel identity from `TUNNEL_KEY`
    (never generates on-device) so domain precomputation stays truthful.
  - `callback.sh` — thin curl wrapper for lifecycle events.
  - `getifaddrs_override.c` — proot compatibility shim.
- Presets: `VPS_IMAGE_PRESETS.ubuntu` (Ubuntu 25.04 aarch64 proot-distro,
  pinned by sha256).
- Processor filters forwarded to `benchmarkFilters` on the on-chain job:
  `minMemory` (RAM bytes), `minCpuScore` (single-core benchmark),
  `minCpuMultiScore` (multi-core benchmark), `minStorage` (available
  storage bytes). All optional. Names mirror the `acurast-cli deploy`
  flags (`--min-cpu-score`, `--min-cpu-multi-score`) so JSON body and
  CLI stay in sync.
- Optional `httpPort` in `VpsRequest` — when set, the bundle installs
  sslh 2.x (libconfig-format `-F` invocation) and multiplexes shell + HTTP
  on the same Let's Encrypt subdomain. Falls back to shell-only if sslh
  can't install/start, with the failure surfaced via `CALLBACK_URL`.
- Release helper `scripts/pin-tunnel.mjs` — bundles `tunnel/` into a zip
  matching `@acurast/sdk`'s `createManifest` layout, uploads to Pinata,
  and patches `TUNNEL_SCRIPT_IPFS` in `src/job.ts`.

### Notes

- The Acurast primary tunnel points directly at dropbear (or at sslh when
  HTTP is enabled). The secondary tunnel is intentionally unused — its
  clientId is host-derived and can't be precomputed off-chain.
- `minProcessorVersions.android` is pinned to buildNumber `128` (Android
  release `1.26.0`) — the first firmware supporting the `secondaryLocalAddr`
  option we may need for future extensions.
