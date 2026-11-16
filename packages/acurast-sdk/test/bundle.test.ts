import AdmZip from 'adm-zip'
import { execFileSync } from 'child_process'
import fs from 'fs'
import { createRequire } from 'module'
import os from 'os'
import path from 'path'
import { pathToFileURL } from 'url'
import { zipFolder } from '../src/deploy/bundle.js'
import type { Logger } from '../src/deploy/logger.js'

const MANIFEST = JSON.stringify({ projectName: 'test' })

const writeTree = (root: string, files: Record<string, string>): void => {
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, content)
  }
}

const fileEntries = (zipPath: string): string[] =>
  new AdmZip(zipPath)
    .getEntries()
    .filter((e) => !e.isDirectory)
    .map((e) => e.entryName)
    .sort()

const recordingLogger = () => {
  const warnings: string[] = []
  const debug: string[] = []
  const logger: Logger = {
    debug: (m) => debug.push(m),
    warn: (m) => warnings.push(m),
    error: () => {},
    log: () => {},
  }
  return { logger, warnings, debug }
}

describe('zipFolder', () => {
  let tmp: string
  let input: string
  let out: string

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'acurast-bundle-test-'))
    input = path.join(tmp, 'project')
    out = path.join(tmp, 'out')
    writeTree(input, {
      'index.js': 'console.log(1)',
      'lib/util.js': 'module.exports = {}',
      '.env': 'SECRET=1',
      '.git/config': '[core]',
      'sub/.secret': 'hidden',
      'sub/visible.txt': 'ok',
      'node_modules/pkg/index.js': 'module.exports = 1',
      'node_modules/.bin/x': '#!/bin/sh',
    })
  })

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true })
  })

  it('excludes dotfiles and dot-folders by default', async () => {
    const { logger, warnings, debug } = recordingLogger()
    const { zipPath } = await zipFolder(input, out, MANIFEST, 'bundle', logger)

    expect(fileEntries(zipPath)).toEqual([
      'index.js',
      'lib/util.js',
      'manifest.json',
      'node_modules/pkg/index.js',
      'sub/visible.txt',
    ])

    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('.env')
    expect(warnings[0]).toContain('.git')
    expect(warnings[0]).toContain('sub/.secret')
    expect(warnings[0]).toContain('node_modules/.bin')
    // Only the topmost excluded path is listed, not every file inside it.
    expect(warnings[0]).not.toContain('.git/config')
    expect(warnings[0]).not.toContain('node_modules/.bin/x')

    expect(debug).toContain('bundling: index.js')
    expect(debug).toContain('bundling: node_modules/pkg/index.js')
  })

  it('includes dotfiles when includeDotfiles is set', async () => {
    const { logger, warnings } = recordingLogger()
    const { zipPath } = await zipFolder(input, out, MANIFEST, 'bundle', logger, {
      includeDotfiles: true,
    })

    expect(fileEntries(zipPath)).toEqual([
      '.env',
      '.git/config',
      'index.js',
      'lib/util.js',
      'manifest.json',
      'node_modules/.bin/x',
      'node_modules/pkg/index.js',
      'sub/.secret',
      'sub/visible.txt',
    ])
    expect(warnings).toHaveLength(0)
  })

  it('applies the exclude predicate to entries and their parent folders', async () => {
    const { logger, warnings } = recordingLogger()
    const seen: string[] = []
    const { zipPath } = await zipFolder(input, out, MANIFEST, 'bundle', logger, {
      exclude: (p) => {
        seen.push(p)
        return p === 'node_modules' || p.endsWith('.txt')
      },
    })

    expect(fileEntries(zipPath)).toEqual(['index.js', 'lib/util.js', 'manifest.json'])
    expect(seen.every((p) => !p.includes('\\') && !p.endsWith('/'))).toBe(true)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('node_modules')
    expect(warnings[0]).toContain('sub/visible.txt')
    expect(warnings[0]).not.toContain('node_modules/pkg')
  })

  it('bundles a single-file input unchanged, even if it is a dotfile', async () => {
    const { logger, warnings } = recordingLogger()
    const { zipPath } = await zipFolder(path.join(input, '.env'), out, MANIFEST, 'bundle', logger)

    expect(fileEntries(zipPath)).toEqual(['.env', 'manifest.json'])
    expect(zipPath).toBe(`${out}/bundle.zip`)
    expect(warnings).toHaveLength(0)
  })

  it.each(['../../escaped', '../escaped', '..', '.', 'a/b', 'a\\b', '/abs/escaped', '', 'nul\0'])(
    'rejects the deployment name %p without writing outside the output folder',
    async (name) => {
      await expect(zipFolder(input, out, MANIFEST, name)).rejects.toThrow('Invalid deployment name')
      expect(fs.existsSync(path.join(tmp, 'escaped.zip'))).toBe(false)
      expect(fs.existsSync(path.join(path.dirname(tmp), 'escaped.zip'))).toBe(false)
      expect(fs.existsSync(path.join(out, 'a', 'b.zip'))).toBe(false)
    },
  )

  it.each(['my-app.v2', '..double-dot-prefix'])(
    'writes the zip inside the output folder for the plain name %p',
    async (name) => {
      const { zipPath } = await zipFolder(input, out, MANIFEST, name)
      expect(path.dirname(path.resolve(zipPath))).toBe(path.resolve(out))
      expect(path.basename(zipPath)).toBe(`${name}.zip`)
    },
  )

  it('stamps every entry with 1980-01-01 00:00:00 in DOS time', async () => {
    const { zipPath } = await zipFolder(input, out, MANIFEST, 'bundle')
    const DOS_1980_01_01 = ((1 << 5) | 1) << 16 // year 0, month 1, day 1; time 0
    for (const entry of new AdmZip(zipPath).getEntries()) {
      expect(entry.header.timeval).toBe(DOS_1980_01_01)
    }
  })

  // Node's process-wide timezone cannot be switched inside a Jest worker, so
  // build the bundle in child processes with different TZ values. The child
  // loads the TypeScript source via Node's type stripping plus a resolve hook
  // that maps the `.js` import specifiers to the `.ts` files.
  const hasRegisterHooks =
    typeof (createRequire(__filename)('module') as any).registerHooks === 'function'
  ;(hasRegisterHooks ? it : it.skip)(
    'produces identical bytes regardless of the TZ environment variable',
    () => {
      const bundleUrl = pathToFileURL(path.join(__dirname, '../src/deploy/bundle.ts')).href
      const childScript = `
      import { registerHooks } from 'node:module'
      registerHooks({
        resolve(specifier, context, next) {
          try {
            return next(specifier, context)
          } catch (err) {
            if (specifier.startsWith('.') && specifier.endsWith('.js')) {
              return next(specifier.slice(0, -3) + '.ts', context)
            }
            throw err
          }
        },
      })
      const [bundleUrl, input, out, manifest] = process.argv.slice(1)
      const { zipFolder } = await import(bundleUrl)
      await zipFolder(input, out, manifest, 'bundle')
    `
      const build = (tz: string): Buffer => {
        const tzOut = path.join(tmp, `out-${tz.replace('/', '_')}`)
        execFileSync(
          process.execPath,
          [
            '--no-warnings',
            '--input-type=module',
            '-e',
            childScript,
            bundleUrl,
            input,
            tzOut,
            MANIFEST,
          ],
          { env: { ...process.env, TZ: tz }, stdio: 'pipe' },
        )
        return fs.readFileSync(path.join(tzOut, 'bundle.zip'))
      }

      const utc = build('UTC')
      expect(build('Asia/Tokyo').equals(utc)).toBe(true)
      expect(build('America/Los_Angeles').equals(utc)).toBe(true)
    },
    30_000,
  )
})
