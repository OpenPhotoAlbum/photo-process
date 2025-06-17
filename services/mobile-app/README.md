# Photo Management Mobile App

React Native app built with Expo for viewing and managing photos from the photo processing platform.

## Development Workflow

### Linux + Mac Hybrid Development

**Linux (Primary Development):**
- Code editing and Git management
- API server runs here (`docker compose up -d`)

**Mac (iOS Building):**
- Expo development server
- iOS Simulator and device testing

### Setup Steps

#### 1. Mac Preparation
```bash
# Install Node.js and Expo CLI
brew install node watchman
npm install -g @expo/cli

# Enable SSH for remote access
sudo systemsetup -setremotelogin on
```

#### 2. Network Configuration
The app connects to your Linux machine where the photo server runs:

```bash
# Linux machine wireless IP: 192.168.40.103 (use this one!)
# Linux machine wired IP: 192.168.40.6 (not accessible from other devices)
# Mac IP: 192.168.40.234
# API_BASE configured: http://192.168.40.103:9000
```

#### 3. Sync Code to Mac
```bash
# From Linux, sync to Mac
rsync -av /mnt/hdd/photo-process/services/mobile-app/ username@mac-ip:/path/to/mobile-app/

# Or use the sync script (create below)
./sync-to-mac.sh
```

#### 4. Run on Mac
```bash
# On Mac
cd /path/to/mobile-app
npx expo start

# Scan QR code with Expo Go app on iPhone
```

## Features

### Current (Minimal App)
- ✅ Connects to photo processing API
- ✅ Displays single photo from gallery
- ✅ Shows photo metadata (filename, date, faces, objects)
- ✅ Error handling with helpful messages

### Planned (Phase 1 - Trust & Reliability)
- [ ] Photo grid with infinite scroll
- [ ] Basic search functionality  
- [ ] Person management and face assignment
- [ ] Processing status monitoring
- [ ] "Recently processed" views

## API Integration

Connects to the existing photo processing backend:
- **Gallery**: `GET /api/gallery` - Photo listing
- **Media**: `GET /media/{id}` - Photo files
- **Search**: `GET /api/search/*` - Search functionality
- **Persons**: `GET /api/persons` - Person management

## Error Handling

The app includes comprehensive error handling for:
- Network connectivity issues
- API server not running
- No photos in gallery
- Image loading failures

## Development Notes

- **TypeScript**: Full type safety with React Native
- **Mobile-First**: Optimized for iPhone usage patterns
- **Vision Alignment**: Follows VISION.md Phase 1 goals
- **Code Sharing**: Structured for future web app code reuse