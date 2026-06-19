import type { RestartPolicy } from '../types/project.js'

/**
 * Build the `manifest.json` that ships inside every deployment bundle.
 *
 * Pure + browser-safe (no `fs`/`adm-zip`), so both the Node bundler
 * ([bundle.ts](./bundle.ts)) and the browser bundler
 * ([bundle.browser.ts](./bundle.browser.ts)) produce an identical manifest.
 */
export const createManifest = (
  name: string,
  entrypoint: string,
  restartPolicy: RestartPolicy,
  image?: { url: string; sha256: string },
): string => {
  const manifest: Record<string, unknown> = {
    name,
    version: 1,
    entrypoint,
    restartPolicy,
  }
  if (image != null) {
    manifest.image = image
  }
  return JSON.stringify(manifest)
}
