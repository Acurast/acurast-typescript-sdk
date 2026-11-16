import { deviceVersions, fetchDeviceVersions } from '../src/chain/app-versions.js'

const snapshot = () => new Map([...deviceVersions].map(([platform, m]) => [platform, new Map(m)]))

describe('fetchDeviceVersions', () => {
  let original: ReturnType<typeof snapshot>
  const realFetch = globalThis.fetch

  beforeEach(() => {
    original = snapshot()
  })

  afterEach(() => {
    globalThis.fetch = realFetch
    deviceVersions.clear()
    for (const [platform, m] of original) deviceVersions.set(platform, m)
  })

  const serve = (body: unknown) => {
    globalThis.fetch = jest.fn(async () => new Response(JSON.stringify(body))) as typeof fetch
  }

  it('adds newer builds with well-formed version strings', async () => {
    serve({ '0': { '74': '1.14.0-rc1', '75': '1.14.0' }, '1': { '10': '1.0.0' } })
    await fetchDeviceVersions('https://example.invalid/versions.json')
    expect(deviceVersions.get(0)?.get(74)).toBe('1.14.0-rc1')
    expect(deviceVersions.get(0)?.get(75)).toBe('1.14.0')
    expect(deviceVersions.get(1)?.get(10)).toBe('1.0.0')
  })

  it('does not overwrite bundled entries or redirect a known version string', async () => {
    serve({
      '0': {
        '18': '1.13.0', // overwrite an old build with a newer version string
        '73': '0.0.1', // overwrite the newest bundled build
        '5': '9.9.9', // an older build number than any known build
        '80': '1.13.0', // a known version string on a new build
      },
    })
    await fetchDeviceVersions('https://example.invalid/versions.json')
    const android = deviceVersions.get(0)!
    expect(android.get(18)).toBe('1.3.33')
    expect(android.get(73)).toBe('1.13.0')
    expect(android.has(5)).toBe(false)
    expect(android.has(80)).toBe(false)
  })

  it('ignores malformed keys and values', async () => {
    serve({
      '0': { '90': '1.15.0; rm -rf', '91': 42, abc: '1.15.0', '-1': '1.15.1', '1e3': '1.15.2' },
      x: { '1': '1.0.0' },
      '2': 'not-an-object',
    })
    await fetchDeviceVersions('https://example.invalid/versions.json')
    expect(deviceVersions.get(0)).toEqual(original.get(0))
    expect([...deviceVersions.keys()].sort()).toEqual([...original.keys()].sort())
  })

  it('rejects a response that is not an object', async () => {
    serve(['1.0.0'])
    await expect(fetchDeviceVersions('https://example.invalid/versions.json')).rejects.toThrow(
      'unexpected response format',
    )
  })
})
