import fs from 'fs'
import http from 'http'
import type { AddressInfo } from 'net'
import os from 'os'
import path from 'path'
import util from 'util'
import { computeCidV0 } from '../src/ipfs/cid.js'
import { uploadScript } from '../src/ipfs/upload.js'
import { uploadBlob } from '../src/ipfs/upload.browser.js'

/** Extract the bytes of the `file` part from a multipart/form-data body. */
const extractFilePart = (body: Buffer, contentType: string): Buffer => {
  const boundary = /boundary=(.+)$/.exec(contentType)?.[1]
  if (!boundary) throw new Error('no multipart boundary')
  const delimiter = Buffer.from(`--${boundary}`)
  let start = body.indexOf(delimiter)
  while (start !== -1) {
    const next = body.indexOf(delimiter, start + delimiter.length)
    if (next === -1) break
    const part = body.subarray(start + delimiter.length + 2, next - 2) // strip CRLFs
    const headerEnd = part.indexOf('\r\n\r\n')
    const headers = part.subarray(0, headerEnd).toString('utf8')
    if (/name="file"/.test(headers)) return part.subarray(headerEnd + 4)
    start = next
  }
  throw new Error('no file part')
}

type Responder = (content: Buffer) => unknown | Promise<unknown>

/**
 * Local stand-in for the pinning service. Responses are delayed so that
 * concurrent uploads overlap.
 */
const startServer = async (respond: Responder) => {
  const received: Buffer[] = []
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      const content = extractFilePart(Buffer.concat(chunks), req.headers['content-type'] ?? '')
      received.push(content)
      setTimeout(async () => {
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(await respond(content)))
      }, 50)
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    endpoint: `http://127.0.0.1:${port}`,
    received,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

// Behaves like an honest pinning service: returns the CID of what it received,
// so each caller can be matched to the content the server actually got.
const honest: Responder = async (content) => ({ IpfsHash: await computeCidV0(content) })
const cidOf = async (text: string) => `ipfs://${await computeCidV0(Buffer.from(text, 'utf8'))}`

const OTHER_CID = 'QmbFMke1KXqnYyBBWxB74N4c5SBnJMVAiMNRcGu6x1AwQH' // empty file

let server: Awaited<ReturnType<typeof startServer>> | undefined

afterEach(async () => {
  await server?.close()
  server = undefined
})

describe('uploadScript', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acurast-ipfs-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns each concurrent caller the result for its own content and writes no temp file', async () => {
    server = await startServer(honest)
    const fileA = path.join(tmpDir, 'a.js')
    const fileB = path.join(tmpDir, 'b.js')
    fs.writeFileSync(fileA, 'console.log("A")')
    fs.writeFileSync(fileB, 'console.log("B")')

    const cwdBefore = fs.readdirSync(process.cwd()).sort()
    const options = { endpoint: server.endpoint, apiKey: 'test-key' }

    const [a, b, c] = await Promise.all([
      uploadScript({ file: fileA }, options),
      uploadScript({ file: fileB }, options),
      uploadScript({ script: 'console.log("C")' }, options),
    ])

    expect(a).toBe(await cidOf('console.log("A")'))
    expect(b).toBe(await cidOf('console.log("B")'))
    expect(c).toBe(await cidOf('console.log("C")'))
    expect(server.received.map((r) => r.toString('utf8')).sort()).toEqual([
      'console.log("A")',
      'console.log("B")',
      'console.log("C")',
    ])

    expect(fs.existsSync(path.join(process.cwd(), 'temp_script.js'))).toBe(false)
    expect(fs.readdirSync(process.cwd()).sort()).toEqual(cwdBefore)
  })

  it('does not touch an existing temp_script.js in the working directory', async () => {
    server = await startServer(honest)
    const cwd = process.cwd()
    process.chdir(tmpDir)
    try {
      fs.writeFileSync('temp_script.js', 'user content')
      await uploadScript({ script: 'x' }, { endpoint: server.endpoint, apiKey: 'k' })
      expect(fs.readFileSync('temp_script.js', 'utf8')).toBe('user content')
    } finally {
      process.chdir(cwd)
    }
  })

  it('rejects a response without a CID', async () => {
    server = await startServer(() => ({}))
    await expect(
      uploadScript({ script: 'x' }, { endpoint: server.endpoint, apiKey: 'k' }),
    ).rejects.toThrow('did not return a valid CID')
  })

  it('rejects a malformed CID even with verifyCid: false', async () => {
    server = await startServer(() => ({ IpfsHash: 'not-a-cid' }))
    await expect(
      uploadScript({ script: 'x' }, { endpoint: server.endpoint, apiKey: 'k', verifyCid: false }),
    ).rejects.toThrow('did not return a valid CID')
  })

  it('rejects a CID that does not match the uploaded content', async () => {
    server = await startServer(() => ({ IpfsHash: OTHER_CID }))
    await expect(
      uploadScript({ script: 'x' }, { endpoint: server.endpoint, apiKey: 'k' }),
    ).rejects.toThrow(`returned CID ${OTHER_CID}, but the uploaded content has CID`)
  })

  it('returns the service CID unchecked with verifyCid: false', async () => {
    server = await startServer(() => ({ IpfsHash: OTHER_CID }))
    await expect(
      uploadScript({ script: 'x' }, { endpoint: server.endpoint, apiKey: 'k', verifyCid: false }),
    ).resolves.toBe(`ipfs://${OTHER_CID}`)
  })
})

