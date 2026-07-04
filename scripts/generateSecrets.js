const crypto = require('crypto');

const password = () => `Aa1!${crypto.randomBytes(18).toString('base64url')}`;
const secret = (bytes = 48) => crypto.randomBytes(bytes).toString('base64url');

const output = {
  JWT_SECRET: secret(),
  JWT_REFRESH_SECRET: secret(),
  SESSION_SECRET: secret(),
  ENCRYPTION_KEY: secret(32),
  POSTGRES_PASSWORD: secret(24),
  ADMIN_BOOTSTRAP_PASSWORD: password(),
  ADMIN_SUPER_PASSWORD: password()
};

Object.entries(output).forEach(([key, value]) => {
  console.log(`${key}=${value}`);
});
