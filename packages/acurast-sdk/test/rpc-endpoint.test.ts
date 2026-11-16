import { isLoopbackHost, validateRpcEndpoint } from '../src/chain/rpc-endpoint.js'
import { AcurastService } from '../src/chain/acurast-service.js'
import { setEnvVars } from '../src/chain/set-env-vars.js'
import { WsProvider } from '@polkadot/api'

// Replace the provider so no test ever opens a socket; record what it was given.
jest.mock('@polkadot/api', () => {
  const actual = jest.requireActual('@polkadot/api')
  return {
    ...actual,
    WsProvider: jest.fn().mockImplementation((endpoint: string) => ({ endpoint })),
  }
})

const wsProviderMock = WsProvider as unknown as jest.Mock

beforeEach(() => {
  wsProviderMock.mockClear()
})

describe('validateRpcEndpoint', () => {
  test.each([
    'wss://archive.mainnet.acurast.com',
    'wss://canary-ws.acurast.com/',
    'wss://rpc.example.com:9944/some/path',
    'WSS://RPC.EXAMPLE.COM',
    'wss://10.0.0.5:9944',
  ])('accepts secure endpoint %s and returns it unchanged', (endpoint) => {
    expect(validateRpcEndpoint(endpoint)).toBe(endpoint)
  })

  test.each([
    'ws://localhost:9944',
    'ws://LOCALHOST:9944',
    'ws://127.0.0.1:9944',
    'ws://127.1.2.3',
    'ws://127.1:9944', // normalised by URL to 127.0.0.1
    'ws://[::1]:9944',
    'ws://[0:0:0:0:0:0:0:1]:9944', // normalised by URL to [::1]
  ])('accepts plaintext loopback endpoint %s', (endpoint) => {
    expect(validateRpcEndpoint(endpoint)).toBe(endpoint)
  })

  test.each([
    'ws://archive.mainnet.acurast.com',
    'ws://10.0.0.5:9944',
    'ws://192.168.1.10:9944',
    'ws://0.0.0.0:9944',
    'ws://[::]:9944',
    'ws://[::ffff:7f00:1]:9944',
    'ws://localhost.evil.com:9944',
    'ws://127.0.0.1.evil.com:9944',
    'ws://evil.com/127.0.0.1',
    'ws://evil.com?host=localhost',
    'ws://sub.localhost:9944',
    'ws://128.0.0.1:9944',
  ])('rejects remote plaintext endpoint %s', (endpoint) => {
    expect(() => validateRpcEndpoint(endpoint)).toThrow(/Insecure RPC endpoint/)
  })

  test('allowInsecureRpcEndpoint permits remote plaintext ws://', () => {
    const endpoint = 'ws://rpc.internal.example:9944'
    expect(validateRpcEndpoint(endpoint, { allowInsecureRpcEndpoint: true })).toBe(endpoint)
    expect(() => validateRpcEndpoint(endpoint, { allowInsecureRpcEndpoint: false })).toThrow(
      /allowInsecureRpcEndpoint/,
    )
  })

  test.each([
    '',
    '   ',
    'not a url',
    'archive.mainnet.acurast.com',
    '//archive.mainnet.acurast.com',
    'wss//archive.mainnet.acurast.com',
  ])('rejects malformed endpoint %p', (endpoint) => {
    expect(() => validateRpcEndpoint(endpoint)).toThrow(/Invalid RPC endpoint/)
  })

  test('rejects non-string input', () => {
    expect(() => validateRpcEndpoint(undefined as unknown as string)).toThrow(
      /Invalid RPC endpoint/,
    )
  })

  test.each([
    'https://archive.mainnet.acurast.com',
    'http://localhost:9944',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'ftp://archive.mainnet.acurast.com',
  ])('rejects other scheme %s, even with the opt-in', (endpoint) => {
    expect(() => validateRpcEndpoint(endpoint)).toThrow(/unsupported scheme/)
    expect(() => validateRpcEndpoint(endpoint, { allowInsecureRpcEndpoint: true })).toThrow(
      /unsupported scheme/,
    )
  })

  test.each([
    'wss://alice:s3cr3t-pw@rpc.example.com',
    'wss://s3cr3t-pw@rpc.example.com',
    'ws://alice:s3cr3t-pw@localhost:9944',
    'wss://:s3cr3t-pw@rpc.example.com',
  ])('rejects credentials in %s without echoing them', (endpoint) => {
    let message = ''
    try {
      validateRpcEndpoint(endpoint, { allowInsecureRpcEndpoint: true })
    } catch (err) {
      message = (err as Error).message
    }
    expect(message).toMatch(/credentials in the URL are not allowed/)
    expect(message).not.toContain('s3cr3t-pw')
    expect(message).not.toContain('alice')
  })

  test('rejection messages leave out path, query and fragment', () => {
    const endpoint = 'ws://rpc.example.com:9944/key-in-path-123?apikey=s3cr3t#frag'
    let message = ''
    try {
      validateRpcEndpoint(endpoint)
    } catch (err) {
      message = (err as Error).message
    }
    expect(message).toContain('ws://rpc.example.com:9944')
    expect(message).not.toContain('key-in-path-123')
    expect(message).not.toContain('s3cr3t')
    expect(message).not.toContain('frag')
  })

  test('malformed-URL messages do not echo the input', () => {
    const endpoint = 'wss://user:s3cr3t@[bad'
    expect(() => validateRpcEndpoint(endpoint)).toThrow(/not a valid URL/)
    try {
      validateRpcEndpoint(endpoint)
    } catch (err) {
      expect((err as Error).message).not.toContain('s3cr3t')
    }
  })
})

