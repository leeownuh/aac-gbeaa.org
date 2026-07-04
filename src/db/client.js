const { Pool } = require('pg');
const config = require('../config');
const logger = require('../utils/logger');

let pool;

const getPool = () => {
  if (pool) {
    return pool;
  }

  const useSsl = config.database.ssl || String(config.database.url).includes('sslmode=require');

  pool = new Pool({
    connectionString: config.database.url,
    max: config.database.poolMax,
    idleTimeoutMillis: config.database.idleTimeoutMs,
    connectionTimeoutMillis: config.database.connectionTimeoutMs,
    ssl: useSsl ? { rejectUnauthorized: false } : false
  });

  pool.on('error', (error) => {
    logger.error('Unexpected PostgreSQL pool error', { error: error.message });
  });

  return pool;
};

const query = async (text, params = []) => {
  const db = getPool();
  return db.query(text, params);
};

const withTransaction = async (handler) => {
  const db = getPool();
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const close = async () => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};

const healthCheck = async () => {
  const db = getPool();
  await db.query('SELECT 1');
  return true;
};

module.exports = {
  getPool,
  query,
  withTransaction,
  close,
  healthCheck
};
