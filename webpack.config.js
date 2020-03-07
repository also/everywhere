module.exports = {
  context: __dirname + '/app',
  entry: './entry',
  output: {
    path: __dirname + '/build',
    filename: 'app.js',
    chunkFilename: 'app-[name].js',
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /(node_modules|bower_components)/,
        loader: 'babel-loader',
        query: {
          presets: ['@babel/preset-react'],
        },
      },
      {
        test: /\.json$/,
        type: 'javascript/auto',
      },
      {
        test: /\.s[ac]ss$/,
        loader: 'sass-loader',
        query: {
          sassOptions: { includePaths: require('bourbon').includePaths },
        },
      },
    ],
  },
  resolveLoader: {
    alias: {
      'compact-json$': 'compact-json-loader',
      css$: 'css-loader',
      style$: 'style-loader',
    },
  },
};
