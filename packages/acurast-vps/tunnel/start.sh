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

# Interactive SSH sessions get a real shell with tab completion. Dropbear
# spawns root's login shell from /etc/passwd; a minimal base often points that
# at /bin/sh (dash, no completion). Ensure bash + bash-completion and make bash
# root's login shell so `ssh root@host` lands in a completion-capable shell.
if ! command -v bash >/dev/null 2>&1; then
    apt-get install -y bash
fi
if [ ! -f /usr/share/bash-completion/bash_completion ]; then
    apt-get install -y bash-completion
fi
usermod -s /bin/bash root 2>/dev/null || chsh -s /bin/bash root 2>/dev/null || true
# Debian chains /etc/profile -> /etc/bash.bashrc (which sources bash-completion
# for interactive shells). If the base image's profile doesn't, source it
# ourselves for login shells so completion works regardless.
cat > /etc/profile.d/bash-completion-fallback.sh <<'EOF'
if [ -n "$PS1" ] && [ -z "$BASH_COMPLETION_VERSINFO" ] && [ -r /usr/share/bash-completion/bash_completion ]; then
    . /usr/share/bash-completion/bash_completion
fi
EOF

if [ ! -f "$GETIFADDRS_OVERRIDE_SO" ]; then
    echo "=== Building getifaddrs override shim ==="
    apt-get install -y gcc libc6-dev
    mkdir -p "$(dirname "$GETIFADDRS_OVERRIDE_SO")"
    gcc -shared -fPIC -o "$GETIFADDRS_OVERRIDE_SO" "$SCRIPT_DIR/getifaddrs_override.c"
    echo "=== Shim built ==="
fi

mkdir -p /etc/profile.d
echo "export LD_PRELOAD=$GETIFADDRS_OVERRIDE_SO" > /etc/profile.d/ifaddrs-shim.sh

# Do not dump the injected Acurast env vars into a profile.d script:
# SSH_AUTHORIZED_KEY contains spaces (the RSA blob + comment), so the naive
# `env | sed 's/^/export /'` from the cargo example produced malformed
# `export VAR=part1 part2 part3` lines that bash bailed on at every login.
# It also leaks TUNNEL_KEY — a secret — into every interactive shell. If a
# specific var needs to be in the login env, add it here explicitly and
# single-quote the value.

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

trap 'kill $DROPBEAR_PID $SSLH_PID $TUNNEL_PID 2>/dev/null' INT TERM EXIT

# Opt-in HTTP multiplexing: when HTTP_PORT is injected, install sslh in front
# of dropbear so the same subdomain serves both SSH and the user's HTTP app.
# --on-timeout ssh handles the server-first quirk (dropbear sends banner before
# the client says anything) — without it, connect stalls for the default 2s.
if [ -n "$HTTP_PORT" ]; then
    if ! command -v sslh >/dev/null 2>&1; then
        apt-get install -y sslh
    fi
    send_log "Starting sslh on 127.0.0.1:2000 (ssh -> 2222, http -> ${HTTP_PORT})"
    sslh --listen 127.0.0.1:2000 \
         --ssh 127.0.0.1:2222 \
         --http 127.0.0.1:"$HTTP_PORT" \
         --on-timeout ssh \
         --timeout 0.2 \
         -F &
    SSLH_PID=$!
fi

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
