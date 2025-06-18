import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  PanResponder,
  Modal,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PhotoUpload } from './PhotoUpload';
import { UploadResponse } from '../services/UploadAPI';
import { AutoUploadSettingsScreen } from '../screens/AutoUploadSettingsScreen';

const { width: screenWidth } = Dimensions.get('window');
const MENU_WIDTH = screenWidth * 0.8;

interface SlideOutMenuProps {
  onUploadComplete?: (response: UploadResponse) => void;
  onUploadError?: (error: string) => void;
  onAutoUploadPress?: () => void;
}

export const SlideOutMenu: React.FC<SlideOutMenuProps> = ({
  onUploadComplete,
  onUploadError,
  onAutoUploadPress,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-MENU_WIDTH)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only respond to horizontal swipes from the left edge
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && 
               evt.nativeEvent.pageX < 20;
      },
      onPanResponderGrant: () => {
        // User started swiping
      },
      onPanResponderMove: (evt, gestureState) => {
        // Only open menu on right swipe from left edge
        if (gestureState.dx > 50 && !isVisible) {
          openMenu();
        }
      },
    })
  ).current;

  const openMenu = () => {
    setIsVisible(true);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeMenu = () => {
    Animated.timing(slideAnim, {
      toValue: -MENU_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsVisible(false);
    });
  };

  const handleUploadComplete = (response: UploadResponse) => {
    closeMenu();
    onUploadComplete?.(response);
  };

  const handleUploadError = (error: string) => {
    // Don't close menu on error so user can try again
    onUploadError?.(error);
  };

  return (
    <>
      {/* Invisible touch area for swipe gesture */}
      <View style={styles.swipeArea} {...panResponder.panHandlers} />
      
      {/* Hamburger menu button */}
      <TouchableOpacity style={styles.menuButton} onPress={openMenu}>
        <Ionicons name="menu" size={24} color="white" />
      </TouchableOpacity>

      {/* Slide-out menu modal */}
      <Modal
        visible={isVisible}
        transparent={true}
        animationType="none"
        onRequestClose={closeMenu}
      >
        <View style={styles.modalOverlay}>
          {/* Backdrop - tap to close */}
          <TouchableOpacity 
            style={styles.backdrop} 
            activeOpacity={1}
            onPress={closeMenu}
          />
          
          {/* Menu content */}
          <Animated.View 
            style={[
              styles.menuContainer,
              {
                transform: [{ translateX: slideAnim }]
              }
            ]}
          >
            <SafeAreaView style={styles.menuContent}>
              {/* Header */}
              <View style={styles.menuHeader}>
                <Text style={styles.menuTitle}>Menu</Text>
                <TouchableOpacity onPress={closeMenu} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>

              {/* Menu Items */}
              <View style={styles.menuItems}>
                {/* Upload Photo Section */}
                <View style={styles.menuSection}>
                  <Text style={styles.sectionTitle}>Photos</Text>
                  <PhotoUpload
                    onUploadComplete={handleUploadComplete}
                    onUploadError={handleUploadError}
                  />
                </View>

                {/* Future functionality sections */}
                <View style={styles.menuSection}>
                  <Text style={styles.sectionTitle}>Search</Text>
                  <TouchableOpacity style={styles.menuItem} disabled>
                    <Ionicons name="search" size={20} color="#999" />
                    <Text style={styles.menuItemTextDisabled}>Advanced Search</Text>
                    <Text style={styles.comingSoon}>Coming Soon</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.menuSection}>
                  <Text style={styles.sectionTitle}>Organization</Text>
                  <TouchableOpacity style={styles.menuItem} disabled>
                    <Ionicons name="albums" size={20} color="#999" />
                    <Text style={styles.menuItemTextDisabled}>Smart Albums</Text>
                    <Text style={styles.comingSoon}>Coming Soon</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.menuItem} disabled>
                    <Ionicons name="people" size={20} color="#999" />
                    <Text style={styles.menuItemTextDisabled}>People</Text>
                    <Text style={styles.comingSoon}>Coming Soon</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.menuSection}>
                  <Text style={styles.sectionTitle}>Settings</Text>
                  <TouchableOpacity 
                    style={styles.menuItemActive} 
                    onPress={() => {
                      console.log('Auto-Upload clicked!');
                      // Close the slide-out menu first
                      closeMenu();
                      // Then call parent callback
                      setTimeout(() => {
                        onAutoUploadPress?.();
                      }, 100);
                    }}
                  >
                    <Ionicons name="cloud-upload" size={20} color="#007AFF" />
                    <Text style={styles.menuItemTextActive}>Auto-Upload</Text>
                    <Ionicons name="chevron-forward" size={16} color="#007AFF" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.menuItem} disabled>
                    <Ionicons name="settings" size={20} color="#999" />
                    <Text style={styles.menuItemTextDisabled}>Preferences</Text>
                    <Text style={styles.comingSoon}>Coming Soon</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Footer */}
              <View style={styles.menuFooter}>
                <Text style={styles.footerText}>Photo Management Platform</Text>
                <Text style={styles.footerVersion}>v1.0.0</Text>
              </View>
            </SafeAreaView>
          </Animated.View>
        </View>
      </Modal>

    </>
  );
};

const styles = StyleSheet.create({
  swipeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 20,
    height: '100%',
    zIndex: 1,
  },
  menuButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  modalOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menuContainer: {
    width: MENU_WIDTH,
    height: '100%',
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 2,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuContent: {
    flex: 1,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  menuTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  menuItems: {
    flex: 1,
    padding: 20,
  },
  menuSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    marginBottom: 8,
    opacity: 0.6,
  },
  menuItemTextDisabled: {
    fontSize: 16,
    color: '#999',
    marginLeft: 12,
    flex: 1,
  },
  comingSoon: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  menuItemActive: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f0f8ff',
    marginBottom: 8,
  },
  menuItemTextActive: {
    fontSize: 16,
    color: '#007AFF',
    marginLeft: 12,
    flex: 1,
    fontWeight: '500',
  },
  menuFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  footerVersion: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
});