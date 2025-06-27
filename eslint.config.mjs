import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import jestPlugin from 'eslint-plugin-jest';
import jestFormattingPlugin from 'eslint-plugin-jest-formatting';
import globals from 'globals';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';


export default [
  // Base JavaScript configuration
  js.configs.recommended,

  // TypeScript files only
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      globals: {
        ...globals.node,
        ...Object.fromEntries(Object.entries(globals.browser).map(([key]) => [key, 'off']))
      },
      parserOptions: {
        tsconfigRootDir: dirname(fileURLToPath(import.meta.url)),
        project: ['tsconfig.json', 'packages/tsconfig.json', 'examples/tsconfig.json'],
        warnOnUnsupportedTypeScriptVersion: false,
        EXPERIMENTAL_useSourceOfProjectReferenceRedirect: true
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      prettier: prettierPlugin
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...tsPlugin.configs['recommended-requiring-type-checking'].rules,
      ...prettierConfig.rules,

      // Prettier
      'prettier/prettier': 'warn',

      // TypeScript specific rules
      '@typescript-eslint/no-unsafe-declaration-merging': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/adjacent-overload-signatures': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true
        }
      ],
      '@typescript-eslint/explicit-member-accessibility': 'off',
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-parameter-properties': 'off',
      '@typescript-eslint/no-shadow': 'error',
      '@typescript-eslint/no-this-alias': 'error',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-require-imports': 'off',
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
          format: ['PascalCase']
        }
      ],

      // General rules
      'no-redeclare': 'off',
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
      quotes: ['error', 'single'],
      'no-console': 'error'
    }
  },

  // JavaScript files
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.node
      }
    },
    plugins: {
      prettier: prettierPlugin
    },
    rules: {
      ...prettierConfig.rules,
      'prettier/prettier': 'warn',
      'no-empty': 'off',
      'no-irregular-whitespace': 'error',
      'no-return-assign': 'error',
      'no-return-await': 'error',
      'no-throw-literal': 'error',
      'no-useless-call': 'error',
      'no-useless-concat': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-object-spread': 'error',
      'lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: true }],
      'prefer-template': 'error',
      'prefer-arrow-callback': 'warn',
      'linebreak-style': ['error', 'unix'],
      quotes: ['error', 'single'],
      'no-console': 'error'
    }
  },

  // Test files configuration
  {
    files: ['test/**/*.{ts,js}'],
    languageOptions: {
      globals: {
        ...globals.jest
      }
    },
    plugins: {
      jest: jestPlugin,
      'jest-formatting': jestFormattingPlugin
    },
    rules: {
      ...jestPlugin.configs.recommended.rules,
      ...jestPlugin.configs.style.rules,
      ...jestFormattingPlugin.configs.recommended.rules,

      '@typescript-eslint/unbound-method': 'off',
      'jest/expect-expect': [
        'error',
        {
          assertFunctionNames: ['expect', 'request.**.expect']
        }
      ]
    }
  },

  // Examples configuration
  {
    files: ['examples/**/*.{ts,js}'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      'no-console': 'off'
    }
  },

  // Global ignores
  {
    ignores: [
      '**/dist/',
      '**/scripts/',
      '**/lib/',
      '**/upload/',
      '**/uploads/',
      '**/files/',
      '**/tmp/',
      '**/temp/',
      '**/node_modules/',
      '**/*.example',
      '**/*.json',
      '**/coverage/',
      '**/*.snap',
      '**/*.config.js',
      '**/*.config.cjs',
      '**/*.config.mjs'
    ]
  }
];
