#!/usr/bin/env python3
"""Acurast reverse-tunnel client for the @acurast/vps deployment.

Reads the P-256 identity key from $TUNNEL_KEY (base64 PKCS#8 DER, injected by
the deploy agent) so the tunnel domain — hex(sha256(compressed_pubkey)[:8]) —
can be precomputed off-chain before the job matches. Then asks the Acurast
Processor (via the JSON-RPC bridge on the abstract Unix socket named in
$BRIDGE_SOCKET) to open the primary reverse tunnel pointing directly at
dropbear:

- PRIMARY (Let's Encrypt cert) -> 127.0.0.1:2222  (dropbear SSH)

The secondary connection isn't used — its clientId is host-derived and can't
be precomputed. Users reach SSH via the primary domain with an openssl
s_client ProxyCommand (SSH-over-TLS through the same tunnel that would
otherwise serve HTTPS).
"""

import base64
import json
import os
import signal
import socket
import sys
import time
import traceback
from urllib import request as urlrequest

# Network-specific relay endpoints and default domain suffixes.
NETWORKS = {
    "mainnet": {
        "relays": [
            "relay-1.mainnet.acurast.com:4433",
        ],
        "domainSuffix": "acu.run",
    },
    "canary": {
        "relays": [
            "relay-2.canary.acurast.com:4433",
            "canary-relay.5elementsnodes.com:4433",
            "relay.el9-acurast.com:4433",
            "canary-relay.vincent-acurast.xyz:4433",
            "canary-relay.acurast.online:4433",
        ],
        "domainSuffix": "canary.acu.run",
    },
}
NETWORK = os.environ.get("NETWORK")
if NETWORK not in NETWORKS:
    print(f"NETWORK env var must be one of {list(NETWORKS)}; got {NETWORK!r}.", file=sys.stderr)
    sys.exit(1)
TUNNEL_RELAYS = NETWORKS[NETWORK]["relays"]
_DOMAIN_ENV = f"DOMAIN_SUFFIX_{NETWORK.upper()}"
DOMAIN_SUFFIX = os.environ.get(_DOMAIN_ENV) or NETWORKS[NETWORK]["domainSuffix"]

SSH_PORT = 2222
# Primary tunnel target is dropbear directly — its clientId is derived from
# our TUNNEL_KEY, so the SSH URL is fully knowable off-chain.
LOCAL_ADDR = f"127.0.0.1:{SSH_PORT}"
STATUS_POLL_INTERVAL_SEC = 30
STAGING_CERTIFICATE = False

CALLBACK_URL = os.environ.get("CALLBACK_URL")
BRIDGE_SOCKET = os.environ.get("BRIDGE_SOCKET")
if not BRIDGE_SOCKET:
    print("BRIDGE_SOCKET env var not set; cannot reach Acurast RPC bridge.", file=sys.stderr)
    sys.exit(1)

# The deploy agent generates the P-256 keypair off-chain and injects the
# private key here so the tunnel domain (derived from the public key) is known
# before the job matches. Falling back to on-processor generation would break
# that guarantee, so we require it.
TUNNEL_KEY_B64 = os.environ.get("TUNNEL_KEY")
if not TUNNEL_KEY_B64:
    print("TUNNEL_KEY env var not set; refusing to start (would break domain precomputation).", file=sys.stderr)
    sys.exit(1)
# Validate — the bridge would reject a malformed key later anyway, but failing
# early with a clear message is friendlier than a downstream RPC error.
try:
    base64.b64decode(TUNNEL_KEY_B64, validate=True)
except Exception as e:
    print(f"TUNNEL_KEY is not valid base64: {e}", file=sys.stderr)
    sys.exit(1)


def post_callback(payload):
    if not CALLBACK_URL:
        return
    try:
        req = urlrequest.Request(
            CALLBACK_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "User-Agent": "acurast-vps-tunnel/0.1.0"},
            method="POST",
        )
        urlrequest.urlopen(req, timeout=10).close()
    except Exception as e:
        print(f"callback POST failed: {e}", file=sys.stderr)


def report_log(message):
    print(message)
    post_callback({"event": "log", "message": message})


def report_started(web_url, ssh_url, ssh_port, connect):
    post_callback({
        "event": "started",
        "webUrl": web_url,
        "sshUrl": ssh_url,
        "sshPort": ssh_port,
        "connect": connect,
    })


def report_error(message):
    print(f"ERROR: {message}", file=sys.stderr)
    post_callback({"event": "error", "message": message})


_rpc_id = 0


def _next_id():
    global _rpc_id
    _rpc_id += 1
    return _rpc_id


def rpc_call(method, params):
    """One-shot JSON-RPC 2.0 call — the host closes the socket per exchange."""
    req = {"jsonrpc": "2.0", "method": method, "params": params, "id": _next_id()}
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    try:
        # Abstract namespace: leading NUL byte, no filesystem entry.
        sock.connect("\0" + BRIDGE_SOCKET)
        sock.sendall((json.dumps(req) + "\n").encode("utf-8"))
        buf = bytearray()
        while b"\n" not in buf:
            chunk = sock.recv(65536)
            if not chunk:
                break
            buf.extend(chunk)
    finally:
        sock.close()
    line = bytes(buf).split(b"\n", 1)[0].decode("utf-8")
    resp = json.loads(line)
    if "error" in resp:
        e = resp["error"]
        raise RuntimeError(f"RPC error {e.get('code')}: {e.get('message')}")
    return resp.get("result")


def main():
    spec = {
        "serverAddrs": TUNNEL_RELAYS,
        "domainSuffix": DOMAIN_SUFFIX,
        "localAddr": LOCAL_ADDR,
        "primaryKey": {"algorithm": "Secp256r1", "bytes": TUNNEL_KEY_B64},
        "acmeStaging": STAGING_CERTIFICATE,
    }

    report_log(f"Requesting reverse tunnel (ssh -> {LOCAL_ADDR})")
    info = rpc_call("tunnel_start", [spec])
    ssh_url = info.get("url")
    client_id = info.get("clientId")
    report_log(f"Tunnel started: url={ssh_url} clientId={client_id}")

    connect_cmd = (
        f"ssh -o ProxyCommand='openssl s_client -quiet "
        f"-servername {client_id}.{DOMAIN_SUFFIX} "
        f"-connect {client_id}.{DOMAIN_SUFFIX}:443' root@{client_id}"
    )
    report_started(ssh_url, ssh_url, SSH_PORT, connect_cmd)
    print(f"Connect via SSH-over-TLS:\n  {connect_cmd}")

    stop_called = {"value": False}

    def shutdown(signum, _frame):
        if stop_called["value"]:
            sys.exit(0)
        stop_called["value"] = True
        report_log(f"Received signal {signum}, stopping tunnel")
        try:
            rpc_call("tunnel_stop", [])
        except Exception as e:
            print(f"tunnel_stop failed: {e}", file=sys.stderr)
        sys.exit(0)

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    status_names = {0: "Starting", 1: "Running", 2: "Stopped", 3: "Failed", -1: "None"}
    while True:
        time.sleep(STATUS_POLL_INTERVAL_SEC)
        try:
            res = rpc_call("tunnel_status", [])
            s = res.get("status", -1) if isinstance(res, dict) else -1
            print(f"tunnel status: {status_names.get(s, s)}")
        except Exception as e:
            print(f"status poll failed: {e}", file=sys.stderr)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        traceback.print_exc()
        report_error(str(e))
        sys.exit(1)
