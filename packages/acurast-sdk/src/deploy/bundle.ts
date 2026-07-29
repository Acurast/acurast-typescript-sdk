import AdmZip from 'adm-zip'
import { existsSync, mkdirSync, statSync } from 'fs'
import { NOOP_LOGGER, type Logger } from './logger.js'

export { createManifest } from './manifest.js'

export const checkIsFolder = async (path: string): Promise<boolean> => {
  const stats = statSync(path)
  return stats.isDirectory()
}

export const zipFolder = async (
  input: string,
  outputFolder: string,
  manifest: string,
  deploymentName: string,
  logger: Logger = NOOP_LOGGER,
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
    zip.addLocalFolder(input)
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
