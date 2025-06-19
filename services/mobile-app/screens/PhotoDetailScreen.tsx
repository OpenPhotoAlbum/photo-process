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
import { PinchGestureHandler, State } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { ImageWithFaces } from '../components/ImageWithFaces';
import { FaceRow } from '../components/FaceRow';
import { MetadataSection } from '../components/MetadataSection';
import { PersonSelectionModal } from '../components/PersonSelectionModal';
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
  const [selectedFace, setSelectedFace] = useState<FaceData | null>(null);
  const [showPersonModal, setShowPersonModal] = useState(false);
  
  // Zoom animation values
  const scale = useSharedValue(1);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);

  useEffect(() => {
    loadFaces();
  }, [imageId]);
  
  // Pinch gesture handler for zoom
  const pinchHandler = useAnimatedGestureHandler({
    onStart: (_, context: any) => {
      context.startScale = scale.value;
    },
    onActive: (event, context: any) => {
      scale.value = Math.max(1, Math.min(context.startScale * event.scale, 3)); // Limit zoom between 1x and 3x
      focalX.value = event.focalX;
      focalY.value = event.focalY;
    },
    onEnd: () => {
      if (scale.value < 1.2) {
        // Reset to normal size if zoom is too small
        scale.value = withSpring(1);
        focalX.value = withSpring(0);
        focalY.value = withSpring(0);
      }
    },
  });
  
  // Animated style for zoom
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value },
        { translateX: focalX.value * (1 - scale.value) },
        { translateY: focalY.value * (1 - scale.value) },
      ],
    };
  });
  
  // Reset zoom when switching images
  useEffect(() => {
    scale.value = withSpring(1);
    focalX.value = withSpring(0);
    focalY.value = withSpring(0);
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
        {/* Main image with face overlays and pinch-to-zoom */}
        <View style={styles.imageSection}>
          <PinchGestureHandler onGestureEvent={pinchHandler}>
            <Animated.View style={[styles.zoomContainer, animatedStyle]}>
              <ImageWithFaces
                imageUrl={getOptimizedImageUrl()}
                faces={faces}
                imageId={imageId}
                style={styles.mainImage}
                onFacePress={handleFacePress}
              />
            </Animated.View>
          </PinchGestureHandler>
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
  placeholder: {
    width: 40,
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