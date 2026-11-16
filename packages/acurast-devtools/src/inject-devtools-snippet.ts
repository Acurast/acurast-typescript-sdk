import AdmZip from 'adm-zip'
import { readFileSync } from 'fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Resolve the directory this compiled module ships in, so the bundled
 * devtools-snippet.js next to it can be read.
 *
 * Uses `import.meta.url` directly. The package is ESM (`"type": "module"`,
 * import-only exports), so this is valid at runtime. A previous version wrapped
 * it in `new Function('return import.meta.url')` to avoid a ts-jest CJS parse
 * error, but that evaluates the body in non-module scope where `import.meta` is
 * a syntax error — throwing "Cannot use 'import.meta' outside a module" on
 * every real call and silently shipping deployments with no snippet injected.
 */
function selfDir(): string {
  return dirname(fileURLToPath(import.meta.url))
}

/** Matches a hostname that the URL parser has already normalised to dotted-quad IPv4. */
const IPV4_LOOPBACK = /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/

/** DNS names and IPv4 literals after URL normalisation (lowercase). */
const HOSTNAME = /^[a-z0-9.-]+$/

/** Bracketed IPv6 literals after URL normalisation. */
const IPV6_HOSTNAME = /^\[[0-9a-f:.]+\]$/

const isLoopbackHost = (hostname: string): boolean =>
  hostname === 'localhost' || hostname === '[::1]' || IPV4_LOOPBACK.test(hostname)

/**
 * Checks that `devtoolsApiUrl` is a plain `https://` URL (or `http://` on a
 * loopback host, for local development) before it is embedded in deployment
 * code. Throws without echoing the input.
 */
export function validateDevtoolsApiUrl(devtoolsApiUrl: string): string {
  if (typeof devtoolsApiUrl !== 'string' || devtoolsApiUrl.trim() === '') {
    throw new Error('Invalid devtools API URL: expected a non-empty https:// URL.')
  }

  let url: URL
  try {
    url = new URL(devtoolsApiUrl)
  } catch {
    throw new Error('Invalid devtools API URL: not a valid URL. Expected an https:// URL.')
  }

  const secure = url.protocol === 'https:'
  const localPlaintext = url.protocol === 'http:' && isLoopbackHost(url.hostname)
  if (!secure && !localPlaintext) {
    throw new Error(
      'Invalid devtools API URL: expected an https:// URL (http:// is only allowed for localhost).',
    )
  }
  if (!HOSTNAME.test(url.hostname) && !IPV6_HOSTNAME.test(url.hostname)) {
    throw new Error('Invalid devtools API URL: the host contains unsupported characters.')
  }
  if (url.username !== '' || url.password !== '') {
    throw new Error('Invalid devtools API URL: credentials in the URL are not allowed.')
  }
  if (url.search !== '' || url.hash !== '') {
    throw new Error('Invalid devtools API URL: query strings and fragments are not allowed.')
  }

  return devtoolsApiUrl
}

/**
 * Reads the compiled `devtools-snippet.js` bundled with this package, fills
 * in the devtools API URL placeholder, and prepends it to the entrypoint
 * file inside the zip bundle at `zipPath`.
 *
 * `snippetDir` defaults to the directory of this compiled module (so the
 * function is self-contained in most cases) but can be overridden for tests
 * or unusual build layouts.
 */
export async function injectDevtoolsSnippet(
  zipPath: string,
  entrypoint: string,
  devtoolsApiUrl: string,
  snippetDir?: string,
): Promise<string> {
  validateDevtoolsApiUrl(devtoolsApiUrl)

  const dir = snippetDir ?? selfDir()
  const snippetPath = join(dir, 'devtools-snippet.js')
  let snippet = readFileSync(snippetPath, 'utf-8')

  // Strip TSC module/sourcemap artifacts that shouldn't be in the injected snippet
  snippet = snippet
    .replace(/^export\s*\{\s*\}\s*;?\s*$/m, '')
    .replace(/^\/\/#\s*sourceMappingURL=.*$/m, '')
    .trim()

  // Replace the whole quoted literal with a JSON string literal, through a
  // replacer function so `$&`, `$'` and friends in the URL are not expanded.
  const literal = JSON.stringify(devtoolsApiUrl)
  snippet = snippet.replace(/(['"])__DEVTOOLS_API_URL__\1/g, () => literal)
  if (snippet.includes('__DEVTOOLS_API_URL__')) {
    throw new Error('devtools snippet contains an unquoted API URL placeholder')
  }

  const zip = new AdmZip(zipPath)
  const entry = zip.getEntry(entrypoint)

  if (!entry) {
    throw new Error(
      `Could not find entrypoint "${entrypoint}" in bundle to inject devtools snippet`,
    )
  }

  const originalContent = entry.getData().toString('utf-8')
  const injectedContent = snippet + '\n' + originalContent

  zip.updateFile(entrypoint, Buffer.from(injectedContent, 'utf-8'))
  zip.writeZip(zipPath)

  return zipPath
}
