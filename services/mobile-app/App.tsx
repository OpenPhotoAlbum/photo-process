import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, SafeAreaView, FlatList, ActivityIndicator, Dimensions, RefreshControl, TouchableOpacity, Modal } from 'react-native';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Image } from 'expo-image';
import { PhotoDetailScreen } from './screens/PhotoDetailScreen';
import { SimplePhotoDetailScreen } from './screens/SimplePhotoDetailScreen';
import { BasicImageTest } from './screens/BasicImageTest';
import { NativeImageTest } from './screens/NativeImageTest';
import { SlideOutMenu } from './components/SlideOutMenu';
import { StickyDateHeaders } from './components/StickyDateHeaders';
import { DebugPanel, debugLogger } from './components/DebugPanel';
import { FilterPanel, FilterOptions } from './components/FilterPanel';
import { UploadResponse } from './services/UploadAPI';
import { autoUploadService } from './services/AutoUploadService';
import { AutoUploadSettingsScreen } from './screens/AutoUploadSettingsScreen';
import { AlbumsScreen } from './screens/AlbumsScreen';
import { AlbumDetailScreen } from './screens/AlbumDetailScreen';
import { FacesScreen } from './screens/FacesScreen';
import { API_BASE } from './config';
import { ModalLayers } from './constants/ModalLayers';

// Calculate grid dimensions
const screenWidth = Dimensions.get('window').width;
const numColumns = 3;
const photoSize = (screenWidth - (numColumns + 1) * 2) / numColumns; // 2px margin

interface MediaItem {
  id: number;
  filename: string;
  date_taken: string | null;
  media_url: string;
  relative_media_path?: string;
  thumbnail_url?: string;
  dominant_color?: string;
  faces?: any[];
  objects?: any[];
}

interface GalleryResponse {
  images: MediaItem[];
  hasMore: boolean;
  nextCursor: string | null;
  count: number;
  totalCount: number;
}

interface Album {
  id: number;
  name: string;
  slug: string;
  description?: string;
  source: string;
  album_date?: string;
  image_count: number;
  actual_image_count: number;
}

