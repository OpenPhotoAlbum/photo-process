export interface MediaItem {
    id: number;
    filename: string;
    date_taken: string | null;
    media_url: string;
    relative_media_path?: string;
    thumbnail_url?: string;
    dominant_color?: string;
    faces?: any[];
    objects?: any[];
}

export interface GalleryResponse {
    images: MediaItem[];
    hasMore: boolean;
    nextCursor: string | null;
    count: number;
    totalCount: number;
}

export interface Album {
    id: number;
    name: string;
    slug: string;
    description?: string;
    source: string;
    album_date?: string;
    image_count: number;
    actual_image_count: number;
}

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
    user: {
        enabled: boolean;
        selectedUsers: string[]; // stephen, cayce, google, etc.
    };
    sort: {
        field: 'date_taken' | 'filename' | 'date_processed';
        direction: 'desc' | 'asc';
    };
}