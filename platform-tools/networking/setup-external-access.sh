#!/bin/bash

echo "Photo Platform External Access Setup"
echo "===================================="
echo ""
echo "Choose your access method:"
echo "1. Cloudflare Tunnel (Recommended - Free, Secure, No port forwarding)"
echo "2. Tailscale VPN (Private network access only)"
echo "3. Ngrok (Quick testing, temporary URL)"
echo "4. Port Forwarding (Requires router access)"
echo ""
read -p "Select option (1-4): " choice

case $choice in
    1)
        echo "Setting up Cloudflare Tunnel..."
        echo ""
        echo "1. Install cloudflared:"
        echo "   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared"
        echo "   chmod +x cloudflared"
        echo "   sudo mv cloudflared /usr/local/bin/"
        echo ""
        echo "2. Login to Cloudflare:"
        echo "   cloudflared tunnel login"
        echo ""
        echo "3. Create tunnel:"
        echo "   cloudflared tunnel create photo-platform"
        echo ""
        echo "4. Create config file ~/.cloudflared/config.yml:"
        cat << 'EOF'
tunnel: <YOUR-TUNNEL-ID>
credentials-file: /home/$USER/.cloudflared/<YOUR-TUNNEL-ID>.json

ingress:
  - hostname: photos.yourdomain.com
    service: http://localhost:9000
  - service: http_status:404
EOF
        echo ""
        echo "5. Route traffic:"
        echo "   cloudflared tunnel route dns photo-platform photos.yourdomain.com"
        echo ""
        echo "6. Run tunnel:"
        echo "   cloudflared tunnel run photo-platform"
        ;;
        
    2)
        echo "Setting up Tailscale..."
        echo ""
        echo "1. Install:"
        echo "   curl -fsSL https://tailscale.com/install.sh | sh"
        echo ""
        echo "2. Start Tailscale:"
        echo "   sudo tailscale up"
        echo ""
        echo "3. Access from any Tailscale device:"
        echo "   http://$(hostname):9000"
        echo ""
        echo "4. Or use MagicDNS:"
        echo "   http://$(hostname).tailnet-name.ts.net:9000"
        ;;
        
    3)
        echo "Setting up Ngrok (temporary access)..."
        echo ""
        echo "1. Install ngrok:"
        echo "   wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz"
        echo "   tar xvzf ngrok-v3-stable-linux-amd64.tgz"
        echo "   sudo mv ngrok /usr/local/bin/"
        echo ""
        echo "2. Sign up at https://ngrok.com and get auth token"
        echo ""
        echo "3. Authenticate:"
        echo "   ngrok config add-authtoken YOUR_AUTH_TOKEN"
        echo ""
        echo "4. Run ngrok:"
        echo "   ngrok http 9000"
        echo ""
        echo "5. Use the provided URL (e.g., https://abc123.ngrok.io)"
        ;;
        
    4)
        echo "Setting up Port Forwarding..."
        echo ""
        echo "1. Get your local IP:"
        echo "   Local IP: $(hostname -I | awk '{print $1}')"
        echo ""
        echo "2. Configure your router:"
        echo "   - Forward external port 9000 to $(hostname -I | awk '{print $1}'):9000"
        echo "   - Some routers: 192.168.1.1 or 192.168.0.1"
        echo ""
        echo "3. Get your public IP:"
        echo "   Public IP: $(curl -s ifconfig.me)"
        echo ""
        echo "4. Set up Dynamic DNS (recommended):"
        echo "   - DuckDNS: https://www.duckdns.org"
        echo "   - No-IP: https://www.noip.com"
        echo ""
        echo "5. Access via: http://YOUR_PUBLIC_IP:9000"
        echo "   or http://yourname.duckdns.org:9000"
        ;;
esac

echo ""
echo "Mobile App Configuration:"
echo "========================"
echo ""
echo "Update API_BASE in your mobile app config:"
echo "- Cloudflare: https://photos.yourdomain.com"
echo "- Tailscale: http://$(hostname).tailnet-name.ts.net:9000"
echo "- Ngrok: https://YOUR-ID.ngrok.io"
echo "- Port Forward: http://yourpublicip:9000"
echo ""
echo "File: services/mobile-app/config.ts"