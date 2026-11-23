import fs from 'fs'

import { uploadBlob } from './upload.browser.js'

export interface IpfsUploadOptions {
  /** Base URL of the pinning service (e.g. a Pinata gateway). */
  endpoint: string
  /** Bearer token for the pinning service. */
  apiKey: string
}

export type UploadScriptInput = { file: string } | { script: string }

/**
 * Pin a JS bundle to IPFS and return an `ipfs://<cid>` URI.
 *
 * Endpoint and API key must be provided explicitly — this package never reads
 * `process.env`. Callers (e.g. the CLI) are responsible for sourcing the
 * values from their own configuration surface.
 */
export const uploadScript = async (
  input: UploadScriptInput,
  options: IpfsUploadOptions,
): Promise<string> =>
  uploadBlob('file' in input ? await fs.openAsBlob(input.file) : new Blob([input.script]), options)
