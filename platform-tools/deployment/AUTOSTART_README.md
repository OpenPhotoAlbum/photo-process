# Auto-Start Configuration for Photo Platform

This guide explains how to configure the Photo Platform to automatically start after system reboots.

## 🔄 Docker Restart Policies

All services are configured with `restart: unless-stopped` which means:
- ✅ Containers automatically restart after system reboot
- ✅ Containers automatically restart if they crash
- ❌ Containers do NOT restart if you manually stop them
- ✅ This is the recommended policy for production services

### Current Configuration

| Service | Restart Policy | Auto-starts after reboot |
|---------|---------------|-------------------------|
| API Service | unless-stopped | ✅ Yes |
| Web App | unless-stopped | ✅ Yes |
| MySQL Database | unless-stopped/always | ✅ Yes |
| CompreFace Services | unless-stopped | ✅ Yes |

## 🚀 Quick Start After Reboot

After your system reboots, the services should start automatically if Docker is configured to start on boot.

To verify all services are running:
```bash
# Check service status
cd /mnt/hdd/photo-process
./platform-tools/deployment/start-platform.sh

# Or manually check
docker ps
```

## 🐧 Linux Setup (Ubuntu/Debian)

### 1. Enable Docker Auto-Start
```bash
# Enable Docker to start on boot
sudo systemctl enable docker

# Verify it's enabled
sudo systemctl is-enabled docker
```

### 2. Option A: Use Docker's Built-in Restart Policies (Recommended)
The Docker Compose files already have `restart: unless-stopped` configured. Just start the services once:

```bash
cd /mnt/hdd/photo-process

# Start legacy database
cd legacy/services/database
docker compose up -d

# Start platform services
cd /mnt/hdd/photo-process
docker compose -f docker-compose.platform.yml up -d
```

That's it! Services will auto-restart after reboot.

### 3. Option B: Use Systemd Service (Advanced)
For more control, install as a systemd service:

```bash
# Copy the service file
sudo cp /mnt/hdd/photo-process/platform-tools/deployment/photo-platform.service /etc/systemd/system/

# Edit the service file to match your username/paths if needed
sudo nano /etc/systemd/system/photo-platform.service

# Reload systemd
sudo systemctl daemon-reload

# Enable the service
sudo systemctl enable photo-platform.service

# Start the service
sudo systemctl start photo-platform.service

# Check status
sudo systemctl status photo-platform.service
```

## 🍎 macOS Setup

### 1. Enable Docker Desktop Auto-Start
1. Open Docker Desktop
2. Go to **Settings** → **General**
3. Enable **"Start Docker Desktop when you log in"**

### 2. Services Auto-Start
The `restart: unless-stopped` policy works on macOS. After Docker Desktop starts, your containers will automatically start.

## 🪟 Windows Setup (WSL2)

### 1. Enable Docker Desktop Auto-Start
1. Open Docker Desktop
2. Go to **Settings** → **General**
3. Enable **"Start Docker Desktop when you log in"**

### 2. Enable WSL2 Auto-Start
Create a scheduled task to start WSL2 and Docker services on boot.

## 🧪 Testing Auto-Restart

### Test Container Restart
```bash
# Simulate a container crash
docker kill photo-platform-database

# Wait a few seconds, then check if it restarted
docker ps | grep database
```

### Test System Reboot
```bash
# Check current container status
docker ps

# Reboot system
sudo reboot

# After reboot, check if containers started
docker ps
```

## 🔍 Troubleshooting

### Services Not Starting After Reboot

1. **Check Docker service:**
   ```bash
   sudo systemctl status docker
   ```

2. **Check container restart policy:**
   ```bash
   docker inspect <container_name> | grep -A 5 RestartPolicy
   ```

3. **View container logs:**
   ```bash
   docker logs <container_name> --tail 50
   ```

4. **Manually start services:**
   ```bash
   cd /mnt/hdd/photo-process
   ./platform-tools/deployment/start-platform.sh
   ```

### Common Issues

1. **Permission errors:**
   - Ensure your user is in the `docker` group: `sudo usermod -aG docker $USER`
   - Log out and back in for changes to take effect

2. **Port conflicts:**
   - Check if ports are already in use: `sudo netstat -tlnp | grep -E "(9000|3307|8001)"`

3. **Docker not starting:**
   - Enable Docker service: `sudo systemctl enable docker`
   - Start Docker manually: `sudo systemctl start docker`

## 📋 Restart Policy Options

| Policy | Description | Use Case |
|--------|-------------|----------|
| `no` | Never restart (default) | Development/testing |
| `always` | Always restart, even if stopped manually | Critical services |
| `unless-stopped` | Restart unless manually stopped | **Recommended for production** |
| `on-failure` | Only restart on non-zero exit | Services that should fail gracefully |

## 🛠️ Managing Services

### Stop All Services
```bash
cd /mnt/hdd/photo-process
docker compose -f docker-compose.platform.yml down
cd legacy/services/database
docker compose down
```

### Start All Services
```bash
cd /mnt/hdd/photo-process
./platform-tools/deployment/start-platform.sh
```

### View Service Logs
```bash
# All services
docker compose -f docker-compose.platform.yml logs -f

# Specific service
docker logs photo-platform-database -f
```

### Update Restart Policy
To change restart policy for a running container:
```bash
docker update --restart unless-stopped <container_name>
```

## 🔐 Security Considerations

1. **File Permissions:**
   - Ensure Docker socket has correct permissions
   - Service files should be owned by root

2. **Environment Variables:**
   - Sensitive data in `.env` files should have restricted permissions
   - Consider using Docker secrets for production

3. **Network Security:**
   - Use firewall rules to restrict access to service ports
   - Consider using Docker networks for isolation

## 📚 Additional Resources

- [Docker Restart Policies](https://docs.docker.com/config/containers/start-containers-automatically/)
- [Systemd Service Files](https://www.freedesktop.org/software/systemd/man/systemd.service.html)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)