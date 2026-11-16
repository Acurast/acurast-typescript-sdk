import AdmZip from 'adm-zip'
import fs from 'fs'
import os from 'os'
import path from 'path'
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
})
