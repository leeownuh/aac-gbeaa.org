const logger = require('../utils/logger');
const { ensureSchema } = require('./schema');
const { seedFromJson } = require('./seedFromJson');
const { query, withTransaction, close, healthCheck } = require('./client');

const initialize = async () => {
  await ensureSchema();
  await seedFromJson();
  logger.info('PostgreSQL initialization complete');
};

module.exports = {
  initialize,
  query,
  withTransaction,
  close,
  healthCheck
};
