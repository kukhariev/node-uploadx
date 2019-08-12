module.exports = {
  env: {
    browser: false,
    es6: true,
    node: true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
    'prettier/@typescript-eslint',
    'plugin:prettier/recommended'
  ],
  plugins: ['@typescript-eslint', 'prettier'],
  rules: {
    'prettier/prettier': 'warn',
    '@typescript-eslint/adjacent-overload-signatures': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/class-name-casing': 'error',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-member-accessibility': 'off',
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-namespace': 'off', // we can do this later
    '@typescript-eslint/no-parameter-properties': 'off',
    '@typescript-eslint/no-this-alias': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { args: 'none' }],
    '@typescript-eslint/prefer-function-type': 'error',
    '@typescript-eslint/prefer-namespace-keyword': 'error',
    '@typescript-eslint/promise-function-async': 'off',
    '@typescript-eslint/member-ordering': 'error',
    'arrow-body-style': 'error',
    'linebreak-style': ['error', 'unix'],
    'no-alert': 'error',
    'no-empty': 'off',
    'no-irregular-whitespace': 'error',
    'no-return-assign': 'error',
    'no-return-await': 'error',
    'no-shadow': 'error',
    'no-throw-literal': 'error',
    'no-console': 'off',
    'no-undef': 'off',
    'no-useless-call': 'error',
    'no-useless-concat': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'prefer-const': 'error',
    'prefer-object-spread': 'error',
    'require-atomic-updates': 'off'
  },
  overrides: [
    {
      files: ['**/*.js'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off'
      }
    }
  ]
};
