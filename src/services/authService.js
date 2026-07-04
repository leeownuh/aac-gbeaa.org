const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../utils/logger');
const authRepository = require('../db/repositories/authRepository');

const ADMIN_ROLES = Object.freeze({
  SUPER: 'super',
  EDITOR: 'editor',
  MODERATOR: 'moderator'
});

const ALLOWED_ROLES = new Set([
  ADMIN_ROLES.SUPER,
  ADMIN_ROLES.EDITOR,
  ADMIN_ROLES.MODERATOR
]);

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,50}$/;

class AuthService {
  constructor() {
    this.failedAttempts = new Map();
    this.lockedAccounts = new Map();
  }

  // ===================== ROLE + IDENTITY HELPERS =====================
  normalizeRole(role) {
    const value = String(role || '')
      .trim()
      .toLowerCase();

    // Backward compatibility with older "admin" role.
    if (value === 'admin') {
      return ADMIN_ROLES.SUPER;
    }

    if (value === 'viewer') {
      return ADMIN_ROLES.MODERATOR;
    }

    if (ALLOWED_ROLES.has(value)) {
      return value;
    }

    return ADMIN_ROLES.MODERATOR;
  }

  validateRole(role) {
    const normalized = this.normalizeRole(role);
    if (!ALLOWED_ROLES.has(normalized)) {
      throw new Error('Invalid role');
    }
    return normalized;
  }

  validateUsername(username) {
    const normalized = String(username || '').trim();
    if (!USERNAME_PATTERN.test(normalized)) {
      throw new Error('Username must be 3-50 characters and contain only letters, numbers, and underscores');
    }
    return normalized;
  }

  validatePasswordStrength(password) {
    if (typeof password !== 'string' || password.length < config.security.passwordMinLength) {
      throw new Error(`Password must be at least ${config.security.passwordMinLength} characters`);
    }

    if (!/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      throw new Error('Password must contain at least one number');
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      throw new Error('Password must contain at least one special character');
    }
  }

  sanitizeAdminView(admin) {
    return {
      username: admin.username,
      role: this.normalizeRole(admin.role),
      forcePasswordChange: Boolean(admin.forcePasswordChange),
      passwordExpiresAt: admin.passwordExpiresAt || null,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt
    };
  }

  generateStrongBootstrapPassword() {
    return `Aa1!${crypto.randomBytes(18).toString('base64url')}`;
  }

  generateTemporaryPassword() {
    return `Aa1!${crypto.randomBytes(14).toString('base64url')}`;
  }

  getStandardPasswordExpiry(days = config.security.passwordMaxAgeDays) {
    const configuredDays = Number.parseInt(days, 10);
    const effectiveDays = Number.isFinite(configuredDays) && configuredDays > 0 ? configuredDays : 90;
    return new Date(Date.now() + (effectiveDays * 24 * 60 * 60 * 1000)).toISOString();
  }

  getTemporaryPasswordExpiry(hours = 12) {
    const parsedDefault = Number.parseInt(process.env.TEMP_PASSWORD_VALID_HOURS, 10);
    const defaultHours = Number.isFinite(parsedDefault) && parsedDefault > 0 ? parsedDefault : 12;
    const minHours = Math.max(1, Number.parseInt(config.security.tempPasswordMinHours, 10) || 1);
    const maxHours = Math.max(minHours, Number.parseInt(config.security.tempPasswordMaxHours, 10) || 24);
    const requestedHours = Number.isFinite(hours) && hours > 0 ? hours : defaultHours;
    const effectiveHours = Math.min(maxHours, Math.max(minHours, requestedHours));
    return new Date(Date.now() + (effectiveHours * 60 * 60 * 1000)).toISOString();
  }

