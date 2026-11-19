'use strict';

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/helpers/setupEnv.js'],
  globalSetup: '<rootDir>/tests/helpers/globalSetup.js',
  testTimeout: 60000,
  collectCoverageFrom: ['src/**/*.js', '!src/server.js'],
};
