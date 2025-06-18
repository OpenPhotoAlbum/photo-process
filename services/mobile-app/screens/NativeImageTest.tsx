import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image, // Using React Native's built-in Image component
  Alert
} from 'react-native';

interface NativeImageTestProps {
  imageId: number;
  imageUrl: string;
  filename: string;
  onClose: () => void;
}

export const NativeImageTest: React.FC<NativeImageTestProps> = ({ 
  imageId, 
  imageUrl, 
  filename, 
  onClose 
}) => {
  const [loadState, setLoadState] = useState('initial');
  const [error, setError] = useState<string | null>(null);
  
  // Build the full URL for this specific image
  const API_BASE = 'http://192.168.40.103:9000';
  const testUrl = `${API_BASE}${imageUrl}`;
  
  const handleLoadStart = () => {
    setLoadState('loading');
    setError(null);
    console.log('🔄 Native Image load started:', testUrl);
  };
  
  const handleLoad = () => {
    setLoadState('loaded');
    console.log('✅ Native Image loaded successfully!');
  };
  
  const handleError = (error: any) => {
    setLoadState('error');
    setError(JSON.stringify(error.nativeEvent || error));
    console.log('❌ Native Image failed to load:', error);
  };
  
  const showInfo = () => {
    Alert.alert(
      'Native Image Test',
      `Image ID: ${imageId}\nFilename: ${filename}\nURL: ${testUrl}\nState: ${loadState}\nError: ${error || 'None'}`,
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.button} onPress={onClose}>
          <Text style={styles.buttonText}>✕ Close</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={showInfo}>
          <Text style={styles.buttonText}>Info</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.title}>Native Image Test</Text>
        <Text style={styles.subtitle}>ID: {imageId} - {filename}</Text>
        
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: testUrl }}
            style={styles.image}
            resizeMode="contain"
            onLoadStart={handleLoadStart}
            onLoad={handleLoad}
            onError={handleError}
          />
          
          {/* Status overlay */}
          <View style={styles.statusOverlay}>
            <Text style={styles.statusText}>Status: {loadState}</Text>
          </View>
        </View>
        
        <View style={styles.info}>
          <Text style={styles.infoText}>URL:</Text>
          <Text style={styles.urlText}>{testUrl}</Text>
          
          <Text style={styles.infoText}>Load State: {loadState}</Text>
          
          {error && (
            <>
              <Text style={styles.infoText}>Error:</Text>
              <Text style={styles.errorText}>{error}</Text>
            </>
          )}
          
          <Text style={styles.infoText}>
            This URL works in browser - testing native Image component
          </Text>
        </View>
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
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: '#333',
  },
  button: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#ccc',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  imageContainer: {
    flex: 1,
    backgroundColor: '#222',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 16,
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: '#111', // Background to see if component is there
  },
  statusOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 4,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  info: {
    backgroundColor: '#333',
    padding: 16,
    borderRadius: 8,
  },
  infoText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  urlText: {
    color: '#ccc',
    fontSize: 10,
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  errorText: {
    color: '#ff5252',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 12,
  },
});