import dotenv from 'dotenv';

// Load environment variables once
dotenv.config({ path: '/mnt/hdd/photo-process/.env' });

/**
 * Centralized configuration to eliminate duplicate dotenv.config() calls
 */
export const config = {
    // Server configuration
    port: process.env.PORT || 9000,
    
    // Media directories
    mediaSourceDir: process.env.media_source_dir || '',
    mediaDestDir: process.env.media_dest_dir || '',
    
    // CompreFace configuration
    comprefaceUrl: process.env.COMPREFACE_URL || 'http://localhost:8000',
    comprefaceApiKey: process.env.COMPREFACE_API_KEY || 'b6dd9990-6905-40b8-80d3-4655196ab139',
    
    // Database configuration (if needed)
    databaseUrl: process.env.DATABASE_URL,
    
    // Other configuration
    nodeEnv: process.env.NODE_ENV || 'development',
} as const;

export default config;