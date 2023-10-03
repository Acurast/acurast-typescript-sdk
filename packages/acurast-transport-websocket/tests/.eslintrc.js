module.exports = {
  env: {
    mocha: true
  },
  plugins: [
    'mocha'
  ],
  extends: ['plugin:mocha/recommended'],
  overrides: [
    {
      env: {
        mocha: true
      },
      files: ['*.js', '*.ts'],
      parserOptions: {
        project: './packages/acurast-transport-websocket/tests/tsconfig.json'
      }
    }
  ]
}
