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
  photos?: any[]; // Array of all photos for navigation
  currentIndex?: number; // Current photo index
  onNavigate?: (newPhoto: any) => void; // Callback when navigating to new photo
}

const screenHeight = Dimensions.get('window').height;

export const PhotoDetailScreen: React.FC<PhotoDetailScreenProps> = ({
  imageId,
  imageUrl,
  filename,
  onClose,
  onDelete,
  photos = [],
  currentIndex = 0,
  onNavigate
}) => {
  const [faces, setFaces] = useState<FaceData[]>([]);
  const [selectedFace, setSelectedFace] = useState<FaceData | null>(null);
  const [showPersonModal, setShowPersonModal] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  useEffect(() => {
    loadFaces();
  }, [imageId]);

  // Create pan responder for swipe gestures
  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only capture horizontal swipes
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy * 2) && Math.abs(gestureState.dx) > 10;
      },
      onPanResponderRelease: (_, gestureState) => {
        const swipeThreshold = 50;
        
        if (gestureState.dx > swipeThreshold && !isTransitioning) {
          // Swipe right - go to previous photo
          navigateToPrevious();
        } else if (gestureState.dx < -swipeThreshold && !isTransitioning) {
          // Swipe left - go to next photo
          navigateToNext();
        }
      },
    })
  ).current;

  const navigateToPrevious = () => {
    if (photos.length === 0 || currentIndex === 0 || !onNavigate) return;
    
    setIsTransitioning(true);
    const previousPhoto = photos[currentIndex - 1];
    onNavigate(previousPhoto);
    setTimeout(() => setIsTransitioning(false), 300);
  };

  const navigateToNext = () => {
    if (photos.length === 0 || currentIndex >= photos.length - 1 || !onNavigate) return;
    
    setIsTransitioning(true);
    const nextPhoto = photos[currentIndex + 1];
    onNavigate(nextPhoto);
    setTimeout(() => setIsTransitioning(false), 300);
  };

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

  const handleFaceRemoval = async (face: FaceData) => {
    try {
      const response = await fetch(`${API_BASE}/api/faces/${face.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        // Remove the face from our local state
        setFaces(prevFaces => prevFaces.filter(f => f.id !== face.id));
        Alert.alert('Success', 'Face removed successfully');
      } else {
        const error = await response.json();
        Alert.alert('Error', error.error || 'Failed to remove face');
      }
    } catch (error) {
      console.error('Failed to remove face:', error);
      Alert.alert('Error', 'Failed to remove face');
    }
  };

  const handleFacePress = (face: FaceData) => {
    const isAssigned = face.person_name && face.person_id;
    
    const buttons = [
      { text: 'Cancel', style: 'cancel' as const },
      {
        text: 'Remove Face',
        style: 'destructive' as const,
        onPress: () => {
          Alert.alert(
            'Remove Face',
            'This will permanently remove this face detection. Are you sure?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Remove',
                style: 'destructive',
                onPress: () => handleFaceRemoval(face)
              }
            ]
          );
        }
      },
      {
        text: isAssigned ? 'Reassign Person' : 'Assign Person',
        onPress: () => {
          setSelectedFace(face);
          setShowPersonModal(true);
        }
      }
    ];

    Alert.alert(
      'Face Details',
      `Face ID: ${face.id}\nConfidence: ${(parseFloat(face.detection_confidence) * 100).toFixed(1)}%\nPerson: ${face.person_name || 'Unassigned'}`,
      buttons
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
    // Validate imageUrl prop
    if (!imageUrl) {
      console.error('PhotoDetailScreen: imageUrl is undefined or null');
      return `${API_BASE}/media/placeholder.jpg`; // Fallback URL
    }
    
    // Ensure imageUrl starts with /media/ for consistency
    const mediaPath = imageUrl.startsWith('/media/') ? imageUrl : `/media/${imageUrl}`;
    
    const thumbnailUrl = `${API_BASE}${mediaPath}?thumb=1`;
    const originalUrl = `${API_BASE}${mediaPath}`;
    const optimizedUrl = `${API_BASE}${mediaPath}?width=${Math.round(Dimensions.get('window').width * 2)}`;
    
    console.log('PhotoDetailScreen: Image URL prop:', imageUrl);
    console.log('PhotoDetailScreen: Media path:', mediaPath);
    console.log('PhotoDetailScreen: Final URL:', originalUrl);
    
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

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        {...panResponder.panHandlers}
      >
        {/* Main image with face overlays */}
        <View style={styles.imageSection}>
          <ImageWithFaces
            imageUrl={getOptimizedImageUrl()}
            faces={faces}
            imageId={imageId}
            style={styles.mainImage}
            onFacePress={handleFacePress}
          />
          
          {/* Navigation indicators - shown when photos array is provided */}
          {photos.length > 0 && onNavigate && (
            <>
              {currentIndex > 0 && (
                <TouchableOpacity 
                  style={styles.navButton} 
                  onPress={navigateToPrevious}
                  activeOpacity={0.7}
                >
                  <Text style={styles.navButtonText}>‹</Text>
                </TouchableOpacity>
              )}
              
              {currentIndex < photos.length - 1 && (
                <TouchableOpacity 
                  style={[styles.navButton, styles.navButtonRight]} 
                  onPress={navigateToNext}
                  activeOpacity={0.7}
                >
                  <Text style={styles.navButtonText}>›</Text>
                </TouchableOpacity>
              )}
              
              {/* Photo counter */}
              <View style={styles.photoCounter}>
                <Text style={styles.photoCounterText}>
                  {currentIndex + 1} / {photos.length}
                </Text>
              </View>
            </>
          )}
          
          {/* Swipe hint - shown when navigation is available but no visible controls */}
          {photos.length > 1 && onNavigate && (
            <View style={styles.swipeHint}>
              <Text style={styles.swipeHintText}>Swipe left/right to navigate</Text>
            </View>
          )}
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
    zIndex: 99999,
    elevation: 99999, // Android elevation
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
  navButton: {
    position: 'absolute',
    left: 10,
    top: '50%',
    marginTop: -30,
    width: 60,
    height: 60,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonRight: {
    left: undefined,
    right: 10,
  },
  navButtonText: {
    color: 'white',
    fontSize: 32,
    fontWeight: '300',
  },
  photoCounter: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  photoCounterText: {
    color: 'white',
    fontSize: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  swipeHint: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  swipeHintText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontStyle: 'italic',
  },
});