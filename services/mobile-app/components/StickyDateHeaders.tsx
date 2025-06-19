import React, { useMemo } from 'react';
import { 
  View, 
  Text, 
  SectionList, 
  StyleSheet, 
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { Image } from 'expo-image';

// Calculate grid dimensions
const screenWidth = Dimensions.get('window').width;
const numColumns = 3;
const photoSize = (screenWidth - (numColumns + 1) * 2) / numColumns; // 2px margin

interface MediaItem {
  id: number;
  filename: string;
  date_taken: string | null;
  media_url: string;
  thumbnail_url?: string;
  dominant_color?: string;
  faces?: any[];
  objects?: any[];
}

interface PhotoSection {
  title: string;
  data: MediaItem[][];  // Array of rows, each row contains numColumns items
}

interface StickyDateHeadersProps {
  photos: MediaItem[];
  failedImages: Set<number>;
  loadingMore: boolean;
  refreshing: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onRefresh: () => void;
  onPhotoPress: (photo: MediaItem) => void;
  renderFooter: () => React.ReactElement | null;
  ListEmptyComponent: React.ReactElement;
  API_BASE: string;
  loadingImagesRef: React.MutableRefObject<Set<number>>;
  onImageLoadStart: (id: number) => void;
  onImageLoad: (id: number) => void;
  onImageError: (photo: MediaItem, url: string) => void;
}

export const StickyDateHeaders: React.FC<StickyDateHeadersProps> = ({
  photos,
  failedImages,
  loadingMore,
  refreshing,
  hasMore,
  onLoadMore,
  onRefresh,
  onPhotoPress,
  renderFooter,
  ListEmptyComponent,
  API_BASE,
  loadingImagesRef,
  onImageLoadStart,
  onImageLoad,
  onImageError
}) => {
  // Group photos by month/year and prepare grid layout
  const sections = useMemo(() => {
    // Group photos by month/year
    const grouped = photos.reduce((acc, photo) => {
      if (failedImages.has(photo.id)) return acc;
      
      // Use date_taken if available, otherwise fall back to filename date or processed date
      let dateStr = photo.date_taken;
      if (!dateStr) {
        // Try to extract date from filename format: 2024-10-27_13-43-15_IMG_8715.JPG
        const filenameMatch = photo.filename.match(/^(\d{4}-\d{2}-\d{2})/);
        if (filenameMatch) {
          dateStr = filenameMatch[1] + 'T00:00:00.000Z';
        } else {
          // Skip photos without dates for now
          return acc;
        }
      }
      
      const date = new Date(dateStr);
      const monthYear = date.toLocaleDateString('en-US', { 
        month: 'long', 
        year: 'numeric' 
      });
      
      if (!acc[monthYear]) {
        acc[monthYear] = [];
      }
      acc[monthYear].push(photo);
      
      return acc;
    }, {} as Record<string, MediaItem[]>);
    
    // Convert to sections with grid layout
    const sectionsArray: PhotoSection[] = Object.entries(grouped)
      .sort((a, b) => {
        // Sort by date descending (newest first)
        const dateA = new Date(a[1][0].dateTaken);
        const dateB = new Date(b[1][0].dateTaken);
        return dateB.getTime() - dateA.getTime();
      })
      .map(([title, photos]) => {
        // Group photos into rows of numColumns
        const rows: MediaItem[][] = [];
        for (let i = 0; i < photos.length; i += numColumns) {
          rows.push(photos.slice(i, i + numColumns));
        }
        
        return {
          title,
          data: rows
        };
      });
    
    return sectionsArray;
  }, [photos, failedImages]);

  // Render individual photo
  const renderPhoto = (photo: MediaItem) => {
    const imageUrl = `${API_BASE}${photo.thumbnail_url || photo.media_url}`;
    const backgroundColor = photo.dominant_color || '#222';
    const isLoading = loadingImagesRef.current.has(photo.id);
    const hasFailed = failedImages.has(photo.id);
    
    if (hasFailed) {
      return (
        <View key={photo.id} style={[styles.photoItem, styles.errorPhotoItem, { backgroundColor }]}>
          <Text style={styles.errorPhotoText}>❌</Text>
          <Text style={styles.errorPhotoFilename}>{photo.filename.slice(0, 15)}...</Text>
        </View>
      );
    }
    
    // Check if URL is valid before rendering
    if (!imageUrl || imageUrl.includes('undefined')) {
      return (
        <View key={photo.id} style={[styles.photoItem, styles.errorPhotoItem, { backgroundColor }]}>
          <Text style={styles.errorPhotoText}>⚠️</Text>
        </View>
      );
    }
    
    return (
      <TouchableOpacity 
        key={photo.id}
        style={[styles.photoItem, { backgroundColor }]}
        onPress={() => onPhotoPress(photo)}
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
          transition={100}
          cachePolicy="memory-disk"
          priority="normal"
          allowDownscaling={true}
          onLoad={() => onImageLoad(photo.id)}
          onLoadStart={() => onImageLoadStart(photo.id)}
          onError={() => onImageError(photo, imageUrl)}
        />
      </TouchableOpacity>
    );
  };

  // Render row of photos
  const renderRow = ({ item: row }: { item: MediaItem[] }) => {
    return (
      <View style={styles.row}>
        {row.map(photo => renderPhoto(photo))}
        {/* Fill empty spaces in the last row */}
        {row.length < numColumns && 
          Array(numColumns - row.length).fill(null).map((_, index) => (
            <View key={`empty-${index}`} style={styles.emptyPhotoItem} />
          ))
        }
      </View>
    );
  };

  // Render section header
  const renderSectionHeader = ({ section }: { section: PhotoSection }) => {
    const photoCount = section.data.reduce((sum, row) => sum + row.length, 0);
    
    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{section.title}</Text>
        <Text style={styles.sectionHeaderCount}>{photoCount} photos</Text>
      </View>
    );
  };

  return (
    <SectionList
      sections={sections}
      renderItem={renderRow}
      renderSectionHeader={renderSectionHeader}
      keyExtractor={(item, index) => `row-${index}-${item[0]?.id || 'empty'}`}
      
      // Sticky headers
      stickySectionHeadersEnabled={true}
      
      // Infinite scroll
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.5}
      
      // Pull to refresh
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#0066CC"
        />
      }
      
      // Performance optimizations
      removeClippedSubviews={false}
      maxToRenderPerBatch={4} // Render 4 rows at a time
      initialNumToRender={8} // Show 8 rows initially
      windowSize={10}
      updateCellsBatchingPeriod={100}
      showsVerticalScrollIndicator={false}
      
      // Footer and empty state
      ListFooterComponent={renderFooter}
      ListEmptyComponent={ListEmptyComponent}
      
      // Content styling
      contentContainerStyle={styles.contentContainer}
    />
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    paddingBottom: 20,
  },
  sectionHeader: {
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  sectionHeaderText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  sectionHeaderCount: {
    color: '#999',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 1,
  },
  photoItem: {
    margin: 1,
    width: photoSize,
    height: photoSize,
  },
  emptyPhotoItem: {
    margin: 1,
    width: photoSize,
    height: photoSize,
  },
  gridPhoto: {
    width: photoSize,
    height: photoSize,
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
  loadingOverlay: {
    position: 'absolute',
    width: photoSize,
    height: photoSize,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
});