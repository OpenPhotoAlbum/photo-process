import { ImageMetadata, DetectedObject } from '../models/database';

export interface ScreenshotDetectionResult {
    isScreenshot: boolean;
    confidence: number; // 0-100
    reasons: string[];
}

export class ScreenshotDetector {
    
    static detectScreenshot(
        filename: string,
        metadata?: ImageMetadata,
        objects?: DetectedObject[],
        imageWidth?: number,
        imageHeight?: number,
        mimeType?: string
    ): ScreenshotDetectionResult {
        let score = 0;
        const reasons: string[] = [];
        
        // 1. Filename pattern detection (40 points max)
        const screenshotPatterns = [
            /screenshot/i,
            /screen.shot/i,
            /screen.capture/i,
            /^img_\d{8}_\d{6}$/i, // Android pattern
            /^screenshot_\d+/i,
            /^screen_\d+/i
        ];
        
        for (const pattern of screenshotPatterns) {
            if (pattern.test(filename)) {
                score += 40;
                reasons.push(`Filename matches screenshot pattern: ${pattern.source}`);
                break;
            }
        }
        
        // 2. Metadata-based detection (30 points max)
        if (metadata) {
            // No camera info suggests screenshot
            if (!metadata.camera_make && !metadata.camera_model) {
                score += 15;
                reasons.push('No camera metadata found');
            }
            
            // Software field contains screenshot indicators
            if (metadata.software && typeof metadata.software === 'string') {
                const softwareIndicators = ['screenshot', 'screen capture', 'snipping tool'];
                for (const indicator of softwareIndicators) {
                    if (metadata.software.toLowerCase().includes(indicator)) {
                        score += 25;
                        reasons.push(`Software field indicates screenshot: ${metadata.software}`);
                        break;
                    }
                }
            }
            
            // Missing technical photo metadata
            if (!metadata.focal_length && !metadata.aperture && !metadata.iso) {
                score += 10;
                reasons.push('Missing typical camera technical metadata');
            }
        }
        
        // 3. File format detection (15 points max)
        if (mimeType === 'image/png') {
            score += 15;
            reasons.push('PNG format (common for screenshots)');
        }
        
        // 4. Resolution-based detection (20 points max)
        if (imageWidth && imageHeight) {
            const commonScreenResolutions = [
                [1920, 1080], [1366, 768], [1536, 864], [1440, 900],
                [1280, 720], [1280, 800], [1024, 768], [2560, 1440],
                [3840, 2160], [2048, 1152], [1600, 900], [1680, 1050],
                // Mobile resolutions
                [1080, 1920], [750, 1334], [828, 1792], [1125, 2436],
                [1242, 2688], [1170, 2532], [1080, 2340]
            ];
            
            const matchesScreenRes = commonScreenResolutions.some(([w, h]) => 
                (imageWidth === w && imageHeight === h) || 
                (imageWidth === h && imageHeight === w)
            );
            
            if (matchesScreenRes) {
                score += 20;
                reasons.push(`Resolution matches common screen size: ${imageWidth}x${imageHeight}`);
            }
        }
        
        // 5. Object detection clues (25 points max)
        if (objects && objects.length > 0) {
            // UI/digital device indicators
            const uiIndicators = ['cell phone', 'laptop', 'tv', 'monitor'];
            const hasUIObjects = objects.some(obj => 
                uiIndicators.includes(obj.class.toLowerCase()) && obj.confidence > 0.7
            );
            
            if (hasUIObjects) {
                score += 15;
                reasons.push('Contains UI/digital device objects');
            }
            
            // Lack of typical photo objects
            const photoIndicators = ['person', 'car', 'dog', 'cat', 'tree', 'flower', 'food'];
            const hasPhotoObjects = objects.some(obj => 
                photoIndicators.includes(obj.class.toLowerCase()) && obj.confidence > 0.5
            );
            
            if (!hasPhotoObjects && objects.length > 0) {
                score += 10;
                reasons.push('Lacks typical photographic objects');
            }
        }
        
        // 6. Additional heuristics (10 points max)
        // Very square aspect ratios can indicate crops or UI elements
        if (imageWidth && imageHeight) {
            const aspectRatio = imageWidth / imageHeight;
            if (aspectRatio > 0.9 && aspectRatio < 1.1) { // Nearly square
                score += 5;
                reasons.push('Nearly square aspect ratio suggests UI element');
            }
        }
        
        // Bonus points for multiple weak signals
        if (reasons.length >= 3) {
            score += 5;
            reasons.push('Multiple weak indicators present');
        }
        
        // Cap at 100
        score = Math.min(score, 100);
        
        return {
            isScreenshot: score >= 60, // 60% confidence threshold
            confidence: score,
            reasons
        };
    }
    
    static isLikelyJunk(
        filename: string,
        metadata?: ImageMetadata,
        objects?: DetectedObject[]
    ): boolean {
        // Additional patterns that suggest unimportant images
        const junkPatterns = [
            /^temp/i,
            /^tmp/i,
            /^test/i,
            /^draft/i,
            /^untitled/i,
            /duplicate/i,
            /copy/i,
            /\(\d+\)$/i // Files ending with (1), (2), etc.
        ];
        
        return junkPatterns.some(pattern => pattern.test(filename));
    }
}