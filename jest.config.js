module.exports = {
  // Test environment
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // TypeScript configuration
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  
  // Module paths
  roots: ['<rootDir>/services/api', '<rootDir>/platform-tests'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Test patterns
  testMatch: [
    '<rootDir>/platform-tests/**/*.test.ts',
    '<rootDir>/platform-tests/**/*.spec.ts'
  ],
  
  // Module name mapping for absolute imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/services/api/$1',
    '^@api/(.*)$': '<rootDir>/services/api/$1',
    '^@tests/(.*)$': '<rootDir>/platform-tests/$1'
  },
  
  // Setup files
  setupFiles: [
    '<rootDir>/platform-tests/helpers/env-setup.js'
  ],
  setupFilesAfterEnv: [
    '<rootDir>/platform-tests/helpers/setup.ts'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'services/api/**/*.{ts,tsx}',
    '!services/api/**/*.d.ts',
    '!services/api/**/index.ts',
    '!services/api/**/*.test.ts',
    '!services/api/**/*.spec.ts',
    '!services/api/build/**',
    '!services/api/node_modules/**'
  ],
  
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80
    },
    './services/api/util/batch-processor.ts': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './services/api/util/smart-album-engine.ts': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  
  // Test timeout
  testTimeout: 30000,
  
  // Mock configuration
  clearMocks: true,
  restoreMocks: true,
  
  // Verbose output
  verbose: false,
  
  // Suppress console output during tests
  silent: false,
  
  // Detect open handles (useful for finding async issues)
  detectOpenHandles: true,
  
  // Force exit after tests complete
  forceExit: true,
  
  // TypeScript configuration for ts-jest
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/services/api/tsconfig.json'
    }]
  }
};