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
import {
  PanResponder,
  PanResponderInstance,
} from 'react-native';
import { ImageWithFaces } from '../components/ImageWithFaces';
import { FaceRow } from '../components/FaceRow';
import { MetadataSection } from '../components/MetadataSection';
import { PersonSelectionModal } from '../components/PersonSelectionModal';
import { FaceAPI } from '../services/FaceAPI';
import { FaceData } from '../types/FaceTypes';
import { API_BASE } from '../config';

interface PhotoDetailScreenProps {
  imageId: number;
  imageUrl: string;
  filename: string;
  onClose: () => void;
  onDelete?: () => void;
}

const screenHeight = Dimensions.get('window').height;

export const PhotoDetailScreen: React.FC<PhotoDetailScreenProps> = ({
  imageId,
  imageUrl,
  filename,
  onClose,
  onDelete
}) => {
  const [faces, setFaces] = useState<FaceData[]>([]);
  const [selectedFace, setSelectedFace] = useState<FaceData | null>(null);
  const [showPersonModal, setShowPersonModal] = useState(false);
  
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

  const handleDelete = () => {
    Alert.alert(
      'Move to Trash',
      'This photo will be moved to trash. You can restore it later from the trash folder.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Move to Trash',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE}/api/gallery/${imageId}`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  reason: 'Moved to trash via mobile app',
                  deletedBy: 'mobile-user'
                })
              });
              
              if (response.ok) {
                const result = await response.json();
                Alert.alert('Success', result.message || 'Photo moved to trash');
                // Call the parent's onDelete callback if provided
                onDelete?.();
                // Close the detail view
                onClose();
              } else {
                const error = await response.json();
                Alert.alert('Error', error.error || 'Failed to move photo to trash');
              }
            } catch (error) {
              console.error('Failed to move photo to trash:', error);
              Alert.alert('Error', 'Failed to move photo to trash');
            }
          }
        }
      ]
    );
  };

  const handleFacePress = (face: FaceData) => {
    const isAssigned = face.person_name && face.person_id;
    
    Alert.alert(
      'Face Details',
      `Face ID: ${face.id}\nConfidence: ${(parseFloat(face.detection_confidence) * 100).toFixed(1)}%\nPerson: ${face.person_name || 'Unassigned'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isAssigned ? 'Reassign Person' : 'Assign Person',
          onPress: () => {
            setSelectedFace(face);
            setShowPersonModal(true);
          }
        }
      ]
    );
  };

  const handlePersonAssignment = (faceId: number, personId: number, personName: string) => {
    // Update the face in our local state
    setFaces(prevFaces => 
      prevFaces.map(face => 
        face.id === faceId 
          ? { ...face, person_id: personId, person_name: personName }
          : face
      )
    );

    Alert.alert(
      'Success!',
      `Face assigned to ${personName}`,
      [{ text: 'OK' }]
    );
  };

  const getOptimizedImageUrl = () => {
    // Try using thumbnail URL format that works in gallery
    const thumbnailUrl = `${API_BASE}${imageUrl}?thumb=1`;
    const originalUrl = `${API_BASE}${imageUrl}`;
    const optimizedUrl = `${API_BASE}${imageUrl}?width=${Math.round(Dimensions.get('window').width * 2)}`;
    console.log('PhotoDetailScreen: Thumbnail URL:', thumbnailUrl);
    console.log('PhotoDetailScreen: Original image URL:', originalUrl);
    console.log('PhotoDetailScreen: Optimized image URL:', optimizedUrl);
    
    // Now that we know thumbnails work, try the full-size image
    return originalUrl;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with close and delete buttons */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {filename}
        </Text>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>🗑️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Main image with face overlays */}
        <View style={styles.imageSection}>
          <ImageWithFaces
            imageUrl={getOptimizedImageUrl()}
            faces={faces}
            imageId={imageId}
            style={styles.mainImage}
            onFacePress={handleFacePress}
          />
        </View>

        {/* Face thumbnails row */}
        {faces.length > 0 && (
          <FaceRow faces={faces} onFacePress={handleFacePress} />
        )}
        
        {/* Metadata section */}
        <MetadataSection imageId={imageId} />
      </ScrollView>

      {/* Person Selection Modal */}
      <PersonSelectionModal
        visible={showPersonModal}
        face={selectedFace}
        onClose={() => {
          setShowPersonModal(false);
          setSelectedFace(null);
        }}
        onAssignComplete={handlePersonAssignment}
      />
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
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    fontSize: 18,
  },
  content: {
    flex: 1,
  },
  imageSection: {
    height: screenHeight * 0.6, // 60% of screen height for the main image
    backgroundColor: '#000',
    overflow: 'hidden', // Prevent zoom from going outside bounds
  },
  zoomContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainImage: {
    flex: 1,
  },
});