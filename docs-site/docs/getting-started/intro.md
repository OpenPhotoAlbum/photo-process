---
sidebar_position: 1
---

# Welcome to Photo Management Platform

A **self-hosted photo management platform** with AI-powered face recognition, object detection, and smart organization capabilities.

## 🎯 What is Photo Management Platform?

Photo Management Platform is a modern, self-hosted solution for managing your personal photo collection with **digital independence**. Break free from Big Tech photo storage while building intelligent personal photo management.

:::tip Why Self-Hosted?
- **Privacy**: Your photos stay on your hardware
- **Control**: No vendor lock-in or subscription fees  
- **Intelligence**: AI-powered organization without surveillance
- **Unlimited**: No storage limits except your hardware
:::

## ✨ Key Features

### 🤖 AI-Powered Organization
- **Face Recognition** - Automatic face detection and person identification
- **Object Detection** - Find photos by objects ("cat", "beach", "car")
- **Smart Albums** - Auto-generated collections based on content
- **Screenshot Detection** - Automatically categorize screenshots

### 🔧 Technical Excellence
- **Hash-Based Storage** - Eliminates duplicate files efficiently
- **RESTful API** - Complete TypeScript API with comprehensive endpoints
- **Docker Native** - Full container orchestration for easy deployment
- **Comprehensive Testing** - Jest framework with 93+ passing tests

### 🚀 Modern Architecture
- **Microservices** - Clean separation of concerns
- **TypeScript** - Type-safe development experience
- **MySQL Database** - Robust data persistence with migrations
- **Mobile-First** - React Native app for iOS with hybrid development workflow
- **React Frontend** - Modern web interface (in development)

## 📋 Current Status

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="completed" label="✅ Completed" default>
    - **Backend API** - Full TypeScript API with face recognition and object detection
    - **Database** - MySQL with complete schema (15+ migrations)
    - **AI Services** - CompreFace face recognition fully integrated
    - **Mobile App** - React Native app with Expo for iOS access to your photos
    - **Docker Setup** - Complete container orchestration
    - **Tools & Testing** - Comprehensive development toolkit
  </TabItem>
  <TabItem value="in-progress" label="🔄 In Progress">
    - **Frontend** - React app ready to be built in `services/web-app/`
    - **Advanced Search** - Enhanced search with filters and faceting
    - **Performance** - Background processing improvements
  </TabItem>
</Tabs>

## 🚀 Quick Start

Ready to get started? Let's get your platform running in minutes:

```bash
# 1. Start all services with Docker
npm run dev

# 2. Run database migrations
npm run db:migrate

# 3. Verify everything is working
curl http://localhost:9000/api/persons
curl http://localhost:8001  # CompreFace UI
```

:::info Prerequisites
Make sure you have **Docker**, **Node.js 18+**, and **Git** installed before starting.
:::

## 🔗 What's Next?

<div className="row">
  <div className="col col--4">
    <div className="text--center">
      <h3>🛠️ Setup Your Environment</h3>
      <p>Get the platform running on your system</p>
      <a className="button button--primary" href="/docs/getting-started/installation">
        Installation Guide
      </a>
    </div>
  </div>
  <div className="col col--4">
    <div className="text--center">
      <h3>📱 Mobile App</h3>
      <p>Access your photos on iPhone with React Native</p>
      <a className="button button--secondary" href="/docs/mobile-app/overview">
        Mobile App Guide
      </a>
    </div>
  </div>
  <div className="col col--4">
    <div className="text--center">
      <h3>📖 Learn the Platform</h3>
      <p>Understand photo management features</p>
      <a className="button button--outline" href="/docs/user-guide/photo-management">
        User Guide
      </a>
    </div>
  </div>
</div>

---

:::tip Need Help?
Check out our [Development Setup](/docs/development/setup) for contributing to the platform or visit the [API Reference](/docs/api/overview) for technical details.
:::