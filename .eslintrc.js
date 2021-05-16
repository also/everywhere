module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 0,
    'react/react-in-jsx-scope': 0,
    // FIXME
    '@typescript-eslint/explicit-module-boundary-types': 0,
  },
};