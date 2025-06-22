import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  TextInput,
  SafeAreaView,
  Image,
} from 'react-native';
import { FaceData } from '../types/FaceTypes';
import { API_BASE } from '../config';

interface Person {
  id: number;
  name: string;
  face_count: number;
  sample_face_image?: string;
}

interface PersonSelectionModalProps {
  visible: boolean;
  face: FaceData | null;
  onClose: () => void;
  onAssignComplete: (faceId: number, personId: number, personName: string) => void;
}

export const PersonSelectionModal: React.FC<PersonSelectionModalProps> = ({
  visible,
  face,
  onClose,
  onAssignComplete,
}) => {
  const [persons, setPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [showCreatePerson, setShowCreatePerson] = useState(false);

  useEffect(() => {
    if (visible) {
      loadPersons();
    }
  }, [visible]);

  const loadPersons = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/persons`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      const fetchedPersons = data.persons || [];
      
      // Priority people (always at the top)
      const priorityNames = ['Stephen Young', 'Cayce', 'Henry', 'Margaret', 'Amelia Rose'];
      
      // Separate priority people from others
      const priorityPersons = priorityNames.map(name => 
        fetchedPersons.find(p => p.name === name)
      ).filter(Boolean); // Remove any undefined entries
      
      // Get remaining people (not in priority list)
      const remainingPersons = fetchedPersons.filter(p => 
        !priorityNames.includes(p.name)
      );
      
      // Sort remaining people alphabetically
      const alphabeticalPersons = remainingPersons.sort((a, b) => 
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );
      
      // Combine: priority people first, then alphabetical
      const finalSortedPersons = [...priorityPersons, ...alphabeticalPersons];
      
      setPersons(finalSortedPersons);
    } catch (error) {
      console.error('Error loading persons:', error);
      Alert.alert('Error', 'Failed to load persons list');
    } finally {
      setLoading(false);
    }
  };

  const createNewPerson = async () => {
    if (!newPersonName.trim()) {
      Alert.alert('Error', 'Please enter a person name');
      return;
    }

    try {
      setAssigning(true);
      const requestBody = { name: newPersonName.trim() };
      console.log('Creating person with request:', { 
        url: `${API_BASE}/api/persons`,
        body: requestBody 
      });
      
      const response = await fetch(`${API_BASE}/api/persons`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Create person error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const newPerson = await response.json();
      
      // Now assign the face to this new person
      await assignFaceToPerson(newPerson.id, newPersonName.trim());
      
    } catch (error) {
      console.error('Error creating person:', error);
      Alert.alert('Error', 'Failed to create new person');
      setAssigning(false);
    }
  };

  const assignFaceToPerson = async (personId: number, personName: string) => {
    if (!face) return;

    try {
      setAssigning(true);
      const response = await fetch(`${API_BASE}/api/faces/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          faceId: face.id,
          personId: personId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Success!
      onAssignComplete(face.id, personId, personName);
      setNewPersonName('');
      setShowCreatePerson(false);
      onClose();

    } catch (error) {
      console.error('Error assigning face:', error);
      Alert.alert('Error', 'Failed to assign face to person');
    } finally {
      setAssigning(false);
    }
  };

  const renderPersonItem = ({ item }: { item: Person }) => (
    <TouchableOpacity
      style={styles.personItem}
      onPress={() => assignFaceToPerson(item.id, item.name)}
      disabled={assigning}
    >
      <View style={styles.personItemLeft}>
        <View style={styles.faceImageContainer}>
          {item.sample_face_image ? (
            <Image
              source={{ uri: `${API_BASE}${item.sample_face_image}` }}
              style={styles.faceImage}
              onError={() => {
                // Handle image load error by falling back to placeholder
              }}
            />
          ) : (
            <View style={styles.placeholderFace}>
              <Text style={styles.placeholderText}>👤</Text>
            </View>
          )}
        </View>
        <View style={styles.personInfo}>
          <Text style={styles.personName}>{item.name}</Text>
          <Text style={styles.faceCount}>{item.face_count} faces</Text>
        </View>
      </View>
      <Text style={styles.selectButton}>Select</Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} disabled={assigning}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Assign Person</Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading persons...</Text>
          </View>
        ) : (
          <>
            <Text style={styles.instruction}>
              Select a person to assign this face to:
            </Text>

            <FlatList
              data={persons}
              renderItem={renderPersonItem}
              keyExtractor={(item) => item.id.toString()}
              style={styles.personsList}
              contentContainerStyle={styles.personsListContent}
            />

            <View style={styles.createSection}>
              {!showCreatePerson ? (
                <TouchableOpacity
                  style={styles.createPersonButton}
                  onPress={() => setShowCreatePerson(true)}
                  disabled={assigning}
                >
                  <Text style={styles.createPersonButtonText}>
                    + Create New Person
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.createPersonForm}>
                  <TextInput
                    style={styles.nameInput}
                    placeholder="Enter person name"
                    value={newPersonName}
                    onChangeText={setNewPersonName}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={createNewPerson}
                    editable={!assigning}
                  />
                  <View style={styles.createPersonButtons}>
                    <TouchableOpacity
                      style={styles.cancelCreateButton}
                      onPress={() => {
                        setShowCreatePerson(false);
                        setNewPersonName('');
                      }}
                      disabled={assigning}
                    >
                      <Text style={styles.cancelCreateButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.confirmCreateButton,
                        (!newPersonName.trim() || assigning) && styles.disabledButton
                      ]}
                      onPress={createNewPerson}
                      disabled={!newPersonName.trim() || assigning}
                    >
                      {assigning ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Text style={styles.confirmCreateButtonText}>Create & Assign</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </>
        )}

        {assigning && (
          <View style={styles.assigningOverlay}>
            <View style={styles.assigningModal}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.assigningText}>Assigning face...</Text>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
    backgroundColor: 'white',
  },
  cancelButton: {
    color: '#007AFF',
    fontSize: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerSpacer: {
    width: 60, // Balance the cancel button
  },
  instruction: {
    fontSize: 16,
    color: '#333',
    margin: 16,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  personsList: {
    flex: 1,
  },
  personsListContent: {
    paddingHorizontal: 16,
  },
  personItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 16,
    marginVertical: 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  personItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  faceImageContainer: {
    marginRight: 12,
  },
  faceImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  placeholderFace: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 18,
    color: '#666',
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  faceCount: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  selectButton: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  createSection: {
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e1e1e1',
  },
  createPersonButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  createPersonButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  createPersonForm: {
    gap: 12,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  createPersonButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelCreateButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelCreateButtonText: {
    color: '#666',
    fontSize: 16,
  },
  confirmCreateButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  confirmCreateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  assigningOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  assigningModal: {
    backgroundColor: 'white',
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  assigningText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333',
  },
});