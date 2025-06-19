// API Configuration

// For local development (on same network)
// export const API_BASE = 'http://192.168.40.103:9000';

// For production (via Cloudflare Tunnel) - ✅ TUNNEL IS RUNNING!
export const API_BASE = 'https://api.theyoungs.photos'; // Tunnel is working!

// Alternative endpoints for different environments
export const API_ENDPOINTS = {
  production: 'https://api.theyoungs.photos',
  local: 'http://192.168.40.103:9000',
  fallback: 'https://theyoungs.photos'
};

// Helper to switch between environments
export const getApiEndpoint = (env: 'production' | 'local' = 'local') => {
  return API_ENDPOINTS[env];
};f