import React, { useState, useEffect } from 'react';
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
const albumItemWidth = (screenWidth - 30) / 2; // 2 columns with margins

interface Album {
  id: number;
  name: string;
  slug: string;
  description?: string;
  source: string;
  album_date?: string;
  image_count: number;
  actual_image_count: number;
  cover_image_hash?: string;
}

interface AlbumsResponse {
  albums: Album[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface AlbumsScreenProps {
  onAlbumSelect: (album: Album) => void;
  onClose: () => void;
}

export const AlbumsScreen: React.FC<AlbumsScreenProps> = ({ onAlbumSelect, onClose }) => {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlbums = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await fetch(`${API_BASE}/api/albums?limit=50`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch albums: ${response.status}`);
      }

      const data: AlbumsResponse = await response.json();
      setAlbums(data.albums);
    } catch (err) {
      console.error('Error fetching albums:', err);
      setError(err instanceof Error ? err.message : 'Failed to load albums');
      Alert.alert('Error', 'Failed to load albums. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAlbums();
  }, []);

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
      month: 'short',
      day: 'numeric',
    });
  };

  const getCoverImageUrl = (album: Album) => {
    // If album has a cover image hash, use it
    if (album.cover_image_hash) {
      return `${API_BASE}/media/${album.cover_image_hash}?thumb=1`;
    }
    
    // For albums with images but no cover set, we could fetch the first image
    // For now, return null and show placeholder
    return null;
  };

  // Function to fetch first image from album for preview
  const getAlbumPreviewUrl = async (albumId: number): Promise<string | null> => {
    try {
      const response = await fetch(`${API_BASE}/api/albums/${albumId}?limit=1`);
      if (response.ok) {
        const data = await response.json();
        if (data.images && data.images.length > 0) {
          const firstImage = data.images[0];
          // Construct thumbnail URL from relative_media_path
          if (firstImage.relative_media_path && typeof firstImage.relative_media_path === 'string') {
            const previewUrl = `${API_BASE}/media/${firstImage.relative_media_path}?thumb=1`;
            console.log('Generated preview URL:', previewUrl);
            return previewUrl;
          }
        }
      }
    } catch (error) {
      console.log('Error fetching album preview:', error);
    }
    return null;
  };

  // Component for album item with dynamic preview loading
  const AlbumItem = ({ item }: { item: Album }) => {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    
    const coverImageUrl = getCoverImageUrl(item);
    
    // Load preview image if no cover image and album has images
    useEffect(() => {
      if (!coverImageUrl && item.actual_image_count > 0 && !loadingPreview) {
        setLoadingPreview(true);
        getAlbumPreviewUrl(item.id).then((url) => {
          setPreviewUrl(url);
          setLoadingPreview(false);
        });
      }
    }, [item.id, coverImageUrl, item.actual_image_count]);
    
    const imageUrl = coverImageUrl || previewUrl;
    
    return (
      <TouchableOpacity
        style={styles.albumItem}
        onPress={() => onAlbumSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.albumImageContainer}>
          {imageUrl && imageUrl.startsWith('http') ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.albumImage}
              contentFit="cover"
              placeholder="blur"
              placeholderContentFit="cover"
              onError={() => {
                console.log('Album image failed to load:', imageUrl);
                setPreviewUrl(null);
              }}
            />
          ) : (
            <View style={[styles.albumImage, styles.albumImagePlaceholder]}>
              <Text style={styles.albumImagePlaceholderText}>📁</Text>
              {loadingPreview && (
                <ActivityIndicator 
                  size="small" 
                  color="#666" 
                  style={styles.albumPreviewLoader}
                />
              )}
            </View>
          )}
          <View style={styles.albumImageOverlay}>
            <Text style={styles.albumImageCount}>{String(item.actual_image_count || 0)}</Text>
          </View>
        </View>
        
        <View style={styles.albumInfo}>
          <Text style={styles.albumName} numberOfLines={2}>
            {formatAlbumName(item.name)}
          </Text>
          
          {item.album_date && (
            <Text style={styles.albumDate}>
              {formatDate(item.album_date)}
            </Text>
          )}
          
          <Text style={styles.albumSource}>
            {item.source === 'google_takeout' ? 'Google Photos' : item.source}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderAlbumItem = ({ item }: { item: Album }) => {
    return <AlbumItem item={item} />;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Albums</Text>
          <View style={styles.closeButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading albums...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Albums</Text>
        <View style={styles.closeButton} />
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => fetchAlbums()} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={albums}
          renderItem={renderAlbumItem}
          keyExtractor={(item) => item.id.toString()}
          numColumns={2}
          contentContainerStyle={styles.albumsList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchAlbums(true)}
              colors={['#007AFF']}
            />
          }
        />
      )}
      
      {albums.length > 0 && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {albums.length} album{albums.length !== 1 ? 's' : ''}
          </Text>
        </View>
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
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  albumsList: {
    padding: 10,
  },
  albumItem: {
    width: albumItemWidth,
    marginHorizontal: 5,
    marginVertical: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  albumImageContainer: {
    position: 'relative',
  },
  albumImage: {
    width: '100%',
    height: albumItemWidth * 0.7,
    backgroundColor: '#333',
  },
  albumImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumImagePlaceholderText: {
    fontSize: 32,
    opacity: 0.5,
  },
  albumPreviewLoader: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  albumImageOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  albumImageCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  albumInfo: {
    padding: 12,
  },
  albumName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 18,
  },
  albumDate: {
    color: '#999',
    fontSize: 12,
    marginBottom: 2,
  },
  albumSource: {
    color: '#666',
    fontSize: 11,
    fontStyle: 'italic',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
    backgroundColor: '#1a1a1a',
  },
  footerText: {
    color: '#999',
    fontSize: 12,
    textAlign: 'center',
  },
});