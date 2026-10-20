const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'skillo-test';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'skillo-test';

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^jose$': '<rootDir>/tests/mocks/jose.cjs',
    // Strip .js extensions from imports in TypeScript files
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          jsx: 'react',
          esModuleInterop: true,
          module: 'esnext',
          moduleResolution: 'bundler',
        },
      },
    ],
  },
};
