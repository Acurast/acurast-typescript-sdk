import { RestartPolicy, MultiOrigin, DeploymentRuntime } from '../src/types/project.js'
import { validateConfig } from '../src/types/validate-config.js'

const VALID_SHA256 = '5ab35b90cd9a9f180656261ba400a135c4c01c2da4b74522118342f985c2d328'
// Well-known development accounts (Alice in SS58 generic format and as hex).
const ALICE_SS58 = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
const ALICE_HEX = '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d'

const simpleExample = {
  projects: {
    'acurast-example-app-fetch': {
      projectName: 'acurast-example-app-fetch',
      fileUrl: 'dist/bundle.js',
      network: 'canary',
      onlyAttestedDevices: true,
      assignmentStrategy: {
        type: 'Single',
      },
      execution: {
        type: 'onetime',
        maxExecutionTimeInMs: 60000,
      },
      maxAllowedStartDelayInMs: 10000,
      usageLimit: {
        maxMemory: 0,
        maxNetworkRequests: 0,
        maxStorage: 0,
      },
      numberOfReplicas: 5,
      requiredModules: [],
      minProcessorReputation: 0,
      maxCostPerExecution: 1000000000,
      includeEnvironmentVariables: [],
      processorWhitelist: [],
      minProcessorVersions: {
        android: 70,
      },
    },
  },
}

const processorVersionAndRuntimeExample = {
  projects: {
    test: {
      projectName: 'test',
      fileUrl: 'dist/bundle.js',
      network: 'canary',
      onlyAttestedDevices: true,
      assignmentStrategy: {
        type: 'Single',
      },
      execution: {
        type: 'onetime',
        maxExecutionTimeInMs: 60000,
      },
      maxAllowedStartDelayInMs: 10000,
      usageLimit: {
        maxMemory: 0,
        maxNetworkRequests: 0,
        maxStorage: 0,
      },
      numberOfReplicas: 5,
      requiredModules: [],
      minProcessorReputation: 0,
      maxCostPerExecution: 1000000000,
      includeEnvironmentVariables: [],
      processorWhitelist: [],
      restartPolicy: RestartPolicy.OnFailure,
    },
  },
}

const mutabilityAndReuseKeysExample = {
  projects: {
    test: {
      projectName: 'test',
      fileUrl: 'dist/bundle.js',
      network: 'canary',
      onlyAttestedDevices: true,
      assignmentStrategy: {
        type: 'Single',
      },
      execution: {
        type: 'onetime',
        maxExecutionTimeInMs: 60000,
      },
      maxAllowedStartDelayInMs: 10000,
      usageLimit: {
        maxMemory: 0,
        maxNetworkRequests: 0,
        maxStorage: 0,
      },
      numberOfReplicas: 5,
      requiredModules: [],
      minProcessorReputation: 0,
      maxCostPerExecution: 1000000000,
      includeEnvironmentVariables: [],
      processorWhitelist: [],
      mutability: 'Immutable',
      reuseKeysFrom: [
        MultiOrigin.Acurast,
        '5CiPPseXPECbkjWCa6MnjNokrgYjMqmKndv2rSnekmSK2DjL',
        123456,
      ],
    },
  },
}

const mutableWithValidVersionsExample = {
  projects: {
    test: {
      projectName: 'test',
      fileUrl: 'dist/bundle.js',
      network: 'canary',
      onlyAttestedDevices: true,
      assignmentStrategy: {
        type: 'Single',
      },
      execution: {
        type: 'onetime',
        maxExecutionTimeInMs: 60000,
      },
      maxAllowedStartDelayInMs: 10000,
      usageLimit: {
        maxMemory: 0,
        maxNetworkRequests: 0,
        maxStorage: 0,
      },
      numberOfReplicas: 5,
      requiredModules: [],
      minProcessorReputation: 0,
      maxCostPerExecution: 1000000000,
      includeEnvironmentVariables: [],
      processorWhitelist: [],
      mutability: 'Mutable',
      minProcessorVersions: {
        android: 91,
        ios: 63353,
      },
    },
  },
}

