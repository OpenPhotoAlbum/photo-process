import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert
} from 'react-native';
import { Image } from 'expo-image';
import { API_BASE } from '../config';

interface BasicImageTestProps {
  onClose: () => void;
}

export const BasicImageTest: React.FC<BasicImageTestProps> = ({ onClose }) => {
  const [loadState, setLoadState] = useState('initial');
  const [loadTime, setLoadTime] = useState<number | null>(null);
  
  // Test URLs - using config-based API base and external test image
  const testUrls = [
    `${API_BASE}/media/2025/06/2023-04-27_12-17-53_img_1642_44b01a86.jpg`,
    'https://picsum.photos/400/600', // External test image
  ];
  
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  const currentUrl = testUrls[currentUrlIndex];
  
  const handleLoadStart = () => {
    setLoadState('loading');
    setLoadTime(Date.now());
    console.log('🔄 Image load started:', currentUrl);
  };
  
  const handleLoad = () => {
    const duration = loadTime ? Date.now() - loadTime : 0;
    setLoadState('loaded');
    console.log('✅ Image loaded successfully in', duration, 'ms');
  };
  
  const handleError = (error: any) => {
    const duration = loadTime ? Date.now() - loadTime : 0;
    setLoadState('error');
    console.log('❌ Image failed to load after', duration, 'ms:', error);
  };
  
  const switchUrl = () => {
    const nextIndex = (currentUrlIndex + 1) % testUrls.length;
    setCurrentUrlIndex(nextIndex);
    setLoadState('initial');
    setLoadTime(null);
  };
  
  const showInfo = () => {
    Alert.alert(
      'Image Test Info',
      `URL ${currentUrlIndex + 1}/${testUrls.length}:\n${currentUrl}\n\nState: ${loadState}`,
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.button} onPress={onClose}>
          <Text style={styles.buttonText}>✕ Close</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={switchUrl}>
          <Text style={styles.buttonText}>Next URL</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={showInfo}>
          <Text style={styles.buttonText}>Info</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.title}>Image Loading Test</Text>
        <Text style={styles.subtitle}>URL {currentUrlIndex + 1} of {testUrls.length}</Text>
        
        <View style={styles.imageContainer}>
          <Image
            key={currentUrl} // Force re-render on URL change
            source={{ uri: currentUrl }}
            style={styles.image}
            contentFit="contain"
            transition={100}
            cachePolicy="none"
            onLoadStart={handleLoadStart}
            onLoad={handleLoad}
            onError={handleError}
          />
          
          {/* Status overlay */}
          <View style={styles.statusOverlay}>
            <Text style={styles.statusText}>
              Status: {loadState}
            </Text>
            {loadTime && (
              <Text style={styles.statusText}>
                Time: {loadTime ? Date.now() - loadTime : 0}ms
              </Text>
            )}
          </View>
        </View>
        
        <View style={styles.info}>
          <Text style={styles.infoText}>Current URL:</Text>
          <Text style={styles.urlText}>{currentUrl}</Text>
          
          <Text style={styles.infoText}>Load State: {loadState}</Text>
          
          <TouchableOpacity style={styles.switchButton} onPress={switchUrl}>
            <Text style={styles.switchButtonText}>
              Switch to URL {((currentUrlIndex + 1) % testUrls.length) + 1}
            </Text>
          </TouchableOpacity>
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
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  switchButton: {
    backgroundColor: '#0066CC',
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 8,
  },
  switchButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});