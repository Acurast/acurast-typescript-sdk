import AdmZip from 'adm-zip'
import { existsSync, mkdirSync, statSync } from 'fs'
import { NOOP_LOGGER, type Logger } from './logger.js'

export { createManifest } from './manifest.js'

/** Options controlling which files {@link zipFolder} puts into a bundle. */
export interface ZipFolderOptions {
  /**
   * Include files and folders whose name starts with `.` (e.g. `.env`,
   * `.git/`, `.npmrc`, `.acurast/`). Defaults to `false`: bundles are pinned
   * publicly on IPFS, so dotfiles are left out unless explicitly requested.
   */
  includeDotfiles?: boolean
  /**
   * Additional exclusion predicate. Called with a path relative to the input
   * folder, using `/` as separator and without a trailing slash, for every
   * file and folder, and also for each of its parent folders. Returning `true`
   * excludes that entry (a folder excludes everything below it), e.g.
   * `exclude: (p) => p === 'node_modules'`.
   */
  exclude?: (relPath: string) => boolean
}

export const checkIsFolder = async (path: string): Promise<boolean> => {
  const stats = statSync(path)
  return stats.isDirectory()
}

/**
 * Bundle `input` (a file or a folder) together with `manifest` into
 * `<outputFolder>/<deploymentName>.zip`.
 *
 * When `input` is a folder, dotfiles and dot-folders are excluded by default
 * (see {@link ZipFolderOptions}); a warning lists what was left out.
 * `node_modules` is not excluded by default because some runtimes ship it;
 * use `options.exclude` to drop it.
 */
export const zipFolder = async (
  input: string,
  outputFolder: string,
  manifest: string,
  deploymentName: string,
  logger: Logger = NOOP_LOGGER,
  options: ZipFolderOptions = {},
): Promise<{ zipPath: string }> => {
  if (!existsSync(input)) {
    throw new Error(`Input folder ${input} does not exist`)
  }

  mkdirSync(outputFolder, { recursive: true })

  const zip = new AdmZip()

  // Fixed timestamp so that identical inputs produce byte-identical zips
  // (and therefore identical IPFS CIDs). Zip stores DOS timestamps whose
  // epoch is 1980-01-01.
  const CREATED_AT = new Date('1980-01-01T00:00:00.000Z')

  zip.addFile('manifest.json', Buffer.from(manifest, 'utf8'))

  const stats = statSync(input)
  if (stats.isFile()) {
    zip.addLocalFile(input)
  } else {
    const isExcluded = (segments: string[]): boolean => {
      for (let i = 0; i < segments.length; i++) {
        if (!options.includeDotfiles && segments[i].startsWith('.')) return true
        if (options.exclude?.(segments.slice(0, i + 1).join('/'))) return true
      }
      return false
    }

    const excluded: string[] = []
    // adm-zip calls the filter for every file and folder below `input`, with a
    // path relative to `input` that uses OS separators (folders end with one).
    zip.addLocalFolder(input, undefined, (relPath: string) => {
      const segments = relPath.split(/[\\/]/).filter((s) => s !== '')
      if (isExcluded(segments)) {
        excluded.push(segments.join('/'))
        return false
      }
      logger.debug(`bundling: ${segments.join('/')}`)
      return true
    })

    // Report only the topmost excluded paths (not every file inside `.git/`).
    const excludedSet = new Set(excluded)
    const topLevelExcluded = excluded.filter((p) => {
      const segments = p.split('/')
      for (let i = 1; i < segments.length; i++) {
        if (excludedSet.has(segments.slice(0, i).join('/'))) return false
      }
      return true
    })
    if (topLevelExcluded.length > 0) {
      logger.warn(
        `Excluded from the bundle: ${topLevelExcluded.join(', ')}` +
          (options.includeDotfiles
            ? ''
            : ' (dotfiles are excluded by default; set includeDotfiles to include them)'),
      )
    }
  }

  zip.getEntries().forEach((entry) => {
    entry.header.time = CREATED_AT
  })

  const zipPath = `${outputFolder}/${deploymentName}.zip`
  logger.debug(`zipPath: ${zipPath}`)

  // Write synchronously. The callback form of writeZip is asynchronous, and
  // this function returned before it finished — callers that then read or
  // transform the zip (e.g. injecting the devtools snippet) raced the write,
  // and since the path is reused across deploys they operated on stale content
  // that the pending write then overwrote. The synchronous form guarantees the
  // file is complete before we return, and throws on error rather than logging.
  zip.writeZip(zipPath)

  return { zipPath }
}
