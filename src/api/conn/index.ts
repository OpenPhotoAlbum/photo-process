import dotenv from 'dotenv';

dotenv.config({ path: '/mnt/hdd/photo-process/.env' });

const config = {
    client: 'mysql2',
    useNullAsDefault: true,
    connection: {
      host: process.env.mysql_host,
      port: parseInt(process.env.mysql_port || '3307'),
      user: process.env.mysql_user,
      password: process.env.mysql_pass,
      database: process.env.mysql_db,
      multipleStatements: true,
    },
};

const database = require('knex')(config);

export default database;