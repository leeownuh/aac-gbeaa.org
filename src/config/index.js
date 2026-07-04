const path = require('path');

require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const resolvePath = (value, basePath, ...fallbackSegments) => {
  if (value) {
    return path.resolve(value);
  }

  return path.resolve(basePath, ...fallbackSegments);
};

const appRoot = path.resolve(__dirname, '..', '..');
const dataRoot = process.env.DATA_ROOT
  ? path.resolve(process.env.DATA_ROOT)
  : appRoot;

const isProduction = nodeEnv === 'production';
const sessionCookieSecure = process.env.SESSION_COOKIE_SECURE
  ? process.env.SESSION_COOKIE_SECURE === 'true'
  : isProduction;
const insecureSecretMarkers = new Set([
  'default-jwt-secret-change-in-production',
  'default-refresh-secret-change-in-production',
  'default-encryption-key-change-in-production',
  'default-session-secret-change-in-production',
  'replace-me',
  'replace-me-in-production'
]);

const resolveSecret = (envName, fallback) => {
  const value = process.env[envName] || fallback;

  if (isProduction) {
    if (!process.env[envName]) {
      throw new Error(`Missing required production secret: ${envName}`);
    }

    const lowered = String(value).toLowerCase();
    const looksPlaceholder = Array.from(insecureSecretMarkers).some(marker => lowered.includes(marker));
    if (looksPlaceholder) {
      throw new Error(`Unsafe placeholder value detected for ${envName}`);
    }
  }

  return value;
};

const config = {
  port: toInt(process.env.PORT, 3000),
  nodeEnv,
  app: {
    serveStatic: process.env.SERVE_STATIC !== 'false',
    staticRoot: resolvePath(process.env.STATIC_ROOT, appRoot),
    trustProxyHops: toInt(process.env.TRUST_PROXY_HOPS, 1)
  },
  database: {
    url: process.env.DATABASE_URL || null,
    host: process.env.DB_HOST || 'localhost',
    port: toInt(process.env.DB_PORT, 5432),
    name: process.env.DB_NAME || 'aac_gbeaa',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    poolMax: toInt(process.env.DB_POOL_MAX, 10),
    idleTimeoutMs: toInt(process.env.DB_IDLE_TIMEOUT_MS, 30000),
    connectionTimeoutMs: toInt(process.env.DB_CONNECTION_TIMEOUT_MS, 10000),
    ssl: process.env.DB_SSL === 'true'
  },
  jwt: {
    secret: resolveSecret('JWT_SECRET', 'default-jwt-secret-change-in-production'),
    refreshSecret: resolveSecret('JWT_REFRESH_SECRET', 'default-refresh-secret-change-in-production'),
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d'
  },
  encryption: {
    key: resolveSecret('ENCRYPTION_KEY', 'default-encryption-key-change-in-production'),
    algorithm: 'aes-256-gcm',
    saltLength: 64
  },
  session: {
    secret: resolveSecret('SESSION_SECRET', 'default-session-secret-change-in-production'),
    resave: false,
    saveUninitialized: false,
    redisUrl: process.env.REDIS_URL || '',
    redisPrefix: process.env.REDIS_SESSION_PREFIX || 'aac:sess:',
    cookie: {
      secure: sessionCookieSecure,
      httpOnly: true,
      sameSite: sessionCookieSecure ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:8080',
    credentials: true
  },
  upload: {
    maxFileSize: toInt(process.env.MAX_FILE_SIZE, 5 * 1024 * 1024),
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    magicNumbers: {
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/png': [0x89, 0x50, 0x4E, 0x47],
      'image/gif': [0x47, 0x49, 0x46, 0x38],
      'image/webp': [0x52, 0x49, 0x46, 0x46]
    }
  },
  paths: {
    appRoot,
    dataRoot,
    data: resolvePath(process.env.DATA_PATH, dataRoot, 'data'),
    public: resolvePath(process.env.PUBLIC_PATH, appRoot, 'public'),
    private: resolvePath(process.env.PRIVATE_DATA_PATH, dataRoot, 'private'),
    backups: resolvePath(process.env.BACKUPS_PATH, dataRoot, 'backups'),
    logs: resolvePath(process.env.LOGS_PATH, dataRoot, 'logs'),
    storage: resolvePath(process.env.STORAGE_PATH, dataRoot, 'storage'),
    uploads: resolvePath(process.env.UPLOADS_PATH, dataRoot, 'uploads'),
    galleryAssets: resolvePath(process.env.GALLERY_ASSETS_PATH, dataRoot, 'assets', 'images', 'gallery')
  },
  backup: {
    retentionDays: toInt(process.env.BACKUP_RETENTION_DAYS, 30),
    maxVersions: toInt(process.env.BACKUP_MAX_VERSIONS, 5)
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    maxFiles: 14,
    maxSize: '20m'
  },
  rateLimit: {
    windowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 900000),
    maxRequests: toInt(process.env.RATE_LIMIT_MAX_REQUESTS, 100)
  },
  cache: {
    enabled: process.env.HOT_CACHE_ENABLED !== 'false',
    hotTtlMs: toInt(process.env.HOT_CACHE_TTL_MS, 30000)
  },
  security: {
    maxLoginAttempts: 5,
    lockoutDuration: 30 * 60 * 1000,
    passwordMinLength: 12,
    bcryptRounds: 12,
    passwordMaxAgeDays: toInt(process.env.PASSWORD_MAX_AGE_DAYS, 90),
    tempPasswordMinHours: toInt(process.env.TEMP_PASSWORD_MIN_HOURS, 1),
    tempPasswordMaxHours: toInt(process.env.TEMP_PASSWORD_MAX_HOURS, 24)
  }
};

if (!config.database.url) {
  const encodedUser = encodeURIComponent(config.database.user);
  const encodedPassword = encodeURIComponent(config.database.password);
  config.database.url =
    `postgres://${encodedUser}:${encodedPassword}` +
    `@${config.database.host}:${config.database.port}/${config.database.name}`;
}

module.exports = config;
