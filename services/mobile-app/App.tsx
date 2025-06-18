import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, SafeAreaView, FlatList, ActivityIndicator, Dimensions, RefreshControl, TouchableOpacity, Modal } from 'react-native';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Image } from 'expo-image';
import { PhotoDetailScreen } from './screens/PhotoDetailScreen';
import { SimplePhotoDetailScreen } from './screens/SimplePhotoDetailScreen';
import { BasicImageTest } from './screens/BasicImageTest';
import { NativeImageTest } from './screens/NativeImageTest';

// Try wireless IP - your Linux machine has two network interfaces
const API_BASE = 'http://192.168.40.103:9000';

// Calculate grid dimensions
const screenWidth = Dimensions.get('window').width;
const numColumns = 3;
const photoSize = (screenWidth - (numColumns + 1) * 2) / numColumns; // 2px margin

interface MediaItem {
  id: number;
  filename: string;
  dateTaken: string;
  media_url: string;
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

export default function App() {
  const [photos, setPhotos] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<MediaItem | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  
  // Debounce ref to prevent multiple requests
  const isLoadingMore = useRef(false);

  // Use ref for cursor to avoid stale closure
  const cursorRef = useRef<string | null>(null);
  
  // Track failed images to filter them out
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());
  const failedImagesLog = useRef<Array<{filename: string, url: string, timestamp: string}>>([]);
  
  // Track loading images
  const [loadingImages, setLoadingImages] = useState<Set<number>>(new Set());
  
  // Filter out failed images from the photos array
  const visiblePhotos = photos.filter(photo => !failedImages.has(photo.id));
  
  const fetchPhotos = useCallback(async (reset: boolean = false) => {
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
      const url = `${API_BASE}/api/gallery?limit=${limit}${cursorParam}`;
      
      console.log('Fetching photos:', { reset, cursor: currentCursor, url });
      const response = await fetch(url);
      
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
        setPhotos(data.images);
      } else {
        setPhotos(prev => {
          const newPhotos = [...prev, ...data.images];
          console.log(`Total photos after load: ${newPhotos.length}`);
          return newPhotos;
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
  }, []);

  // Initial load
  useEffect(() => {
    fetchPhotos(true);
  }, []);

  // Handle load more when approaching end of list
  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore && !isLoadingMore.current) {
      console.log('Loading more photos...');
      fetchPhotos(false);
    }
  }, [loadingMore, hasMore, fetchPhotos]);

  // Pull to refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setCursor(null);
    cursorRef.current = null;
    fetchPhotos(true);
  }, [fetchPhotos]);

  // Render individual photo item
  const renderPhoto = ({ item }: { item: MediaItem }) => {
    try {
      // Use thumbnail URL for better performance in grid view
      const imageUrl = `${API_BASE}${item.thumbnail_url || item.media_url}`;
      const hasFailed = failedImages.has(item.id);
      const isLoading = loadingImages.has(item.id);
      
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
              setLoadingImages(prev => {
                const newSet = new Set(prev);
                newSet.delete(item.id);
                return newSet;
              });
            }}
            onLoadStart={() => {
              setLoadingImages(prev => new Set(prev).add(item.id));
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
              setLoadingImages(prev => {
                const newSet = new Set(prev);
                newSet.delete(item.id);
                return newSet;
              });
              
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
  };

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
        <Text style={styles.headerTitle}>Photos</Text>
        <Text style={styles.headerSubtitle}>
          {totalCount > 0 ? `${totalCount} photos` : `${visiblePhotos.length} photos`}
        </Text>
      </View>
      
      <FlatList
        data={visiblePhotos}
        renderItem={renderPhoto}
        keyExtractor={(item) => item.id.toString()}
        numColumns={numColumns}
        contentContainerStyle={styles.gridContainer}
        
        // Infinite scroll
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5} // Load more when 50% from bottom
        
        // Pull to refresh
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#0066CC"
          />
        }
        
        // Performance optimizations - keep more items mounted to prevent reloading
        removeClippedSubviews={false} // Keep images loaded when off-screen
        maxToRenderPerBatch={6} // Reasonable batch size
        initialNumToRender={12} // Load more initially
        windowSize={10} // Much larger window to keep images mounted
        updateCellsBatchingPeriod={100} // Increased for smoother updates
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
        }}
        // Disable scroll indicators for performance
        showsVerticalScrollIndicator={false}
        // Use native driver for better performance
        scrollEventThrottle={16}
        
        // Footer loading indicator
        ListFooterComponent={renderFooter}
        
        // Empty state
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No photos found</Text>
            <Text style={styles.emptySubtext}>Pull down to refresh</Text>
          </View>
        }
      />
      
      <StatusBar style="light" />
    </SafeAreaView>
    
    {/* Photo Detail Modal - Full Screen */}
    <Modal
      visible={!!selectedPhoto}
      animationType="slide"
      presentationStyle="fullScreen"
    >
      {selectedPhoto && (
        <PhotoDetailScreen
          imageId={selectedPhoto.id}
          imageUrl={selectedPhoto.media_url}
          filename={selectedPhoto.filename}
          onClose={() => setSelectedPhoto(null)}
        />
      )}
    </Modal>
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
    padding: 16,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
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
