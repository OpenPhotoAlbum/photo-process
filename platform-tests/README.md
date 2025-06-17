# Platform Testing Suite

This directory contains the comprehensive testing suite for the photo management platform, migrated from the legacy monolithic structure.

## Structure

```
tests/
├── unit/                # Unit tests for individual components
│   ├── utils/           # Utility function tests
│   ├── processors/      # Processing engine tests
│   ├── engines/         # Smart album engine tests
│   └── simple-batch.test.ts
├── integration/         # Integration tests for complete workflows
│   └── batch-processing.test.ts
└── helpers/             # Test utilities and helpers
    ├── env-setup.js     # Environment setup for tests
    ├── setup.ts         # Test framework setup
    ├── mocks.ts         # Mock factories
    └── types.ts         # Test-specific types
```

## Running Tests

### Quick Commands

```bash
# Run all tests
npm run test:jest

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run tests in watch mode
npm run test:jest:watch

# Run tests with coverage report
npm run test:jest:coverage
```

### Individual Test Files

```bash
# Run specific test file
npx jest tests/unit/utils/config-manager.test.ts

# Run tests matching pattern
npx jest --testNamePattern="batch processing"

# Run tests with verbose output
npx jest --verbose
```

## Test Types

### Unit Tests

Located in `tests/unit/`, these test individual components in isolation:

- **Config Manager** (`utils/config-manager.test.ts`) - Configuration system
- **Batch Processor** (`processors/batch-processor.test.ts`) - Job queue management
- **Parallel Scanner** (`processors/parallel-scanner.test.ts`) - File scanning
- **Batch Worker** (`processors/batch-worker.test.ts`) - Background processing
- **Smart Album Engine** (`engines/smart-album-engine.test.ts`) - Album generation

### Integration Tests

Located in `tests/integration/`, these test complete workflows:

- **Batch Processing** (`batch-processing.test.ts`) - End-to-end processing pipeline

## Test Environment

### Setup Files

1. **env-setup.js** - Sets up environment variables and suppresses console output
2. **setup.ts** - Configures Jest and test framework
3. **mocks.ts** - Provides mock factories for test data
4. **types.ts** - Test-specific type definitions (avoids importing modules with side effects)

### Mock Strategy

Tests use isolated mocks to avoid side effects:
- Database operations are mocked
- File system operations use temporary directories
- External services (CompreFace) are mocked
- Configuration uses test-specific values

## Coverage Requirements

Current coverage thresholds:

- **Global**: 70% branches, 75% functions, 80% lines/statements
- **Batch Processor**: 90% branches, 95% functions/lines/statements
- **Smart Album Engine**: 85% branches, 90% functions/lines/statements

View coverage report:
```bash
npm run test:jest:coverage
open coverage/lcov-report/index.html
```

## Writing Tests

### Test Structure

```typescript
import { ComponentUnderTest } from '../../services/api/util/component';
import { createMockData } from '../helpers/mocks';

describe('ComponentUnderTest', () => {
  beforeEach(() => {
    // Setup test environment
  });

  afterEach(() => {
    // Cleanup
  });

  describe('method under test', () => {
    test('should handle expected input correctly', async () => {
      // Arrange
      const mockInput = createMockData();
      
      // Act
      const result = await ComponentUnderTest.method(mockInput);
      
      // Assert
      expect(result).toMatchExpectedOutput();
    });
  });
});
```

### Best Practices

1. **Isolation**: Each test should be independent
2. **Descriptive Names**: Test names should clearly describe what's being tested
3. **AAA Pattern**: Arrange, Act, Assert structure
4. **Mock External Dependencies**: Don't test external services
5. **Test Edge Cases**: Include error conditions and boundary cases
6. **Cleanup**: Always clean up resources (files, timers, etc.)

### Mock Factories

Use the provided mock factories in `helpers/mocks.ts`:

```typescript
import { createMockBatchJob, createMockImage, createMockSmartAlbum } from '../helpers/mocks';

const mockJob = createMockBatchJob({
  priority: JobPriority.HIGH,
  data: { filePaths: ['/test/image.jpg'] }
});
```

## Platform Integration

### API Service Integration

Tests are configured to work with the new platform structure:
- Imports point to `../../services/api/`
- TypeScript compilation uses API service's tsconfig
- Module resolution supports both relative and absolute imports

### Database Testing

Tests use the platform database configuration:
- Connects to test database (separate from development)
- Runs migrations before test suite
- Cleans up data after tests

### Configuration Testing

Tests use isolated configuration:
- Test-specific environment variables
- Mock configuration values
- No side effects on actual config files

## Performance Testing

Integration tests include performance benchmarks:
- Memory usage monitoring
- Processing time limits
- Concurrent operation testing
- High-volume data testing

Example performance test:
```typescript
test('should handle high volume efficiently', async () => {
  const startTime = Date.now();
  await processLargeDataset();
  const duration = Date.now() - startTime;
  
  expect(duration).toBeLessThan(10000); // 10 second limit
});
```

## Troubleshooting

### Common Issues

1. **Tests hanging**: Check for unclosed resources (database connections, timers)
2. **Import errors**: Verify paths match new platform structure
3. **Mock failures**: Ensure mocks are reset between tests
4. **TypeScript errors**: Check Jest configuration and module resolution

### Debug Mode

Run tests with debug output:
```bash
# Enable verbose logging
DEBUG=* npm run test:jest

# Run single test with full output
npx jest --verbose --no-cache tests/unit/specific-test.test.ts
```

### Environment Issues

Verify test environment setup:
```bash
# Check environment variables
node -e "console.log(process.env)"

# Verify API service compilation
cd services/api && npm run build
```

## Migration Notes

This testing suite was migrated from the legacy monolithic structure with the following changes:

1. **Import Paths**: Updated from `../../src/` to `../../services/api/`
2. **Jest Configuration**: Modified for platform structure
3. **Module Resolution**: Added platform-specific path mapping
4. **Coverage Paths**: Updated to include services directory
5. **TypeScript Config**: Points to API service configuration

All test functionality has been preserved while adapting to the new architecture.