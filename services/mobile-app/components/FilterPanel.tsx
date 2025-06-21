import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Switch,
  TextInput,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ModalLayers } from '../constants/ModalLayers';
import { FilterOptions } from '../types';

interface FilterPanelProps {
  visible: boolean;
  onClose: () => void;
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  availableCities: string[];
  onCitySearch?: (search: string) => void;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  visible,
  onClose,
  filters,
  onFiltersChange,
  availableCities,
  onCitySearch
}) => {
  const [localFilters, setLocalFilters] = useState<FilterOptions>(filters);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  
  // City search state
  const [citySearchText, setCitySearchText] = useState('');
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [filteredCities, setFilteredCities] = useState<string[]>([]);

  // Update local state when filters prop changes
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Debug visibility changes
  useEffect(() => {
    console.log('FilterPanel visibility changed:', visible);
  }, [visible]);

  // Handle city search with debouncing for server-side search
  useEffect(() => {
    const searchTimer = setTimeout(() => {
      if (onCitySearch && citySearchText.trim() !== '') {
        // Use server-side search for better performance with large datasets
        onCitySearch(citySearchText.trim());
      }
    }, 300); // 300ms debounce

    // For immediate local filtering while waiting for server response
    if (citySearchText.trim() === '') {
      // Show all cities when no search (for organic discovery)
      const sortedCities = [...availableCities].sort((a, b) => a.localeCompare(b));
      setFilteredCities(sortedCities);
    } else {
      const searchLower = citySearchText.toLowerCase();
      const filtered = availableCities
        .filter(city => city.toLowerCase().includes(searchLower))
        .sort((a, b) => {
          // Prioritize exact matches and start-with matches
          const aLower = a.toLowerCase();
          const bLower = b.toLowerCase();
          
          // Exact matches first
          if (aLower === searchLower) return -1;
          if (bLower === searchLower) return 1;
          
          // Starts with search term
          if (aLower.startsWith(searchLower) && !bLower.startsWith(searchLower)) return -1;
          if (bLower.startsWith(searchLower) && !aLower.startsWith(searchLower)) return 1;
          
          // Then alphabetical
          return a.localeCompare(b);
        });
      setFilteredCities(filtered);
    }

    return () => clearTimeout(searchTimer);
  }, [citySearchText, availableCities, onCitySearch]);

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
      user: {
        enabled: false,
        selectedUsers: []
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
    if (localFilters.user.enabled) count++;
    return count;
  };

  const addCity = (city: string) => {
    const selected = localFilters.location.selectedCities;
    if (!selected.includes(city)) {
      updateFilters({
        location: {
          ...localFilters.location,
          selectedCities: [...selected, city]
        }
      });
    }
    setCitySearchText('');
    setShowCityDropdown(false);
  };

  const removeCity = (city: string) => {
    updateFilters({
      location: {
        ...localFilters.location,
        selectedCities: localFilters.location.selectedCities.filter(c => c !== city)
      }
    });
  };

  // Debug: Add more explicit logging
  console.log('FilterPanel render called with visible:', visible);
  
  // Test if the issue is with Modal component by adding a simple test
  if (visible) {
    console.log('FilterPanel is visible, about to render modal');
  }
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      transparent={false}
      onShow={() => console.log('FilterPanel modal onShow called')}
      onDismiss={() => console.log('FilterPanel modal onDismiss called')}
      onRequestClose={() => {
        console.log('FilterPanel modal onRequestClose called');
        onClose();
      }}
      style={{ zIndex: ModalLayers.L2_FILTERS }}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Filters</Text>
          <TouchableOpacity style={styles.headerButton} onPress={resetFilters}>
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
                  Cities ({localFilters.location.selectedCities.length} selected)
                </Text>
                
                {/* Selected Cities */}
                {localFilters.location.selectedCities.length > 0 && (
                  <View style={styles.selectedCitiesContainer}>
                    {localFilters.location.selectedCities.map((city) => (
                      <TouchableOpacity
                        key={city}
                        style={styles.selectedCityChip}
                        onPress={() => removeCity(city)}
                      >
                        <Text style={styles.selectedCityText}>{city}</Text>
                        <Ionicons name="close" size={16} color="#999" />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                
                {/* City Search Input */}
                <View style={styles.citySearchContainer}>
                  <TextInput
                    style={styles.citySearchInput}
                    placeholder="Search cities..."
                    placeholderTextColor="#666"
                    value={citySearchText}
                    onChangeText={setCitySearchText}
                    onFocus={() => setShowCityDropdown(true)}
                  />
                  <TouchableOpacity
                    style={styles.citySearchButton}
                    onPress={() => setShowCityDropdown(!showCityDropdown)}
                  >
                    <Ionicons 
                      name={showCityDropdown ? "chevron-up" : "chevron-down"} 
                      size={20} 
                      color="#666" 
                    />
                  </TouchableOpacity>
                </View>
                
                {/* City Dropdown */}
                {showCityDropdown && (
                  <View style={styles.cityDropdownContainer}>
                    {filteredCities.length > 0 ? (
                      <>
                        <View style={styles.dropdownHeader}>
                          <Text style={styles.dropdownHeaderText}>
                            {citySearchText ? 
                              `${filteredCities.length} cities found` : 
                              `${filteredCities.length} cities available`
                            }
                          </Text>
                          <TouchableOpacity 
                            onPress={() => setShowCityDropdown(false)}
                            style={styles.dropdownCloseButton}
                          >
                            <Ionicons name="close" size={16} color="#666" />
                          </TouchableOpacity>
                        </View>
                        <FlatList
                          data={filteredCities}
                          keyExtractor={(item) => item}
                          style={styles.cityDropdown}
                          keyboardShouldPersistTaps="handled"
                          showsVerticalScrollIndicator={true}
                          initialNumToRender={10}
                          maxToRenderPerBatch={20}
                          windowSize={10}
                          getItemLayout={(data, index) => ({
                            length: 44, // Height of each item
                            offset: 44 * index,
                            index,
                          })}
                          renderItem={({ item: city }) => (
                            <TouchableOpacity
                              style={[
                                styles.cityDropdownItem,
                                localFilters.location.selectedCities.includes(city) && 
                                styles.cityDropdownItemSelected
                              ]}
                              onPress={() => addCity(city)}
                            >
                              <Text style={[
                                styles.cityDropdownText,
                                localFilters.location.selectedCities.includes(city) && 
                                styles.cityDropdownTextSelected
                              ]}>
                                {city}
                              </Text>
                              {localFilters.location.selectedCities.includes(city) && (
                                <Ionicons name="checkmark" size={16} color="#007AFF" />
                              )}
                            </TouchableOpacity>
                          )}
                        />
                      </>
                    ) : (
                      <Text style={styles.noResultsText}>
                        {citySearchText ? `No cities found for "${citySearchText}"` : 'Loading cities...'}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>

          {/* User Filter */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>👤 User</Text>
              <Switch
                value={localFilters.user.enabled}
                onValueChange={(enabled) =>
                  updateFilters({
                    user: { ...localFilters.user, enabled }
                  })
                }
                trackColor={{ false: '#333', true: '#0066CC' }}
                thumbColor="white"
              />
            </View>

            {localFilters.user.enabled && (
              <View style={styles.userSection}>
                <Text style={styles.subSectionTitle}>Upload Source</Text>
                <View style={styles.buttonGroup}>
                  {['stephen', 'cayce', 'google'].map((user) => (
                    <TouchableOpacity
                      key={user}
                      style={[
                        styles.filterChip,
                        localFilters.user.selectedUsers.includes(user) && styles.filterChipActive
                      ]}
                      onPress={() => {
                        const selected = localFilters.user.selectedUsers;
                        const newSelected = selected.includes(user)
                          ? selected.filter(u => u !== user)
                          : [...selected, user];
                        
                        console.log(`[FILTER] User filter: ${selected.includes(user) ? 'Removing' : 'Adding'} "${user}"`);
                        console.log(`[FILTER] Selected users will be: [${newSelected.join(', ')}]`);
                        
                        updateFilters({
                          user: {
                            ...localFilters.user,
                            selectedUsers: newSelected
                          }
                        });
                      }}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          localFilters.user.selectedUsers.includes(user) && styles.filterChipTextActive
                        ]}
                      >
                        {user.charAt(0).toUpperCase() + user.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                
                {localFilters.user.selectedUsers.length > 0 && (
                  <Text style={styles.filterHelpText}>
                    Showing photos from: {localFilters.user.selectedUsers.join(', ')}
                  </Text>
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
    position: 'relative',
    zIndex: 9999,
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
  userSection: {
    gap: 8,
  },
  filterHelpText: {
    color: '#666',
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
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
  selectedCitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  selectedCityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0066CC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  selectedCityText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  citySearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
    marginBottom: 8,
  },
  citySearchInput: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  citySearchButton: {
    padding: 10,
  },
  cityDropdownContainer: {
    backgroundColor: '#222',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
    maxHeight: 300, // Increased height for better browsing
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    backgroundColor: '#1a1a1a',
  },
  dropdownHeaderText: {
    color: '#999',
    fontSize: 12,
    fontWeight: '500',
  },
  dropdownCloseButton: {
    padding: 4,
  },
  cityDropdown: {
    maxHeight: 250, // Increased height minus header
  },
  cityDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  cityDropdownItemSelected: {
    backgroundColor: '#1a237e',
  },
  cityDropdownText: {
    color: 'white',
    fontSize: 14,
  },
  cityDropdownTextSelected: {
    color: '#007AFF',
    fontWeight: '500',
  },
  noResultsText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    padding: 16,
    fontStyle: 'italic',
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