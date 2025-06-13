export interface AppConfig {
    // Object Detection Settings
    objectDetection: {
        minConfidence: number;
        modelType: 'coco-ssd';
        imageResize: {
            width: number;
            height: number;
        };
    };
    
    // Face Detection Settings
    faceDetection: {
        enabled: boolean;
        compreface: {
            baseUrl: string;
            apiKey: string;
            detectApiKey: string;
            recognizeApiKey: string;
            timeout: number;
            detectionThreshold: number;
            faceLimit: number;
            maxConcurrencyRecognition: number;
            maxConcurrencyTraining: number;
            batchDelayMs: number;
            trainingDelayMs: number;
        };
    };
    
    // Image Processing Settings
    imageProcessing: {
        thumbnailSize: number;
        jpegQuality: number;
        supportedFormats: string[];
        supportedMimeTypes: string[];
        cacheDurationDefault: number;
        cacheDurationSource: number;
        cacheDurationProcessed: number;
    };
    
    // Processing Settings
    processing: {
        scanBatchSize: number;
        galleryDefaultPageSize: number;
        unidentifiedFacesDefaultLimit: number;
    };
    
    // Screenshot Detection Settings
    screenshotDetection: {
        threshold: number;
    };
    
    // Search Settings
    search: {
        defaultLimit: number;
        maxResults: number;
    };
    
    // Storage Paths
    paths: {
        sourceDir: string;
        destDir: string;
        databasePath: string;
    };
}

// Default configuration
const defaultConfig: AppConfig = {
    objectDetection: {
        minConfidence: 0.75,
        modelType: 'coco-ssd',
        imageResize: {
            width: 640,
            height: 640
        }
    },
    
    faceDetection: {
        enabled: true,
        compreface: {
            baseUrl: process.env.COMPREFACE_URL || 'http://localhost:8000',
            apiKey: process.env.COMPREFACE_API_KEY || '',
            detectApiKey: process.env.COMPREFACE_DETECT_API_KEY || '',
            recognizeApiKey: process.env.COMPREFACE_RECOGNIZE_API_KEY || '',
            timeout: parseInt(process.env.COMPREFACE_TIMEOUT_MS || '10000'),
            detectionThreshold: parseFloat(process.env.COMPREFACE_DETECTION_THRESHOLD || '0.8'),
            faceLimit: parseInt(process.env.COMPREFACE_FACE_LIMIT || '20'),
            maxConcurrencyRecognition: parseInt(process.env.COMPREFACE_MAX_CONCURRENCY_RECOGNITION || '5'),
            maxConcurrencyTraining: parseInt(process.env.COMPREFACE_MAX_CONCURRENCY_TRAINING || '3'),
            batchDelayMs: parseInt(process.env.COMPREFACE_BATCH_DELAY_MS || '500'),
            trainingDelayMs: parseInt(process.env.COMPREFACE_TRAINING_DELAY_MS || '1000')
        }
    },
    
    imageProcessing: {
        thumbnailSize: 256,
        jpegQuality: 85,
        supportedFormats: ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.bmp'],
        supportedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png'],
        cacheDurationDefault: parseInt(process.env.IMAGE_CACHE_DURATION_DEFAULT || '86400'),
        cacheDurationSource: parseInt(process.env.IMAGE_CACHE_DURATION_SOURCE || '9999'),
        cacheDurationProcessed: parseInt(process.env.IMAGE_CACHE_DURATION_PROCESSED || '86400')
    },
    
    processing: {
        scanBatchSize: parseInt(process.env.SCAN_BATCH_SIZE || '2'),
        galleryDefaultPageSize: parseInt(process.env.GALLERY_DEFAULT_PAGE_SIZE || '50'),
        unidentifiedFacesDefaultLimit: parseInt(process.env.UNIDENTIFIED_FACES_DEFAULT_LIMIT || '50')
    },
    
    screenshotDetection: {
        threshold: parseInt(process.env.SCREENSHOT_DETECTION_THRESHOLD || '60')
    },
    
    search: {
        defaultLimit: 100,
        maxResults: 1000
    },
    
    paths: {
        sourceDir: process.env.media_source_dir || '/mnt/sg1/uploads/stephen/iphone',
        destDir: process.env.media_dest_dir || '/mnt/hdd/photo-process/processed',
        databasePath: process.env.DATABASE_PATH || '/mnt/hdd/photo-process/database.db'
    }
};

// Singleton configuration instance
class ConfigManager {
    private static instance: ConfigManager;
    private config: AppConfig;
    
    private constructor() {
        this.config = { ...defaultConfig };
        this.loadConfigFromEnv();
    }
    
    public static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }
    
    private loadConfigFromEnv(): void {
        // Override defaults with environment variables
        if (process.env.OBJECT_DETECTION_MIN_CONFIDENCE) {
            this.config.objectDetection.minConfidence = parseFloat(process.env.OBJECT_DETECTION_MIN_CONFIDENCE);
        }
        
        if (process.env.IMAGE_THUMBNAIL_SIZE) {
            this.config.imageProcessing.thumbnailSize = parseInt(process.env.IMAGE_THUMBNAIL_SIZE);
        }
        
        if (process.env.SEARCH_DEFAULT_LIMIT) {
            this.config.search.defaultLimit = parseInt(process.env.SEARCH_DEFAULT_LIMIT);
        }
        
        if (process.env.JPEG_QUALITY) {
            this.config.imageProcessing.jpegQuality = parseInt(process.env.JPEG_QUALITY);
        }
    }
    
    public get(): AppConfig {
        return { ...this.config };
    }
    
    public getObjectDetectionConfig() {
        return this.config.objectDetection;
    }
    
    public getFaceDetectionConfig() {
        return this.config.faceDetection;
    }
    
    public getImageProcessingConfig() {
        return this.config.imageProcessing;
    }
    
    public getSearchConfig() {
        return this.config.search;
    }
    
    public getPathsConfig() {
        return this.config.paths;
    }
    
    public getProcessingConfig() {
        return this.config.processing;
    }
    
    public getScreenshotDetectionConfig() {
        return this.config.screenshotDetection;
    }
    
    public updateConfig(updates: Partial<AppConfig>): void {
        this.config = { ...this.config, ...updates };
    }
    
    public getMinConfidence(): number {
        return this.config.objectDetection.minConfidence;
    }
    
    // Convenience methods for commonly used values
    public getScanBatchSize(): number {
        return this.config.processing.scanBatchSize;
    }
    
    public getGalleryPageSize(): number {
        return this.config.processing.galleryDefaultPageSize;
    }
    
    public getScreenshotThreshold(): number {
        return this.config.screenshotDetection.threshold;
    }
}

// Export singleton instance
export const config = ConfigManager.getInstance();
export default config;