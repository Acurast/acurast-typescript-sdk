import { JobEnvironmentService } from '../src/chain/env-encryption.js'
import type { AcurastService } from '../src/chain/acurast-service.js'
import type { AcurastSigner } from '../src/chain/signer.js'
import type { JobAssignmentInfo } from '../src/types/env.js'

const assignment = (pubKeys: unknown[]): JobAssignmentInfo =>
  ({
    id: [{ acurast: 'owner' }, 1],
    processor: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
    assignment: { pubKeys },
  }) as unknown as JobAssignmentInfo

describe('JobEnvironmentService.setEnvironmentVariablesMulti', () => {
  it('does not submit an empty setEnvironments extrinsic when no processor has an encryption key', async () => {
    const setEnvironments = jest.fn(async () => '0xhash')
    const service = new JobEnvironmentService({
      acurastService: { setEnvironments } as unknown as AcurastService,
    })

    await expect(
      service.setEnvironmentVariablesMulti(
        {} as AcurastSigner,
        // A processor that only published a non-encryption key.
        [assignment([{ SECP256k1: '0x02abcdef' }]), assignment([])],
        1,
        [{ key: 'API_KEY', value: 'secret' }],
      ),
    ).rejects.toThrow('No assigned processor has a usable encryption key')
    expect(setEnvironments).not.toHaveBeenCalled()
  })
})
