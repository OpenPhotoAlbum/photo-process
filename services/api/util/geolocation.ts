import { db } from '../models/database';
import { Logger } from '../logger';

const logger = Logger.getInstance();

export interface GeolocationResult {
    data: any;
    error: string | null;
    status: number;
}

export interface LocationInfo {
    cityId: number;
    cityName: string;
    stateName?: string;
    stateCode?: string;
    countryName: string;
    countryCode: string;
    distanceMiles: number;
    fullLocationString: string;
}

export interface GPS {
    latitude: number;
    longitude: number;
    altitude?: number;
}

/**
 * Geolocation Service for GPS-based photo location matching
 * Uses spatial queries to find closest cities to GPS coordinates
 */
export class GeolocationService {
    /**
     * Find the closest city to given coordinates within a specified radius
     */
    static async getClosestCityIdByCoords(
        lat: number,
        lon: number,
        radiusMiles: number = 10
    ): Promise<GeolocationResult> {
        try {
            logger.info(`Finding closest city to coordinates: ${lat}, ${lon} within ${radiusMiles} miles`);
            
            const result = await db.raw(`
                SELECT 
                    id,
                    city,
                    state_code,
                    postal_code,
                    latitude,
                    longitude,
                    county_name,
                    timezone,
                    ST_Distance_Sphere(point(?, ?), point(longitude, latitude)) * 0.000621371192 as distance_in_miles 
                FROM geo_cities 
                HAVING distance_in_miles <= ? 
                ORDER BY distance_in_miles ASC 
                LIMIT 1
            `, [lon, lat, radiusMiles]);

            if (result[0] && result[0].length > 0) {
                const city = result[0][0];
                return {
                    data: city,
                    error: null,
                    status: 200
                };
            } else {
                logger.warn(`No cities found within ${radiusMiles} miles of ${lat}, ${lon}`);
                return {
                    data: null,
                    error: `No cities found within ${radiusMiles} miles`,
                    status: 404
                };
            }
        } catch (error) {
            logger.error('Error querying city by coordinates:', error);
            return {
                data: null,
                error: 'Error querying city by closest coordinates',
                status: 500
            };
        }
    }

    /**
     * Get full location hierarchy (city -> state -> country) for a city ID
     */
    static async getLocationHierarchy(cityId: number): Promise<LocationInfo | null> {
        try {
            const result = await db.raw(`
                SELECT 
                    gc.id as city_id,
                    gc.city as city_name,
                    gs.name as state_name,
                    gs.code as state_code,
                    gco.country_name,
                    gco.country_code,
                    gc.latitude,
                    gc.longitude
                FROM geo_cities gc
                LEFT JOIN geo_states gs ON gc.state_code = gs.code
                LEFT JOIN geo_countries gco ON gs.country_code = gco.country_code
                WHERE gc.id = ?
            `, [cityId]);

            if (result[0] && result[0].length > 0) {
                const location = result[0][0];
                const fullLocationString = [
                    location.city_name,
                    location.state_name,
                    location.country_name
                ].filter(Boolean).join(', ');

                return {
                    cityId: location.city_id,
                    cityName: location.city_name,
                    stateName: location.state_name,
                    stateCode: location.state_code,
                    countryName: location.country_name,
                    countryCode: location.country_code,
                    distanceMiles: 0, // Will be set by caller
                    fullLocationString
                };
            }
            return null;
        } catch (error) {
            logger.error(`Error getting location hierarchy for city ${cityId}:`, error);
            return null;
        }
    }

    /**
     * Link an image to a location with confidence scoring
     */
    static async linkImageToLocation(
        imageId: number,
        cityId: number,
        method: 'EXIF_GPS' | 'CLOSEST_MATCH' | 'MANUAL',
        confidenceScore: number = 1.0,
        distanceMiles?: number
    ): Promise<boolean> {
        try {
            // Check if relationship already exists
            const existing = await db('image_geolocations')
                .where({ image_id: imageId, city_id: cityId })
                .first();

            if (existing) {
                logger.info(`Image ${imageId} already linked to city ${cityId}`);
                return true;
            }

            await db('image_geolocations').insert({
                image_id: imageId,
                city_id: cityId,
                confidence_score: confidenceScore,
                detection_method: method,
                distance_miles: distanceMiles,
                created_at: new Date(),
                updated_at: new Date()
            });

            logger.info(`Successfully linked image ${imageId} to city ${cityId} via ${method}`);
            return true;
        } catch (error) {
            logger.error(`Error linking image ${imageId} to location ${cityId}:`, error);
            return false;
        }
    }

