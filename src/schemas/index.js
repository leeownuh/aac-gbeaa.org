const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const config = require('../config');

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const userSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    username: { type: 'string', minLength: 3, maxLength: 50 },
    password: { type: 'string', minLength: config.security.passwordMinLength },
    email: { type: 'string', format: 'email' },
    role: { type: 'string', enum: ['admin', 'super', 'editor', 'moderator', 'viewer', 'user'] },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    failedAttempts: { type: 'number', minimum: 0 },
    lockedUntil: { type: ['string', 'null'] }
  },
  required: ['id', 'username', 'password', 'role', 'createdAt']
};

const articleSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    title: { type: 'string', minLength: 1, maxLength: 200 },
    content: { type: 'string', minLength: 1 },
    author: { type: 'string' },
    category: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    published: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    imageUrl: { type: ['string', 'null'] }
  },
  required: ['id', 'title', 'content', 'author', 'createdAt']
};

const gallerySchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    filename: { type: 'string' },
    originalName: { type: 'string' },
    category: { type: 'string' },
    caption: { type: 'string' },
    uploadedBy: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
    size: { type: 'number', minimum: 0 },
    mimeType: { type: 'string' }
  },
  required: ['id', 'filename', 'uploadedBy', 'createdAt']
};

const eventSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    title: { type: 'string', minLength: 3, maxLength: 200 },
    description: { type: 'string', minLength: 1 },
    date: { type: 'string', minLength: 1 },
    end_date: { type: ['string', 'null'] },
    time: { type: ['string', 'null'] },
    start_at: { type: ['string', 'null'], format: 'date-time' },
    end_at: { type: ['string', 'null'], format: 'date-time' },
    timezone: { type: ['string', 'null'] },
    location: { type: 'string', minLength: 1 },
    category: { type: ['string', 'null'] },
    details_url: { type: ['string', 'null'] },
    image: { type: ['string', 'null'] },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    createdBy: { type: 'string' },
    published: { type: 'boolean' }
  },
  required: ['id', 'title', 'description', 'date', 'location', 'createdAt']
};

const auditLogSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    action: { type: 'string', enum: ['login', 'logout', 'create', 'update', 'delete', 'upload', 'download', 'view'] },
    resource: { type: 'string' },
    resourceId: { type: 'string' },
    userId: { type: 'string' },
    username: { type: 'string' },
    ip: { type: 'string' },
    userAgent: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' },
    details: { type: 'object' },
    severity: { type: 'string', enum: ['info', 'warning', 'error', 'critical'] }
  },
  required: ['id', 'action', 'timestamp']
};

const tokenSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    userId: { type: 'string' },
    token: { type: 'string' },
    type: { type: 'string', enum: ['access', 'refresh'] },
    expiresAt: { type: 'string', format: 'date-time' },
    createdAt: { type: 'string', format: 'date-time' },
    revoked: { type: 'boolean' },
    ipAddress: { type: 'string' },
    userAgent: { type: 'string' }
  },
  required: ['id', 'userId', 'token', 'type', 'expiresAt', 'createdAt']
};

const schemas = {
  user: userSchema,
  article: articleSchema,
  gallery: gallerySchema,
  event: eventSchema,
  auditLog: auditLogSchema,
  token: tokenSchema
};

const validators = {};

Object.entries(schemas).forEach(([name, schema]) => {
  validators[name] = ajv.compile(schema);
});

function validate(schemaName, data) {
  const validator = validators[schemaName];
  if (!validator) {
    throw new Error(`Schema ${schemaName} not found`);
  }
  
  const valid = validator(data);
  if (!valid) {
    return {
      valid: false,
      errors: validator.errors
    };
  }
  
  return { valid: true, errors: null };
}

module.exports = {
  schemas,
  validate,
  ajv
};
