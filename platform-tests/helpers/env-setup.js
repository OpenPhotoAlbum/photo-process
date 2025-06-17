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

// Set CompreFace config
process.env.COMPREFACE_API_KEY = 'test-api-key';
process.env.COMPREFACE_URL = 'http://compreface-ui:80';
process.env.COMPREFACE_DETECT_API_KEY = 'test-detect-key';
process.env.COMPREFACE_RECOGNIZE_API_KEY = 'test-recognize-key';
process.env.COMPREFACE_TIMEOUT = '10000';
process.env.COMPREFACE_MAX_CONCURRENCY = '5';

// Set processing configuration to prevent validation errors
process.env.OBJECT_DETECTION_ENABLED = 'true';
process.env.OBJECT_DETECTION_MIN_CONFIDENCE = '0.75';
process.env.FACE_DETECTION_ENABLED = 'true';
process.env.FACE_DETECTION_CONFIDENCE_DETECTION = '0.8';
process.env.FACE_DETECTION_CONFIDENCE_REVIEW = '0.75';
process.env.FACE_DETECTION_CONFIDENCE_AUTO_ASSIGN = '1.0';
process.env.FACE_DETECTION_CONFIDENCE_GENDER = '0.7';
process.env.FACE_DETECTION_CONFIDENCE_AGE = '0.7';
process.env.FACE_RECOGNITION_CONFIDENCE_REVIEW = '0.75';
process.env.FACE_RECOGNITION_CONFIDENCE_AUTO_ASSIGN = '1.0';
process.env.FACE_RECOGNITION_CONFIDENCE_SIMILARITY = '0.65';
process.env.SCREENSHOT_DETECTION_ENABLED = 'true';
process.env.SCREENSHOT_DETECTION_THRESHOLD = '60';

// Set server configuration
process.env.API_PORT = '9000';
process.env.API_HOST = '0.0.0.0';
process.env.SERVER_PORT = '9000';
process.env.GALLERY_PAGE_SIZE = '50';
process.env.SEARCH_LIMIT = '100';
process.env.SCAN_BATCH_SIZE = '2';

// Set image processing configuration
process.env.IMAGE_THUMBNAIL_SIZE = '256';
process.env.IMAGE_JPEG_QUALITY = '85';

// Set feature flags
process.env.FEATURE_FACE_RECOGNITION = 'true';
process.env.FEATURE_OBJECT_DETECTION = 'true';
process.env.FEATURE_SCREENSHOT_DETECTION = 'true';
process.env.FEATURE_API_CONFIG = 'false';

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