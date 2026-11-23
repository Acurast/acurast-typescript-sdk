import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { uploadScript } from '../src/ipfs/upload.js'
import { jsonRpcCall } from '../src/matcher/api.js'

let base: string
let upload: { auth?: string; body: string }

const server = http.createServer(async (req, res) => {
  let body = ''
  for await (const chunk of req) body += chunk
  if (req.url === '/pinning/pinFileToIPFS') {
    upload = { auth: req.headers.authorization, body }
    return res.end(JSON.stringify({ IpfsHash: 'QmTest' }))
  }
  if (req.url === '/ok') return res.end(JSON.stringify({ result: { a: 1 } }))
  if (req.url === '/rpc-error') {
    return res.end(JSON.stringify({ error: { code: -32000, message: 'nope' } }))
  }
  if (req.url === '/hang') return
  res.writeHead(500).end('boom')
})

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(() => {
  server.closeAllConnections()
  server.close()
})

describe('jsonRpcCall', () => {
  it('returns the result', async () => {
    expect(await jsonRpcCall(`${base}/ok`, 'm', {})).toEqual({ ok: true, data: { a: 1 } })
  })

  it('maps a JSON-RPC error', async () => {
    expect(await jsonRpcCall(`${base}/rpc-error`, 'm', {})).toEqual({
      ok: false,
      error: 'nope',
      jsonRpcCode: -32000,
    })
  })

  it('reports a non-2xx status', async () => {
    expect(await jsonRpcCall(`${base}/500`, 'm', {})).toEqual({
      ok: false,
      error: 'Request failed with status code 500',
    })
  })

  it('reports a timeout', async () => {
    const timeout = AbortSignal.timeout.bind(AbortSignal)
    const spy = jest.spyOn(AbortSignal, 'timeout').mockImplementation(() => timeout(50))
    expect(await jsonRpcCall(`${base}/hang`, 'm', {})).toEqual({
      ok: false,
      error: 'Matcher API request timed out',
    })
    spy.mockRestore()
  })
})

describe('uploadScript', () => {
  it('sends the script as multipart with the API key', async () => {
    const uri = await uploadScript({ script: 'console.log(1)' }, { endpoint: base, apiKey: 'k' })
    expect(uri).toBe('ipfs://QmTest')
    expect(upload.auth).toBe('Bearer k')
    expect(upload.body).toContain(`name="file"; filename="script.js"`)
    expect(upload.body).toContain('console.log(1)')
    expect(upload.body).toContain(`{"cidVersion": 0}`)
  })

  it('throws on a non-2xx status', async () => {
    await expect(
      uploadScript({ script: 'x' }, { endpoint: `${base}/nope`, apiKey: 'k' }),
    ).rejects.toThrow('IPFS upload failed: 500')
  })
})
