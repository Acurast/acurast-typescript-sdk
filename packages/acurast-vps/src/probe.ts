import tls from 'node:tls'

export interface VpsProbeResult {
  /** True once dropbear's banner has come through the tunnel. */
  ready: boolean
  /** Banner line seen on the wire, e.g. `SSH-2.0-dropbear_2025.88`. */
  banner?: string
  /** Peer certificate the tunnel served, if the TLS handshake completed. */
  cert?: {
    subject: string
    issuer: string
    notBefore: string
    notAfter: string
  }
  /** Human-readable reason `ready` is false. */
  error?: string
}

export interface ProbeOptions {
  /**
   * Tunnel port. Only 443 is accepted; any other value makes the probe return
   * `{ ready: false }` without connecting.
   *
   * @deprecated The tunnel is always served on 443. Kept for compatibility.
   */
  port?: number
  /** Overall probe deadline. Defaults to 10 000 ms. */
  timeoutMs?: number
}

/** The only port the Acurast tunnel relay serves VPS domains on. */
const TUNNEL_PORT = 443

/**
 * VPS tunnel domains: `<clientId>.acu.run` (mainnet) or
 * `<clientId>.canary.acu.run`, where the clientId is 16 lowercase hex digits
 * (see `computeClientId`).
 */
const VPS_DOMAIN = /^[0-9a-f]{16}\.(?:canary\.)?acu\.run$/

/** True when `domain` is a VPS tunnel domain that {@link probeVpsReady} may connect to. */
export const isVpsDomain = (domain: string): boolean =>
  typeof domain === 'string' && VPS_DOMAIN.test(domain)

/**
 * Poll a VPS tunnel to check whether the processor has finished booting and
 * dropbear is answering behind the Let's Encrypt cert:
 *
 * 1. TLS-connect to `<domain>:443` with SNI and standard trust anchors.
 * 2. Read the plaintext bytes the tunnel forwards from dropbear.
 * 3. Match the `SSH-` protocol banner.
 *
 * Only `<16 hex>.acu.run` and `<16 hex>.canary.acu.run` on port 443 are
 * probed. Any other domain or port returns `{ ready: false, error }` without
 * opening a connection, so an endpoint that forwards a client-supplied domain
 * cannot be used to scan other hosts or ports.
 *
 * Returns `{ ready: false, error }` on any failure so callers can just poll
 * on an interval without try/catch. The agent's `/vps/probe` endpoint wraps
 * this so clients can drive their own retry loop instead of the agent
 * having to track deployment state.
 */
export const probeVpsReady = (
  domain: string,
  options: ProbeOptions = {},
): Promise<VpsProbeResult> => {
  const port = options.port ?? TUNNEL_PORT
  const timeoutMs = options.timeoutMs ?? 10_000

  if (!isVpsDomain(domain)) {
    return Promise.resolve({
      ready: false,
      error: 'invalid domain: expected <16 hex>.acu.run or <16 hex>.canary.acu.run',
    })
  }
  if (port !== TUNNEL_PORT) {
    return Promise.resolve({ ready: false, error: `invalid port: only ${TUNNEL_PORT} is allowed` })
  }

  return new Promise<VpsProbeResult>((resolve) => {
    let settled = false
    const finish = (result: VpsProbeResult) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(result)
    }

    const socket = tls.connect(
      { host: domain, port, servername: domain, rejectUnauthorized: true },
      () => {
        // Handshake done; wait for banner on the inner stream.
      },
    )
    socket.setTimeout(timeoutMs)

    let cert: VpsProbeResult['cert']
    socket.on('secureConnect', () => {
      const c = socket.getPeerCertificate()
      if (c && c.subject) {
        const cn = (v: string | string[] | undefined): string =>
          Array.isArray(v) ? (v[0] ?? '') : (v ?? '')
        cert = {
          subject: cn(c.subject?.CN),
          issuer: cn(c.issuer?.CN),
          notBefore: c.valid_from,
          notAfter: c.valid_to,
        }
      }
    })

    let buf = Buffer.alloc(0)
    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk])
      const s = buf.toString('utf8')
      if (s.startsWith('SSH-')) {
        const line = s.split(/\r?\n/, 1)[0]
        finish({ ready: true, banner: line, cert })
      } else if (buf.length > 256) {
        finish({ ready: false, error: 'unrecognized banner', cert })
      }
    })
    socket.on('timeout', () =>
      finish({ ready: false, error: `timeout after ${timeoutMs}ms`, cert }),
    )
    socket.on('error', (err) => finish({ ready: false, error: err.message, cert }))
    socket.on('end', () => finish({ ready: false, error: 'connection closed before banner', cert }))
  })
}
