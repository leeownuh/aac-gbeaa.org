const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../utils/logger');
const cache = require('../storage/cache');

class AuthService {
  constructor() {
    this.failedAttempts = new Map();
    this.lockedAccounts = new Map();
    this.adminPath = path.join(__dirname, '../data/admin.json');
  }

  // ===================== ADMIN INITIALIZATION =====================
  async initialize() {
    if (!fs.existsSync(this.adminPath)) {
      const hashedPassword = await bcrypt.hash('Admin@123456', config.security.bcryptRounds);
      const admin = {
        username: 'admin',
        password: hashedPassword
      };
      fs.writeFileSync(this.adminPath, JSON.stringify(admin, null, 2), 'utf8');
      logger.info('Default admin.json created');
    }
  }

  // ===================== AUTHENTICATION =====================
  async authenticateUser(username, password, ip, userAgent) {
    if (this.isAccountLocked(username)) {
      const lockInfo = this.lockedAccounts.get(username);
      await this.logAudit('login', 'auth', null, null, { username, status: 'locked', ip }, 'warning');
      throw new Error(`Account locked until ${lockInfo.unlockAt}`);
    }

    const admin = JSON.parse(fs.readFileSync(this.adminPath, 'utf8'));

    if (username !== admin.username) {
      await this.recordFailedAttempt(username, ip, userAgent);
      await this.logAudit('login', 'auth', null, null, { username, status: 'user_not_found', ip }, 'warning');
      throw new Error('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      await this.recordFailedAttempt(username, ip, userAgent);
      await this.logAudit('login', 'auth', null, username, { status: 'invalid_password', ip }, 'warning');
      throw new Error('Invalid credentials');
    }

    this.clearFailedAttempts(username);

    // Generate JWT tokens
    const tokens = await this.generateTokens({ id: 'admin', username: admin.username, role: 'admin' }, ip, userAgent);
    await this.logAudit('login', 'auth', 'admin', username, { ip, status: 'success' });

    return tokens;
  }

  // ===================== TOKEN GENERATION =====================
  async generateTokens(user, ip, userAgent) {
    const accessToken = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.accessTokenExpiry }
    );

    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshTokenExpiry }
    );

    const refreshTokenRecord = {
      id: uuidv4(),
      userId: user.id,
      token: refreshToken,
      type: 'refresh',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      revoked: false,
      ipAddress: ip,
      userAgent
    };

    await cache.update('tokens.json', (tokens) => {
      tokens.push(refreshTokenRecord);
      return tokens;
    });

    return { accessToken, refreshToken };
  }

  // ===================== REFRESH TOKEN =====================
  async refreshAccessToken(refreshToken, ip, userAgent) {
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
    } catch {
      throw new Error('Invalid refresh token');
    }

    const tokens = cache.get('tokens.json', []);
    const storedToken = tokens.find(t => t.token === refreshToken && !t.revoked);
    if (!storedToken) throw new Error('Refresh token not found or revoked');

    // Revoke old token
    await cache.update('tokens.json', (tokens) => {
      const index = tokens.findIndex(t => t.id === storedToken.id);
      if (index !== -1) tokens[index].revoked = true;
      return tokens;
    });

    const admin = JSON.parse(fs.readFileSync(this.adminPath, 'utf8'));
    const newAccessToken = jwt.sign(
      { userId: 'admin', username: admin.username, role: 'admin' },
      config.jwt.secret,
      { expiresIn: config.jwt.accessTokenExpiry }
    );

    const newRefreshToken = jwt.sign(
      { userId: 'admin', type: 'refresh' },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshTokenExpiry }
    );

    const newRefreshTokenRecord = {
      id: uuidv4(),
      userId: 'admin',
      token: newRefreshToken,
      type: 'refresh',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      revoked: false,
      ipAddress: ip,
      userAgent
    };

    await cache.update('tokens.json', (tokens) => {
      tokens.push(newRefreshTokenRecord);
      return tokens;
    });

    await this.logAudit('refresh', 'auth', 'admin', admin.username, { ip });
    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  // ===================== LOGOUT =====================
  async logout(refreshToken) {
    await cache.update('tokens.json', (tokens) => {
      const index = tokens.findIndex(t => t.token === refreshToken);
      if (index !== -1) tokens[index].revoked = true;
      return tokens;
    });

    await this.logAudit('logout', 'auth', null, 'admin', { status: 'success' });
  }

  // ===================== ACCESS TOKEN VERIFY =====================
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, config.jwt.secret);
    } catch {
      return null;
    }
  }

  // ===================== FAILED ATTEMPTS =====================
  async recordFailedAttempt(username, ip, userAgent) {
    const key = `${username}:${ip}`;
    const attempts = this.failedAttempts.get(key) || { count: 0, firstAttempt: Date.now() };
    attempts.count++;

    if (attempts.count >= config.security.maxLoginAttempts) {
      this.lockedAccounts.set(username, { unlockAt: new Date(Date.now() + config.security.lockoutDuration) });
      logger.warn('Account locked', { username, ip, attempts: attempts.count });
    }

    this.failedAttempts.set(key, attempts);
  }

  clearFailedAttempts(username) {
    this.lockedAccounts.delete(username);
    for (const key of this.failedAttempts.keys()) {
      if (key.startsWith(username + ':')) this.failedAttempts.delete(key);
    }
  }

  isAccountLocked(username) {
    const lockInfo = this.lockedAccounts.get(username);
    if (!lockInfo) return false;
    if (new Date() < new Date(lockInfo.unlockAt)) return true;
    this.lockedAccounts.delete(username);
    return false;
  }

  // ===================== AUDIT LOG =====================
  async logAudit(action, resource, resourceId, username, details = {}, severity = 'info') {
    const auditEntry = {
      id: uuidv4(),
      action,
      resource,
      resourceId,
      username,
      timestamp: new Date().toISOString(),
      details,
      severity
    };

    await cache.update('audit.json', (logs) => {
      logs.push(auditEntry);
      return logs;
    });
  }
}

module.exports = new AuthService();