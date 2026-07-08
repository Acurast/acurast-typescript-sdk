#!/usr/bin/env node
/**
 * Pin the tunnel/ bundle to IPFS and print the CID.
 *
 * Reads ACURAST_IPFS_URL + ACURAST_IPFS_API_KEY from the SDK repo root .env
 * (Pinata credentials). Bundles tunnel/ the same way `acurast deploy` would:
 * a zip with manifest.json at the root + all tunnel files, uploaded via
 * Pinata's pinFileToIPFS endpoint.
 *
 * After running, paste the printed CID into TUNNEL_SCRIPT_IPFS in src/job.ts
 * and republish @acurast/vps.
 *
 * Usage:  node scripts/pin-tunnel.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, createReadStream, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { execFileSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkgRoot = join(__dirname, '..')
const sdkRoot = join(pkgRoot, '../..')
const tunnelDir = join(pkgRoot, 'tunnel')
const tmpDir = join(pkgRoot, '.tmp')
const stagingDir = join(tmpDir, 'bundle')
const zipPath = join(tmpDir, 'acurast-vps-tunnel.zip')

// Load .env from SDK repo root
const envPath = join(sdkRoot, '.env')
const env = {}
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const IPFS_URL = env.ACURAST_IPFS_URL
const IPFS_API_KEY = env.ACURAST_IPFS_API_KEY
if (!IPFS_URL || !IPFS_API_KEY) {
  console.error('ACURAST_IPFS_URL and ACURAST_IPFS_API_KEY must be set in', envPath)
  process.exit(1)
}

// Read image reference from src/images.ts so it stays in sync with the code
const imagesTs = readFileSync(join(pkgRoot, 'src/images.ts'), 'utf8')
const urlMatch = imagesTs.match(/url:\s*'([^']+)'/)
const shaMatch = imagesTs.match(/sha256:\s*'([^']+)'/)
if (!urlMatch || !shaMatch) {
  console.error('Could not parse image url/sha256 from src/images.ts')
  process.exit(1)
}
const image = { url: urlMatch[1], sha256: shaMatch[1] }

// Build manifest matching the SDK's createManifest() shape
const manifest = {
  name: 'acurast-vps-tunnel',
  version: 1,
  entrypoint: 'start.sh',
  restartPolicy: 'OnFailure',
  image,
}

console.log('Staging bundle...')
rmSync(tmpDir, { recursive: true, force: true })
mkdirSync(stagingDir, { recursive: true })
cpSync(tunnelDir, stagingDir, { recursive: true })
writeFileSync(join(stagingDir, 'manifest.json'), JSON.stringify(manifest))

console.log('Manifest:', JSON.stringify(manifest, null, 2))
console.log('Zipping...')
execFileSync('zip', ['-X', '-r', zipPath, '.'], { cwd: stagingDir, stdio: 'inherit' })

const zipSize = statSync(zipPath).size
console.log(`Zip built: ${zipPath} (${zipSize} bytes)`)

console.log('Uploading to Pinata...')
const boundary = '----acurast-vps-' + Math.random().toString(36).slice(2)
const CRLF = '\r\n'
const preamble = Buffer.from(
  `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="file"; filename="acurast-vps-tunnel.zip"${CRLF}` +
    `Content-Type: application/zip${CRLF}${CRLF}`,
)
const between = Buffer.from(
  `${CRLF}--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="pinataOptions"${CRLF}${CRLF}` +
    `{"cidVersion":0}${CRLF}` +
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="pinataMetadata"${CRLF}${CRLF}` +
    `{"name":"acurast-vps-tunnel.zip"}`,
)
const closing = Buffer.from(`${CRLF}--${boundary}--${CRLF}`)
const zipBuf = readFileSync(zipPath)
const body = Buffer.concat([preamble, zipBuf, between, closing])

const res = await fetch(`${IPFS_URL}/pinning/pinFileToIPFS`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${IPFS_API_KEY}`,
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': String(body.length),
  },
  body,
})
if (!res.ok) {
  console.error('Pinata upload failed:', res.status, await res.text())
  process.exit(1)
}
const result = await res.json()
const cid = result.IpfsHash
if (!cid) {
  console.error('Pinata response missing IpfsHash:', result)
  process.exit(1)
}

console.log('')
console.log('==============================================')
console.log('CID:', cid)
console.log('ipfs://' + cid)
console.log('==============================================')
console.log('')

// Patch src/job.ts to bake the CID as default
const jobTsPath = join(pkgRoot, 'src/job.ts')
const jobTs = readFileSync(jobTsPath, 'utf8')
const patched = jobTs.replace(
  /export const TUNNEL_SCRIPT_IPFS = '[^']*'/,
  `export const TUNNEL_SCRIPT_IPFS = 'ipfs://${cid}'`,
)
if (patched === jobTs) {
  console.error('Could not find TUNNEL_SCRIPT_IPFS declaration in src/job.ts')
  process.exit(1)
}
writeFileSync(jobTsPath, patched)
console.log('Updated TUNNEL_SCRIPT_IPFS in src/job.ts')

rmSync(tmpDir, { recursive: true, force: true })
