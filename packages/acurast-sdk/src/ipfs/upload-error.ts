/**
 * Error construction for failed pinning-service requests.
 *
 * The request carries `Authorization: Bearer <apiKey>`. HTTP client errors
 * (e.g. an `AxiosError`) keep the request config, including that header, so
 * rethrowing them hands the API key to anything that logs the error. Upload
 * failures are therefore reported as a plain `Error` that carries only the
 * HTTP status and a short, redacted description, with no `cause`.
 *
 * Browser-safe: no Node-only imports.
 */

/** Longest response-body excerpt included in an error message. */
const MAX_DETAIL_LENGTH = 300

/** Keys shorter than this are not redacted, so short test keys do not mangle messages. */
const MIN_REDACTED_KEY_LENGTH = 8

const REDACTED = '[redacted]'

/** Removes `apiKey` from `text` (the pinning service may echo the header back). */
export const redactApiKey = (text: string, apiKey: string | undefined): string => {
  if (typeof apiKey !== 'string' || apiKey.length < MIN_REDACTED_KEY_LENGTH) return text
  return text.split(apiKey).join(REDACTED)
}

/** Renders a response body as a single, bounded line of text. */
export const describeResponseBody = (body: unknown): string => {
  let text: string
  if (body == null) {
    text = ''
  } else if (typeof body === 'string') {
    text = body
  } else {
    try {
      text = JSON.stringify(body) ?? ''
    } catch {
      text = ''
    }
  }
  text = text.replace(/\s+/g, ' ').trim()
  return text.length > MAX_DETAIL_LENGTH ? `${text.slice(0, MAX_DETAIL_LENGTH)}...` : text
}

/** Error thrown when the pinning service request fails. */
export class IpfsUploadError extends Error {
  /** HTTP status of the pinning service response, if one was received. */
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'IpfsUploadError'
    if (status !== undefined) this.status = status
  }
}

/**
 * Builds the error for a failed upload. `parts` are joined with spaces and
 * redacted; nothing else from the original failure is retained.
 */
export const uploadFailedError = (
  apiKey: string | undefined,
  status: number | undefined,
  ...parts: Array<string | number | undefined>
): IpfsUploadError => {
  const text = parts
    .filter((p) => p !== undefined && p !== '')
    .join(' ')
    .trim()
  return new IpfsUploadError(redactApiKey(`IPFS upload failed: ${text}`.trim(), apiKey), status)
}
