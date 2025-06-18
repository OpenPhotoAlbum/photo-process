import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
  Image,
} from 'react-native';

const API_BASE = 'http://192.168.40.103:9000';

interface MetadataProps {
  imageId: number;
}

interface ImageMetadata {
  id: number;
  filename: string;
  file_size: number;
  width: number;
  height: number;
  dominant_color: string;
  date_taken?: string;
  date_processed: string;
  is_astrophotography: boolean;
  astro_confidence?: string;
  metadata?: {
    camera_make?: string;
    camera_model?: string;
    lens_model?: string;
    focal_length?: string;
    aperture?: string;
    shutter_speed?: string;
    iso?: number;
    flash?: string;
    latitude?: string;
    longitude?: string;
    orientation?: number;
    raw_exif?: any;
  };
}

export const MetadataSection: React.FC<MetadataProps> = ({ imageId }) => {
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true); // Expanded by default

  useEffect(() => {
    loadMetadata();
  }, [imageId]);

  const loadMetadata = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE}/api/gallery/${imageId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setMetadata(data);
    } catch (err) {
      console.error('Error loading metadata:', err);
      setError(err instanceof Error ? err.message : 'Failed to load metadata');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatCoordinates = (lat?: string, lon?: string): string => {
    if (!lat || !lon) return 'Unknown';
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    const latDir = latNum >= 0 ? 'N' : 'S';
    const lonDir = lonNum >= 0 ? 'E' : 'W';
    return `${Math.abs(latNum).toFixed(4)}°${latDir}, ${Math.abs(lonNum).toFixed(4)}°${lonDir}`;
  };

  const openInMaps = (lat: string, lon: string) => {
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    
    // Always use Google Maps for consistent experience
    const url = `https://maps.google.com/maps?q=${latNum},${lonNum}`;
    
    Linking.openURL(url).catch(err => 
      console.error('Failed to open maps:', err)
    );
  };

  const getMapImageUrl = (lat: string, lon: string) => {
    // Use our API proxy to serve map images
    return `${API_BASE}/api/map?lat=${lat}&lon=${lon}`;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#666" />
          <Text style={styles.loadingText}>Loading metadata...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Failed to load metadata: {error}</Text>
      </View>
    );
  }

  if (!metadata) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No metadata available</Text>
      </View>
    );
  }

  const basicInfo = [
    { label: 'Filename', value: metadata.filename },
    { label: 'Dimensions', value: `${metadata.width} × ${metadata.height}` },
    { label: 'File Size', value: formatFileSize(metadata.file_size) },
    { label: 'Processed', value: new Date(metadata.date_processed).toLocaleDateString() },
  ];

  const cameraInfo = metadata.metadata ? [
    { label: 'Camera', value: `${metadata.metadata.camera_make || ''} ${metadata.metadata.camera_model || ''}`.trim() },
    { label: 'Lens', value: metadata.metadata.lens_model },
    { label: 'Focal Length', value: metadata.metadata.focal_length ? `${metadata.metadata.focal_length}mm` : undefined },
    { label: 'Aperture', value: metadata.metadata.aperture ? `f/${metadata.metadata.aperture}` : undefined },
    { label: 'Shutter Speed', value: metadata.metadata.shutter_speed },
    { label: 'ISO', value: metadata.metadata.iso?.toString() },
    { label: 'Flash', value: metadata.metadata.flash },
  ].filter(item => item.value) : [];

  const locationInfo = metadata.metadata && (metadata.metadata.latitude || metadata.metadata.longitude) ? [
    { 
      label: 'Location', 
      value: formatCoordinates(metadata.metadata.latitude, metadata.metadata.longitude),
      isLocation: true,
      lat: metadata.metadata.latitude,
      lon: metadata.metadata.longitude
    },
  ] : [];

  const technicalInfo = [
    { label: 'Color', value: metadata.dominant_color },
    { label: 'Orientation', value: metadata.metadata?.orientation?.toString() },
    ...(metadata.is_astrophotography ? [
      { label: 'Astrophotography', value: `Yes (${parseFloat(metadata.astro_confidence || '0') * 100}% confidence)` }
    ] : []),
  ].filter(item => item.value);

  const renderSection = (title: string, items: Array<{label: string, value: string | undefined, isLocation?: boolean, lat?: string, lon?: string}>) => {
    if (items.length === 0) return null;
    
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {items.map((item, index) => (
          <View key={index} style={styles.metadataRow}>
            <Text style={styles.label}>{item.label}</Text>
            {item.isLocation && item.lat && item.lon ? (
              <TouchableOpacity 
                style={styles.locationContainer}
                onPress={() => openInMaps(item.lat!, item.lon!)}
                activeOpacity={0.7}
              >
                <Text style={styles.locationValue}>{item.value}</Text>
                <Text style={styles.mapIcon}>🗺️</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.value}>{item.value}</Text>
            )}
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Text style={styles.headerText}>Photo Details</Text>
        <Text style={styles.expandIcon}>{expanded ? '▼' : '▶'}</Text>
      </TouchableOpacity>
      
      {expanded && (
        <View style={styles.content}>
          {renderSection('Basic Info', basicInfo)}
          {renderSection('Camera Settings', cameraInfo)}
          {renderSection('Location', locationInfo)}
          {renderSection('Technical', technicalInfo)}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#222',
  },
  headerText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  expandIcon: {
    color: '#666',
    fontSize: 14,
  },
  content: {
    // Remove maxHeight to allow full expansion
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  sectionTitle: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  label: {
    color: '#ccc',
    fontSize: 14,
    flex: 1,
  },
  value: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#666',
    marginLeft: 8,
    fontSize: 14,
  },
  errorText: {
    color: '#ff6b6b',
    textAlign: 'center',
    padding: 20,
    fontSize: 14,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
    justifyContent: 'flex-end',
  },
  locationValue: {
    color: '#4a9eff',
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  mapIcon: {
    marginLeft: 8,
    fontSize: 16,
  },
  mapContainer: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    width: '100%',
  },
  mapPreview: {
    width: '100%',
    height: 200,
    backgroundColor: '#333',
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  mapOverlayText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});