# Development Setup

This guide will help you set up a development environment for the Photo Management Platform.

## Prerequisites

- **Node.js** (v18 or higher)
- **Docker** and Docker Compose
- **Git**
- **MySQL** (via Docker)

## Quick Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd photo-process
npm install
```

### 2. Environment Setup

```bash
# Run development setup script
npm run dev:setup

# Copy environment template
cp .env.example .env

# Edit .env with your settings
vim .env
```

### 3. Start Services

```bash
# Start all platform services
npm run dev

# This starts:
# - MySQL database
# - CompreFace face recognition service
# - API service
```

### 4. Initialize Database

```bash
# Run database migrations
npm run db:migrate

# Optional: Seed with sample data
npm run db:seed
```

### 5. Verify Setup

```bash
# Check API is responding
curl http://localhost:9000/api/persons

# Check CompreFace is running
curl http://localhost:8001

# Run tests
npm run test:unit
```

## Development Commands

### Database Management
- `npm run db:migrate` - Run database migrations
- `npm run db:rollback` - Rollback last migration
- `npm run db:seed` - Run database seeds
- `npm run db:reset` - Reset database completely

### Testing
- `npm run test:unit` - Run unit tests
- `npm run test:integration` - Run integration tests
- `npm run test:coverage` - Generate coverage report

### Cleanup Tools
- `npm run cleanup:menu` - Interactive cleanup menu
- `npm run cleanup:local-data` - Clear local data only
- `npm run cleanup:fresh-start` - Complete system reset

## File Structure

```
photo-process/
├── services/api/           # Main API service
├── infrastructure/         # Docker services
├── platform-tools/        # Development tools
├── platform-tests/        # Test suites
└── platform-docs/         # Documentation
```

## Common Issues

### Port Conflicts
- API runs on port 9000
- CompreFace UI on port 8001
- MySQL on port 3307

### Database Connection
Make sure MySQL is running:
```bash
npm run db:status
```

### CompreFace Connection
Verify CompreFace is accessible:
```bash
curl http://localhost:8001/api/v1/recognition/subjects
```