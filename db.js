const { Pool } = require('pg');
require('dotenv').config();

console.log("DATABASE_URL leída:", process.env.DATABASE_URL); // <--- Agrega esto temporalmente

const connectionString = process.env.DATABASE_URL;
const useSSL = connectionString && connectionString.includes('supabase.co');

const pool = new Pool({
  connectionString,
  ssl: useSSL ? { rejectUnauthorized: false } : false
});

module.exports = pool;