describe('isLoopbackHost', () => {
  test.each(['localhost', '127.0.0.1', '127.255.255.254', '[::1]'])('%s is loopback', (h) => {
    expect(isLoopbackHost(h)).toBe(true)
  })

  test.each(['localhost.evil.com', '127.0.0.1.evil.com', '::1', '0.0.0.0', 'example.com'])(
    '%s is not loopback',
    (h) => {
      expect(isLoopbackHost(h)).toBe(false)
    },
  )
})

describe('AcurastService', () => {
  test('rejects an insecure endpoint before creating a provider', () => {
    expect(() => new AcurastService('ws://archive.mainnet.acurast.com')).toThrow(
      /Insecure RPC endpoint/,
    )
    expect(() => new AcurastService('wss://u:p@archive.mainnet.acurast.com')).toThrow(/credentials/)
    expect(wsProviderMock).not.toHaveBeenCalled()
  })

  test('accepts wss://, loopback ws:// and opted-in ws://', () => {
    new AcurastService('wss://archive.mainnet.acurast.com')
    new AcurastService('ws://127.0.0.1:9944')
    new AcurastService('ws://rpc.internal.example:9944', { allowInsecureRpcEndpoint: true })
    expect(wsProviderMock.mock.calls.map((call) => call[0])).toEqual([
      'wss://archive.mainnet.acurast.com',
      'ws://127.0.0.1:9944',
      'ws://rpc.internal.example:9944',
    ])
  })
})

describe('setEnvVars', () => {
  const job = {
    id: [{ acurast: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' }, 1],
    registration: {},
    envVars: [{ key: 'SECRET', value: 'value' }],
  } as any
  const wallet = {} as any

  test('rejects a remote ws:// endpoint before opening a connection', async () => {
    await expect(
      setEnvVars(job, { wallet, rpcEndpoint: 'ws://archive.mainnet.acurast.com' }),
    ).rejects.toThrow(/Insecure RPC endpoint/)
    expect(wsProviderMock).not.toHaveBeenCalled()
  })

  test('rejects an insecure endpoint even when there are no env vars', async () => {
    await expect(
      setEnvVars({ ...job, envVars: [] }, { wallet, rpcEndpoint: 'http://localhost:9944' }),
    ).rejects.toThrow(/unsupported scheme/)
    expect(wsProviderMock).not.toHaveBeenCalled()
  })

  test('passes the opt-in through to the service', async () => {
    // The mocked provider is not a working provider, so the single attempt fails
    // and setEnvVars gives up; what matters is that the provider was created.
    await expect(
      setEnvVars(job, {
        wallet,
        rpcEndpoint: 'ws://rpc.internal.example:9944',
        allowInsecureRpcEndpoint: true,
        maxRetries: 1,
        retryDelayMs: 0,
      }),
    ).rejects.toThrow(/gave up after 1 attempts/)
    expect(wsProviderMock.mock.calls.map((call) => call[0])).toEqual([
      'ws://rpc.internal.example:9944',
    ])
  })
})
