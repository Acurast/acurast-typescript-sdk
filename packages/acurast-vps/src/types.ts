import type { JobRegistration } from '@acurast/sdk/types'

export type { JobRegistration }

export interface VpsKeypair {
  /** PKCS8 DER-encoded P-256 private key (passed to tunnel script as TUNNEL_KEY env var, base64-encoded) */
  privateKeyPkcs8: Buffer
  /** SEC1 compressed P-256 public key (33 bytes) — used to derive the tunnel clientId */
  publicKeyCompressed: Buffer
}

export interface VpsOptions {
  /** User's SSH public key installed into dropbear's authorized_keys */
  sshAuthorizedKey: string
  /** Minimum total RAM in bytes (mapped to acurastCompute benchmark filter) */
  minMemory?: number
  /** Minimum CPU single-core benchmark score */
  minCpu?: number
  /** Maximum cost per execution in ACU micro-units (default: 48_686_320_000) */
  reward?: number
  /** Target network (default: 'mainnet') */
  network?: 'mainnet' | 'canary'
  /** Override the default tunnel script IPFS CID */
  scriptCid?: string
}

export interface VpsDeploymentPlan {
  /** Ready to pass to @acurast/sdk registerJob() */
  job: JobRegistration
  /** P-256 keypair for the primary Let's Encrypt tunnel connection */
  tunnelKey: VpsKeypair
  /**
   * Precomputed tunnel clientId: hex(sha256(compressedPubkey)[0..8])
   * Domain: https://<clientId>.acu.run
   * SSH:    ssh -o ProxyCommand='openssl s_client -quiet -servername <clientId>.acu.run -connect <clientId>.acu.run:443' root@<clientId>.acu.run
   */
  clientId: string
  /** Env vars to inject via @acurast/sdk setEnvVars after job is matched */
  envVars: { key: string; value: string }[]
}
