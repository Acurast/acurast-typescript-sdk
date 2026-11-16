import axios from 'axios'
import FormDataModule from 'form-data'
import fs from 'fs'

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
): Promise<string> => {
  // Read the content into memory instead of staging it in a temp file: a
  // fixed temp path is shared by concurrent calls, which then upload each
  // other's content.
  const content: Buffer =
    'file' in input ? fs.readFileSync(input.file) : Buffer.from(input.script, 'utf-8')

  const form = new FormDataModule()
  form.append('file', content, 'script.js')
  form.append('pinataOptions', '{"cidVersion": 0}')
  form.append('pinataMetadata', '{"name": "script.js"}')

  try {
    const res = await axios.post<{ IpfsHash: string }>(
      `${options.endpoint}/pinning/pinFileToIPFS`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${options.apiKey}`,
        },
      },
    )

    return `ipfs://${res.data.IpfsHash}`
  } catch (error) {
    throw error
  }
}
