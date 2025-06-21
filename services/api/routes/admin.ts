import express from 'express';
import { configManager } from '../util/config-manager';
import * as adminResolvers from '../resolvers/admin';

const router = express.Router();

// Admin panel endpoints - currently disabled by default
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
router.get('/config', requireAdminFeature, adminResolvers.getConfig);

// Get configuration schema/documentation
router.get('/config/schema', requireAdminFeature, adminResolvers.getConfigSchema);

// Update configuration (runtime changes)
router.put('/config', requireAdminFeature, adminResolvers.updateConfig);

// Reload configuration from files
router.post('/config/reload', requireAdminFeature, adminResolvers.reloadConfig);

// Validate current configuration
router.post('/config/validate', requireAdminFeature, adminResolvers.validateConfig);

// Get feature flags
router.get('/features', requireAdminFeature, adminResolvers.getFeatures);

// Health check for admin system
router.get('/health', adminResolvers.getHealth);

export default router;