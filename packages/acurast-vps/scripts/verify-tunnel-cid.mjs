#!/usr/bin/env node
/**
 * Check that TUNNEL_SCRIPT_IPFS in src/job.ts is the CID of the tunnel/ bundle
 * in this tree: rebuild the zip exactly as pin-tunnel.mjs does, compute its
 * CIDv0 locally and compare. Needs no network access and no .env.
 *
 * Requires a built @acurast/sdk (`yarn build`).
 *
 * Usage:  node scripts/verify-tunnel-cid.mjs
 * Exits non-zero if the CIDs differ.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { computeCidV0 } from '@acurast/sdk/ipfs'
import { buildTunnelZip, readPinnedTunnelUri } from './tunnel-bundle.mjs'

const pinned = readPinnedTunnelUri()
const outDir = mkdtempSync(join(tmpdir(), 'acurast-vps-tunnel-'))
let computed
try {
  const { zipPath } = await buildTunnelZip(outDir)
  computed = `ipfs://${await computeCidV0(readFileSync(zipPath))}`
} finally {
  rmSync(outDir, { recursive: true, force: true })
}

if (computed !== pinned) {
  console.error('TUNNEL_SCRIPT_IPFS does not match the tunnel/ bundle.')
  console.error(`  src/job.ts: ${pinned}`)
  console.error(`  tunnel/:    ${computed}`)
  console.error('Re-pin the bundle with `yarn pin-tunnel` (or revert the tunnel/ change).')
  process.exit(1)
}
console.log(`TUNNEL_SCRIPT_IPFS matches the tunnel/ bundle: ${pinned}`)