const mutableWithoutVersionsExample = {
  projects: {
    test: {
      projectName: 'test',
      fileUrl: 'dist/bundle.js',
      network: 'canary',
      onlyAttestedDevices: true,
      assignmentStrategy: {
        type: 'Single',
      },
      execution: {
        type: 'onetime',
        maxExecutionTimeInMs: 60000,
      },
      maxAllowedStartDelayInMs: 10000,
      usageLimit: {
        maxMemory: 0,
        maxNetworkRequests: 0,
        maxStorage: 0,
      },
      numberOfReplicas: 5,
      requiredModules: [],
      minProcessorReputation: 0,
      maxCostPerExecution: 1000000000,
      includeEnvironmentVariables: [],
      processorWhitelist: [],
      mutability: 'Mutable',
    },
  },
}

const mutableWithInvalidAndroidVersionExample = {
  projects: {
    test: {
      projectName: 'test',
      fileUrl: 'dist/bundle.js',
      network: 'canary',
      onlyAttestedDevices: true,
      assignmentStrategy: {
        type: 'Single',
      },
      execution: {
        type: 'onetime',
        maxExecutionTimeInMs: 60000,
      },
      maxAllowedStartDelayInMs: 10000,
      usageLimit: {
        maxMemory: 0,
        maxNetworkRequests: 0,
        maxStorage: 0,
      },
      numberOfReplicas: 5,
      requiredModules: [],
      minProcessorReputation: 0,
      maxCostPerExecution: 1000000000,
      includeEnvironmentVariables: [],
      processorWhitelist: [],
      mutability: 'Mutable',
      minProcessorVersions: {
        android: 70,
        ios: 63353,
      },
    },
  },
}

const mutableWithInvalidIOSVersionExample = {
  projects: {
    test: {
      projectName: 'test',
      fileUrl: 'dist/bundle.js',
      network: 'canary',
      onlyAttestedDevices: true,
      assignmentStrategy: {
        type: 'Single',
      },
      execution: {
        type: 'onetime',
        maxExecutionTimeInMs: 60000,
      },
      maxAllowedStartDelayInMs: 10000,
      usageLimit: {
        maxMemory: 0,
        maxNetworkRequests: 0,
        maxStorage: 0,
      },
      numberOfReplicas: 5,
      requiredModules: [],
      minProcessorReputation: 0,
      maxCostPerExecution: 1000000000,
      includeEnvironmentVariables: [],
      processorWhitelist: [],
      mutability: 'Mutable',
      minProcessorVersions: {
        android: 91,
        ios: 60000,
      },
    },
  },
}

const mutableWithValidAndroidOnlyExample = {
  projects: {
    test: {
      projectName: 'test',
      fileUrl: 'dist/bundle.js',
      network: 'canary',
      onlyAttestedDevices: true,
      assignmentStrategy: {
        type: 'Single',
      },
      execution: {
        type: 'onetime',
        maxExecutionTimeInMs: 60000,
      },
      maxAllowedStartDelayInMs: 10000,
      usageLimit: {
        maxMemory: 0,
        maxNetworkRequests: 0,
        maxStorage: 0,
      },
      numberOfReplicas: 5,
      requiredModules: [],
      minProcessorReputation: 0,
      maxCostPerExecution: 1000000000,
      includeEnvironmentVariables: [],
      processorWhitelist: [],
      mutability: 'Mutable',
      minProcessorVersions: {
        android: 91,
      },
    },
  },
}

const mutableWithValidIOSOnlyExample = {
  projects: {
    test: {
      projectName: 'test',
      fileUrl: 'dist/bundle.js',
      network: 'canary',
      onlyAttestedDevices: true,
      assignmentStrategy: {
        type: 'Single',
      },
      execution: {
        type: 'onetime',
        maxExecutionTimeInMs: 60000,
      },
      maxAllowedStartDelayInMs: 10000,
      usageLimit: {
        maxMemory: 0,
        maxNetworkRequests: 0,
        maxStorage: 0,
      },
      numberOfReplicas: 5,
      requiredModules: [],
      minProcessorReputation: 0,
      maxCostPerExecution: 1000000000,
      includeEnvironmentVariables: [],
      processorWhitelist: [],
      mutability: 'Mutable',
      minProcessorVersions: {
        ios: 63353,
      },
    },
  },
}

