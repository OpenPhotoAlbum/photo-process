# Welcome to Photo Management Platform

A self-hosted photo management platform with AI-powered face recognition, object detection, and smart organization capabilities.

## 🚀 **Quick Start**

Get the platform running in minutes:

```bash
# 1. Start all services with Docker
npm run dev

# 2. Run database migrations
npm run db:migrate

# 3. Verify everything is working
curl http://localhost:9000/api/persons
curl http://localhost:8001  # CompreFace UI
```

## 🏗️ **Platform Architecture**

Modern microservices platform architecture with Docker orchestration:

```
photo-process/
├── services/                   # Microservices
│   ├── api/                   # TypeScript API service
│   ├── mobile-app/            # React Native mobile app
│   ├── processing/            # Background processing service (planned)
│   └── web-app/               # React frontend (planned)
├── infrastructure/            # Infrastructure as code
│   ├── database/             # MySQL with migrations
│   ├── compreface/           # Face recognition service
│   └── search/               # Search service (planned)
├── platform-docs/           # Complete documentation
├── platform-tests/          # Testing infrastructure  
├── platform-tools/          # Development and maintenance tools
└── shared/                   # Shared resources and utilities
```

## ✨ **Features**

- **AI-Powered Face Recognition** - CompreFace integration for automatic face detection and identification
- **Object Detection** - YOLO-based object detection using TensorFlow.js
- **Smart Albums** - Auto-generated albums based on content analysis
- **Hash-Based Storage** - Efficient file organization preventing duplicates
- **RESTful API** - Complete TypeScript API with comprehensive endpoints
- **Docker Support** - Full container orchestration for easy deployment
- **Comprehensive Testing** - Jest framework with 93+ passing tests

## 📋 **Current Status**

- ✅ **Backend API** - Full TypeScript API with face recognition and object detection
- ✅ **Database** - MySQL with complete schema (15+ migrations)
- ✅ **AI Services** - CompreFace face recognition fully integrated
- ✅ **Mobile App** - React Native app with Expo for iOS and Android
- ✅ **Docker Setup** - Complete container orchestration
- ✅ **Tools & Testing** - Comprehensive development toolkit
- 🔄 **Frontend** - React app ready to be built in `services/web-app/`

## 🔗 **Next Steps**

- [Configuration Guide](/docs/configuration) - Set up your environment
- [Mobile App](/docs/mobile-app/overview) - Get photos on your iPhone
- [API Reference](/docs/api/overview) - Explore the REST API
- [Development Setup](/docs/development/setup) - Contributing to the platform
- [Deployment Guide](/docs/deployment) - Production deployment