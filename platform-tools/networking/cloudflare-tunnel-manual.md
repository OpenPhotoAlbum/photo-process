# Cloudflare Tunnel Setup for theyoungs.photos

## Step 1: Add Domain to Cloudflare ✅
You've created the account! Now:
1. Add `theyoungs.photos` to your Cloudflare dashboard
2. Update your domain's nameservers at your registrar to Cloudflare's nameservers
3. Wait for DNS to propagate (usually 5-30 minutes)

## Step 2: Install Cloudflared

Run these commands in your terminal:

```bash
# Download cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared

# Make it executable
chmod +x cloudflared

# Move to system path (requires sudo)
sudo mv cloudflared /usr/local/bin/

# Verify installation
cloudflared --version
```

## Step 3: Authenticate with Cloudflare

```bash
# This will open a browser - log in and authorize the domain
cloudflared tunnel login
```

## Step 4: Create Your Tunnel

```bash
# Create a tunnel named "photo-platform"
cloudflared tunnel create photo-platform

# List tunnels to get the ID
cloudflared tunnel list
```

## Step 5: Configure the Tunnel

Create the config file:

```bash
mkdir -p ~/.cloudflared
nano ~/.cloudflared/config.yml
```

Add this content (replace YOUR-TUNNEL-ID with the ID from step 4):

```yaml
tunnel: ea3e004c-7fe6-4e96-84b0-4c59109b312a
credentials-file: /home/stephen/.cloudflared/ea3e004c-7fe6-4e96-84b0-4c59109b312a.json

ingress:
  # Main API endpoint
  - hostname: api.theyoungs.photos
    service: http://localhost:9000
    
  # Root domain
  - hostname: theyoungs.photos
    service: http://localhost:9000
    
  # Future web app
  - hostname: app.theyoungs.photos
    service: http://localhost:3000
    
  # Catch-all
  - service: http_status:404
```

## Step 6: Create DNS Records

```bash
# Route the tunnel to your subdomains
cloudflared tunnel route dns photo-platform api.theyoungs.photos
cloudflared tunnel route dns photo-platform theyoungs.photos
```

## Step 7: Test the Tunnel

```bash
# Run in foreground to test
cloudflared tunnel run photo-platform

# You should see:
# INF Connection established
# INF Each HA connection's tunnel IDs: [...]
```

## Step 8: Run as a Service (Optional)

```bash
# Install as systemd service
sudo cloudflared service install

# Start the service
sudo systemctl start cloudflared
sudo systemctl enable cloudflared

# Check status
sudo systemctl status cloudflared
```

## Step 9: Update Mobile App Config

Edit `services/mobile-app/config.ts`:

```typescript
// Old local network config
// export const API_BASE = 'http://192.168.40.103:9000';

// New public HTTPS config
export const API_BASE = 'https://api.theyoungs.photos';
```

## Success! 🎉

Your photo platform will be accessible at:
- **API**: https://api.theyoungs.photos
- **Main**: https://theyoungs.photos

With automatic HTTPS, no port forwarding needed!