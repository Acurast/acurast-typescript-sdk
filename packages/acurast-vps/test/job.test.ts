import { generateKeyPairSync } from 'node:crypto'
import { buildVpsJob, TUNNEL_SCRIPT_IPFS } from '../src/job.js'
import type { VpsRequest } from '../src/types.js'

/** Builds an OpenSSH `ssh-ed25519` public key line for a fresh key. */
const ed25519Key = (comment = 'user@host'): string => {
  const { publicKey } = generateKeyPairSync('ed25519')
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32)
  const sshString = (b: Buffer) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(b.length)
    return Buffer.concat([len, b])
  }
  const blob = Buffer.concat([sshString(Buffer.from('ssh-ed25519')), sshString(raw)])
  return `ssh-ed25519 ${blob.toString('base64')}${comment ? ` ${comment}` : ''}`
}

const SSH_KEY = ed25519Key()

const request = (overrides: Partial<VpsRequest> = {}): VpsRequest => ({
  sshKey: SSH_KEY,
  reward: 1_000_000,
  maxExecutionTimeInMs: 3_600_000,
  ...overrides,
})

const env = (plan: ReturnType<typeof buildVpsJob>, key: string) =>
  plan.envVars.find((e) => e.key === key)?.value

describe('buildVpsJob input validation', () => {
  it('accepts a valid request and passes the values through', () => {
    const plan = buildVpsJob(
      request({ httpPort: 8080, callbackUrl: 'https://agent.example.com/cb?t=1' }),
    )
    expect(env(plan, 'SSH_AUTHORIZED_KEY')).toBe(SSH_KEY)
    expect(env(plan, 'HTTP_PORT')).toBe('8080')
    expect(env(plan, 'CALLBACK_URL')).toBe('https://agent.example.com/cb?t=1')
    expect(plan.config.fileUrl).toBe(TUNNEL_SCRIPT_IPFS)
  })

  it('trims surrounding whitespace (e.g. the trailing newline of a .pub file)', () => {
    const plan = buildVpsJob(request({ sshKey: `${SSH_KEY}\n` }))
    expect(env(plan, 'SSH_AUTHORIZED_KEY')).toBe(SSH_KEY)
  })

  it('accepts a key without a comment', () => {
    const key = ed25519Key('')
    expect(env(buildVpsJob(request({ sshKey: key })), 'SSH_AUTHORIZED_KEY')).toBe(key)
  })

  it('treats an empty callbackUrl as no callback', () => {
    expect(env(buildVpsJob(request({ callbackUrl: '' })), 'CALLBACK_URL')).toBeUndefined()
  })

  describe('sshKey', () => {
    const blob = SSH_KEY.split(' ')[1]
    it.each([
      ['an extra authorized_keys line', `${SSH_KEY}\nssh-ed25519 ${blob} attacker`],
      ['a carriage return', `${SSH_KEY}\rssh-ed25519 ${blob}`],
      ['an options prefix', `command="sh" ${SSH_KEY}`],
      ['an unknown key type', `ssh-foo ${blob}`],
      ['a DSA key', `ssh-dss ${blob}`],
      ['a mismatching key type', `ssh-rsa ${blob}`],
      ['a missing blob', 'ssh-ed25519'],
      ['a non-base64 blob', 'ssh-ed25519 not*base64'],
      [
        'a truncated blob',
        `ssh-ed25519 ${Buffer.from('\0\0\0\x0bssh-ed25519').toString('base64')}`,
      ],
      ['a non-ASCII comment', `${SSH_KEY} café`],
      ['a tab', `ssh-ed25519\t${blob}`],
      ['an empty string', ''],
      ['a non-string', 42],
    ])('rejects %s', (_, sshKey) => {
      expect(() => buildVpsJob(request({ sshKey: sshKey as string }))).toThrow(
        /Invalid VPS request: sshKey/,
      )
    })

    it('does not echo the key in the error', () => {
      const bad = `${SSH_KEY}\nsecret-marker`
      expect(() => buildVpsJob(request({ sshKey: bad }))).toThrow(
        expect.objectContaining({ message: expect.not.stringContaining('secret-marker') }),
      )
    })
  })

  describe('httpPort', () => {
    it.each([1024, 8080, 65535])('accepts %p', (httpPort) => {
      expect(env(buildVpsJob(request({ httpPort })), 'HTTP_PORT')).toBe(String(httpPort))
    })

    it.each([0, 80, 1023, 65536, 8080.5, NaN, Infinity, '8080', '8080"; }', null])(
      'rejects %p',
      (httpPort) => {
        expect(() => buildVpsJob(request({ httpPort: httpPort as number }))).toThrow(
          'Invalid VPS request: httpPort must be an integer between 1024 and 65535',
        )
      },
    )
  })

  describe('callbackUrl', () => {
    it.each([
      'http://agent.example.com/cb',
      'file:///etc/passwd',
      'gopher://127.0.0.1:6379/_',
      'https://user:pass@agent.example.com/cb',
      'not a url',
      'https://agent.example.com/cb\n-d @/etc/shadow',
    ])('rejects %p', (callbackUrl) => {
      expect(() => buildVpsJob(request({ callbackUrl }))).toThrow(
        'Invalid VPS request: callbackUrl must be an https:// URL',
      )
    })
  })

  describe('scriptCid', () => {
    it('accepts an ipfs:// CIDv0', () => {
      const scriptCid = 'ipfs://QmbFMke1KXqnYyBBWxB74N4c5SBnJMVAiMNRcGu6x1AwQH'
      expect(buildVpsJob(request({ scriptCid })).config.fileUrl).toBe(scriptCid)
    })

    it.each([
      'https://evil.example.com/start.zip',
      'QmbFMke1KXqnYyBBWxB74N4c5SBnJMVAiMNRcGu6x1AwQH',
      'ipfs://QmbFMke1KXqnYyBBWxB74N4c5SBnJMVAiMNRcGu6x1AwQ',
      'ipfs://QmbFMke1KXqnYyBBWxB74N4c5SBnJMVAiMNRcGu6x1AwQH/../x',
      'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
      '',
    ])('rejects %p', (scriptCid) => {
      expect(() => buildVpsJob(request({ scriptCid }))).toThrow(
        'Invalid VPS request: scriptCid must be ipfs:// followed by a CIDv0',
      )
    })
  })

  it.each([
    ['network', { network: 'devnet' }],
    ['image', { image: 'debian' }],
    ['image', { image: '__proto__' }],
  ])('rejects an unknown %s', (field, overrides) => {
    expect(() => buildVpsJob(request(overrides as Partial<VpsRequest>))).toThrow(
      `Invalid VPS request: ${field}`,
    )
  })
})
