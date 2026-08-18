import { RestartPolicy, MultiOrigin } from '../src/types/project.js'
import { validateConfig } from '../src/types/validate-config.js'

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
    const baseProject = () =>
      structuredClone(simpleExample.projects['acurast-example-app-fetch'])

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