const mutableWithInvalidVersionsExample = {
  projects: {
    test: {
      projectName: 'test',
      fileUrl: 'dist/bundle.js',
      network: 'canary',
      onlyAttestedDevices: true,
      assignmentStrategy: {
        type: 'Single',
      },
      execution: {
        type: 'onetime',
        maxExecutionTimeInMs: 60000,
      },
      maxAllowedStartDelayInMs: 10000,
      usageLimit: {
        maxMemory: 0,
        maxNetworkRequests: 0,
        maxStorage: 0,
      },
      numberOfReplicas: 5,
      requiredModules: [],
      minProcessorReputation: 0,
      maxCostPerExecution: 1000000000,
      includeEnvironmentVariables: [],
      processorWhitelist: [],
      mutability: 'Mutable',
      minProcessorVersions: {
        android: 70,
        ios: 60000,
      },
    },
  },
}

describe('validateConfig', () => {
  test('should handle a valid simple example', () => {
    const project = simpleExample.projects['acurast-example-app-fetch']
    const result = validateConfig(project)

    expect(result.success).toEqual(true)
    if (result.success) {
      expect(result.data).toEqual(project)
    }
  })

  test('should handle a valid example with processor version and runtime', () => {
    const project = processorVersionAndRuntimeExample.projects['test']
    const result = validateConfig(project)

    expect(result.success).toEqual(true)
    if (result.success) {
      expect(result.data).toEqual(project)
    }
  })

  test('should handle a valid example with mutability and reuseKeysFrom', () => {
    const project = mutabilityAndReuseKeysExample.projects['test']
    const result = validateConfig(project)

    expect(result.success).toEqual(true)
    if (result.success) {
      expect(result.data).toEqual(project)
    }
  })

  test('should handle a valid example with mutable mutability and valid processor versions', () => {
    const project = mutableWithValidVersionsExample.projects['test']
    const result = validateConfig(project)

    expect(result.success).toEqual(true)
    if (result.success) {
      expect(result.data).toEqual(project)
    }
  })

  test('should handle a valid example with mutable mutability and valid Android version only', () => {
    const project = mutableWithValidAndroidOnlyExample.projects['test']
    const result = validateConfig(project)

    expect(result.success).toEqual(true)
    if (result.success) {
      expect(result.data).toEqual(project)
    }
  })

  test('should handle a valid example with mutable mutability and valid iOS version only', () => {
    const project = mutableWithValidIOSOnlyExample.projects['test']
    const result = validateConfig(project)

    expect(result.success).toEqual(true)
    if (result.success) {
      expect(result.data).toEqual(project)
    }
  })

  // test('should reject mutable mutability without minProcessorVersions', () => {
  //   const project = mutableWithoutVersionsExample.projects['test']
  //   const result = validateConfig(project)

  //   expect(result.success).toEqual(false)
  //   expect(result.notes).toEqual([
  //     {
  //       code: 'custom',
  //       message:
  //         'When mutability is set to "Mutable", minProcessorVersions must include at least one platform with Android version code 91 or iOS version code 63353.',
  //       path: ['mutability'],
  //     },
  //   ])
  // })

  // test('should reject mutable mutability with invalid versions for both platforms', () => {
  //   const project = mutableWithInvalidVersionsExample.projects['test']
  //   const result = validateConfig(project)

  //   expect(result.success).toEqual(false)
  //   expect(result.notes).toEqual([
  //     {
  //       code: 'custom',
  //       message:
  //         'When mutability is set to "Mutable", minProcessorVersions must include at least one platform with Android version code 91 or iOS version code 63353.',
  //       path: ['mutability'],
  //     },
  //   ])
  // })

  describe('runtime schedule limits', () => {
    const baseProject = () => structuredClone(simpleExample.projects['acurast-example-app-fetch'])

    test('should accept a onetime execution of exactly 1 minute', () => {
      const project = baseProject()
      project.execution = { type: 'onetime', maxExecutionTimeInMs: 60_000 } as any
      expect(validateConfig(project).success).toEqual(true)
    })

    test('should reject a onetime execution below 1 minute', () => {
      const project = baseProject()
      project.execution = { type: 'onetime', maxExecutionTimeInMs: 59_999 } as any
      const result = validateConfig(project)
      expect(result.success).toEqual(false)
      if (!result.success) {
        expect(JSON.stringify(result.error)).toContain('at least 1 minute')
      }
    })

    test('should reject an interval execution with explicit duration below 1 minute', () => {
      const project = baseProject()
      project.execution = {
        type: 'interval',
        intervalInMs: 120_000,
        numberOfExecutions: 2,
        maxExecutionTimeInMs: 30_000,
      } as any
      const result = validateConfig(project)
      expect(result.success).toEqual(false)
      if (!result.success) {
        expect(JSON.stringify(result.error)).toContain('at least 1 minute')
      }
    })

    test('should accept an interval execution whose derived duration is exactly 1 minute', () => {
      // duration defaults to intervalInMs - 10_000 - 1
      const project = baseProject()
      project.execution = {
        type: 'interval',
        intervalInMs: 70_001,
        numberOfExecutions: 2,
      } as any
      expect(validateConfig(project).success).toEqual(true)
    })

    test('should reject an interval execution whose derived duration is below 1 minute', () => {
      const project = baseProject()
      project.execution = {
        type: 'interval',
        intervalInMs: 70_000,
        numberOfExecutions: 2,
      } as any
      const result = validateConfig(project)
      expect(result.success).toEqual(false)
      if (!result.success) {
        expect(JSON.stringify(result.error)).toContain('intervalInMs')
      }
    })

    test('should accept a start time exactly 24 hours from now', () => {
      const project = baseProject()
      ;(project as any).startAt = { msFromNow: 24 * 60 * 60 * 1000 }
      expect(validateConfig(project).success).toEqual(true)
    })

    test('should reject a start time more than 24 hours from now (msFromNow)', () => {
      const project = baseProject()
      ;(project as any).startAt = { msFromNow: 24 * 60 * 60 * 1000 + 1 }
      const result = validateConfig(project)
      expect(result.success).toEqual(false)
      if (!result.success) {
        expect(JSON.stringify(result.error)).toContain('more than 24 hours')
      }
    })

    test('should reject a start time more than 24 hours from now (timestamp)', () => {
      const project = baseProject()
      ;(project as any).startAt = { timestamp: Date.now() + 25 * 60 * 60 * 1000 }
      const result = validateConfig(project)
      expect(result.success).toEqual(false)
      if (!result.success) {
        expect(JSON.stringify(result.error)).toContain('more than 24 hours')
      }
    })
  })

  describe('resetExitCode', () => {
    const shellProject = () => {
      const project = structuredClone(simpleExample.projects['acurast-example-app-fetch']) as any
      project.runtime = DeploymentRuntime.Shell
      project.entrypoint = 'acurast.sh'
      project.image = { url: 'https://example.com/distro.tar.xz', sha256: VALID_SHA256 }
      return project
    }

    test('should be unset by default', () => {
      const result = validateConfig(shellProject())
      expect(result.success).toEqual(true)
      if (result.success) {
        expect(result.data.resetExitCode).toBeUndefined()
      }
    })

    test('should accept integers between 1 and 125 for the Shell runtime without notes', () => {
      for (const code of [1, 82, 125]) {
        const project = shellProject()
        project.resetExitCode = code
        const result = validateConfig(project)
        expect(result.success).toEqual(true)
        if (result.success) {
          expect(result.data.resetExitCode).toEqual(code)
        }
        expect(result.notes).toBeUndefined()
      }
    })

    test('should reject values outside 1-125, non-integers and non-numbers', () => {
      for (const code of [0, 126, -1, 1.5, '82', null, true]) {
        const project = shellProject()
        project.resetExitCode = code
        const result = validateConfig(project)
        expect(result.success).toEqual(false)
        if (!result.success) {
          expect(result.error.issues[0].path).toEqual(['resetExitCode'])
          expect(result.error.issues[0].message).toEqual(
            'resetExitCode must be an integer between 1 and 125',
          )
        }
      }
    })

    test('should warn (not fail) when set for a non-Shell runtime', () => {
      const project = structuredClone(simpleExample.projects['acurast-example-app-fetch']) as any
      project.resetExitCode = 82
      const result = validateConfig(project)
      expect(result.success).toEqual(true)
      expect(result.notes).toEqual([
        {
          code: 'custom',
          message:
            'Warning: resetExitCode only applies to the Shell runtime and is ignored for other runtimes.',
          path: ['resetExitCode'],
        },
      ])
    })
  })

  describe('addresses', () => {
    const base = () => structuredClone(simpleExample.projects['acurast-example-app-fetch']) as any

    test.each([ALICE_SS58, ALICE_HEX])('should accept %p in processorWhitelist', (address) => {
      const project = base()
      project.processorWhitelist = [address]
      expect(validateConfig(project).success).toEqual(true)
    })

    test.each([
      'not-an-address',
      '',
      // Alice with the last character changed: bad checksum.
      '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQZ',
      // 31-byte hex account id.
      '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da2',
    ])('should reject %p in processorWhitelist and instantMatch', (address) => {
      const whitelisted = base()
      whitelisted.processorWhitelist = [ALICE_SS58, address]
      const result = validateConfig(whitelisted)
      expect(result.success).toEqual(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['processorWhitelist', 1])
        expect(result.error.issues[0].message).toEqual('Invalid Acurast address')
      }

      const matched = base()
      matched.numberOfReplicas = 1
      matched.assignmentStrategy = {
        type: 'Single',
        instantMatch: [{ processor: address, maxAllowedStartDelayInMs: 10_000 }],
      }
      const matchedResult = validateConfig(matched)
      expect(matchedResult.success).toEqual(false)
      if (!matchedResult.success) {
        expect(matchedResult.error.issues[0].path).toEqual([
          'assignmentStrategy',
          'instantMatch',
          0,
          'processor',
        ])
      }
    })
  })

  describe('image', () => {
    const withImage = (image: unknown) => {
      const project = structuredClone(simpleExample.projects['acurast-example-app-fetch']) as any
      project.image = image
      return project
    }

    test('should accept an https URL with a 64-character hex hash', () => {
      expect(
        validateConfig(withImage({ url: 'https://example.com/d.tar.xz', sha256: VALID_SHA256 }))
          .success,
      ).toEqual(true)
    })

    test.each([
      ['http://example.com/d.tar.xz', VALID_SHA256, 'url'],
      ['ftp://example.com/d.tar.xz', VALID_SHA256, 'url'],
      ['not a url', VALID_SHA256, 'url'],
      ['https://example.com/d.tar.xz', '', 'sha256'],
      ['https://example.com/d.tar.xz', 'abc', 'sha256'],
      ['https://example.com/d.tar.xz', VALID_SHA256.slice(1), 'sha256'],
      ['https://example.com/d.tar.xz', `${VALID_SHA256.slice(1)}g`, 'sha256'],
    ])('should reject url %p with sha256 %p', (url, sha256, field) => {
      const result = validateConfig(withImage({ url, sha256 }))
      expect(result.success).toEqual(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['image', field])
      }
    })
  })

  describe('onlyAttestedDevices', () => {
    test('should warn when env vars go to unattested devices', () => {
      const project = structuredClone(simpleExample.projects['acurast-example-app-fetch']) as any
      project.onlyAttestedDevices = false
      project.includeEnvironmentVariables = ['API_KEY']
      const result = validateConfig(project)
      expect(result.success).toEqual(true)
      expect(result.notes?.map((n) => n.path)).toEqual([
        ['onlyAttestedDevices'],
        ['includeEnvironmentVariables'],
      ])
    })

    test('should only add the general note without env vars', () => {
      const project = structuredClone(simpleExample.projects['acurast-example-app-fetch']) as any
      project.onlyAttestedDevices = false
      const result = validateConfig(project)
      expect(result.notes?.map((n) => n.path)).toEqual([['onlyAttestedDevices']])
    })
  })

  describe('projectName', () => {
    const withName = (name: unknown) => {
      const project = structuredClone(simpleExample.projects['acurast-example-app-fetch']) as any
      project.projectName = name
      return project
    }

    test.each(['acurast-example-app-fetch', 'a', 'My_App.v2', 'x'.repeat(64)])(
      'should accept %p',
      (name) => {
        expect(validateConfig(withName(name)).success).toEqual(true)
      },
    )

    test.each([
      '../../escaped',
      '..',
      '.',
      'a/b',
      'a\\b',
      '/abs',
      '',
      'has space',
      'nul\0byte',
      'x'.repeat(65),
    ])('should reject %p', (name) => {
      const result = validateConfig(withName(name))
      expect(result.success).toEqual(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['projectName'])
      }
    })
  })

  test('should throw an error when the project name is missing', () => {
    const project = simpleExample.projects['acurast-example-app-fetch']
    delete (project as any).projectName
    const result = validateConfig(project)

    expect(result.success).toEqual(false)
    expect(result.notes).toEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        received: 'undefined',
        path: ['projectName'],
        message: 'Required',
      },
    ])
  })
})
