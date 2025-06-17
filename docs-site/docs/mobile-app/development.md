# Development Workflow

This guide covers the day-to-day development workflow for the mobile app, including code synchronization, testing strategies, and common development tasks.

## Development Environment

### Hybrid Development Setup

The mobile app uses a unique hybrid development approach optimized for the project's infrastructure:

- **Linux (Primary)**: Code editing, Git management, API server
- **Mac (Build Server)**: Expo development server, iOS building
- **iPhone (Testing)**: Live testing via Expo Go

This setup leverages the strengths of each platform while maintaining efficient development cycles.

## Daily Development Workflow

### 1. Start Development Session

```bash
# 1. On Linux: Ensure photo server is running
docker compose -f docker-compose.platform.yml up -d

# 2. Verify server health
sleep 3 && curl -s http://localhost:9000/api/gallery?limit=1 > /dev/null && echo "✅ Server ready" || echo "❌ Server issue"

# 3. Navigate to mobile app directory
cd /mnt/hdd/photo-process/services/mobile-app
```

### 2. Make Code Changes

Edit code on Linux using your preferred editor:

```bash
# Common files you'll edit:
vim App.tsx              # Main app component
vim components/          # React Native components
vim types/              # TypeScript interfaces
vim services/           # API integration
```

### 3. Sync and Test

```bash
# Sync changes to Mac
./sync-to-mac.sh

# On Mac: Development server will auto-reload
# Your iPhone will automatically refresh with changes
```

### 4. Monitor and Debug

```bash
# Linux: Monitor API logs during mobile testing
docker compose -f docker-compose.platform.yml logs -f api

# Look for mobile app requests in the logs
```

## Code Synchronization

### Automatic Sync Script

The `sync-to-mac.sh` script handles efficient code synchronization:

```bash
#!/bin/bash
# Example sync script usage
./sync-to-mac.sh
```

What it does:
- Uses rsync for fast, incremental updates
- Excludes node_modules and build artifacts
- Preserves file permissions and timestamps
- Provides clear success/failure feedback

### Manual Sync (if needed)

```bash
# Alternative manual sync command
rsync -av --exclude node_modules --exclude .expo /mnt/hdd/photo-process/services/mobile-app/ username@mac-ip:/path/to/mobile-app/
```

## Development Server Management

### Starting the Server (Mac)

```bash
# Navigate to synced directory
cd /Users/your_username/photo-process/services/mobile-app

# Start Expo development server
npx expo start

# Alternative: Start with cache clearing
npx expo start --clear
```

### Development Server Features

- **Hot Reloading**: Changes appear instantly on device
- **Error Overlay**: JavaScript errors shown on device screen
- **Debug Menu**: Shake device or press Cmd+D for debug options
- **Network Inspector**: Monitor API calls and responses

## Testing Strategies

### 1. Live Device Testing

Primary testing method using iPhone:

```bash
# Benefits:
- Real device performance
- Actual touch interactions
- True network conditions
- Camera and sensor access
```

### 2. API Integration Testing

Test mobile app API integration:

```bash
# From Linux: Test endpoints mobile app uses
curl http://localhost:9000/api/gallery?limit=10
curl http://localhost:9000/api/persons
curl http://localhost:9000/api/search/objects?query=person

# Monitor mobile requests in API logs
docker compose -f docker-compose.platform.yml logs -f api | grep "mobile\|app"
```

### 3. Error Scenario Testing

Test error handling by simulating failures:

```bash
# Stop photo server to test network errors
docker compose -f docker-compose.platform.yml stop api

# Restart to test recovery
docker compose -f docker-compose.platform.yml start api
```

## Common Development Tasks

### Adding New Features

Typical workflow for adding features:

```bash
# 1. Create feature branch
git checkout -b feature/photo-grid

# 2. Edit code on Linux
vim components/PhotoGrid.tsx

# 3. Add TypeScript types
vim types/api.ts

# 4. Sync and test
./sync-to-mac.sh

# 5. Test on iPhone via Expo Go

# 6. Commit changes
git add .
git commit -m "Add photo grid component"
```

### API Integration

When adding new API endpoints:

