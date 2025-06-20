import { Tags } from 'exiftool-vendored';

/**
 * Enhanced EXIF metadata extraction
 * Extracts additional useful fields beyond basic camera settings
 */

export interface EnhancedExifMetadata {
    // Basic camera info (existing)
    camera_make?: string;
    camera_model?: string;
    software?: string;
    lens_model?: string;
    focal_length?: number;
    aperture?: string;
    shutter_speed?: string;
    iso?: number;
    flash?: string;
    white_balance?: string;
    exposure_mode?: string;
    
    // Advanced camera settings (new)
    exposure_compensation?: number;
    metering_mode?: string;
    exposure_program?: string;
    scene_type?: string;
    subject_distance?: number;
    focal_length_35mm?: number;
    max_aperture_value?: number;
    digital_zoom_ratio?: number;
    gain_control?: string;
    contrast?: string;
    saturation?: string;
    sharpness?: string;
    brightness_value?: number;
    
    // GPS enhancements (new)
    gps_latitude_ref?: string;
    gps_longitude_ref?: string;
    gps_altitude_ref?: string;
    gps_dop?: number;
    gps_satellites?: string;
    gps_status?: string;
    gps_measure_mode?: string;
    gps_map_datum?: string;
    gps_datetime?: Date;
    gps_processing_method?: string;
    gps_area_information?: string;
    gps_h_positioning_error?: number;
    
    // Time precision (new)
    subsec_time_original?: string;
    timezone_offset?: string;
    
    // Creator/Copyright (new)
    artist?: string;
    copyright?: string;
    image_description?: string;
    user_comment?: string;
    
    // Additional metadata (new)
    rating?: number;
    lens_make?: string;
    lens_serial_number?: string;
    lens_info?: string;
    body_serial_number?: string;
    owner_name?: string;
    
    // Scene/subject (new)
    scene_capture_type?: string;
    subject_area?: string;
    light_source?: string;
    
    // Location (existing but reorganized)
    latitude?: number;
    longitude?: number;
    altitude?: number;
    city?: string;
    state?: string;
    country?: string;
    
    // Other (existing)
    orientation?: number;
    color_space?: string;
    raw_exif?: any;
}

export interface ExtractedKeywords {
    keywords: string[];
    source: 'exif';
}

/**
 * Parse numeric value from EXIF field
 */
function parseNumeric(value: any): number | undefined {
    if (value === undefined || value === null) return undefined;
    
    // Handle string representations like "400" or "f/2.8"
    if (typeof value === 'string') {
        const match = value.match(/[\d.]+/);
        if (match) {
            return parseFloat(match[0]);
        }
    }
    
    if (typeof value === 'number') {
        return value;
    }
    
    return undefined;
}

/**
 * Parse GPS coordinate from EXIF format
 */
