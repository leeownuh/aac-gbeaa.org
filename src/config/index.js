require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'production',
  jwt: {
    secret: process.env.JWT_SECRET || 'default-jwt-secret-change-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-in-production',
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d'
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production',
    algorithm: 'aes-256-gcm',
    saltLength: 64
  },
  session: {
    secret: process.env.SESSION_SECRET || 'default-session-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
  },
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5242880,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    uploadDir: './storage/uploads',
    magicNumbers: {
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/png': [0x89, 0x50, 0x4E, 0x47],
      'image/gif': [0x47, 0x49, 0x46, 0x38],
      'image/webp': [0x52, 0x49, 0x46, 0x46]
    }
  },
  paths: {
    data: './data',
    public: './public',
    private: './data/private',
    backups: './backups',
    logs: './logs',
    storage: './storage',
    uploads: './storage/uploads'
  },
  backup: {
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS, 10) || 30,
    maxVersions: 5
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    maxFiles: 14,
    maxSize: '20m'
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 100) || 100
  },
  security: {
    maxLoginAttempts: 5,
    lockoutDuration: 30 * 60 * 1000,
    passwordMinLength: 12,
    bcryptRounds: 12
  }
};

module.exports = config;