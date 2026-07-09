# @acurast/vps — tunnel bundle

This directory is packaged as an IPFS bundle and executed on the Acurast
processor after `buildVpsJob` matches. The resulting CID is pinned in
[`../src/job.ts`](../src/job.ts) as `TUNNEL_SCRIPT_IPFS` and shipped with the
package, so `@acurast/vps@x.y.z` always speaks the same wire protocol as the
script running on the device.

## What it does

1. `start.sh` (entrypoint) installs dropbear + python3-cryptography + curl,
   builds the `getifaddrs` shim, configures SSH auth from `SSH_AUTHORIZED_KEY`,
   and starts dropbear on `127.0.0.1:2222`.
2. `tunnel.py` opens the Acurast **primary** reverse tunnel via the JSON-RPC
   bridge socket (`$BRIDGE_SOCKET`, injected by the processor host):
   - Primary (Let's Encrypt) → `127.0.0.1:2222` — dropbear SSH.

   The secondary connection is intentionally unused: its clientId is
   host-derived and can't be precomputed off-chain, defeating the whole
   purpose of injecting `TUNNEL_KEY`. Users reach SSH via the primary domain
   with an `openssl s_client` ProxyCommand (SSH-over-TLS).

## Deploy-agent contract

The agent MUST inject:

| Env var | Format | Purpose |
| --- | --- | --- |
| `TUNNEL_KEY` | base64 PKCS#8 DER of P-256 private key | Tunnel identity. The domain `<clientId>.acu.run` is `hex(sha256(compressed_pubkey)[:8])`, so precomputing it off-chain requires the agent to control this key. Required — the script exits if unset. |
| `SSH_AUTHORIZED_KEY` | OpenSSH public key line | Written to `/root/.ssh/authorized_keys`. If unset, dropbear falls back to a randomly generated root password logged via the callback (dev only). |
| `NETWORK` | `mainnet` \| `canary` | Selects relay endpoints and default domain suffix. |

The agent's `buildVpsJob` lists these three vars in
`includeEnvironmentVariables` so the Acurast pallet forwards them to the
processor at execution time.

## Optional env vars

| Env var | Purpose |
| --- | --- |
| `CALLBACK_URL` | Webhook for `log` / `started` / `error` events. |
| `DOMAIN_SUFFIX_MAINNET` / `DOMAIN_SUFFIX_CANARY` | Custom domain suffix per network. If set on the deploying account, must also appear in `includeEnvironmentVariables`. |
| `BRIDGE_SOCKET` | Injected by the Acurast processor host — do not set manually. |

## Ports

Only one port is used (>= 1024 required inside the proot sandbox):

- `2222` — dropbear SSH, targeted by the primary tunnel

## Release

Bump the package version → tar this directory → pin to IPFS → paste the CID
into `TUNNEL_SCRIPT_IPFS` in [`../src/job.ts`](../src/job.ts) → `npm publish`.
The interface (`buildVpsJob`, `VpsRequest`) and the script version are then
locked together.
