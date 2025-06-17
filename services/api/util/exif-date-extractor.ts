import { Tags } from 'exiftool-vendored';
import { Logger } from '../logger';

const logger = Logger.getInstance();

/**
 * Extract the best available date from EXIF metadata
 * Priority order:
 * 1. DateTimeOriginal - When the photo was taken
 * 2. CreateDate - When the photo was created
 * 3. DateCreated - Alternative creation date
 * 4. ModifyDate - When the file was last modified
 * 5. FileModifyDate - File system modification date
 * 6. FileCreateDate - File system creation date
 */
export function extractBestDate(exif: Tags | any): Date | undefined {
    // List of date fields in priority order
    const dateFields = [
        'DateTimeOriginal',
        'CreateDate',
        'DateCreated',
        'ModifyDate',
        'FileModifyDate',
        'FileCreateDate'
    ];

    for (const field of dateFields) {
        const dateValue = exif[field];
        if (dateValue) {
            try {
                const parsedDate = parseExifDate(dateValue);
                if (parsedDate && !isNaN(parsedDate.getTime())) {
                    logger.debug(`Using ${field} for date_taken: ${parsedDate.toISOString()}`);
                    return parsedDate;
                }
            } catch (error) {
                logger.warn(`Failed to parse ${field}: ${dateValue}`, error);
            }
        }
    }

    logger.debug('No valid date found in EXIF metadata');
    return undefined;
}

/**
 * Parse various EXIF date formats into a JavaScript Date object
 */
export function parseExifDate(dateStr: any): Date | null {
    if (!dateStr) return null;
    
    // If it's already a Date object
    if (dateStr instanceof Date) {
        return dateStr;
    }
    
    // If it's a number (timestamp)
    if (typeof dateStr === 'number') {
        return new Date(dateStr);
    }
    
    // If it's not a string, try to convert it
    if (typeof dateStr !== 'string') {
        dateStr = String(dateStr);
    }
    
    try {
        // Handle EXIF date format: "YYYY:MM:DD HH:MM:SS"
        const exifPattern = /^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/;
        const exifMatch = dateStr.match(exifPattern);
        if (exifMatch) {
            const [, year, month, day, hour, minute, second] = exifMatch;
            return new Date(
                parseInt(year),
                parseInt(month) - 1, // Month is 0-indexed
                parseInt(day),
                parseInt(hour),
                parseInt(minute),
                parseInt(second)
            );
        }
        
        // Handle EXIF date with timezone: "YYYY:MM:DD HH:MM:SS+HH:MM"
        const exifTzPattern = /^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})([-+]\d{2}:\d{2})$/;
        const exifTzMatch = dateStr.match(exifTzPattern);
        if (exifTzMatch) {
            const [, year, month, day, hour, minute, second, tz] = exifTzMatch;
            const dateString = `${year}-${month}-${day}T${hour}:${minute}:${second}${tz}`;
            return new Date(dateString);
        }
        
        // Try parsing as ISO date
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return date;
        }
        
        // Handle date-only format: "YYYY:MM:DD"
        const dateOnlyPattern = /^(\d{4}):(\d{2}):(\d{2})$/;
        const dateOnlyMatch = dateStr.match(dateOnlyPattern);
        if (dateOnlyMatch) {
            const [, year, month, day] = dateOnlyMatch;
            return new Date(
                parseInt(year),
                parseInt(month) - 1,
                parseInt(day),
                0, 0, 0
            );
        }
        
    } catch (error) {
        logger.debug(`Failed to parse date: ${dateStr}`, error);
    }
    
    return null;
}

/**
 * Get all available dates from EXIF metadata
 * Useful for debugging and understanding what dates are available
 */
export function getAllExifDates(exif: Tags | any): Record<string, Date | null> {
    const dateFields = [
        'DateTimeOriginal',
        'CreateDate',
        'DateCreated',
        'ModifyDate',
        'FileModifyDate',
        'FileCreateDate',
        'DateTimeDigitized',
        'SubSecDateTimeOriginal',
        'SubSecCreateDate',
        'SubSecModifyDate'
    ];

    const dates: Record<string, Date | null> = {};
    
    for (const field of dateFields) {
        if (exif[field]) {
            dates[field] = parseExifDate(exif[field]);
        }
    }
    
    return dates;
}