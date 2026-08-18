export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['./src', './test'],
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
      useESM: true,
    },
  },
  transform: {
    // `types` is set explicitly because the hoisted @types/jest in the
    // workspace root is not auto-discovered from this package.
    '^.+\\.tsx?$': ['ts-jest', { useESM: true, tsconfig: { types: ['jest', 'node'] } }],
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
}