export default function App() {
  const [photos, setPhotos] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<MediaItem | null>(null);
  const [photoDetailContext, setPhotoDetailContext] = useState<'gallery' | 'album' | 'faces' | null>(null);
  const [albumBeforePhoto, setAlbumBeforePhoto] = useState<Album | null>(null);
  const [personBeforePhoto, setPersonBeforePhoto] = useState<any | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [showAutoUploadSettings, setShowAutoUploadSettings] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [showSlideMenu, setShowSlideMenu] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  
  // Debug showFilterPanel state changes
  useEffect(() => {
    console.log('showFilterPanel state changed to:', showFilterPanel);
  }, [showFilterPanel]);
  const [showAlbums, setShowAlbums] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [showFaces, setShowFaces] = useState(false);
  const [modalStack, setModalStack] = useState<string[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({
    dateRange: {
      enabled: false,
      startDate: null,
      endDate: null
    },
    location: {
      enabled: false,
      hasGPS: null,
      selectedCities: []
    },
    user: {
      enabled: false,
      selectedUsers: []
    },
    sort: {
      field: 'date_taken',
      direction: 'desc'
    }
  });
  
  // Debug auto-upload state changes
  useEffect(() => {
    console.log('App: showAutoUploadSettings changed to:', showAutoUploadSettings);
  }, [showAutoUploadSettings]);
  
  // Debounce ref to prevent multiple requests
  const isLoadingMore = useRef(false);

  // Use ref for cursor to avoid stale closure
  const cursorRef = useRef<string | null>(null);
  
  // Track failed images to filter them out
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());
  const failedImagesLog = useRef<Array<{filename: string, url: string, timestamp: string}>>([]);
  
  // Track loading images with ref to avoid stale state issues
  const loadingImagesRef = useRef<Set<number>>(new Set());
  const [, forceUpdate] = useState({});
  
  // Filter out failed images from the photos array
  const visiblePhotos = useMemo(() => 
    photos.filter(photo => !failedImages.has(photo.id)), 
    [photos, failedImages]
  );
  
  // Fetch available cities for filter
  const fetchAvailableCities = useCallback(async (search?: string) => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      
      const url = `${API_BASE}/api/filters/cities?${params.toString()}`;
      console.log('Fetching available cities...', { search, url });
      
      const response = await fetch(url);
      console.log('Cities response status:', response.status);
      
      if (response.ok) {
        const cities = await response.json();
        console.log('Available cities loaded:', cities.length, cities.slice(0, 5));
        setAvailableCities(cities);
      } else {
        console.error('Failed to fetch cities, status:', response.status);
      }
    } catch (error) {
      console.error('Failed to fetch cities:', error);
    }
  }, []);

  const fetchPhotos = useCallback(async (reset: boolean = false, customFilters?: FilterOptions) => {
    const activeFilters = customFilters || filters;
    if (isLoadingMore.current && !reset) {
      console.log('Already loading, skipping...');
      return;
    }
    
    try {
      if (!reset) {
        isLoadingMore.current = true;
        setLoadingMore(true);
      }
      
      const limit = 24; // Increased since we're using thumbnails now
      const currentCursor = reset ? null : cursorRef.current;
      const cursorParam = currentCursor ? `&cursor=${currentCursor}` : '';
      
      // Build filter parameters
      const filterParams = new URLSearchParams();
      filterParams.set('limit', limit.toString());
      if (currentCursor) filterParams.set('cursor', currentCursor);
      
      // Add date range filter
      if (activeFilters.dateRange.enabled) {
        if (activeFilters.dateRange.startDate) {
          filterParams.set('startDate', activeFilters.dateRange.startDate.toISOString().split('T')[0]);
        }
        if (activeFilters.dateRange.endDate) {
          filterParams.set('endDate', activeFilters.dateRange.endDate.toISOString().split('T')[0]);
        }
      }
      
      // Add location filter
      if (activeFilters.location.enabled) {
        if (activeFilters.location.hasGPS !== null) {
          filterParams.set('hasGPS', activeFilters.location.hasGPS.toString());
        }
        if (activeFilters.location.selectedCities.length > 0) {
          filterParams.set('cities', activeFilters.location.selectedCities.join(','));
        }
      }
      
      // Add user filter
      if (activeFilters.user.enabled && activeFilters.user.selectedUsers.length > 0) {
        filterParams.set('users', activeFilters.user.selectedUsers.join(','));
      }
      
      // Add sort parameters
      filterParams.set('sortBy', activeFilters.sort.field);
      filterParams.set('sortOrder', activeFilters.sort.direction);
      
      const url = `${API_BASE}/api/gallery?${filterParams.toString()}`;
      
      console.log('Fetching photos:', { reset, cursor: currentCursor, url, activeFilters });
      const response = await fetch(url);
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: GalleryResponse = await response.json();
      console.log('API Response:', {
        imageCount: data.images.length,
        totalCount: data.totalCount,
        hasMore: data.hasMore,
        nextCursor: data.nextCursor,
        firstId: data.images[0]?.id
      });
      
      // Update total count from API response
      if (data.totalCount && data.totalCount !== totalCount) {
        setTotalCount(data.totalCount);
      }
      
      if (reset) {
        // When resetting (filters changed or pull-to-refresh), completely replace photos
        console.log(`Photos reset: ${data.images.length} new photos loaded`);
        setPhotos(data.images);
      } else {
        setPhotos(prev => {
          // For pagination, avoid duplicates when adding more photos
          const existingIds = new Set(prev.map(p => p.id));
          const newImages = data.images.filter(img => !existingIds.has(img.id));
          const finalPhotos = [...prev, ...newImages];
          console.log(`Total photos after load: ${finalPhotos.length} (added: ${newImages.length})`);
          return finalPhotos;
        });
      }
      
      setHasMore(data.hasMore);
      setCursor(data.nextCursor);
      cursorRef.current = data.nextCursor;
      setError(null);
      
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(`Failed to load photos: ${err.message}`);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
      isLoadingMore.current = false;
    }
  }, [filters]);

  // Initial load and auto-upload initialization
  useEffect(() => {
    fetchPhotos(true);
    fetchAvailableCities();
    
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

  // Reload photos when filters change
  useEffect(() => {
    console.log('Filters changed, reloading photos...');
    setCursor(null);
    cursorRef.current = null;
    setHasMore(true);
    setLoadingMore(true);
    isLoadingMore.current = false;
    fetchPhotos(true, filters);
  }, [filters]);

  // Handle load more when approaching end of list
  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore && !isLoadingMore.current) {
      console.log('Loading more photos with filters...', filters);
      fetchPhotos(false, filters);
    }
  }, [loadingMore, hasMore, fetchPhotos, filters]);

  // Pull to refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setCursor(null);
    cursorRef.current = null;
    fetchPhotos(true);
  }, [fetchPhotos]);

  // Handle photo upload completion
  const handleUploadComplete = useCallback((response: UploadResponse) => {
    console.log('Photo uploaded successfully:', response);
    
    if (!response.duplicate && response.imageId) {
      // Check if photo already exists to avoid duplicates
      setPhotos(prev => {
        const exists = prev.some(photo => photo.id === response.imageId);
        if (exists) {
          console.log('Photo already exists in gallery, skipping immediate add');
          return prev;
        }
        
        // Create new photo item for immediate display
        const newPhoto: MediaItem = {
          id: response.imageId!,  // We already checked it exists above
          filename: response.upload?.originalFilename || 'uploaded_photo.jpg',
          date_taken: response.upload?.uploadedAt || new Date().toISOString(),
          media_url: response.media?.url || '',
          thumbnail_url: response.media?.thumbnailUrl || '',
          dominant_color: response.processing?.dominantColor || '#333',
          faces: [], // Will be populated when we refresh
          objects: [] // Will be populated when we refresh
        };
        
        console.log('Added uploaded photo to gallery immediately:', newPhoto);
        return [newPhoto, ...prev];
      });
      
      // Update total count only if we don't already have this photo
      setTotalCount(prev => {
        const currentCount = prev || 0;
        return currentCount + 1;
      });
    }
    
    // Do a background refresh to get complete data and ensure consistency
    // Use a small delay to ensure the API has finished processing
    setTimeout(() => {
      console.log('Doing background refresh to sync complete photo data...');
      handleRefresh();
    }, 1500); // Slightly longer delay to ensure processing is complete
  }, [handleRefresh]);

  // Handle photo upload error
  const handleUploadError = useCallback((error: string) => {
    console.error('Photo upload failed:', error);
    // Error is already shown in PhotoUpload component
  }, []);

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: FilterOptions) => {
    setFilters(newFilters);
  }, []);

  // Render individual photo item
  const renderPhoto = useCallback(({ item }: { item: MediaItem }) => {
    try {
      // Use thumbnail URL for better performance in grid view
      const imageUrl = `${API_BASE}${item.thumbnail_url || item.media_url}`;
      const hasFailed = failedImages.has(item.id);
      const isLoading = loadingImagesRef.current.has(item.id);
      
      // Use dominant color as background, fallback to dark gray
      const backgroundColor = item.dominant_color || '#222';
      
      if (hasFailed) {
        return (
          <View style={[styles.photoItem, styles.errorPhotoItem, { backgroundColor }]}>
            <Text style={styles.errorPhotoText}>❌</Text>
            <Text style={styles.errorPhotoFilename}>{item.filename.slice(0, 15)}...</Text>
          </View>
        );
      }
      
      // Check if URL is valid before rendering
      if (!imageUrl || imageUrl.includes('undefined')) {
        console.log(`Invalid URL for image: ${item.filename}`);
        return (
          <View style={[styles.photoItem, styles.errorPhotoItem, { backgroundColor }]}>
            <Text style={styles.errorPhotoText}>⚠️</Text>
          </View>
        );
      }
      
      return (
        <TouchableOpacity 
          style={[styles.photoItem, { backgroundColor }]}
          onPress={() => setSelectedPhoto(item)}
          activeOpacity={0.7}
        >
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="small" color="#666" />
            </View>
          )}
          <Image 
            source={{ uri: imageUrl }}
            style={styles.gridPhoto}
            contentFit="cover"
            transition={100} // Faster transition for better perceived performance
            cachePolicy="memory-disk" // Cache images for better performance
            priority="normal" // Let React Native optimize loading order
            allowDownscaling={true} // Allow expo-image to optimize size
            onLoad={() => {
              loadingImagesRef.current.delete(item.id);
            }}
            onLoadStart={() => {
              // Only add to loading if not already loading to prevent cascade
              if (!loadingImagesRef.current.has(item.id)) {
                loadingImagesRef.current.add(item.id);
              }
            }}
            onError={(error) => {
              const timestamp = new Date().toISOString();
              const logEntry = {
                filename: item.filename,
                url: imageUrl,
                timestamp
              };
              
              // Log to console with all failed images
              failedImagesLog.current.push(logEntry);
              console.log('Failed image:', logEntry);
              console.log('All failed images:', failedImagesLog.current);
              
              // Remove from loading and mark as failed
              loadingImagesRef.current.delete(item.id);
              
              setFailedImages(prev => {
                const newSet = new Set(prev);
                newSet.add(item.id);
                return newSet;
              });
            }}
          />
        </TouchableOpacity>
      );
    } catch (error) {
      console.log(`Error rendering photo item: ${item.filename}`, error);
      return (
        <View style={[styles.photoItem, styles.errorPhotoItem]}>
          <Text style={styles.errorPhotoText}>⚠️</Text>
        </View>
      );
    }
  }, [failedImages, API_BASE]);

  // Footer component for loading indicator
  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#999" />
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0066CC" />
          <Text style={styles.statusText}>Loading photos...</Text>
        </View>
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  if (error && photos.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>❌ {error}</Text>
        <Text style={styles.helpText}>
          Make sure:
          {'\n'}• Photo server is running
          {'\n'}• Photos have been processed
          {'\n'}• Network connection is working
        </Text>
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  return (
    <>
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Photos</Text>
          <Text style={styles.headerSubtitle}>
            {totalCount > 0 ? `${totalCount} photos` : `${visiblePhotos.length} photos`}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {/* Empty space for future header buttons */}
        </View>
      </View>
      
      <StickyDateHeaders
        photos={visiblePhotos}
        failedImages={failedImages}
        loadingMore={loadingMore}
        refreshing={refreshing}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        onRefresh={handleRefresh}
        onPhotoPress={(photo) => {
          setSelectedPhoto(photo);
          setPhotoDetailContext('gallery');
        }}
        renderFooter={renderFooter}
        API_BASE={API_BASE}
        loadingImagesRef={loadingImagesRef}
        onImageLoadStart={(id) => {
          if (!loadingImagesRef.current.has(id)) {
            loadingImagesRef.current.add(id);
          }
        }}
        onImageLoad={(id) => {
          loadingImagesRef.current.delete(id);
        }}
        onImageError={(photo, url) => {
          const timestamp = new Date().toISOString();
          const logEntry = {
            filename: photo.filename,
            url: url,
            timestamp
          };
          
          // Log to console with all failed images
          failedImagesLog.current.push(logEntry);
          console.log('Failed image:', logEntry);
          console.log('All failed images:', failedImagesLog.current);
          
          // Remove from loading and mark as failed
          loadingImagesRef.current.delete(photo.id);
          
          setFailedImages(prev => {
            const newSet = new Set(prev);
            newSet.add(photo.id);
            return newSet;
          });
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No photos found</Text>
            <Text style={styles.emptySubtext}>Pull down to refresh</Text>
          </View>
        }
      />
      
      {/* Slide-out Menu */}
      <SlideOutMenu
        isVisible={showSlideMenu}
        onClose={() => setShowSlideMenu(false)}
        onUploadComplete={handleUploadComplete}
        onUploadError={handleUploadError}
        onAutoUploadPress={() => {
          console.log('Auto-upload press received in App');
          setShowAutoUploadSettings(true);
        }}
        onTrashPress={() => {
          console.log('Trash press received in App');
          // TODO: Navigate to trash view
          alert('Trash functionality coming soon! For now, you can delete photos and they\'ll be safely stored in the trash.');
        }}
        onDebugPress={() => {
          console.log('Debug press received in App');
          setShowSlideMenu(false);
          setShowDebugPanel(true);
        }}
        onFilterPress={() => {
          console.log('Filter press received in App');
          console.log('Current showFilterPanel state:', showFilterPanel);
          setShowFilterPanel(true);
          console.log('Setting showFilterPanel to true');
        }}
      />
      
      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNavBar}>
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => {/* Currently on photos tab */}}
        >
          <Text style={[styles.navIcon, styles.navIconActive]}>📷</Text>
          <Text style={[styles.navLabel, styles.navLabelActive]}>Photos</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => setShowAlbums(true)}
        >
          <Text style={styles.navIcon}>📚</Text>
          <Text style={styles.navLabel}>Albums</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => setShowFaces(true)}
        >
          <Text style={styles.navIcon}>👤</Text>
          <Text style={styles.navLabel}>Faces</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => setShowSlideMenu(true)}
        >
          <Text style={styles.navIcon}>☰</Text>
          <Text style={styles.navLabel}>Menu</Text>
        </TouchableOpacity>
      </View>
      
      <StatusBar style="light" />
    </SafeAreaView>
    

    {/* Auto-Upload Settings Overlay */}
    {showAutoUploadSettings && (
      <View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: ModalLayers.OVERLAY_SETTINGS
      }}>
        <AutoUploadSettingsScreen onClose={() => setShowAutoUploadSettings(false)} />
      </View>
    )}

    {/* Debug Panel Modal */}
    <DebugPanel
      visible={showDebugPanel}
      onClose={() => setShowDebugPanel(false)}
    />

    {/* Single Modal Manager - Photo Detail has highest priority */}
    {!!selectedPhoto && (
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
            // Remove the deleted photo from the list
            setPhotos(prev => prev.filter(p => p.id !== selectedPhoto.id));
            // Update total count
            setTotalCount(prev => Math.max(0, (prev || 0) - 1));
            console.log(`Photo ${selectedPhoto.filename} deleted from gallery`);
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
          {selectedAlbum && (
            <AlbumDetailScreen
              album={selectedAlbum}
              onClose={() => {
                // Go back to albums list instead of closing everything
                setSelectedAlbum(null);
                setShowAlbums(true);
              }}
              onPhotoSelect={(photo) => {
                setSelectedPhoto(photo);
                setPhotoDetailContext('album');
                // Save the current album before hiding it
                setAlbumBeforePhoto(selectedAlbum);
                // Temporarily hide the album while photo detail is shown
                setSelectedAlbum(null);
              }}
            />
          )}
        </Modal>

        {/* Faces Modal */}
        <Modal
          visible={showFaces}
          animationType="slide"
          presentationStyle="fullScreen"
        >
          <FacesScreen
            onClose={() => {
              setShowFaces(false);
              setPersonBeforePhoto(null); // Clear person context when closing faces
            }}
            onSelectPhoto={(photo, person) => {
              setSelectedPhoto(photo);
              setPhotoDetailContext('faces'); // Track that we came from faces
              setPersonBeforePhoto(person); // Track which person we were viewing
              // Keep faces screen open underneath - don't close it
            }}
            initialSelectedPerson={personBeforePhoto}
          />
        </Modal>

        {/* Filter Panel Modal */}
        <FilterPanel
          visible={showFilterPanel}
          onClose={() => {
            console.log('FilterPanel onClose called');
            setShowFilterPanel(false);
          }}
          filters={filters}
          onFiltersChange={handleFiltersChange}
          availableCities={availableCities}
          onCitySearch={fetchAvailableCities}
        />
      </>
    )}
  </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterButton: {
    backgroundColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  filterButtonText: {
    fontSize: 14,
  },
  bottomNavBar: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    paddingVertical: 8,
    paddingBottom: 34, // Extra padding for iPhone safe area
    borderTopWidth: 1,
    borderTopColor: '#333',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 60,
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 4,
    opacity: 0.6,
  },
  navIconActive: {
    opacity: 1,
  },
  navLabel: {
    fontSize: 10,
    color: '#999',
    fontWeight: '500',
  },
  navLabelActive: {
    color: '#007AFF',
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#999',
    fontSize: 14,
    marginTop: 4,
  },
  gridContainer: {
    paddingBottom: 20,
  },
  photoItem: {
    margin: 1,
    // backgroundColor set dynamically based on dominant_color
  },
  gridPhoto: {
    width: photoSize,
    height: photoSize,
  },
  loadingOverlay: {
    position: 'absolute',
    width: photoSize,
    height: photoSize,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  errorPhotoItem: {
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorPhotoText: {
    fontSize: 24,
    marginBottom: 4,
  },
  errorPhotoFilename: {
    color: '#666',
    fontSize: 10,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    color: '#666',
    fontSize: 18,
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#444',
    fontSize: 14,
  },
  statusText: {
    color: '#666',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 10,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 20,
  },
  helpText: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
});
