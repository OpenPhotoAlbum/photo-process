#!/bin/bash
if [ -z "$1" ]; then
    echo "Usage: $0 <migration_name>"
    exit 1
fi
cd "$(dirname "$0")/../.."
npx knex migrate:make $1 --knexfile infrastructure/database/knexfile.platform.js