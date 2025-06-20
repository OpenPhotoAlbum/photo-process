import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { ElasticsearchTransport } from 'winston-elasticsearch';
import { Client } from '@elastic/elasticsearch';
import path from 'path';
import fs from 'fs';
import { configManager } from './config-manager';

// Ensure logs directory exists
const logsDir = configManager.getStorage().logsDir || path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Elasticsearch client configuration
const esClient = new Client({
    node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    auth: process.env.ELASTICSEARCH_AUTH ? {
        username: process.env.ELASTICSEARCH_USER || '',
        password: process.env.ELASTICSEARCH_PASS || ''
    } : undefined
});

// Define log categories and their configurations
interface LogConfig {
    filename: string;
    level: string;
    format?: winston.Logform.Format;
    elasticsearchIndex?: string;
}

interface ImageProcessingData {
    imagePath: string;
    processingTime: number;
    operations: {
        exif: { success: boolean; duration: number; error?: string };
        thumbnail: { success: boolean; duration: number; error?: string };
        faceDetection: { success: boolean; faces?: number; duration: number; error?: string };
        objectDetection: { success: boolean; objects?: number; duration: number; error?: string };
    };
    output?: {
        metadataPath: string;
        thumbnailPath: string;
        faceCount: number;
    };
    error?: string;
}

interface FaceRecognitionData {
    imageId: number;
    imagePath?: string;
    faceId: number;
    personId?: number;
    personName?: string;
    confidence: number;
    method?: string;
    comprefaceSubject?: string;
    candidates?: Array<{
        personId: number;
        name: string;
        confidence: number;
    }>;
}

interface ApiRequestData {
    requestId: string;
    method: string;
    path: string;
    statusCode: number;
    duration: number;
    userId?: string;
    ip?: string;
    error?: string;
}

export class StructuredLogger {
    private loggers: Map<string, winston.Logger> = new Map();
    private isDevelopment: boolean;
    private enableElasticsearch: boolean;
    
    constructor() {
        this.isDevelopment = process.env.NODE_ENV !== 'production';
        this.enableElasticsearch = process.env.ENABLE_ELASTICSEARCH_LOGGING !== 'false';
        this.setupLoggers();
    }
    
