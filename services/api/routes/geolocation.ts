import { Request, Response } from 'express';
import * as geolocationResolvers from '../resolvers/geolocation';
import { Logger } from '../logger';

const logger = Logger.getInstance();

/**
 * GET /api/locations/search
 */
export const searchByLocation = async (req: Request, res: Response) => {
    try {
        const result = await geolocationResolvers.searchByLocation(req.query);
        res.json(result);
    } catch (error) {
        logger.error('Error searching images by location:', error);
        res.status(400).json({
            error: error instanceof Error ? error.message : 'Failed to search images by location'
        });
    }
};

/**
 * GET /api/locations/stats
 */
export const getLocationStats = async (req: Request, res: Response) => {
    try {
        const result = await geolocationResolvers.getLocationStats();
        res.json(result);
    } catch (error) {
        logger.error('Error getting location statistics:', error);
        res.status(500).json({
            error: 'Failed to get location statistics',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * GET /api/locations/closest
 */
export const getClosestCity = async (req: Request, res: Response) => {
    try {
        const result = await geolocationResolvers.getClosestCity(req.query);
        res.json(result);
    } catch (error) {
        logger.error('Error finding closest city:', error);
        const status = (error as any).status || 500;
        res.status(status).json({
            error: error instanceof Error ? error.message : 'Failed to find closest city'
        });
    }
};

/**
 * GET /api/images/:id/location
 */
export const getImageLocation = async (req: Request, res: Response) => {
    try {
        const imageId = parseInt(req.params.id);
        const result = await geolocationResolvers.getImageLocation(imageId);
        res.json(result);
    } catch (error) {
        logger.error(`Error getting location for image ${req.params.id}:`, error);
        const status = (error as any).status || 500;
        res.status(status).json({
            error: error instanceof Error ? error.message : 'Failed to get image location'
        });
    }
};

/**
 * POST /api/locations/retroactive
 */
export const processRetroactiveGeolocation = async (req: Request, res: Response) => {
    try {
        const result = await geolocationResolvers.processRetroactiveGeolocation(req.body);
        res.json(result);
    } catch (error) {
        logger.error('Error in retroactive geolocation processing:', error);
        res.status(500).json({
            error: 'Failed to process retroactive geolocation',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};