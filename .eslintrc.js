module.exports = {
  root: true,
  env: {
    browser: true,
    es6: true,
    node: true
  },
  extends: ['standard-with-typescript', 'prettier'],
  overrides: [
    {
      env: {
        node: true
      },
      files: ['*.js', '*.ts'],
      parserOptions: {
        project: './tsconfig.json'
      },
      rules: {
        quotes: ['warn', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
        semi: ['warn', 'never'],
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/method-signature-style': ['error', 'method'],
        '@typescript-eslint/consistent-generic-constructors': ['error', 'type-annotation']
      }
    }
  ],
  parserOptions: {
    sourceType: 'module'
  }
}
