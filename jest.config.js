module.exports = {
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  collectCoverageFrom: ['src/**/*.ts'],
  coveragePathIgnorePatterns: ['index.ts'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true
};
