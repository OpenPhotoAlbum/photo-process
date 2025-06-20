import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { FaceData, FaceBoundingBox, ScaledFaceData } from '../types/FaceTypes';
import { API_BASE } from '../config';

interface ImageWithFacesProps {
  imageUrl: string;
  faces: FaceData[];
  imageId: number; // Add imageId to fetch original dimensions
  style?: any;
  onFacePress?: (face: FaceData) => void;
  onImageLoad?: () => void;
  onImageError?: (error: string) => void;
}

export const ImageWithFaces: React.FC<ImageWithFacesProps> = ({
  imageUrl,
  faces,
  imageId,
  style,
  onFacePress,
  onImageLoad,
  onImageError
}) => {
  console.log('ImageWithFaces - Component props:', { imageUrl, imageId, facesCount: faces.length });
  
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [originalImageSize, setOriginalImageSize] = useState({ width: 0, height: 0 });
  const [scaledFaces, setScaledFaces] = useState<ScaledFaceData[]>([]);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // Fetch original image dimensions from API
  useEffect(() => {
    const fetchImageDimensions = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/gallery/${imageId}`);
        const data = await response.json();
        if (data.width && data.height) {
          // Check for EXIF orientation to determine if dimensions need swapping
          const orientation = data.metadata?.orientation || 1;
          const needsRotation = orientation >= 5 && orientation <= 8;
          
          const width = needsRotation ? data.height : data.width;
          const height = needsRotation ? data.width : data.height;
          
          console.log('ImageWithFaces - Original dimensions from API:', data.width, 'x', data.height);
          console.log('ImageWithFaces - EXIF orientation:', orientation, 'needs rotation:', needsRotation);
          console.log('ImageWithFaces - Adjusted dimensions:', width, 'x', height);
          
          setOriginalImageSize({ width, height });
        }
      } catch (error) {
        console.error('ImageWithFaces - Failed to fetch image dimensions:', error);
      }
    };

    if (imageId) {
      fetchImageDimensions();
    }
  }, [imageId]);

  // Calculate scaled face coordinates
  useEffect(() => {
    if (imageSize.width > 0 && originalImageSize.width > 0 && faces.length > 0) {
      // Calculate the actual visible image area within the container (contentFit="contain")
      const containerAspectRatio = imageSize.width / imageSize.height;
      const imageAspectRatio = originalImageSize.width / originalImageSize.height;
      
      let visibleImageWidth, visibleImageHeight, offsetX, offsetY;
      
      if (imageAspectRatio > containerAspectRatio) {
        // Image is wider - will have black bars on top/bottom
        visibleImageWidth = imageSize.width;
        visibleImageHeight = imageSize.width / imageAspectRatio;
        offsetX = 0;
        offsetY = (imageSize.height - visibleImageHeight) / 2;
      } else {
        // Image is taller - will have black bars on left/right
        visibleImageWidth = imageSize.height * imageAspectRatio;
        visibleImageHeight = imageSize.height;
        offsetX = (imageSize.width - visibleImageWidth) / 2;
        offsetY = 0;
      }

      const scaleX = visibleImageWidth / originalImageSize.width;
      const scaleY = visibleImageHeight / originalImageSize.height;

      console.log('=== FACE COORDINATE DEBUGGING ===');
      console.log('Container size:', imageSize);
      console.log('Original image size:', originalImageSize);
      console.log('Visible image size:', { width: visibleImageWidth, height: visibleImageHeight });
      console.log('Offset:', { x: offsetX, y: offsetY });
      console.log('Scale factors - X:', scaleX, 'Y:', scaleY);
      console.log('First face raw coordinates:', faces[0]);

      const scaled = faces.map((face, index) => {
        const scaledBounds = {
          x: (face.x_min * scaleX) + offsetX,
          y: (face.y_min * scaleY) + offsetY,
          width: (face.x_max - face.x_min) * scaleX,
          height: (face.y_max - face.y_min) * scaleY,
        };
        
        if (index === 0) {
          console.log('First face scaled bounds:', scaledBounds);
        }
        
        return {
          ...face,
          scaledBounds
        };
      });

      setScaledFaces(scaled);
    }
  }, [imageSize, originalImageSize, faces]);

  const handleImageLoad = (event: any) => {
    console.log('Image loaded successfully');
    onImageLoad?.();
  };

  const handleLayout = (event: any) => {
    const { width, height } = event.nativeEvent.layout;
    setImageSize({ width, height });
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.imageContainer} onLayout={handleLayout}>
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          contentFit="contain"
          transition={100}
          cachePolicy="memory-disk"
          priority="normal"
          allowDownscaling={true}
          onLoad={(event) => {
            console.log('ImageWithFaces - Image loaded successfully:', imageUrl);
            console.log('ImageWithFaces - Image load event:', event);
            setImageLoaded(true);
            setImageError(null);
            handleImageLoad(event);
          }}
          onLoadStart={() => {
            console.log('ImageWithFaces - Image loading started:', imageUrl);
            setImageLoaded(false);
            setImageError(null);
          }}
          onError={(error) => {
            console.error('ImageWithFaces - Failed to load image:', imageUrl, error);
            setImageError(JSON.stringify(error));
            setImageLoaded(false);
            onImageError?.(`Failed to load image: ${JSON.stringify(error)}`);
          }}
        />
        
        
        {/* Face bounding boxes overlay - Using simple Views instead of SVG */}
        {scaledFaces.length > 0 && imageSize.width > 0 && (
          <View style={styles.overlay}>
            {scaledFaces.map((face, index) => (
              <TouchableOpacity
                key={face.id}
                style={[
                  styles.faceBox,
                  {
                    left: face.scaledBounds.x,
                    top: face.scaledBounds.y,
                    width: face.scaledBounds.width,
                    height: face.scaledBounds.height,
                  }
                ]}
                onPress={() => onFacePress?.(face)}
                activeOpacity={0.7}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    flex: 1,
  },
  imageContainer: {
    position: 'relative',
    flex: 1,
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  faceBox: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#FF0080', // Bright pink for visibility
    backgroundColor: 'rgba(255, 0, 128, 0.1)', // Slight pink tint
    borderRadius: 4,
  },
  debugOverlay: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    padding: 10,
    borderRadius: 5,
    zIndex: 1000,
  },
  debugText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});