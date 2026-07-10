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
  /** Tunnel port. Defaults to 443. */
  port?: number
  /** Overall probe deadline. Defaults to 10 000 ms. */
  timeoutMs?: number
}

/**
 * Poll a VPS tunnel to check whether the processor has finished booting and
 * dropbear is answering behind the Let's Encrypt cert:
 *
 * 1. TLS-connect to `<domain>:443` with SNI and standard trust anchors.
 * 2. Read the plaintext bytes the tunnel forwards from dropbear.
 * 3. Match the `SSH-` protocol banner.
 *
 * Returns `{ ready: false, error }` on any failure so callers can just poll
 * on an interval without try/catch. The agent's `/vps/probe` endpoint wraps
 * this so clients can drive their own retry loop instead of the agent
 * having to track deployment state.
 */
export const probeVpsReady = (domain: string, options: ProbeOptions = {}): Promise<VpsProbeResult> => {
  const port = options.port ?? 443
  const timeoutMs = options.timeoutMs ?? 10_000

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
          Array.isArray(v) ? v[0] ?? '' : v ?? ''
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
    socket.on('timeout', () => finish({ ready: false, error: `timeout after ${timeoutMs}ms`, cert }))
    socket.on('error', (err) => finish({ ready: false, error: err.message, cert }))
    socket.on('end', () => finish({ ready: false, error: 'connection closed before banner', cert }))
  })
}
