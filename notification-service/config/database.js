const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
// Membaca data dari .env dan membuat pool koneksi ke MariaDB
const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "db_notification",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;
