export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['./test'],
  transform: {
    // `types` is set explicitly because the hoisted @types/jest in the
    // workspace root is not auto-discovered from this package.
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: { types: ['jest', 'node'], isolatedModules: true },
      },
    ],
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
}
