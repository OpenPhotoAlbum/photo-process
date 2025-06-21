import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    ActivityIndicator,
    View,
    Text,
    SafeAreaView,
    FlatList,
    TouchableOpacity,
    Dimensions,
    RefreshControl
} from 'react-native';
import { Image } from 'expo-image';
import { SlideOutMenu } from '../../components/SlideOutMenu';
import { StickyDateHeaders } from '../../components/StickyDateHeaders';
import { FilterPanel } from '../../components/FilterPanel';
import { useFetchPhotos } from '../../hooks';
import { MediaItem, FilterOptions } from '../../types';
import { API_BASE } from '../../config';
import { styles } from './Gallery.styles';

// Calculate grid dimensions
const screenWidth = Dimensions.get('window').width;
const numColumns = 3;
const photoSize = (screenWidth - (numColumns + 1) * 2) / numColumns; // 2px margin

interface GalleryProps {
  onPhotoSelect: (photo: MediaItem, context: 'gallery', photos?: MediaItem[], index?: number) => void;
  onShowAlbums: () => void;
  onShowFaces: () => void;
  onShowAutoUploadSettings: () => void;
  onShowDebugPanel: () => void;
}

export const Gallery: React.FC<GalleryProps> = ({
  onPhotoSelect,
  onShowAlbums,
  onShowFaces,
  onShowAutoUploadSettings,
  onShowDebugPanel
}) => {
  // Use the shared photo fetching hook
  const {
    photos,
    loading,
    loadingMore,
    refreshing,
    error,
    hasMore,
    totalCount,
    failedImages,
    fetchPhotos,
    loadMore,
    refresh,
    setFilters,
    markImageAsFailed,
    clearFailedImages
  } = useFetchPhotos({
    pageSize: 24,
    autoLoad: true,
    initialFilters: {
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
    }
  });

  // Gallery-specific state
  const [showSlideMenu, setShowSlideMenu] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  
  // Local filters state for the FilterPanel
  const [currentFilters, setCurrentFilters] = useState<FilterOptions>({
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
  
  // Failed images tracking (for UI purposes)
  const failedImagesLog = useRef<Array<{filename: string, url: string, timestamp: string}>>([]);
  
  // Track loading images with ref to avoid stale state issues
  const loadingImagesRef = useRef<Set<number>>(new Set());
  
  // Filter out failed images from the photos array
  const visiblePhotos = useMemo(() => 
    photos.filter(photo => !failedImages.has(photo.id)), 
    [photos, failedImages]
  );

  // Debug showFilterPanel state changes
  useEffect(() => {
    console.log('showFilterPanel state changed to:', showFilterPanel);
  }, [showFilterPanel]);

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

  // Load cities on mount
  useEffect(() => {
    fetchAvailableCities();
  }, [fetchAvailableCities]);

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: FilterOptions) => {
    setCurrentFilters(newFilters);
    setFilters(newFilters); // Update the hook's filters
  }, [setFilters]);


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
          <View style={[styles.photoContainer, { backgroundColor }]}>
            <Text style={styles.errorText}>Failed to load</Text>
          </View>
        );
      }

      return (
        <TouchableOpacity
          style={[styles.photoContainer, { backgroundColor }]}
          onPress={() => onPhotoSelect(item, 'gallery')}
          activeOpacity={0.8}
        >
          <Image
            source={{ uri: imageUrl }}
            style={styles.photo}
            contentFit="cover"
            transition={100}
            cachePolicy="memory-disk"
            priority="normal"
            allowDownscaling={true}
            onLoadStart={() => {
              loadingImagesRef.current.add(item.id);
            }}
            onLoad={() => {
              loadingImagesRef.current.delete(item.id);
            }}
            onError={() => {
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
              markImageAsFailed(item.id);
            }}
          />
        </TouchableOpacity>
      );
    } catch (error) {
      console.error('Error rendering photo:', error);
      return (
        <View style={[styles.photoContainer, { backgroundColor: '#222' }]}>
          <Text style={styles.errorText}>Render Error</Text>
        </View>
      );
    }
  }, [failedImages, onPhotoSelect, markImageAsFailed]);


  // Show loading state
  if (loading && photos.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0066CC" />
        <Text style={styles.loadingText}>Loading photos...</Text>
      </View>
    );
  }

  // Show error state
  if (error && photos.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity onPress={() => refresh()} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => setShowSlideMenu(true)}>
            <Text style={styles.menuText}>☰</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={() => {
              console.log('Filter button pressed, setting showFilterPanel to true');
              setShowFilterPanel(true);
            }}
          >
            <Text style={styles.filterButtonText}>Filter</Text>
          </TouchableOpacity>
          
          <Text style={styles.countText}>
            {totalCount || photos.length}
          </Text>
        </View>
      </View>

      {/* Photo Grid */}
      <StickyDateHeaders
        photos={visiblePhotos}
        failedImages={failedImages}
        loadingMore={loadingMore}
        refreshing={refreshing}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onRefresh={refresh}
        onPhotoPress={(photo: MediaItem) => {
          const photoIndex = visiblePhotos.findIndex(p => p.id === photo.id);
          onPhotoSelect(photo, 'gallery', visiblePhotos, photoIndex);
        }}
        renderFooter={() => null}
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
          markImageAsFailed(photo.id);
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No photos found</Text>
            <Text style={styles.emptySubtext}>
              Upload some photos to get started!
            </Text>
          </View>
        }
      />

      {/* Slide Out Menu */}
      <SlideOutMenu
        isVisible={showSlideMenu}
        onClose={() => setShowSlideMenu(false)}
        onAutoUploadPress={() => {
          setShowSlideMenu(false);
          onShowAutoUploadSettings();
        }}
        onDebugPress={() => {
          setShowSlideMenu(false);
          onShowDebugPanel();
        }}
        onFilterPress={() => {
          setShowSlideMenu(false);
          setShowFilterPanel(true);
        }}
      />


      {/* Filter Panel Modal */}
      <FilterPanel
        visible={showFilterPanel}
        onClose={() => {
          console.log('FilterPanel onClose called');
          setShowFilterPanel(false);
        }}
        filters={currentFilters}
        onFiltersChange={handleFiltersChange}
        availableCities={availableCities}
        onCitySearch={fetchAvailableCities}
      />

      {/* Footer Navigation */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.footerButton}
          onPress={() => onShowAlbums()}
        >
          <Text style={styles.footerButtonText}>📁 Albums</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.footerButton}
          onPress={() => onShowFaces()}
        >
          <Text style={styles.footerButtonText}>👥 Faces</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};
