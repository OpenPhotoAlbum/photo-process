# Photo Management Platform API Service

FROM node:18-slim

# Install system dependencies for image processing, ExifTool, and TensorFlow.js
RUN apt-get update && apt-get install -y \
    exiftool \
    libvips-dev \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --omit=dev

# Expose port
EXPOSE 9000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:9000/api/health || exit 1

# Start the application
CMD ["npm", "start"]