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
  Modal,
  SafeAreaView,
} from 'react-native';
import { Image } from 'expo-image';
import { API_BASE } from '../config';

const screenWidth = Dimensions.get('window').width;
const personItemWidth = (screenWidth - 30) / 2;

interface Person {
  id: number;
  name: string;
  face_count?: number;
  google_tag_count?: number;
  recognition_status: 'untrained' | 'training' | 'trained';
  sample_face_image?: string;
  is_from_google?: boolean;
  avg_recognition_confidence?: number;
  last_trained_at?: string;
}

interface PersonsResponse {
  persons: Person[];
}

interface FacesScreenProps {
  onClose: () => void;
}

export const FacesScreen: React.FC<FacesScreenProps> = ({ onClose }) => {
  const [persons, setPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'trained' | 'untrained' | 'high_potential'>('all');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [personImages, setPersonImages] = useState<any[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);

  const fetchPersons = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await fetch(`${API_BASE}/api/persons`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch persons: ${response.status}`);
      }

      const data: PersonsResponse = await response.json();
      setPersons(data.persons);
    } catch (err) {
      console.error('Error fetching persons:', err);
      setError(err instanceof Error ? err.message : 'Failed to load persons');
      Alert.alert('Error', 'Failed to load faces. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPersons();
  }, []);

  const fetchPersonImages = async (personId: number) => {
    try {
      setLoadingImages(true);
      const response = await fetch(`${API_BASE}/api/persons/${personId}/images?source=all&limit=20`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch person images: ${response.status}`);
      }

      const data = await response.json();
      setPersonImages(data.images || []);
    } catch (err) {
      console.error('Error fetching person images:', err);
      setPersonImages([]);
    } finally {
      setLoadingImages(false);
    }
  };

  const removeFaceAssignment = async (faceId: number) => {
    try {
      const response = await fetch(`${API_BASE}/api/faces/${faceId}/person`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove face assignment');
      }

      Alert.alert('Success', 'Face assignment removed successfully');
      
      // Refresh the person images and persons list
      if (selectedPerson) {
        fetchPersonImages(selectedPerson.id);
        fetchPersons(true);
      }
    } catch (error) {
      console.error('Failed to remove face assignment:', error);
      Alert.alert('Error', 'Failed to remove face assignment. Please try again.');
    }
  };

  const getFilteredPersons = () => {
    switch (filter) {
      case 'trained':
        return persons.filter(p => p.recognition_status === 'trained');
      case 'untrained':
        return persons.filter(p => p.recognition_status === 'untrained');
      case 'high_potential':
        return persons.filter(p => (p.google_tag_count || 0) >= 20);
      default:
        return persons;
    }
  };

  const filteredPersons = getFilteredPersons();

  const getPersonStatusColor = (person: Person) => {
    if (person.recognition_status === 'trained') return '#00ff88';
    if ((person.face_count || 0) > 0) return '#ffa500';
    if ((person.google_tag_count || 0) >= 20) return '#007AFF';
    return '#666';
  };

  const getPersonStatusText = (person: Person) => {
    if (person.recognition_status === 'trained') return 'Trained';
    if ((person.face_count || 0) > 0) return `${(person.face_count || 0)} faces`;
    if ((person.google_tag_count || 0) > 0) return `${(person.google_tag_count || 0)} tags`;
    return 'No data';
  };

  const getFaceImageUrl = (person: Person) => {
    if (person.sample_face_image && typeof person.sample_face_image === 'string') {
      // The sample_face_image contains a full file path like: 
      // "/mnt/hdd/photo-process/dest/processed/faces/img_0955_1e546026__face_0.jpg"
      // We need to extract the path relative to the processed directory
      const pathParts = person.sample_face_image.split('/processed/');
      if (pathParts.length > 1) {
        // Get the path after "/processed/"
        const relativePath = pathParts[1];
        return `${API_BASE}/processed/${relativePath}`;
      }
      
      // Fallback: try extracting just the filename for /media/faces/ route
      const filename = person.sample_face_image.split('/').pop();
      if (filename) {
        return `${API_BASE}/media/faces/${filename}`;
      }
    }
    return null;
  };

  const handleTrainPerson = async (person: Person) => {
    if (person.face_count < 5) {
      Alert.alert(
        'Not Enough Faces',
        `${person.name} needs at least 5 faces to train. Currently has ${person.face_count} faces assigned.`,
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/compreface/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId: person.id })
      });

      if (!response.ok) {
        throw new Error('Training failed');
      }

      Alert.alert('Training Started', `Training initiated for ${person.name}`);
      fetchPersons(true);
    } catch (error) {
      Alert.alert('Training Error', 'Failed to start training. Please try again.');
    }
  };

  const renderFilterButtons = () => (
    <View style={styles.filterContainer}>
      {[
        { key: 'all', label: 'All', count: persons.length },
        { key: 'high_potential', label: 'High Potential', count: persons.filter(p => p.google_tag_count >= 20).length },
        { key: 'untrained', label: 'Untrained', count: persons.filter(p => p.recognition_status === 'untrained').length },
        { key: 'trained', label: 'Trained', count: persons.filter(p => p.recognition_status === 'trained').length },
      ].map(({ key, label, count }) => (
        <TouchableOpacity
          key={key}
          style={[styles.filterButton, filter === key && styles.filterButtonActive]}
          onPress={() => setFilter(key as any)}
        >
          <Text style={[styles.filterButtonText, filter === key && styles.filterButtonTextActive]}>
            {label} ({(count || 0).toString()})
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderPersonItem = ({ item }: { item: Person }) => {
    console.log('Rendering person item:', item.name, item);
    const faceImageUrl = getFaceImageUrl(item);
    const statusColor = getPersonStatusColor(item);
    const statusText = getPersonStatusText(item);

    return (
      <TouchableOpacity
        style={styles.personItem}
        onPress={() => {
          setSelectedPerson(item);
          fetchPersonImages(item.id);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.personImageContainer}>
{(faceImageUrl && faceImageUrl.startsWith('http')) ? (
            <Image
              source={{ uri: faceImageUrl }}
              style={[styles.personImage, styles.circularImage]}
              contentFit="cover"
              placeholder="blur"
              onError={() => {
                console.log('Face image failed to load:', faceImageUrl);
              }}
            />
          ) : (
            <View style={[styles.personImage, styles.personImagePlaceholder, styles.circularImage]}>
              <Text style={styles.personImagePlaceholderText}>👤</Text>
            </View>
          )}
          
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusBadgeText}>
              {item.recognition_status === 'trained' ? '✓' : (item.face_count || item.google_tag_count || 0).toString()}
            </Text>
          </View>
        </View>
        
        <View style={styles.personInfo}>
          <Text style={styles.personName} numberOfLines={2}>
            {item.name}
          </Text>
          
          <Text style={[styles.personStatus, { color: statusColor }]}>
            {statusText}
          </Text>
          
{item.is_from_google ? (
            <Text style={styles.googleBadge}>Google</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderPersonModal = () => {
    if (!selectedPerson) return null;

    const renderImageItem = ({ item }: { item: any }) => {
      const imageUrl = item.thumbnail_url ? `${API_BASE}${item.thumbnail_url}` : `${API_BASE}${item.media_url}`;
      
      return (
        <TouchableOpacity style={styles.imageGridItem}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.imageGridPhoto}
            contentFit="cover"
          />
          {item.faces && item.faces.length > 0 && (
            <View style={styles.faceActions}>
              {item.faces.map((face: any) => (
                <TouchableOpacity
                  key={face.id}
                  style={styles.removeFaceButton}
                  onPress={() => {
                    Alert.alert(
                      'Remove Face Assignment',
                      `Remove this face from ${selectedPerson.name}?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { 
                          text: 'Remove', 
                          style: 'destructive',
                          onPress: () => removeFaceAssignment(face.id)
                        }
                      ]
                    );
                  }}
                >
                  <Text style={styles.removeFaceButtonText}>✕</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {item.source === 'google' && (
            <View style={styles.googleBadgeOverlay}>
              <Text style={styles.googleBadgeText}>Google</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    };

    return (
      <Modal
        visible={!!selectedPerson}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => {
              setSelectedPerson(null);
              setPersonImages([]);
            }} style={styles.modalCloseButton}>
              <Text style={styles.modalCloseButtonText}>Done</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{selectedPerson.name}</Text>
            <View style={styles.modalCloseButton} />
          </View>

          <View style={styles.personStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{(selectedPerson.face_count || 0).toString()}</Text>
              <Text style={styles.statLabel}>Faces Assigned</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{(selectedPerson.google_tag_count || 0).toString()}</Text>
              <Text style={styles.statLabel}>Google Tags</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {selectedPerson.recognition_status === 'trained' ? '✓' : '✗'}
              </Text>
              <Text style={styles.statLabel}>Trained</Text>
            </View>
          </View>

          {(selectedPerson.face_count >= 5 && selectedPerson.recognition_status !== 'trained') ? (
            <TouchableOpacity
              style={styles.trainButton}
              onPress={() => handleTrainPerson(selectedPerson)}
            >
              <Text style={styles.trainButtonText}>🎓 Train Model</Text>
            </TouchableOpacity>
          ) : null}

          {loadingImages ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading images...</Text>
            </View>
          ) : (
            <View style={styles.imagesSection}>
              <Text style={styles.sectionTitle}>
                Photos ({personImages.length}) - Long press ✕ to remove face assignments
              </Text>
              <FlatList
                data={personImages}
                renderItem={renderImageItem}
                keyExtractor={(item) => item.id.toString()}
                numColumns={3}
                contentContainerStyle={styles.imageGrid}
                showsVerticalScrollIndicator={false}
              />
            </View>
          )}
        </SafeAreaView>
      </Modal>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Faces</Text>
          <View style={styles.closeButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading faces...</Text>
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
        <Text style={styles.headerTitle}>Faces</Text>
        <View style={styles.closeButton} />
      </View>

      {renderFilterButtons()}

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => fetchPersons()} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredPersons}
          renderItem={renderPersonItem}
          keyExtractor={(item) => item.id.toString()}
          numColumns={2}
          contentContainerStyle={styles.personsList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchPersons(true)}
              colors={['#007AFF']}
            />
          }
        />
      )}

      {renderPersonModal()}
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
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  filterButton: {
    backgroundColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterButtonText: {
    color: '#999',
    fontSize: 12,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
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
  personsList: {
    padding: 10,
  },
  personItem: {
    width: personItemWidth,
    marginHorizontal: 5,
    marginVertical: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  personImageContainer: {
    position: 'relative',
  },
  personImage: {
    width: '100%',
    height: personItemWidth * 0.7,
    backgroundColor: '#333',
  },
  circularImage: {
    borderRadius: (personItemWidth * 0.7) / 2,
    width: personItemWidth * 0.7,
    height: personItemWidth * 0.7,
    alignSelf: 'center',
    marginTop: 12,
  },
  personImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  personImagePlaceholderText: {
    fontSize: 32,
    opacity: 0.5,
  },
  statusBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  personInfo: {
    padding: 12,
  },
  personName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 18,
  },
  personStatus: {
    fontSize: 12,
    marginBottom: 4,
  },
  googleBadge: {
    color: '#666',
    fontSize: 10,
    fontStyle: 'italic',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  modalCloseButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  modalCloseButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  personStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    color: '#999',
    fontSize: 12,
  },
  trainButton: {
    backgroundColor: '#00ff88',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  trainButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  infoBoxText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  imagesSection: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  imageGrid: {
    paddingBottom: 20,
  },
  imageGridItem: {
    flex: 1,
    aspectRatio: 1,
    margin: 2,
    position: 'relative',
  },
  imageGridPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
  },
  faceActions: {
    position: 'absolute',
    top: 4,
    right: 4,
    flexDirection: 'row',
  },
  removeFaceButton: {
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  removeFaceButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  googleBadgeOverlay: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0, 119, 255, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  googleBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
});