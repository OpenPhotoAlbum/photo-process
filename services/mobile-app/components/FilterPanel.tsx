import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

export interface FilterOptions {
  dateRange: {
    enabled: boolean;
    startDate: Date | null;
    endDate: Date | null;
  };
  location: {
    enabled: boolean;
    hasGPS: boolean | null; // null = all, true = with GPS, false = without GPS
    selectedCities: string[];
  };
  sort: {
    field: 'date_taken' | 'filename' | 'date_processed';
    direction: 'desc' | 'asc';
  };
}

interface FilterPanelProps {
  visible: boolean;
  onClose: () => void;
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  availableCities: string[];
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  visible,
  onClose,
  filters,
  onFiltersChange,
  availableCities
}) => {
  const [localFilters, setLocalFilters] = useState<FilterOptions>(filters);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Update local state when filters prop changes
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const updateFilters = (updates: Partial<FilterOptions>) => {
    const newFilters = { ...localFilters, ...updates };
    setLocalFilters(newFilters);
  };

  const applyFilters = () => {
    onFiltersChange(localFilters);
    onClose();
  };

  const resetFilters = () => {
    const defaultFilters: FilterOptions = {
      dateRange: {
        enabled: false,
        startDate: null,
        endDate: null
      },
      location: {
        enabled: false,
        hasGPS: null,
        selectedCities: []
      },
      sort: {
        field: 'date_taken',
        direction: 'desc'
      }
    };
    setLocalFilters(defaultFilters);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Select date';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (localFilters.dateRange.enabled) count++;
    if (localFilters.location.enabled) count++;
    return count;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Filter & Sort</Text>
          <TouchableOpacity onPress={resetFilters} style={styles.headerButton}>
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Date Range Filter */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📅 Date Range</Text>
              <Switch
                value={localFilters.dateRange.enabled}
                onValueChange={(enabled) =>
                  updateFilters({
                    dateRange: { ...localFilters.dateRange, enabled }
                  })
                }
                trackColor={{ false: '#333', true: '#0066CC' }}
                thumbColor="white"
              />
            </View>

            {localFilters.dateRange.enabled && (
              <View style={styles.dateSection}>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => {
                    console.log('Opening start date picker');
                    setShowStartDatePicker(true);
                  }}
                >
                  <Text style={styles.dateLabel}>From:</Text>
                  <Text style={styles.dateValue}>
                    {formatDate(localFilters.dateRange.startDate)}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => {
                    console.log('Opening end date picker');
                    setShowEndDatePicker(true);
                  }}
                >
                  <Text style={styles.dateLabel}>To:</Text>
                  <Text style={styles.dateValue}>
                    {formatDate(localFilters.dateRange.endDate)}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Location Filter */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📍 Location</Text>
              <Switch
                value={localFilters.location.enabled}
                onValueChange={(enabled) =>
                  updateFilters({
                    location: { ...localFilters.location, enabled }
                  })
                }
                trackColor={{ false: '#333', true: '#0066CC' }}
                thumbColor="white"
              />
            </View>

            {localFilters.location.enabled && (
              <View style={styles.locationSection}>
                <Text style={styles.subSectionTitle}>GPS Data</Text>
                <View style={styles.buttonGroup}>
                  <TouchableOpacity
                    style={[
                      styles.filterChip,
                      localFilters.location.hasGPS === null && styles.filterChipActive
                    ]}
                    onPress={() =>
                      updateFilters({
                        location: { ...localFilters.location, hasGPS: null }
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        localFilters.location.hasGPS === null && styles.filterChipTextActive
                      ]}
                    >
                      All Photos
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.filterChip,
                      localFilters.location.hasGPS === true && styles.filterChipActive
                    ]}
                    onPress={() =>
                      updateFilters({
                        location: { ...localFilters.location, hasGPS: true }
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        localFilters.location.hasGPS === true && styles.filterChipTextActive
                      ]}
                    >
                      With Location
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.filterChip,
                      localFilters.location.hasGPS === false && styles.filterChipActive
                    ]}
                    onPress={() =>
                      updateFilters({
                        location: { ...localFilters.location, hasGPS: false }
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        localFilters.location.hasGPS === false && styles.filterChipTextActive
                      ]}
                    >
                      No Location
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.subSectionTitle}>
                  Cities ({availableCities.length} available)
                </Text>
                {availableCities.length > 0 ? (
                    <View style={styles.citiesContainer}>
                      {availableCities.slice(0, 10).map((city) => (
                        <TouchableOpacity
                          key={city}
                          style={[
                            styles.cityChip,
                            localFilters.location.selectedCities.includes(city) &&
                              styles.cityChipActive
                          ]}
                          onPress={() => {
                            const selected = localFilters.location.selectedCities;
                            const newSelected = selected.includes(city)
                              ? selected.filter(c => c !== city)
                              : [...selected, city];
                            updateFilters({
                              location: {
                                ...localFilters.location,
                                selectedCities: newSelected
                              }
                            });
                          }}
                        >
                          <Text
                            style={[
                              styles.cityChipText,
                              localFilters.location.selectedCities.includes(city) &&
                                styles.cityChipTextActive
                            ]}
                          >
                            {city}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                ) : (
                  <Text style={styles.noDataText}>Loading cities...</Text>
                )}
              </View>
            )}
          </View>

          {/* Sort Options */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔄 Sort</Text>
            
            <Text style={styles.subSectionTitle}>Sort by</Text>
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  localFilters.sort.field === 'date_taken' && styles.filterChipActive
                ]}
                onPress={() =>
                  updateFilters({
                    sort: { ...localFilters.sort, field: 'date_taken' }
                  })
                }
              >
                <Text
                  style={[
                    styles.filterChipText,
                    localFilters.sort.field === 'date_taken' && styles.filterChipTextActive
                  ]}
                >
                  Date Taken
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterChip,
                  localFilters.sort.field === 'date_processed' && styles.filterChipActive
                ]}
                onPress={() =>
                  updateFilters({
                    sort: { ...localFilters.sort, field: 'date_processed' }
                  })
                }
              >
                <Text
                  style={[
                    styles.filterChipText,
                    localFilters.sort.field === 'date_processed' && styles.filterChipTextActive
                  ]}
                >
                  Date Processed
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterChip,
                  localFilters.sort.field === 'filename' && styles.filterChipActive
                ]}
                onPress={() =>
                  updateFilters({
                    sort: { ...localFilters.sort, field: 'filename' }
                  })
                }
              >
                <Text
                  style={[
                    styles.filterChipText,
                    localFilters.sort.field === 'filename' && styles.filterChipTextActive
                  ]}
                >
                  Filename
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.subSectionTitle}>Order</Text>
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  localFilters.sort.direction === 'desc' && styles.filterChipActive
                ]}
                onPress={() =>
                  updateFilters({
                    sort: { ...localFilters.sort, direction: 'desc' }
                  })
                }
              >
                <Text
                  style={[
                    styles.filterChipText,
                    localFilters.sort.direction === 'desc' && styles.filterChipTextActive
                  ]}
                >
                  Newest First
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterChip,
                  localFilters.sort.direction === 'asc' && styles.filterChipActive
                ]}
                onPress={() =>
                  updateFilters({
                    sort: { ...localFilters.sort, direction: 'asc' }
                  })
                }
              >
                <Text
                  style={[
                    styles.filterChipText,
                    localFilters.sort.direction === 'asc' && styles.filterChipTextActive
                  ]}
                >
                  Oldest First
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Apply Button */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
            <Text style={styles.applyButtonText}>
              Apply Filters {getActiveFilterCount() > 0 && `(${getActiveFilterCount()})`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Date Pickers */}
        {showStartDatePicker && (
          <>
            {console.log('Rendering start date picker')}
            <DateTimePicker
            value={localFilters.dateRange.startDate || new Date()}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowStartDatePicker(false);
              if (selectedDate) {
                updateFilters({
                  dateRange: {
                    ...localFilters.dateRange,
                    startDate: selectedDate
                  }
                });
              }
            }}
          />
          </>
        )}

        {showEndDatePicker && (
          <>
            {console.log('Rendering end date picker')}
            <DateTimePicker
            value={localFilters.dateRange.endDate || new Date()}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowEndDatePicker(false);
              if (selectedDate) {
                updateFilters({
                  dateRange: {
                    ...localFilters.dateRange,
                    endDate: selectedDate
                  }
                });
              }
            }}
          />
          </>
        )}
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
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  resetText: {
    color: '#0066CC',
    fontSize: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  subSectionTitle: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    marginTop: 16,
  },
  dateSection: {
    gap: 12,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#222',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  dateLabel: {
    color: '#999',
    fontSize: 16,
  },
  dateValue: {
    color: 'white',
    fontSize: 16,
  },
  locationSection: {
    gap: 8,
  },
  buttonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#222',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#444',
  },
  filterChipActive: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC',
  },
  filterChipText: {
    color: '#999',
    fontSize: 14,
  },
  filterChipTextActive: {
    color: 'white',
  },
  citiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cityChip: {
    backgroundColor: '#222',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#444',
  },
  cityChipActive: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC',
  },
  cityChipText: {
    color: '#999',
    fontSize: 12,
  },
  cityChipTextActive: {
    color: 'white',
  },
  noDataText: {
    color: '#888',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  applyButton: {
    backgroundColor: '#0066CC',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});