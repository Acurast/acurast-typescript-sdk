import type { IpfsUploadOptions } from './upload.js'
import { checkPinnedCid } from './cid.js'
import { describeResponseBody, uploadFailedError } from './upload-error.js'

// Re-export the shared option/type shape. `import type` is fully erased at
// build time, so pulling it from the Node module here does NOT drag `fs` /
// `form-data` into the browser bundle.
export type { IpfsUploadOptions } from './upload.js'

/**
 * Pin a deployment bundle (a `Blob`) to IPFS from the browser and return an
 * `ipfs://<cid>` URI.
 *
 * Browser-native counterpart of the Node `uploadScript`: uses `fetch` + the
 * browser `FormData`/`Blob` APIs instead of `axios` + `form-data` + `fs`. The
 * Pinata-style request shape (field name, `pinataOptions`, filename) is kept
 * identical so the same pinning endpoint works for both.
 *
 * As with `uploadScript`, the returned CID must be well formed and, unless
 * `options.verifyCid` is `false`, match the CIDv0 computed locally from `blob`.
 */
export const uploadBlob = async (blob: Blob, options: IpfsUploadOptions): Promise<string> => {
  const form = new FormData()
  form.append('file', blob, 'script.js')
  form.append('pinataOptions', '{"cidVersion": 0}')
  form.append('pinataMetadata', '{"name": "script.js"}')

  const headers: Record<string, string> = {}
  if (options.apiKey) {
    headers['Authorization'] = `Bearer ${options.apiKey}`
  }

  const res = await fetch(`${options.endpoint}/pinning/pinFileToIPFS`, {
    method: 'POST',
    body: form,
    headers,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw uploadFailedError(
      options.apiKey,
      res.status,
      res.status,
      res.statusText,
      describeResponseBody(detail),
    )
  }

  const data: unknown = await res.json()
  return checkPinnedCid(data, new Uint8Array(await blob.arrayBuffer()), options.verifyCid ?? true)
}
