docker compose \
    -f /mnt/hdd/photo-process/services/database/docker-compose.yaml \
    --env-file /mnt/hdd/photo-process/.env \
    up -d \
    --force-recreate