import { Image, DetectedObject, DetectedFace, SmartAlbum, SmartAlbumRule, SmartAlbumRepository, ImageRepository, ObjectRepository, FaceRepository, db } from '../models/database';
import { logger as structuredLogger } from './structured-logger';

export interface AlbumMatchResult {
    matches: boolean;
    confidence: number;
    reasons: string[];
}

export class SmartAlbumEngine {
    /**
     * Process an image through all active smart albums
     */
    static async processImageForAlbums(imageId: number): Promise<void> {
        try {
            const image = await ImageRepository.findById(imageId);
            if (!image) {
                throw new Error(`Image ${imageId} not found`);
            }

            // Get all active albums
            const albums = await SmartAlbumRepository.findActiveAlbums();
            
            // Process each album
            for (const album of albums) {
                const result = await this.checkImageForAlbum(image, album);
                
                if (result.matches) {
                    await SmartAlbumRepository.addImageToAlbum(
                        album.id,
                        image.id!,
                        result.confidence,
                        result.reasons
                    );
                    
                    structuredLogger.info('Image added to smart album', {
                        type: 'smart_album',
                        action: 'image_added',
                        albumId: album.id,
                        albumName: album.name,
                        imageId: image.id!,
                        confidence: result.confidence,
                        reasons: result.reasons
                    });
                } else {
                    // Remove if it was previously in the album
                    await SmartAlbumRepository.removeImageFromAlbum(album.id, image.id!);
                }
            }
            
            // Update the image's smart album processed timestamp
            await db('images')
                .where({ id: imageId })
                .update({ 
                    smart_albums_processed_at: db.fn.now(),
                    smart_album_count: await this.getImageAlbumCount(imageId)
                });
                
        } catch (error) {
            structuredLogger.error('Failed to process image for smart albums', {
                type: 'smart_album',
                action: 'process_error',
                imageId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    /**
     * Check if an image matches a specific album's rules
     */
    static async checkImageForAlbum(image: Image, album: SmartAlbum): Promise<AlbumMatchResult> {
        switch (album.type) {
            case 'object_based':
                return this.checkObjectBasedAlbum(image, album);
            case 'person_based':
                return this.checkPersonBasedAlbum(image, album);
            case 'time_based':
                return this.checkTimeBasedAlbum(image, album);
            case 'characteristic':
                return this.checkCharacteristicAlbum(image, album);
            case 'technical_based':
                return this.checkTechnicalBasedAlbum(image, album);
            case 'custom_rule':
                return this.checkCustomRuleAlbum(image, album);
            default:
                return { matches: false, confidence: 0, reasons: [] };
        }
    }

    /**
     * Check object-based album rules
     */
    private static async checkObjectBasedAlbum(image: Image, album: SmartAlbum): Promise<AlbumMatchResult> {
        const objects = await ObjectRepository.getObjectsByImage(image.id!);
        const rules = album.rules;
        const reasons: string[] = [];
        let confidence = 0;
        let matchCount = 0;
        
        // Check for required objects
        if (rules.requiredObjects && Array.isArray(rules.requiredObjects)) {
            for (const requiredObject of rules.requiredObjects) {
                const found = objects.find(obj => 
                    obj.class.toLowerCase() === requiredObject.toLowerCase() &&
                    obj.confidence >= (rules.minConfidence || 0.5)
                );
                
                if (found) {
                    matchCount++;
                    confidence = Math.max(confidence, found.confidence);
                    reasons.push(`Contains ${requiredObject} (${Math.round(found.confidence * 100)}% confidence)`);
                }
            }
        }
        
        // Check if we meet the minimum match requirement
        const requiredMatches = rules.minMatches || 1;
        const matches = matchCount >= requiredMatches;
        
        return {
            matches,
            confidence: matches ? confidence : 0,
            reasons
        };
    }

    /**
     * Check person-based album rules
     */
    private static async checkPersonBasedAlbum(image: Image, album: SmartAlbum): Promise<AlbumMatchResult> {
        const faces = await FaceRepository.getFacesByImage(image.id!);
        const rules = album.rules;
        const reasons: string[] = [];
        let confidence = 0;
        let matchCount = 0;
        
        // Check for required people
        if (rules.requiredPeople && Array.isArray(rules.requiredPeople)) {
            for (const requiredPersonId of rules.requiredPeople) {
                const found = faces.find(face => face.person_id === requiredPersonId);
                
                if (found) {
                    matchCount++;
                    confidence = Math.max(confidence, found.detection_confidence || 0);
                    reasons.push(`Person ID ${requiredPersonId} detected`);
                }
            }
        }
        
        // Check minimum face count
        if (rules.minFaces && faces.length >= rules.minFaces) {
            matchCount++;
            reasons.push(`Has ${faces.length} faces (min: ${rules.minFaces})`);
        }
        
        const matches = matchCount > 0;
        
        return {
            matches,
            confidence: matches ? confidence : 0,
            reasons
        };
    }

    /**
     * Check time-based album rules
     */
    private static async checkTimeBasedAlbum(image: Image, album: SmartAlbum): Promise<AlbumMatchResult> {
        const rules = album.rules;
        const reasons: string[] = [];
        let matches = false;
        
        if (!image.date_taken) {
            return { matches: false, confidence: 0, reasons: ['No date information'] };
        }
        
        const imageDate = new Date(image.date_taken);
        
        // Check date range
        if (rules.dateRange) {
            const startDate = new Date(rules.dateRange.start);
            const endDate = new Date(rules.dateRange.end);
            
            if (imageDate >= startDate && imageDate <= endDate) {
                matches = true;
                reasons.push(`Within date range ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
            }
        }
        
        // Check day of week
        if (rules.daysOfWeek && Array.isArray(rules.daysOfWeek)) {
            const dayOfWeek = imageDate.getDay();
            if (rules.daysOfWeek.includes(dayOfWeek)) {
                matches = true;
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                reasons.push(`Taken on ${dayNames[dayOfWeek]}`);
            }
        }
        
        // Check time of day
        if (rules.timeOfDay) {
            const hour = imageDate.getHours();
            const { startHour, endHour } = rules.timeOfDay;
            
            if ((startHour <= endHour && hour >= startHour && hour <= endHour) ||
                (startHour > endHour && (hour >= startHour || hour <= endHour))) {
                matches = true;
                reasons.push(`Taken between ${startHour}:00 and ${endHour}:00`);
            }
        }
        
        // Check for recurring dates (e.g., "this day in history")
        if (rules.recurringDate) {
            const imageMonth = imageDate.getMonth() + 1;
            const imageDay = imageDate.getDate();
            
            if (rules.recurringDate.month === imageMonth && rules.recurringDate.day === imageDay) {
                matches = true;
                reasons.push(`Anniversary date: ${imageMonth}/${imageDay}`);
            }
        }
        
        return {
            matches,
            confidence: matches ? 1.0 : 0,
            reasons
        };
    }

    /**
     * Check characteristic-based album rules
     */
    private static async checkCharacteristicAlbum(image: Image, album: SmartAlbum): Promise<AlbumMatchResult> {
        const rules = album.rules;
        const reasons: string[] = [];
        let matches = false;
        
        // Check for screenshots
        if (rules.isScreenshot && image.is_screenshot) {
            matches = true;
            reasons.push('Is a screenshot');
        }
        
        // Check for astrophotography
        if (rules.isAstrophotography && image.is_astrophotography) {
            matches = true;
            reasons.push('Is astrophotography');
        }
        
        // Check for selfies (front camera + faces)
        if (rules.isSelfie) {
            const metadata = await db('image_metadata').where({ image_id: image.id! }).first();
            const faces = await FaceRepository.getFacesByImage(image.id!);
            
            if (metadata && metadata.lens_model && metadata.lens_model.toLowerCase().includes('front') && faces.length > 0) {
                matches = true;
                reasons.push('Is a selfie (front camera with faces)');
            }
        }
        
        // Check for dominant color
        if (rules.dominantColor && image.dominant_color) {
            const targetColor = rules.dominantColor.toLowerCase();
            const imageColor = image.dominant_color.toLowerCase();
            
            // Simple color matching - could be enhanced with color distance calculation
            if (imageColor.includes(targetColor) || this.isColorSimilar(imageColor, targetColor)) {
                matches = true;
                reasons.push(`Dominant color matches ${targetColor}`);
            }
        }
        
        return {
            matches,
            confidence: matches ? 1.0 : 0,
            reasons
        };
    }

    /**
     * Check technical-based album rules (camera, settings, etc.)
     */
    private static async checkTechnicalBasedAlbum(image: Image, album: SmartAlbum): Promise<AlbumMatchResult> {
        const metadata = await db('image_metadata').where({ image_id: image.id! }).first();
        const rules = album.rules;
        const reasons: string[] = [];
        let matches = false;
        
        if (!metadata) {
            return { matches: false, confidence: 0, reasons: ['No metadata available'] };
        }
        
        // Check camera model
        if (rules.cameraModel && metadata.camera_model) {
            if (metadata.camera_model.toLowerCase().includes(rules.cameraModel.toLowerCase())) {
                matches = true;
                reasons.push(`Camera: ${metadata.camera_model}`);
            }
        }
        
        // Check lens model
        if (rules.lensModel && metadata.lens_model) {
            if (metadata.lens_model.toLowerCase().includes(rules.lensModel.toLowerCase())) {
                matches = true;
                reasons.push(`Lens: ${metadata.lens_model}`);
            }
        }
        
        // Check ISO range
        if (rules.isoRange && metadata.iso) {
            const iso = parseInt(metadata.iso);
            if (iso >= rules.isoRange.min && iso <= rules.isoRange.max) {
                matches = true;
                reasons.push(`ISO ${iso} in range ${rules.isoRange.min}-${rules.isoRange.max}`);
            }
        }
        
        // Check aperture range
        if (rules.apertureRange && metadata.aperture) {
            const aperture = parseFloat(metadata.aperture);
            if (aperture >= rules.apertureRange.min && aperture <= rules.apertureRange.max) {
                matches = true;
                reasons.push(`Aperture f/${aperture} in range f/${rules.apertureRange.min}-f/${rules.apertureRange.max}`);
            }
        }
        
        return {
            matches,
            confidence: matches ? 1.0 : 0,
            reasons
        };
    }

    /**
     * Check custom rule-based albums
     */
    private static async checkCustomRuleAlbum(image: Image, album: SmartAlbum): Promise<AlbumMatchResult> {
        const albumRules = await SmartAlbumRepository.getAlbumRules(album.id);
        const results: AlbumMatchResult[] = [];
        
        // Evaluate each rule
        for (const rule of albumRules) {
            const ruleResult = await this.evaluateCustomRule(image, rule);
            results.push(ruleResult);
        }
        
        // Combine results based on operators
        return this.combineRuleResults(results, albumRules);
    }

    /**
     * Evaluate a single custom rule
     */
    private static async evaluateCustomRule(image: Image, rule: SmartAlbumRule): Promise<AlbumMatchResult> {
        switch (rule.rule_type) {
            case 'object_detection':
                const objects = await ObjectRepository.getObjectsByImage(image.id!);
                const requiredClass = rule.parameters.class;
                const minConfidence = rule.parameters.minConfidence || 0.5;
                
                const foundObject = objects.find(obj => 
                    obj.class.toLowerCase() === requiredClass.toLowerCase() &&
                    obj.confidence >= minConfidence
                );
                
                return {
                    matches: !!foundObject,
                    confidence: foundObject ? foundObject.confidence : 0,
                    reasons: foundObject ? [`Has ${requiredClass}`] : []
                };
                
            case 'min_faces':
                const faces = await FaceRepository.getFacesByImage(image.id!);
                const minFaces = rule.parameters.count || 1;
                const hasFaces = faces.length >= minFaces;
                
                return {
                    matches: hasFaces,
                    confidence: hasFaces ? 1.0 : 0,
                    reasons: hasFaces ? [`Has ${faces.length} faces (min: ${minFaces})`] : []
                };
                
            // Add more rule types as needed
            default:
                return { matches: false, confidence: 0, reasons: [] };
        }
    }

    /**
     * Combine multiple rule results based on operators
     */
    private static combineRuleResults(results: AlbumMatchResult[], rules: SmartAlbumRule[]): AlbumMatchResult {
        if (results.length === 0) {
            return { matches: false, confidence: 0, reasons: [] };
        }
        
        let combinedMatches = results[0].matches;
        let combinedConfidence = results[0].confidence;
        const combinedReasons: string[] = [];
        
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const rule = rules[i];
            
            if (result.matches) {
                combinedReasons.push(...result.reasons);
            }
            
            if (i > 0) {
                switch (rule.operator) {
                    case 'AND':
                        combinedMatches = combinedMatches && result.matches;
                        combinedConfidence = Math.min(combinedConfidence, result.confidence);
                        break;
                    case 'OR':
                        combinedMatches = combinedMatches || result.matches;
                        combinedConfidence = Math.max(combinedConfidence, result.confidence);
                        break;
                    case 'NOT':
                        combinedMatches = combinedMatches && !result.matches;
                        break;
                }
            }
        }
        
        return {
            matches: combinedMatches,
            confidence: combinedMatches ? combinedConfidence : 0,
            reasons: combinedReasons
        };
    }

    /**
     * Simple color similarity check
     */
    private static isColorSimilar(color1: string, color2: string): boolean {
        // This is a simplified check - could be enhanced with proper color distance calculation
        const colorGroups: { [key: string]: string[] } = {
            'red': ['red', 'crimson', 'scarlet', 'ruby', 'maroon'],
            'blue': ['blue', 'navy', 'azure', 'cobalt', 'sapphire'],
            'green': ['green', 'emerald', 'lime', 'forest', 'mint'],
            'yellow': ['yellow', 'gold', 'amber', 'lemon', 'mustard'],
            'orange': ['orange', 'tangerine', 'coral', 'peach', 'apricot'],
            'purple': ['purple', 'violet', 'lavender', 'plum', 'magenta'],
            'pink': ['pink', 'rose', 'fuchsia', 'salmon', 'coral'],
            'brown': ['brown', 'tan', 'beige', 'chocolate', 'coffee'],
            'gray': ['gray', 'grey', 'silver', 'charcoal', 'slate'],
            'black': ['black', 'ebony', 'onyx', 'charcoal', 'midnight'],
            'white': ['white', 'ivory', 'cream', 'pearl', 'snow']
        };
        
        for (const [group, colors] of Object.entries(colorGroups)) {
            if (colors.some(c => color1.includes(c)) && colors.some(c => color2.includes(c))) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Get the number of albums an image belongs to
     */
    private static async getImageAlbumCount(imageId: number): Promise<number> {
        const result = await db('smart_album_images')
            .where({ image_id: imageId })
            .count('* as count')
            .first();
        
        return Number(result?.count) || 0;
    }

    /**
     * Create default system albums
     */
    static async createDefaultAlbums(): Promise<void> {
        const defaultAlbums = [
            {
                name: 'Screenshots',
                slug: 'screenshots',
                description: 'All screenshot images',
                type: 'characteristic' as const,
                rules: { isScreenshot: true },
                is_system: true,
                priority: 100
            },
            {
                name: 'Astrophotography',
                slug: 'astrophotography',
                description: 'Night sky and astronomical photos',
                type: 'characteristic' as const,
                rules: { isAstrophotography: true },
                is_system: true,
                priority: 95
            },
            {
                name: 'Selfies',
                slug: 'selfies',
                description: 'Photos taken with front camera',
                type: 'characteristic' as const,
                rules: { isSelfie: true },
                is_system: true,
                priority: 90
            },
            {
                name: 'Pets',
                slug: 'pets',
                description: 'Photos containing cats or dogs',
                type: 'object_based' as const,
                rules: { requiredObjects: ['cat', 'dog'], minMatches: 1, minConfidence: 0.7 },
                is_system: true,
                priority: 85
            },
            {
                name: 'Food & Drinks',
                slug: 'food-drinks',
                description: 'Photos of food and beverages',
                type: 'object_based' as const,
                rules: { requiredObjects: ['food', 'pizza', 'sandwich', 'cake', 'wine', 'beer', 'cup', 'bottle'], minMatches: 1, minConfidence: 0.6 },
                is_system: true,
                priority: 80
            },
            {
                name: 'Nature & Outdoors',
                slug: 'nature-outdoors',
                description: 'Outdoor and nature scenes',
                type: 'object_based' as const,
                rules: { requiredObjects: ['tree', 'flower', 'mountain', 'beach', 'ocean', 'forest', 'park', 'sky'], minMatches: 1, minConfidence: 0.5 },
                is_system: true,
                priority: 75
            },
            {
                name: 'Vehicles',
                slug: 'vehicles',
                description: 'Cars, trucks, motorcycles, and other vehicles',
                type: 'object_based' as const,
                rules: { requiredObjects: ['car', 'truck', 'motorcycle', 'bus', 'train', 'airplane', 'boat'], minMatches: 1, minConfidence: 0.7 },
                is_system: true,
                priority: 70
            },
            {
                name: 'Weekend Photos',
                slug: 'weekend-photos',
                description: 'Photos taken on weekends',
                type: 'time_based' as const,
                rules: { daysOfWeek: [0, 6] }, // Sunday = 0, Saturday = 6
                is_system: true,
                priority: 65
            },
            {
                name: 'Night Photos',
                slug: 'night-photos',
                description: 'Photos taken after sunset',
                type: 'time_based' as const,
                rules: { timeOfDay: { startHour: 19, endHour: 5 } },
                is_system: true,
                priority: 60
            }
        ];
        
        for (const albumData of defaultAlbums) {
            const existing = await SmartAlbumRepository.findAlbumBySlug(albumData.slug);
            if (!existing) {
                await SmartAlbumRepository.createAlbum(albumData);
                structuredLogger.info('Default album created', {
                    type: 'smart_album',
                    action: 'default_album_created',
                    albumName: albumData.name,
                    albumSlug: albumData.slug
                });
            }
        }
    }

    /**
     * Process all unprocessed images for smart albums
     */
    static async processUnprocessedImages(limit: number = 100): Promise<number> {
        const unprocessedImages = await db('images')
            .whereNull('smart_albums_processed_at')
            .limit(limit)
            .select('id');
        
        let processed = 0;
        
        for (const image of unprocessedImages) {
            try {
                await this.processImageForAlbums(image.id);
                processed++;
            } catch (error) {
                structuredLogger.error('Failed to process image in batch', {
                    type: 'smart_album',
                    action: 'batch_process_error',
                    imageId: image.id,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        
        return processed;
    }
}