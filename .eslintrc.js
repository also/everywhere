module.exports = {
  env: {
    node: true,
  },
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 0,
    'react/react-in-jsx-scope': 0,
    '@typescript-eslint/no-this-alias': 0,
    // FIXME
    '@typescript-eslint/explicit-module-boundary-types': 0,
    '@typescript-eslint/no-inferrable-types': 0,
  },
};
