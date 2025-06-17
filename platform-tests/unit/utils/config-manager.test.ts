import { configManager } from '../../../services/api/util/config-manager';
import { resetAllMocks } from '../../helpers/mocks';

describe('ConfigManager', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe('Basic Configuration Access', () => {
    test('should provide database configuration', () => {
      const dbConfig = configManager.getDatabase();
      
      expect(dbConfig).toBeDefined();
      expect(typeof dbConfig.host).toBe('string');
      expect(typeof dbConfig.port).toBe('number');
    });

    test('should provide storage configuration', () => {
      const storageConfig = configManager.getStorage();
      
      expect(storageConfig).toBeDefined();
      expect(typeof storageConfig.sourceDir).toBe('string');
      expect(typeof storageConfig.processedDir).toBe('string');
    });

    test('should provide processing configuration', () => {
      const processingConfig = configManager.getProcessing();
      
      expect(processingConfig).toBeDefined();
      expect(processingConfig.objectDetection).toBeDefined();
      expect(typeof processingConfig.objectDetection.confidence.detection).toBe('number');
    });

    test('should provide server configuration', () => {
      const serverConfig = configManager.getServer();
      
      expect(serverConfig).toBeDefined();
      expect(typeof serverConfig.port).toBe('number');
      expect(typeof serverConfig.scanBatchSize).toBe('number');
    });

    test('should provide CompreFace configuration', () => {
      const compreFaceConfig = configManager.getCompreFace();
      
      expect(compreFaceConfig).toBeDefined();
      expect(typeof compreFaceConfig.baseUrl).toBe('string');
      expect(typeof compreFaceConfig.timeout).toBe('number');
    });

    test('should provide image configuration', () => {
      const imageConfig = configManager.getImage();
      
      expect(imageConfig).toBeDefined();
      expect(typeof imageConfig.thumbnailSize).toBe('number');
      expect(typeof imageConfig.jpegQuality).toBe('number');
    });

    test('should provide features configuration', () => {
      const featuresConfig = configManager.getFeatures();
      
      expect(featuresConfig).toBeDefined();
      expect(typeof featuresConfig.enableFaceRecognition).toBe('boolean');
      expect(typeof featuresConfig.enableObjectDetection).toBe('boolean');
    });
  });

  describe('Configuration Validation', () => {
    test('should have reasonable default values', () => {
      const dbConfig = configManager.getDatabase();
      const processingConfig = configManager.getProcessing();
      
      expect(dbConfig.port).toBeGreaterThan(0);
      expect(dbConfig.port).toBeLessThan(65536);
      
      expect(processingConfig.objectDetection.confidence.detection).toBeGreaterThan(0);
      expect(processingConfig.objectDetection.confidence.detection).toBeLessThanOrEqual(1);
    });

    test('should have required configuration properties', () => {
      const dbConfig = configManager.getDatabase();
      expect(dbConfig).toHaveProperty('host');
      expect(dbConfig).toHaveProperty('port');
      expect(dbConfig).toHaveProperty('user');
      expect(dbConfig).toHaveProperty('database');

      const storageConfig = configManager.getStorage();
      expect(storageConfig).toHaveProperty('sourceDir');
      expect(storageConfig).toHaveProperty('processedDir');
    });
  });

  describe('Type Safety', () => {
    test('should return consistent types', () => {
      // Multiple calls should return same types
      const db1 = configManager.getDatabase();
      const db2 = configManager.getDatabase();
      
      expect(typeof db1.host).toBe(typeof db2.host);
      expect(typeof db1.port).toBe(typeof db2.port);
    });

    test('should handle undefined values gracefully', () => {
      expect(() => {
        configManager.getDatabase();
        configManager.getStorage();
        configManager.getProcessing();
        configManager.getCompreFace();
        configManager.getImage();
        configManager.getServer();
        configManager.getFeatures();
      }).not.toThrow();
    });
  });
});