// Re-export types from enhanced config manager
export type { ConfigSchema as AppConfig } from './util/config-manager';

// Import and re-export the enhanced config manager
import { configManager } from './util/config-manager';

// Export the enhanced config manager as the default config
export const config = configManager;
export default configManager;

// Legacy compatibility - provide methods that existing code expects
export const legacyConfig = {
    get: () => configManager.get(),
    getObjectDetectionConfig: () => configManager.getProcessing().objectDetection,
    getFaceDetectionConfig: () => configManager.getProcessing().faceDetection,
    getImageProcessingConfig: () => configManager.getImage(),
    getSearchConfig: () => ({
        defaultLimit: configManager.getServer().searchLimit,
        maxResults: 1000
    }),
    getPathsConfig: () => ({
        sourceDir: configManager.getStorage().sourceDir,
        destDir: configManager.getStorage().processedDir,
        databasePath: '' // Not used in new config
    }),
    getProcessingConfig: () => ({
        scanBatchSize: configManager.getServer().scanBatchSize,
        galleryDefaultPageSize: configManager.getServer().galleryPageSize,
        unidentifiedFacesDefaultLimit: 50
    }),
    getScreenshotDetectionConfig: () => configManager.getProcessing().screenshotDetection,
    getMinConfidence: () => configManager.getProcessing().objectDetection.confidence.detection,
    getScanBatchSize: () => configManager.getServer().scanBatchSize,
    getGalleryPageSize: () => configManager.getServer().galleryPageSize,
    getScreenshotThreshold: () => configManager.getProcessing().screenshotDetection.threshold
};

// For backward compatibility, also export individual methods
export const {
    getObjectDetectionConfig,
    getFaceDetectionConfig,
    getImageProcessingConfig,
    getSearchConfig,
    getPathsConfig,
    getProcessingConfig,
    getScreenshotDetectionConfig,
    getMinConfidence,
    getScanBatchSize,
    getGalleryPageSize,
    getScreenshotThreshold
} = legacyConfig;