#!/bin/bash
# Start database using the platform docker-compose
cd "$(dirname "$0")/../.."
docker-compose up -d database --force-recreate