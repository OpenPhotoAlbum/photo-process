import { logger as structuredLogger } from './util/structured-logger';

// Legacy Logger class that now uses structured logging
export class Logger {
    private static instance: Logger;
    private logger = structuredLogger;

    private constructor() {}

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    public info(message: string, meta?: any): void {
        this.logger.info(message, meta);
    }

    public warn(message: string, meta?: any): void {
        this.logger.warn(message, meta);
    }

    public error(message: string, error?: any, meta?: any): void {
        this.logger.error(message, error, meta);
    }

    public debug(message: string, meta?: any): void {
        this.logger.debug(message, meta);
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