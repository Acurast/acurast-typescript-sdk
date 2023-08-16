module.exports = {
  module: {
    rules: [
      { 
        test: /\.ts$/, 
        loader: 'ts-loader',
        exclude: nodeModules
      }
    ],
    exprContextCritical: false
  },
  resolve: {
    extensions: ['.js', '.ts'],
  }
}