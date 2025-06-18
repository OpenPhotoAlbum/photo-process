const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable package exports field support to avoid compatibility issues
config.resolver.unstable_enablePackageExports = false;

module.exports = config;