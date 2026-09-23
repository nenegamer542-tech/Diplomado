'use strict';

module.exports = {
  testEnvironment: 'node',
  // BD de test: MONGO_URI_TEST (Atlas) o una efímera mongodb-memory-server.
  globalSetup: '<rootDir>/tests/global-setup.js',
  globalTeardown: '<rootDir>/tests/global-teardown.js',
  // Carga ANTES que cualquier módulo de src/ (config/env.js exige las variables).
  setupFiles: ['<rootDir>/tests/setup-env.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/server.js', '!src/scripts/**/*.js'],
  verbose: true,
  testTimeout: 15000,
};
