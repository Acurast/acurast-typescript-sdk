/**
 * Validation of Acurast chain RPC endpoints.
 *
 * The RPC endpoint is trusted with the confidentiality of environment
 * variables: `setEnvVars` encrypts them to the processor public keys that the
 * endpoint returns. A plaintext `ws://` connection lets anyone on the network
 * path substitute their own key and read the secrets, so only `wss://` is
 * accepted unless the host is loopback or the caller opts in explicitly.
 *
 * Browser-safe: relies only on the WHATWG `URL` global.
 */

export interface RpcEndpointOptions {
  /**
   * Allow a plaintext `ws://` RPC endpoint on a non-loopback host.
   *
   * Off by default. Turning it on lets anyone who can observe or alter the
   * connection read or replace chain data, including the processor public keys
   * that environment variables are encrypted to. Plaintext endpoints on
   * `localhost`, `127.0.0.0/8` and `[::1]` are always allowed.
   */
  allowInsecureRpcEndpoint?: boolean
}

const SECURE_PROTOCOL = 'wss:'
const INSECURE_PROTOCOL = 'ws:'

/** Matches a hostname that the URL parser has already normalised to dotted-quad IPv4. */
const IPV4_LOOPBACK = /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/

/**
 * True when `hostname` (as returned by `URL#hostname`, so lowercased and with
 * IPv4/IPv6 literals normalised) is a loopback host.
 */
export const isLoopbackHost = (hostname: string): boolean =>
  hostname === 'localhost' || hostname === '[::1]' || IPV4_LOOPBACK.test(hostname)

/** `scheme://host[:port]` only: never userinfo, path, query or fragment. */
const redactedOrigin = (url: URL): string => `${url.protocol}//${url.host}`

/**
 * Checks that `endpoint` is a WebSocket RPC URL the SDK may connect to and
 * returns it unchanged. Throws otherwise, without echoing credentials, path or
 * query of the input in the error message.
 *
 * Accepted:
 * - `wss://` on any host;
 * - `ws://` on `localhost`, `127.0.0.0/8` or `[::1]`;
 * - `ws://` on any other host only with `allowInsecureRpcEndpoint: true`.
 *
 * Always rejected: malformed URLs, other schemes, and URLs that embed a
 * username or password.
 */
export const validateRpcEndpoint = (endpoint: string, options: RpcEndpointOptions = {}): string => {
  if (typeof endpoint !== 'string' || endpoint.trim() === '') {
    throw new Error('Invalid RPC endpoint: expected a non-empty wss:// URL.')
  }

  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    throw new Error('Invalid RPC endpoint: not a valid URL. Expected a wss:// URL.')
  }

  if (url.username !== '' || url.password !== '') {
    throw new Error(
      `Invalid RPC endpoint ${redactedOrigin(url)}: credentials in the URL are not allowed.`,
    )
  }

  if (url.protocol === SECURE_PROTOCOL) {
    return endpoint
  }

  if (url.protocol !== INSECURE_PROTOCOL) {
    throw new Error(
      `Invalid RPC endpoint: unsupported scheme "${url.protocol}". Expected a wss:// URL.`,
    )
  }

  if (isLoopbackHost(url.hostname) || options.allowInsecureRpcEndpoint === true) {
    return endpoint
  }

  throw new Error(
    `Insecure RPC endpoint ${redactedOrigin(url)}: use wss://. Plaintext ws:// is only allowed for ` +
      'localhost, 127.0.0.0/8 and [::1], or with allowInsecureRpcEndpoint: true. The RPC ' +
      'endpoint supplies the keys that environment variables are encrypted to.',
  )
}
