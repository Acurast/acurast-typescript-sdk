#!/usr/bin/env node
/**
 * Pin the tunnel/ bundle to IPFS and print the CID.
 *
 * Reads ACURAST_IPFS_URL + ACURAST_IPFS_API_KEY from the SDK repo root .env
 * (Pinata credentials). Bundles tunnel/ the same way `acurast deploy` would
 * (see tunnel-bundle.mjs), uploaded via Pinata's pinFileToIPFS endpoint.
 * uploadScript verifies the CID returned by Pinata against the CID computed
 * locally from the zip and fails on mismatch.
 *
 * After running, src/job.ts carries the new TUNNEL_SCRIPT_IPFS; check it with
 * `yarn verify-tunnel-cid` and republish @acurast/vps.
 *
 * Usage:  node scripts/pin-tunnel.mjs
 */
import { readFileSync, writeFileSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { uploadScript } from '@acurast/sdk/ipfs'
import { buildTunnelZip, jobTsPath, pkgRoot, TUNNEL_SCRIPT_IPFS_PATTERN } from './tunnel-bundle.mjs'

const sdkRoot = join(pkgRoot, '../..')
const tmpDir = join(pkgRoot, '.tmp')

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

console.log('Zipping...')
rmSync(tmpDir, { recursive: true, force: true })
const { zipPath, manifest } = await buildTunnelZip(tmpDir)
console.log('Manifest:', manifest)

const zipSize = statSync(zipPath).size
console.log(`Zip built: ${zipPath} (${zipSize} bytes)`)

// Reuse the SDK's Pinata upload (same pinFileToIPFS contract `acurast deploy` uses).
// It rejects a response whose CID does not match the zip.
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
const jobTs = readFileSync(jobTsPath, 'utf8')
const patched = jobTs.replace(
  TUNNEL_SCRIPT_IPFS_PATTERN,
  `export const TUNNEL_SCRIPT_IPFS = 'ipfs://${cid}'`,
)
if (patched === jobTs) {
  console.error('Could not find TUNNEL_SCRIPT_IPFS declaration in src/job.ts')
  process.exit(1)
}
writeFileSync(jobTsPath, patched)
console.log('Updated TUNNEL_SCRIPT_IPFS in src/job.ts')

rmSync(tmpDir, { recursive: true, force: true })
