import AdmZip from 'adm-zip'
import { mkdtempSync, rmSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'
import { getDevtoolsViewKey } from '../src/devtools-api.js'
import { injectDevtoolsSnippet, validateDevtoolsApiUrl } from '../src/inject-devtools-snippet.js'

// The package is ESM, so __dirname does not exist — derive it from import.meta.
const testDir = dirname(fileURLToPath(import.meta.url))
// Point to the compiled snippet in dist/ (built by `npm run build`).
const SNIPPET_DIR = resolve(testDir, '..', 'dist')

describe('devtools snippet injection', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'devtools-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  function createTestZip(entrypoint: string, entrypointContent: string): string {
    const zipPath = join(tempDir, 'test-bundle.zip')
    const zip = new AdmZip()
    zip.addFile(
      'manifest.json',
      Buffer.from(JSON.stringify({ name: 'test', version: 1, entrypoint }), 'utf-8'),
    )
    zip.addFile(entrypoint, Buffer.from(entrypointContent, 'utf-8'))
    zip.writeZip(zipPath)
    return zipPath
  }

  it('should prepend the devtools snippet to the entrypoint', async () => {
    const originalCode = 'console.log("hello world")'
    const zipPath = createTestZip('index.js', originalCode)

    await injectDevtoolsSnippet(
      zipPath,
      'index.js',
      'https://api.devtools.acurast.com',
      SNIPPET_DIR,
    )

    const zip = new AdmZip(zipPath)
    const content = zip.getEntry('index.js')!.getData().toString('utf-8')

    // Original code should still be present
    expect(content).toContain(originalCode)

    // Snippet should be prepended (original code at the end)
    expect(content.indexOf('httpPOST')).toBeLessThan(content.indexOf(originalCode))
  })

  it('should replace the API URL placeholder', async () => {
    const zipPath = createTestZip('index.js', '// user code')
    const apiUrl = 'https://custom-api.example.com'

    await injectDevtoolsSnippet(zipPath, 'index.js', apiUrl, SNIPPET_DIR)

    const zip = new AdmZip(zipPath)
    const content = zip.getEntry('index.js')!.getData().toString('utf-8')

    expect(content).toContain(apiUrl)
    expect(content).not.toContain('__DEVTOOLS_API_URL__')
  })

  it('should strip TSC artifacts (export {}, sourcemap comment)', async () => {
    const zipPath = createTestZip('index.js', '// user code')

    await injectDevtoolsSnippet(
      zipPath,
      'index.js',
      'https://api.devtools.acurast.com',
      SNIPPET_DIR,
    )

    const zip = new AdmZip(zipPath)
    const content = zip.getEntry('index.js')!.getData().toString('utf-8')

    expect(content).not.toContain('export {}')
    expect(content).not.toContain('sourceMappingURL')
  })

  it('should throw if entrypoint is not found in zip', async () => {
    const zipPath = createTestZip('index.js', '// user code')

    await expect(
      injectDevtoolsSnippet(
        zipPath,
        'nonexistent.js',
        'https://api.devtools.acurast.com',
        SNIPPET_DIR,
      ),
    ).rejects.toThrow('Could not find entrypoint')
  })

  it('should not break the manifest or other files in the zip', async () => {
    const zipPath = createTestZip('index.js', '// user code')

    // Add an extra file
    const zip = new AdmZip(zipPath)
    zip.addFile('lib/helper.js', Buffer.from('// helper', 'utf-8'))
    zip.writeZip(zipPath)

    await injectDevtoolsSnippet(
      zipPath,
      'index.js',
      'https://api.devtools.acurast.com',
      SNIPPET_DIR,
    )

    const result = new AdmZip(zipPath)
    const manifest = JSON.parse(result.getEntry('manifest.json')!.getData().toString('utf-8'))
    expect(manifest.entrypoint).toBe('index.js')

    const helper = result.getEntry('lib/helper.js')!.getData().toString('utf-8')
    expect(helper).toBe('// helper')
  })

  it('should override all console methods in the snippet', async () => {
    const zipPath = createTestZip('index.js', '// user code')

    await injectDevtoolsSnippet(
      zipPath,
      'index.js',
      'https://api.devtools.acurast.com',
      SNIPPET_DIR,
    )

    const zip = new AdmZip(zipPath)
    const content = zip.getEntry('index.js')!.getData().toString('utf-8')

    // The snippet should capture all 5 console methods
    for (const method of ['log', 'warn', 'error', 'info', 'debug']) {
      expect(content).toContain(`console.${method}`)
    }
  })

  function readApiUrlLiteral(content: string): string {
    const match = content.match(/const DEVTOOLS_API_URL = ("(?:[^"\\]|\\.)*");/)
    expect(match).not.toBeNull()
    return JSON.parse(match![1])
  }

  it('embeds the URL as a JSON string literal so quotes cannot break out', async () => {
    const zipPath = createTestZip('index.js', '// user code')
    const apiUrl = "https://api.example.com/x';globalThis.PWNED=1;//"

    await injectDevtoolsSnippet(zipPath, 'index.js', apiUrl, SNIPPET_DIR)

    const content = new AdmZip(zipPath).getEntry('index.js')!.getData().toString('utf-8')
    expect(readApiUrlLiteral(content)).toBe(apiUrl)
    expect(content).not.toContain("'https://api.example.com/x'")
  })

  it("does not expand $& or $' replacement patterns in the URL", async () => {
    const zipPath = createTestZip('index.js', '// user code')
    const apiUrl = "https://api.example.com/$&/$'/$`"

    await injectDevtoolsSnippet(zipPath, 'index.js', apiUrl, SNIPPET_DIR)

    const content = new AdmZip(zipPath).getEntry('index.js')!.getData().toString('utf-8')
    expect(readApiUrlLiteral(content)).toBe(apiUrl)
  })

  it.each([
    ["https://x.example';globalThis.PWNED=1;//", 'unsupported characters'],
    ['http://api.devtools.acurast.com', 'expected an https:// URL'],
    ['javascript:alert(1)', 'expected an https:// URL'],
    ['ftp://api.devtools.acurast.com', 'expected an https:// URL'],
    ['not a url', 'not a valid URL'],
    ['', 'non-empty'],
    ['https://user:secret@api.devtools.acurast.com', 'credentials'],
    ['https://api.devtools.acurast.com/?a=1', 'query strings'],
    ['https://api.devtools.acurast.com/#frag', 'query strings'],
  ])('rejects the devtools API URL %p', async (apiUrl, message) => {
    const zipPath = createTestZip('index.js', '// user code')

    await expect(injectDevtoolsSnippet(zipPath, 'index.js', apiUrl, SNIPPET_DIR)).rejects.toThrow(
      message,
    )
    // The bundle is left untouched.
    const content = new AdmZip(zipPath).getEntry('index.js')!.getData().toString('utf-8')
    expect(content).toBe('// user code')
  })

  it('does not echo the rejected URL in the error message', () => {
    expect(() => validateDevtoolsApiUrl('https://user:hunter2@api.example.com')).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('hunter2') }),
    )
  })

  it.each(['http://localhost:8080', 'http://127.0.0.1:3000', 'http://[::1]:3000'])(
    'allows plaintext http on loopback host %p',
    (apiUrl) => {
      expect(validateDevtoolsApiUrl(apiUrl)).toBe(apiUrl)
    },
  )
})

describe('getDevtoolsViewKey', () => {
  it.each(['http://api.devtools.acurast.com', 'not a url', 'https://u:p@api.example.com'])(
    'rejects the API URL %p before asking the signer to sign',
    async (apiUrl) => {
      let signCalls = 0
      const signRaw = async () => {
        signCalls++
        return { signature: '0x00' }
      }
      await expect(
        getDevtoolsViewKey('Acurast:owner:1', {
          apiUrl,
          signer: { address: 'owner', signer: { signRaw } },
        }),
      ).rejects.toThrow('Invalid devtools API URL')
      expect(signCalls).toBe(0)
    },
  )
})
