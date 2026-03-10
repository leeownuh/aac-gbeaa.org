const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const logger = require('./utils/logger');
const cache = require('./storage/cache');
const fileLock = require('./utils/fileLock');
const authService = require('./services/authService');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { logRequest } = require('./middleware/auth');
const { apiLimiter } = require('./middleware/rateLimiter');
const apiRoutes = require('../server');
app.use('/api', apiRoutes);
app.set('trust proxy', 1);

const app = express();
const server = http.createServer(app);

const ensureDirectories = () => {
  const dirs = [
    config.paths.data,
    config.paths.private,
    config.paths.backups,
    config.paths.logs,
    config.paths.storage,
    config.paths.uploads
  ];

  dirs.forEach(dir => {
    const fullPath = path.resolve(dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      logger.info(`Directory created: ${fullPath}`);
    }
  });
};

const configureMiddleware = () => {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true
  }));

  app.use(cors(config.cors));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser(config.session.secret));

  app.use(logRequest);
  app.use('/api/', apiLimiter);

  // Serve static files from the root directory (where HTML, CSS, JS, images are)
  const rootPath = path.resolve('.');
  app.use(express.static(rootPath, {
    maxAge: '1d',
    etag: true
  }));
  logger.info(`Serving static files from: ${rootPath}`);
};

const configureRoutes = () => {
  app.use('/api', routes);
  app.use('/api', cmsRoutes);
  app.get('/', (req, res) => {
    const indexPath = path.resolve('index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    res.json({ message: 'CMS API Server', version: '1.0.0' });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
};

const handleGracefulShutdown = () => {
  const shutdown = async (signal) => {
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    
    server.close(async () => {
      logger.info('HTTP server closed');
      
      try {
        await fileLock.cleanup();
        logger.info('File locks cleaned up');
      } catch (error) {
        logger.error('Error cleaning up file locks', { error: error.message });
      }

      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

const handleErrors = () => {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', { reason, promise });
    process.exit(1);
  });
};

const startServer = async () => {
  try {
    logger.info('Starting server initialization...');

    ensureDirectories();
    
    await cache.initialize();
    
    await authService.initialize();

    configureMiddleware();
    configureRoutes();
    handleGracefulShutdown();
    handleErrors();

    server.listen(config.port, () => {
      logger.info(`Server started on port ${config.port}`, {
        env: config.nodeEnv,
        pid: process.pid
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message, stack: error.stack });
    process.exit(1);
  }
};

startServer();

module.exports = { app, server };