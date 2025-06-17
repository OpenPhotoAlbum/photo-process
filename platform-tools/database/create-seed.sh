#!/bin/bash
if [ -z "$1" ]; then
    echo "Usage: $0 <seed_name>"
    exit 1
fi
cd "$(dirname "$0")/../.."
npx knex seed:make $1 --knexfile infrastructure/database/knexfile.platform.js