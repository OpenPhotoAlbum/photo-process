import { Request, Response, NextFunction } from 'express';
import { Logger } from '../logger';

const logger = Logger.getInstance();

export class AppError extends Error {
    public statusCode: number;
    public isOperational: boolean;

    constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        
        Error.captureStackTrace(this, this.constructor);
    }
}

export const errorHandler = (
    error: Error | AppError,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    let statusCode = 500;
    let message = 'Internal server error';
    let isOperational = false;

    if (error instanceof AppError) {
        statusCode = error.statusCode;
        message = error.message;
        isOperational = error.isOperational;
    } else if (error.name === 'ValidationError') {
        statusCode = 400;
        message = error.message;
        isOperational = true;
    } else if (error.name === 'CastError') {
        statusCode = 400;
        message = 'Invalid ID format';
        isOperational = true;
    } else if (error.message?.includes('ER_NO_SUCH_TABLE')) {
        statusCode = 500;
        message = 'Database table not found - please run migrations';
        isOperational = false;
    } else if (error.message?.includes('ECONNREFUSED')) {
        statusCode = 503;
        message = 'Database connection failed';
        isOperational = false;
    }

    // Log error details
    if (!isOperational || statusCode >= 500) {
        logger.error(`Error ${statusCode}: ${message} - ${error.message} - ${req.method} ${req.url}`);
    } else {
        logger.warn(`Client error ${statusCode}: ${message} - ${req.method} ${req.url}`);
    }

    // Send error response
    res.status(statusCode).json({
        error: message,
        ...(process.env.NODE_ENV === 'development' && {
            details: error.message,
            stack: error.stack
        })
    });
};

export const asyncHandler = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
    const error = new AppError(`Route ${req.originalUrl} not found`, 404);
    next(error);
};

// Validation helpers
export const validatePersonId = (id: string): number => {
    const personId = parseInt(id);
    if (isNaN(personId) || personId <= 0) {
        throw new AppError('Invalid person ID', 400);
    }
    return personId;
};

export const validateFaceId = (id: string): number => {
    const faceId = parseInt(id);
    if (isNaN(faceId) || faceId <= 0) {
        throw new AppError('Invalid face ID', 400);
    }
    return faceId;
};

export const validateImageId = (id: string): number => {
    const imageId = parseInt(id);
    if (isNaN(imageId) || imageId <= 0) {
        throw new AppError('Invalid image ID', 400);
    }
    return imageId;
};

export const validateRequired = (value: any, fieldName: string): void => {
    if (!value || (typeof value === 'string' && value.trim().length === 0)) {
        throw new AppError(`${fieldName} is required`, 400);
    }
};

export const validateArray = (value: any, fieldName: string): void => {
    if (!Array.isArray(value) || value.length === 0) {
        throw new AppError(`${fieldName} must be a non-empty array`, 400);
    }
};