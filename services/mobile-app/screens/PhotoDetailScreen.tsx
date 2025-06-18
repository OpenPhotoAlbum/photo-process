import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions
} from 'react-native';
import { ImageWithFaces } from '../components/ImageWithFaces';
import { FaceRow } from '../components/FaceRow';
import { FaceAPI } from '../services/FaceAPI';
import { FaceData } from '../types/FaceTypes';

interface PhotoDetailScreenProps {
  imageId: number;
  imageUrl: string;
  filename: string;
  onClose: () => void;
}

const screenHeight = Dimensions.get('window').height;
const API_BASE = 'http://192.168.40.103:9000';

export const PhotoDetailScreen: React.FC<PhotoDetailScreenProps> = ({
  imageId,
  imageUrl,
  filename,
  onClose
}) => {
  const [faces, setFaces] = useState<FaceData[]>([]);

  useEffect(() => {
    loadFaces();
  }, [imageId]);

  const loadFaces = async () => {
    try {
      const response = await FaceAPI.getImageFaces(imageId);
      setFaces(response.faces);
    } catch (err) {
      console.error('Error loading faces:', err);
      setFaces([]);
    }
  };

  const handleFacePress = (face: FaceData) => {
    Alert.alert(
      'Face Details',
      `Face ID: ${face.id}\\nConfidence: ${(parseFloat(face.detection_confidence) * 100).toFixed(1)}%\\nPerson: ${face.person_name || 'Unassigned'}`,
      [
        { text: 'OK' },
        {
          text: 'Assign Person',
          onPress: () => {
            // TODO: Implement person assignment
            Alert.alert('Coming Soon', 'Person assignment feature will be implemented next!');
          }
        }
      ]
    );
  };

  const getOptimizedImageUrl = () => {
    // For mobile detail view, use a medium-sized version instead of full resolution
    // This will load much faster than the full 3-6MB images
    const optimizedUrl = `${API_BASE}${imageUrl}?width=${Math.round(Dimensions.get('window').width * 2)}`;
    return optimizedUrl;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with close button */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {filename}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Main image with face overlays */}
        <View style={styles.imageSection}>
          <ImageWithFaces
            imageUrl={getOptimizedImageUrl()}
            faces={faces}
            style={styles.mainImage}
            onFacePress={handleFacePress}
          />
        </View>

        {/* Face thumbnails row */}
        {faces.length > 0 && (
          <FaceRow faces={faces} onFacePress={handleFacePress} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerTitle: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  imageSection: {
    height: screenHeight * 0.6, // 60% of screen height for the main image
    backgroundColor: '#000',
  },
  mainImage: {
    flex: 1,
  },
});