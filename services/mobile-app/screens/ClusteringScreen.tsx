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

interface ClusteringStats {
  overview: {
    totalUnassignedFaces: number;
    facesAnalyzed: number;
    processingTimeMs: number;
  };
  recognition: {
    peopleWithSuggestions: number;
    totalSuggestions: number;
    avgConfidenceAcrossAll: number;
    topSuggestions: Array<{
      personName: string;
      suggestions: number;
      avgConfidence: number;
    }>;
  };
  clustering: {
    totalUnknownFaces: number;
    clustersFound: number;
    clusteredFaces: number;
    averageClusterSize: number;
    largestClusters: Array<{
      clusterName: string;
      faceCount: number;
      avgSimilarity: number;
    }>;
  };
}

interface ClusteringScreenProps {
  navigation: any;
  embedded?: boolean;
}

export default function ClusteringScreen({ navigation, embedded = false }: ClusteringScreenProps) {
  const [stats, setStats] = useState<ClusteringStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchClusteringStats = async () => {
    try {
      const response = await fetch('http://192.168.40.6:9000/api/clustering/stats');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
      } else {
        Alert.alert('Error', 'Failed to load clustering statistics');
      }
    } catch (error) {
      console.error('Error fetching clustering stats:', error);
      Alert.alert('Error', 'Failed to connect to server');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchClusteringStats();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchClusteringStats();
  };

  const navigateToRecognitionSuggestions = () => {
    navigation.navigate('RecognitionSuggestions');
  };

  const navigateToUnknownClusters = () => {
    navigation.navigate('UnknownClusters');
  };

  const runFullAnalysis = async () => {
    Alert.alert(
      'Run Full Analysis',
      'This will analyze all unassigned faces using AI. This may take several minutes.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Start Analysis', 
          onPress: async () => {
            setLoading(true);
            try {
              const response = await fetch('http://192.168.40.6:9000/api/clustering/intelligent', {
                method: 'POST',
              });
              const data = await response.json();
              
              if (data.success) {
                Alert.alert('Analysis Complete', 
                  `Found ${data.summary.probablyKnown} faces for known people and ${data.summary.clusteredUnknowns} faces in ${data.unknownClusters.length} clusters.`
                );
                fetchClusteringStats(); // Refresh data
              } else {
                Alert.alert('Error', 'Analysis failed');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to run analysis');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  if (loading && !stats) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading clustering data...</Text>
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
              <Ionicons name="analytics" size={32} color="#007AFF" />
            </View>
            <Text style={styles.headerTitle}>AI Face Clustering</Text>
            <Text style={styles.headerSubtitle}>Intelligent batch face assignment</Text>
          </View>
        )}

        {stats && (
          <>
            {/* Overview Stats */}
            <View style={styles.statsCard}>
              <Text style={styles.cardTitle}>Overview</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{stats.overview.totalUnassignedFaces}</Text>
                  <Text style={styles.statLabel}>Unassigned Faces</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{Math.round(stats.overview.processingTimeMs / 1000)}s</Text>
                  <Text style={styles.statLabel}>Last Analysis</Text>
                </View>
              </View>
            </View>

            {/* Recognition Suggestions */}
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={navigateToRecognitionSuggestions}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardIconContainer}>
                  <Ionicons name="people" size={24} color="#34C759" />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>Recognition Suggestions</Text>
                  <Text style={styles.cardSubtitle}>
                    {stats.recognition.totalSuggestions} faces found for {stats.recognition.peopleWithSuggestions} people
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </View>
              
              {stats.recognition.topSuggestions.length > 0 && (
                <View style={styles.previewSection}>
                  <Text style={styles.previewTitle}>Top Suggestions:</Text>
                  {stats.recognition.topSuggestions.slice(0, 3).map((suggestion, index) => (
                    <View key={index} style={styles.suggestionPreview}>
                      <Text style={styles.suggestionName}>{suggestion.personName}</Text>
                      <View style={styles.suggestionStats}>
                        <Text style={styles.suggestionCount}>{suggestion.suggestions} faces</Text>
                        <Text style={styles.suggestionConfidence}>
                          {Math.round(suggestion.avgConfidence * 100)}% confidence
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>

            {/* Unknown Clusters */}
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={navigateToUnknownClusters}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardIconContainer}>
                  <Ionicons name="grid" size={24} color="#FF9500" />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>Unknown Face Clusters</Text>
                  <Text style={styles.cardSubtitle}>
                    {stats.clustering.clustersFound} clusters with {stats.clustering.clusteredFaces} faces
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </View>

              {stats.clustering.largestClusters.length > 0 && (
                <View style={styles.previewSection}>
                  <Text style={styles.previewTitle}>Largest Clusters:</Text>
                  {stats.clustering.largestClusters.slice(0, 3).map((cluster, index) => (
                    <View key={index} style={styles.suggestionPreview}>
                      <Text style={styles.suggestionName}>{cluster.clusterName}</Text>
                      <View style={styles.suggestionStats}>
                        <Text style={styles.suggestionCount}>{cluster.faceCount} faces</Text>
                        <Text style={styles.suggestionConfidence}>
                          {Math.round(cluster.avgSimilarity * 100)}% similar
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.primaryButton}
                onPress={runFullAnalysis}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Ionicons name="scan" size={20} color="white" style={styles.buttonIcon} />
                    <Text style={styles.primaryButtonText}>Run Full Analysis</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
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
  statsCard: {
    backgroundColor: 'white',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  actionCard: {
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
  },
  cardIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  cardInfo: {
    flex: 1,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  previewSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
  },
  suggestionPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  suggestionName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  suggestionStats: {
    alignItems: 'flex-end',
  },
  suggestionCount: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  suggestionConfidence: {
    fontSize: 12,
    color: '#666',
  },
  actionButtons: {
    padding: 20,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});