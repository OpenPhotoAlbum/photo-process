import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE } from '../config';
import { MediaItem, GalleryResponse, FilterOptions } from '../types';

interface UseFetchPhotosOptions {
  initialFilters?: FilterOptions;
  pageSize?: number;
  autoLoad?: boolean;
}

interface UseFetchPhotosResult {
  photos: MediaItem[];
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  error: string | null;
  hasMore: boolean;
  totalCount: number;
  failedImages: Set<number>;
  
  // Actions
  fetchPhotos: (reset?: boolean, customFilters?: FilterOptions) => Promise<void>;
  loadMore: () => void;
  refresh: () => Promise<void>;
  setFilters: (filters: FilterOptions) => void;
  markImageAsFailed: (imageId: number) => void;
  clearFailedImages: () => void;
}

const DEFAULT_FILTERS: FilterOptions = {
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

export const useFetchPhotos = (options: UseFetchPhotosOptions = {}): UseFetchPhotosResult => {
  const { 
    initialFilters = DEFAULT_FILTERS, 
    pageSize = 24,
    autoLoad = true 
  } = options;

  // State management
  const [photos, setPhotos] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFiltersState] = useState<FilterOptions>(initialFilters);
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());
  
  // Refs for managing async state
  const cursorRef = useRef<string | null>(null);
  const isLoadingMoreRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Build URL parameters from filters
  const buildFilterParams = useCallback((
    currentFilters: FilterOptions, 
    cursor: string | null
  ): URLSearchParams => {
    const params = new URLSearchParams();
    params.set('limit', pageSize.toString());
    
    if (cursor) {
      params.set('cursor', cursor);
    }
    
    // Date range filters
    if (currentFilters.dateRange.enabled) {
      if (currentFilters.dateRange.startDate) {
        params.set('startDate', currentFilters.dateRange.startDate.toISOString().split('T')[0]);
      }
      if (currentFilters.dateRange.endDate) {
        params.set('endDate', currentFilters.dateRange.endDate.toISOString().split('T')[0]);
      }
    }
    
    // Location filters
    if (currentFilters.location.enabled) {
      if (currentFilters.location.hasGPS !== null) {
        params.set('hasGPS', currentFilters.location.hasGPS.toString());
      }
      if (currentFilters.location.selectedCities.length > 0) {
        params.set('cities', currentFilters.location.selectedCities.join(','));
      }
    }
    
    // User filters
    if (currentFilters.user.enabled && currentFilters.user.selectedUsers.length > 0) {
      params.set('users', currentFilters.user.selectedUsers.join(','));
    }
    
    // Sort parameters
    params.set('sortBy', currentFilters.sort.field);
    params.set('sortOrder', currentFilters.sort.direction);
    
    return params;
  }, [pageSize]);

  // Main fetch function
  const fetchPhotos = useCallback(async (
    reset: boolean = false, 
    customFilters?: FilterOptions
  ): Promise<void> => {
    const activeFilters = customFilters || filters;
    
    // Prevent duplicate requests
    if (isLoadingMoreRef.current && !reset) {
      console.log('[useFetchPhotos] Already loading, skipping...');
      return;
    }
    
    // Cancel any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    
    try {
      if (!reset) {
        isLoadingMoreRef.current = true;
        setLoadingMore(true);
      }
      
      const currentCursor = reset ? null : cursorRef.current;
      const params = buildFilterParams(activeFilters, currentCursor);
      const url = `${API_BASE}/api/gallery?${params.toString()}`;
      
      console.log('[useFetchPhotos] Fetching:', { reset, cursor: currentCursor, url });
      
      const response = await fetch(url, {
        signal: abortControllerRef.current.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: GalleryResponse = await response.json();
      
      console.log('[useFetchPhotos] Response:', {
        imageCount: data.images.length,
        totalCount: data.totalCount,
        hasMore: data.hasMore,
        nextCursor: data.nextCursor
      });
      
      // Update total count
      if (data.totalCount) {
        setTotalCount(data.totalCount);
      }
      
      if (reset) {
        // Replace all photos when resetting
        setPhotos(data.images);
      } else {
        // Append new photos, avoiding duplicates
        setPhotos(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newImages = data.images.filter(img => !existingIds.has(img.id));
          return [...prev, ...newImages];
        });
      }
      
      setHasMore(data.hasMore);
      cursorRef.current = data.nextCursor;
      setError(null);
      
    } catch (err: any) {
      // Ignore abort errors
      if (err.name === 'AbortError') {
        console.log('[useFetchPhotos] Request aborted');
        return;
      }
      
      console.error('[useFetchPhotos] Fetch error:', err);
      setError(err.message || 'Failed to load photos');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
      isLoadingMoreRef.current = false;
    }
  }, [filters, buildFilterParams]);

  // Load more photos
  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && !isLoadingMoreRef.current) {
      console.log('[useFetchPhotos] Loading more...');
      fetchPhotos(false);
    }
  }, [loadingMore, hasMore, fetchPhotos]);

  // Refresh photos
  const refresh = useCallback(async () => {
    console.log('[useFetchPhotos] Refreshing...');
    setRefreshing(true);
    cursorRef.current = null;
    await fetchPhotos(true);
  }, [fetchPhotos]);

  // Update filters
  const setFilters = useCallback((newFilters: FilterOptions) => {
    console.log('[useFetchPhotos] Updating filters:', newFilters);
    setFiltersState(newFilters);
  }, []);

  // Mark image as failed
  const markImageAsFailed = useCallback((imageId: number) => {
    setFailedImages(prev => {
      const newSet = new Set(prev);
      newSet.add(imageId);
      return newSet;
    });
  }, []);

  // Clear failed images
  const clearFailedImages = useCallback(() => {
    setFailedImages(new Set());
  }, []);

  // Initial load effect
  useEffect(() => {
    if (autoLoad) {
      fetchPhotos(true);
    }
    
    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []); // Only run on mount

  // Reload when filters change
  useEffect(() => {
    if (!autoLoad) return;
    
    console.log('[useFetchPhotos] Filters changed, reloading...');
    cursorRef.current = null;
    setHasMore(true);
    isLoadingMoreRef.current = false;
    fetchPhotos(true, filters);
  }, [filters, autoLoad]); // Remove fetchPhotos from deps to avoid infinite loop

  return {
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
    setFilters,
    markImageAsFailed,
    clearFailedImages
  };
};