---
sidebar_position: 2
---

# Installation Guide

Get the Photo Management Platform running on your system in minutes.

## Prerequisites

Before starting, ensure you have these tools installed:

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="docker" label="🐳 Docker (Recommended)" default>
    ```bash
    # Install Docker
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    
    # Verify installation
    docker --version
    docker-compose --version
    ```
  </TabItem>
  <TabItem value="manual" label="⚙️ Manual Setup">
    ```bash
    # Node.js 18+
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    # Git
    sudo apt-get install git
    
    # MySQL (optional - can use Docker)
    sudo apt-get install mysql-server
    ```
  </TabItem>
</Tabs>

:::tip Recommended: Docker Approach
The Docker approach is **strongly recommended** as it handles all dependencies automatically and ensures consistent environments across different systems.
:::

## 🚀 Quick Installation

### Step 1: Clone Repository

```bash
git clone <repository-url>
cd photo-process
```

### Step 2: Environment Setup

```bash
# Run automated setup
npm run dev:setup

# Copy environment template
cp .env.example .env
```

:::warning Configure Your Environment
Edit the `.env` file with your specific settings:
```bash
# Required: Storage paths
MEDIA_SOURCE_DIR=/path/to/your/photos
MEDIA_PROCESSED_DIR=/path/to/processed/storage

# Required: Database credentials
MYSQL_PASSWORD=your-secure-password
```
:::

### Step 3: Start Platform

```bash
# Start all services (database, CompreFace, API)
npm run dev
```

This command starts:
- **MySQL Database** (port 3307)
- **CompreFace AI Service** (port 8001)
- **API Service** (port 9000)

### Step 4: Initialize Database

```bash
# Run database migrations
npm run db:migrate

# Optional: Add sample data
npm run db:seed
```

### Step 5: Verify Installation

<Tabs>
  <TabItem value="api" label="API Service" default>
    ```bash
    # Test API connection
    curl http://localhost:9000/api/persons
    
    # Expected response: {"persons": [], "total": 0}
    ```
  </TabItem>
  <TabItem value="compreface" label="CompreFace UI">
    ```bash
    # Test CompreFace
    curl http://localhost:8001
    
    # Or visit in browser: http://localhost:8001
    ```
  </TabItem>
  <TabItem value="database" label="Database">
    ```bash
    # Check database status
    npm run db:status
    
    # View database tables
    npm run db:shell
    ```
  </TabItem>
</Tabs>

## ✅ Verification Checklist

After installation, verify these components are working:

- [ ] **API Service** responding at http://localhost:9000
- [ ] **CompreFace UI** accessible at http://localhost:8001
- [ ] **Database** migrations completed successfully
- [ ] **File permissions** correct for source and processed directories
- [ ] **Environment variables** properly configured

:::tip Success!
If all checks pass, your Photo Management Platform is ready! 🎉

**Next step**: Learn how to [configure your platform](/docs/configuration/) for your specific needs.
:::

## 🛠️ Troubleshooting

### Common Issues

**Port Conflicts**
```bash
# Check what's using the ports
sudo netstat -tulpn | grep :9000
sudo netstat -tulpn | grep :8001
sudo netstat -tulpn | grep :3307
```

**Permission Issues**
```bash
# Fix directory permissions
sudo chown -R $USER:$USER /path/to/your/photos
chmod -R 755 /path/to/your/photos
```

**Database Connection**
```bash
# Restart database service
docker-compose -f docker-compose.platform.yml restart database

# Check database logs
docker-compose -f docker-compose.platform.yml logs database
```

:::info Need More Help?
- Check the [Configuration Guide](/docs/configuration/) for detailed setup options
- Visit [Development Setup](/docs/development/setup) for development environment
- See [Deployment Guide](/docs/deployment/) for production installation
:::

## 🔄 Alternative Installation Methods

### Production Deployment
For production environments, see the [Deployment Guide](/docs/deployment/).

### Development Setup
For contributing to the platform, see [Development Setup](/docs/development/setup).

### Manual Configuration
For custom setups without Docker, see [Configuration Guide](/docs/configuration/).