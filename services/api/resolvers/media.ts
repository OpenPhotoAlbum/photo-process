import { ImageServer } from '../util/image-server';
import fs from 'fs';
import path from 'path';
import { configManager } from '../util/config-manager';
import https from 'https';
import sharp from 'sharp';

/**
 * Serve media files (hash-based or legacy)
 */
export const serveMedia = async (requestUrl: string) => {
    // Get the requested path from URL
    const urlPath = requestUrl.split('?')[0];
    const requestedPath = urlPath.startsWith('/') ? urlPath.substring(1) : urlPath;
    
    // Check if this is a hash-based media request (starts with YYYY/MM/ pattern)
    const hashBasedPattern = /^(\d{4}\/\d{2}\/.+)$/;
    const isHashBased = hashBasedPattern.test(requestedPath);
    
    if (isHashBased) {
        // Hash-based media serving - files are stored in processedDir/media/
        const processedDir = configManager.getStorage().processedDir;
        const mediaPath = path.join(processedDir, 'media', requestedPath);
        
        if (fs.existsSync(mediaPath)) {
            return {
                type: 'hash-based',
                basePath: path.join(processedDir, 'media'),
                requestedPath,
                exists: true
            };
        } else {
            const error = new Error('Hash-based media file not found');
            (error as any).status = 404;
            throw error;
        }
    } else {
        // Legacy media serving
        const processedPath = path.join(configManager.getStorage().processedDir, requestedPath);
        const sourcePath = path.join(configManager.getStorage().sourceDir, requestedPath);
        
        // Check which directory has the file and serve from there
        if (fs.existsSync(processedPath)) {
            return {
                type: 'processed',
                requestedPath,
                exists: true
            };
        } else if (fs.existsSync(sourcePath)) {
            return {
                type: 'source',
                requestedPath,
                exists: true
            };
        } else {
            const error = new Error('Legacy media file not found');
            (error as any).status = 404;
            throw error;
        }
    }
};

/**
 * Generate map proxy image
 */
