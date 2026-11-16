import fs from 'fs'
import http from 'http'
import type { AddressInfo } from 'net'
import os from 'os'
import path from 'path'
import { uploadScript } from '../src/ipfs/upload.js'

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

type Responder = (content: Buffer) => unknown

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
      setTimeout(() => {
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(respond(content)))
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

describe('uploadScript', () => {
  let tmpDir: string
  let server: Awaited<ReturnType<typeof startServer>>
  // Echo back an identifier derived from the received content so each caller
  // can be matched to what the server actually got.
  const echo: Responder = (content) => ({ IpfsHash: `echo:${content.toString('utf8')}` })

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acurast-ipfs-test-'))
  })

  afterEach(async () => {
    await server?.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns each concurrent caller the result for its own content and writes no temp file', async () => {
    server = await startServer(echo)
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

    expect(a).toBe('ipfs://echo:console.log("A")')
    expect(b).toBe('ipfs://echo:console.log("B")')
    expect(c).toBe('ipfs://echo:console.log("C")')
    expect(server.received.map((r) => r.toString('utf8')).sort()).toEqual([
      'console.log("A")',
      'console.log("B")',
      'console.log("C")',
    ])

    expect(fs.existsSync(path.join(process.cwd(), 'temp_script.js'))).toBe(false)
    expect(fs.readdirSync(process.cwd()).sort()).toEqual(cwdBefore)
  })

  it('does not touch an existing temp_script.js in the working directory', async () => {
    server = await startServer(echo)
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
})
