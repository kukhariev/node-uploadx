const { compilerOptions } = require('./tsconfig.base.json');
const { pathsToModuleNameMapper } = require('ts-jest/utils');
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testRegex: '.*spec.ts$',
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/' })
};
