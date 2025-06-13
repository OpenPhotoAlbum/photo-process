import { Request, Response, NextFunction } from 'express';
import { logger } from '../util/structured-logger';

// Extend Express Request to include logging context
declare global {
    namespace Express {
        interface Request {
            id: string;
            startTime: number;
            logger: typeof logger;
        }
    }
}

// Generate request ID
function generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Request logging middleware
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
    // Add request ID and start time
    req.id = generateRequestId();
    req.startTime = Date.now();
    req.logger = logger;
    
    // Log request start
    logger.get('api').debug(`${req.method} ${req.path} started`, {
        requestId: req.id,
        method: req.method,
        path: req.path,
        query: req.query,
        ip: req.ip,
        userAgent: req.headers['user-agent']
    });
    
    // Capture response finish
    const originalSend = res.send;
    res.send = function(data: any) {
        const duration = Date.now() - req.startTime;
        
        // Log the completed request
        logger.logApiRequest({
            requestId: req.id,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration,
            userId: (req as any).user?.id,
            ip: req.ip,
            error: res.statusCode >= 400 ? data : undefined
        });
        
        // Call original send
        return originalSend.call(this, data);
    };
    
    next();
}

// Error logging middleware
export function errorLogger(err: any, req: Request, res: Response, next: NextFunction): void {
    const duration = Date.now() - req.startTime;
    
    logger.error(`Request error: ${req.method} ${req.path}`, err, {
        requestId: req.id,
        method: req.method,
        path: req.path,
        duration,
        statusCode: err.status || 500
    });
    
    next(err);
}