describe('uploadBlob', () => {
  const blob = new Blob(['console.log("browser")'])

  it('returns the CID when it matches the uploaded blob', async () => {
    server = await startServer(honest)
    await expect(uploadBlob(blob, { endpoint: server.endpoint, apiKey: 'k' })).resolves.toBe(
      await cidOf('console.log("browser")'),
    )
  })

  it('rejects a response without a CID', async () => {
    server = await startServer(() => ({ IpfsHash: undefined }))
    await expect(uploadBlob(blob, { endpoint: server.endpoint, apiKey: 'k' })).rejects.toThrow(
      'did not return a valid CID',
    )
  })

  it('rejects a mismatching CID unless verifyCid is false', async () => {
    server = await startServer(() => ({ IpfsHash: OTHER_CID }))
    await expect(uploadBlob(blob, { endpoint: server.endpoint, apiKey: 'k' })).rejects.toThrow(
      'but the uploaded content has CID',
    )
    await expect(
      uploadBlob(blob, { endpoint: server.endpoint, apiKey: 'k', verifyCid: false }),
    ).resolves.toBe(`ipfs://${OTHER_CID}`)
  })
})

describe('upload errors do not leak the API key', () => {
  const API_KEY = 'secret-pinning-token-0123456789abcdef'

  /** Pinning service stand-in that rejects every request, echoing the Authorization header. */
  const startRejectingServer = async (status: number) => {
    const httpServer = http.createServer((req, res) => {
      req.resume()
      req.on('end', () => {
        res.statusCode = status
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ error: 'denied', echoed: req.headers.authorization }))
      })
    })
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve))
    const { port } = httpServer.address() as AddressInfo
    return {
      endpoint: `http://127.0.0.1:${port}`,
      received: [],
      close: () => new Promise<void>((resolve) => httpServer.close(() => resolve())),
    }
  }

  /** An endpoint on a port nothing listens on. */
  const closedEndpoint = async (): Promise<string> => {
    const probe = http.createServer()
    await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve))
    const { port } = probe.address() as AddressInfo
    await new Promise<void>((resolve) => probe.close(() => resolve()))
    return `http://127.0.0.1:${port}`
  }

  const catchError = async (promise: Promise<unknown>): Promise<any> => {
    try {
      await promise
    } catch (error) {
      return error
    }
    throw new Error('expected a rejection')
  }

  const expectNoSecret = (error: any) => {
    expect(error).toBeInstanceOf(Error)
    expect(error.cause).toBeUndefined()
    expect(error.config).toBeUndefined()
    expect(error.request).toBeUndefined()
    expect(error.response).toBeUndefined()
    const renderings = [
      String(error),
      error.message,
      error.stack ?? '',
      JSON.stringify(error),
      JSON.stringify(error, Object.getOwnPropertyNames(error)),
      util.inspect(error, { depth: Infinity, showHidden: true }),
    ]
    for (const text of renderings) {
      expect(text).not.toContain(API_KEY)
      expect(text).not.toContain('Authorization')
    }
  }

  it('uploadScript reports the status of a rejected request without the token', async () => {
    server = await startRejectingServer(401)
    const error = await catchError(
      uploadScript({ script: 'x' }, { endpoint: server.endpoint, apiKey: API_KEY }),
    )
    expectNoSecret(error)
    expect(error.message).toContain('IPFS upload failed: 401 Unauthorized')
    expect(error.message).toContain('denied')
    // The service echoed the header back; the key is redacted from the excerpt.
    expect(error.message).toContain('Bearer [redacted]')
    expect(error.status).toBe(401)
  })

  it('uploadScript reports a network failure without the token', async () => {
    const error = await catchError(
      uploadScript({ script: 'x' }, { endpoint: await closedEndpoint(), apiKey: API_KEY }),
    )
    expectNoSecret(error)
    expect(error.message).toContain('IPFS upload failed: ECONNREFUSED')
    expect(error.status).toBeUndefined()
  })

  it('uploadBlob reports the status of a rejected request without the token', async () => {
    server = await startRejectingServer(403)
    const error = await catchError(
      uploadBlob(new Blob(['x']), { endpoint: server.endpoint, apiKey: API_KEY }),
    )
    expectNoSecret(error)
    expect(error.message).toContain('IPFS upload failed: 403 Forbidden')
    expect(error.message).toContain('denied')
    expect(error.status).toBe(403)
  })
})