    /**
     * Process GPS coordinates for an image and find/link closest location
     */
    static async processImageLocation(
        imageId: number,
        gps: GPS,
        radiusMiles: number = 10
    ): Promise<LocationInfo | null> {
        try {
            logger.info(`Processing location for image ${imageId} at ${gps.latitude}, ${gps.longitude}`);

            // Find closest city
            const cityResult = await this.getClosestCityIdByCoords(
                gps.latitude,
                gps.longitude,
                radiusMiles
            );

            if (cityResult.status !== 200 || !cityResult.data) {
                logger.warn(`No location found for image ${imageId} within ${radiusMiles} miles`);
                return null;
            }

            const city = cityResult.data;
            const distanceMiles = city.distance_in_miles;

            // Calculate confidence score based on distance (closer = higher confidence)
            let confidenceScore = 1.0;
            if (distanceMiles > 0) {
                confidenceScore = Math.max(0.1, 1.0 - (distanceMiles / radiusMiles));
            }

            // Link image to location
            const linked = await this.linkImageToLocation(
                imageId,
                city.id,
                'EXIF_GPS',
                confidenceScore,
                distanceMiles
            );

            if (!linked) {
                logger.error(`Failed to link image ${imageId} to city ${city.id}`);
                return null;
            }

            // Get full location hierarchy
            const locationInfo = await this.getLocationHierarchy(city.id);
            if (locationInfo) {
                locationInfo.distanceMiles = distanceMiles;
            }

            return locationInfo;
        } catch (error) {
            logger.error(`Error processing location for image ${imageId}:`, error);
            return null;
        }
    }

    /**
     * Search images by location parameters
     */
    static async searchImagesByLocation(options: {
        cityId?: number;
        stateCode?: string;
        countryCode?: string;
        radiusFromCoords?: { lat: number; lon: number; miles: number };
        limit?: number;
        offset?: number;
    }) {
        try {
            let query = db('images as i')
                .select([
                    'i.id',
                    'i.filename',
                    'i.relative_media_path',
                    'i.date_taken',
                    'i.gps_latitude',
                    'i.gps_longitude',
                    'gc.city',
                    'gs.name as state_name',
                    'gco.country_name',
                    'il.confidence_score',
                    'il.distance_miles'
                ])
                .leftJoin('image_geolocations as il', 'i.id', 'il.image_id')
                .leftJoin('geo_cities as gc', 'il.city_id', 'gc.id')
                .leftJoin('geo_states as gs', 'gc.state_code', 'gs.code')
                .leftJoin('geo_countries as gco', 'gs.country_code', 'gco.country_code');

            // Apply filters
            if (options.cityId) {
                query = query.where('il.city_id', options.cityId);
            }

            if (options.stateCode) {
                query = query.where('gs.code', options.stateCode);
            }

            if (options.countryCode) {
                query = query.where('gco.country_code', options.countryCode);
            }

            // Radius search from coordinates
            if (options.radiusFromCoords) {
                const { lat, lon, miles } = options.radiusFromCoords;
                query = query.whereRaw(`
                    ST_Distance_Sphere(point(?, ?), point(i.gps_longitude, i.gps_latitude)) * 0.000621371192 <= ?
                `, [lon, lat, miles]);
            }

            // Add pagination
            if (options.limit) {
                query = query.limit(options.limit);
            }
            if (options.offset) {
                query = query.offset(options.offset);
            }

            const results = await query.orderBy('i.date_taken', 'desc');
            return results;
        } catch (error) {
            logger.error('Error searching images by location:', error);
            throw error;
        }
    }

    /**
     * Get location statistics (photo counts by location)
     */
    static async getLocationStats() {
        try {
            const stats = await db.raw(`
                SELECT 
                    gc.city,
                    gs.name as state_name,
                    gco.country_name,
                    COUNT(il.image_id) as photo_count,
                    MIN(il.distance_miles) as min_distance,
                    MAX(il.distance_miles) as max_distance,
                    AVG(il.distance_miles) as avg_distance
                FROM image_geolocations il
                JOIN geo_cities gc ON il.city_id = gc.id
                LEFT JOIN geo_states gs ON gc.state_code = gs.code  
                LEFT JOIN geo_countries gco ON gs.country_code = gco.country_code
                GROUP BY gc.id, gc.city, gs.name, gco.country_name
                ORDER BY photo_count DESC
            `);

            return stats[0] || [];
        } catch (error) {
            logger.error('Error getting location statistics:', error);
            throw error;
        }
    }

    /**
     * Get images without location data (for retroactive processing)
     * Checks both images table GPS columns and image_metadata table
     */
    static async getImagesWithoutLocation(limit: number = 100) {
        try {
            const images = await db('images as i')
                .select([
                    'i.id', 
                    'i.filename', 
                    // Use GPS from images table if available, otherwise from metadata table
                    db.raw('COALESCE(i.gps_latitude, im.latitude) as gps_latitude'),
                    db.raw('COALESCE(i.gps_longitude, im.longitude) as gps_longitude')
                ])
                .leftJoin('image_geolocations as il', 'i.id', 'il.image_id')
                .leftJoin('image_metadata as im', 'i.id', 'im.image_id')
                .whereNull('il.image_id') // No location data yet
                .where(function() {
                    // Has GPS in either images table or metadata table
                    this.where(function() {
                        this.whereNotNull('i.gps_latitude').whereNotNull('i.gps_longitude');
                    }).orWhere(function() {
                        this.whereNotNull('im.latitude').whereNotNull('im.longitude');
                    });
                })
                .limit(limit);

            return images;
        } catch (error) {
            logger.error('Error getting images without location:', error);
            throw error;
        }
    }
}

// Export the main function for backward compatibility with your example
export const getClosestCityIdByCoords = GeolocationService.getClosestCityIdByCoords;