```bash
# 1. Test API endpoint from Linux
curl http://localhost:9000/api/new-endpoint

# 2. Add TypeScript interfaces
vim types/api.ts

# 3. Create service function
vim services/api.ts

# 4. Integrate in components
vim components/ComponentName.tsx

# 5. Sync and test
./sync-to-mac.sh
```

### Debugging

Common debugging approaches:

```bash
# 1. View JavaScript console on device
# Shake device → Debug Remote JS → Chrome DevTools

# 2. Check network requests
# Mobile app errors often relate to API connectivity

# 3. Monitor Linux API logs
docker compose -f docker-compose.platform.yml logs -f api

# 4. Test API directly
curl -v http://LINUX_IP:9000/api/endpoint
```

## Performance Optimization

### Development Performance

```bash
# Clear Metro bundler cache if needed
npx expo start --clear

# Optimize sync by excluding unnecessary files
# (Already configured in sync-to-mac.sh)
```

### App Performance

Monitor these areas during development:

- **Image Loading**: Use appropriate image sizes
- **API Response Times**: Monitor in Linux logs
- **Memory Usage**: Check in Expo development tools
- **Network Usage**: Minimize unnecessary API calls

## Code Organization

### File Structure

```
services/mobile-app/
├── App.tsx                 # Main app component
├── components/            # Reusable React Native components
├── screens/               # Screen-level components
├── services/              # API integration
├── types/                 # TypeScript definitions
├── utils/                 # Helper functions
├── assets/                # Images, fonts, etc.
└── sync-to-mac.sh        # Development sync script
```

### TypeScript Integration

The app uses TypeScript for type safety:

```typescript
// Example: API response types
interface GalleryResponse {
  photos: Photo[];
  total: number;
  page: number;
}

interface Photo {
  id: string;
  filename: string;
  dateTaken?: string;
  faces?: Face[];
  objects?: DetectedObject[];
}
```

## Git Workflow

### Branch Strategy

```bash
# Feature development
git checkout -b feature/search-functionality
# ... develop and test ...
git push origin feature/search-functionality

# Bug fixes
git checkout -b fix/image-loading-error
# ... fix and test ...
git push origin fix/image-loading-error
```

### Commit Guidelines

```bash
# Good commit messages for mobile app
git commit -m "feat: add photo grid with infinite scroll"
git commit -m "fix: handle network errors gracefully"  
git commit -m "perf: optimize image loading performance"
git commit -m "docs: update mobile app setup guide"
```

## Troubleshooting Development Issues

### Common Issues and Solutions

**Metro bundler won't start:**
```bash
# Clear cache and restart
npx expo start --clear
```

**Changes not appearing on device:**
```bash
# Force reload on iPhone
# Shake device → Reload
```

**API calls failing:**
```bash
# Check Linux server status
docker compose -f docker-compose.platform.yml ps

# Verify network connectivity
ping LINUX_IP
```

**Sync script fails:**
```bash
# Test SSH connection
ssh username@mac-ip

# Check Mac SSH settings
sudo systemsetup -getremotelogin
```

## Development Tips

### Efficient Development

1. **Keep servers running**: Leave photo server and Expo server running during development
2. **Use console.log strategically**: Add logging for debugging, remove before commits
3. **Test on real device**: Simulator can't match real device behavior
4. **Monitor API logs**: Understanding backend behavior helps mobile debugging

### Code Quality

1. **TypeScript**: Use proper typing for API responses
2. **Error Handling**: Always handle network and API errors gracefully
3. **Loading States**: Provide feedback during async operations
4. **Responsive Design**: Test on different screen sizes

## Advanced Development

### Custom Builds

For advanced features, you can create custom builds:

```bash
# On Mac: Create development build
npx expo run:ios

# Create production build for testing
npx eas build --platform ios --profile preview
```

### Performance Profiling

```bash
# Enable performance monitoring
npx expo start --dev-client

# Use React Native Performance tab in dev tools
```

The development workflow is designed for rapid iteration while maintaining code quality and testing rigor. The hybrid Linux-Mac-iPhone approach provides the best of all platforms for efficient mobile development.