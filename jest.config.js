const { compilerOptions } = require('./tsconfig.base.json');
const { pathsToModuleNameMapper } = require('ts-jest');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  snapshotFormat: {
    escapeString: false,
    printBasicPrototype: false
  },
  testRegex: '.*\\.(spec|test)\\.ts$',
  moduleNameMapper: {
    ...pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/' })
  },
  modulePathIgnorePatterns: ['<rootDir>/package.json'],
  collectCoverageFrom: ['packages/**/*.ts', '!**/lib/**', '!<rootDir>/test/shared/**'],
  roots: ['<rootDir>/packages/', '<rootDir>/test/']
};
