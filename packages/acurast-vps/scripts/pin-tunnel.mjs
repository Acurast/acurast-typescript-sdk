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
import { readFileSync, writeFileSync, rmSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { uploadScript } from '@acurast/sdk/ipfs'
import { zipFolder, createManifest } from '@acurast/sdk/deploy'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkgRoot = join(__dirname, '..')
const sdkRoot = join(pkgRoot, '../..')
const tunnelDir = join(pkgRoot, 'tunnel')
const tmpDir = join(pkgRoot, '.tmp')
const deploymentName = 'acurast-vps-tunnel'

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

// Build the manifest + zip via the SDK, matching what `acurast deploy` produces.
// zipFolder pins entry timestamps to 1980-01-01 so identical inputs yield
// byte-identical zips (and therefore a deterministic CID).
const manifest = createManifest(deploymentName, 'start.sh', 'OnFailure', image)
console.log('Manifest:', manifest)

console.log('Zipping...')
rmSync(tmpDir, { recursive: true, force: true })
const { zipPath } = await zipFolder(tunnelDir, tmpDir, manifest, deploymentName)

const zipSize = statSync(zipPath).size
console.log(`Zip built: ${zipPath} (${zipSize} bytes)`)

// Reuse the SDK's Pinata upload (same pinFileToIPFS contract `acurast deploy` uses)
console.log('Uploading to Pinata...')
const uri = await uploadScript({ file: zipPath }, { endpoint: IPFS_URL, apiKey: IPFS_API_KEY })
const cid = uri.replace(/^ipfs:\/\//, '')

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
