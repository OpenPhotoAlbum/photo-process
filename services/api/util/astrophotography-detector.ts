import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

export interface AstroDetectionResult {
    isAstro: boolean;
    confidence: number;
    classification?: string;
    details: {
        darkPixelRatio: number;
        brightPointCount: number;
        averageBrightness: number;
        contrastRatio: number;
        imageWidth: number;
        imageHeight: number;
        starPattern?: boolean;
        nightSkyIndicators?: string[];
    };
}

export class AstrophysicsDetector {
    
    private static readonly THRESHOLDS = {
        DARK_PIXEL_RATIO: 0.6,        // 60% of pixels should be dark for night sky
        BRIGHT_POINT_COUNT: 50,       // Minimum bright points for star detection
        MIN_CONTRAST: 0.3,            // Minimum contrast ratio
        MAX_AVG_BRIGHTNESS: 30,       // Maximum average brightness (0-255)
        STAR_SIZE_MIN: 1,             // Minimum star size in pixels
        STAR_SIZE_MAX: 10,            // Maximum star size in pixels
    };

    /**
     * Detect if an image contains astrophotography content
     */
    public static async detectAstrophotography(imagePath: string): Promise<AstroDetectionResult> {
        try {
            // Read image and get metadata
            const image = sharp(imagePath);
            const metadata = await image.metadata();
            
            if (!metadata.width || !metadata.height) {
                throw new Error('Unable to get image dimensions');
            }

            // Convert to grayscale and get raw pixel data
            const { data: pixels, info } = await image
                .grayscale()
                .raw()
                .toBuffer({ resolveWithObject: true });

            // Analyze image characteristics
            const analysis = this.analyzeImageCharacteristics(pixels, info.width, info.height);
            
            // Calculate confidence and classification
            const result = this.calculateAstroConfidence(analysis, metadata);
            
            return result;

        } catch (error) {
            // Check if it's a known file format error (corrupted/unsupported file)
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('unsupported image format') || 
                errorMessage.includes('premature end') ||
                errorMessage.includes('Input file contains')) {
                // Don't log these as errors - they're expected for corrupted files
                // Just return negative result silently
            } else {
                // Log unexpected errors
                console.error('Unexpected error in astrophotography detection:', error);
            }
            
            return {
                isAstro: false,
                confidence: 0,
                details: {
                    darkPixelRatio: 0,
                    brightPointCount: 0,
                    averageBrightness: 0,
                    contrastRatio: 0,
                    imageWidth: 0,
                    imageHeight: 0,
                }
            };
        }
    }

    /**
     * Analyze pixel characteristics for astronomical features
     */
    private static analyzeImageCharacteristics(pixels: Buffer, width: number, height: number) {
        const totalPixels = width * height;
        let darkPixelCount = 0;
        let brightPixelSum = 0;
        let brightPoints: { x: number, y: number, brightness: number }[] = [];
        let totalBrightness = 0;
        let maxBrightness = 0;
        let minBrightness = 255;

        // Analyze each pixel
        for (let i = 0; i < pixels.length; i++) {
            const brightness = pixels[i];
            totalBrightness += brightness;
            
            maxBrightness = Math.max(maxBrightness, brightness);
            minBrightness = Math.min(minBrightness, brightness);

            // Count dark pixels (likely space/sky)
            if (brightness < 50) {
                darkPixelCount++;
            }

            // Detect bright points (potential stars)
            if (brightness > 200) {
                const x = i % width;
                const y = Math.floor(i / width);
                brightPoints.push({ x, y, brightness });
                brightPixelSum += brightness;
            }
        }

        // Filter bright points to identify actual stars (not noise)
        const stars = this.identifyStarCandidates(brightPoints, pixels, width, height);

        const averageBrightness = totalBrightness / totalPixels;
        const darkPixelRatio = darkPixelCount / totalPixels;
        const contrastRatio = maxBrightness > 0 ? (maxBrightness - minBrightness) / maxBrightness : 0;

        return {
            darkPixelRatio,
            brightPointCount: stars.length,
            averageBrightness,
            contrastRatio,
            imageWidth: width,
            imageHeight: height,
            stars,
            maxBrightness,
            minBrightness,
        };
    }

    /**
     * Identify star candidates from bright points
     */
    private static identifyStarCandidates(
        brightPoints: { x: number, y: number, brightness: number }[], 
        pixels: Buffer, 
        width: number, 
        height: number
    ) {
        const stars: { x: number, y: number, brightness: number, size: number }[] = [];
        const processed = new Set<string>();

        for (const point of brightPoints) {
            const key = `${point.x},${point.y}`;
            if (processed.has(key)) continue;

            // Check if this point is part of a star (connected bright pixels)
            const star = this.analyzeStarCandidate(point, pixels, width, height, processed);
            
            if (star && star.size >= this.THRESHOLDS.STAR_SIZE_MIN && star.size <= this.THRESHOLDS.STAR_SIZE_MAX) {
                stars.push(star);
            }
        }

        return stars;
    }

    /**
     * Analyze a potential star by examining surrounding pixels
     */
    private static analyzeStarCandidate(
        center: { x: number, y: number, brightness: number }, 
        pixels: Buffer, 
        width: number, 
        height: number,
        processed: Set<string>
    ) {
        const visited = new Set<string>();
        const queue = [center];
        let totalBrightness = 0;
        let pixelCount = 0;
        let maxBrightness = center.brightness;

        while (queue.length > 0) {
            const point = queue.shift()!;
            const key = `${point.x},${point.y}`;
            
            if (visited.has(key)) continue;
            visited.add(key);
            processed.add(key);

            totalBrightness += point.brightness;
            pixelCount++;
            maxBrightness = Math.max(maxBrightness, point.brightness);

            // Check neighboring pixels
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    const nx = point.x + dx;
                    const ny = point.y + dy;
                    const nkey = `${nx},${ny}`;

                    if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited.has(nkey)) {
                        const pixelIndex = ny * width + nx;
                        const brightness = pixels[pixelIndex];

                        // Include pixel if it's bright enough to be part of the star
                        if (brightness > 150) {
                            queue.push({ x: nx, y: ny, brightness });
                        }
                    }
                }
            }
        }

        return {
            x: center.x,
            y: center.y,
            brightness: totalBrightness / pixelCount,
            size: pixelCount
        };
    }

    /**
     * Calculate confidence score and classification
     */
    private static calculateAstroConfidence(analysis: any, metadata: any): AstroDetectionResult {
        let confidence = 0;
        let classification = '';
        const indicators: string[] = [];

        // Factor 1: Dark pixel ratio (night sky)
        if (analysis.darkPixelRatio >= this.THRESHOLDS.DARK_PIXEL_RATIO) {
            confidence += 0.3;
            indicators.push('dark_sky');
        }

        // Factor 2: Bright point count (stars)
        if (analysis.brightPointCount >= this.THRESHOLDS.BRIGHT_POINT_COUNT) {
            confidence += 0.4;
            indicators.push('star_field');
            classification = 'stars';
        } else if (analysis.brightPointCount >= 10) {
            confidence += 0.2;
            indicators.push('few_stars');
        }

        // Factor 3: Low average brightness
        if (analysis.averageBrightness <= this.THRESHOLDS.MAX_AVG_BRIGHTNESS) {
            confidence += 0.2;
            indicators.push('low_brightness');
        }

        // Factor 4: High contrast (stars against dark sky)
        if (analysis.contrastRatio >= this.THRESHOLDS.MIN_CONTRAST) {
            confidence += 0.1;
            indicators.push('high_contrast');
        }

        // Special classifications based on patterns
        if (analysis.brightPointCount < 10 && analysis.darkPixelRatio > 0.8) {
            if (analysis.brightPointCount >= 1) {
                classification = 'moon_planets';
                confidence = Math.max(confidence, 0.7);
            } else {
                classification = 'deep_space';
                confidence = Math.max(confidence, 0.6);
            }
        } else if (analysis.brightPointCount > 200) {
            classification = 'dense_star_field';
            confidence = Math.max(confidence, 0.9);
        }

        // Time-based factors (if EXIF data available)
        if (metadata.exif) {
            // Check for long exposure times typical of astrophotography
            const exposureTime = this.getExposureTime(metadata.exif);
            if (exposureTime && exposureTime > 5) { // 5+ second exposure
                confidence += 0.1;
                indicators.push('long_exposure');
            }

            // Check for high ISO typical of night photography
            const iso = this.getISO(metadata.exif);
            if (iso && iso > 1600) {
                confidence += 0.05;
                indicators.push('high_iso');
            }
        }

        // Ensure confidence is between 0 and 1
        confidence = Math.min(1, Math.max(0, confidence));

        const isAstro = confidence >= 0.5;

        return {
            isAstro,
            confidence,
            classification: isAstro ? classification : undefined,
            details: {
                darkPixelRatio: analysis.darkPixelRatio,
                brightPointCount: analysis.brightPointCount,
                averageBrightness: analysis.averageBrightness,
                contrastRatio: analysis.contrastRatio,
                imageWidth: analysis.imageWidth,
                imageHeight: analysis.imageHeight,
                starPattern: analysis.brightPointCount >= this.THRESHOLDS.BRIGHT_POINT_COUNT,
                nightSkyIndicators: indicators,
            }
        };
    }

    /**
     * Extract exposure time from EXIF data
     */
    private static getExposureTime(exif: any): number | null {
        try {
            // Look for exposure time in various EXIF formats
            const exposureTime = exif.ExposureTime || exif.exposureTime || exif['Exposure Time'];
            if (exposureTime) {
                // Handle fractional seconds (e.g., "1/30" or 0.033)
                if (typeof exposureTime === 'string' && exposureTime.includes('/')) {
                    const [numerator, denominator] = exposureTime.split('/').map(Number);
                    return numerator / denominator;
                }
                return Number(exposureTime);
            }
            return null;
        } catch {
            return null;
        }
    }

    /**
     * Extract ISO value from EXIF data
     */
    private static getISO(exif: any): number | null {
        try {
            const iso = exif.ISO || exif.iso || exif.ISOSpeedRatings || exif['ISO Speed'];
            return iso ? Number(iso) : null;
        } catch {
            return null;
        }
    }
}

// Export main detection function for easy use
export const detectAstrophotography = AstrophysicsDetector.detectAstrophotography.bind(AstrophysicsDetector);