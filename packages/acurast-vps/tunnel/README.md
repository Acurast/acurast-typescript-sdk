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
| `HTTP_PORT` | Opt-in HTTP multiplexing (see below). When set, sslh is installed and the primary tunnel targets it instead of dropbear directly. |
| `DOMAIN_SUFFIX_MAINNET` / `DOMAIN_SUFFIX_CANARY` | Custom domain suffix per network. If set on the deploying account, must also appear in `includeEnvironmentVariables`. |
| `BRIDGE_SOCKET` | Injected by the Acurast processor host — do not set manually. |

## Opt-in HTTP multiplexing

When `HTTP_PORT` is injected, `start.sh` installs [sslh](https://github.com/yrutschle/sslh)
and starts it on `127.0.0.1:2000` in front of both services. `tunnel.py` then
targets sslh instead of dropbear, and sslh sniffs each new connection to
route by protocol:

```
relay ──(TLS-terminated bytes)──> 127.0.0.1:2000  (sslh)
                                        ├── SSH-prefixed  → 127.0.0.1:2222 (dropbear)
                                        └── HTTP request  → 127.0.0.1:${HTTP_PORT} (user's app)
```

sslh flags:

```
sslh --listen 127.0.0.1:2000 \
     --ssh 127.0.0.1:2222 \
     --http 127.0.0.1:${HTTP_PORT} \
     --on-timeout ssh --timeout 0.2 -F
```

`--on-timeout ssh` handles SSH's server-first quirk (dropbear speaks before the
client), keeping the connect-time overhead to ~200 ms.

## Ports

All ports live in the proot sandbox (>= 1024 required):

- `2222` — dropbear SSH
- `2000` — sslh demux (only when `HTTP_PORT` is set)
- `$HTTP_PORT` — user's HTTP app (only when set)

## Release

Bump the package version → tar this directory → pin to IPFS → paste the CID
into `TUNNEL_SCRIPT_IPFS` in [`../src/job.ts`](../src/job.ts) → `npm publish`.
The interface (`buildVpsJob`, `VpsRequest`) and the script version are then
locked together.
