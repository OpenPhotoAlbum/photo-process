import { Request, Response } from 'express';
import { configManager } from '../util/config-manager';
import { Logger } from '../logger';

const logger = Logger.getInstance();

// Get current configuration (read-only)
export const getConfig = (req: Request, res: Response) => {
    try {
        const config = configManager.getConfigSummary() as any;
        
        // Remove sensitive information
        const safeConfig = {
            ...config,
            database: {
                ...config.database,
                password: '***hidden***',
                rootPassword: '***hidden***'
            }
        };
        
        res.json({
            success: true,
            config: safeConfig,
            timestamp: new Date().toISOString()
        });
        
        logger.info('Admin config retrieved via API');
    } catch (error) {
        logger.error('Failed to get admin config: ' + (error instanceof Error ? error.message : 'Unknown error'));
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve configuration'
        });
    }
};

// Get configuration schema/documentation
export const getConfigSchema = (req: Request, res: Response) => {
    // Future: Return JSON schema for configuration validation
    res.json({
        success: true,
        message: 'Configuration schema endpoint - to be implemented',
        documentation: 'See .env.example and config/settings.example.json for available options'
    });
};

// Update configuration (runtime changes)
export const updateConfig = (req: Request, res: Response) => {
    try {
        const updates = req.body;
        
        // TODO: Validate updates against schema
        // TODO: Sanitize sensitive fields
        // TODO: Check permissions for each config section
        
        // For now, return not implemented
        res.status(501).json({
            success: false,
            message: 'Configuration updates via API not yet implemented',
            hint: 'Use environment variables or config/settings.json for now'
        });
        
        logger.warn('Admin config update attempted but not implemented');
    } catch (error) {
        logger.error('Failed to update admin config: ' + (error instanceof Error ? error.message : 'Unknown error'));
        res.status(500).json({
            success: false,
            error: 'Failed to update configuration'
        });
    }
};

// Reload configuration from files
export const reloadConfig = (req: Request, res: Response) => {
    try {
        configManager.reload();
        
        res.json({
            success: true,
            message: 'Configuration reloaded successfully',
            timestamp: new Date().toISOString()
        });
        
        logger.info('Configuration reloaded via admin API');
    } catch (error) {
        logger.error('Failed to reload config: ' + (error instanceof Error ? error.message : 'Unknown error'));
        res.status(500).json({
            success: false,
            error: 'Failed to reload configuration'
        });
    }
};

// Validate current configuration
export const validateConfig = (req: Request, res: Response) => {
    try {
        // The config manager validates on load, so if we got here, config is valid
        const config = configManager.get();
        
        res.json({
            success: true,
            valid: true,
            message: 'Configuration is valid',
            summary: configManager.getConfigSummary()
        });
        
        logger.info('Configuration validation requested via API');
    } catch (error) {
        logger.error('Configuration validation failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
        res.status(400).json({
            success: false,
            valid: false,
            error: error instanceof Error ? error.message : 'Unknown validation error'
        });
    }
};

// Get feature flags
export const getFeatures = (req: Request, res: Response) => {
    try {
        const features = configManager.getFeatures();
        
        res.json({
            success: true,
            features,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Failed to get features: ' + (error instanceof Error ? error.message : 'Unknown error'));
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve feature flags'
        });
    }
};

// Health check for admin system
export const getHealth = (req: Request, res: Response) => {
    const features = configManager.getFeatures();
    
    res.json({
        success: true,
        adminApiEnabled: features.enableApiConfig,
        configValid: true, // If we got here, config loaded successfully
        timestamp: new Date().toISOString()
    });
};