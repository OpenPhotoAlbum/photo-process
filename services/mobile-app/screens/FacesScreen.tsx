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
  ScrollView,
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
  onSelectPhoto: (photo: any, person?: any) => void;
  initialSelectedPerson?: any; // Optional prop to pre-select a person
}

export const FacesScreen: React.FC<FacesScreenProps> = ({ onClose, onSelectPhoto, initialSelectedPerson }) => {
  const [persons, setPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'trained' | 'untrained' | 'high_potential'>('all');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [personImages, setPersonImages] = useState<any[]>([]);
  const [personFaces, setPersonFaces] = useState<any[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [imageFilter, setImageFilter] = useState<'face_crops'>('face_crops');
  const [showAutoFaces, setShowAutoFaces] = useState(false);
  const [showManualFaces, setShowManualFaces] = useState(false);
  
  // Multiselect state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedFaces, setSelectedFaces] = useState<Set<number>>(new Set());
  const [showBatchModal, setShowBatchModal] = useState(false);
  
  // Main view state: 'people' or 'unassigned'
  const [mainView, setMainView] = useState<'people' | 'unassigned'>('people');
  const [unassignedFaces, setUnassignedFaces] = useState<any[]>([]);
  const [loadingUnassigned, setLoadingUnassigned] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

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

  const fetchUnassignedFaces = async () => {
    try {
      setLoadingUnassigned(true);
      const response = await fetch(`${API_BASE}/api/faces/unassigned?limit=200`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch unassigned faces: ${response.status}`);
      }

      const data = await response.json();
      setUnassignedFaces(data.faces || []);
    } catch (err) {
      console.error('Error fetching unassigned faces:', err);
      setUnassignedFaces([]);
      Alert.alert('Error', 'Failed to load unassigned faces.');
    } finally {
      setLoadingUnassigned(false);
    }
  };

  useEffect(() => {
    if (mainView === 'unassigned') {
      fetchUnassignedFaces();
    }
  }, [mainView]);

  // Auto-select person if provided
  useEffect(() => {
    if (initialSelectedPerson && persons.length > 0) {
      setSelectedPerson(initialSelectedPerson);
      fetchPersonImages(initialSelectedPerson.id);
      fetchPersonFaces(initialSelectedPerson.id);
    }
  }, [initialSelectedPerson, persons]);

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

  const fetchPersonFaces = async (personId: number) => {
    try {
      setLoadingImages(true);
      const response = await fetch(`${API_BASE}/api/persons/${personId}/faces`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch person faces: ${response.status}`);
      }

      const data = await response.json();
      setPersonFaces(data.faces || []);
    } catch (err) {
      console.error('Error fetching person faces:', err);
      setPersonFaces([]);
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
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const result = await response.json();
      
      Alert.alert(
        'Face Removed', 
        `Face removed from ${result.personName}. ${result.remainingFaceCount} faces remaining.`,
        [{ text: 'OK' }]
      );
      
      // Remove the face from local state immediately
      if (selectedPerson) {
        // Update face crops list by removing the deleted face
        setPersonFaces(prevFaces => prevFaces.filter(face => face.id !== faceId));
        
        // Update face count in selectedPerson
        setSelectedPerson(prev => prev ? {
          ...prev,
          face_count: Math.max(0, (prev.face_count || 1) - 1)
        } : null);
        
        // Update persons list to reflect new face count
        setPersons(prevPersons => 
          prevPersons.map(person => 
            person.id === selectedPerson.id 
              ? { ...person, face_count: Math.max(0, (person.face_count || 1) - 1) }
              : person
          )
        );
      }
    } catch (error) {
      console.error('Failed to remove face assignment:', error);
      Alert.alert(
        'Removal Failed', 
        error instanceof Error ? error.message : 'Failed to remove face assignment. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const getFilteredPersons = () => {
    let filtered: Person[];
    switch (filter) {
      case 'trained':
        filtered = persons.filter(p => p.recognition_status === 'trained');
        break;
      case 'untrained':
        filtered = persons.filter(p => p.recognition_status === 'untrained');
        break;
      case 'high_potential':
        filtered = persons.filter(p => (p.google_tag_count || 0) >= 20);
        break;
      default:
        filtered = persons;
    }

    // Sort: faces with assigned faces first (alphabetically), then placeholders (alphabetically)
    return filtered.sort((a, b) => {
      const aHasFaces = (a.face_count || 0) > 0;
      const bHasFaces = (b.face_count || 0) > 0;
      
      // If one has faces and the other doesn't, prioritize the one with faces
      if (aHasFaces && !bHasFaces) return -1;
      if (!aHasFaces && bHasFaces) return 1;
      
      // Both have faces or both don't have faces - sort alphabetically by name
      return a.name.localeCompare(b.name);
    });
  };

  const filteredPersons = getFilteredPersons();

  // Helper function to check if an image has faces assigned to the current person
  const imageHasAssignedFaces = (image: any) => {
    if (!selectedPerson || !image.faces) return false;
    return image.faces.some((face: any) => face.person_id === selectedPerson.id);
  };

  // Filter images/faces based on assignment status and view type
  const getFilteredImagesOrFaces = () => {
    if (imageFilter === 'face_crops') {
      // If both toggles are off, show no results
      if (!showAutoFaces && !showManualFaces) {
        return [];
      }
      
      // Filter faces based on assignment method
      return personFaces.filter(face => {
        if (showAutoFaces && showManualFaces) {
          // Show all faces if both toggles are on
          return true;
        } else if (showAutoFaces) {
          // Show only auto-assigned faces
          return face.assigned_by === 'auto_recognition';
        } else if (showManualFaces) {
          // Show only manually assigned faces
          return face.assigned_by !== 'auto_recognition';
        }
        return false;
      });
    }
    return personImages;
  };

  const filteredData = getFilteredImagesOrFaces();

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
    if ((person.face_count || 0) < 5) {
      Alert.alert(
        'Not Enough Faces',
        `${person.name} needs at least 5 faces to train. Currently has ${person.face_count || 0} faces assigned.`,
        [{ text: 'OK' }]
      );
      return;
    }

    const isRetraining = person.recognition_status === 'trained';
    const actionText = isRetraining ? 'Re-train' : 'Train';
    const confirmTitle = isRetraining ? 'Re-train Model?' : 'Train Model?';
    const confirmMessage = isRetraining 
      ? `Re-train ${person.name}'s recognition model with ${person.face_count} faces?\n\nThis will update their existing model and may improve recognition accuracy.`
      : `Train ${person.name}'s recognition model with ${person.face_count} faces?\n\nThis will enable automatic face recognition for this person.`;

    Alert.alert(
      confirmTitle,
      confirmMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionText,
          onPress: async () => {
            try {
              // Update local state to show training in progress
              setSelectedPerson(prev => prev ? {
                ...prev,
                recognition_status: 'training' as const
              } : null);
              
              setPersons(prevPersons => 
                prevPersons.map(p => 
                  p.id === person.id 
                    ? { ...p, recognition_status: 'training' as const }
                    : p
                )
              );

              const response = await fetch(`${API_BASE}/compreface/train`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ personId: person.id })
              });

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Training failed: ${response.status}`);
              }

              const result = await response.json();
              Alert.alert(
                'Training Started', 
                `${actionText}ing initiated for ${person.name}.\n\nTraining typically takes 1-2 minutes to complete.`,
                [{ text: 'OK' }]
              );
              
              // Refresh person data after training
              setTimeout(() => {
                fetchPersons(true);
                if (selectedPerson) {
                  fetchPersonFaces(selectedPerson.id);
                }
              }, 2000);
              
            } catch (error) {
              console.error('Training error:', error);
              
              // Revert training status on error
              setSelectedPerson(prev => prev ? {
                ...prev,
                recognition_status: isRetraining ? 'trained' as const : 'untrained' as const
              } : null);
              
              setPersons(prevPersons => 
                prevPersons.map(p => 
                  p.id === person.id 
                    ? { ...p, recognition_status: isRetraining ? 'trained' as const : 'untrained' as const }
                    : p
                )
              );
              
              Alert.alert(
                'Training Error', 
                error instanceof Error ? error.message : 'Failed to start training. Please try again.',
                [{ text: 'OK' }]
              );
            }
          }
        }
      ]
    );
  };

  // Multiselect functions
  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    setSelectedFaces(new Set()); // Clear selection when toggling mode
  };

  const toggleFaceSelection = (faceId: number) => {
    const newSelection = new Set(selectedFaces);
    if (newSelection.has(faceId)) {
      newSelection.delete(faceId);
    } else {
      newSelection.add(faceId);
    }
    setSelectedFaces(newSelection);
  };

  const selectAllFaces = () => {
    const allFaceIds = new Set(personFaces.map(face => face.id));
    setSelectedFaces(allFaceIds);
  };

  const clearSelection = () => {
    setSelectedFaces(new Set());
  };

  const batchDeleteFaces = async () => {
    if (selectedFaces.size === 0) return;

    Alert.alert(
      'Delete Selected Faces',
      `Delete ${selectedFaces.size} face${selectedFaces.size > 1 ? 's' : ''} from ${selectedPerson?.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const deletePromises = Array.from(selectedFaces).map(faceId =>
                fetch(`${API_BASE}/api/faces/${faceId}/person`, { method: 'DELETE' })
              );

              const results = await Promise.allSettled(deletePromises);
              const successCount = results.filter(result => result.status === 'fulfilled').length;

              // Update local state
              setPersonFaces(prevFaces => prevFaces.filter(face => !selectedFaces.has(face.id)));
              
              if (selectedPerson) {
                const newFaceCount = Math.max(0, (selectedPerson.face_count || 0) - successCount);
                setSelectedPerson(prev => prev ? { ...prev, face_count: newFaceCount } : null);
                setPersons(prevPersons => 
                  prevPersons.map(person => 
                    person.id === selectedPerson.id 
                      ? { ...person, face_count: newFaceCount }
                      : person
                  )
                );
              }

              setSelectedFaces(new Set());
              setShowBatchModal(false);
              Alert.alert('Success', `Deleted ${successCount} face${successCount > 1 ? 's' : ''}`);
            } catch (error) {
              Alert.alert('Error', 'Some faces could not be deleted. Please try again.');
            }
          }
        }
      ]
    );
  };

  const batchReassignFaces = () => {
    if (selectedFaces.size === 0) return;
    
    Alert.alert(
      'Reassign Selected Faces',
      `Reassign ${selectedFaces.size} face${selectedFaces.size > 1 ? 's' : ''} to a different person?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reassign',
          onPress: async () => {
            try {
              // For now, we'll remove all selected faces and let user reassign manually
              // This could be enhanced with a person selection modal
              const deletePromises = Array.from(selectedFaces).map(faceId =>
                fetch(`${API_BASE}/api/faces/${faceId}/person`, { method: 'DELETE' })
              );

              const results = await Promise.allSettled(deletePromises);
              const successCount = results.filter(result => result.status === 'fulfilled').length;

              // Update local state
              setPersonFaces(prevFaces => prevFaces.filter(face => !selectedFaces.has(face.id)));
              
              if (selectedPerson) {
                const newFaceCount = Math.max(0, (selectedPerson.face_count || 0) - successCount);
                setSelectedPerson(prev => prev ? { ...prev, face_count: newFaceCount } : null);
                setPersons(prevPersons => 
                  prevPersons.map(person => 
                    person.id === selectedPerson.id 
                      ? { ...person, face_count: newFaceCount }
                      : person
                  )
                );
              }

              setSelectedFaces(new Set());
              setShowBatchModal(false);
              Alert.alert('Success', `${successCount} face${successCount > 1 ? 's' : ''} unassigned. You can now reassign them to other people.`);
            } catch (error) {
              Alert.alert('Error', 'Some faces could not be reassigned. Please try again.');
            }
          }
        }
      ]
    );
  };

  const batchAssignFaces = async (personId: number, personName: string) => {
    if (selectedFaces.size === 0) return;

    try {
      const assignPromises = Array.from(selectedFaces).map(faceId =>
        fetch(`${API_BASE}/api/faces/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ faceId, personId })
        })
      );

      const results = await Promise.allSettled(assignPromises);
      const successCount = results.filter(result => result.status === 'fulfilled').length;

      // Update local state by removing assigned faces
      setUnassignedFaces(prevFaces => prevFaces.filter(face => !selectedFaces.has(face.id)));

      // Clear selection
      setSelectedFaces(new Set());
      setIsSelectMode(false);
      setShowAssignModal(false);

      Alert.alert(
        'Success', 
        `Assigned ${successCount} face${successCount > 1 ? 's' : ''} to ${personName}`,
        [{ text: 'OK' }]
      );

      // Refresh persons list to update face counts
      fetchPersons(true);
    } catch (error) {
      Alert.alert('Error', 'Some faces could not be assigned. Please try again.');
    }
  };

  const renderFilterButtons = () => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={styles.filterScrollView}
      contentContainerStyle={styles.filterContainer}
    >
      {[
        { key: 'all', label: 'All', count: persons.length },
        { key: 'high_potential', label: 'High Potential', count: persons.filter(p => (p.google_tag_count || 0) >= 20).length },
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
    </ScrollView>
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
          fetchPersonFaces(item.id);
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
              {item.recognition_status === 'trained' ? '✓' : (item.face_count || 0).toString()}
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
      const imageUrl = `${API_BASE}/media/${item.relative_media_path}`;
      const hasAssignedFaces = imageHasAssignedFaces(item);
      
      return (
        <TouchableOpacity 
          style={styles.imageGridItem}
          onPress={() => onSelectPhoto(item, selectedPerson)}
          activeOpacity={0.7}
        >
          <Image
            source={{ uri: imageUrl }}
            style={styles.imageGridPhoto}
            contentFit="cover"
          />
          
          {/* Checkmark for assigned faces */}
          {hasAssignedFaces && (
            <View style={styles.assignedIndicator}>
              <Text style={styles.checkmarkText}>✓</Text>
            </View>
          )}
          {item.faces && item.faces.length > 0 && (
            <View style={styles.faceActions}>
              {item.faces.map((face: any) => (
                <TouchableOpacity
                  key={face.id}
                  style={styles.removeFaceButton}
                  onPress={(event) => {
                    event.stopPropagation(); // Prevent image press when removing face
                    Alert.alert(
                      'Remove Face Assignment',
                      `Remove this face from ${selectedPerson.name}?\n\nThis will:\n• Remove the face from ${selectedPerson.name}'s profile\n• Update their training model\n• Make the face unassigned`,
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

    const renderFaceItem = ({ item }: { item: any }) => {
      const faceUrl = `${API_BASE}/processed/faces/${item.relative_face_path}`;
      const isSelected = selectedFaces.has(item.id);
      
      return (
        <TouchableOpacity 
          style={[
            styles.imageGridItem,
            isSelectMode && isSelected && styles.selectedImageGridItem
          ]}
          onPress={() => {
            if (isSelectMode) {
              toggleFaceSelection(item.id);
            } else {
              // Navigate to the parent photo when face is tapped
              if (item.image) {
                onSelectPhoto(item.image, selectedPerson);
              }
            }
          }}
          activeOpacity={0.7}
        >
          <Image
            source={{ uri: faceUrl }}
            style={styles.imageGridPhoto}
            contentFit="cover"
          />
          
          {/* Show confidence score on face crops */}
          {item.recognition_confidence && !isSelectMode && (
            <View style={styles.confidenceOverlay}>
              <Text style={styles.confidenceText}>
                {(item.recognition_confidence * 100).toFixed(0)}%
              </Text>
            </View>
          )}
          
          {/* Multiselect mode: Show selection checkbox */}
          {isSelectMode && (
            <View style={styles.selectionOverlay}>
              <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </View>
          )}
          
          {/* Normal mode: Show individual action buttons */}
          {!isSelectMode && (
            <>
              {/* Remove face button */}
              <TouchableOpacity
                style={styles.removeFaceButton}
                onPress={(event) => {
                  event.stopPropagation();
                  Alert.alert(
                    'Remove Face Assignment',
                    `Remove this face from ${selectedPerson.name}?\n\nThis will:\n• Remove the face from ${selectedPerson.name}'s profile\n• Update their training model\n• Make the face unassigned`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { 
                        text: 'Remove', 
                        style: 'destructive',
                        onPress: () => removeFaceAssignment(item.id)
                      }
                    ]
                  );
                }}
              >
                <Text style={styles.removeFaceButtonText}>✕</Text>
              </TouchableOpacity>

              {/* Reassign face button */}
              <TouchableOpacity
                style={styles.reassignFaceButton}
                onPress={(event) => {
                  event.stopPropagation();
                  Alert.alert(
                    'Reassign Face',
                    `Reassign this face to a different person?\n\nThis will:\n• Remove the face from ${selectedPerson.name}'s profile\n• Allow you to assign it to another person\n• Update training models accordingly`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { 
                        text: 'Reassign', 
                        onPress: async () => {
                          try {
                            // Remove the current assignment
                            const response = await fetch(`${API_BASE}/api/faces/${item.id}/person`, {
                              method: 'DELETE',
                            });

                            if (response.ok) {
                              // Remove the face from local state immediately
                              setPersonFaces(prevFaces => prevFaces.filter(face => face.id !== item.id));
                              
                              // Update face count in selectedPerson
                              setSelectedPerson(prev => prev ? {
                                ...prev,
                                face_count: Math.max(0, (prev.face_count || 1) - 1)
                              } : null);
                              
                              // Update persons list to reflect new face count
                              setPersons(prevPersons => 
                                prevPersons.map(person => 
                                  person.id === selectedPerson.id 
                                    ? { ...person, face_count: Math.max(0, (person.face_count || 1) - 1) }
                                    : person
                                )
                              );

                              // Then navigate to the parent photo for reassignment
                              if (item.image) {
                                onSelectPhoto(item.image, selectedPerson);
                              }
                            } else {
                              throw new Error('Failed to remove face assignment');
                            }
                          } catch (error) {
                            Alert.alert('Error', 'Failed to reassign face. Please try again.');
                          }
                        }
                      }
                    ]
                  );
                }}
              >
                <Text style={styles.reassignFaceButtonText}>🔄</Text>
              </TouchableOpacity>
            </>
          )}
          
          {/* Show assignment method badge */}
          {item.assigned_by && (
            <View style={styles.assignmentMethodOverlay}>
              <Text style={styles.assignmentMethodText}>
                {item.assigned_by === 'auto_recognition' ? 'Auto' : 'Manual'}
              </Text>
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
              setPersonFaces([]);
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

          {/* Training Controls */}
          <View style={styles.trainingSection}>
            {(selectedPerson.face_count || 0) >= 5 ? (
              <TouchableOpacity
                style={[
                  styles.trainButton,
                  selectedPerson.recognition_status === 'trained' && styles.retrainButton
                ]}
                onPress={() => handleTrainPerson(selectedPerson)}
              >
                <Text style={styles.trainButtonText}>
                  {selectedPerson.recognition_status === 'trained' ? '🔄 Re-train Model' : '🎓 Train Model'}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.trainingRequirement}>
                <Text style={styles.trainingRequirementText}>
                  Need {5 - (selectedPerson.face_count || 0)} more faces to enable training
                </Text>
              </View>
            )}
            
            {selectedPerson.last_trained_at && (
              <Text style={styles.lastTrainedText}>
                Last trained: {new Date(selectedPerson.last_trained_at).toLocaleDateString()}
              </Text>
            )}
          </View>

          {loadingImages ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading images...</Text>
            </View>
          ) : (
            <View style={styles.imagesSection}>
              {/* Header with title and toggle */}
              <View style={styles.imagesSectionHeader}>
                <Text style={styles.sectionTitle}>
                  Face Crops ({filteredData.length})
                  {!showAutoFaces && !showManualFaces && ' - Select Auto/Manual to view'}
                </Text>
                
                {/* Assignment Method Toggles */}
                <View style={styles.imageFilterToggle}>
                  <TouchableOpacity
                    style={[
                      styles.filterToggleButton,
                      showAutoFaces && styles.filterToggleButtonActive
                    ]}
                    onPress={() => setShowAutoFaces(!showAutoFaces)}
                  >
                    <Text style={[
                      styles.filterToggleText,
                      showAutoFaces && styles.filterToggleTextActive
                    ]}>
                      Auto
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.filterToggleButton,
                      showManualFaces && styles.filterToggleButtonActive
                    ]}
                    onPress={() => setShowManualFaces(!showManualFaces)}
                  >
                    <Text style={[
                      styles.filterToggleText,
                      showManualFaces && styles.filterToggleTextActive
                    ]}>
                      Manual
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* Multiselect controls - only show when faces are visible */}
              {filteredData.length > 0 && (
                <View style={styles.multiselectControls}>
                  <View style={styles.multiselectRow}>
                    <TouchableOpacity
                      style={[styles.selectButton, isSelectMode && styles.selectButtonActive]}
                      onPress={toggleSelectMode}
                    >
                      <Text style={[styles.selectButtonText, isSelectMode && styles.selectButtonTextActive]}>
                        {isSelectMode ? 'Cancel' : 'Select'}
                      </Text>
                    </TouchableOpacity>
                    
                    {isSelectMode && (
                      <View style={styles.multiselectActions}>
                        <TouchableOpacity
                          style={styles.selectAllButton}
                          onPress={selectAllFaces}
                        >
                          <Text style={styles.selectAllButtonText}>Select All</Text>
                        </TouchableOpacity>
                        
                        {selectedFaces.size > 0 && (
                          <TouchableOpacity
                            style={styles.batchActionsButton}
                            onPress={() => setShowBatchModal(true)}
                          >
                            <Text style={styles.batchActionsButtonText}>
                              Batch Actions ({selectedFaces.size})
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              )}
              
              <FlatList
                key={`person-modal-faces-${showAutoFaces}-${showManualFaces}-3-columns`}
                data={filteredData}
                renderItem={renderFaceItem}
                keyExtractor={(item) => item.id.toString()}
                numColumns={3}
                contentContainerStyle={styles.imageGrid}
                showsVerticalScrollIndicator={false}
              />
            </View>
          )}
        </SafeAreaView>
        
        {/* Batch Actions Modal */}
        <Modal
          visible={showBatchModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowBatchModal(false)}
        >
          <SafeAreaView style={styles.batchModalContainer}>
            <View style={styles.batchModalHeader}>
              <TouchableOpacity 
                onPress={() => setShowBatchModal(false)}
                style={styles.batchModalCloseButton}
              >
                <Text style={styles.batchModalCloseText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.batchModalTitle}>
                Batch Actions ({selectedFaces.size} selected)
              </Text>
              <View style={styles.batchModalSpacer} />
            </View>
            
            <View style={styles.batchActionsGrid}>
              <TouchableOpacity
                style={[styles.batchActionButton, styles.deleteActionButton]}
                onPress={batchDeleteFaces}
              >
                <Text style={styles.batchActionIcon}>🗑️</Text>
                <Text style={styles.batchActionText}>Delete Faces</Text>
                <Text style={styles.batchActionDescription}>
                  Remove selected faces from {selectedPerson?.name}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.batchActionButton, styles.reassignActionButton]}
                onPress={batchReassignFaces}
              >
                <Text style={styles.batchActionIcon}>🔄</Text>
                <Text style={styles.batchActionText}>Reassign Faces</Text>
                <Text style={styles.batchActionDescription}>
                  Unassign faces for reassignment to other people
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      </Modal>
    );
  };

  const renderUnassignedFaceItem = (item: any) => {
    const faceUrl = `${API_BASE}/processed/faces/${item.relative_face_path}`;
    const isSelected = selectedFaces.has(item.id);
    
    return (
      <TouchableOpacity 
        style={[
          styles.imageGridItem,
          isSelectMode && isSelected && styles.selectedImageGridItem
        ]}
        onPress={() => {
          if (isSelectMode) {
            toggleFaceSelection(item.id);
          } else {
            // Navigate to the parent photo
            if (item.image) {
              onSelectPhoto(item.image);
            }
          }
        }}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: faceUrl }}
          style={styles.imageGridPhoto}
          contentFit="cover"
        />
        
        {/* Multiselect mode: Show selection checkbox */}
        {isSelectMode && (
          <View style={styles.selectionOverlay}>
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </View>
        )}
        
        {/* Show confidence score if available */}
        {item.detection_confidence && !isSelectMode && (
          <View style={styles.confidenceOverlay}>
            <Text style={styles.confidenceText}>
              {(item.detection_confidence * 100).toFixed(0)}%
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderAssignModal = () => (
    <Modal
      visible={showAssignModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowAssignModal(false)}
    >
      <SafeAreaView style={styles.assignModalContainer}>
        <View style={styles.assignModalHeader}>
          <TouchableOpacity 
            onPress={() => setShowAssignModal(false)}
            style={styles.assignModalCloseButton}
          >
            <Text style={styles.assignModalCloseText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.assignModalTitle}>
            Assign {selectedFaces.size} Face{selectedFaces.size > 1 ? 's' : ''}
          </Text>
          <View style={styles.assignModalSpacer} />
        </View>
        
        <Text style={styles.assignModalSubtitle}>
          Select a person to assign the selected faces to:
        </Text>
        
        <FlatList
          data={persons.sort((a, b) => {
            // Sort by face count (descending) then alphabetically
            if ((b.face_count || 0) !== (a.face_count || 0)) {
              return (b.face_count || 0) - (a.face_count || 0);
            }
            return a.name.localeCompare(b.name);
          })}
          renderItem={({ item }) => {
            const faceImageUrl = getFaceImageUrl(item);
            return (
              <TouchableOpacity
                style={styles.assignPersonItem}
                onPress={() => batchAssignFaces(item.id, item.name)}
              >
                {/* Face Image */}
                <View style={styles.assignPersonImageContainer}>
                  {(faceImageUrl && faceImageUrl.startsWith('http')) ? (
                    <Image
                      source={{ uri: faceImageUrl }}
                      style={styles.assignPersonImage}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.assignPersonImage, styles.assignPersonImagePlaceholder]}>
                      <Text style={styles.assignPersonImagePlaceholderText}>👤</Text>
                    </View>
                  )}
                </View>
                
                {/* Person Info */}
                <View style={styles.assignPersonInfo}>
                  <Text style={styles.assignPersonName}>{item.name}</Text>
                  <Text style={styles.assignPersonFaceCount}>
                    {(item.face_count || 0)} existing faces
                  </Text>
                </View>
                
                {/* Action Button */}
                <Text style={styles.assignPersonAction}>Assign →</Text>
              </TouchableOpacity>
            );
          }}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.assignPersonList}
          showsVerticalScrollIndicator={true}
        />
      </SafeAreaView>
    </Modal>
  );

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

      {/* Main View Toggle */}
      <View style={styles.mainViewToggle}>
        <TouchableOpacity
          style={[styles.viewToggleButton, mainView === 'people' && styles.viewToggleButtonActive]}
          onPress={() => {
            setMainView('people');
            setIsSelectMode(false);
            setSelectedFaces(new Set());
          }}
        >
          <Text style={[styles.viewToggleText, mainView === 'people' && styles.viewToggleTextActive]}>
            People ({persons.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewToggleButton, mainView === 'unassigned' && styles.viewToggleButtonActive]}
          onPress={() => {
            setMainView('unassigned');
            setIsSelectMode(false);
            setSelectedFaces(new Set());
          }}
        >
          <Text style={[styles.viewToggleText, mainView === 'unassigned' && styles.viewToggleTextActive]}>
            Unassigned ({unassignedFaces.length})
          </Text>
        </TouchableOpacity>
      </View>

      {mainView === 'people' ? (
        <>
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
              key="people-2-columns"
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
        </>
      ) : (
        /* Unassigned Faces View */
        <>
          {/* Multiselect controls for unassigned faces */}
          <View style={styles.multiselectControls}>
            <View style={styles.multiselectRow}>
              <TouchableOpacity
                style={[styles.selectButton, isSelectMode && styles.selectButtonActive]}
                onPress={toggleSelectMode}
              >
                <Text style={[styles.selectButtonText, isSelectMode && styles.selectButtonTextActive]}>
                  {isSelectMode ? 'Cancel' : 'Select'}
                </Text>
              </TouchableOpacity>
              
              {isSelectMode && (
                <View style={styles.multiselectActions}>
                  <TouchableOpacity
                    style={styles.selectAllButton}
                    onPress={() => {
                      const allFaceIds = new Set(unassignedFaces.map(face => face.id));
                      setSelectedFaces(allFaceIds);
                    }}
                  >
                    <Text style={styles.selectAllButtonText}>Select All</Text>
                  </TouchableOpacity>
                  
                  {selectedFaces.size > 0 && (
                    <TouchableOpacity
                      style={styles.assignButton}
                      onPress={() => setShowAssignModal(true)}
                    >
                      <Text style={styles.assignButtonText}>
                        Assign ({selectedFaces.size})
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </View>

          {loadingUnassigned ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading unassigned faces...</Text>
            </View>
          ) : unassignedFaces.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No unassigned faces found</Text>
              <Text style={styles.emptySubtext}>All faces have been assigned to people</Text>
            </View>
          ) : (
            <FlatList
              key="unassigned-3-columns"
              data={unassignedFaces}
              renderItem={({ item }) => renderUnassignedFaceItem(item)}
              keyExtractor={(item) => item.id.toString()}
              numColumns={3}
              contentContainerStyle={styles.imageGrid}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => fetchUnassignedFaces()}
                  colors={['#007AFF']}
                />
              }
            />
          )}
        </>
      )}

      {renderPersonModal()}
      {renderAssignModal()}
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
  filterScrollView: {
    backgroundColor: '#1a1a1a',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
    borderBottomColor: '#333',
  },
  filterButton: {
    backgroundColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderRadius: 16,
    marginRight: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
  trainingSection: {
    marginHorizontal: 16,
    marginVertical: 12,
    alignItems: 'center',
  },
  trainButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 180,
  },
  retrainButton: {
    backgroundColor: '#ff9500',
  },
  trainButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  trainingRequirement: {
    backgroundColor: '#333',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#555',
  },
  trainingRequirementText: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
  },
  lastTrainedText: {
    color: '#666',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
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
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeFaceButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  reassignFaceButton: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 122, 255, 0.8)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reassignFaceButtonText: {
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
  // New styles for image filter and checkmarks
  imagesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  imageFilterToggle: {
    flexDirection: 'row',
    backgroundColor: '#222',
    borderRadius: 16,
    padding: 2,
  },
  filterToggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  filterToggleButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterToggleText: {
    color: '#999',
    fontSize: 12,
    fontWeight: '500',
  },
  filterToggleTextActive: {
    color: '#fff',
  },
  assignedIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#00AA00',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  checkmarkText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  confidenceOverlay: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  confidenceText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  assignmentMethodOverlay: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0, 119, 255, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  assignmentMethodText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  
  // Multiselect styles
  selectedImageGridItem: {
    borderWidth: 3,
    borderColor: '#007AFF',
  },
  selectionOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  multiselectControls: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  multiselectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectButton: {
    backgroundColor: '#333',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#555',
  },
  selectButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  selectButtonTextActive: {
    color: '#fff',
  },
  multiselectActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectAllButton: {
    backgroundColor: '#555',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  selectAllButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  batchActionsButton: {
    backgroundColor: '#ff6b35',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  batchActionsButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Batch Actions Modal styles
  batchModalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  batchModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    backgroundColor: '#1a1a1a',
  },
  batchModalCloseButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  batchModalCloseText: {
    color: '#007AFF',
    fontSize: 16,
  },
  batchModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  batchModalSpacer: {
    width: 60,
  },
  batchActionsGrid: {
    padding: 20,
    gap: 16,
  },
  batchActionButton: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  deleteActionButton: {
    borderColor: '#ff3333',
  },
  reassignActionButton: {
    borderColor: '#ff9500',
  },
  batchActionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  batchActionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  batchActionDescription: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Main view toggle styles
  mainViewToggle: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 4,
  },
  viewToggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  viewToggleButtonActive: {
    backgroundColor: '#333',
  },
  viewToggleText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  viewToggleTextActive: {
    color: '#fff',
  },
  
  // Unassigned faces styles
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  assignButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  assignButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Assign modal styles
  assignModalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  assignModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    backgroundColor: '#1a1a1a',
  },
  assignModalCloseButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  assignModalCloseText: {
    color: '#007AFF',
    fontSize: 16,
  },
  assignModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  assignModalSpacer: {
    width: 60,
  },
  assignModalSubtitle: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 16,
    paddingHorizontal: 20,
  },
  assignPersonList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  assignPersonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    padding: 16,
    marginVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  assignPersonInfo: {
    flex: 1,
  },
  assignPersonName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  assignPersonFaceCount: {
    color: '#666',
    fontSize: 14,
  },
  assignPersonAction: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Assign modal face image styles
  assignPersonImageContainer: {
    marginRight: 12,
  },
  assignPersonImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
  },
  assignPersonImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignPersonImagePlaceholderText: {
    fontSize: 20,
    opacity: 0.5,
  },
});