const dotenv  = require("dotenv");

dotenv.config({ path: '/mnt/hdd/photo-process/.env' });

const config = {
    client: 'mysql2',
    useNullAsDefault: true,
    connection: {
      host: process.env.mysql_host,
      port: parseInt(process.env.mysql_port),
      user: process.env.mysql_user,
      password: process.env.mysql_pass,
      database: process.env.mysql_db,
      multipleStatements: true,
    },
};

module.exports = config;
