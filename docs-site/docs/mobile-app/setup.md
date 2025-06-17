# Mobile App Setup

This guide walks you through setting up the mobile app for development and testing. The setup involves three components: your Linux development machine, a Mac for iOS building, and your iPhone for testing.

## Prerequisites

### Hardware Requirements
- **Linux Machine**: Primary development environment (where your photo server runs)
- **Mac**: For iOS development and Expo server
- **iPhone**: For testing (with Expo Go app)
- **Network**: All devices on the same network

### Software Requirements

#### Linux Machine
- Photo processing server running (Docker Compose)
- Git repository with mobile app code
- rsync for syncing code to Mac

#### Mac
- Node.js (version 16 or higher)
- Expo CLI
- SSH enabled for remote access
- Watchman (for file watching)

#### iPhone
- Expo Go app from the App Store
- Same WiFi network as other devices

## Step-by-Step Setup

### 1. Mac Preparation

First, install the required development tools on your Mac:

```bash
# Install Node.js and Watchman via Homebrew
brew install node watchman

# Install Expo CLI globally
npm install -g @expo/cli

# Enable SSH for remote access from Linux
sudo systemsetup -setremotelogin on

# Verify SSH is enabled
sudo systemsetup -getremotelogin
# Should output: "Remote Login: On"
```

### 2. Network Configuration

Identify your network setup and IP addresses:

```bash
# On Linux: Find your wireless IP (this is what iPhone will connect to)
ip addr show | grep -E "inet.*wl|inet.*wifi"
# Example: 192.168.40.103

# On Mac: Find your IP address
ifconfig | grep "inet " | grep -v 127.0.0.1
# Example: inet 192.168.40.234

# Test connectivity from Mac to Linux
curl http://LINUX_IP:9000/api/gallery?limit=1
```

### 3. Update Configuration

Update the mobile app configuration with your network details:

```bash
# On Linux: Update sync script with your Mac's details
cd /mnt/hdd/photo-process/services/mobile-app
vim sync-to-mac.sh

# Update these variables:
MAC_IP="192.168.40.234"  # Your Mac's IP
MAC_USER="your_username" # Your Mac username
MAC_PATH="/Users/your_username/photo-process/services/mobile-app"
```

### 4. Verify Photo Server

Ensure your photo processing server is running:

```bash
# Start the photo processing platform
docker compose -f docker-compose.platform.yml up -d

# Verify API is responding
sleep 3 && curl -s http://localhost:9000/api/persons/unidentified?limit=1 > /dev/null && echo "✅ Server responding" || echo "❌ Server not responding"

# Test gallery endpoint
curl http://localhost:9000/api/gallery?limit=1
```

## First Sync and Test

### 1. Sync Code to Mac

From your Linux machine:

```bash
cd /mnt/hdd/photo-process/services/mobile-app
./sync-to-mac.sh
```

Expected output:
```
🔄 Syncing mobile app to Mac...
✅ Using SSH hostname: mac
✅ Sync completed successfully
📱 On Mac, run: cd /Users/stephen/photo-process/services/mobile-app && npx expo start
```

### 2. Start Development Server on Mac

On your Mac:

```bash
cd /Users/your_username/photo-process/services/mobile-app
npx expo start
```

You should see:
- QR code displayed in the terminal
- Development server running message
- Metro bundler ready

### 3. Test on iPhone

1. **Install Expo Go** from the App Store (if not already installed)
2. **Connect iPhone** to the same WiFi network
3. **Open Expo Go** app on your iPhone
4. **Scan QR code** displayed in Mac terminal
5. **App should load** and display a photo from your collection

## Expected Results

### ✅ Success Indicators

When everything is working correctly, you should see:

- App loads on iPhone via Expo Go
- Brief "Loading photo..." message
- Real photo from your processed collection displayed
- Photo metadata at bottom: filename, date, face/object counts
- Full-screen, interactive photo display

### 🔍 Troubleshooting

**App shows "Failed to load photo":**
```bash
# Check photo server status
docker compose -f docker-compose.platform.yml ps

# Test API directly
curl http://LINUX_IP:9000/api/gallery?limit=1

# Check server logs
docker compose -f docker-compose.platform.yml logs -f api
```

**Sync to Mac fails:**
```bash
# Test SSH connection
ssh your_username@MAC_IP

# Check Mac SSH status
sudo systemsetup -getremotelogin
```

**Expo won't start on Mac:**
```bash
# Check Node.js version
node --version  # Should be 16+

# Reinstall Expo CLI if needed
npm install -g @expo/cli

# Clear Metro cache
npx expo start --clear
```

**iPhone can't connect:**
- Ensure iPhone and Mac are on same WiFi network
- Try restarting Expo development server
- Check firewall settings on Mac

## Network Architecture

Understanding the network flow helps with troubleshooting:

```
iPhone (Expo Go)
    ↓ Connects to Mac for app bundle
Mac (192.168.40.234) - Metro bundler serves React Native app
    ↓ App makes API calls to Linux
Linux (192.168.40.103:9000) - Photo API serves data
    ↓ Serves actual photo files
Photos displayed on iPhone
```

## Next Steps

Once you have the basic setup working:

1. **Verify functionality**: Ensure photos load and metadata displays
2. **Test error handling**: Try stopping the photo server to see error messages
3. **Explore development workflow**: Make code changes on Linux and sync to Mac
4. **Review development guide**: Check [Development Workflow](./development.md) for ongoing development

## Quick Reference

### Useful Commands

```bash
# Linux: Sync code to Mac
./sync-to-mac.sh

# Mac: Start development server
npx expo start

# Linux: Check server status
docker compose -f docker-compose.platform.yml ps

# Linux: View API logs
docker compose -f docker-compose.platform.yml logs -f api
```

### Network IPs (Update with your values)
- Linux API: `http://192.168.40.103:9000`
- Mac Development: `192.168.40.234`
- iPhone: Connects via Expo Go

The setup process typically takes 10-15 minutes for first-time configuration. Once established, the sync-and-test cycle takes under 2 minutes for iterative development.