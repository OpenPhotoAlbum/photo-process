import React from 'react';
import {
    ActivityIndicator,
    View,
    Text,
    ScrollView
} from 'react-native';

import { Image } from '../../components';
import { styles } from './Gallery.styles';
import { useFetchPhotos } from '../../hooks';

interface GalleryProps { }

export const Gallery: React.FC<GalleryProps> = () => {
    // Basic usage
    const {
        photos,
        loading,
        loadingMore,
        refreshing,
        error,
        hasMore,
        totalCount,
        failedImages,

        // Actions
        fetchPhotos,
        loadMore,
        refresh,
        setFilters: updateFilters,
        markImageAsFailed,
        clearFailedImages,
    } = useFetchPhotos({
        pageSize: 50,
        autoLoad: true,
        initialFilters: {
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
        }
    });

    console.log('\n', 'BANG PHOTOS', '\n');
    console.log(photos)



    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0066CC" />
                <Text>Loading photos...</Text>
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
            <View style={styles.container}>
                <View style={styles.gridContainer}>
                    {photos.map((photo) => (
                        <View style={styles.gridItem} key={photo.id}>
                            <Image {...photo} />
                        </View>
                    ))}
                </View>
            </View>
        </ScrollView>
    );
};
