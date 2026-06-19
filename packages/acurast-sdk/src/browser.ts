// Browser-safe entry point for `@acurast/sdk`.
//
// Re-exports only the modules that run in a browser bundle (no `fs`,
// `adm-zip`, `form-data`, or `node:path`). The deploy orchestration is shared
// with the Node entry via `deployProjectCore`; bundling/upload use JSZip +
// `fetch`. Env-var encryption relies on `crypto` being aliased to a browser
// polyfill (e.g. `crypto-browserify`) by the host app's bundler.
//
// Consumers should import from `@acurast/sdk/browser` rather than the Node
// `@acurast/sdk` root.

export * from './types/index.js'
export * from './chain/index.js'
export * from './matcher/index.js'

// Shared, environment-agnostic deploy orchestrator.
export { deployProjectCore } from './deploy/deploy-core.js'
export type { DeployProjectCoreOptions } from './deploy/deploy-core.js'

// Browser deploy orchestrator + bundling/upload primitives.
export { deployProjectBrowser } from './deploy/deploy-project.browser.js'
export type { DeployProjectBrowserOptions } from './deploy/deploy-project.browser.js'
export { zipProjectBrowser } from './deploy/bundle.browser.js'
export type { BrowserBundleFiles, ZipProjectOptions } from './deploy/bundle.browser.js'
export { uploadBlob } from './ipfs/upload.browser.js'
export type { IpfsUploadOptions } from './ipfs/upload.browser.js'
export { createManifest } from './deploy/manifest.js'
export { NOOP_LOGGER } from './deploy/logger.js'
export type { Logger } from './deploy/logger.js'
