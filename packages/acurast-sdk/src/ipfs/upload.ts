import axios from 'axios'
import FormDataModule from 'form-data'
import fs from 'fs'
import { checkPinnedCid } from './cid.js'
import { describeResponseBody, uploadFailedError } from './upload-error.js'

export interface IpfsUploadOptions {
  /** Base URL of the pinning service (e.g. a Pinata gateway). */
  endpoint: string
  /** Bearer token for the pinning service. */
  apiKey: string
  /**
   * Check the CID returned by the pinning service against a CIDv0 computed
   * locally from the uploaded bytes, and reject the upload on mismatch.
   * Defaults to `true`.
   *
   * The local computation assumes the kubo importer defaults that a
   * `cidVersion: 0` upload uses (dag-pb UnixFS file, 262144-byte chunks,
   * balanced DAG with 174 links per node, no raw leaves, sha2-256). Set this
   * to `false` only for a pinning service known to build a different DAG
   * layout; the response is then still required to contain a well-formed CID.
   */
  verifyCid?: boolean
}

export type UploadScriptInput = { file: string } | { script: string }

/**
 * Pin a JS bundle to IPFS and return an `ipfs://<cid>` URI.
 *
 * The CID in the pinning service's response must be well formed and, unless
 * `options.verifyCid` is `false`, equal to the CIDv0 of the uploaded bytes
 * (see {@link computeCidV0}); otherwise this throws.
 *
 * A failed request rejects with an `Error` that carries the HTTP status and a
 * short description, but never the request configuration or the API key.
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

  let res
  try {
    res = await axios.post<{ IpfsHash: string }>(
      `${options.endpoint}/pinning/pinFileToIPFS`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${options.apiKey}`,
        },
      },
    )
  } catch (error) {
    // Never rethrow the AxiosError: its config (and `toJSON()` / inspect
    // output) contains the Authorization header with the API key.
    if (axios.isAxiosError(error)) {
      if (error.response) {
        throw uploadFailedError(
          options.apiKey,
          error.response.status,
          error.response.status,
          error.response.statusText,
          describeResponseBody(error.response.data),
        )
      }
      throw uploadFailedError(options.apiKey, undefined, error.code, error.message)
    }
    throw uploadFailedError(
      options.apiKey,
      undefined,
      error instanceof Error ? error.message : 'unknown error',
    )
  }

  return checkPinnedCid(res.data, content, options.verifyCid ?? true)
}
