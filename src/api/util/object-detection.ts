import * as tf from '@tensorflow/tfjs-node';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import sharp from 'sharp';
import { Logger } from '../logger';

const logger = Logger.getInstance();

let model: cocoSsd.ObjectDetection | null = null;

// Initialize the model (loads once)
export const initializeObjectDetection = async (): Promise<void> => {
    if (!model) {
        logger.info('Loading COCO-SSD object detection model...');
        model = await cocoSsd.load();
        logger.info('Object detection model loaded successfully');
    }
};

export interface DetectedObject {
    class: string;
    confidence: number;
    bbox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

export const detectObjects = async (imagePath: string): Promise<DetectedObject[]> => {
    try {
        // Initialize model if not loaded
        if (!model) {
            await initializeObjectDetection();
        }

        // Load and preprocess image using Sharp
        const imageBuffer = await sharp(imagePath)
            .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
            .removeAlpha() // Remove alpha channel to ensure RGB only
            .raw()
            .toBuffer({ resolveWithObject: true });

        // Convert to tensor
        const { data, info } = imageBuffer;
        const tensor = tf.tensor3d(new Uint8Array(data), [info.height, info.width, info.channels]);

        // Run object detection
        const predictions = await model!.detect(tensor);

        // Clean up tensor
        tensor.dispose();

        // Transform predictions to our format
        const detectedObjects: DetectedObject[] = predictions.map(prediction => ({
            class: prediction.class,
            confidence: Math.round(prediction.score * 100) / 100, // Round to 2 decimal places
            bbox: {
                x: Math.round(prediction.bbox[0]),
                y: Math.round(prediction.bbox[1]),
                width: Math.round(prediction.bbox[2]),
                height: Math.round(prediction.bbox[3])
            }
        }));

        logger.info(`Detected ${detectedObjects.length} objects in ${imagePath}`);
        return detectedObjects;

    } catch (error) {
        logger.error(`Error detecting objects in ${imagePath}: ${error}`);
        return []; // Return empty array on error
    }
};

// Get unique object classes from detected objects
export const getObjectClasses = (objects: DetectedObject[]): string[] => {
    return [...new Set(objects.map(obj => obj.class))];
};

// Filter objects by confidence threshold
export const filterByConfidence = (objects: DetectedObject[], threshold: number = 0.5): DetectedObject[] => {
    return objects.filter(obj => obj.confidence >= threshold);
};

// Group objects by class
export const groupByClass = (objects: DetectedObject[]): Record<string, DetectedObject[]> => {
    return objects.reduce((groups, obj) => {
        if (!groups[obj.class]) {
            groups[obj.class] = [];
        }
        groups[obj.class].push(obj);
        return groups;
    }, {} as Record<string, DetectedObject[]>);
};