import { configManager } from '../../services/api/util/config-manager';
import { db } from '../../services/api/models/database';

// Global test setup
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  // Initialize config for tests
  process.env.MYSQL_HOST = 'localhost';
  process.env.MYSQL_PORT = '3306';
  process.env.MYSQL_USER = 'test';
  process.env.MYSQL_PASSWORD = 'test';
  process.env.MYSQL_DATABASE = 'photo_process_test';
  
  // Set test directories
  process.env.MEDIA_SOURCE_DIR = '/tmp/photo-process-test/source';
  process.env.MEDIA_PROCESSED_DIR = '/tmp/photo-process-test/processed';
  process.env.MEDIA_LOGS_DIR = '/tmp/photo-process-test/logs';
});

// Cleanup after each test
afterEach(async () => {
  // Clear all mocks
  jest.clearAllMocks();
});

// Global cleanup
afterAll(async () => {
  // Close database connections
  if (db) {
    await db.destroy();
  }
});

// Increase timeout for tests that might take longer
jest.setTimeout(30000);