require('@babel/register')({
  plugins: ['@babel/plugin-transform-modules-commonjs'],
});

require('./main.js').default();
