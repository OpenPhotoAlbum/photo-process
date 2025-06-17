const path = require('path');

// Platform-integrated knexfile
// Can be used from any service in the platform

const config = {
  development: {
    client: 'mysql2',
    useNullAsDefault: true,
    connection: {
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3307'),
      user: process.env.MYSQL_USER || 'photo',
      password: process.env.MYSQL_PASSWORD || 'Dalekini21',
      database: process.env.MYSQL_DATABASE || 'photo-process',
      multipleStatements: true,
    },
    migrations: {
      directory: path.join(__dirname, 'migrations'),
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: path.join(__dirname, 'seeds')
    }
  },

  production: {
    client: 'mysql2',
    useNullAsDefault: true,
    connection: {
      host: process.env.MYSQL_HOST,
      port: parseInt(process.env.MYSQL_PORT),
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      multipleStatements: true,
      ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : false
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: path.join(__dirname, 'migrations'),
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: path.join(__dirname, 'seeds')
    }
  }
};

module.exports = config;