const config = require('../config');
const logger = require('../utils/logger');

const buildSessionOptions = () => {
  const options = {
    name: config.session.cookie.secure ? '__Host-aac.sid' : 'aac.sid',
    secret: config.session.secret,
    resave: config.session.resave,
    saveUninitialized: config.session.saveUninitialized,
    cookie: { ...config.session.cookie }
  };

  if (!config.session.redisUrl) {
    if (config.nodeEnv === 'production') {
      logger.warn('Using session MemoryStore. For multi-instance scale, set REDIS_URL.');
    }
    return options;
  }

  try {
    const { createClient } = require('redis');
    const { RedisStore } = require('connect-redis');
    const redisClient = createClient({ url: config.session.redisUrl });

    redisClient.on('error', (error) => {
      logger.error('Redis session client error', { error: error.message });
    });

    redisClient.connect().catch((error) => {
      logger.error('Redis session client connection failed', { error: error.message });
    });

    options.store = new RedisStore({
      client: redisClient,
      prefix: config.session.redisPrefix
    });

    logger.info('Redis-backed session store enabled');
  } catch (error) {
    logger.error('Failed to enable Redis session store, using MemoryStore fallback', {
      error: error.message
    });
  }

  return options;
};

module.exports = {
  buildSessionOptions
};
