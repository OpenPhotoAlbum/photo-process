import { GeolocationService } from '../util/geolocation';
import { Logger } from '../logger';

const logger = Logger.getInstance();

/**
 * Search images by location parameters
 */
export const searchByLocation = async (query: any) => {
    const {
        cityId,
        state,
        country,
        lat,
        lng,
        radius = 10,
        limit = 50,
        offset = 0
    } = query;

    // Validate radius search parameters
    if ((lat || lng) && (!lat || !lng)) {
        throw new Error('Both lat and lng parameters are required for radius search');
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

    return {
        images,
        pagination: {
            limit: searchOptions.limit,
            offset: searchOptions.offset,
            count: images.length
        },
        searchCriteria: searchOptions
    };
};

/**
 * Get location statistics showing photo counts by location
 */
export const getLocationStats = async () => {
    const stats = await GeolocationService.getLocationStats();
    
    return {
        locationStats: stats,
        totalLocations: stats.length
    };
};

/**
 * Find closest city to given coordinates
 */
export const getClosestCity = async (query: any) => {
    const { lat, lng, radius = 10 } = query;

    if (!lat || !lng) {
        throw new Error('Both lat and lng parameters are required');
    }

    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lng as string);
    const searchRadius = parseFloat(radius as string);

    if (isNaN(latitude) || isNaN(longitude) || isNaN(searchRadius)) {
        throw new Error('Invalid coordinate or radius values');
    }

    const result = await GeolocationService.getClosestCityIdByCoords(
        latitude,
        longitude,
        searchRadius
    );

    if (result.status === 200 && result.data) {
        // Get full location hierarchy
        const locationInfo = await GeolocationService.getLocationHierarchy(result.data.id);
        
        return {
            city: result.data,
            location: locationInfo,
            searchRadius: searchRadius,
            coordinates: { latitude, longitude }
        };
    } else {
        const error = new Error(result.error || 'Location not found');
        (error as any).status = result.status;
        throw error;
    }
};

/**
 * Get location information for a specific image
 */
export const getImageLocation = async (imageId: number) => {
    if (isNaN(imageId)) {
        throw new Error('Invalid image ID');
    }

    // Get image with location data
    const results = await GeolocationService.searchImagesByLocation({
        cityId: undefined, // Search all locations for this image
        limit: 1
    });

    const imageLocation = results.find(img => img.id === imageId);

    if (!imageLocation) {
        const error = new Error('Image not found or has no location data');
        (error as any).status = 404;
        throw error;
    }

    return {
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
    };
};

/**
 * Process geolocation for existing images with GPS data
 */
export const processRetroactiveGeolocation = async (options: { limit?: number; radius?: number } = {}) => {
    const { limit = 100, radius = 25 } = options;

    // Get images without location data
    const images = await GeolocationService.getImagesWithoutLocation(limit);
    
    if (images.length === 0) {
        return {
            message: 'No images with GPS data found that need location processing',
            processed: 0,
            skipped: 0
        };
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

    return {
        message: 'Retroactive geolocation processing completed',
        totalImages: images.length,
        processed,
        skipped,
        searchRadius: radius
    };
};