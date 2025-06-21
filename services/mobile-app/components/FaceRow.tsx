import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { FaceData } from '../types/FaceTypes';
import { API_BASE } from '../config';

interface FaceRowProps {
  faces: FaceData[];
  onFacePress?: (face: FaceData) => void;
}

export const FaceRow: React.FC<FaceRowProps> = ({ faces, onFacePress }) => {
  if (!faces || faces.length === 0) {
    return null;
  }

  const getFaceImageUrl = (face: FaceData): string => {
    // Use the relative_face_path for a cleaner URL
    return `${API_BASE}/processed/faces/${face.relative_face_path}`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerText}>Detected Faces ({faces.length})</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {faces.map((face, index) => (
          <TouchableOpacity
            key={face.id}
            style={styles.faceContainer}
            onPress={() => onFacePress?.(face)}
            activeOpacity={0.7}
          >
            <View style={styles.faceImageContainer}>
              <Image
                source={{ uri: getFaceImageUrl(face) }}
                style={styles.faceImage}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
              />
            </View>
            <Text style={styles.faceLabel}>
              {face.person_name || `Face ${index + 1}`}
            </Text>
            <Text style={styles.confidenceText}>
              {(parseFloat(face.detection_confidence) * 100).toFixed(1)}%
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 16,
    marginBottom: 12,
    color: '#333',
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  faceContainer: {
    alignItems: 'center',
    marginRight: 16,
    width: 80,
  },
  faceImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#f5f5f5',
  },
  faceImage: {
    width: '100%',
    height: '100%',
  },
  faceLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
    marginTop: 6,
    textAlign: 'center',
  },
  confidenceText: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
});