  // ===================== ADMIN INITIALIZATION =====================
  async initialize() {
    await authRepository.pruneExpiredRefreshTokens();

    const bootstrapSpecs = [
      {
        username: process.env.ADMIN_SUPER_USERNAME || 'superadmin',
        role: ADMIN_ROLES.SUPER,
        password: process.env.ADMIN_SUPER_PASSWORD || process.env.ADMIN_BOOTSTRAP_PASSWORD,
        requiredInProd: true,
        envNames: ['ADMIN_SUPER_PASSWORD', 'ADMIN_BOOTSTRAP_PASSWORD']
      },
      {
        username: process.env.ADMIN_EDITOR_USERNAME || 'editoradmin',
        role: ADMIN_ROLES.EDITOR,
        password: process.env.ADMIN_EDITOR_PASSWORD,
        requiredInProd: false,
        envNames: ['ADMIN_EDITOR_PASSWORD']
      },
      {
        username: process.env.ADMIN_MODERATOR_USERNAME || process.env.ADMIN_VIEWER_USERNAME || 'moderatoradmin',
        role: ADMIN_ROLES.MODERATOR,
        password: process.env.ADMIN_MODERATOR_PASSWORD || process.env.ADMIN_VIEWER_PASSWORD,
        requiredInProd: false,
        envNames: ['ADMIN_MODERATOR_PASSWORD', 'ADMIN_VIEWER_PASSWORD']
      }
    ];

    for (const spec of bootstrapSpecs) {
      await this.ensureBootstrapAdmin(spec);
    }
  }

  async ensureBootstrapAdmin(spec) {
    const username = this.validateUsername(spec.username);
    const existing = await authRepository.getAdminByUsername(username);
    if (existing) {
      return;
    }

    if (config.nodeEnv === 'production' && spec.requiredInProd && !spec.password) {
      throw new Error(`${spec.envNames.join(' or ')} is required for first-time production bootstrap`);
    }

    let password = spec.password;
    if (!password) {
      password = this.generateStrongBootstrapPassword();
      logger.warn('Generated one-time bootstrap admin password', {
        username,
        role: spec.role,
        bootstrapPassword: password
      });
    }

    this.validatePasswordStrength(password);
    const hashedPassword = await bcrypt.hash(password, config.security.bcryptRounds);
    await authRepository.createAdmin({
      username,
      role: spec.role,
      password: hashedPassword,
      forcePasswordChange: false,
      passwordExpiresAt: this.getStandardPasswordExpiry()
    });

    logger.info('Bootstrap admin account seeded in PostgreSQL', {
      username,
      role: spec.role
    });
  }

