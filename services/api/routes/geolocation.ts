import { Request, Response } from 'express';
import { GeolocationService } from '../util/geolocation';
import { Logger } from '../logger';

const logger = Logger.getInstance();

/**
 * GET /api/locations/search
 * Search images by location parameters
 * 
 * Query parameters:
 * - cityId: number - Search by specific city ID
 * - state: string - Search by state code (e.g., "CA", "NY")
 * - country: string - Search by country code (e.g., "US", "CA")
 * - lat: number - Latitude for radius search
 * - lng: number - Longitude for radius search  
 * - radius: number - Radius in miles for coordinate search (default: 10)
 * - limit: number - Maximum results to return (default: 50)
 * - offset: number - Results offset for pagination (default: 0)
 */
export const searchByLocation = async (req: Request, res: Response) => {
    try {
        const {
            cityId,
            state,
            country,
            lat,
            lng,
            radius = 10,
            limit = 50,
            offset = 0
        } = req.query;

        // Validate radius search parameters
        if ((lat || lng) && (!lat || !lng)) {
            return res.status(400).json({
                error: 'Both lat and lng parameters are required for radius search'
            });
        }

        // Build search options
        const searchOptions: any = {
            limit: parseInt(limit as string),
            offset: parseInt(offset as string)
        };

        if (cityId) {
            searchOptions.cityId = parseInt(cityId as string);
        }

        if (state) {
            searchOptions.stateCode = state as string;
        }

        if (country) {
            searchOptions.countryCode = country as string;
        }

        // Add radius search if coordinates provided
        if (lat && lng) {
            searchOptions.radiusFromCoords = {
                lat: parseFloat(lat as string),
                lon: parseFloat(lng as string),
                miles: parseFloat(radius as string)
            };
        }

        const images = await GeolocationService.searchImagesByLocation(searchOptions);

        res.json({
            images,
            pagination: {
                limit: searchOptions.limit,
                offset: searchOptions.offset,
                count: images.length
            },
            searchCriteria: searchOptions
        });
    } catch (error) {
        logger.error('Error searching images by location:', error);
        res.status(500).json({
            error: 'Failed to search images by location',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * GET /api/locations/stats
 * Get location statistics showing photo counts by location
 */
export const getLocationStats = async (req: Request, res: Response) => {
    try {
        const stats = await GeolocationService.getLocationStats();
        res.json({
            locationStats: stats,
            totalLocations: stats.length
        });
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
 * Find closest city to given coordinates
 * 
 * Query parameters:
 * - lat: number - Latitude (required)
 * - lng: number - Longitude (required) 
 * - radius: number - Search radius in miles (default: 10)
 */
export const getClosestCity = async (req: Request, res: Response) => {
    try {
        const { lat, lng, radius = 10 } = req.query;

        if (!lat || !lng) {
            return res.status(400).json({
                error: 'Both lat and lng parameters are required'
            });
        }

        const latitude = parseFloat(lat as string);
        const longitude = parseFloat(lng as string);
        const searchRadius = parseFloat(radius as string);

        if (isNaN(latitude) || isNaN(longitude) || isNaN(searchRadius)) {
            return res.status(400).json({
                error: 'Invalid coordinate or radius values'
            });
        }

        const result = await GeolocationService.getClosestCityIdByCoords(
            latitude,
            longitude,
            searchRadius
        );

        if (result.status === 200 && result.data) {
            // Get full location hierarchy
            const locationInfo = await GeolocationService.getLocationHierarchy(result.data.id);
            
            res.json({
                city: result.data,
                location: locationInfo,
                searchRadius: searchRadius,
                coordinates: { latitude, longitude }
            });
        } else {
            res.status(result.status).json({
                error: result.error,
                searchRadius: searchRadius,
                coordinates: { latitude, longitude }
            });
        }
    } catch (error) {
        logger.error('Error finding closest city:', error);
        res.status(500).json({
            error: 'Failed to find closest city',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * GET /api/images/:id/location
 * Get location information for a specific image
 */
export const getImageLocation = async (req: Request, res: Response) => {
    try {
        const imageId = parseInt(req.params.id);
        
        if (isNaN(imageId)) {
            return res.status(400).json({
                error: 'Invalid image ID'
            });
        }

        // Get image with location data
        const results = await GeolocationService.searchImagesByLocation({
            cityId: undefined, // Search all locations for this image
            limit: 1
        });

        const imageLocation = results.find(img => img.id === imageId);

        if (!imageLocation) {
            return res.status(404).json({
                error: 'Image not found or has no location data'
            });
        }

        res.json({
            imageId,
            location: {
                city: imageLocation.city,
                state: imageLocation.state_name,
                country: imageLocation.country_name,
                coordinates: {
                    latitude: imageLocation.gps_latitude,
                    longitude: imageLocation.gps_longitude
                },
                confidence: imageLocation.confidence_score,
                distance: imageLocation.distance_miles
            }
        });
    } catch (error) {
        logger.error(`Error getting location for image ${req.params.id}:`, error);
        res.status(500).json({
            error: 'Failed to get image location',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * POST /api/locations/retroactive
 * Process geolocation for existing images with GPS data
 * 
 * Body parameters:
 * - limit: number - Maximum images to process (default: 100)
 * - radius: number - Search radius in miles (default: 25)
 */
export const processRetroactiveGeolocation = async (req: Request, res: Response) => {
    try {
        const { limit = 100, radius = 25 } = req.body;

        // Get images without location data
        const images = await GeolocationService.getImagesWithoutLocation(limit);
        
        if (images.length === 0) {
            return res.json({
                message: 'No images with GPS data found that need location processing',
                processed: 0,
                skipped: 0
            });
        }

        let processed = 0;
        let skipped = 0;

        for (const image of images) {
            try {
                logger.info(`Processing retroactive geolocation for image ${image.id}`);
                
                const locationInfo = await GeolocationService.processImageLocation(
                    image.id,
                    {
                        latitude: image.gps_latitude,
                        longitude: image.gps_longitude
                    },
                    radius
                );

                if (locationInfo) {
                    processed++;
                    logger.info(`Processed image ${image.id}: ${locationInfo.fullLocationString}`);
                } else {
                    skipped++;
                    logger.info(`Skipped image ${image.id}: no location found within ${radius} miles`);
                }
            } catch (error) {
                skipped++;
                logger.error(`Failed to process image ${image.id}:`, error);
            }
        }

        res.json({
            message: 'Retroactive geolocation processing completed',
            totalImages: images.length,
            processed,
            skipped,
            searchRadius: radius
        });
    } catch (error) {
        logger.error('Error in retroactive geolocation processing:', error);
        res.status(500).json({
            error: 'Failed to process retroactive geolocation',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};