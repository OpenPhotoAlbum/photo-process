#!/bin/bash
cd "$(dirname "$0")/../.."
npx knex seed:run --knexfile infrastructure/database/knexfile.platform.js