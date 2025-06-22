import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Note: Cannot import logger here due to circular dependency

// Configuration Schema Definition
export interface ConfigSchema {
    // Database Configuration
    database: {
        host: string;
        port: number;
        user: string;
        password: string;
        database: string;
        rootPassword?: string;
    };
    
    // Storage Paths
    storage: {
        sourceDir: string;
        processedDir: string;
        thumbnailDir?: string;
        cacheDir?: string;
        logsDir?: string;
    };
    
    // AI & Processing
    processing: {
        objectDetection: {
            enabled: boolean;
            confidence: {
                detection: number;      // Min confidence to detect and save objects
                search: number;         // Min confidence for search results
                highQuality: number;    // High confidence for featured/priority objects
            };
            batchSize: number;
            imageResize: {
                width: number;
                height: number;
            };
        };
        faceDetection: {
            enabled: boolean;
            confidence: {
                detection: number;      // CompreFace detection threshold
                review: number;         // Min confidence to show in review queue
                autoAssign: number;     // Min confidence for automatic assignment
                gender: number;         // Gender prediction confidence
                age: number;           // Age prediction confidence
            };
        };
        faceRecognition: {
            confidence: {
                review: number;         // Show potential matches for review
                autoAssign: number;     // Auto-assign without human review
                similarity: number;     // Min similarity to consider a match
            };
            workflow: {
                enableAutoAssignment: boolean;
                enableReviewQueue: boolean;
                maxReviewQueueSize: number;
            };
        };
        screenshotDetection: {
            enabled: boolean;
            threshold: number;
        };
    };
    
    // CompreFace Integration
    compreface: {
        baseUrl: string;
        apiKey?: string;
        detectApiKey: string;
        recognizeApiKey: string;
        timeout: number;
        maxConcurrency: number;
    };
    
    // Image Processing
    image: {
        thumbnailSize: number;
        jpegQuality: number;
        supportedFormats: string[];
        cacheTimeout: number;
    };
    
    // API & Server
    server: {
        port: number;
        galleryPageSize: number;
        searchLimit: number;
        scanBatchSize: number;
    };
    
    // Auto Scanner Configuration
    autoScanner: {
        faceRecognition: {
            enabled: boolean;
            requirePreviousTraining: boolean;
            confidence: {
                autoAssign: number;     // Min confidence for auto-assignment during scanning
            };
        };
        processing: {
            batchSize: number;
            intervalSeconds: number;
        };
    };

    // Feature Flags
    features: {
        enableFaceRecognition: boolean;
        enableObjectDetection: boolean;
        enableScreenshotDetection: boolean;
        enableApiConfig: boolean; // Future admin panel
    };
}

// Configuration Sources
interface ConfigSource {
    name: string;
    priority: number;
    load(): Partial<ConfigSchema>;
}