    private setupLoggers() {
        // Define log configurations
        const logConfigs: Record<string, LogConfig> = {
            system: {
                filename: path.join(logsDir, 'system-%DATE%.log'),
                level: 'info',
                elasticsearchIndex: 'photo-platform-system'
            },
            error: {
                filename: path.join(logsDir, 'error-%DATE%.log'),
                level: 'error',
                elasticsearchIndex: 'photo-platform-errors'
            },
            api: {
                filename: path.join(logsDir, 'api', 'api-%DATE%.log'),
                level: 'info',
                elasticsearchIndex: 'photo-platform-api'
            },
            processing: {
                filename: path.join(logsDir, 'processing-%DATE%.log'),
                level: 'info',
                elasticsearchIndex: 'photo-platform-processing'
            },
            'processing-summary': {
                filename: path.join(logsDir, 'processing-summary-%DATE%.log'),
                level: 'info',
                elasticsearchIndex: 'photo-platform-processing-summary'
            },
            faces: {
                filename: path.join(logsDir, 'faces-%DATE%.log'),
                level: 'info',
                elasticsearchIndex: 'photo-platform-faces'
            },
            performance: {
                filename: path.join(logsDir, 'performance-%DATE%.log'),
                level: 'info',
                elasticsearchIndex: 'photo-platform-performance'
            },
            audit: {
                filename: path.join(logsDir, 'api', 'audit-%DATE%.log'),
                level: 'info',
                elasticsearchIndex: 'photo-platform-audit'
            },
            'file-tracker': {
                filename: path.join(logsDir, 'file-tracker-%DATE%.log'),
                level: 'info',
                elasticsearchIndex: 'photo-platform-file-tracker'
            },
            'faces-review': {
                filename: path.join(logsDir, 'api', 'faces-review-%DATE%.log'),
                level: 'info',
                elasticsearchIndex: 'photo-platform-faces-review'
            }
        };
        
        // Create loggers for each category
        Object.entries(logConfigs).forEach(([category, config]) => {
            const transports: winston.transport[] = [
                // Console transport for development
                ...(this.isDevelopment ? [new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.timestamp(),
                        winston.format.printf(({ timestamp, level, message, ...meta }) => {
                            const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
                            return `[${level}] ${category}: ${message} ${metaStr}`;
                        })
                    )
                })] : []),
                
                // File transport with daily rotation
                new DailyRotateFile({
                    filename: config.filename,
                    datePattern: 'YYYY-MM-DD',
                    zippedArchive: true,
                    maxSize: '100m',
                    maxFiles: '14d',
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.json()
                    ),
                    level: config.level
                })
            ];

            // Add Elasticsearch transport if enabled
            if (this.enableElasticsearch && config.elasticsearchIndex) {
                const esTransport = new ElasticsearchTransport({
                    level: config.level,
                    client: esClient as any, // ElasticsearchTransport expects older client type
                    index: config.elasticsearchIndex,
                    transformer: (logData: any) => {
                        const transformed: any = {
                            '@timestamp': new Date().toISOString(),
                            category,
                            level: logData.level,
                            message: logData.message,
                            ...logData.meta
                        };
                        
                        // Add additional fields based on category
                        if (category === 'processing' && logData.meta?.correlationId) {
                            transformed.correlationId = logData.meta.correlationId;
                        }
                        
                        return transformed;
                    }
                });

                // Handle Elasticsearch transport errors
                esTransport.on('error', (error) => {
                    console.error('Elasticsearch transport error:', error);
                });

                transports.push(esTransport);
            }
            
            const logger = winston.createLogger({
                level: config.level,
                format: config.format || winston.format.json(),
                transports
            });
            
            this.loggers.set(category, logger);
        });
        
        // Also create a default logger
        const defaultLogger = winston.createLogger({
            level: 'info',
            format: winston.format.json(),
            transports: [
                ...(this.isDevelopment ? [new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                })] : []),
                new DailyRotateFile({
                    filename: path.join(logsDir, 'app-%DATE%.log'),
                    datePattern: 'YYYY-MM-DD',
                    zippedArchive: true,
                    maxSize: '100m',
                    maxFiles: '14d'
                }),
                ...(this.enableElasticsearch ? [new ElasticsearchTransport({
                    level: 'info',
                    client: esClient as any, // ElasticsearchTransport expects older client type
                    index: 'photo-platform-general'
                })] : [])
            ]
        });
        
        this.loggers.set('default', defaultLogger);
    }
    
    public get(category: string): winston.Logger {
        return this.loggers.get(category) || this.loggers.get('default')!;
    }
    
    // Convenience methods for common categories
    public info(message: string, meta?: any): void {
        this.get('system').info(message, meta);
    }
    
    public warn(message: string, meta?: any): void {
        this.get('system').warn(message, meta);
    }
    
    public error(message: string, error?: any, meta?: any): void {
        const errorData = {
            message,
            ...meta,
            error: error ? {
                message: error.message || String(error),
                stack: error.stack,
                code: error.code
            } : undefined
        };
        
        this.get('error').error(errorData);
        // Also log to system for visibility
        this.get('system').error(message, errorData);
    }
    
    public debug(message: string, meta?: any): void {
        this.get('system').debug(message, meta);
    }
    
    // Specialized logging methods
    public logApiRequest(data: ApiRequestData): void {
        this.get('api').info('API Request', data);
        
        // Log errors to error log as well
        if (data.error || data.statusCode >= 500) {
            this.get('error').error('API Error', data);
        }
    }
    
    public logImageProcessed(data: any): void {
        const { correlationId, ...processData } = data;
        this.get('processing').info('Image processed', {
            event: 'image_processed',
            correlationId,
            data: processData
        });
        
        // Also log summary
        const summary = {
            filename: path.basename(data.data?.imagePath || ''),
            status: data.data?.error ? 'failed' : 'success',
            faces: data.data?.operations?.faceDetection?.faces || 0,
            objects: data.data?.operations?.objectDetection?.objects || 0,
            duration: data.data?.processingTime || 0,
            correlationId
        };
        
        this.get('processing-summary').info(' ', summary);
    }
    
    public logFaceRecognition(data: FaceRecognitionData): void {
        this.get('faces').info('Face recognition', data);
    }
    
    public logPerformance(operation: string, metrics: any): void {
        this.get('performance').info(operation, metrics);
    }
    
    public logAudit(action: string, data: any): void {
        this.get('audit').info(action, {
            timestamp: new Date().toISOString(),
            action,
            ...data
        });
    }
    
    public startOperation(name: string): { end: (meta?: any) => void } {
        const start = Date.now();
        return {
            end: (meta?: any) => {
                const duration = Date.now() - start;
                this.logPerformance(name, { duration, ...meta });
            }
        };
    }
    
    // Additional methods for compatibility
    public logImageProcessingStart(imagePath: string): void {
        this.get('processing').info('Processing started', { 
            event: 'processing_start',
            imagePath 
        });
    }
    
    public logFaceDetected(imageId: number, faceData: any): void {
        this.get('faces').info('Face detected', {
            event: 'face_detected',
            imageId,
            ...faceData
        });
    }
    
    public logBatchProcessingSummary(summary: {
        totalImages: number;
        processedImages: number;
        failedImages: number;
        duration: number;
        batchId?: string;
    }): void {
        this.get('processing-summary').info('Batch processing completed', {
            event: 'batch_summary',
            ...summary
        });
    }
}

// Export singleton instance
export const logger = new StructuredLogger();