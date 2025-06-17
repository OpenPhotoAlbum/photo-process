# Mobile App Overview

The Photo Management Mobile App is a React Native application built with Expo that provides mobile access to your photo processing platform. It allows you to view, search, and manage your photos directly from your iPhone or Android device.

## Key Features

### Current Features (Minimal App)
- ✅ **API Integration**: Connects to your photo processing backend
- ✅ **Photo Display**: Shows photos from your gallery with metadata
- ✅ **Error Handling**: Comprehensive error handling with helpful messages
- ✅ **TypeScript Support**: Full type safety throughout the app

### Planned Features (Phase 1)
- 📱 **Photo Grid**: Infinite scroll through your photo collection
- 🔍 **Search**: Basic search functionality for finding photos
- 👥 **Person Management**: View and assign faces to people
- 📊 **Processing Status**: Monitor photo processing progress
- 🕐 **Recent Activity**: View recently processed photos

## Architecture

The mobile app follows a hybrid development approach:

```
📱 iPhone (Expo Go)
    ↓
💻 Mac (Development Server)
    ↓
🐧 Linux (Photo Processing API)
    ↓
📸 Your Photos
```

### Development Workflow
- **Linux**: Primary development environment, code editing, and Git management
- **Mac**: Expo development server and iOS building
- **iPhone**: Testing and usage via Expo Go app

## API Integration

The mobile app integrates with your existing photo processing backend through these endpoints:

- **Gallery**: `GET /api/gallery` - Photo listing and pagination
- **Media**: `GET /media/{id}` - Serving photo files and thumbnails
- **Search**: `GET /api/search/*` - Search functionality
- **Persons**: `GET /api/persons` - Person and face management

## Technology Stack

- **React Native**: Cross-platform mobile development
- **Expo**: Development tooling and deployment
- **TypeScript**: Type safety and better developer experience
- **Metro**: JavaScript bundler for React Native

## Vision Alignment

The mobile app aligns with the project's vision of **digital independence with smart organization**:

- **Break free from Big Tech**: Access your photos without relying on cloud services
- **Smart Organization**: Leverage AI-powered face recognition and object detection
- **Personal Control**: Your photos stay on your infrastructure
- **Mobile-First**: Optimized for the way you actually use photos

## Getting Started

Ready to set up the mobile app? Continue to the [Setup Guide](./setup.md) to get started with development and testing.