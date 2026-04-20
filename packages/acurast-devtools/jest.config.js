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
    '^.+\\.tsx?$': ['ts-jest', { useESM: true }],
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
}
