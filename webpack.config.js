module.exports = {
  context: __dirname + "/app",
  entry: './entry',
  output: {
    filename: 'bundle.js'
  },
  module: {
    loaders: [
      {
        test: /\.jsx?$/,
        exclude: /(node_modules|bower_components)/,
        loader: 'babel',
        query: {
          optional: ['runtime']
        }
      }
    ]
  }
};
