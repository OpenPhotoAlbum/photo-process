import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';
import { configManager } from './config-manager';

// Ensure logs directory exists
const logsDir = configManager.getStorage().logsDir || path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Define log categories and their configurations
interface LogConfig {
    filename: string;
    level: string;
    format?: winston.Logform.Format;
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
    
    constructor() {
        this.isDevelopment = process.env.NODE_ENV !== 'production';
        this.setupLoggers();
    }
    
    private setupLoggers() {
        // Define log configurations
        const logConfigs: Record<string, LogConfig> = {
            system: {
                filename: path.join(logsDir, 'system-%DATE%.log'),
                level: 'info'
            },
            error: {
                filename: path.join(logsDir, 'error-%DATE%.log'),
                level: 'error'
            },
            processing: {
                filename: path.join(logsDir, 'processing-%DATE%.log'),
                level: 'info'
            },
            'processing-summary': {
                filename: path.join(logsDir, 'processing-summary-%DATE%.log'),
                level: 'info',
                // Simplified format for easy scanning
                format: winston.format.printf(info => {
                    // Winston puts metadata in info when passed as second parameter
                    const timestamp = info.timestamp || new Date().toISOString();
                    const filename = info.filename || 'unknown';
                    const status = info.status || 'unknown';
                    const faces = info.faces || 0;
                    const objects = info.objects || 0;
                    const duration = info.duration || 0;
                    return `${timestamp} | ${filename} | ${status} | Faces: ${faces} | Objects: ${objects} | ${duration}ms`;
                })
            },
            faces: {
                filename: path.join(logsDir, 'faces-%DATE%.log'),
                level: 'info'
            },
            'faces-review': {
                filename: path.join(logsDir, 'faces-review-%DATE%.log'),
                level: 'info'
            },
            api: {
                filename: path.join(logsDir, 'api-%DATE%.log'),
                level: 'info'
            },
            performance: {
                filename: path.join(logsDir, 'performance-%DATE%.log'),
                level: 'info'
            },
            audit: {
                filename: path.join(logsDir, 'audit-%DATE%.log'),
                level: 'info'
            },
            'file-tracker': {
                filename: path.join(logsDir, 'file-tracker-%DATE%.log'),
                level: 'info'
            }
        };
        
        // Create logger instances
        Object.entries(logConfigs).forEach(([name, config]) => {
            const transports: winston.transport[] = [];
            
            // Rotating file transport
            transports.push(new DailyRotateFile({
                filename: config.filename,
                datePattern: 'YYYY-MM-DD',
                maxSize: '100m',
                maxFiles: '30d',
                level: config.level,
                zippedArchive: true, // Compress old logs
                format: config.format || winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.json()
                )
            }));
            
            // Add console transport in development
            if (this.isDevelopment) {
                transports.push(new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.printf(info => {
                            const prefix = `[${info.level}] ${name}:`;
                            
                            // Extract metadata (everything except Winston's standard fields)
                            const { level, message, timestamp, label, ...metadata } = info;
                            
                            let output = `${prefix} ${message}`;
                            
                            // Add metadata if present
                            if (Object.keys(metadata).length > 0) {
                                output += ` ${JSON.stringify(metadata)}`;
                            }
                            
                            return output;
                        })
                    )
                }));
            }
            
            const logger = winston.createLogger({
                format: config.format || winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.json()
                ),
                transports
            });
            
            this.loggers.set(name, logger);
        });
        
        // Create a special console logger for backwards compatibility
        const consoleLogger = winston.createLogger({
            transports: [
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                })
            ]
        });
        this.loggers.set('console', consoleLogger);
    }
    
    // Get specific logger
    get(name: string): winston.Logger {
        return this.loggers.get(name) || this.loggers.get('system')!;
    }
    
    // System events
    info(message: string, meta?: any) {
        this.get('system').info(message, meta);
    }
    
    warn(message: string, meta?: any) {
        this.get('system').warn(message, meta);
    }
    
    error(message: string, error?: any, meta?: any) {
        const errorData = {
            message,
            ...meta,
            error: error ? {
                message: error.message || String(error),
                stack: error.stack,
                code: error.code
            } : undefined
        };
        
        // Log to both error log and system log
        this.get('error').error(errorData);
        this.get('system').error(message, errorData);
    }
    
    debug(message: string, meta?: any) {
        if (this.isDevelopment) {
            this.get('system').debug(message, meta);
        }
    }
    
    // Image processing logs
    logImageProcessed(data: ImageProcessingData) {
        const correlationId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const logData = {
            event: 'image_processed',
            correlationId,
            data
        };
        
        this.get('processing').info('Image processed', logData);
        
        // Also log summary
        const filename = path.basename(data.imagePath);
        const status = data.error ? 'failed' : 'success';
        const faces = data.operations?.faceDetection?.faces || 0;
        const objects = data.operations?.objectDetection?.objects || 0;
        
        this.get('processing-summary').info('', {
            timestamp: new Date().toISOString(),
            filename,
            status,
            faces,
            objects,
            duration: data.processingTime,
            correlationId
        });
        
        // Log to error if failed
        if (data.error) {
            this.error(`Failed to process image: ${filename}`, data.error, { correlationId });
        }
    }
    
    logImageProcessingStart(imagePath: string) {
        const correlationId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.get('processing').info('Starting image processing', {
            event: 'processing_start',
            imagePath,
            correlationId
        });
        return correlationId;
    }
    
    // Face recognition logs
    logFaceRecognition(data: FaceRecognitionData) {
        const logData = {
            event: 'face_recognized',
            data
        };
        
        this.get('faces').info('Face recognition', logData);
        
        // If needs review, also log to review file
        if (data.confidence < configManager.getFaceRecognitionConfig().confidence.autoAssign && 
            data.confidence >= configManager.getFaceRecognitionConfig().confidence.review) {
            this.get('faces-review').info({
                timestamp: new Date().toISOString(),
                faceId: data.faceId,
                imagePath: data.imagePath,
                candidates: data.candidates || [{
                    personId: data.personId!,
                    name: data.personName!,
                    confidence: data.confidence
                }],
                reason: 'confidence_below_auto_threshold'
            });
        }
    }
    
    logFaceDetected(imageId: number, faceData: any) {
        this.get('faces').info('Face detected', {
            event: 'face_detected',
            imageId,
            faceData
        });
    }
    
    // API request logs
    logApiRequest(data: ApiRequestData) {
        const status = data.statusCode.toString();

        const colorizer = winston.format.colorize();

        let _status: string;
        if (status.charAt(0) === '2') {
            _status = colorizer.colorize('info', status)
        } else if (status.charAt(0) === '4') {
            _status = colorizer.colorize('warn', status)
        } else if (status.charAt(0) === '5') {
            _status = colorizer.colorize('error', status)
        } else {
            _status = status;
        }

        this.get('api').info(
            `${data.method} ${colorizer.colorize('warn', data.path)} - ${_status} (${data.duration}ms)`
        );

        // Log errors to error log as well
        if (data.statusCode >= 500) {
            this.error(`API error: ${data.method} ${data.path}`, data.error, data);
        }
    }
    
    // Performance logs
    logPerformance(operation: string, metrics: any) {
        this.get('performance').info('Performance metric', {
            timestamp: new Date().toISOString(),
            operation,
            metrics
        });
    }
    
    // Audit logs for security-sensitive events
    logAudit(event: string, data: any) {
        this.get('audit').info('Audit event', {
            timestamp: new Date().toISOString(),
            event,
            data
        });
    }
    
    // Batch processing summary
    logBatchProcessingSummary(summary: {
        totalImages: number;
        successful: number;
        failed: number;
        totalDuration: number;
        avgPerImage: number;
    }) {
        this.logPerformance('batch_processing', summary);
        this.info(`Batch processing completed: ${summary.successful}/${summary.totalImages} successful`, summary);
    }
    
    // Helper for operation timing
    startOperation(name: string): { end: (meta?: any) => void } {
        const start = Date.now();
        return {
            end: (meta?: any) => {
                const duration = Date.now() - start;
                this.debug(`Operation ${name} completed in ${duration}ms`, { ...meta, duration });
            }
        };
    }
}

// Export singleton instance
export const logger = new StructuredLogger();

// Also export a console-compatible interface for gradual migration
export const console = {
    log: (...args: any[]) => logger.get('console').info(args.join(' ')),
    error: (...args: any[]) => logger.error(args.join(' ')),
    warn: (...args: any[]) => logger.warn(args.join(' ')),
    info: (...args: any[]) => logger.info(args.join(' ')),
    debug: (...args: any[]) => logger.debug(args.join(' '))
};