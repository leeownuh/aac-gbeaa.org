const { validationResult, body, param, query, matchedData } = require('express-validator');
const config = require('../config');
const logger = require('../utils/logger');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(e => ({
      field: e.path,
      message: e.msg
    }));

    logger.warn('Validation failed', {
      path: req.path,
      errors: errorMessages,
      ip: req.ip
    });

    return res.status(400).json({
      error: 'Validation failed',
      details: errorMessages
    });
  }

  next();
};

const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'string') {
        obj[key] = obj[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+=/gi, '');
      } else if (typeof obj[key] === 'object') {
        sanitize(obj[key]);
      }
    }
    return obj;
  };

  req.body = sanitize(req.body);
  req.params = sanitize(req.params);
  req.query = sanitize(req.query);

  next();
};

const validateEvent = [
  body('title')
    .isString()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  
  body('description')
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Description is required'),
  
  body('date')
    .isISO8601()
    .withMessage('Date must be a valid ISO date')
    .custom((value) => {
      if (new Date(value) < new Date()) {
        throw new Error('Date cannot be in the past');
      }
      return true;
    }),
  
  body('location')
    .isString()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Location is required and must not exceed 500 characters'),
  
  handleValidationErrors
];

const validateArticle = [
  body('title')
    .isString()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title is required and must not exceed 200 characters'),
  
  body('content')
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Content is required'),
  
  body('author')
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Author is required'),
  
  body('category')
    .optional()
    .isString()
    .trim(),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  
  handleValidationErrors
];

const validateGallery = [
  body('category')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Category must not exceed 100 characters'),
  
  body('caption')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Caption must not exceed 500 characters'),
  
  handleValidationErrors
];

const validateUser = [
  body('username')
    .isString()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  
  body('email')
    .optional()
    .isEmail()
    .withMessage('Invalid email address')
    .normalizeEmail(),
  
  body('role')
    .optional()
    .isIn(['admin', 'editor', 'user'])
    .withMessage('Role must be admin, editor, or user'),
  
  handleValidationErrors
];

const validatePassword = [
  body('password')
    .isLength({ min: config.security.passwordMinLength })
    .withMessage(`Password must be at least ${config.security.passwordMinLength} characters`)
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage('Password must contain at least one special character'),
  
  handleValidationErrors
];

const validateLogin = [
  body('username')
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Username is required'),
  
  body('password')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Password is required'),
  
  handleValidationErrors
];

const validateId = [
  param('id')
    .isUUID(4)
    .withMessage('Invalid ID format'),
  
  handleValidationErrors
];

const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  handleValidationErrors
];

const validateFileName = [
  param('filename')
    .matches(/^[a-zA-Z0-9_\-.]+$/)
    .withMessage('Invalid filename format')
    .custom((value) => {
      if (value.includes('..')) {
        throw new Error('Path traversal not allowed');
      }
      return true;
    }),
  
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  sanitizeInput,
  validateEvent,
  validateArticle,
  validateGallery,
  validateUser,
  validatePassword,
  validateLogin,
  validateId,
  validatePagination,
  validateFileName
};