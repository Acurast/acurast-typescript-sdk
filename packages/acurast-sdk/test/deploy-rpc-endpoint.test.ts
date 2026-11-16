import { ApiPromise, WsProvider } from '@polkadot/api'
import { deployProjectCore } from '../src/deploy/deploy-core.js'
import { deployProject } from '../src/deploy/deploy-project.js'
import { deployProjectBrowser } from '../src/deploy/deploy-project.browser.js'
import { uploadScript } from '../src/ipfs/upload.js'
import { uploadBlob } from '../src/ipfs/upload.browser.js'
import { checkIsFolder, zipFolder } from '../src/deploy/bundle.js'
import { registerJob } from '../src/chain/register-job.js'
import { setEnvVars } from '../src/chain/set-env-vars.js'
import { DeploymentStatus } from '../src/types/deployment-status.js'

// No test opens a socket, uploads or registers anything: every side effect is mocked.
jest.mock('@polkadot/api', () => {
  const actual = jest.requireActual('@polkadot/api')
  return {
    ...actual,
    WsProvider: jest.fn().mockImplementation((endpoint: string) => ({ endpoint })),
    ApiPromise: { create: jest.fn().mockResolvedValue({}) },
  }
})
jest.mock('../src/ipfs/upload.js', () => ({
  uploadScript: jest.fn().mockResolvedValue('ipfs://QmUploaded'),
}))
jest.mock('../src/ipfs/upload.browser.js', () => ({
  uploadBlob: jest.fn().mockResolvedValue('ipfs://QmUploaded'),
}))
jest.mock('../src/deploy/bundle.js', () => ({
  ...jest.requireActual('../src/deploy/bundle.js'),
  checkIsFolder: jest.fn().mockResolvedValue(false),
  zipFolder: jest.fn().mockResolvedValue({ zipPath: '/tmp/bundle.zip' }),
}))
jest.mock('../src/chain/tx-queue.js', () => ({
  ...jest.requireActual('../src/chain/tx-queue.js'),
  getDefaultQueue: jest.fn().mockReturnValue({ enqueue: jest.fn() }),
}))
jest.mock('../src/chain/register-job.js', () => ({
  registerJob: jest.fn(),
}))
jest.mock('../src/chain/set-env-vars.js', () => ({
  setEnvVars: jest.fn().mockResolvedValue({ hash: '0xenv' }),
}))

const wsProviderMock = WsProvider as unknown as jest.Mock
const apiCreateMock = ApiPromise.create as unknown as jest.Mock
const uploadScriptMock = uploadScript as unknown as jest.Mock
const uploadBlobMock = uploadBlob as unknown as jest.Mock
const zipFolderMock = zipFolder as unknown as jest.Mock
const checkIsFolderMock = checkIsFolder as unknown as jest.Mock
const registerJobMock = registerJob as unknown as jest.Mock
const setEnvVarsMock = setEnvVars as unknown as jest.Mock

const REMOTE_WS = 'ws://rpc.example.com:9944'

