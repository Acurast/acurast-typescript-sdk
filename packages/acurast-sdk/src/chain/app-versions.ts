import type { Version } from '../types/env.js'

type deviceTypeNumber = number
type buildNumber = number

const androidVersions = new Map<buildNumber, string>([
  [18, '1.3.33'],
  [19, '1.3.34'],
  [20, '1.3.35'],
  [21, '1.3.36'],
  [22, '1.3.37'],
  [23, '1.3.38'],
  [24, '1.3.39'],
  [26, '1.4.0'],
  [27, '1.5.0-rc1'],
  [28, '1.5.0'],
  [29, '1.6.0-rc1'],
  [30, '1.6.0-rc2'],
  [31, '1.6.0-rc3'],
  [32, '1.6.0'],
  [33, '1.7.0-rc1'],
  [34, '1.7.0-rc2'],
  [35, '1.8.0-rc1'],
  [36, '1.7.0-rc3'],
  [37, '1.7.0-rc4'],
  [38, '1.7.0'],
  [39, '1.7.1'],
  [40, '1.8.0-rc1'],
  [41, '1.8.0-rc2'],
  [42, '1.8.0'],
  [43, '1.8.1-rc1'],
  [44, '1.8.1'],
  [45, '1.9.0-rc1'],
  [46, '1.9.0-rc2'],
  [47, '1.9.0'],
  [48, '1.10.0-alpha1'],
  [49, '1.9.1-rc1'],
  [50, '1.9.1-rc2'],
  [51, '1.9.1-rc3'],
  [52, '1.9.1-rc4'],
  [53, '1.9.1-rc5'],
  [54, '1.9.1-rc6'],
  [55, '1.9.1'],
  [56, '1.9.2-rc1'],
  [57, '1.9.2-rc2'],
  [58, '1.9.2'],
  [59, '1.10.0-rc1'],
  [60, '1.10.0'],
  [61, '1.10.1'],
  [62, '1.10.2'],
  [63, '1.11.0-rc1'],
  [64, '1.10.3-beta1'],
  [65, '1.10.4-beta1'],
  [66, '1.11.0-rc2'],
  [67, '1.11.0'],
  [68, '1.12.0-beta1'],
  [69, '1.12.0-rc1'],
  [70, '1.12.0'],
  [71, '1.12.1'],
  [72, '1.13.0-rc1'],
  [73, '1.13.0'],
])

const iosVersions = new Map<buildNumber, string>([])

export const deviceVersions = new Map<deviceTypeNumber, Map<number, string>>([
  [0, androidVersions],
  [1, iosVersions],
])

export const getHumanReadableVersion = (version: Version | undefined): string => {
  if (version == null) {
    return ''
  }
  const platform = deviceVersions.get(version.platform)
  const humanReadableVersion = platform?.get(version.buildNumber)
  return humanReadableVersion ?? `unknown version (${version.buildNumber})`
}

export const DEVICE_VERSIONS_URL =
  'https://raw.githubusercontent.com/Acurast/acurast-processor-update/refs/heads/main/versions.json'

/** Version strings as the processor app uses them, e.g. `1.13.0` or `1.9.1-rc6`. */
const VERSION_STRING = /^\d{1,4}\.\d{1,4}\.\d{1,4}(?:-[0-9A-Za-z]{1,32})?$/

const isNonNegativeIntegerKey = (key: string): boolean =>
  /^\d{1,9}$/.test(key) && Number.isSafeInteger(Number(key))

/**
 * Fetches the latest processor version table and merges it into
 * `deviceVersions`. Call once at startup if you need build-number → version
 * strings newer than those bundled with this SDK release.
 *
 * The table is used to translate `minProcessorVersions` version strings into
 * build numbers, so the merge only ever adds information:
 * - entries bundled with the SDK (or added earlier) are never overwritten, and
 *   new entries must have a higher build number than every known build of
 *   that platform (build numbers only grow), so an old build cannot be given
 *   a new version string;
 * - an entry whose version string is already mapped to a different build
 *   number on that platform is ignored, so a version string cannot be
 *   redirected to another build;
 * - platform and build keys must be non-negative integers and versions must
 *   look like `1.2.3` or `1.2.3-rc1`; anything else is ignored.
 */
export const fetchDeviceVersions = async (
  url: string = DEVICE_VERSIONS_URL,
): Promise<Map<deviceTypeNumber, Map<buildNumber, string>>> => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `Failed to fetch device versions from ${url}: ${response.status} ${response.statusText}`,
    )
  }
  const json: unknown = await response.json()
  if (json == null || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error(`Failed to fetch device versions from ${url}: unexpected response format`)
  }
  for (const [platformKey, builds] of Object.entries(json)) {
    if (!isNonNegativeIntegerKey(platformKey)) continue
    if (builds == null || typeof builds !== 'object' || Array.isArray(builds)) continue
    const platform = Number(platformKey)
    let platformMap = deviceVersions.get(platform)
    if (platformMap == null) {
      platformMap = new Map<buildNumber, string>()
      deviceVersions.set(platform, platformMap)
    }
    const knownVersions = new Set(platformMap.values())
    const highestKnownBuild = Math.max(-1, ...platformMap.keys())
    for (const [buildKey, versionString] of Object.entries(builds as Record<string, unknown>)) {
      if (!isNonNegativeIntegerKey(buildKey)) continue
      if (typeof versionString !== 'string' || !VERSION_STRING.test(versionString)) continue
      const build = Number(buildKey)
      if (build <= highestKnownBuild || knownVersions.has(versionString)) continue
      platformMap.set(build, versionString)
      knownVersions.add(versionString)
    }
  }
  return deviceVersions
}
