import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  SafeAreaView
} from 'react-native';

interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: any;
}

class DebugLogger {
  private logs: LogEntry[] = [];
  private listeners: ((logs: LogEntry[]) => void)[] = [];

  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    };
    
    this.logs.push(entry);
    
    // Keep only last 100 logs
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(-100);
    }
    
    // Notify listeners
    this.listeners.forEach(listener => listener([...this.logs]));
    
    // Also log to console
    console.log(`[${level.toUpperCase()}] ${message}`, data || '');
  }

  subscribe(listener: (logs: LogEntry[]) => void) {
    this.listeners.push(listener);
    listener([...this.logs]);
    
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  getLogs() {
    return [...this.logs];
  }

  clear() {
    this.logs = [];
    this.listeners.forEach(listener => listener([]));
  }
}

export const debugLogger = new DebugLogger();

interface DebugPanelProps {
  visible: boolean;
  onClose: () => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ visible, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const unsubscribe = debugLogger.subscribe(setLogs);
    return unsubscribe;
  }, []);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return '#ff4444';
      case 'warn': return '#ffaa00';
      case 'info': return '#0066cc';
      case 'debug': return '#666';
      default: return '#999';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Debug Logs</Text>
          <TouchableOpacity onPress={() => debugLogger.clear()} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
          {logs.map((log, index) => (
            <View key={index} style={styles.logEntry}>
              <View style={styles.logHeader}>
                <Text style={styles.logTime}>{formatTime(log.timestamp)}</Text>
                <Text style={[styles.logLevel, { color: getLevelColor(log.level) }]}>
                  {log.level.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.logMessage}>{log.message}</Text>
              {log.data && (
                <Text style={styles.logData}>
                  {typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2)}
                </Text>
              )}
            </View>
          ))}
          {logs.length === 0 && (
            <Text style={styles.emptyText}>No logs yet</Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
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
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerButtonText: {
    color: '#0066cc',
    fontSize: 16,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  logEntry: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  logTime: {
    color: '#666',
    fontSize: 12,
    fontFamily: 'Courier',
  },
  logLevel: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Courier',
  },
  logMessage: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'Courier',
  },
  logData: {
    color: '#999',
    fontSize: 12,
    fontFamily: 'Courier',
    marginTop: 4,
    paddingLeft: 8,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
  },
});