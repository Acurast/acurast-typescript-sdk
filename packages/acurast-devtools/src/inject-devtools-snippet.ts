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
  const dir = snippetDir ?? selfDir()
  const snippetPath = join(dir, 'devtools-snippet.js')
  let snippet = readFileSync(snippetPath, 'utf-8')

  // Strip TSC module/sourcemap artifacts that shouldn't be in the injected snippet
  snippet = snippet
    .replace(/^export\s*\{\s*\}\s*;?\s*$/m, '')
    .replace(/^\/\/#\s*sourceMappingURL=.*$/m, '')
    .trim()

  snippet = snippet.replace(/__DEVTOOLS_API_URL__/g, devtoolsApiUrl)

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
