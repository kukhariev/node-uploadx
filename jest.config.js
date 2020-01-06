module.exports = {
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  collectCoverageFrom: ['src/**/*.ts'],
  coveragePathIgnorePatterns: ['index.ts', 'gcs-storage.ts', 's3-storage.ts'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true
};
