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
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        loader: 'babel-loader',
        options: {
          presets: [['@babel/preset-react', { runtime: 'automatic' }]],
        },
      },
      {
        test: /\.tsx?$/,
        exclude: /(node_modules|bower_components)/,
        loader: 'babel-loader',
        options: {
          presets: [
            '@babel/preset-typescript',
            ['@babel/preset-react', { runtime: 'automatic' }],
            [
              '@babel/preset-env',
              {
                targets: {
                  safari: 14,
                },
              },
            ],
          ],
        },
      },
      {
        test: /\.json$/,
        type: 'javascript/auto',
      },
      {
        test: /\.s[ac]ss$/,
        loader: 'sass-loader',
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },
  resolveLoader: {
    alias: {
      'compact-json$': 'compact-json-loader',
    },
  },
  devServer: {
    publicPath: '/build',
  },
};
