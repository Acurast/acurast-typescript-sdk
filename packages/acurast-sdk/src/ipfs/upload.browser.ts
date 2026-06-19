import type { IpfsUploadOptions } from './upload.js'

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
    throw new Error(`IPFS upload failed: ${res.status} ${res.statusText} ${detail}`)
  }

  const data = (await res.json()) as { IpfsHash: string }
  return `ipfs://${data.IpfsHash}`
}
