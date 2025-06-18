import { logger as structuredLogger } from './util/structured-logger';

// Legacy Logger class that now uses structured logging
export class Logger {
    private static instance: Logger;
    private static categoryInstances: Map<string, Logger> = new Map();
    private logger = structuredLogger;
    private category?: string;

    private constructor(category?: string) {
        this.category = category;
    }

    public static getInstance(category?: string): Logger {
        if (category) {
            if (!Logger.categoryInstances.has(category)) {
                Logger.categoryInstances.set(category, new Logger(category));
            }
            return Logger.categoryInstances.get(category)!;
        }
        
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    public info(message: string, meta?: any): void {
        if (this.category) {
            this.logger.get(this.category).info(message, meta);
        } else {
            this.logger.info(message, meta);
        }
    }

    public warn(message: string, meta?: any): void {
        if (this.category) {
            this.logger.get(this.category).warn(message, meta);
        } else {
            this.logger.warn(message, meta);
        }
    }

    public error(message: string, error?: any, meta?: any): void {
        if (this.category) {
            const errorData = {
                message,
                ...meta,
                error: error ? {
                    message: error.message || String(error),
                    stack: error.stack,
                    code: error.code
                } : undefined
            };
            this.logger.get(this.category).error(errorData);
        } else {
            this.logger.error(message, error, meta);
        }
    }

    public debug(message: string, meta?: any): void {
        if (this.category) {
            this.logger.get(this.category).debug(message, meta);
        } else {
            this.logger.debug(message, meta);
        }
    }
    
    // New methods for specific logging needs
    public logImageProcessed(data: any): void {
        this.logger.logImageProcessed(data);
    }
    
    public logFaceRecognition(data: any): void {
        this.logger.logFaceRecognition(data);
    }
    
    public logPerformance(operation: string, metrics: any): void {
        this.logger.logPerformance(operation, metrics);
    }
    
    public startOperation(name: string): { end: (meta?: any) => void } {
        return this.logger.startOperation(name);
    }
}