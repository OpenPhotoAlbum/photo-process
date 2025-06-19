#!/bin/bash

echo "Setting up theyoungs.photos with Cloudflare Tunnel"
echo "=================================================="
echo ""

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Step 1: Prerequisites${NC}"
echo "--------------------"
echo "1. Create a free Cloudflare account at https://cloudflare.com"
echo "2. Add theyoungs.photos to your Cloudflare account"
echo "3. Update your domain's nameservers to Cloudflare's (they'll show you which ones)"
echo ""
read -p "Press Enter when you've completed the above steps..."

echo -e "\n${BLUE}Step 2: Install Cloudflared${NC}"
echo "-------------------------"
echo "Running installation..."
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
rm cloudflared-linux-amd64.deb

echo -e "\n${BLUE}Step 3: Authenticate with Cloudflare${NC}"
echo "---------------------------------"
echo "This will open a browser window. Log in and select theyoungs.photos domain."
cloudflared tunnel login

echo -e "\n${BLUE}Step 4: Create the Tunnel${NC}"
echo "----------------------"
cloudflared tunnel create photo-platform

# Get tunnel ID
TUNNEL_ID=$(cloudflared tunnel list | grep photo-platform | awk '{print $1}')
echo -e "${GREEN}Tunnel created with ID: $TUNNEL_ID${NC}"

echo -e "\n${BLUE}Step 5: Create Configuration${NC}"
echo "-------------------------"
mkdir -p ~/.cloudflared

cat > ~/.cloudflared/config.yml << EOF
tunnel: $TUNNEL_ID
credentials-file: /home/$USER/.cloudflared/$TUNNEL_ID.json

ingress:
  # Main photo platform API
  - hostname: api.theyoungs.photos
    service: http://localhost:9000
    originRequest:
      noTLSVerify: true
      
  # Alternative without subdomain
  - hostname: theyoungs.photos
    service: http://localhost:9000
    originRequest:
      noTLSVerify: true
      
  # Future: Web app (when you build it)
  - hostname: app.theyoungs.photos
    service: http://localhost:3000
    originRequest:
      noTLSVerify: true
      
  # Catch-all
  - service: http_status:404
EOF

echo -e "${GREEN}Config file created at ~/.cloudflared/config.yml${NC}"

echo -e "\n${BLUE}Step 6: Create DNS Records${NC}"
echo "-----------------------"
echo "Creating DNS records in Cloudflare..."
cloudflared tunnel route dns photo-platform api.theyoungs.photos
cloudflared tunnel route dns photo-platform theyoungs.photos
cloudflared tunnel route dns photo-platform app.theyoungs.photos

echo -e "\n${BLUE}Step 7: Test the Tunnel${NC}"
echo "--------------------"
echo "Starting tunnel in test mode..."
echo -e "${YELLOW}Press Ctrl+C to stop the test${NC}"
cloudflared tunnel run photo-platform

echo -e "\n${BLUE}Step 8: Install as System Service (Optional)${NC}"
echo "---------------------------------------"
read -p "Install cloudflared as a system service? (y/n): " install_service

if [[ $install_service == "y" ]]; then
    sudo cloudflared service install
    sudo systemctl start cloudflared
    sudo systemctl enable cloudflared
    echo -e "${GREEN}Service installed and started!${NC}"
    echo "Check status: sudo systemctl status cloudflared"
fi

echo -e "\n${GREEN}✅ Setup Complete!${NC}"
echo "================="
echo ""
echo "Your photo platform is now accessible at:"
echo -e "${BLUE}  • https://api.theyoungs.photos${NC} (main API)"
echo -e "${BLUE}  • https://theyoungs.photos${NC} (alternative)"
echo -e "${BLUE}  • https://app.theyoungs.photos${NC} (future web app)"
echo ""
echo "All with automatic HTTPS and no port forwarding! 🎉"