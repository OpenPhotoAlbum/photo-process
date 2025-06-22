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
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const screenWidth = Dimensions.get('window').width;

interface ClusterGroup {
  clusterId: string;
  clusterName: string;
  faces: Array<{
    faceId: number;
    imageId: number;
    filename: string;
    faceImagePath: string;
    detectionConfidence: number;
    clusterSimilarity?: number;
  }>;
  avgSimilarity: number;
  representativeFace: {
    faceId: number;
    imageId: number;
    filename: string;
    faceImagePath: string;
    detectionConfidence: number;
  };
}

interface UnknownClustersScreenProps {
  navigation: any;
  embedded?: boolean;
}

export default function UnknownClustersScreen({ navigation, embedded = false }: UnknownClustersScreenProps) {
  const [clusters, setClusters] = useState<ClusterGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);

  const fetchClusters = async () => {
    try {
      const response = await fetch('http://192.168.40.6:9000/api/clustering/unknown-clusters-detailed');
      const data = await response.json();
      
      if (data.success && data.clusters) {
        setClusters(data.clusters);
      } else {
        Alert.alert('Error', 'Failed to load clustering data');
      }
    } catch (error) {
      console.error('Error fetching clusters:', error);
      Alert.alert('Error', 'Failed to connect to server');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchClusters();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchClusters();
  };

  const toggleClusterExpansion = (clusterId: string) => {
    setExpandedCluster(expandedCluster === clusterId ? null : clusterId);
  };

  const createPersonFromCluster = (cluster: ClusterGroup) => {
    Alert.alert(
      'Create New Person',
      `Create a new person from this cluster of ${cluster.faces.length} faces?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Create Person', 
          onPress: () => {
            // TODO: Implement person creation from cluster
            Alert.alert('Coming Soon', 'Person creation from clusters will be available in a future update.');
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading clusters...</Text>
      </View>
    );
  }

  if (clusters.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="grid" size={64} color="#FF9500" />
        <Text style={styles.emptyTitle}>No Clusters Found</Text>
        <Text style={styles.emptySubtitle}>
          Run a full analysis to discover clusters of similar unknown faces
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
              <Ionicons name="grid" size={32} color="#FF9500" />
            </View>
            <Text style={styles.headerTitle}>Unknown Face Clusters</Text>
            <Text style={styles.headerSubtitle}>
              {clusters.length} clusters found with similar faces
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
            <Text style={styles.embeddedTitle}>Unknown Clusters</Text>
          </View>
        )}

        {/* Clusters List */}
        {clusters.map((cluster, index) => (
          <View key={cluster.clusterId} style={[
            styles.clusterCard,
            index === 0 && { marginTop: 15 }
          ]}>
            <TouchableOpacity 
              style={styles.clusterHeader}
              onPress={() => toggleClusterExpansion(cluster.clusterId)}
            >
              <View style={styles.clusterInfo}>
                <Text style={styles.clusterName}>{cluster.clusterName}</Text>
                <Text style={styles.clusterStats}>
                  {cluster.faces.length} faces • {Math.round(cluster.avgSimilarity * 100)}% similarity
                </Text>
              </View>
              <Ionicons 
                name={expandedCluster === cluster.clusterId ? "chevron-up" : "chevron-down"} 
                size={20} 
                color="#999" 
              />
            </TouchableOpacity>

            {/* Representative Face Preview */}
            <View style={styles.representativePreview}>
              <View style={styles.faceImageContainer}>
                <View style={styles.faceImageWrapper}>
                  <View style={styles.faceImagePlaceholder}>
                    <Ionicons name="person" size={30} color="#999" />
                  </View>
                  <Image
                    source={{ uri: `http://192.168.40.6:9000/media/face/${cluster.representativeFace.faceId}` }}
                    style={styles.faceImage}
                    onError={(e) => {
                      console.log('Representative face image failed to load:', cluster.representativeFace.faceId, e.nativeEvent.error);
                    }}
                  />
                  <View style={styles.confidenceBadge}>
                    <Text style={styles.confidenceText}>
                      {Math.round(cluster.representativeFace.detectionConfidence * 100)}%
                    </Text>
                  </View>
                </View>
              </View>
              <Text style={styles.representativeLabel}>Representative Face</Text>
            </View>

            {/* Expanded Face Grid */}
            {expandedCluster === cluster.clusterId && (
              <View style={styles.expandedSection}>
                <Text style={styles.sectionTitle}>All Faces in Cluster</Text>
                <View style={styles.faceGrid}>
                  {cluster.faces.map((face, index) => (
                    <TouchableOpacity 
                      key={face.faceId} 
                      style={styles.gridFaceItem}
                      onPress={() => {
                        console.log('Face clicked:', face.faceId);
                        // TODO: Add face detail view or assignment options
                      }}
                    >
                      <View style={styles.faceImageWrapper}>
                        <View style={styles.faceImagePlaceholder}>
                          <Ionicons name="person" size={24} color="#999" />
                        </View>
                        <Image
                          source={{ uri: `http://192.168.40.6:9000/media/face/${face.faceId}` }}
                          style={styles.faceImage}
                          onError={(e) => {
                            console.log('Face image failed to load:', face.faceId, e.nativeEvent.error);
                          }}
                        />
                        <View style={styles.confidenceBadge}>
                          <Text style={styles.confidenceText}>
                            {Math.round(face.detectionConfidence * 100)}%
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.expandButton}
                onPress={() => toggleClusterExpansion(cluster.clusterId)}
              >
                <Ionicons 
                  name={expandedCluster === cluster.clusterId ? "eye-off" : "eye"} 
                  size={16} 
                  color="#007AFF" 
                />
                <Text style={styles.expandButtonText}>
                  {expandedCluster === cluster.clusterId ? 'Collapse' : 'View All'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.createButton}
                onPress={() => createPersonFromCluster(cluster)}
              >
                <Ionicons name="person-add" size={16} color="white" />
                <Text style={styles.createButtonText}>Create Person</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Summary Footer */}
        <View style={styles.summaryFooter}>
          <Text style={styles.summaryText}>
            Total: {clusters.reduce((sum, c) => sum + c.faces.length, 0)} faces in {clusters.length} clusters
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
    backgroundColor: '#f5f5f5',
  },
  embeddedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
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
    color: '#333',
    marginRight: 60,
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
  clusterCard: {
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
  clusterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 15,
  },
  clusterInfo: {
    flex: 1,
  },
  clusterName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  clusterStats: {
    fontSize: 14,
    color: '#666',
  },
  representativePreview: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  representativeLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  expandedSection: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 15,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
  },
  faceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  gridFaceItem: {
    marginRight: 12,
    marginBottom: 12,
  },
  faceImageContainer: {
    position: 'relative',
  },
  faceImageWrapper: {
    position: 'relative',
    width: 60,
    height: 60,
  },
  faceImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  faceImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceImagePlaceholderText: {
    fontSize: 24,
    opacity: 0.5,
  },
  confidenceBadge: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    backgroundColor: '#FF9500',
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
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  expandButton: {
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
  expandButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
  createButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#FF9500',
  },
  createButtonText: {
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