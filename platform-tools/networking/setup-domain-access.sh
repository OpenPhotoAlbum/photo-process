#!/bin/bash

echo "Photo Platform Domain Setup Guide"
echo "================================="
echo ""
echo "Since you have your own domain, here are the BEST options:"
echo ""

echo "OPTION 1: Cloudflare Tunnel (RECOMMENDED - No port forwarding needed)"
echo "-------------------------------------------------------------------"
echo "1. Add your domain to Cloudflare (free account)"
echo "   - Change nameservers at your registrar to Cloudflare's"
echo ""
echo "2. Install cloudflared:"
echo "   wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb"
echo "   sudo dpkg -i cloudflared-linux-amd64.deb"
echo ""
echo "3. Authenticate with Cloudflare:"
echo "   cloudflared tunnel login"
echo ""
echo "4. Create a tunnel:"
echo "   cloudflared tunnel create photo-platform"
echo "   # This creates a tunnel ID, save it!"
echo ""
echo "5. Create config file:"
cat > /tmp/cloudflared-config.yml << 'EOF'
tunnel: YOUR-TUNNEL-ID
credentials-file: /home/$USER/.cloudflared/YOUR-TUNNEL-ID.json

ingress:
  # Main photo platform
  - hostname: photos.yourdomain.com
    service: http://localhost:9000
  # If you want to add more services later
  - hostname: api.photos.yourdomain.com
    service: http://localhost:9000
  # Catch-all
  - service: http_status:404
EOF
echo "   Save this as: ~/.cloudflared/config.yml"
echo ""
echo "6. Create DNS record:"
echo "   cloudflared tunnel route dns photo-platform photos.yourdomain.com"
echo ""
echo "7. Run as a service:"
echo "   sudo cloudflared service install"
echo "   sudo systemctl start cloudflared"
echo ""
echo "✅ Access at: https://photos.yourdomain.com (HTTPS automatic!)"
echo ""

echo "OPTION 2: Reverse Proxy with Caddy (If you want to self-host)"
echo "-------------------------------------------------------------"
echo "1. Install Caddy:"
echo "   sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https"
echo "   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg"
echo "   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list"
echo "   sudo apt update && sudo apt install caddy"
echo ""
echo "2. Configure Caddy (/etc/caddy/Caddyfile):"
cat > /tmp/Caddyfile << 'EOF'
photos.yourdomain.com {
    reverse_proxy localhost:9000
    
    # Optional: Basic authentication
    # basicauth {
    #     username $2a$14$HASH_HERE
    # }
    
    # Optional: File upload size limit
    request_body {
        max_size 100MB
    }
}

# Mobile app API endpoint (if needed separately)
api.photos.yourdomain.com {
    reverse_proxy localhost:9000
    
    # CORS for mobile app
    header {
        Access-Control-Allow-Origin *
        Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
        Access-Control-Allow-Headers *
    }
}
EOF
echo ""
echo "3. Set up port forwarding on router:"
echo "   - Forward port 80 → $(hostname -I | awk '{print $1}'):80"
echo "   - Forward port 443 → $(hostname -I | awk '{print $1}'):443"
echo ""
echo "4. Point domain to your IP:"
echo "   - A record: photos.yourdomain.com → $(curl -s ifconfig.me)"
echo "   - Or use Dynamic DNS if your IP changes"
echo ""
echo "5. Start Caddy:"
echo "   sudo systemctl enable --now caddy"
echo ""
echo "✅ Access at: https://photos.yourdomain.com (Auto HTTPS!)"
echo ""

echo "OPTION 3: Docker Compose with Traefik (Production Setup)"
echo "-------------------------------------------------------"
cat > /tmp/docker-compose.traefik.yml << 'EOF'
version: '3.8'

services:
  traefik:
    image: traefik:v2.10
    container_name: traefik
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik/acme.json:/acme.json
      - ./traefik/traefik.yml:/etc/traefik/traefik.yml
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.dashboard.rule=Host(`traefik.yourdomain.com`)"
      - "traefik.http.routers.dashboard.service=api@internal"
      - "traefik.http.routers.dashboard.tls.certresolver=letsencrypt"

  api:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=Host(`photos.yourdomain.com`)"
      - "traefik.http.routers.api.tls=true"
      - "traefik.http.routers.api.tls.certresolver=letsencrypt"
      - "traefik.http.services.api.loadbalancer.server.port=9000"
EOF
echo ""

echo "Mobile App Configuration Update"
echo "=============================="
echo ""
echo "Update config.ts in your mobile app:"
echo ""
cat > /tmp/mobile-config-update.ts << 'EOF'
// services/mobile-app/config.ts

// For development (local network)
// export const API_BASE = 'http://192.168.40.103:9000';

// For production (with domain)
export const API_BASE = 'https://photos.yourdomain.com';

// Alternative endpoints
export const API_ENDPOINTS = {
  production: 'https://photos.yourdomain.com',
  development: 'http://192.168.40.103:9000',
  staging: 'https://staging.photos.yourdomain.com'
};

// Dynamic selection based on environment
export const getApiBase = () => {
  if (__DEV__) {
    return API_ENDPOINTS.development;
  }
  return API_ENDPOINTS.production;
};
EOF

echo ""
echo "Security Recommendations"
echo "======================="
echo "1. Use Cloudflare Tunnel - it's the most secure, no exposed ports"
echo "2. Enable Cloudflare's security features:"
echo "   - Under Attack Mode (if needed)"
echo "   - Rate limiting"
echo "   - Bot Fight Mode"
echo "3. Add authentication to your app (basic auth or JWT)"
echo "4. Use environment-specific configs for API endpoints"
echo ""
echo "Which option would you like detailed help with?"