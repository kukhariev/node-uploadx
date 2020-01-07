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
    project: './tsconfig.eslint.json'
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:promise/recommended',
    'plugin:prettier/recommended',
    'prettier',
    'prettier/@typescript-eslint'
  ],
  plugins: ['@typescript-eslint', 'prettier', 'promise'],
  rules: {
    'prettier/prettier': 'warn',
    '@typescript-eslint/adjacent-overload-signatures': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/class-name-casing': 'error',
    '@typescript-eslint/explicit-function-return-type': [
      'warn',
      { allowExpressions: true, allowTypedFunctionExpressions: true }
    ],
    '@typescript-eslint/explicit-member-accessibility': 'off',
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-parameter-properties': 'off',
    '@typescript-eslint/no-this-alias': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { args: 'none' }],
    '@typescript-eslint/prefer-function-type': 'error',
    '@typescript-eslint/prefer-namespace-keyword': 'error',
    '@typescript-eslint/promise-function-async': 'off',
    '@typescript-eslint/member-ordering': 'error',
    '@typescript-eslint/require-await': 'off',
    'no-empty': 'off',
    'no-irregular-whitespace': 'error',
    'no-return-assign': 'error',
    'no-return-await': 'error',
    'no-shadow': 'error',
    'no-throw-literal': 'error',
    'no-undef': 'off',
    'no-useless-call': 'error',
    'no-useless-concat': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'prefer-object-spread': 'error',
    'promise/no-callback-in-promise': ['error', { exceptions: ['next'] }],
    'lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: true }],
    'prefer-template': 'error',
    'prefer-arrow-callback': 'warn'
  },
  overrides: [
    {
      files: ['examples/**/*.*'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        'no-console': 'off'
      }
    }
  ]
};
