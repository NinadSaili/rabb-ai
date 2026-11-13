module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'commonjs', moduleResolution: 'node', target: 'ES2022', strict: true, esModuleInterop: true, skipLibCheck: true, noUncheckedIndexedAccess: true } , diagnostics: true}] },
  moduleNameMapper: { '^@rabb/(.*)$': '<rootDir>/../$1/src/index.ts' },
};