  // ===================== AUTHENTICATION =====================
  async authenticateUser(username, password, ip, userAgent) {
    const normalizedUsername = this.validateUsername(username);

    if (this.isAccountLocked(normalizedUsername)) {
      const lockInfo = this.lockedAccounts.get(normalizedUsername);
      await this.logAudit('login', 'auth', null, null, { username: normalizedUsername, status: 'locked', ip }, 'warning');
      throw new Error(`Account locked until ${lockInfo.unlockAt}`);
    }

    const admin = await authRepository.getAdminByUsername(normalizedUsername);
    if (!admin) {
      await this.recordFailedAttempt(normalizedUsername, ip, userAgent);
      await this.logAudit('login', 'auth', null, null, { username: normalizedUsername, status: 'user_not_found', ip }, 'warning');
      throw new Error('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      await this.recordFailedAttempt(normalizedUsername, ip, userAgent);
      await this.logAudit('login', 'auth', null, normalizedUsername, { status: 'invalid_password', ip }, 'warning');
      throw new Error('Invalid credentials');
    }

    if (admin.passwordExpiresAt && new Date(admin.passwordExpiresAt) <= new Date()) {
      await this.logAudit('login', 'auth', null, normalizedUsername, {
        status: 'password_expired',
        ip
      }, 'warning');
      throw new Error('Password has expired. Contact a super admin for a temporary password.');
    }

    this.clearFailedAttempts(normalizedUsername);

    const role = this.normalizeRole(admin.role);
    const mustChangePassword = Boolean(admin.forcePasswordChange);
    const tokens = await this.generateTokens(
      {
        id: admin.username,
        username: admin.username,
        role,
        mustChangePassword
      },
      ip,
      userAgent
    );
    await this.logAudit('login', 'auth', admin.username, admin.username, { ip, status: 'success', role });

    return {
      ...tokens,
      user: {
        username: admin.username,
        role,
        requiresPasswordChange: mustChangePassword
      }
    };
  }

  // ===================== TOKEN GENERATION =====================
  async generateTokens(user, ip, userAgent) {
    const accessToken = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
        mustChangePassword: Boolean(user.mustChangePassword)
      },
      config.jwt.secret,
      { expiresIn: config.jwt.accessTokenExpiry }
    );

    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshTokenExpiry }
    );

    await authRepository.insertRefreshToken({
      id: uuidv4(),
      userId: user.id,
      token: refreshToken,
      type: 'refresh',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      revoked: false,
      ipAddress: ip,
      userAgent
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

    const storedToken = await authRepository.findActiveRefreshToken(refreshToken);
    if (!storedToken) {
      throw new Error('Refresh token not found or revoked');
    }

    await authRepository.revokeRefreshTokenById(storedToken.id);

    const username = decoded.userId || storedToken.userId;
    const admin = await authRepository.getAdminByUsername(username);
    if (!admin) {
      throw new Error('Admin account not found');
    }

    const role = this.normalizeRole(admin.role);
    const mustChangePassword = Boolean(admin.forcePasswordChange);
    const tokens = await this.generateTokens(
      {
        id: admin.username,
        username: admin.username,
        role,
        mustChangePassword
      },
      ip,
      userAgent
    );

    await this.logAudit('refresh', 'auth', admin.username, admin.username, { ip, role });
    return tokens;
  }

  // ===================== LOGOUT =====================
  async logout(refreshToken) {
    if (!refreshToken) {
      return;
    }

    let username = null;
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
      username = decoded.userId || null;
    } catch {
      username = null;
    }

    await authRepository.revokeRefreshTokenByToken(refreshToken);
    await this.logAudit('logout', 'auth', username, username, { status: 'success' });
  }

  // ===================== CHANGE PASSWORD =====================
  async changePassword(username, currentPassword, newPassword, ip, userAgent) {
    const normalizedUsername = this.validateUsername(username);
    const admin = await authRepository.getAdminByUsername(normalizedUsername);
    if (!admin) {
      throw new Error('Admin account not found');
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, admin.password);
    if (!isCurrentValid) {
      await this.logAudit(
        'change_password',
        'auth',
        normalizedUsername,
        normalizedUsername,
        {
          status: 'invalid_current_password',
          ip,
          userAgent
        },
        'warning'
      );
      throw new Error('Current password is incorrect');
    }

    if (currentPassword === newPassword) {
      throw new Error('New password must be different from current password');
    }

    this.validatePasswordStrength(newPassword);
    const hashedPassword = await bcrypt.hash(newPassword, config.security.bcryptRounds);
    await authRepository.updateAdminPassword(normalizedUsername, hashedPassword, {
      forcePasswordChange: false,
      passwordExpiresAt: this.getStandardPasswordExpiry()
    });
    await authRepository.revokeRefreshTokensByUserId(normalizedUsername);

    await this.logAudit('change_password', 'auth', normalizedUsername, normalizedUsername, {
      status: 'success',
      ip,
      userAgent
    });

    return true;
  }

  // ===================== ACCOUNT MANAGEMENT =====================
  async listAdminAccounts() {
    const admins = await authRepository.listAdmins();
    return admins.map(item => this.sanitizeAdminView(item));
  }

  async createAdminAccount(actorUsername, { username, password, role }) {
    const normalizedUsername = this.validateUsername(username);
    const normalizedRole = this.validateRole(role);
    const hasProvidedPassword = Boolean(password);
    const passwordToUse = hasProvidedPassword ? password : this.generateTemporaryPassword();
    this.validatePasswordStrength(passwordToUse);

    const existing = await authRepository.getAdminByUsername(normalizedUsername);
    if (existing) {
      throw new Error('Username already exists');
    }

    const hashedPassword = await bcrypt.hash(passwordToUse, config.security.bcryptRounds);
    const forcePasswordChange = !hasProvidedPassword;
    const created = await authRepository.createAdmin({
      username: normalizedUsername,
      role: normalizedRole,
      password: hashedPassword,
      forcePasswordChange,
      passwordExpiresAt: forcePasswordChange
        ? this.getTemporaryPasswordExpiry()
        : this.getStandardPasswordExpiry()
    });

    await this.logAudit('create_admin_account', 'admin', normalizedUsername, actorUsername, {
      createdUsername: normalizedUsername,
      role: normalizedRole,
      temporaryPasswordIssued: forcePasswordChange
    });

    return {
      ...this.sanitizeAdminView(created),
      temporaryPassword: forcePasswordChange ? passwordToUse : null
    };
  }

  async updateAdminRole(actorUsername, targetUsername, role) {
    const normalizedTarget = this.validateUsername(targetUsername);
    const normalizedRole = this.validateRole(role);
    const existing = await authRepository.getAdminByUsername(normalizedTarget);
    if (!existing) {
      throw new Error('Admin account not found');
    }

    const existingRole = this.normalizeRole(existing.role);
    if (existingRole === ADMIN_ROLES.SUPER && normalizedRole !== ADMIN_ROLES.SUPER) {
      const superCount = await authRepository.countAdminsByRole(ADMIN_ROLES.SUPER);
      if (superCount <= 1) {
        throw new Error('At least one super admin account must remain');
      }
    }

    const updated = await authRepository.updateAdminRole(normalizedTarget, normalizedRole);
    await authRepository.revokeRefreshTokensByUserId(normalizedTarget);

    await this.logAudit('update_admin_role', 'admin', normalizedTarget, actorUsername, {
      targetUsername: normalizedTarget,
      previousRole: existingRole,
      newRole: normalizedRole
    });

    return this.sanitizeAdminView(updated);
  }

  async resetAdminPassword(actorUsername, targetUsername, newPassword) {
    const normalizedTarget = this.validateUsername(targetUsername);
    const admin = await authRepository.getAdminByUsername(normalizedTarget);
    if (!admin) {
      throw new Error('Admin account not found');
    }

    const hasProvidedPassword = Boolean(newPassword);
    const passwordToUse = hasProvidedPassword ? newPassword : this.generateTemporaryPassword();

    this.validatePasswordStrength(passwordToUse);
    const hashedPassword = await bcrypt.hash(passwordToUse, config.security.bcryptRounds);
    await authRepository.updateAdminPassword(normalizedTarget, hashedPassword, {
      forcePasswordChange: true,
      passwordExpiresAt: this.getTemporaryPasswordExpiry()
    });
    await authRepository.revokeRefreshTokensByUserId(normalizedTarget);

    await this.logAudit('reset_admin_password', 'admin', normalizedTarget, actorUsername, {
      targetUsername: normalizedTarget,
      temporaryPasswordIssued: !hasProvidedPassword
    });

    return {
      temporaryPassword: !hasProvidedPassword ? passwordToUse : null,
      forcePasswordChange: true
    };
  }

  async issueTemporaryPassword(actorUsername, targetUsername, validityHours = 12) {
    const normalizedActor = this.validateUsername(actorUsername);
    const normalizedTarget = this.validateUsername(targetUsername);
    const admin = await authRepository.getAdminByUsername(normalizedTarget);
    if (!admin) {
      throw new Error('Admin account not found');
    }

    if (normalizedActor === normalizedTarget) {
      throw new Error('You cannot issue a temporary password to your own account');
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const expiresAt = this.getTemporaryPasswordExpiry(validityHours);
    const hashedPassword = await bcrypt.hash(temporaryPassword, config.security.bcryptRounds);
    await authRepository.updateAdminPassword(normalizedTarget, hashedPassword, {
      forcePasswordChange: true,
      passwordExpiresAt: expiresAt
    });
    await authRepository.revokeRefreshTokensByUserId(normalizedTarget);

    await this.logAudit('issue_temporary_password', 'admin', normalizedTarget, actorUsername, {
      targetUsername: normalizedTarget,
      validityHours
    });

    return {
      username: normalizedTarget,
      temporaryPassword,
      expiresAt,
      forcePasswordChange: true
    };
  }

  async deleteAdminAccount(actorUsername, targetUsername) {
    const normalizedTarget = this.validateUsername(targetUsername);

    if (actorUsername === normalizedTarget) {
      throw new Error('You cannot delete your own account');
    }

    const existing = await authRepository.getAdminByUsername(normalizedTarget);
    if (!existing) {
      throw new Error('Admin account not found');
    }

    const role = this.normalizeRole(existing.role);
    if (role === ADMIN_ROLES.SUPER) {
      const superCount = await authRepository.countAdminsByRole(ADMIN_ROLES.SUPER);
      if (superCount <= 1) {
        throw new Error('At least one super admin account must remain');
      }
    }

    await authRepository.revokeRefreshTokensByUserId(normalizedTarget);
    const deleted = await authRepository.deleteAdmin(normalizedTarget);
    if (!deleted) {
      throw new Error('Admin account not found');
    }

    await this.logAudit('delete_admin_account', 'admin', normalizedTarget, actorUsername, {
      deletedUsername: normalizedTarget,
      role
    });

    return true;
  }

  async listAuditLogs({ limit, action, username, severity } = {}) {
    const normalizedSeverity = severity ? String(severity).trim().toLowerCase() : undefined;
    if (normalizedSeverity) {
      const allowedSeverities = new Set(['info', 'warning', 'error', 'critical']);
      if (!allowedSeverities.has(normalizedSeverity)) {
        throw new Error('Invalid severity filter');
      }
    }

    return authRepository.listAuditLogs({
      limit,
      action: action ? String(action).trim() : undefined,
      username: username ? this.validateUsername(username) : undefined,
      severity: normalizedSeverity
    });
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
  async recordFailedAttempt(username, ip) {
    const key = `${username}:${ip}`;
    const attempts = this.failedAttempts.get(key) || { count: 0, firstAttempt: Date.now() };
    attempts.count += 1;

    if (attempts.count >= config.security.maxLoginAttempts) {
      this.lockedAccounts.set(username, { unlockAt: new Date(Date.now() + config.security.lockoutDuration) });
      logger.warn('Account locked', { username, ip, attempts: attempts.count });
    }

    this.failedAttempts.set(key, attempts);
  }

  clearFailedAttempts(username) {
    this.lockedAccounts.delete(username);
    for (const key of this.failedAttempts.keys()) {
      if (key.startsWith(`${username}:`)) {
        this.failedAttempts.delete(key);
      }
    }
  }

  isAccountLocked(username) {
    const lockInfo = this.lockedAccounts.get(username);
    if (!lockInfo) {
      return false;
    }

    if (new Date() < new Date(lockInfo.unlockAt)) {
      return true;
    }

    this.lockedAccounts.delete(username);
    return false;
  }

  // ===================== AUDIT LOG =====================
  async logAudit(action, resource, resourceId, username, details = {}, severity = 'info') {
    await authRepository.insertAuditLog({
      id: uuidv4(),
      action,
      resource,
      resourceId,
      username,
      timestamp: new Date().toISOString(),
      details,
      severity
    });
  }
}

const authService = new AuthService();
authService.ADMIN_ROLES = ADMIN_ROLES;

module.exports = authService;
