import { Request, Response } from 'express';
import * as smartAlbumsResolvers from '../resolvers/smart-albums';
import { logger as structuredLogger } from '../util/structured-logger';

/**
 * Get all smart albums
 */
export const listAlbums = async (req: Request, res: Response) => {
    try {
        const result = await smartAlbumsResolvers.listAlbums(req.query);
        res.json(result);
    } catch (error) {
        structuredLogger.error('Failed to list albums', {
            type: 'api',
            action: 'list_albums_error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to list albums'
        });
    }
};

/**
 * Get a specific album by slug or ID
 */
export const getAlbum = async (req: Request, res: Response) => {
    try {
        const result = await smartAlbumsResolvers.getAlbum(req.params.identifier);
        res.json(result);
    } catch (error) {
        structuredLogger.error('Failed to get album', {
            type: 'api',
            action: 'get_album_error',
            identifier: req.params.identifier,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        const status = (error as any).status || 500;
        res.status(status).json({
            success: false,
            error: status === 404 ? 'Album not found' : 'Failed to get album'
        });
    }
};

/**
 * Get images in an album
 */
export const getAlbumImages = async (req: Request, res: Response) => {
    try {
        const result = await smartAlbumsResolvers.getAlbumImages(req.params.identifier, req.query);
        res.json(result);
    } catch (error) {
        structuredLogger.error('Failed to get album images', {
            type: 'api',
            action: 'get_album_images_error',
            identifier: req.params.identifier,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        const status = (error as any).status || 500;
        res.status(status).json({
            success: false,
            error: status === 404 ? 'Album not found' : 'Failed to get album images'
        });
    }
};

/**
 * Create a new smart album
 */
export const createAlbum = async (req: Request, res: Response) => {
    try {
        const result = await smartAlbumsResolvers.createAlbum(req.body);
        res.status(201).json(result);
    } catch (error) {
        structuredLogger.error('Failed to create album', {
            type: 'api',
            action: 'create_album_error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        if (error instanceof Error && error.message.includes('Missing required fields')) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
        
        const status = (error as any).status || 500;
        res.status(status).json({
            success: false,
            error: status === 409 ? 'Album with this name already exists' : 'Failed to create album'
        });
    }
};

/**
 * Update a smart album
 */
export const updateAlbum = async (req: Request, res: Response) => {
    try {
        const result = await smartAlbumsResolvers.updateAlbum(req.params.identifier, req.body);
        res.json(result);
    } catch (error) {
        structuredLogger.error('Failed to update album', {
            type: 'api',
            action: 'update_album_error',
            identifier: req.params.identifier,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        const status = (error as any).status || 500;
        res.status(status).json({
            success: false,
            error: status === 404 ? 'Album not found' : 
                   status === 403 ? 'Cannot modify system albums' : 'Failed to update album'
        });
    }
};

/**
 * Delete a smart album
 */
export const deleteAlbum = async (req: Request, res: Response) => {
    try {
        const result = await smartAlbumsResolvers.deleteAlbum(req.params.identifier);
        res.json(result);
    } catch (error) {
        structuredLogger.error('Failed to delete album', {
            type: 'api',
            action: 'delete_album_error',
            identifier: req.params.identifier,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        const status = (error as any).status || 500;
        res.status(status).json({
            success: false,
            error: status === 404 ? 'Album not found' : 
                   status === 403 ? 'Cannot delete system albums' : 'Failed to delete album'
        });
    }
};

/**
 * Process images for smart albums
 */
export const processImages = async (req: Request, res: Response) => {
    try {
        const result = await smartAlbumsResolvers.processImages(req.query);
        res.json(result);
    } catch (error) {
        structuredLogger.error('Failed to process images', {
            type: 'api',
            action: 'process_images_error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to process images'
        });
    }
};

/**
 * Initialize default albums
 */
export const initializeDefaults = async (req: Request, res: Response) => {
    try {
        const result = await smartAlbumsResolvers.initializeDefaults();
        res.json(result);
    } catch (error) {
        structuredLogger.error('Failed to initialize default albums', {
            type: 'api',
            action: 'initialize_defaults_error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to initialize default albums'
        });
    }
};

/**
 * Get album statistics
 */
export const getAlbumStats = async (req: Request, res: Response) => {
    try {
        const result = await smartAlbumsResolvers.getAlbumStats(req.params.identifier);
        res.json(result);
    } catch (error) {
        structuredLogger.error('Failed to get album statistics', {
            type: 'api',
            action: 'get_album_stats_error',
            identifier: req.params.identifier,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        const status = (error as any).status || 500;
        res.status(status).json({
            success: false,
            error: status === 404 ? 'Album not found' : 'Failed to get album statistics'
        });
    }
};