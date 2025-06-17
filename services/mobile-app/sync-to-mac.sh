#!/bin/bash

# Sync script for Linux → Mac mobile app development
# Replace these with your actual values

MAC_USER="stephen"  # Your Mac username
MAC_IP="192.168.40.234"  # Your Mac's IP address
MAC_HOST="mac"  # SSH hostname
MAC_PATH="/Users/stephen/photo-process/services/mobile-app"  # Path on Mac

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔄 Syncing mobile app to Mac...${NC}"

# Use SSH config hostname directly (since you confirmed it works)
MAC_TARGET="${MAC_USER}@${MAC_HOST}"
echo -e "${GREEN}✅ Using SSH hostname: ${MAC_HOST}${NC}"

# Create target directory if it doesn't exist
ssh ${MAC_TARGET} 'mkdir -p /Users/stephen/photo-process/services/mobile-app'

# Sync files (excluding node_modules for speed)
rsync -av --delete \
    --exclude node_modules \
    --exclude .expo \
    --exclude .git \
    /mnt/hdd/photo-process/services/mobile-app/ \
    ${MAC_TARGET}:${MAC_PATH}/

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Sync completed successfully${NC}"
    echo -e "${YELLOW}📱 On Mac, run: cd ${MAC_PATH} && npx expo start${NC}"
    echo -e "${GREEN}📋 Next steps:${NC}"
    echo "  1. On Mac: Install Expo CLI if needed: npm install -g @expo/cli"
    echo "  2. On iPhone: Install 'Expo Go' from App Store"
    echo "  3. On Mac: cd ${MAC_PATH} && npx expo start"
    echo "  4. On iPhone: Scan QR code to load app"
else
    echo -e "${RED}❌ Sync failed${NC}"
    echo "Make sure:"
    echo "  - Mac SSH is enabled: sudo systemsetup -setremotelogin on"
    echo "  - SSH hostname 'mac' resolves or IP ${MAC_IP} is correct"
    echo "  - SSH key or password access works"
    echo ""
    echo "Test SSH connection:"
    echo "  ssh stephen@mac"
    echo "  # or"
    echo "  ssh stephen@${MAC_IP}"
fi