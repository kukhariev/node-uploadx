module.exports = {
  env: {
    browser: false,
    es6: true,
    node: true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'node',
    sourceType: 'module',
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json', 'packages/tsconfig.json', 'examples/tsconfig.json'],
    warnOnUnsupportedTypeScriptVersion: false
  },
  extends: [
    'eslint:recommended',
    'plugin:jest/recommended',
    'plugin:jest/style',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:prettier/recommended',
    'plugin:jest-formatting/recommended'
  ],
  rules: {
    'prettier/prettier': 'warn',
    '@typescript-eslint/adjacent-overload-signatures': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/explicit-function-return-type': [
      'warn',
      { allowExpressions: true, allowTypedFunctionExpressions: true }
    ],
    '@typescript-eslint/explicit-member-accessibility': 'off',
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-parameter-properties': 'off',
    '@typescript-eslint/no-shadow': 'error',
    '@typescript-eslint/no-this-alias': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { args: 'none' }],
    '@typescript-eslint/prefer-function-type': 'error',
    '@typescript-eslint/prefer-namespace-keyword': 'error',
    '@typescript-eslint/promise-function-async': 'off',
    '@typescript-eslint/member-ordering': 'warn',
    '@typescript-eslint/require-await': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'typeParameter',
        format: ['PascalCase'],
        prefix: ['T', 'K']
      }
    ],
    'jest/expect-expect': ['error', { assertFunctionNames: ['expect', 'request.**.expect'] }],
    'no-empty': 'off',
    'no-irregular-whitespace': 'error',
    'no-return-assign': 'error',
    'no-return-await': 'error',
    'no-throw-literal': 'error',
    'no-undef': 'off',
    'no-useless-call': 'error',
    'no-useless-concat': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'prefer-object-spread': 'error',
    'lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: true }],
    'prefer-template': 'error',
    'prefer-arrow-callback': 'warn',
    'linebreak-style': ['error', 'unix'],
    'no-console': 'error'
  },
  overrides: [
    {
      files: ['examples/**/*.*'],
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'off',
        'no-console': 'off'
      }
    },
    {
      files: ['examples/**/*.js'],
      rules: {
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/restrict-template-expressions': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off'
      }
    }
  ]
};
