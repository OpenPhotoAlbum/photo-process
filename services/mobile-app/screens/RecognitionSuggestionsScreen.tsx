import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface RecognitionSuggestion {
  personId: number;
  personName: string;
  suggestions: Array<{
    faceId: number;
    confidence: number;
    imageHash: string;
    imagePath?: string;
  }>;
  avgConfidence: number;
  totalSuggestions: number;
}

interface RecognitionSuggestionsScreenProps {
  navigation: any;
  embedded?: boolean;
}

export default function RecognitionSuggestionsScreen({ navigation, embedded = false }: RecognitionSuggestionsScreenProps) {
  const [suggestions, setSuggestions] = useState<RecognitionSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assigningPerson, setAssigningPerson] = useState<number | null>(null);

  const fetchSuggestions = async () => {
    try {
      const response = await fetch('http://192.168.40.6:9000/api/clustering/recognition-suggestions');
      const data = await response.json();
      
      if (data.success) {
        setSuggestions(data.suggestions || []);
      } else {
        Alert.alert('Error', 'Failed to load recognition suggestions');
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      Alert.alert('Error', 'Failed to connect to server');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSuggestions();
  };

  const assignAllSuggestions = async (personId: number, personName: string) => {
    Alert.alert(
      'Assign All Suggestions',
      `Assign all ${suggestions.find(s => s.personId === personId)?.totalSuggestions} suggested faces to ${personName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Assign All', 
          onPress: async () => {
            setAssigningPerson(personId);
            try {
              const response = await fetch('http://192.168.40.6:9000/api/clustering/assign-recognition-suggestions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ personId }),
              });
              const data = await response.json();
              
              if (data.success) {
                Alert.alert('Success', `Assigned ${data.assignedCount} faces to ${personName}`);
                fetchSuggestions(); // Refresh data
              } else {
                Alert.alert('Error', 'Failed to assign faces');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to assign faces');
            } finally {
              setAssigningPerson(null);
            }
          }
        }
      ]
    );
  };

  const navigateToPersonDetail = (personId: number, personName: string) => {
    navigation.navigate('PersonDetail', { 
      personId, 
      personName,
      returnTo: 'RecognitionSuggestions'
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading suggestions...</Text>
      </View>
    );
  }

  if (suggestions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="checkmark-circle" size={64} color="#34C759" />
        <Text style={styles.emptyTitle}>No Suggestions Found</Text>
        <Text style={styles.emptySubtitle}>
          All faces have been assigned or there are no high-confidence matches
        </Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Back to Clustering</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={embedded ? styles.embeddedContainer : styles.container}>
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header - only show when not embedded */}
        {!embedded && (
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="people" size={32} color="#34C759" />
            </View>
            <Text style={styles.headerTitle}>Recognition Suggestions</Text>
            <Text style={styles.headerSubtitle}>
              {suggestions.length} people with high-confidence face matches
            </Text>
          </View>
        )}
        
        {/* Back button for embedded mode */}
        {embedded && (
          <View style={styles.embeddedHeader}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={24} color="#007AFF" />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.embeddedTitle}>Recognition Suggestions</Text>
          </View>
        )}

        {/* Suggestions List */}
        {suggestions.map((suggestion) => (
          <View key={suggestion.personId} style={styles.suggestionCard}>
            <View style={styles.cardHeader}>
              <TouchableOpacity 
                style={styles.personInfo}
                onPress={() => navigateToPersonDetail(suggestion.personId, suggestion.personName)}
              >
                <Text style={styles.personName}>{suggestion.personName}</Text>
                <Text style={styles.suggestionCount}>
                  {suggestion.totalSuggestions} faces • {Math.round(suggestion.avgConfidence * 100)}% avg confidence
                </Text>
              </TouchableOpacity>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </View>

            {/* Face Preview Grid */}
            <View style={styles.facePreview}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {suggestion.suggestions.slice(0, 6).map((face, index) => (
                  <View key={face.faceId} style={styles.faceItem}>
                    <View style={styles.faceImageContainer}>
                      <View style={styles.faceImageWrapper}>
                        <Image
                          source={{ uri: `http://192.168.40.6:9000/api/media/face/${face.faceId}` }}
                          style={styles.faceImage}
                          onError={() => {
                            console.log('Face image failed to load:', face.faceId);
                          }}
                        />
                        <View style={styles.faceImagePlaceholder}>
                          <Text style={styles.faceImagePlaceholderText}>👤</Text>
                        </View>
                      </View>
                      <View style={styles.confidenceBadge}>
                        <Text style={styles.confidenceText}>
                          {Math.round(face.confidence * 100)}%
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
                {suggestion.totalSuggestions > 6 && (
                  <View style={styles.moreIndicator}>
                    <Text style={styles.moreText}>
                      +{suggestion.totalSuggestions - 6}
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.reviewButton}
                onPress={() => navigateToPersonDetail(suggestion.personId, suggestion.personName)}
              >
                <Ionicons name="eye" size={16} color="#007AFF" />
                <Text style={styles.reviewButtonText}>Review</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.assignButton,
                  assigningPerson === suggestion.personId && styles.assignButtonDisabled
                ]}
                onPress={() => assignAllSuggestions(suggestion.personId, suggestion.personName)}
                disabled={assigningPerson === suggestion.personId}
              >
                {assigningPerson === suggestion.personId ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color="white" />
                    <Text style={styles.assignButtonText}>Assign All</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Summary Footer */}
        <View style={styles.summaryFooter}>
          <Text style={styles.summaryText}>
            Total: {suggestions.reduce((sum, s) => sum + s.totalSuggestions, 0)} suggested faces
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  embeddedContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  embeddedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
    marginLeft: 4,
  },
  embeddedTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginRight: 60, // Balance the back button
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerIcon: {
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  suggestionCard: {
    backgroundColor: 'white',
    margin: 15,
    marginTop: 0,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 15,
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  suggestionCount: {
    fontSize: 14,
    color: '#666',
  },
  facePreview: {
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  faceItem: {
    marginRight: 12,
  },
  faceImageContainer: {
    position: 'relative',
  },
  faceImageWrapper: {
    position: 'relative',
  },
  faceImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
  },
  faceImagePlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: -1,
  },
  faceImagePlaceholderText: {
    fontSize: 24,
    opacity: 0.5,
  },
  confidenceBadge: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    backgroundColor: '#34C759',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 28,
  },
  confidenceText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
  },
  moreIndicator: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  moreText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  reviewButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: 'white',
  },
  reviewButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
  assignButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#34C759',
  },
  assignButtonDisabled: {
    backgroundColor: '#999',
  },
  assignButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
  summaryFooter: {
    backgroundColor: 'white',
    padding: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    marginTop: 15,
  },
  summaryText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
});