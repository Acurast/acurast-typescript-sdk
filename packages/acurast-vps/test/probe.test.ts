import net from 'node:net'
import type { AddressInfo } from 'node:net'
import { isVpsDomain, probeVpsReady } from '../src/probe.js'

/** Local TCP listener that records every connection it receives. */
const startListener = async () => {
  let connections = 0
  const server = net.createServer((socket) => {
    connections++
    socket.end('SSH-2.0-test\r\n')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  return {
    port: (server.address() as AddressInfo).port,
    connections: () => connections,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

describe('isVpsDomain', () => {
  it.each(['0123456789abcdef.acu.run', 'deadbeefdeadbeef.canary.acu.run'])('accepts %p', (d) => {
    expect(isVpsDomain(d)).toBe(true)
  })

  it.each([
    '127.0.0.1',
    'localhost',
    'internal.example.com',
    'acu.run',
    '0123456789abcde.acu.run', // 15 hex digits
    '0123456789abcdef0.acu.run', // 17 hex digits
    '0123456789ABCDEF.acu.run',
    '0123456789abcdeg.acu.run',
    'x.0123456789abcdef.acu.run',
    '0123456789abcdef.acu.run.evil.com',
    '0123456789abcdef.acu.run.',
    '0123456789abcdef.other.acu.run',
    '0123456789abcdef.acu.run:22',
    '',
  ])('rejects %p', (d) => {
    expect(isVpsDomain(d)).toBe(false)
  })
})

describe('probeVpsReady', () => {
  let listener: Awaited<ReturnType<typeof startListener>>

  beforeEach(async () => {
    listener = await startListener()
  })

  afterEach(async () => {
    await listener.close()
  })

  it.each(['127.0.0.1', 'localhost'])('does not connect to the non-VPS host %p', async (host) => {
    const result = await probeVpsReady(host, { port: listener.port, timeoutMs: 1_000 })
    expect(result.ready).toBe(false)
    expect(result.error).toContain('invalid domain')
    expect(result.error).not.toContain(host)
    expect(listener.connections()).toBe(0)
  })

  it('rejects any port other than 443 for a VPS domain without connecting', async () => {
    const result = await probeVpsReady('0123456789abcdef.acu.run', { port: 22, timeoutMs: 1_000 })
    expect(result).toEqual({ ready: false, error: 'invalid port: only 443 is allowed' })
  })
})
