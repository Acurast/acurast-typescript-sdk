import AdmZip from 'adm-zip'
import { existsSync, mkdirSync, statSync } from 'fs'
import type { RestartPolicy } from '../types/project.js'
import { NOOP_LOGGER, type Logger } from './logger.js'

export const checkIsFolder = async (path: string): Promise<boolean> => {
  const stats = statSync(path)
  return stats.isDirectory()
}

export const createManifest = (
  name: string,
  entrypoint: string,
  restartPolicy: RestartPolicy
): string => {
  return JSON.stringify({
    name,
    version: 1,
    entrypoint,
    restartPolicy,
  })
}

export const zipFolder = async (
  input: string,
  outputFolder: string,
  manifest: string,
  deploymentName: string,
  logger: Logger = NOOP_LOGGER
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

  zip.writeZip(zipPath, (error) => {
    if (error) {
      logger.error(`Error writing zip file: ${error.name} ${error.message}`)
    }
  })

  return { zipPath }
}
