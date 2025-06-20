import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Image } from 'expo-image';
import { API_BASE } from '../config';

const screenWidth = Dimensions.get('window').width;
const numColumns = 3;
const photoSize = (screenWidth - (numColumns + 1) * 2) / numColumns;

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

interface AlbumDetailResponse {
  album: Album;
  images: MediaItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface AlbumDetailScreenProps {
  album: Album;
  onClose: () => void;
  onPhotoSelect: (photo: MediaItem) => void;
}

export const AlbumDetailScreen: React.FC<AlbumDetailScreenProps> = ({
  album,
  onClose,
  onPhotoSelect,
}) => {
  const [albumData, setAlbumData] = useState<Album>(album);
  const [photos, setPhotos] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());

  const fetchAlbumDetails = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await fetch(`${API_BASE}/api/albums/${album.id}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch album: ${response.status}`);
      }

      const data: AlbumDetailResponse = await response.json();
      setAlbumData(data.album);
      setPhotos(data.images);
    } catch (err) {
      console.error('Error fetching album details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load album');
      Alert.alert('Error', 'Failed to load album. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAlbumDetails();
  }, [album.id]);

  const formatAlbumName = (name: string) => {
    return name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleImageError = (photoId: number) => {
    setFailedImages(prev => new Set([...prev, photoId]));
  };

  const visiblePhotos = useMemo(() => 
    photos.filter(photo => !failedImages.has(photo.id)), 
    [photos, failedImages]
  );

  const renderPhotoItem = ({ item }: { item: MediaItem }) => {
    // Construct URL from relative_media_path if media_url is not available
    const getImageUrl = (item: MediaItem, thumbnail: boolean = true) => {
      if (item.thumbnail_url && thumbnail) return `${API_BASE}${item.thumbnail_url}`;
      if (item.media_url) return `${API_BASE}${item.media_url}`;
      
      // Fallback: construct from relative_media_path
      const relativePath = (item as any).relative_media_path;
      if (relativePath) {
        const baseUrl = `${API_BASE}/media/${relativePath}`;
        return thumbnail ? `${baseUrl}?thumb=1` : baseUrl;
      }
      
      return null;
    };

    // Get relative URL (for PhotoDetailScreen which expects relative paths)
    const getRelativeImageUrl = (item: MediaItem, thumbnail: boolean = true) => {
      if (item.thumbnail_url && thumbnail) return item.thumbnail_url;
      if (item.media_url && !thumbnail) return item.media_url;
      
      // Fallback: construct from relative_media_path
      const relativePath = (item as any).relative_media_path;
      if (relativePath) {
        const baseUrl = `/media/${relativePath}`;
        return thumbnail ? `${baseUrl}?thumb=1` : baseUrl;
      }
      
      return null;
    };
    
    const imageUrl = getImageUrl(item, true);
    const backgroundColor = item.dominant_color || '#333';

    if (!imageUrl || !imageUrl.startsWith('http')) {
      return (
        <View style={[styles.photoItem, styles.errorPhotoItem, { backgroundColor }]}>
          <Text style={styles.errorPhotoText}>⚠️</Text>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.photoItem, { backgroundColor }]}
        onPress={() => {
          // Add relative URLs for photo detail screen (PhotoDetailScreen adds API_BASE internally)
          const itemWithUrl = {
            ...item,
            media_url: item.media_url || getRelativeImageUrl(item, false) || '',
            thumbnail_url: item.thumbnail_url || getRelativeImageUrl(item, true) || ''
          };
          onPhotoSelect(itemWithUrl);
        }}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: imageUrl }}
          style={styles.photoImage}
          contentFit="cover"
          onError={() => handleImageError(item.id)}
          placeholder="blur"
          placeholderContentFit="cover"
        />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Text style={styles.backButtonText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {formatAlbumName(album.name)}
          </Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading album...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {formatAlbumName(albumData.name)}
        </Text>
        <View style={styles.backButton} />
      </View>

      {albumData.album_date && (
        <View style={styles.albumMeta}>
          <Text style={styles.albumDate}>
            {formatDate(albumData.album_date)}
          </Text>
          <Text style={styles.albumCount}>
            {albumData.actual_image_count} photo{albumData.actual_image_count !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => fetchAlbumDetails()} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : visiblePhotos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No photos in this album</Text>
        </View>
      ) : (
        <FlatList
          data={visiblePhotos}
          renderItem={renderPhotoItem}
          keyExtractor={(item) => item.id.toString()}
          numColumns={numColumns}
          contentContainerStyle={styles.photosList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchAlbumDetails(true)}
              colors={['#007AFF']}
            />
          }
        />
      )}
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
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  albumMeta: {
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    alignItems: 'center',
  },
  albumDate: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  albumCount: {
    color: '#999',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#999',
    fontSize: 16,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
  },
  photosList: {
    padding: 2,
  },
  photoItem: {
    width: photoSize,
    height: photoSize,
    margin: 1,
    borderRadius: 2,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  errorPhotoItem: {
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorPhotoText: {
    fontSize: 24,
    opacity: 0.5,
  },
});