import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { FaceData, FaceBoundingBox, ScaledFaceData } from '../types/FaceTypes';

interface ImageWithFacesProps {
  imageUrl: string;
  faces: FaceData[];
  style?: any;
  onFacePress?: (face: FaceData) => void;
  onImageLoad?: () => void;
  onImageError?: (error: string) => void;
}

const API_BASE = 'http://192.168.40.103:9000';

export const ImageWithFaces: React.FC<ImageWithFacesProps> = ({
  imageUrl,
  faces,
  style,
  onFacePress,
  onImageLoad,
  onImageError
}) => {
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [originalImageSize, setOriginalImageSize] = useState({ width: 0, height: 0 });
  const [scaledFaces, setScaledFaces] = useState<ScaledFaceData[]>([]);

  // Calculate scaled face coordinates
  useEffect(() => {
    if (imageSize.width > 0 && originalImageSize.width > 0 && faces.length > 0) {
      const scaleX = imageSize.width / originalImageSize.width;
      const scaleY = imageSize.height / originalImageSize.height;

      const scaled = faces.map(face => ({
        ...face,
        scaledBounds: {
          x: face.x_min * scaleX,
          y: face.y_min * scaleY,
          width: (face.x_max - face.x_min) * scaleX,
          height: (face.y_max - face.y_min) * scaleY,
        }
      }));

      setScaledFaces(scaled);
    }
  }, [imageSize, originalImageSize, faces]);

  const handleImageLoad = (event: any) => {
    const { width, height } = event.source;
    console.log('Image loaded with dimensions:', width, 'x', height);
    setOriginalImageSize({ width, height });
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
          transition={200}
          cachePolicy="memory-disk"
          onLoad={handleImageLoad}
          onError={(error) => {
            console.error('ImageWithFaces - Failed to load image:', imageUrl, error);
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
    borderWidth: 2,
    borderColor: '#00FF00',
    backgroundColor: 'transparent',
  },
});