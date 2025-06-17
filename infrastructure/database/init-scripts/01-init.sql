-- Photo Management Platform Database Initialization
-- This script runs when the database container first starts

-- Create the database if it doesn't exist
CREATE DATABASE IF NOT EXISTS photo_process CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Grant privileges to the photo user
GRANT ALL PRIVILEGES ON photo_process.* TO 'photo_user'@'%';
FLUSH PRIVILEGES;

-- Set session variables for optimal performance
SET GLOBAL innodb_buffer_pool_size = 512*1024*1024;
SET GLOBAL max_connections = 1001;