export const generateMapProxy = async (query: any) => {
    const { lat, lon, simple } = query;
    
    if (!lat || !lon) {
        throw new Error('Missing lat or lon parameters');
    }
    
    const latNum = parseFloat(lat as string);
    const lonNum = parseFloat(lon as string);
    
    if (isNaN(latNum) || isNaN(lonNum)) {
        throw new Error('Invalid lat or lon values');
    }
    
    // Simple mode - just return a single tile for testing
    if (simple === 'true') {
        const zoom = 13;
        const tileX = Math.floor(lon2tile(lonNum, zoom));
        const tileY = Math.floor(lat2tile(latNum, zoom));
        
        console.log(`[MapProxy] Simple mode - fetching single tile for ${latNum}, ${lonNum}`);
        
        try {
            const tileBuffer = await fetchTile(zoom, tileX, tileY);
            return {
                buffer: tileBuffer,
                contentType: 'image/png',
                cacheControl: 'public, max-age=3600'
            };
        } catch (error) {
            console.error('[MapProxy] Simple mode failed:', error);
            throw new Error('Failed to fetch tile: ' + (error as Error).message);
        }
    }
    
    // Map configuration
    const zoom = 13;
    const mapWidth = 400;
    const mapHeight = 200;
    const tileSize = 256;
    
    console.log(`[MapProxy] Generating map for lat=${latNum}, lon=${lonNum} at zoom=${zoom}`);
    
    // Calculate tile coordinates for center point
    const centerTileX = lon2tile(lonNum, zoom);
    const centerTileY = lat2tile(latNum, zoom);
    
    // Calculate pixel offset within the center tile
    const centerPixelX = Math.floor((centerTileX % 1) * tileSize);
    const centerPixelY = Math.floor((centerTileY % 1) * tileSize);
    
    // Calculate how many tiles we need to fetch
    const tilesNeededX = Math.ceil(mapWidth / tileSize) + 1;
    const tilesNeededY = Math.ceil(mapHeight / tileSize) + 1;
    
    // Calculate starting tile
    const startTileX = Math.floor(centerTileX) - Math.floor(tilesNeededX / 2);
    const startTileY = Math.floor(centerTileY) - Math.floor(tilesNeededY / 2);
    
    console.log(`[MapProxy] Center tile: X=${centerTileX}, Y=${centerTileY}`);
    console.log(`[MapProxy] Fetching ${tilesNeededX}x${tilesNeededY} tiles starting from X=${startTileX}, Y=${startTileY}`);
    
    // Fetch all required tiles
    const tilePromises: Promise<Buffer>[] = [];
    const tilePositions: { x: number; y: number; buffer?: Buffer }[] = [];
    
    for (let y = 0; y < tilesNeededY; y++) {
        for (let x = 0; x < tilesNeededX; x++) {
            const tileX = startTileX + x;
            const tileY = startTileY + y;
            const position: { x: number; y: number; buffer?: Buffer } = { x, y };
            tilePositions.push(position);
            
            const tilePromise = fetchTile(zoom, tileX, tileY)
                .then(buffer => {
                    position.buffer = buffer;
                    return buffer;
                })
                .catch(err => {
                    console.error(`Failed to fetch tile ${zoom}/${tileX}/${tileY}:`, err);
                    // Return empty buffer on error
                    return Buffer.alloc(0);
                });
            
            tilePromises.push(tilePromise);
        }
    }
    
    // Wait for all tiles to be fetched
    await Promise.all(tilePromises);
    
    // Log tile fetch results
    const successfulTiles = tilePositions.filter(p => p.buffer && p.buffer.length > 0).length;
    console.log(`[MapProxy] Fetched ${successfulTiles}/${tilePositions.length} tiles successfully`);
    
    if (successfulTiles === 0) {
        throw new Error('No tiles were successfully fetched');
    }
    
    // Create composite image
    const compositeWidth = tilesNeededX * tileSize;
    const compositeHeight = tilesNeededY * tileSize;
    console.log(`[MapProxy] Creating composite image: ${compositeWidth}x${compositeHeight}`);
    
    try {
        console.log(`[MapProxy] Attempting simple tile arrangement without Sharp composite...`);
        
        // For now, just return the center tile as a fallback to avoid Sharp errors
        // This gives us a working map thumbnail while we debug the compositing
        const centerIndex = Math.floor(tilePositions.length / 2);
        if (tilePositions.length > centerIndex && tilePositions[centerIndex].buffer) {
            console.log(`[MapProxy] Using center tile (index ${centerIndex}) as fallback to avoid Sharp composite issues`);
            
            const centerTile = tilePositions[centerIndex].buffer;
            
            // Resize to desired dimensions
            const resizedTile = await sharp(centerTile)
                .resize(mapWidth, mapHeight, { fit: 'cover' })
                .png()
                .toBuffer();
                
            console.log(`[MapProxy] Resized center tile to ${mapWidth}x${mapHeight}`);
            
            return {
                buffer: resizedTile,
                contentType: 'image/png',
                cacheControl: 'public, max-age=86400'
            };
        }
        
        // If we get here, no tiles were available
        throw new Error('No tiles available for map generation');
        
    } catch (sharpError) {
        console.error('[MapProxy] Sharp processing error:', sharpError);
        throw new Error('Image compositing failed: ' + (sharpError as Error).message);
    }
};

// Helper functions for tile calculations
function lon2tile(lon: number, zoom: number): number {
    return (lon + 180) / 360 * Math.pow(2, zoom);
}

function lat2tile(lat: number, zoom: number): number {
    return (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom);
}

// Fetch a single tile from OpenStreetMap
function fetchTile(zoom: number, x: number, y: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const url = `https://tile.openstreetmap.org/${zoom}/${Math.floor(x)}/${Math.floor(y)}.png`;
        console.log(`[MapProxy] Fetching tile: ${url}`);
        
        const request = https.get(url, {
            headers: {
                'User-Agent': 'PhotoManagementPlatform/1.0' // OSM requires user agent
            },
            timeout: 5000 // 5 second timeout
        }, (response) => {
            if (response.statusCode !== 200) {
                console.error(`[MapProxy] Tile fetch failed: ${url} - HTTP ${response.statusCode}`);
                reject(new Error(`HTTP ${response.statusCode}`));
                return;
            }
            
            const chunks: Buffer[] = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => {
                const buffer = Buffer.concat(chunks);
                console.log(`[MapProxy] Tile fetched successfully: ${url} (${buffer.length} bytes)`);
                resolve(buffer);
            });
            response.on('error', (error) => {
                console.error(`[MapProxy] Tile fetch error: ${url}`, error);
                reject(error);
            });
        }).on('error', (error) => {
            console.error(`[MapProxy] Request error: ${url}`, error);
            reject(error);
        }).on('timeout', () => {
            console.error(`[MapProxy] Request timeout: ${url}`);
            request.destroy();
            reject(new Error('Request timeout'));
        });
    });
}