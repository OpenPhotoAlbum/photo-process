// API Configuration

import Constants from 'expo-constants';

// Define available API endpoints
export const API_ENDPOINTS = {
  development: 'http://192.168.40.103:9000',    // Local development
  production: 'https://api.theyoungs.photos',   // Cloudflare tunnel for production
  fallback: 'https://theyoungs.photos'          // Fallback endpoint
};

// Environment detection function
const getEnvironment = (): 'development' | 'production' => {
  // TEMPORARY DEBUG: Force development endpoint for standalone debugging
  // TODO: Remove this override after debugging network issues
  if (Constants.executionEnvironment === 'standalone') {
    console.log('🐛 [DEBUG] Forcing development endpoint for standalone debugging');
    return 'development';
  }
  
  // In development mode (Expo Go), use local endpoint
  if (__DEV__) {
    return 'development';
  }
  
  // Check execution environment for standalone builds
  const executionEnvironment = Constants.executionEnvironment;
  
  // For standalone builds (bare, standalone), use production endpoint
  if (executionEnvironment === 'bare' || executionEnvironment === 'standalone') {
    return 'production';
  }
  
  // Default to development for other cases
  return 'development';
};

// Automatically determine API base URL based on environment
export const API_BASE = API_ENDPOINTS[getEnvironment()];

// Helper function to get specific endpoint
export const getApiEndpoint = (env: 'development' | 'production' = getEnvironment()) => {
  return API_ENDPOINTS[env];
};

// Log current configuration for debugging
console.log('Environment Configuration:', {
  isDev: __DEV__,
  executionEnvironment: Constants.executionEnvironment,
  selectedEndpoint: API_BASE,
  detectedEnvironment: getEnvironment()
});

// Validate API_BASE
if (!API_BASE || API_BASE === 'unknown') {
  console.error('❌ Invalid API_BASE detected:', API_BASE);
  console.error('Environment details:', {
    __DEV__,
    executionEnvironment: Constants.executionEnvironment,
    endpoints: API_ENDPOINTS
  });
}