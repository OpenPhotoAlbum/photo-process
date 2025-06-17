import { Request, Response } from 'express';
import { ObjectRepository, ImageRepository } from '../models/database';
import config from '../config';

// Search images by detected objects
export const searchByObjects = async (req: Request, res: Response) => {
        try {
            const query = req.query.q as string;
            const minConfidence = parseFloat(req.query.confidence as string) || config.getMinConfidence();
            
            if (!query) {
                return res.status(400).json({ error: 'Search query required' });
            }
            
            // Split query into multiple terms (e.g., "person car" -> ["person", "car"])
            const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
            
            // Find images that contain any of the searched objects
            const imageIds = await ObjectRepository.searchImagesByObjects(searchTerms, minConfidence);
            
            if (imageIds.length === 0) {
                return res.json({ 
                    query,
                    count: 0,
                    images: [],
                    searchTerms
                });
            }
            
            // Get image details for found images
            const images = await Promise.all(
                imageIds.map(async (imageId) => {
                    const image = await ImageRepository.findById(imageId);
                    if (!image) return null;
                    
                    // Get objects for this image to show what was found
                    const objects = await ObjectRepository.getObjectsByImage(imageId);
                    const matchingObjects = objects.filter(obj => 
                        searchTerms.some(term => obj.class.toLowerCase().includes(term))
                    );
                    
                    return {
                        id: image.id,
                        filename: image.filename,
                        original_path: image.original_path,
                        dominant_color: image.dominant_color,
                        date_taken: image.date_taken,
                        matchingObjects: matchingObjects.map(obj => ({
                            class: obj.class,
                            confidence: obj.confidence
                        }))
                    };
                })
            );
            
            const validImages = images.filter(img => img !== null);
            
            res.json({
                query,
                count: validImages.length,
                images: validImages,
                searchTerms,
                minConfidence
            });
            
        } catch (error) {
            console.error('Error searching by objects:', error);
            res.status(500).json({ error: 'Failed to search images' });
        }
    };

// Get object statistics for suggestions
export const getObjectStats = async (req: Request, res: Response) => {
        try {
            const objectStats = await ObjectRepository.getObjectStats();
            
            // Group similar objects and add counts
            const formattedStats = objectStats.map(stat => ({
                class: stat.class,
                count: stat.count,
                searchable: true
            }));
            
            res.json({
                objects: formattedStats,
                totalClasses: formattedStats.length,
                totalDetections: formattedStats.reduce((sum, obj) => sum + obj.count, 0)
            });
            
        } catch (error) {
            console.error('Error getting object stats:', error);
            res.status(500).json({ error: 'Failed to get object statistics' });
        }
    };

// Advanced search with multiple filters
export const advancedSearch = async (req: Request, res: Response) => {
        try {
            const {
                objects = [],
                minConfidence = config.getMinConfidence(),
                dateFrom,
                dateTo,
                hasFaces,
                camera,
                location,
                isAstro
            } = req.query;
            
            let imageIds: number[] = [];
            
            // Start with object search if specified
            if (objects && Array.isArray(objects) && objects.length > 0) {
                imageIds = await ObjectRepository.searchImagesByObjects(
                    objects as string[], 
                    parseFloat(minConfidence as string)
                );
            } else {
                // Get all processed images if no object filter
                const allImages = await ImageRepository.getProcessedImages(1000, 0);
                imageIds = allImages.map(img => img.id!);
            }
            
            // Apply additional filters using ImageRepository.searchImages
            const additionalFilters: any = {};
            if (dateFrom) additionalFilters.dateFrom = new Date(dateFrom as string);
            if (dateTo) additionalFilters.dateTo = new Date(dateTo as string);
            if (hasFaces !== undefined) additionalFilters.hasFaces = hasFaces === 'true';
            if (camera) additionalFilters.camera = camera as string;
            if (location) additionalFilters.location = location as string;
            if (isAstro !== undefined) additionalFilters.isAstrophotography = isAstro === 'true';
            
            if (Object.keys(additionalFilters).length > 0) {
                const filteredImages = await ImageRepository.searchImages(additionalFilters);
                const filteredIds = filteredImages.map(img => img.id!);
                
                // Intersection of object search results and additional filters
                imageIds = imageIds.filter(id => filteredIds.includes(id));
            }
            
            // Get full image data
            const images = await Promise.all(
                imageIds.slice(0, 100).map(async (imageId) => { // Limit to 100 results
                    const image = await ImageRepository.findById(imageId);
                    if (!image) return null;
                    
                    const objects = await ObjectRepository.getObjectsByImage(imageId);
                    
                    return {
                        ...image,
                        objectCount: objects.length,
                        topObjects: objects.slice(0, 3).map(obj => ({
                            class: obj.class,
                            confidence: obj.confidence
                        }))
                    };
                })
            );
            
            const validImages = images.filter(img => img !== null);
            
            res.json({
                count: validImages.length,
                images: validImages,
                filters: {
                    objects,
                    minConfidence,
                    dateFrom,
                    dateTo,
                    hasFaces,
                    camera,
                    location
                }
            });
            
        } catch (error) {
            console.error('Error in advanced search:', error);
            res.status(500).json({ error: 'Failed to perform advanced search' });
        }
    };