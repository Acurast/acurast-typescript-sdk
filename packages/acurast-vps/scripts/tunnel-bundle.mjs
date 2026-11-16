/**
 * Shared build step for the tunnel bundle, used by pin-tunnel.mjs (to pin it)
 * and verify-tunnel-cid.mjs (to check the pinned CID in src/job.ts).
 *
 * Bundles tunnel/ the same way `acurast deploy` would: a zip with
 * manifest.json at the root + all tunnel files. zipFolder pins entry
 * timestamps to 1980-01-01 so identical inputs yield byte-identical zips
 * (and therefore a deterministic CID).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { zipFolder, createManifest } from '@acurast/sdk/deploy'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const pkgRoot = join(__dirname, '..')
export const tunnelDir = join(pkgRoot, 'tunnel')
export const jobTsPath = join(pkgRoot, 'src/job.ts')
export const deploymentName = 'acurast-vps-tunnel'

/** Read the image reference from src/images.ts so it stays in sync with the code. */
export const readImage = () => {
  const imagesTs = readFileSync(join(pkgRoot, 'src/images.ts'), 'utf8')
  const urlMatch = imagesTs.match(/url:\s*'([^']+)'/)
  const shaMatch = imagesTs.match(/sha256:\s*'([^']+)'/)
  if (!urlMatch || !shaMatch) {
    throw new Error('Could not parse image url/sha256 from src/images.ts')
  }
  return { url: urlMatch[1], sha256: shaMatch[1] }
}

/** Build the manifest + zip into `outDir`; returns the zip path and manifest. */
export const buildTunnelZip = async (outDir) => {
  const manifest = createManifest(deploymentName, 'start.sh', 'OnFailure', readImage())
  const { zipPath } = await zipFolder(tunnelDir, outDir, manifest, deploymentName)
  return { zipPath, manifest }
}

export const TUNNEL_SCRIPT_IPFS_PATTERN = /export const TUNNEL_SCRIPT_IPFS = '([^']*)'/

/** The `ipfs://...` value currently baked into src/job.ts. */
export const readPinnedTunnelUri = () => {
  const match = readFileSync(jobTsPath, 'utf8').match(TUNNEL_SCRIPT_IPFS_PATTERN)
  if (!match) {
    throw new Error('Could not find TUNNEL_SCRIPT_IPFS declaration in src/job.ts')
  }
  return match[1]
}
