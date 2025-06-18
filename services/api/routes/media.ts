import { Request, Response } from 'express';
import { ImageServer } from '../util/image-server';
import fs from 'fs';
import path from 'path';
import { configManager } from '../util/config-manager';
import { ImageRepository } from '../models/database';
import { HashManager } from '../util/hash-manager';
import https from 'https';
import sharp from 'sharp';

export const Media = async (request: Request, response: Response) => {
    // Get the requested path from URL
    const urlPath = request.url.split('?')[0];
    const requestedPath = urlPath.startsWith('/') ? urlPath.substring(1) : urlPath;
    
    // Check if this is a hash-based media request (starts with YYYY/MM/ pattern)
    const hashBasedPattern = /^(\d{4}\/\d{2}\/.+)$/;
    const isHashBased = hashBasedPattern.test(requestedPath);
    
    if (isHashBased) {
        // Hash-based media serving - files are stored in processedDir/media/
        const processedDir = configManager.getStorage().processedDir;
        const mediaPath = path.join(processedDir, 'media', requestedPath);
        
        if (fs.existsSync(mediaPath)) {
            // Serve directly from processedDir/media/ using custom options
            await ImageServer.serveImage(request, response, {
                baseDir: path.join(processedDir, 'media'),
                cacheDuration: 86400,
                securityCheck: true
            });
        } else {
            response.status(404).json({ error: 'Hash-based media file not found' });
        }
    } else {
        // Legacy media serving
        const processedPath = path.join(configManager.getStorage().processedDir, requestedPath);
        const sourcePath = path.join(configManager.getStorage().sourceDir, requestedPath);
        
        // Check which directory has the file and serve from there
        if (fs.existsSync(processedPath)) {
            // File exists in processed directory (face images, thumbnails, etc.)
            await ImageServer.serveProcessedMedia(request, response);
        } else if (fs.existsSync(sourcePath)) {
            // File exists in source directory (original photos)
            await ImageServer.serveSourceMedia(request, response);
        } else {
            response.status(404).json({ error: 'Legacy media file not found' });
        }
    }
}

// Map proxy endpoint - fetch and stitch OpenStreetMap tiles
export const MapProxy = async (request: Request, response: Response) => {
    try {
        const { lat, lon, simple } = request.query;
        
        if (!lat || !lon) {
            return response.status(400).json({ error: 'Missing lat or lon parameters' });
        }
        
        const latNum = parseFloat(lat as string);
        const lonNum = parseFloat(lon as string);
        
        if (isNaN(latNum) || isNaN(lonNum)) {
            return response.status(400).json({ error: 'Invalid lat or lon values' });
        }
        
        // Simple mode - just return a single tile for testing
        if (simple === 'true') {
            const zoom = 13;
            const tileX = Math.floor(lon2tile(lonNum, zoom));
            const tileY = Math.floor(lat2tile(latNum, zoom));
            const tileUrl = `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`;
            
            console.log(`[MapProxy] Simple mode - fetching single tile: ${tileUrl}`);
            
            try {
                const tileBuffer = await fetchTile(zoom, tileX, tileY);
                response.setHeader('Content-Type', 'image/png');
                response.setHeader('Cache-Control', 'public, max-age=3600');
                response.send(tileBuffer);
                return;
            } catch (error) {
                console.error('[MapProxy] Simple mode failed:', error);
                return response.status(500).json({ error: 'Failed to fetch tile', details: (error as Error).message });
            }
        }
        
        // Map configuration
        const zoom = 13; // Zoom out a bit to show more area
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
                
                // Send the image
                response.setHeader('Content-Type', 'image/png');
                response.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
                response.send(resizedTile);
                return;
            }
            
            // If we get here, no tiles were available
            throw new Error('No tiles available for map generation');
            
        } catch (sharpError) {
            console.error('[MapProxy] Sharp processing error:', sharpError);
            throw new Error('Image compositing failed: ' + (sharpError as Error).message);
        }
        
    } catch (error) {
        console.error('Map proxy error:', error);
        response.status(500).json({ error: 'Internal server error' });
    }
}

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