// Environment Variable Mapping
const ENV_MAPPING = {
    // Database
    'MYSQL_HOST': 'database.host',
    'MYSQL_PORT': 'database.port',
    'MYSQL_USER': 'database.user',
    'MYSQL_PASSWORD': 'database.password',
    'MYSQL_DATABASE': 'database.database',
    'MYSQL_ROOT_PASSWORD': 'database.rootPassword',
    
    // Storage
    'MEDIA_SOURCE_DIR': 'storage.sourceDir',
    'MEDIA_PROCESSED_DIR': 'storage.processedDir',
    'MEDIA_THUMBNAIL_DIR': 'storage.thumbnailDir',
    'MEDIA_CACHE_DIR': 'storage.cacheDir',
    'MEDIA_LOGS_DIR': 'storage.logsDir',
    
    // Object Detection Processing
    'OBJECT_DETECTION_ENABLED': 'processing.objectDetection.enabled',
    'OBJECT_DETECTION_CONFIDENCE_DETECTION': 'processing.objectDetection.confidence.detection',
    'OBJECT_DETECTION_CONFIDENCE_SEARCH': 'processing.objectDetection.confidence.search',
    'OBJECT_DETECTION_CONFIDENCE_HIGH_QUALITY': 'processing.objectDetection.confidence.highQuality',
    'OBJECT_DETECTION_BATCH_SIZE': 'processing.objectDetection.batchSize',
    'OBJECT_DETECTION_IMAGE_WIDTH': 'processing.objectDetection.imageResize.width',
    'OBJECT_DETECTION_IMAGE_HEIGHT': 'processing.objectDetection.imageResize.height',
    
    // Face Detection Processing
    'FACE_DETECTION_ENABLED': 'processing.faceDetection.enabled',
    'FACE_DETECTION_CONFIDENCE_DETECTION': 'processing.faceDetection.confidence.detection',
    'FACE_DETECTION_CONFIDENCE_REVIEW': 'processing.faceDetection.confidence.review',
    'FACE_DETECTION_CONFIDENCE_AUTO_ASSIGN': 'processing.faceDetection.confidence.autoAssign',
    'FACE_DETECTION_CONFIDENCE_GENDER': 'processing.faceDetection.confidence.gender',
    'FACE_DETECTION_CONFIDENCE_AGE': 'processing.faceDetection.confidence.age',
    
    // Face Recognition Processing
    'FACE_RECOGNITION_CONFIDENCE_REVIEW': 'processing.faceRecognition.confidence.review',
    'FACE_RECOGNITION_CONFIDENCE_AUTO_ASSIGN': 'processing.faceRecognition.confidence.autoAssign',
    'FACE_RECOGNITION_CONFIDENCE_SIMILARITY': 'processing.faceRecognition.confidence.similarity',
    'FACE_RECOGNITION_ENABLE_AUTO_ASSIGNMENT': 'processing.faceRecognition.workflow.enableAutoAssignment',
    'FACE_RECOGNITION_ENABLE_REVIEW_QUEUE': 'processing.faceRecognition.workflow.enableReviewQueue',
    'FACE_RECOGNITION_MAX_REVIEW_QUEUE_SIZE': 'processing.faceRecognition.workflow.maxReviewQueueSize',
    
    // Screenshot Detection
    'SCREENSHOT_DETECTION_ENABLED': 'processing.screenshotDetection.enabled',
    'SCREENSHOT_DETECTION_THRESHOLD': 'processing.screenshotDetection.threshold',
    
    // CompreFace
    'COMPREFACE_URL': 'compreface.baseUrl',
    'COMPREFACE_API_KEY': 'compreface.apiKey',
    'COMPREFACE_DETECT_API_KEY': 'compreface.detectApiKey',
    'COMPREFACE_RECOGNIZE_API_KEY': 'compreface.recognizeApiKey',
    'COMPREFACE_TIMEOUT': 'compreface.timeout',
    'COMPREFACE_MAX_CONCURRENCY': 'compreface.maxConcurrency',
    
    // Image Processing
    'IMAGE_THUMBNAIL_SIZE': 'image.thumbnailSize',
    'IMAGE_JPEG_QUALITY': 'image.jpegQuality',
    'IMAGE_CACHE_TIMEOUT': 'image.cacheTimeout',
    
    // Server
    'SERVER_PORT': 'server.port',
    'GALLERY_PAGE_SIZE': 'server.galleryPageSize',
    'SEARCH_LIMIT': 'server.searchLimit',
    'SCAN_BATCH_SIZE': 'server.scanBatchSize',
    
    // Features
    'FEATURE_FACE_RECOGNITION': 'features.enableFaceRecognition',
    'FEATURE_OBJECT_DETECTION': 'features.enableObjectDetection',
    'FEATURE_SCREENSHOT_DETECTION': 'features.enableScreenshotDetection',
    'FEATURE_API_CONFIG': 'features.enableApiConfig'
};

// No hardcoded defaults - all defaults loaded from config/defaults.json

