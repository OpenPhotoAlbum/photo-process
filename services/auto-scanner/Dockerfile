FROM node:18-alpine

WORKDIR /app

# Install curl for health checks and API calls
RUN apk add --no-cache curl

# Copy the scanner script
COPY auto-scanner.sh /app/
RUN chmod +x /app/auto-scanner.sh

# Set environment variables
ENV API_URL=http://api:9000
ENV BATCH_SIZE=100
ENV SCAN_INTERVAL=60
ENV MAX_CONCURRENT_BATCHES=1

# Run the scanner
CMD ["/app/auto-scanner.sh"]