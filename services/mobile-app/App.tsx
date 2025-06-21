import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, SafeAreaView, Modal } from 'react-native';
import React, { useState, useEffect, useCallback } from 'react';
import { PhotoDetailScreen } from './screens/PhotoDetailScreen';
import { DebugPanel, debugLogger } from './components/DebugPanel';
import { autoUploadService } from './services/AutoUploadService';
import { AutoUploadSettingsScreen } from './screens/AutoUploadSettingsScreen';
import { AlbumsScreen } from './screens/AlbumsScreen';
import { AlbumDetailScreen } from './screens/AlbumDetailScreen';
import { FacesScreen } from './screens/FacesScreen';
import { ModalLayers } from './constants/ModalLayers';
import { MediaItem, Album } from './types';
import { Gallery } from './views';

export default function App() {
  // Navigation and modal state
  const [selectedPhoto, setSelectedPhoto] = useState<MediaItem | null>(null);
  const [photoDetailContext, setPhotoDetailContext] = useState<'gallery' | 'album' | 'faces' | null>(null);
  const [albumBeforePhoto, setAlbumBeforePhoto] = useState<Album | null>(null);
  const [personBeforePhoto, setPersonBeforePhoto] = useState<any | null>(null);
  const [showAutoUploadSettings, setShowAutoUploadSettings] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [showAlbums, setShowAlbums] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [showFaces, setShowFaces] = useState(false);
  
  // Debug auto-upload state changes
  useEffect(() => {
    console.log('App: showAutoUploadSettings changed to:', showAutoUploadSettings);
  }, [showAutoUploadSettings]);
  
  // Auto-upload initialization
  useEffect(() => {
    // Initialize auto-upload service
    autoUploadService.initialize().then((initialized) => {
      if (initialized) {
        console.log('Auto-upload service initialized successfully');
        // Check if auto-upload is enabled and start monitoring
        autoUploadService.getSettings().then((settings) => {
          if (settings.enabled) {
            autoUploadService.startMonitoring();
          }
        });
      } else {
        console.log('Auto-upload service initialization failed');
      }
    });
  }, []);
  
  return (
    <>
    <SafeAreaView style={styles.container}>
      {/* Main Gallery View */}
      <Gallery
        onPhotoSelect={(photo, context) => {
          setSelectedPhoto(photo);
          setPhotoDetailContext(context);
        }}
        onShowAlbums={() => setShowAlbums(true)}
        onShowFaces={() => setShowFaces(true)}
        onShowAutoUploadSettings={() => setShowAutoUploadSettings(true)}
        onShowDebugPanel={() => setShowDebugPanel(true)}
      />
    </SafeAreaView>

    {/* Modal Stack */}
    {/* Single Modal Manager - Photo Detail has highest priority */}
    {selectedPhoto && (
      <Modal
        visible={true}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent={true}
      >
        <PhotoDetailScreen
          imageId={selectedPhoto.id}
          imageUrl={selectedPhoto.relative_media_path || selectedPhoto.media_url}
          filename={selectedPhoto.filename}
          onClose={() => {
            const photo = selectedPhoto; // Capture for closure
            setSelectedPhoto(null);
            // Navigate back to the context where photo was opened from
            if (photoDetailContext === 'album' && albumBeforePhoto) {
              setSelectedAlbum(albumBeforePhoto);
              setAlbumBeforePhoto(null);
            } else if (photoDetailContext === 'faces') {
              // Don't need to setShowFaces(true) - it's already open underneath
              // Just closing the photo detail will reveal the faces screen
            } else {
              // Clear person context if returning to gallery
              setPersonBeforePhoto(null);
            }
            setPhotoDetailContext(null);
          }}
          onDelete={() => {
            // Gallery will refresh automatically via its hook
            console.log(`Photo ${selectedPhoto.filename} deleted from gallery`);
            setSelectedPhoto(null);
          }}
        />
      </Modal>
    )}

    {/* Only show other modals when photo detail is NOT active */}
    {!selectedPhoto && (
      <>
        {/* Albums Modal */}
        <Modal
          visible={showAlbums}
          animationType="slide"
          presentationStyle="fullScreen"
        >
          <AlbumsScreen
            onAlbumSelect={(album) => {
              setSelectedAlbum(album);
              setShowAlbums(false);
            }}
            onClose={() => setShowAlbums(false)}
          />
        </Modal>

        {/* Album Detail Modal */}
        <Modal
          visible={!!selectedAlbum}
          animationType="slide" 
          presentationStyle="fullScreen"
        >
          <AlbumDetailScreen
            album={selectedAlbum!}
            onClose={() => setSelectedAlbum(null)}
            onPhotoSelect={(photo) => {
              setSelectedPhoto(photo);
              setPhotoDetailContext('album');
              setAlbumBeforePhoto(selectedAlbum);
            }}
          />
        </Modal>

        {/* Faces Modal */}
        <Modal
          visible={showFaces}
          animationType="slide"
          presentationStyle="fullScreen"
        >
          <FacesScreen
            onClose={() => setShowFaces(false)}
            onSelectPhoto={(photo, person) => {
              setSelectedPhoto(photo);
              setPhotoDetailContext('faces');
              setPersonBeforePhoto(person);
            }}
          />
        </Modal>

        {/* Auto Upload Settings Modal */}
        <Modal
          visible={showAutoUploadSettings}
          animationType="slide"
          presentationStyle="fullScreen"
        >
          <AutoUploadSettingsScreen
            onClose={() => setShowAutoUploadSettings(false)}
          />
        </Modal>

        {/* Debug Panel Modal */}
        <DebugPanel
          visible={showDebugPanel}
          onClose={() => setShowDebugPanel(false)}
        />
      </>
    )}

    <StatusBar style="auto" />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});