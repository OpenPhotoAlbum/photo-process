import React from 'react';
import {
    ImageStyle,
    StyleProp,
    ImageErrorEventData,
} from 'react-native';

import { Image as ExpoImage } from 'expo-image';
import { API_BASE } from '../../config';
import { MediaItem } from '../../types';

interface ImageProps extends MediaItem {
    style?: StyleProp<ImageStyle>;
    onLoad?: (photo: ImageProps) => void;
    onLoadStart?: (photo: ImageProps) => void;
    onError?: (photo: ImageProps, error: ImageErrorEventData) => void;
}

export const Image: React.FC<ImageProps> = (photo) => {
    const backgroundColor = photo?.dominant_color || '#222';
    const url = `${API_BASE}${photo?.thumbnail_url || photo?.media_url}`;

    return (
        <ExpoImage
            source={{ uri: url }}
            style={{
                height: '100%',
                width: '100%',
                backgroundColor,
            }}
            contentFit="cover"
            transition={100}
            cachePolicy="memory-disk"
            priority="normal"
            allowDownscaling={true}
            onLoad={() => photo.onLoad ? photo.onLoad(photo) : {}}
            onLoadStart={() => photo.onLoadStart ? photo.onLoadStart(photo) : {}}
            onError={(error) => photo.onError ? photo.onError(photo, error) : {}}
        />
    );
};
