import JSZip from 'jszip'
import { RestartPolicy } from '../types/project.js'
import { createManifest } from './manifest.js'

/** Project files keyed by their in-bundle path (e.g. `index.js`). */
export type BrowserBundleFiles = Record<string, string | Uint8Array>

/**
 * Fixed DOS-epoch timestamp applied to every zip entry so identical inputs
 * produce deterministic bytes. Mirrors the Node bundler
 * ([bundle.ts](./bundle.ts)) which sets `entry.header.time` to the same value.
 *
 * NOTE: byte-for-byte CID parity with the Node (adm-zip) bundler is NOT
 * guaranteed — deflate output and zip extra-fields differ between
 * implementations. The fixed date makes each bundler individually
 * deterministic; cross-bundler CID equality must be verified, not assumed.
 */
const ZIP_DATE = new Date('1980-01-01T00:00:00.000Z')

export interface ZipProjectOptions {
  projectName: string
  entrypoint: string
  restartPolicy?: RestartPolicy
  image?: { url: string; sha256: string }
}

/**
 * Bundle in-memory project files + a `manifest.json` into a zip `Blob`,
 * ready for {@link uploadBlob}. Browser counterpart of `zipFolder`.
 */
export const zipProjectBrowser = async (
  files: BrowserBundleFiles,
  options: ZipProjectOptions,
): Promise<Blob> => {
  const zip = new JSZip()

  const manifest = createManifest(
    options.projectName,
    options.entrypoint,
    options.restartPolicy ?? RestartPolicy.OnFailure,
    options.image,
  )
  zip.file('manifest.json', manifest, { date: ZIP_DATE })

  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content, { date: ZIP_DATE })
  }

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  })
}
