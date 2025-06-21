require('dotenv').config();
import express from 'express';
import path from 'path';
import { Logger } from './logger';
import { setupRoutes } from './routes/routes';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { requestLogger, errorLogger } from './middleware/request-logger';
import { StartupValidator } from './util/startup-validator';
import { configManager } from './util/config-manager';
import { fileTracker } from './util/file-tracker';
import { logger as structuredLogger } from './util/structured-logger';

const logger = Logger.getInstance();

const main = async () => {
    try {
        // Temporarily disable startup validation during refactoring
        // const validator = new StartupValidator();
        // const validationReport = await validator.validateStartup();
        // StartupValidator.printReport(validationReport);
        
        logger.info('Starting API...');
        
        // Initialize FileTracker once at startup
        logger.info('Initializing FileTracker...');
        await fileTracker.initialize();
        
        const app = express()
        const port = configManager.getServer().port
        
        logger.info(`Configuring server on port ${port}...`);

    // Request logging middleware (before all routes)
    logger.info('Adding request logger middleware...');
    app.use(requestLogger);

    // Parse JSON bodies (must be early)
    app.use(express.json());

    // Setup all API routes
    logger.info('Setting up API routes...');
    setupRoutes(app);
    
    // Serve processed images statically (will add thumbnail support later)
    const processedDir = configManager.getStorage().processedDir;
    logger.info(`Setting up static file serving for processed images from: ${processedDir}`);
    if (processedDir) {
        app.use('/processed', express.static(processedDir));
    }
    
    // Metadata now stored in database only - no file serving needed

    // Error handling middleware (must be last)
    app.use(notFoundHandler);
    app.use(errorLogger);  // Log errors before handling
    app.use(errorHandler);

    app.listen(port, async () => {
        logger.info(`Server started`, { port, environment: process.env.NODE_ENV || 'development' });
        
        // logRoutes(app);
        
        // Set up Elasticsearch logging after server starts
        setTimeout(async () => {
            await structuredLogger.setupElasticsearchLogging();
        }, 3000); // Wait 3 seconds for Elasticsearch to be ready
        
        // Start auto scanner if enabled
        if (process.env.AUTO_SCAN_ENABLED === 'true') {
            const { autoScanner } = await import('./util/auto-scanner');
            await autoScanner.start();
            logger.info('Auto scanner service started');
        }
    })
    } catch (error) {
        logger.error('Error in main:', error);
        throw error;
    }
}

// Call main to start the server
main().catch(error => {
    console.error('FULL ERROR:', error);
    logger.error('Failed to start server:', error?.message || error);
    logger.error('Stack trace:', error?.stack);
    process.exit(1);
});

const logRoutes = (app: any) => {
    var route, routes: any[] = [];
    app.router.stack.forEach(function(middleware: any){
        if(middleware.route){
            routes.push(middleware.route.path);
        } else if(middleware.name === 'router'){ 
            middleware.handle.stack.forEach(function(handler: any){
                route = handler.route.path;
                route && routes.push(route.path);
            });
        }
    });

    // eslint-disable-next-line
    console.log(routes);
}

export default main;