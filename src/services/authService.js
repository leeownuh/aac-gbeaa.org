const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../utils/logger');
const cache = require('../storage/cache');
const { validate } = require('../schemas');

class AuthService {
  constructor() {
    this.failedAttempts = new Map();
    this.lockedAccounts = new Map();
  }

  async initialize() {
    const users = cache.get('users.json', []);
    if (users.length === 0) {
      const hashedPassword = await bcrypt.hash('Admin@123456', config.security.bcryptRounds);
      await this.createUser({
        username: 'admin',
        password: hashedPassword,
        email: 'admin@example.com',
        role: 'admin'
      });
      logger.info('Default admin user created');
    }
  }

  async createUser(userData) {
    const user = {
      id: uuidv4(),
      username: userData.username,
      password: userData.password,
      email: userData.email || '',
      role: userData.role || 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      failedAttempts: 0,
      lockedUntil: null
    };

    const result = validate('user', user);
    if (!result.valid) {
      throw new Error(`Validation failed: ${JSON.stringify(result.errors)}`);
    }

    await cache.update('users.json', (users) => {
      users.push(user);
      return users;
    });

    await this.logAudit('create', 'user', user.id, null, { username: user.username, role: user.role });

    return user;
  }

  async authenticateUser(username, password, ip, userAgent) {
    if (this.isAccountLocked(username)) {
      const lockInfo = this.lockedAccounts.get(username);
      await this.logAudit('login', 'auth', null, null, { username, status: 'locked', ip }, 'warning');
      throw new Error(`Account locked until ${lockInfo.unlockAt}`);
    }

    const users = cache.get('users.json', []);
    const user = users.find(u => u.username === username);

    if (!user) {
      await this.recordFailedAttempt(username, ip, userAgent);
      await this.logAudit('login', 'auth', null, null, { username, status: 'user_not_found', ip }, 'warning');
      throw new Error('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      await this.recordFailedAttempt(username, ip, userAgent);
      await this.logAudit('login', 'auth', user.id, username, { status: 'invalid_password', ip }, 'warning');
      throw new Error('Invalid credentials');
    }

    this.clearFailedAttempts(username);

    const tokens = await this.generateTokens(user, ip, userAgent);

    await this.logAudit('login', 'auth', user.id, username, { ip, status: 'success' });

    return tokens;
  }

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
      userAgent: userAgent
    };

    await cache.update('tokens.json', (tokens) => {
      tokens.push(refreshTokenRecord);
      return tokens;
    });

    return {
      accessToken,
      refreshToken
    };
  }

  async refreshAccessToken(refreshToken, ip, userAgent) {
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }

    const tokens = cache.get('tokens.json', []);
    const storedToken = tokens.find(t => t.token === refreshToken && !t.revoked);

    if (!storedToken) {
      throw new Error('Refresh token not found or revoked');
    }

    await cache.update('tokens.json', (tokens) => {
      const index = tokens.findIndex(t => t.id === storedToken.id);
      if (index !== -1) {
        tokens[index].revoked = true;
      }
      return tokens;
    });

    const users = cache.get('users.json', []);
    const user = users.find(u => u.id === decoded.userId);

    if (!user) {
      throw new Error('User not found');
    }

    const newAccessToken = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.accessTokenExpiry }
    );

    const newRefreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshTokenExpiry }
    );

    const newRefreshTokenRecord = {
      id: uuidv4(),
      userId: user.id,
      token: newRefreshToken,
      type: 'refresh',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      revoked: false,
      ipAddress: ip,
      userAgent: userAgent
    };

    await cache.update('tokens.json', (tokens) => {
      tokens.push(newRefreshTokenRecord);
      return tokens;
    });

    await this.logAudit('refresh', 'auth', user.id, user.username, { ip });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    };
  }

  async logout(refreshToken) {
    await cache.update('tokens.json', (tokens) => {
      const index = tokens.findIndex(t => t.token === refreshToken);
      if (index !== -1) {
        tokens[index].revoked = true;
      }
      return tokens;
    });

    await this.logAudit('logout', 'auth', null, null, { status: 'success' });
  }

  verifyAccessToken(token) {
    try {
      return jwt.verify(token, config.jwt.secret);
    } catch (error) {
      return null;
    }
  }

  async recordFailedAttempt(username, ip, userAgent) {
    const key = `${username}:${ip}`;
    const attempts = this.failedAttempts.get(key) || { count: 0, firstAttempt: Date.now() };
    attempts.count++;
    
    if (attempts.count >= config.security.maxLoginAttempts) {
      this.lockedAccounts.set(username, {
        unlockAt: new Date(Date.now() + config.security.lockoutDuration)
      });
      logger.warn('Account locked', { username, ip, attempts: attempts.count });
    }

    this.failedAttempts.set(key, attempts);
  }

  clearFailedAttempts(username) {
    const userKey = username;
    this.lockedAccounts.delete(userKey);
    
    for (const [key] of this.failedAttempts) {
      if (key.startsWith(username + ':')) {
        this.failedAttempts.delete(key);
      }
    }
  }

  isAccountLocked(username) {
    const lockInfo = this.lockedAccounts.get(username);
    if (!lockInfo) return false;

    if (new Date() < new Date(lockInfo.unlockAt)) {
      return true;
    }

    this.lockedAccounts.delete(username);
    return false;
  }

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