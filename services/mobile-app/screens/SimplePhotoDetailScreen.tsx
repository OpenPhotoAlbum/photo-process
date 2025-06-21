import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  Alert
} from 'react-native';
import { Image } from 'expo-image';
import { API_BASE } from '../config';

interface SimplePhotoDetailScreenProps {
  imageId: number;
  imageUrl: string;
  filename: string;
  onClose: () => void;
}

const screenHeight = Dimensions.get('window').height;
const screenWidth = Dimensions.get('window').width;

export const SimplePhotoDetailScreen: React.FC<SimplePhotoDetailScreenProps> = ({
  imageId,
  imageUrl,
  filename,
  onClose
}) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState<string | null>(null);
  const getFullImageUrl = () => {
    const fullUrl = `${API_BASE}${imageUrl}`;
    console.log('Simple detail view image URL:', fullUrl);
    return fullUrl;
  };

  // Removed dual API base functionality - now uses config-based API_BASE

  const handleImageLoad = () => {
    console.log('✅ Image loaded successfully!');
    setImageLoading(false);
    setImageError(null);
  };

  const handleImageError = (error: any) => {
    console.error('❌ Image failed to load:', error);
    setImageLoading(false);
    setImageError(JSON.stringify(error));
  };

  const showDebugInfo = () => {
    Alert.alert(
      'Debug Info',
      `Image ID: ${imageId}\nFilename: ${filename}\nAPI Base: ${API_BASE}\nURL: ${getFullImageUrl()}\nLoading: ${imageLoading}\nError: ${imageError || 'None'}`,
      [
        { text: 'OK' }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {filename}
        </Text>
        <TouchableOpacity style={styles.debugButton} onPress={showDebugInfo}>
          <Text style={styles.debugButtonText}>?</Text>
        </TouchableOpacity>
      </View>

      {/* Simple image display */}
      <View style={styles.imageContainer}>
        {imageLoading && (
          <View style={styles.statusOverlay}>
            <Text style={styles.statusText}>Loading...</Text>
          </View>
        )}
        
        {imageError && (
          <View style={styles.statusOverlay}>
            <Text style={styles.errorText}>Failed to load image</Text>
            <Text style={styles.errorDetails}>{imageError}</Text>
            <Text style={styles.urlText}>{getFullImageUrl()}</Text>
          </View>
        )}
        
        <Image
          key={getFullImageUrl()} // Force re-render when URL changes
          source={{ uri: getFullImageUrl() }}
          style={styles.image}
          contentFit="contain"
          transition={200}
          cachePolicy="none" // Disable cache for debugging
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
      </View>

      {/* Info section */}
      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>Debug Information</Text>
        <Text style={styles.infoText}>Image ID: {imageId}</Text>
        <Text style={styles.infoText}>API Base: {API_BASE}</Text>
        <Text style={styles.infoText}>URL: {getFullImageUrl()}</Text>
        <Text style={styles.infoText}>Loading: {imageLoading ? 'Yes' : 'No'}</Text>
        <Text style={styles.infoText}>Error: {imageError || 'None'}</Text>
      </View>
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
  debugButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 255, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  debugButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  imageContainer: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  statusOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    padding: 20,
  },
  statusText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
  },
  errorText: {
    color: '#ff5252',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorDetails: {
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  urlText: {
    color: '#cccccc',
    fontSize: 12,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  infoSection: {
    backgroundColor: '#333',
    padding: 16,
    maxHeight: 150,
  },
  infoTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoText: {
    color: '#ccc',
    fontSize: 12,
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  switchButton: {
    backgroundColor: '#0066CC',
    padding: 8,
    borderRadius: 4,
    marginTop: 8,
    alignItems: 'center',
  },
  switchButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
});