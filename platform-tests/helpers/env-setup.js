// Jest environment setup - runs before modules are loaded
// This file sets up environment variables and mocks console to reduce noise

// Set test environment variables
process.env.NODE_ENV = 'test';

// Set database environment variables to prevent warnings
process.env.MYSQL_HOST = 'localhost';
process.env.MYSQL_PORT = '3306';
process.env.MYSQL_USER = 'test';
process.env.MYSQL_PASSWORD = 'test_password'; // Set password to prevent warnings
process.env.MYSQL_DATABASE = 'photo_process_test';

// Set required directories
process.env.MEDIA_SOURCE_DIR = '/tmp/photo-process-test/source';
process.env.MEDIA_PROCESSED_DIR = '/tmp/photo-process-test/processed';
process.env.MEDIA_LOGS_DIR = '/tmp/photo-process-test/logs';

// Create test directories if they don't exist
const fs = require('fs');
const path = require('path');

const testDirs = [
  '/tmp/photo-process-test/source',
  '/tmp/photo-process-test/processed', 
  '/tmp/photo-process-test/logs'
];

testDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Set other config to prevent validation warnings
process.env.COMPREFACE_API_KEY = 'test-api-key';
process.env.COMPREFACE_BASE_URL = 'http://compreface-ui:80';

// Mock console methods to suppress noisy output
const originalConsole = global.console;

// Store original methods
const originalMethods = {
  log: originalConsole.log,
  warn: originalConsole.warn,
  error: originalConsole.error,
  info: originalConsole.info,
  debug: originalConsole.debug
};

// Override console methods with silent versions
global.console = {
  ...originalConsole,
  log: () => {},
  warn: () => {},
  error: () => {},
  info: () => {},
  debug: () => {},
  // Keep methods that might be needed for actual test output
  table: originalConsole.table,
  time: originalConsole.time,
  timeEnd: originalConsole.timeEnd,
  trace: originalConsole.trace,
  // Restore method to allow tests to restore if needed
  restore: () => {
    global.console = originalConsole;
  }
};