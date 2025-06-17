# Quick Start Guide - Mobile App Testing

## Network Setup ✅
- **Linux (Photo Server)**: 192.168.40.103:9000 ← iPhone connects here (wireless IP)
- **Mac (Build Server)**: 192.168.40.234 (hostname: mac)
- **iPhone**: Same network, will use Expo Go
- **API Connection**: iPhone → Linux wireless IP (192.168.40.103)

## Step-by-Step Testing

### 1. Mac Setup (5 minutes)
```bash
# On your Mac:
# Install development tools if needed
brew install node watchman
npm install -g @expo/cli

# Verify SSH is enabled  
sudo systemsetup -setremotelogin on

# Create project directory
mkdir -p /Users/stephen/photo-process/services/mobile-app
```

### 2. Sync Code from Linux (1 minute)
```bash
# On your Linux machine:
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

### 3. Start Development Server on Mac (2 minutes)
```bash
# On your Mac:
cd /Users/stephen/photo-process/services/mobile-app
npx expo start
```

You should see:
- QR code in terminal
- Development server running on Mac
- Metro bundler ready

### 4. Install and Test on iPhone (2 minutes)
1. **Install Expo Go** from App Store (if not already installed)
2. **Open Expo Go** app
3. **Scan QR code** from Mac terminal
4. **App should load** showing one of your photos

## Expected Results

### ✅ Success:
- App loads on iPhone via Expo Go
- Shows "Loading photo..." briefly
- Displays a real photo from your processed collection
- Shows metadata at bottom: filename, date, face/object counts
- Photo is full-screen and interactive

### 🔍 Troubleshooting:

**If app shows "Failed to load photo":**
- Check photo server is running: `docker compose -f docker-compose.platform.yml up -d`
- Test API directly: `curl http://192.168.40.6:9000/api/gallery?limit=1`

**If sync fails:**
- Test SSH: `ssh stephen@mac` from Linux
- Check Mac SSH: `sudo systemsetup -getremotelogin` (should be "On")

**If Expo won't start:**
- Check Node.js: `node --version` (should be 16+)
- Install Expo CLI: `npm install -g @expo/cli`

## Network Flow Diagram
```
iPhone (Expo Go) 
    ↓ 
Mac (192.168.40.234) - Metro bundler serves app
    ↓
Linux (192.168.40.6:9000) - Photo API serves data
    ↓
Photos displayed on iPhone
```

## Success Milestone 🎯

When this works, you'll have:
- ✅ Your real photos on your iPhone
- ✅ Proven Linux → Mac → iPhone pipeline
- ✅ Foundation for rapid Phase 1 development
- ✅ Mobile-first photo management in your hands!

Time to test: **~10 minutes total** 📱🚀