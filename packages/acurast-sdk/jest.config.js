export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['./src', './test'],
  transform: {
    // `types` is set explicitly because the hoisted @types/jest in the
    // workspace root is not auto-discovered from this package.
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: { types: ['jest', 'node'] },
        // TS151002: Node16 module kind without isolatedModules; type-checking is wanted here.
        diagnostics: { ignoreCodes: [151002] },
      },
    ],
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
}
