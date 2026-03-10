const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error('Error occurred', {
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  const statusCode = err.statusCode || err.status || 500;
  const isDevelopment = process.env.NODE_ENV === 'development';

  const errorResponse = {
    error: err.message || 'Internal server error'
  };

  if (isDevelopment && err.stack) {
    errorResponse.stack = err.stack;
  }

  if (err.errors) {
    errorResponse.details = err.errors;
  }

  if (err.code) {
    errorResponse.code = err.code;
  }

  res.status(statusCode).json(errorResponse);
}

function notFoundHandler(req, res, next) {
  logger.warn('Route not found', {
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};