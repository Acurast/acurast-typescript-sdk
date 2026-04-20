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
  const tempFile = 'temp_script.js'

  if ('file' in input) {
    fs.copyFileSync(input.file, tempFile)
  } else {
    fs.writeFileSync(tempFile, Buffer.from(input.script, 'utf-8'))
  }

  const form = new FormDataModule()
  form.append('file', fs.createReadStream(tempFile), 'script.js')
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

    fs.unlinkSync(tempFile)

    return `ipfs://${res.data.IpfsHash}`
  } catch (error) {
    fs.unlinkSync(tempFile)
    throw error
  }
}
