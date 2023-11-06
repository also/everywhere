/* eslint-disable @typescript-eslint/no-var-requires */

const fs = require('fs');
const path = require('path');

module.exports = (env) => ({
  context: __dirname + '/app',
  entry: './entry',
  output: {
    path: __dirname + '/site/build',
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
        type: 'json',
      },
      {
        test: /\.s[ac]ss$/,
        loader: 'sass-loader',
      },
      {
        test: /\.mdx?$/,
        use: [
          {
            loader: '@mdx-js/loader',
            /** @type {import('@mdx-js/loader').Options} */
            options: { jsxImportSource: 'also-mdx-jsx-runtime' },
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    alias: {
      'also-mdx-jsx-runtime': path.resolve(
        __dirname,
        'app/docs/also-mdx-jsx-runtime'
      ),
    },
  },
  resolveLoader: {
    alias: {
      'compact-json$': 'compact-json-loader',
    },
  },
  devServer: env.WEBPACK_SERVE
    ? {
        devMiddleware: { publicPath: '/build' },
        static: {
          directory: __dirname + '/site',
        },
        client: {
          overlay: false,
        },
        https: {
          key: fs.readFileSync(path.join(__dirname, 'key.pem')),
          cert: fs.readFileSync(path.join(__dirname, 'cert.pem')),
        },
        onBeforeSetupMiddleware(devServer) {
          devServer.app.get('/strava-auth', async (req, res) => {
            try {
              require('ts-node').register({ transpileOnly: true });
              const { loginHandler } = require('./tools/strava-creds');
              const redirectUrl = await loginHandler(req.query);
              if (redirectUrl) {
                res.redirect(redirectUrl);
              } else {
                res.send('ok');
              }
            } catch (e) {
              res.status(500).send(e.stack);
            }
          });
        },
      }
    : undefined,
});
