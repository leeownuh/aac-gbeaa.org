const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), process.env.ENV_FILE || '.env');
const composePath = path.resolve(process.cwd(), 'docker-compose.three-tier.yml');

const hardErrors = [];
const warnings = [];

const requiredFiles = [envPath, composePath];
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    hardErrors.push(`Missing required file: ${path.basename(file)}`);
  }
}

if (hardErrors.length) {
  hardErrors.forEach((message) => console.error(`ERROR: ${message}`));
  process.exit(1);
}

require('dotenv').config({ path: envPath });

const requiredKeys = [
  'NODE_ENV',
  'PORT',
  'WEB_PORT',
  'CORS_ORIGIN',
  'DATABASE_URL',
  'POSTGRES_PASSWORD',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'SESSION_SECRET',
  'ENCRYPTION_KEY',
  'ADMIN_BOOTSTRAP_PASSWORD',
  'ADMIN_SUPER_PASSWORD'
];

const placeholderFragments = [
  'replace-with',
  'replace-me',
  'example.com',
  'aac_password',
  'superadmin@123'
];

for (const key of requiredKeys) {
  const value = process.env[key];
  if (!value) {
    hardErrors.push(`Missing env var: ${key}`);
    continue;
  }

  const lowered = String(value).toLowerCase();
  if (placeholderFragments.some((fragment) => lowered.includes(fragment))) {
    hardErrors.push(`Unsafe placeholder value detected for ${key}`);
  }
}

if (process.env.NODE_ENV !== 'production') {
  hardErrors.push('NODE_ENV must be production for deployment');
}

if (process.env.SESSION_COOKIE_SECURE !== 'true') {
  hardErrors.push('SESSION_COOKIE_SECURE must be true for HTTPS production');
}

if (String(process.env.CORS_ORIGIN || '').includes('localhost')) {
  hardErrors.push('CORS_ORIGIN must be set to the real production domain');
}

if (!process.env.REDIS_URL) {
  warnings.push('REDIS_URL is not set. This is acceptable for one app instance, but not for multi-instance scaling.');
}

if (String(process.env.WEB_PORT) !== '80') {
  warnings.push('WEB_PORT is not 80. That is fine before TLS/proxy setup, but production usually exposes 80/443.');
}

if (hardErrors.length) {
  hardErrors.forEach((message) => console.error(`ERROR: ${message}`));
  warnings.forEach((message) => console.warn(`WARN: ${message}`));
  process.exit(1);
}

console.log('Preflight checks passed.');
warnings.forEach((message) => console.warn(`WARN: ${message}`));