const makeConfig = (): any => ({
  projectName: 'test',
  fileUrl: './dist/index.js',
  numberOfReplicas: 1,
})
const makeJob = (): any => ({ schedule: { startTime: Date.now() + 60 * 60 * 1000 } })
const wallet = { address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' } as any

const expectNoSideEffects = (): void => {
  expect(wsProviderMock).not.toHaveBeenCalled()
  expect(apiCreateMock).not.toHaveBeenCalled()
  expect(checkIsFolderMock).not.toHaveBeenCalled()
  expect(zipFolderMock).not.toHaveBeenCalled()
  expect(uploadScriptMock).not.toHaveBeenCalled()
  expect(uploadBlobMock).not.toHaveBeenCalled()
  expect(registerJobMock).not.toHaveBeenCalled()
  expect(setEnvVarsMock).not.toHaveBeenCalled()
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('deploy entry points reject an insecure RPC endpoint up front', () => {
  test('deployProjectCore', async () => {
    const resolveScript = jest.fn().mockResolvedValue('ipfs://QmX')
    const statusCallback = jest.fn()
    await expect(
      deployProjectCore(makeConfig(), makeJob(), {
        wallet,
        rpcEndpoint: REMOTE_WS,
        statusCallback,
        resolveScript,
      }),
    ).rejects.toThrow(/Insecure RPC endpoint/)
    expect(resolveScript).not.toHaveBeenCalled()
    expect(statusCallback).not.toHaveBeenCalled()
    expectNoSideEffects()
  })

  test('deployProject', async () => {
    const statusCallback = jest.fn()
    await expect(
      deployProject(makeConfig(), makeJob(), {
        wallet,
        rpcEndpoint: REMOTE_WS,
        ipfs: { endpoint: 'https://pin.example.com', apiKey: 'k' },
        statusCallback,
      }),
    ).rejects.toThrow(/Insecure RPC endpoint/)
    expect(statusCallback).not.toHaveBeenCalled()
    expectNoSideEffects()
  })

  test('deployProjectBrowser', async () => {
    const statusCallback = jest.fn()
    await expect(
      deployProjectBrowser(makeConfig(), makeJob(), {
        wallet,
        rpcEndpoint: REMOTE_WS,
        ipfs: { endpoint: 'https://pin.example.com', apiKey: 'k' },
        files: { 'index.js': 'console.log(1)' },
        statusCallback,
      }),
    ).rejects.toThrow(/Insecure RPC endpoint/)
    expect(statusCallback).not.toHaveBeenCalled()
    expectNoSideEffects()
  })

  test('credentials in the endpoint are rejected and not echoed', async () => {
    const error: Error = await deployProject(makeConfig(), makeJob(), {
      wallet,
      rpcEndpoint: 'wss://user:s3cr3t@rpc.example.com',
      ipfs: { endpoint: 'https://pin.example.com', apiKey: 'k' },
      statusCallback: jest.fn(),
    }).then(
      () => {
        throw new Error('expected a rejection')
      },
      (err: Error) => err,
    )
    expect(error.message).toMatch(/credentials in the URL are not allowed/)
    expect(error.message).not.toContain('s3cr3t')
    expectNoSideEffects()
  })
})

describe('allowInsecureRpcEndpoint is threaded through', () => {
  /** Makes registerJob report an acknowledged match, which triggers setEnvVars. */
  const acknowledgeOnRegister = (): void => {
    registerJobMock.mockImplementation(async (_api, _wallet, _job, statusCallback) => {
      statusCallback(DeploymentStatus.WaitingForMatch, { jobIds: [[{ acurast: 'x' }, 1]] })
      statusCallback(DeploymentStatus.Acknowledged, { acknowledged: 1 })
      return '0xdeploy'
    })
  }

  const flush = async (): Promise<void> => {
    await new Promise((resolve) => setImmediate(resolve))
  }

  test.each([
    [
      'deployProject',
      (extra: object) =>
        deployProject({ ...makeConfig(), fileUrl: 'ipfs://QmExisting' }, makeJob(), {
          wallet,
          rpcEndpoint: REMOTE_WS,
          ipfs: { endpoint: '', apiKey: '' },
          envVars: [{ key: 'K', value: 'v' }],
          statusCallback: jest.fn(),
          ...extra,
        }),
    ],
    [
      'deployProjectBrowser',
      (extra: object) =>
        deployProjectBrowser({ ...makeConfig(), fileUrl: 'ipfs://QmExisting' }, makeJob(), {
          wallet,
          rpcEndpoint: REMOTE_WS,
          envVars: [{ key: 'K', value: 'v' }],
          statusCallback: jest.fn(),
          ...extra,
        }),
    ],
  ])('%s passes the opt-in to the provider and to setEnvVars', async (_name, run) => {
    acknowledgeOnRegister()
    await run({ allowInsecureRpcEndpoint: true })
    await flush()

    expect(wsProviderMock.mock.calls.map((call) => call[0])).toEqual([REMOTE_WS])
    expect(registerJobMock).toHaveBeenCalledTimes(1)
    expect(setEnvVarsMock).toHaveBeenCalledTimes(1)
    expect(setEnvVarsMock.mock.calls[0][1]).toMatchObject({
      rpcEndpoint: REMOTE_WS,
      allowInsecureRpcEndpoint: true,
    })
  })

  test('deployProjectCore accepts wss:// without the opt-in', async () => {
    acknowledgeOnRegister()
    const resolveScript = jest.fn().mockResolvedValue('ipfs://QmX')
    await deployProjectCore(makeConfig(), makeJob(), {
      wallet,
      rpcEndpoint: 'wss://rpc.example.com',
      envVars: [{ key: 'K', value: 'v' }],
      statusCallback: jest.fn(),
      resolveScript,
    })
    await flush()

    expect(wsProviderMock.mock.calls.map((call) => call[0])).toEqual(['wss://rpc.example.com'])
    expect(resolveScript).toHaveBeenCalledTimes(1)
    expect(setEnvVarsMock.mock.calls[0][1]).toMatchObject({
      rpcEndpoint: 'wss://rpc.example.com',
      allowInsecureRpcEndpoint: undefined,
    })
  })
})
