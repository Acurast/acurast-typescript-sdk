# @acurast/vps

VPS deployment helpers for the Acurast decentralized cloud. Precompute the
tunnel subdomain off-chain, build the on-chain job registration, and ship a
matching tunnel bundle that boots dropbear (+ optional [sslh](https://github.com/yrutschle/sslh)
for HTTP multiplexing) on the assigned processor.

Consumed by the [acurast-deploy-agent](https://github.com/Acurast/acurast-deploy-agent).

## Install

```
npm install @acurast/vps
```

## What it does

1. **`generateTunnelKeypair()`** — P-256 (SECP256R1) key pair; the private
   half is base64-PKCS8 injected into the Acurast job as the `TUNNEL_KEY`
   env var.
2. **`computeClientId(publicKeyCompressed)`** — the 16-hex prefix of
   `sha256(compressed_pubkey)`. The processor's tunnel client uses the same
   derivation, so `<clientId>.acu.run` is knowable *before* the job matches.
3. **`buildVpsJob(request)`** — produces an
   `AcurastProjectConfig` + on-chain `JobRegistration` targeting the pinned
   tunnel bundle CID (`TUNNEL_SCRIPT_IPFS`), plus the encrypted env vars the
   agent must inject via `setEnvironment` once a processor acknowledges.
4. **`probeVpsReady(domain)`** — TLS handshake + banner check on
   `<domain>:443` so callers can poll for tunnel readiness without hardcoding
   a retry loop.
5. **Pinned tunnel bundle** (`tunnel/`) — `start.sh`, `tunnel.py`,
   `callback.sh`, `getifaddrs_override.c`. Installed on the processor from
   IPFS. This directory is included in the npm package so the CID and the
   TypeScript interface ship together per release.

## Quick start

```ts
import { buildVpsJob, computeClientId, probeVpsReady } from '@acurast/vps'
import { deployProject } from '@acurast/sdk/deploy'
import { walletFromMnemonic } from '@acurast/sdk/chain'

const plan = buildVpsJob({
  sshKey: '<OpenSSH public key line>',
  httpPort: 8080,           // optional — enables sslh mux on the same subdomain
  callbackUrl: '…',         // optional — bundle POSTs boot events here
})

// plan.config, plan.job, plan.envVars, plan.clientId, plan.tunnelKey
console.log(`domain: https://${plan.clientId}.acu.run`)

const wallet = await walletFromMnemonic(process.env.ACURAST_MNEMONIC!)

await deployProject(plan.config, plan.job, {
  wallet,
  rpcEndpoint: 'wss://archive.mainnet.acurast.com',
  ipfs: { endpoint: '', apiKey: '' },   // unused when fileUrl is already ipfs://
  envVars: plan.envVars,
  statusCallback: (status, data) => console.log(status, data),
})

// Poll for the tunnel to come up (~2-4 min after processor ack).
while (true) {
  const { ready, banner } = await probeVpsReady(`${plan.clientId}.acu.run`)
  if (ready) { console.log('up:', banner); break }
  await new Promise((r) => setTimeout(r, 30_000))
}
```

## Tunnel bundle contract

The pinned bundle expects these env vars, delivered by the deploy agent via
Acurast's encrypted `setEnvironment` extrinsic:

| Var | Purpose |
| --- | --- |
| `TUNNEL_KEY` | Base64 PKCS#8 DER of the P-256 private key. Required. |
| `SSH_AUTHORIZED_KEY` | OpenSSH public key line for dropbear. Required. |
| `NETWORK` | `mainnet` \| `canary`. Required. |
| `HTTP_PORT` | If set, install sslh and multiplex HTTP + shell on the same subdomain. |
| `CALLBACK_URL` | Optional webhook for `log` / `started` / `error` JSON events. |

See [`tunnel/README.md`](./tunnel/README.md) for the bundle-side details.

## Release flow

1. Edit the bundle in `tunnel/`.
2. Bump `package.json` version.
3. Run `npm run pin-tunnel` — tars `tunnel/` with a synthesized `manifest.json`
   (matching `@acurast/sdk`'s `createManifest` shape), uploads to Pinata via
   `ACURAST_IPFS_URL` + `ACURAST_IPFS_API_KEY`, and patches
   `TUNNEL_SCRIPT_IPFS` in `src/job.ts`.
4. Commit + `npm publish` (or `lerna publish` at the monorepo root).

The interface (`buildVpsJob`, `VpsRequest`, …) and the tunnel bundle are
locked together per release.

## License

MIT
