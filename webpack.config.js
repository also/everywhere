module.exports = {
  context: __dirname + "/app",
  entry: './entry',
  output: {
    path: __dirname + '/build',
    filename: 'app.js',
    chunkFilename: 'app-[name].js'
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
