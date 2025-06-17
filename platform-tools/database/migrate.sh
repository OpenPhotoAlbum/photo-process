#!/bin/bash
cd "$(dirname "$0")/../.."
npx knex migrate:latest --knexfile infrastructure/database/knexfile.platform.js