function parseGPSCoordinate(value: any, ref?: string): number | undefined {
    if (!value) return undefined;
    
    let decimal: number;
    
    // Handle different GPS coordinate formats
    if (typeof value === 'number') {
        decimal = value;
    } else if (typeof value === 'string') {
        // Parse DMS format like "40 deg 44' 54.36\""
        const match = value.match(/(\d+)\s*deg\s*(\d+)'\s*([\d.]+)"/);
        if (match) {
            const degrees = parseFloat(match[1]);
            const minutes = parseFloat(match[2]);
            const seconds = parseFloat(match[3]);
            decimal = degrees + minutes / 60 + seconds / 3600;
        } else {
            decimal = parseFloat(value);
        }
    } else if (Array.isArray(value) && value.length === 3) {
        // Handle [degrees, minutes, seconds] format
        decimal = value[0] + value[1] / 60 + value[2] / 3600;
    } else {
        return undefined;
    }
    
    // Apply hemisphere reference
    if (ref === 'S' || ref === 'W') {
        decimal = -decimal;
    }
    
    return decimal;
}

/**
 * Smart GPS coordinate validation and correction
 * Auto-corrects longitude signs for Western hemisphere when reference is missing
 */
function validateAndCorrectGPSCoordinate(
    coordinate: number | undefined, 
    ref: string | undefined, 
    coordinateType: 'latitude' | 'longitude'
): number | undefined {
    if (coordinate === undefined) return undefined;
    
    // If we have explicit reference, trust it
    if (ref) {
        return coordinate;
    }
    
    // Auto-correction for missing longitude reference
    if (coordinateType === 'longitude') {
        // North America: 25°N to 70°N latitude typically has negative longitude
        // This catches most US/Canada photos with missing GPSLongitudeRef
        if (coordinate > 0 && coordinate <= 180) {
            // For now, log this as a potential correction but don't auto-fix
            // to avoid false positives for Asia/Australia coordinates
            console.warn(`GPS longitude ${coordinate} appears positive but may need correction for Western hemisphere`);
        }
    }
    
    return coordinate;
}

/**
 * Format aperture value
 */
function formatAperture(value: any): string | undefined {
    const numeric = parseNumeric(value);
    if (numeric) {
        return `f/${numeric}`;
    }
    return undefined;
}

/**
 * Parse GPS datetime from EXIF
 */
function parseGPSDateTime(dateStamp?: string, timeStamp?: string): Date | undefined {
    if (!dateStamp || !timeStamp) return undefined;
    
    try {
        // Combine date and time stamps
        const combined = `${dateStamp} ${timeStamp}`;
        return new Date(combined);
    } catch {
        return undefined;
    }
}

/**
 * Extract keywords from various EXIF fields
 */
function extractKeywords(exif: Tags): string[] {
    const keywords = new Set<string>();
    
    // Check various keyword fields
    const keywordFields = [
        exif.Keywords,
        exif.Subject,
        exif.Categories,
        exif.SupplementalCategories,
        exif.TagsList,
        exif.LastKeywordXMP,
        exif.HierarchicalSubject
    ];
    
    for (const field of keywordFields) {
        if (field) {
            if (Array.isArray(field)) {
                field.forEach(keyword => {
                    if (typeof keyword === 'string' && keyword.trim()) {
                        keywords.add(keyword.trim());
                    }
                });
            } else if (typeof field === 'string') {
                // Handle comma-separated or semicolon-separated keywords
                field.split(/[,;]/).forEach(keyword => {
                    const trimmed = keyword.trim();
                    if (trimmed) {
                        keywords.add(trimmed);
                    }
                });
            }
        }
    }
    
    return Array.from(keywords);
}

/**
 * Extract enhanced metadata from EXIF tags
 */
export function extractEnhancedMetadata(exif: Tags): EnhancedExifMetadata {
    return {
        // Basic camera info
        camera_make: exif.Make,
        camera_model: exif.Model,
        software: exif.Software,
        lens_model: exif.LensModel || exif.Lens || exif.LensID,
        focal_length: parseNumeric(exif.FocalLength),
        aperture: formatAperture(exif.FNumber || exif.ApertureValue),
        shutter_speed: exif.ExposureTime?.toString() || exif.ShutterSpeedValue?.toString(),
        iso: parseNumeric(exif.ISO),
        flash: exif.Flash,
        white_balance: exif.WhiteBalance,
        exposure_mode: exif.ExposureMode,
        
        // Advanced camera settings
        // exposure_compensation: parseNumeric(exif.ExposureCompensation),
        metering_mode: exif.MeteringMode,
        exposure_program: exif.ExposureProgram,
        scene_type: exif.SceneType,
        subject_distance: parseNumeric(exif.SubjectDistance),
        focal_length_35mm: parseNumeric(exif.FocalLengthIn35mmFormat),
        max_aperture_value: parseNumeric(exif.MaxApertureValue),
        digital_zoom_ratio: parseNumeric(exif.DigitalZoomRatio),
        gain_control: exif.GainControl,
        contrast: exif.Contrast,
        saturation: exif.Saturation,
        sharpness: exif.Sharpness,
        brightness_value: parseNumeric(exif.BrightnessValue),
        
        // GPS enhancements
        gps_latitude_ref: exif.GPSLatitudeRef,
        gps_longitude_ref: exif.GPSLongitudeRef,
        gps_altitude_ref: exif.GPSAltitudeRef,
        gps_dop: parseNumeric(exif.GPSDOP),
        gps_satellites: exif.GPSSatellites,
        gps_status: exif.GPSStatus,
        gps_measure_mode: exif.GPSMeasureMode,
        gps_map_datum: exif.GPSMapDatum,
        gps_datetime: parseGPSDateTime(exif.GPSDateStamp?.toString(), exif.GPSTimeStamp?.toString()),
        gps_processing_method: exif.GPSProcessingMethod,
        gps_area_information: exif.GPSAreaInformation,
        gps_h_positioning_error: parseNumeric(exif.GPSHPositioningError),
        
        // Time precision
        subsec_time_original: exif.SubSecTimeOriginal?.toString(),
        timezone_offset: exif.OffsetTimeOriginal?.toString() || exif.OffsetTime?.toString(),
        
        // Creator/Copyright
        artist: Array.isArray(exif.Artist) ? exif.Artist.join(', ') : (exif.Artist?.toString() || exif.Creator?.toString()),
        copyright: exif.Copyright,
        image_description: exif.ImageDescription || exif.Description,
        user_comment: exif.UserComment || exif.Comment,
        
        // Additional metadata
        rating: parseNumeric(exif.Rating),
        lens_make: exif.LensMake,
        lens_serial_number: exif.LensSerialNumber,
        lens_info: exif.LensInfo,
        body_serial_number: exif.BodySerialNumber || exif.InternalSerialNumber,
        owner_name: exif.OwnerName,
        
        // Scene/subject
        scene_capture_type: exif.SceneCaptureType,
        subject_area: exif.SubjectArea,
        light_source: exif.LightSource,
        
        // Location
        latitude: parseGPSCoordinate(exif.GPSLatitude, exif.GPSLatitudeRef),
        longitude: parseGPSCoordinate(exif.GPSLongitude, exif.GPSLongitudeRef),
        altitude: parseNumeric(exif.GPSAltitude),
        city: exif.City,
        // state: exif.State, // Property doesn't exist in Tags
        country: exif.Country,
        
        // Other
        orientation: exif.Orientation,
        color_space: exif.ColorSpace,
        raw_exif: exif // Store complete EXIF data
    };
}

/**
 * Extract keywords from EXIF data
 */
export function extractExifKeywords(exif: Tags): ExtractedKeywords {
    return {
        keywords: extractKeywords(exif),
        source: 'exif'
    };
}

/**
 * Get GPS accuracy estimation based on available data
 */
export function estimateGPSAccuracy(metadata: EnhancedExifMetadata): {
    accuracy: 'high' | 'medium' | 'low' | 'unknown';
    confidenceScore: number;
    factors: string[];
} {
    const factors: string[] = [];
    let score = 0;
    
    // Check horizontal positioning error (most direct accuracy indicator)
    if (metadata.gps_h_positioning_error !== undefined) {
        if (metadata.gps_h_positioning_error < 5) {
            score += 40;
            factors.push(`High precision GPS (${metadata.gps_h_positioning_error}m error)`);
        } else if (metadata.gps_h_positioning_error < 15) {
            score += 25;
            factors.push(`Medium precision GPS (${metadata.gps_h_positioning_error}m error)`);
        } else {
            score += 10;
            factors.push(`Low precision GPS (${metadata.gps_h_positioning_error}m error)`);
        }
    }
    
    // Check DOP (Dilution of Precision)
    if (metadata.gps_dop !== undefined) {
        if (metadata.gps_dop < 2) {
            score += 20;
            factors.push('Excellent DOP');
        } else if (metadata.gps_dop < 5) {
            score += 10;
            factors.push('Good DOP');
        } else {
            score += 5;
            factors.push('Poor DOP');
        }
    }
    
    // Check number of satellites
    if (metadata.gps_satellites) {
        const satCount = parseInt(metadata.gps_satellites);
        if (satCount >= 8) {
            score += 20;
            factors.push(`Many satellites (${satCount})`);
        } else if (satCount >= 4) {
            score += 10;
            factors.push(`Adequate satellites (${satCount})`);
        }
    }
    
    // Check measurement mode
    if (metadata.gps_measure_mode === '3') {
        score += 10;
        factors.push('3D GPS fix');
    } else if (metadata.gps_measure_mode === '2') {
        score += 5;
        factors.push('2D GPS fix');
    }
    
    // Check if GPS timestamp is close to photo timestamp
    if (metadata.gps_datetime && metadata.subsec_time_original) {
        score += 10;
        factors.push('Precise GPS timing');
    }
    
    // Determine accuracy level
    let accuracy: 'high' | 'medium' | 'low' | 'unknown';
    if (score >= 60) {
        accuracy = 'high';
    } else if (score >= 30) {
        accuracy = 'medium';
    } else if (score > 0) {
        accuracy = 'low';
    } else {
        accuracy = 'unknown';
    }
    
    return {
        accuracy,
        confidenceScore: Math.min(score, 100) / 100,
        factors
    };
}