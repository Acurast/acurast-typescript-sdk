#!/bin/sh

echo "=== Setting up VPS environment ==="

apt-get update

if ! command -v curl >/dev/null 2>&1; then
    apt-get install -y curl
fi

SCRIPT_DIR="$(dirname "$0")"
GETIFADDRS_OVERRIDE_SO=/usr/local/lib/libgetifaddrs_override.so

. "$SCRIPT_DIR/callback.sh"

send_log "Setting up VPS environment"

if ! command -v dropbear >/dev/null 2>&1; then
    apt-get install -y dropbear
fi

if ! python3 -c "import cryptography" >/dev/null 2>&1; then
    apt-get install -y python3 python3-cryptography
fi

if [ ! -f "$GETIFADDRS_OVERRIDE_SO" ]; then
    echo "=== Building getifaddrs override shim ==="
    apt-get install -y gcc libc6-dev
    mkdir -p "$(dirname "$GETIFADDRS_OVERRIDE_SO")"
    gcc -shared -fPIC -o "$GETIFADDRS_OVERRIDE_SO" "$SCRIPT_DIR/getifaddrs_override.c"
    echo "=== Shim built ==="
fi

mkdir -p /etc/profile.d
echo "export LD_PRELOAD=$GETIFADDRS_OVERRIDE_SO" > /etc/profile.d/ifaddrs-shim.sh

# Expose the injected Acurast env vars to interactive SSH sessions.
env | sed 's/^/export /' > /etc/profile.d/acurast-env.sh

# SSH auth: key-only via SSH_AUTHORIZED_KEY (injected by the deploy agent).
# Refuse to start if unset — a password-only shell exposed to the internet
# behind a stable subdomain is not something we want to hand out silently.
if [ -z "$SSH_AUTHORIZED_KEY" ]; then
    report_error "SSH_AUTHORIZED_KEY env var not set; aborting."
    exit 1
fi
mkdir -p /root/.ssh
chmod 700 /root/.ssh
printf '%s\n' "$SSH_AUTHORIZED_KEY" > /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
passwd -l root >/dev/null 2>&1 || true
send_log "SSH authorized_keys configured ($(wc -c < /root/.ssh/authorized_keys) bytes)"

mkdir -p /etc/dropbear
dropbearkey -t rsa -f /etc/dropbear/dropbear_rsa_host_key 2>/dev/null || true
dropbearkey -t ecdsa -f /etc/dropbear/dropbear_ecdsa_host_key 2>/dev/null || true

echo "=== SSH server starting on port 2222 ==="
send_log "Local SSH server starting on port 2222 (key auth only)"

# -F foreground, -E stderr logs, -p bind, -R create host keys if missing,
# -s disable password logins, -g disable root password logins (belt+braces).
dropbear -F -E -p 2222 -R -s -g &
DROPBEAR_PID=$!

trap 'kill $DROPBEAR_PID $TUNNEL_PID 2>/dev/null' INT TERM EXIT

send_log "SSH ready on 2222, starting Acurast reverse tunnel"

python3 "$SCRIPT_DIR/tunnel.py" &
TUNNEL_PID=$!

wait $TUNNEL_PID
TUNNEL_EXIT=$?

if [ $TUNNEL_EXIT -ne 0 ]; then
    echo "ERROR: tunnel exited with status $TUNNEL_EXIT"
    report_error "tunnel exited with status $TUNNEL_EXIT"
    exit $TUNNEL_EXIT
fi

wait $DROPBEAR_PID
