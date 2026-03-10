const jwt = require('jsonwebtoken');
const config = require('../config');
const authService = require('../services/authService');
const intrusionDetection = require('../services/intrusionDetection');
const logger = require('../utils/logger');

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const decoded = authService.verifyAccessToken(token);

  if (!decoded) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  req.user = decoded;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('Unauthorized access attempt', {
        userId: req.user.userId,
        role: req.user.role,
        requiredRoles: roles,
        path: req.path
      });

      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

function requireAdmin(req, res, next) {
  return requireRole('admin')(req, res, next);
}

function logRequest(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  });

  next();
}

function trackFailedLogin(req, res, next) {
  if (req.path === '/api/auth/login' && res.statusCode === 401) {
    const ip = req.ip;
    const username = req.body?.username || 'unknown';
    intrusionDetection.trackFailedLogin(ip, username);
  }
  next();
}

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  logRequest,
  trackFailedLogin
};