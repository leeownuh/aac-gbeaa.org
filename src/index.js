const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const logger = require('./utils/logger');
const db = require('./db');
const fileLock = require('./utils/fileLock');
const authService = require('./services/authService');
const v2Routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { logRequest } = require('./middleware/auth');
const { apiLimiter } = require('./middleware/rateLimiter');
const legacyRoutes = require('../server');

const app = express();
const server = http.createServer(app);
app.set('trust proxy', config.app.trustProxyHops);
let appConfigured = false;

const ensureDirectories = () => {
  const dirs = [
    config.paths.data,
    config.paths.private,
    config.paths.backups,
    config.paths.logs,
    config.paths.storage,
    config.paths.uploads,
    config.paths.galleryAssets
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

  if (config.app.serveStatic) {
    app.use((req, res, next) => {
      const isAssetPath = /^\/(?:api|assets|img|data|uploads)\//.test(req.path);
      if (req.method === 'GET' && !isAssetPath && req.path.endsWith('.html')) {
        const cleanPath = req.path === '/index.html'
          ? '/'
          : req.path.replace(/\.html$/, '');
        return res.redirect(301, cleanPath);
      }
      return next();
    });

    app.use(express.static(config.app.staticRoot, {
      maxAge: '1d',
      etag: true
    }));
    logger.info(`Serving static files from: ${config.app.staticRoot}`);
  } else {
    logger.info('Static file serving disabled for API tier mode');
  }
};

const configureRoutes = () => {
  app.use('/api', legacyRoutes);
  app.use('/api/v2', v2Routes);
  app.get('/api/health', (req, res) => {
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });
  app.get('/api/ready', async (req, res) => {
    try {
      await db.healthCheck();
      res.json({
        success: true,
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Readiness check failed', { error: error.message });
      res.status(503).json({
        success: false,
        status: 'not_ready',
        error: 'Database unavailable'
      });
    }
  });

  app.get('/', (req, res) => {
    if (config.app.serveStatic) {
      const indexPath = path.join(config.app.staticRoot, 'index.html');
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
    }

    res.json({ message: 'CMS API Server', version: '1.0.0' });
  });

  app.get(/^\/(.+)\.html$/, (req, res, next) => {
    if (!config.app.serveStatic) {
      return next();
    }

    const cleanPath = req.path === '/index.html'
      ? '/'
      : req.path.replace(/\.html$/, '');
    return res.redirect(301, cleanPath);
  });

  app.get('*', (req, res, next) => {
    if (!config.app.serveStatic || path.extname(req.path)) {
      return next();
    }

    let requestedPath;
    try {
      requestedPath = path.normalize(decodeURIComponent(req.path)).replace(/^(\.\.[/\\])+/, '');
    } catch {
      return next();
    }

    const htmlPath = path.join(config.app.staticRoot, `${requestedPath}.html`);
    const staticRoot = path.resolve(config.app.staticRoot);
    const resolvedHtmlPath = path.resolve(htmlPath);

    if (!resolvedHtmlPath.startsWith(staticRoot + path.sep) && resolvedHtmlPath !== path.join(staticRoot, 'index.html')) {
      return next();
    }

    if (fs.existsSync(resolvedHtmlPath)) {
      return res.sendFile(resolvedHtmlPath);
    }

    return next();
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
};

const configureApp = () => {
  if (appConfigured) {
    return;
  }

  configureMiddleware();
  configureRoutes();
  appConfigured = true;
};

const handleGracefulShutdown = () => {
  if (config.nodeEnv !== 'production') return;

  const shutdown = async (signal) => {
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    
    server.close(async () => {
      logger.info('HTTP server closed');
      try {
        await db.close();
        logger.info('PostgreSQL pool closed');
      } catch (err) {
        logger.error('Error closing PostgreSQL pool', { error: err.message });
      }

      try {
        await fileLock.cleanup();
        logger.info('File locks cleaned up');
      } catch (err) {
        logger.error('Error cleaning up file locks', { error: err.message });
      }
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
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

// start server
const startServer = async () => {
  try {
    logger.info('Starting server initialization...');
    ensureDirectories();
    await db.initialize();
    await authService.initialize();
    configureApp();
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

configureApp();

if (require.main === module) {
  startServer();
}

module.exports = { app, server, startServer, configureApp };
