import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  Alert,
  TouchableOpacity,
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { autoUploadService, AutoUploadSettings, UploadStats } from '../services/AutoUploadService';

interface AutoUploadSettingsScreenProps {
  onClose: () => void;
}

export const AutoUploadSettingsScreen: React.FC<AutoUploadSettingsScreenProps> = ({ onClose }) => {
  const [settings, setSettings] = useState<AutoUploadSettings>({
    enabled: false,
    wifiOnly: true,
    qualitySetting: 'medium',
    dailyLimit: 100,
    maxConcurrentUploads: 2
  });
  
  const [stats, setStats] = useState<UploadStats>({
    totalQueued: 0,
    totalCompleted: 0,
    totalFailed: 0,
    uploadedsToday: 0,
    dailyLimitMB: 100
  });
  
  const [loading, setLoading] = useState(true);
  const [isStandalone, setIsStandalone] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadSettings();
    loadStats();
    setIsStandalone(autoUploadService.isRunningStandalone());
    
    // Auto-refresh stats when auto-upload is enabled
    if (settings.enabled) {
      startAutoRefresh();
    }
    
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, []);

  // Auto-refresh stats when enabled state changes
  useEffect(() => {
    if (settings.enabled) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
  }, [settings.enabled]);

  const startAutoRefresh = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
    
    // Refresh stats every 3 seconds when auto-upload is active
    const interval = setInterval(() => {
      loadStats();
    }, 3000);
    
    setRefreshInterval(interval);
    console.log('Started auto-refresh for upload stats');
  };

  const stopAutoRefresh = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
      console.log('Stopped auto-refresh for upload stats');
    }
  };

  const loadSettings = async () => {
    try {
      const currentSettings = await autoUploadService.getSettings();
      setSettings(currentSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const currentStats = await autoUploadService.getUploadStats();
      setStats(currentStats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const updateSetting = async (key: keyof AutoUploadSettings, value: any) => {
    try {
      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);
      
      await autoUploadService.updateSettings({ [key]: value });
      
      // Reload stats after settings change
      await loadStats();
      
      console.log(`Updated ${key} to:`, value);
    } catch (error) {
      console.error(`Failed to update ${key}:`, error);
      Alert.alert('Error', `Failed to update ${key} setting`);
    }
  };

  const handleEnableToggle = async (enabled: boolean) => {
    if (enabled) {
      if (!isStandalone) {
        // Show info about demo mode when running in Expo Go
        Alert.alert(
          'Auto-Upload (Demo Mode)',
          'Auto-upload is running in demo mode. For full functionality with camera roll access, build the standalone app. For now, you can explore the settings and test the interface.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Enable Demo', 
              onPress: async () => {
                const initialized = await autoUploadService.initialize();
                if (initialized) {
                  await updateSetting('enabled', true);
                }
              }
            }
          ]
        );
      } else {
        // Standalone app - enable full functionality
        const initialized = await autoUploadService.initialize();
        if (initialized) {
          await updateSetting('enabled', true);
        } else {
          Alert.alert('Error', 'Failed to initialize auto-upload. Please check permissions.');
        }
      }
    } else {
      await updateSetting('enabled', false);
    }
  };

  const clearCompleted = async () => {
    try {
      await autoUploadService.clearCompleted();
      await loadStats();
      Alert.alert('Success', 'Cleared completed uploads from queue');
    } catch (error) {
      console.error('Failed to clear completed:', error);
      Alert.alert('Error', 'Failed to clear completed uploads');
    }
  };

  const manualScan = async () => {
    try {
      console.log('Manual scan triggered from UI');
      await autoUploadService.manualScan();
      await loadStats();
      Alert.alert('Success', 'Manual scan completed. Check upload statistics for new items.');
    } catch (error) {
      console.error('Failed to perform manual scan:', error);
      Alert.alert('Error', 'Failed to perform manual scan');
    }
  };

  const renderQualityOption = (quality: 'high' | 'medium' | 'low', label: string, description: string) => (
    <TouchableOpacity
      key={quality}
      style={[
        styles.qualityOption,
        settings.qualitySetting === quality && styles.qualityOptionSelected
      ]}
      onPress={() => updateSetting('qualitySetting', quality)}
    >
      <View style={styles.qualityOptionContent}>
        <Text style={[
          styles.qualityOptionLabel,
          settings.qualitySetting === quality && styles.qualityOptionLabelSelected
        ]}>
          {label}
        </Text>
        <Text style={[
          styles.qualityOptionDescription,
          settings.qualitySetting === quality && styles.qualityOptionDescriptionSelected
        ]}>
          {description}
        </Text>
      </View>
      {settings.qualitySetting === quality && (
        <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
      )}
    </TouchableOpacity>
  );

  const renderDailyLimitOption = (limit: number) => (
    <TouchableOpacity
      key={limit}
      style={[
        styles.limitOption,
        settings.dailyLimit === limit && styles.limitOptionSelected
      ]}
      onPress={() => updateSetting('dailyLimit', limit)}
    >
      <Text style={[
        styles.limitOptionText,
        settings.dailyLimit === limit && styles.limitOptionTextSelected
      ]}>
        {limit === 0 ? 'Unlimited' : `${limit} MB`}
      </Text>
      {settings.dailyLimit === limit && (
        <Ionicons name="checkmark-circle" size={20} color="#007AFF" />
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Auto-Upload Settings</Text>
          <View style={styles.closeButton} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Auto-Upload Settings</Text>
        <View style={styles.closeButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Mode Status Notice */}
        <View style={[styles.section, isStandalone ? styles.standaloneNotice : styles.demoNotice]}>
          <Ionicons 
            name={isStandalone ? "checkmark-circle" : "information-circle"} 
            size={20} 
            color={isStandalone ? "#34C759" : "#FFA500"} 
          />
          <Text style={isStandalone ? styles.standaloneNoticeText : styles.demoNoticeText}>
            {isStandalone 
              ? "Standalone App: Full camera roll access available" 
              : "Demo Mode: Camera roll access is simulated"
            }
          </Text>
        </View>

        {/* Main Toggle */}
        <View style={styles.section}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Auto-Upload</Text>
              <Text style={styles.settingDescription}>
                Automatically upload new photos from camera roll
              </Text>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={handleEnableToggle}
              trackColor={{ false: '#767577', true: '#007AFF' }}
              thumbColor={settings.enabled ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        {settings.enabled && (
          <>
            {/* Network Settings */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Network Preferences</Text>
              
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>WiFi Only</Text>
                  <Text style={styles.settingDescription}>
                    Only upload when connected to WiFi
                  </Text>
                </View>
                <Switch
                  value={settings.wifiOnly}
                  onValueChange={(value) => updateSetting('wifiOnly', value)}
                  trackColor={{ false: '#767577', true: '#007AFF' }}
                  thumbColor={settings.wifiOnly ? '#fff' : '#f4f3f4'}
                />
              </View>
            </View>

            {/* Quality Settings */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Upload Quality</Text>
              {renderQualityOption('high', 'High Quality', 'Original resolution, larger file sizes')}
              {renderQualityOption('medium', 'Medium Quality', 'Balanced quality and file size')}
              {renderQualityOption('low', 'Low Quality', 'Compressed, smaller file sizes')}
            </View>

            {/* Daily Limit */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Daily Upload Limit</Text>
              <View style={styles.limitOptions}>
                {[25, 50, 100, 200, 0].map(renderDailyLimitOption)}
              </View>
            </View>

            {/* Upload Statistics */}
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Upload Statistics</Text>
                <View style={styles.refreshIndicator}>
                  {refreshInterval && (
                    <>
                      <View style={styles.activityDot} />
                      <Text style={styles.refreshText}>Live</Text>
                    </>
                  )}
                </View>
              </View>
              
              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, stats.totalQueued > 0 && styles.statValueActive]}>
                    {stats.totalQueued}
                  </Text>
                  <Text style={styles.statLabel}>Queued</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stats.totalCompleted}</Text>
                  <Text style={styles.statLabel}>Completed</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, stats.totalFailed > 0 && styles.statValueError]}>
                    {stats.totalFailed}
                  </Text>
                  <Text style={styles.statLabel}>Failed</Text>
                </View>
              </View>

              <View style={styles.dailyUsage}>
                <Text style={styles.dailyUsageText}>
                  Today: {stats.uploadedsToday.toFixed(1)} MB / {stats.dailyLimitMB === 0 ? '∞' : `${stats.dailyLimitMB} MB`}
                </Text>
                {stats.dailyLimitMB > 0 && (
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { width: `${Math.min(100, (stats.uploadedsToday / stats.dailyLimitMB) * 100)}%` }
                      ]} 
                    />
                  </View>
                )}
              </View>

              <View style={styles.buttonRow}>
                {stats.totalCompleted > 0 && (
                  <TouchableOpacity style={styles.clearButton} onPress={clearCompleted}>
                    <Text style={styles.clearButtonText}>Clear Completed</Text>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity style={styles.scanButton} onPress={manualScan}>
                  <Text style={styles.scanButtonText}>Scan Now</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How It Works</Text>
          <Text style={styles.infoText}>
            Auto-upload monitors your camera roll for new photos and uploads them in the background. 
            Photos are processed with AI-powered face recognition, object detection, and metadata extraction.
          </Text>
          <Text style={styles.infoText}>
            • Background sync continues when app is closed{'\n'}
            • Duplicate detection prevents re-uploading{'\n'}
            • Failed uploads are retried automatically{'\n'}
            • Network and battery-aware scheduling
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000', // Back to black
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  closeButton: {
    padding: 8,
    width: 40,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#999',
    fontSize: 16,
  },
  section: {
    backgroundColor: '#111',
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  refreshIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34C759',
    marginRight: 6,
  },
  refreshText: {
    color: '#34C759',
    fontSize: 12,
    fontWeight: '500',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  settingDescription: {
    color: '#999',
    fontSize: 14,
    marginTop: 2,
  },
  qualityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 8,
  },
  qualityOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#1a237e',
  },
  qualityOptionContent: {
    flex: 1,
  },
  qualityOptionLabel: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  qualityOptionLabelSelected: {
    color: '#007AFF',
  },
  qualityOptionDescription: {
    color: '#999',
    fontSize: 14,
    marginTop: 2,
  },
  qualityOptionDescriptionSelected: {
    color: '#7bb3ff',
  },
  limitOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  limitOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#222',
  },
  limitOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#1a237e',
  },
  limitOptionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    marginRight: 4,
  },
  limitOptionTextSelected: {
    color: '#007AFF',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  statValueActive: {
    color: '#007AFF',
  },
  statValueError: {
    color: '#FF3B30',
  },
  statLabel: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
  },
  dailyUsage: {
    marginBottom: 16,
  },
  dailyUsageText: {
    color: '#999',
    fontSize: 14,
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  clearButton: {
    backgroundColor: '#333',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  clearButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  scanButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  scanButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  infoText: {
    color: '#999',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  comingSoonNotice: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  comingSoonTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  comingSoonText: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  featurePreview: {
    marginTop: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  featureText: {
    color: '#666',
    fontSize: 16,
    marginLeft: 12,
  },
  featureTextActive: {
    color: '#007AFF',
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '500',
  },
  demoNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 12,
  },
  demoNoticeText: {
    color: '#FFA500',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  standaloneNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d2818',
    padding: 12,
  },
  standaloneNoticeText: {
    color: '#34C759',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
});