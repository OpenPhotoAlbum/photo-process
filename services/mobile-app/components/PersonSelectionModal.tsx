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
} from 'react-native';
import { FaceData } from '../types/FaceTypes';

const API_BASE = 'http://192.168.40.103:9000';

interface Person {
  id: number;
  name: string;
  face_count: number;
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
      
      // Custom sorting: Top 10 by face count, then alphabetical
      const sortedPersons = [...fetchedPersons].sort((a, b) => {
        const aFaceCount = a.face_count || 0;
        const bFaceCount = b.face_count || 0;
        
        // If both have faces or both don't have faces, compare face counts
        if ((aFaceCount > 0 && bFaceCount > 0) || (aFaceCount === 0 && bFaceCount === 0)) {
          if (aFaceCount !== bFaceCount) {
            return bFaceCount - aFaceCount; // Higher face count first
          }
          // If face counts are equal, sort alphabetically
          return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        }
        
        // People with faces come before people without faces
        return bFaceCount - aFaceCount;
      });
      
      // Separate top 10 by face count and the rest
      const personsWithFaces = sortedPersons.filter(p => (p.face_count || 0) > 0);
      const personsWithoutFaces = sortedPersons.filter(p => (p.face_count || 0) === 0);
      
      // Get top 10 by face count
      const top10ByFaceCount = personsWithFaces.slice(0, 10);
      const remainingWithFaces = personsWithFaces.slice(10);
      
      // Sort remaining persons alphabetically
      const remainingAlphabetical = [...remainingWithFaces, ...personsWithoutFaces]
        .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
      
      // Combine: top 10 by face count + remaining alphabetical
      const finalSortedPersons = [...top10ByFaceCount, ...remainingAlphabetical];
      
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
      const response = await fetch(`${API_BASE}/api/persons`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newPersonName.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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
      <View style={styles.personInfo}>
        <Text style={styles.personName}>{item.name}</Text>
        <Text style={styles.faceCount}>{item.face_count} faces</Text>
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