// Configuration Validation
class ConfigValidator {
    static validate(config: ConfigSchema): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];
        
        // Database validation
        if (!config.database.host) {
            errors.push('Database host is required');
        }
        if (config.database.port < 1 || config.database.port > 65535) {
            errors.push('Database port must be between 1 and 65535');
        }
        if (!config.database.user) {
            errors.push('Database user is required');
        }
        if (!config.database.password) {
            console.warn('[WARN] Database password not set - this may cause connection issues');
            // Don't fail validation for missing password during development
            // errors.push('Database password is required (set MYSQL_PASSWORD or legacy mysql_pass)');
        }
        
        // Storage validation
        if (!config.storage.sourceDir) {
            errors.push('Source directory is required');
        }
        if (!config.storage.processedDir) {
            errors.push('Processed directory is required');
        }
        
        // Path existence validation
        try {
            if (config.storage.sourceDir && !fs.existsSync(config.storage.sourceDir)) {
                errors.push(`Source directory does not exist: ${config.storage.sourceDir}`);
            }
            
            // Create processed dir if it doesn't exist
            if (config.storage.processedDir && !fs.existsSync(config.storage.processedDir)) {
                try {
                    fs.mkdirSync(config.storage.processedDir, { recursive: true });
                    console.log(`[INFO] Created processed directory: ${config.storage.processedDir}`);
                } catch (err) {
                    errors.push(`Cannot create processed directory: ${config.storage.processedDir}`);
                }
            }
        } catch (err) {
            errors.push(`Error validating paths: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
        
        // Processing validation
        const objDetection = config.processing.objectDetection;
        if (objDetection.confidence.detection < 0 || objDetection.confidence.detection > 1) {
            errors.push('Object detection confidence must be between 0 and 1');
        }
        if (objDetection.confidence.search < 0 || objDetection.confidence.search > 1) {
            errors.push('Object detection search confidence must be between 0 and 1');
        }
        if (objDetection.confidence.highQuality < 0 || objDetection.confidence.highQuality > 1) {
            errors.push('Object detection high quality confidence must be between 0 and 1');
        }
        
        const faceDetection = config.processing.faceDetection;
        if (faceDetection.confidence.detection < 0 || faceDetection.confidence.detection > 1) {
            errors.push('Face detection confidence must be between 0 and 1');
        }
        if (faceDetection.confidence.review < 0 || faceDetection.confidence.review > 1) {
            errors.push('Face detection review confidence must be between 0 and 1');
        }
        if (faceDetection.confidence.autoAssign < 0 || faceDetection.confidence.autoAssign > 1) {
            errors.push('Face detection auto-assign confidence must be between 0 and 1');
        }
        
        const faceRecognition = config.processing.faceRecognition;
        if (faceRecognition.confidence.review < 0 || faceRecognition.confidence.review > 1) {
            errors.push('Face recognition review confidence must be between 0 and 1');
        }
        if (faceRecognition.confidence.autoAssign < 0 || faceRecognition.confidence.autoAssign > 1) {
            errors.push('Face recognition auto-assign confidence must be between 0 and 1');
        }
        if (faceRecognition.confidence.similarity < 0 || faceRecognition.confidence.similarity > 1) {
            errors.push('Face recognition similarity confidence must be between 0 and 1');
        }
        
        // CompreFace validation
        if (config.processing.faceDetection.enabled) {
            if (!config.compreface.baseUrl) {
                errors.push('CompreFace URL is required when face detection is enabled');
            }
        }
        
        // Image processing validation
        if (config.image.jpegQuality < 1 || config.image.jpegQuality > 100) {
            errors.push('JPEG quality must be between 1 and 100');
        }
        if (config.image.thumbnailSize < 32 || config.image.thumbnailSize > 2048) {
            errors.push('Thumbnail size must be between 32 and 2048 pixels');
        }
        
        // Server validation
        if (config.server.port < 1 || config.server.port > 65535) {
            errors.push('Server port must be between 1 and 65535');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

// Enhanced Configuration Manager
export class EnhancedConfigManager {
    private static instance: EnhancedConfigManager;
    private config: ConfigSchema;
    private configSources: ConfigSource[] = [];
    private runtimeOverrides: Partial<ConfigSchema> = {};
    private configFilePath: string;
    private defaultsFilePath: string;
    private envFilePath: string;
    
    private constructor() {
        // Load environment variables from .env file
        dotenv.config({ path: path.join(process.cwd(), '.env') });
        
        this.configFilePath = path.join(process.cwd(), 'config', 'settings.json');
        this.defaultsFilePath = path.join(process.cwd(), 'config', 'defaults.json');
        this.envFilePath = path.join(process.cwd(), '.env');
        this.config = {} as ConfigSchema; // Will be populated from config sources
        this.setupConfigSources();
        this.loadConfiguration();
    }
    
    public static getInstance(): EnhancedConfigManager {
        if (!EnhancedConfigManager.instance) {
            EnhancedConfigManager.instance = new EnhancedConfigManager();
        }
        return EnhancedConfigManager.instance;
    }
    
    private setupConfigSources(): void {
        // Priority: Runtime > Config File > Environment > Defaults (from file)
        this.configSources = [
            {
                name: 'defaults',
                priority: 0,
                load: () => this.loadFromDefaultsFile()
            },
            {
                name: 'environment',
                priority: 1,
                load: () => this.loadFromEnvironment()
            },
            {
                name: 'configFile',
                priority: 2,
                load: () => this.loadFromConfigFile()
            },
            {
                name: 'runtime',
                priority: 3,
                load: () => this.runtimeOverrides
            }
        ];
    }
    
    private loadConfiguration(): void {
        // Load from all sources in priority order
        const mergedConfig = this.configSources
            .sort((a, b) => a.priority - b.priority)
            .reduce((config, source) => {
                try {
                    const sourceConfig = source.load();
                    return this.deepMerge(config, sourceConfig);
                } catch (err) {
                    console.warn(`[WARN] Failed to load config from ${source.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
                    return config;
                }
            }, {} as ConfigSchema);
        
        this.config = mergedConfig;
        
        // Validate configuration
        const validation = ConfigValidator.validate(this.config);
        if (!validation.isValid) {
            const errorMessage = `Configuration validation failed:\n${validation.errors.join('\n')}`;
            console.error(`[ERROR] ${errorMessage}`);
            throw new Error(errorMessage);
        }
        
        console.log('[INFO] Configuration loaded and validated successfully');
    }
    
    private loadFromEnvironment(): Partial<ConfigSchema> {
        const envConfig: any = {};
        
        // Load environment variables using mapping
        Object.entries(ENV_MAPPING).forEach(([envKey, configPath]) => {
            const envValue = process.env[envKey];
            if (envValue !== undefined) {
                this.setNestedValue(envConfig, configPath, this.parseEnvValue(envValue));
            }
        });
        
        // Support legacy environment variables for backward compatibility
        const legacyMappings = {
            'mysql_host': 'database.host',
            'mysql_port': 'database.port',
            'mysql_user': 'database.user',
            'mysql_pass': 'database.password',
            'mysql_db': 'database.database',
            'mysql_root_password': 'database.rootPassword',
            'media_source_dir': 'storage.sourceDir',
            'media_dest_dir': 'storage.processedDir',
            // Legacy confidence mappings (map old single values to new granular structure)
            'OBJECT_DETECTION_MIN_CONFIDENCE': 'processing.objectDetection.confidence.detection',
            'FACE_DETECTION_THRESHOLD': 'processing.faceDetection.confidence.detection'
        };
        
        Object.entries(legacyMappings).forEach(([envKey, configPath]) => {
            const envValue = process.env[envKey];
            if (envValue !== undefined) {
                this.setNestedValue(envConfig, configPath, this.parseEnvValue(envValue));
                console.warn(`[WARN] Using legacy environment variable ${envKey}, consider updating to ${Object.keys(ENV_MAPPING).find(k => ENV_MAPPING[k as keyof typeof ENV_MAPPING] === configPath)}`);
            }
        });
        
        return envConfig;
    }
    
    private loadFromDefaultsFile(): Partial<ConfigSchema> {
        try {
            if (fs.existsSync(this.defaultsFilePath)) {
                const defaultsData = fs.readFileSync(this.defaultsFilePath, 'utf8');
                return JSON.parse(defaultsData);
            } else {
                console.error(`[ERROR] Defaults file not found: ${this.defaultsFilePath}`);
                throw new Error('Configuration defaults file is missing. Please ensure config/defaults.json exists.');
            }
        } catch (err) {
            console.error(`[ERROR] Failed to load defaults file: ${err instanceof Error ? err.message : 'Unknown error'}`);
            throw err; // Re-throw since defaults are critical
        }
    }
    
    private loadFromConfigFile(): Partial<ConfigSchema> {
        try {
            if (fs.existsSync(this.configFilePath)) {
                const configData = fs.readFileSync(this.configFilePath, 'utf8');
                return JSON.parse(configData);
            }
        } catch (err) {
            console.warn(`[WARN] Failed to load config file: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
        return {};
    }
    
    private parseEnvValue(value: string): any {
        // Parse boolean
        if (value.toLowerCase() === 'true') return true;
        if (value.toLowerCase() === 'false') return false;
        
        // Parse number
        const numValue = Number(value);
        if (!isNaN(numValue)) return numValue;
        
        // Parse array (comma-separated)
        if (value.includes(',')) {
            return value.split(',').map(v => v.trim());
        }
        
        // Return as string
        return value;
    }
    
    private setNestedValue(obj: any, path: string, value: any): void {
        const keys = path.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[keys[keys.length - 1]] = value;
    }
    
    private deepMerge(target: any, source: any): any {
        const result = { ...target };
        
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        
        return result;
    }
    
    // Public API
    public get(): ConfigSchema {
        return { ...this.config };
    }
    
    public getDatabase() {
        return this.config.database;
    }
    
    public getStorage() {
        return this.config.storage;
    }
    
    public getProcessing() {
        return this.config.processing;
    }
    
    public getCompreFace() {
        return this.config.compreface;
    }
    
    public getImage() {
        return this.config.image;
    }
    
    public getServer() {
        return this.config.server;
    }
    
    public getFeatures() {
        return this.config.features;
    }
    
    public getAutoScanner() {
        return this.config.autoScanner;
    }
    
    // Runtime configuration updates (for admin panel)
    public updateConfig(updates: Partial<ConfigSchema>): void {
        this.runtimeOverrides = this.deepMerge(this.runtimeOverrides, updates);
        this.loadConfiguration(); // Reload with new overrides
    }
    
    public saveConfigFile(): void {
        try {
            const configDir = path.dirname(this.configFilePath);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            
            fs.writeFileSync(this.configFilePath, JSON.stringify(this.config, null, 2));
            console.log(`[INFO] Configuration saved to ${this.configFilePath}`);
        } catch (err) {
            console.error(`[ERROR] Failed to save config file: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    }
    
    public reload(): void {
        this.runtimeOverrides = {};
        this.loadConfiguration();
        console.log('[INFO] Configuration reloaded');
    }
    
    public getConfigSummary(): object {
        return {
            database: {
                host: this.config.database.host,
                port: this.config.database.port,
                database: this.config.database.database
            },
            storage: this.config.storage,
            processing: this.config.processing,
            features: this.config.features,
            server: {
                port: this.config.server.port
            }
        };
    }
    
    // Legacy compatibility methods
    public getPathsConfig() {
        return {
            sourceDir: this.config.storage.sourceDir,
            destDir: this.config.storage.processedDir,
            databasePath: '' // Not used in new config
        };
    }
    
    public getImageProcessingConfig() {
        return this.config.image;
    }
    
    public getMinConfidence(): number {
        return this.config.processing.objectDetection.confidence.detection;
    }
    
    public getObjectDetectionConfig() {
        return this.config.processing.objectDetection;
    }
    
    // New granular confidence access methods
    public getFaceRecognitionConfig() {
        return this.config.processing.faceRecognition;
    }
    
    public getConfidenceThresholds() {
        return {
            objectDetection: this.config.processing.objectDetection.confidence,
            faceDetection: this.config.processing.faceDetection.confidence,
            faceRecognition: this.config.processing.faceRecognition.confidence
        };
    }
}

// Export singleton instance
export const configManager = EnhancedConfigManager.getInstance();
export default configManager;