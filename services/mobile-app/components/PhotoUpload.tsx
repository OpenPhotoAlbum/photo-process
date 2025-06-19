import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
  ProgressBarAndroid,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { uploadAPI, UploadResponse, UploadProgress } from '../services/UploadAPI';

interface PhotoUploadProps {
  onUploadComplete?: (response: UploadResponse) => void;
  onUploadError?: (error: string) => void;
}

export const PhotoUpload: React.FC<PhotoUploadProps> = ({
  onUploadComplete,
  onUploadError,
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [showModal, setShowModal] = useState(false);

  const requestPermissions = async () => {
    try {
      // Request camera permission
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      if (cameraPermission.status !== 'granted') {
        Alert.alert(
          'Camera Permission Required',
          'Please allow camera access to take photos.',
          [{ text: 'OK' }]
        );
        return false;
      }

      // Request media library permission
      const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (libraryPermission.status !== 'granted') {
        Alert.alert(
          'Photo Library Permission Required',
          'Please allow photo library access to select photos.',
          [{ text: 'OK' }]
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error('PhotoUpload: Permission request failed:', error);
      Alert.alert(
        'Permission Error',
        'Failed to request permissions. Please try again.',
        [{ text: 'OK' }]
      );
      return false;
    }
  };

  const pickImage = async (useCamera: boolean = false) => {
    try {
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) return;

      setShowModal(false);

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: 'images',
        allowsEditing: false,
        quality: 0.8, // Slightly compress to reduce upload time
        exif: true, // Include EXIF data
      };

      let result;
      if (useCamera) {
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        await uploadPhoto(asset.uri, asset.fileName || 'photo.jpg');
      }
    } catch (error) {
      console.error('PhotoUpload: Image picker failed:', error);
      setShowModal(false);
      Alert.alert(
        'Image Selection Error',
        'Failed to select image. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const uploadPhoto = async (uri: string, filename: string) => {
    setUploading(true);
    setUploadProgress(null);

    try {
      console.log(`[PhotoUpload] Starting upload of ${filename} from ${uri}`);
      
      const response = await uploadAPI.uploadPhoto(
        uri,
        filename,
        (progress) => {
          console.log(`[PhotoUpload] Upload progress: ${progress.percentage}%`);
          setUploadProgress(progress);
        }
      );

      console.log('[PhotoUpload] Upload completed successfully:', response);

      if (response.duplicate) {
        Alert.alert(
          'Photo Already Exists',
          response.message || 'This photo is already in your library.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Upload Successful',
          `Photo uploaded and processed successfully!\n\nFaces detected: ${response.processing?.faceCount || 0}\nObjects detected: ${response.processing?.objectCount || 0}`,
          [{ text: 'OK' }]
        );
      }

      onUploadComplete?.(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      console.error('[PhotoUpload] Upload failed:', error);
      
      Alert.alert(
        'Upload Failed',
        errorMessage,
        [{ text: 'OK' }]
      );
      
      onUploadError?.(errorMessage);
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const showUploadOptions = () => {
    setShowModal(true);
  };

  if (uploading) {
    return (
      <View style={styles.uploadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.uploadingText}>Uploading photo...</Text>
        {uploadProgress && (
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              {uploadProgress.percentage}% ({Math.round(uploadProgress.loaded / 1024)}KB / {Math.round(uploadProgress.total / 1024)}KB)
            </Text>
            {Platform.OS === 'android' && (
              <ProgressBarAndroid
                styleAttr="Horizontal"
                indeterminate={false}
                progress={uploadProgress.percentage / 100}
                color="#007AFF"
                style={styles.progressBar}
              />
            )}
            {Platform.OS === 'ios' && (
              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBarFill, { width: `${uploadProgress.percentage}%` }]} />
              </View>
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Two buttons for direct access within menu */}
      <TouchableOpacity style={styles.menuButton} onPress={() => pickImage(true)}>
        <Ionicons name="camera" size={20} color="#007AFF" />
        <Text style={styles.menuButtonText}>Take Photo</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuButton} onPress={() => pickImage(false)}>
        <Ionicons name="images" size={20} color="#007AFF" />
        <Text style={styles.menuButtonText}>Choose from Library</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#007AFF',
    gap: 12,
  },
  menuButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  uploadingContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    margin: 16,
  },
  uploadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  progressContainer: {
    marginTop: 16,
    width: '100%',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  progressBar: {
    width: '100%',
    height: 4,
  },
  progressBarContainer: {
    width: '100%',
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 34, // Account for home indicator on iOS
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 12,
    gap: 12,
  },
  modalOptionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  modalCancel: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#e9ecef',
    borderRadius: 8,
    marginTop: 8,
  },
  modalCancelText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
});