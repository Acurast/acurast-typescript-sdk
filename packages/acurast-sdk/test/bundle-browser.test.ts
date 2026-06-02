import JSZip from 'jszip'
import { zipProjectBrowser } from '../src/deploy/bundle.browser.js'
import { RestartPolicy } from '../src/types/project.js'

const toBytes = async (blob: Blob): Promise<Uint8Array> =>
  new Uint8Array(await blob.arrayBuffer())

describe('zipProjectBrowser', () => {
  const files = { 'index.js': 'export default () => {}\n' }

  it('includes manifest.json and the project files', async () => {
    const blob = await zipProjectBrowser(files, {
      projectName: 'my-project',
      entrypoint: 'index.js',
    })

    const zip = await JSZip.loadAsync(await toBytes(blob))
    expect(Object.keys(zip.files).sort()).toEqual(['index.js', 'manifest.json'])

    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'))
    expect(manifest).toEqual({
      name: 'my-project',
      version: 1,
      entrypoint: 'index.js',
      restartPolicy: RestartPolicy.OnFailure,
    })

    expect(await zip.file('index.js')!.async('string')).toBe(files['index.js'])
  })

  it('includes the image in the manifest when provided', async () => {
    const blob = await zipProjectBrowser(files, {
      projectName: 'shell-project',
      entrypoint: 'index.js',
      restartPolicy: RestartPolicy.Always,
      image: { url: 'docker://example', sha256: 'abc' },
    })
    const zip = await JSZip.loadAsync(await toBytes(blob))
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'))
    expect(manifest.restartPolicy).toBe(RestartPolicy.Always)
    expect(manifest.image).toEqual({ url: 'docker://example', sha256: 'abc' })
  })

  it('is deterministic: identical inputs produce byte-identical zips', async () => {
    const a = await toBytes(await zipProjectBrowser(files, { projectName: 'p', entrypoint: 'index.js' }))
    const b = await toBytes(await zipProjectBrowser(files, { projectName: 'p', entrypoint: 'index.js' }))
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true)
  })

  it('pins every entry to the 1980-01-01 DOS epoch', async () => {
    const blob = await zipProjectBrowser(files, { projectName: 'p', entrypoint: 'index.js' })
    const zip = await JSZip.loadAsync(await toBytes(blob))
    for (const name of Object.keys(zip.files)) {
      expect(zip.files[name].date.getUTCFullYear()).toBe(1980)
    }
  })
})
