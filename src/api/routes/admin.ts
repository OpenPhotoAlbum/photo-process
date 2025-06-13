import express from 'express';
import { configManager } from '../util/config-manager';
import { Logger } from '../logger';

const router = express.Router();
const logger = Logger.getInstance();

// Future admin panel endpoints - currently disabled by default
// Enable by setting FEATURE_API_CONFIG=true in environment

// Middleware to check if admin config API is enabled
const requireAdminFeature = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    const features = configManager.getFeatures();
    
    if (!features.enableApiConfig) {
        res.status(503).json({
            error: 'Admin configuration API is disabled',
            message: 'Set FEATURE_API_CONFIG=true to enable admin configuration endpoints'
        });
        return;
    }
    
    // TODO: Add authentication middleware here when implementing admin panel
    // Example: requireAuth, requireAdminRole, etc.
    
    next();
};

// Get current configuration (read-only)
router.get('/config', requireAdminFeature, (req, res) => {
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
});

// Get configuration schema/documentation
router.get('/config/schema', requireAdminFeature, (req, res) => {
    // Future: Return JSON schema for configuration validation
    res.json({
        success: true,
        message: 'Configuration schema endpoint - to be implemented',
        documentation: 'See .env.example and config/settings.example.json for available options'
    });
});

// Update configuration (runtime changes)
router.put('/config', requireAdminFeature, (req, res) => {
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
});

// Reload configuration from files
router.post('/config/reload', requireAdminFeature, (req, res) => {
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
});

// Validate current configuration
router.post('/config/validate', requireAdminFeature, (req, res) => {
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
});

// Get feature flags
router.get('/features', requireAdminFeature, (req, res) => {
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
});

// Health check for admin system
router.get('/health', (req, res) => {
    const features = configManager.getFeatures();
    
    res.json({
        success: true,
        adminApiEnabled: features.enableApiConfig,
        configValid: true, // If we got here, config loaded successfully
        timestamp: new Date().toISOString()
    });
});

export default router;