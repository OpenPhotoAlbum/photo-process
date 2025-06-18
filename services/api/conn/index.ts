import dotenv from 'dotenv';

dotenv.config({ path: require('path').join(__dirname, '../../../.env') });

const config = {
    client: 'mysql2',
    useNullAsDefault: true,
    connection: {
      host: process.env.MYSQL_HOST || process.env.mysql_host,
      port: parseInt(process.env.MYSQL_PORT || process.env.mysql_port || '3306'),
      user: process.env.MYSQL_USER || process.env.mysql_user,
      password: process.env.MYSQL_PASSWORD || process.env.mysql_pass,
      database: process.env.MYSQL_DATABASE || process.env.mysql_db,
      multipleStatements: true,
    },
};

const database = require('knex')(config);

export default database;