const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const session = require('express-session');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const config = require('./src/config');
const { loginLimiter } = require('./src/middleware/rateLimiter');
const contentRepository = require('./src/db/repositories/contentRepository');
const changeRequestRepository = require('./src/db/repositories/changeRequestRepository');
const ResponseCache = require('./src/utils/responseCache');
const { buildSessionOptions } = require('./src/services/sessionStore');

const router = express.Router();
const uploadsDir = path.resolve(config.paths.uploads);
const galleryAssetsDir = path.resolve(config.paths.galleryAssets);
const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const safeRouteIdPattern = /^[A-Za-z0-9_-]{1,80}$/;
const safeGalleryFilePattern = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,254}$/;

const getConfiguredOrigins = () => {
  const origin = config.cors.origin;
  if (!origin || origin === '*') {
    return [];
  }

  if (Array.isArray(origin)) {
    return origin;
  }

  return String(origin)
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
};

const requireTrustedOrigin = (req, res, next) => {
  if (!unsafeMethods.has(req.method)) {
    return next();
  }

  const authorization = req.get('authorization') || '';
  if (authorization.startsWith('Bearer ')) {
    return next();
  }

  const source = req.get('origin') || req.get('referer');
  if (!source) {
    if (config.nodeEnv !== 'production') {
      return next();
    }
    return res.status(403).json({ error: 'Trusted origin required' });
  }

  try {
    const sourceOrigin = new URL(source).origin;
    const requestOrigin = `${req.protocol}://${req.get('host')}`;
    const allowedOrigins = new Set([
      requestOrigin,
      ...getConfiguredOrigins()
    ]);

    if (!allowedOrigins.has(sourceOrigin)) {
      return res.status(403).json({ error: 'Invalid request origin' });
    }

    return next();
  } catch {
    return res.status(403).json({ error: 'Invalid request origin' });
  }
};

const validateRouteId = (paramName = 'id') => (req, res, next) => {
  const value = String(req.params[paramName] || '');
  if (!safeRouteIdPattern.test(value)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  req.params[paramName] = value;
  return next();
};

const validateGalleryFile = (req, res, next) => {
  const file = String(req.params.file || '');
  if (!safeGalleryFilePattern.test(file) || file.includes('..')) {
    return res.status(400).json({ error: 'Invalid gallery file' });
  }
  req.params.file = file;
  return next();
};

// Middleware
router.use(cors({
  origin: config.cors.origin,
  credentials: true
}));
router.use(express.json({ limit: '50mb' }));
router.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session configuration
router.use(session(buildSessionOptions()));
router.use(requireTrustedOrigin);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

const AuthService = require('./src/services/authService');
const ADMIN_ROLES = AuthService.ADMIN_ROLES || {
  SUPER: 'super',
  EDITOR: 'editor',
  MODERATOR: 'moderator'
};

// Authentication middleware
const authenticateAdmin = (req, res, next) => {
  try {
    if (!req.session || !req.session.admin) {
      throw new Error();
    }

    const payload = AuthService.verifyAccessToken(req.session.admin.accessToken);
    if (!payload) {
      throw new Error();
    }

    const role = AuthService.validateRole(payload.role || req.session.admin.role);
    req.admin = {
      username: payload.username || req.session.admin.username,
      role,
      requiresPasswordChange: Boolean(payload.mustChangePassword)
    };
    req.session.admin.role = role;
    req.session.admin.requiresPasswordChange = Boolean(payload.mustChangePassword);

    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized. Please login.' });
  }
};

const requireAdminRole = (...roles) => (req, res, next) => {
  if (!req.admin) {
    return res.status(401).json({ error: 'Unauthorized. Please login.' });
  }

  if (!roles.includes(req.admin.role)) {
    AuthService.logAudit(
      'authorization_denied',
      'admin_route',
      req.originalUrl,
      req.admin.username,
      {
        requiredRoles: roles,
        role: req.admin.role,
        method: req.method,
        ip: req.ip
      },
      'warning'
    ).catch(() => {});
    return res.status(403).json({ error: 'Insufficient permissions for this action' });
  }

  next();
};

const requireContentWriteAccess = requireAdminRole(ADMIN_ROLES.SUPER, ADMIN_ROLES.EDITOR);
const requireSuperAdmin = requireAdminRole(ADMIN_ROLES.SUPER);
const requireApprovalViewAccess = requireAdminRole(ADMIN_ROLES.SUPER, ADMIN_ROLES.MODERATOR);
const requireModeratorApproval = requireAdminRole(ADMIN_ROLES.SUPER, ADMIN_ROLES.MODERATOR);

const requirePasswordChangeComplete = (req, res, next) => {
  if (req.admin?.requiresPasswordChange) {
    return res.status(403).json({
      success: false,
      error: 'Password change required before continuing',
      requiresPasswordChange: true
    });
  }

  next();
};

const getPermissionSet = (role) => ({
  canViewContent: true,
  canEditContent: role === ADMIN_ROLES.SUPER || role === ADMIN_ROLES.EDITOR,
  canManageUsers: role === ADMIN_ROLES.SUPER,
  canApproveChanges: role === ADMIN_ROLES.SUPER || role === ADMIN_ROLES.MODERATOR,
  canViewChangeQueue: role === ADMIN_ROLES.SUPER || role === ADMIN_ROLES.MODERATOR,
  canViewAuditLogs: role === ADMIN_ROLES.SUPER || role === ADMIN_ROLES.MODERATOR
});

const regenerateSession = (req) => new Promise((resolve, reject) => {
  if (!req.session || typeof req.session.regenerate !== 'function') {
    resolve();
    return;
  }

  req.session.regenerate((err) => {
    if (err) {
      reject(err);
      return;
    }
    resolve();
  });
});

const normalizeSlug = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

const normalizeEditableText = (value) =>
  String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<\/?p>/gi, '')
    .replace(/\r\n?/g, '\n')
    .trim();

const getTimeZoneOffsetMs = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const utcLike = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );

  return utcLike - date.getTime();
};

const zonedDateTimeToUtc = (dateValue, timeValue, timeZone = 'Africa/Harare') => {
  if (!dateValue || !timeValue) {
    return null;
  }

  const [year, month, day] = String(dateValue).split('-').map(Number);
  const [hour, minute, second = 0] = String(timeValue).split(':').map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) {
    return null;
  }

  try {
    const baseUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second || 0));
    const offset = getTimeZoneOffsetMs(baseUtc, timeZone);
    const candidate = new Date(baseUtc.getTime() - offset);
    const correctedOffset = getTimeZoneOffsetMs(candidate, timeZone);
    return new Date(baseUtc.getTime() - correctedOffset);
  } catch {
    return new Date(`${dateValue}T${timeValue}`);
  }
};

const getEventEndInstant = (event) => {
  const explicitEnd = event.endAt || event.end_at;
  if (explicitEnd) {
    const end = new Date(explicitEnd);
    if (!Number.isNaN(end.getTime())) {
      return end;
    }
  }

  const endDate = event.end_date || event.date;
  return zonedDateTimeToUtc(endDate, '23:59:59', event.timezone || 'Africa/Harare');
};

const isActiveOrUpcomingEvent = (event, now = new Date()) => {
  const end = getEventEndInstant(event);
  return end ? end >= now : true;
};

const canIncludePastEvents = (req) => {
  if (req.query.includePast !== 'true' || !req.session?.admin?.accessToken) {
    return false;
  }

  try {
    return Boolean(AuthService.verifyAccessToken(req.session.admin.accessToken));
  } catch {
    return false;
  }
};

const removeUploadedFile = async (file) => {
  const safeFile = path.basename(String(file || ''));
  if (!safeGalleryFilePattern.test(safeFile)) {
    return;
  }

  const filePath = path.join(uploadsDir, safeFile);
  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
};

const generateExcerpt = (text, length = 150) => {
  if (!text) return '';
  return text.substring(0, length) + (text.length > length ? '...' : '');
};

const hotCache = new ResponseCache({
  enabled: config.cache.enabled,
  defaultTtlMs: config.cache.hotTtlMs
});
const HOT_CACHE_KEYS = Object.freeze({
  events: 'hot:events:list',
  articles: 'hot:articles:list',
  principles: 'hot:principles:why_we_do'
});

const invalidateHotKey = (key) => {
  hotCache.del(key);
};

const readOrLoadHot = async (key, loader) => {
  const cached = hotCache.get(key);
  if (cached) {
    return cached;
  }

  const fresh = await loader();
  hotCache.set(key, fresh);
  return fresh;
};

const auditAction = async (req, action, resource, resourceId, details = {}, severity = 'info') => {
  try {
    await AuthService.logAudit(
      action,
      resource,
      resourceId,
      req.admin?.username || req.session?.admin?.username || null,
      {
        ...details,
        ip: req.ip
      },
      severity
    );
  } catch {
    // Do not block request flow when audit persistence fails.
  }
};

const queueChangeRequest = async (req, {
  resourceType,
  operation,
  resourceId = null,
  payload = {}
}) => {
  const requestRecord = await changeRequestRepository.createChangeRequest({
    id: uuidv4(),
    resourceType,
    operation,
    resourceId,
    payload,
    status: 'pending',
    requestedBy: req.admin.username
  });

  await auditAction(req, 'queue_change_request', resourceType, resourceId, {
    operation,
    changeRequestId: requestRecord.id
  });

  return requestRecord;
};

const handleCategoryError = (res, err, fallbackMessage = 'Category operation failed') => {
  if (err?.code === 'CATEGORY_IN_USE') {
    return res.status(409).json({
      success: false,
      error: 'Category is still used by content. Move or edit that content before deleting it.'
    });
  }

  if (err?.code === '23505') {
    return res.status(409).json({
      success: false,
      error: 'A category with that name already exists'
    });
  }

  return res.status(500).json({
    success: false,
    error: fallbackMessage
  });
};

const applyApprovedChange = async (changeRequest) => {
  const { resourceType, operation, payload } = changeRequest;

  if (resourceType === 'article') {
    if (operation === 'create') {
      const saved = await contentRepository.createArticle(payload.article);
      invalidateHotKey(HOT_CACHE_KEYS.articles);
      return saved;
    }

    if (operation === 'update') {
      const saved = await contentRepository.updateArticle(payload.id, payload.article);
      invalidateHotKey(HOT_CACHE_KEYS.articles);
      return saved;
    }

    if (operation === 'delete') {
      const deleted = await contentRepository.deleteArticle(payload.id);
      invalidateHotKey(HOT_CACHE_KEYS.articles);
      return deleted;
    }
  }

  if (resourceType === 'event') {
    if (operation === 'create') {
      const saved = await contentRepository.createEvent(payload.event);
      invalidateHotKey(HOT_CACHE_KEYS.events);
      return saved;
    }

    if (operation === 'update') {
      const saved = await contentRepository.updateEvent(payload.id, payload.event);
      invalidateHotKey(HOT_CACHE_KEYS.events);
      return saved;
    }

    if (operation === 'delete') {
      const deleted = await contentRepository.deleteEvent(payload.id);
      invalidateHotKey(HOT_CACHE_KEYS.events);
      return deleted;
    }
  }

  if (resourceType === 'gallery_category' && operation === 'create') {
    const category = await contentRepository.addGalleryCategory(payload.category);
    const folderPath = path.join(galleryAssetsDir, category.folder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    return category;
  }

  if (resourceType === 'gallery_image' && operation === 'delete') {
    const deleted = await contentRepository.deleteGalleryImagesByFile(payload.file);
    if (deleted.some(item => item.isUpload)) {
      await removeUploadedFile(payload.file);
    }
    return deleted;
  }

  if (resourceType === 'gallery_image' && operation === 'create') {
    if (payload.category) {
      await contentRepository.addGalleryCategory(payload.category);
    }
    return contentRepository.addGalleryImage(payload.image);
  }

  if (resourceType === 'gallery_image' && operation === 'update') {
    if (payload.category) {
      await contentRepository.addGalleryCategory(payload.category);
    }
    return contentRepository.updateGalleryImage(payload.id, payload.image);
  }

  throw new Error('Unsupported change request payload');
};

// ==================== AUTH ROUTES ====================

router.post('/admin/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    const tokens = await AuthService.authenticateUser(username, password, req.ip, req.headers['user-agent']);
    const payload = AuthService.verifyAccessToken(tokens.accessToken);
    const role = AuthService.validateRole(payload?.role || tokens?.user?.role);

    await regenerateSession(req);
    req.session.admin = {
      username: tokens.user?.username || username,
      role,
      requiresPasswordChange: Boolean(tokens.user?.requiresPasswordChange),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    };
    res.json({
      success: true,
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      },
      user: {
        username: req.session.admin.username,
        role,
        requiresPasswordChange: Boolean(tokens.user?.requiresPasswordChange),
        permissions: getPermissionSet(role)
      }
    });
  } catch (err) {
    res.status(401).json({ success: false, error: err.message });
  }
});

router.post('/admin/logout', async (req, res) => {
  try {
    if (req.session && req.session.admin) {
      await AuthService.logout(req.session.admin.refreshToken);
      req.session.destroy(() => {});
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

router.get('/admin/check', (req, res) => {
  if (req.session && req.session.admin) {
    const valid = AuthService.verifyAccessToken(req.session.admin.accessToken);
    if (!valid) {
      return res.json({ authenticated: false });
    }

    const role = AuthService.validateRole(valid.role || req.session.admin.role);
    req.session.admin.role = role;
    req.session.admin.requiresPasswordChange = Boolean(valid.mustChangePassword);

    return res.json({
      authenticated: true,
      username: valid.username || req.session.admin.username,
      role,
      requiresPasswordChange: Boolean(valid.mustChangePassword),
      permissions: getPermissionSet(role)
    });
  } else {
    res.json({ authenticated: false });
  }
});

router.post('/admin/change-password', authenticateAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    await AuthService.changePassword(
      req.admin.username,
      currentPassword,
      newPassword,
      req.ip,
      req.headers['user-agent']
    );

    const refreshedSession = await AuthService.authenticateUser(
      req.admin.username,
      newPassword,
      req.ip,
      req.headers['user-agent']
    );
    const payload = AuthService.verifyAccessToken(refreshedSession.accessToken);
    const role = AuthService.validateRole(payload?.role || refreshedSession?.user?.role);
    req.session.admin = {
      username: refreshedSession.user?.username || req.admin.username,
      role,
      requiresPasswordChange: Boolean(refreshedSession.user?.requiresPasswordChange),
      accessToken: refreshedSession.accessToken,
      refreshToken: refreshedSession.refreshToken
    };

    res.json({
      success: true,
      message: 'Password changed successfully',
      user: {
        username: req.session.admin.username,
        role,
        requiresPasswordChange: Boolean(refreshedSession.user?.requiresPasswordChange),
        permissions: getPermissionSet(role)
      }
    });
  } catch (err) {
    const message = err?.message || 'Failed to change password';
    const badInput = [
      'Current password is incorrect',
      'New password must be different from current password',
      'Password must be'
    ].some(prefix => message.startsWith(prefix));

    res.status(badInput ? 400 : 500).json({ success: false, error: message });
  }
});

router.get('/admin/users', authenticateAdmin, requirePasswordChangeComplete, requireAdminRole(ADMIN_ROLES.SUPER), async (req, res) => {
  try {
    const users = await AuthService.listAdminAccounts();
    await auditAction(req, 'list_admin_users', 'admin', null, {
      userCount: users.length
    });
    res.json({ success: true, users });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to load admin users' });
  }
});

router.post('/admin/users', authenticateAdmin, requirePasswordChangeComplete, requireAdminRole(ADMIN_ROLES.SUPER), async (req, res) => {
  try {
    const { username, password, role } = req.body || {};
    const created = await AuthService.createAdminAccount(req.admin.username, {
      username,
      password,
      role
    });
    res.status(201).json({ success: true, user: created });
  } catch (err) {
    const message = err?.message || 'Failed to create admin user';
    const badInput = [
      'Username',
      'Password',
      'Invalid role',
      'already exists'
    ].some(fragment => message.includes(fragment));
    res.status(badInput ? 400 : 500).json({ success: false, error: message });
  }
});

router.put('/admin/users/:username/role', authenticateAdmin, requirePasswordChangeComplete, requireAdminRole(ADMIN_ROLES.SUPER), async (req, res) => {
  try {
    const updated = await AuthService.updateAdminRole(
      req.admin.username,
      req.params.username,
      req.body?.role
    );
    res.json({ success: true, user: updated });
  } catch (err) {
    const message = err?.message || 'Failed to update user role';
    const badInput = [
      'Invalid role',
      'not found',
      'must remain',
      'Username'
    ].some(fragment => message.includes(fragment));
    res.status(badInput ? 400 : 500).json({ success: false, error: message });
  }
});

router.put('/admin/users/:username/password', authenticateAdmin, requirePasswordChangeComplete, requireAdminRole(ADMIN_ROLES.SUPER), async (req, res) => {
  try {
    const resetResult = await AuthService.resetAdminPassword(
      req.admin.username,
      req.params.username,
      req.body?.newPassword
    );
    res.json({ success: true, message: 'Password reset successfully', ...resetResult });
  } catch (err) {
    const message = err?.message || 'Failed to reset password';
    const badInput = [
      'Password',
      'not found',
      'Username'
    ].some(fragment => message.includes(fragment));
    res.status(badInput ? 400 : 500).json({ success: false, error: message });
  }
});

router.post('/admin/users/:username/temporary-password', authenticateAdmin, requirePasswordChangeComplete, requireAdminRole(ADMIN_ROLES.SUPER), async (req, res) => {
  try {
    const validityHours = Number.parseInt(req.body?.validityHours, 10);
    const result = await AuthService.issueTemporaryPassword(
      req.admin.username,
      req.params.username,
      Number.isFinite(validityHours) && validityHours > 0 ? validityHours : 12
    );
    res.json({ success: true, ...result });
  } catch (err) {
    const message = err?.message || 'Failed to issue temporary password';
    const badInput = [
      'not found',
      'Username'
    ].some(fragment => message.includes(fragment));
    res.status(badInput ? 400 : 500).json({ success: false, error: message });
  }
});

router.delete('/admin/users/:username', authenticateAdmin, requirePasswordChangeComplete, requireAdminRole(ADMIN_ROLES.SUPER), async (req, res) => {
  try {
    await AuthService.deleteAdminAccount(req.admin.username, req.params.username);
    res.json({ success: true, message: 'Admin user deleted' });
  } catch (err) {
    const message = err?.message || 'Failed to delete admin user';
    const badInput = [
      'cannot delete your own account',
      'not found',
      'must remain',
      'Username'
    ].some(fragment => message.includes(fragment));
    res.status(badInput ? 400 : 500).json({ success: false, error: message });
  }
});

router.get('/admin/changes/pending', authenticateAdmin, requirePasswordChangeComplete, requireApprovalViewAccess, async (req, res) => {
  try {
    const requests = await changeRequestRepository.listPendingChangeRequests();
    await auditAction(req, 'view_pending_change_requests', 'change_request', null, {
      count: requests.length
    });
    res.json({ success: true, requests });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to load pending changes' });
  }
});

router.get('/admin/changes/recent', authenticateAdmin, requirePasswordChangeComplete, requireApprovalViewAccess, async (req, res) => {
  try {
    const requests = await changeRequestRepository.listRecentChangeRequests(100);
    await auditAction(req, 'view_recent_change_requests', 'change_request', null, {
      count: requests.length
    });
    res.json({ success: true, requests });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to load change history' });
  }
});

router.post('/admin/changes/:id/approve', validateRouteId(), authenticateAdmin, requirePasswordChangeComplete, requireModeratorApproval, async (req, res) => {
  try {
    const changeRequest = await changeRequestRepository.getChangeRequestById(req.params.id);
    if (!changeRequest) {
      return res.status(404).json({ success: false, error: 'Change request not found' });
    }
    if (changeRequest.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Change request already processed' });
    }
    if (changeRequest.requestedBy === req.admin.username) {
      return res.status(403).json({ success: false, error: 'You cannot approve your own change request' });
    }

    const result = await applyApprovedChange(changeRequest);
    const updated = await changeRequestRepository.updateChangeRequestReview({
      id: changeRequest.id,
      status: 'approved',
      reviewedBy: req.admin.username,
      reviewNote: req.body?.reviewNote || null
    });

    await auditAction(req, 'approve_change_request', changeRequest.resourceType, changeRequest.resourceId, {
      changeRequestId: changeRequest.id
    });

    res.json({ success: true, request: updated, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to approve change request' });
  }
});

router.post('/admin/changes/:id/reject', validateRouteId(), authenticateAdmin, requirePasswordChangeComplete, requireModeratorApproval, async (req, res) => {
  try {
    const changeRequest = await changeRequestRepository.getChangeRequestById(req.params.id);
    if (!changeRequest) {
      return res.status(404).json({ success: false, error: 'Change request not found' });
    }
    if (changeRequest.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Change request already processed' });
    }
    if (changeRequest.requestedBy === req.admin.username) {
      return res.status(403).json({ success: false, error: 'You cannot reject your own change request' });
    }

    const updated = await changeRequestRepository.updateChangeRequestReview({
      id: changeRequest.id,
      status: 'rejected',
      reviewedBy: req.admin.username,
      reviewNote: req.body?.reviewNote || null
    });

    await auditAction(req, 'reject_change_request', changeRequest.resourceType, changeRequest.resourceId, {
      changeRequestId: changeRequest.id
    });

    res.json({ success: true, request: updated });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to reject change request' });
  }
});

router.get('/admin/audit-logs', authenticateAdmin, requirePasswordChangeComplete, requireApprovalViewAccess, async (req, res) => {
  try {
    const limit = Number.parseInt(req.query?.limit, 10);
    const logs = await AuthService.listAuditLogs({
      limit: Number.isFinite(limit) && limit > 0 ? limit : 100,
      action: req.query?.action || undefined,
      username: req.query?.username || undefined,
      severity: req.query?.severity || undefined
    });

    await auditAction(req, 'view_audit_logs', 'audit_log', null, {
      resultCount: logs.length,
      filters: {
        action: req.query?.action || null,
        username: req.query?.username || null,
        severity: req.query?.severity || null
      }
    });

    res.json({ success: true, logs });
  } catch (err) {
    const message = String(err?.message || '');
    const isBadInput = message.includes('Username') || message.includes('severity');
    res.status(isBadInput ? 400 : 500).json({
      success: false,
      error: message || 'Failed to load audit logs'
    });
  }
});

// ==================== CATEGORY ROUTES ====================

router.get('/article-categories', async (req, res) => {
  try {
    res.json(await contentRepository.getAllArticleCategories());
  } catch {
    res.status(500).json({ error: 'Failed to load article categories' });
  }
});

router.post('/article-categories', authenticateAdmin, requirePasswordChangeComplete, requireSuperAdmin, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, error: 'Category name is required' });
    }

    const category = await contentRepository.addArticleCategory({
      name,
      slug: normalizeSlug(req.body.slug || name)
    });
    await auditAction(req, 'create_article_category', 'article_category', category.slug);
    res.status(201).json({ success: true, category });
  } catch (err) {
    handleCategoryError(res, err, 'Failed to create article category');
  }
});

router.put('/article-categories/:slug', validateRouteId('slug'), authenticateAdmin, requirePasswordChangeComplete, requireSuperAdmin, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, error: 'Category name is required' });
    }

    const category = await contentRepository.updateArticleCategory(req.params.slug, {
      name,
      slug: normalizeSlug(req.body.slug || name)
    });
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    invalidateHotKey(HOT_CACHE_KEYS.articles);
    await auditAction(req, 'update_article_category', 'article_category', req.params.slug, {
      newSlug: category.slug
    });
    res.json({ success: true, category });
  } catch (err) {
    handleCategoryError(res, err, 'Failed to update article category');
  }
});

router.delete('/article-categories/:slug', validateRouteId('slug'), authenticateAdmin, requirePasswordChangeComplete, requireSuperAdmin, async (req, res) => {
  try {
    const category = await contentRepository.deleteArticleCategory(req.params.slug);
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    await auditAction(req, 'delete_article_category', 'article_category', req.params.slug);
    res.json({ success: true, category });
  } catch (err) {
    handleCategoryError(res, err, 'Failed to delete article category');
  }
});

router.get('/event-categories', async (req, res) => {
  try {
    res.json(await contentRepository.getAllEventCategories());
  } catch {
    res.status(500).json({ error: 'Failed to load event categories' });
  }
});

router.post('/event-categories', authenticateAdmin, requirePasswordChangeComplete, requireSuperAdmin, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, error: 'Category name is required' });
    }

    const category = await contentRepository.addEventCategory({
      name,
      slug: normalizeSlug(req.body.slug || name)
    });
    await auditAction(req, 'create_event_category', 'event_category', category.slug);
    res.status(201).json({ success: true, category });
  } catch (err) {
    handleCategoryError(res, err, 'Failed to create event category');
  }
});

router.put('/event-categories/:slug', validateRouteId('slug'), authenticateAdmin, requirePasswordChangeComplete, requireSuperAdmin, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, error: 'Category name is required' });
    }

    const category = await contentRepository.updateEventCategory(req.params.slug, {
      name,
      slug: normalizeSlug(req.body.slug || name)
    });
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    invalidateHotKey(HOT_CACHE_KEYS.events);
    await auditAction(req, 'update_event_category', 'event_category', req.params.slug, {
      newSlug: category.slug
    });
    res.json({ success: true, category });
  } catch (err) {
    handleCategoryError(res, err, 'Failed to update event category');
  }
});

router.delete('/event-categories/:slug', validateRouteId('slug'), authenticateAdmin, requirePasswordChangeComplete, requireSuperAdmin, async (req, res) => {
  try {
    const category = await contentRepository.deleteEventCategory(req.params.slug);
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    await auditAction(req, 'delete_event_category', 'event_category', req.params.slug);
    res.json({ success: true, category });
  } catch (err) {
    handleCategoryError(res, err, 'Failed to delete event category');
  }
});

// ==================== ARTICLES ROUTES ====================

router.get('/articles', async (req, res) => {
  try {
    const articles = await readOrLoadHot(HOT_CACHE_KEYS.articles, () => contentRepository.getAllArticles());
    res.json(articles);
  } catch {
    res.status(500).json({ error: 'Failed to load articles' });
  }
});

router.get('/articles/:id', validateRouteId(), async (req, res) => {
  try {
    const article = await contentRepository.getArticleById(req.params.id);
    if (article) {
      res.json(article);
    } else {
      res.status(404).json({ error: 'Article not found' });
    }
  } catch {
    res.status(500).json({ error: 'Failed to load article' });
  }
});

router.post('/articles', authenticateAdmin, requirePasswordChangeComplete, requireContentWriteAccess, async (req, res) => {
  try {
    const { title, content, author, date, category } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: 'Title and Content required'
      });
    }

    const newArticle = {
      id: Date.now().toString(),
      title,
      content,
      author: author || req.admin.username,
      excerpt: generateExcerpt(content),
      date: date || new Date().toISOString().split('T')[0],
      category: category || 'General',
      tags: [],
      imageUrl: null,
      published: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (req.admin.role === ADMIN_ROLES.EDITOR) {
      const queued = await queueChangeRequest(req, {
        resourceType: 'article',
        operation: 'create',
        payload: { article: newArticle }
      });

      return res.status(202).json({
        success: true,
        pendingApproval: true,
        changeRequestId: queued.id,
        message: 'Article create request submitted for moderator approval'
      });
    }

    const saved = await contentRepository.createArticle(newArticle);
    invalidateHotKey(HOT_CACHE_KEYS.articles);
    await auditAction(req, 'create_article', 'article', saved.id);

    res.status(201).json({
      success: true,
      article: saved
    });
  } catch {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.put('/articles/:id', validateRouteId(), authenticateAdmin, requirePasswordChangeComplete, requireContentWriteAccess, async (req, res) => {
  try {
    const existing = await contentRepository.getArticleById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const updatePayload = {
      ...existing,
      title: req.body.title || existing.title,
      content: req.body.content || existing.content,
      author: req.body.author || existing.author,
      date: req.body.date || existing.date,
      category: req.body.category || existing.category,
      excerpt: req.body.excerpt || generateExcerpt(req.body.content || existing.content),
      updatedAt: new Date().toISOString()
    };

    if (req.admin.role === ADMIN_ROLES.EDITOR) {
      const queued = await queueChangeRequest(req, {
        resourceType: 'article',
        operation: 'update',
        resourceId: req.params.id,
        payload: {
          id: req.params.id,
          article: updatePayload
        }
      });

      return res.status(202).json({
        success: true,
        pendingApproval: true,
        changeRequestId: queued.id,
        message: 'Article update request submitted for moderator approval'
      });
    }

    const updated = await contentRepository.updateArticle(req.params.id, updatePayload);
    invalidateHotKey(HOT_CACHE_KEYS.articles);
    await auditAction(req, 'update_article', 'article', req.params.id);

    res.json({ success: true, message: 'Article updated', article: updated });
  } catch {
    res.status(500).json({ error: 'Failed to update article' });
  }
});

router.delete('/articles/:id', validateRouteId(), authenticateAdmin, requirePasswordChangeComplete, requireContentWriteAccess, async (req, res) => {
  try {
    if (req.admin.role === ADMIN_ROLES.EDITOR) {
      const existing = await contentRepository.getArticleById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Article not found' });
      }

      const queued = await queueChangeRequest(req, {
        resourceType: 'article',
        operation: 'delete',
        resourceId: req.params.id,
        payload: { id: req.params.id }
      });

      return res.status(202).json({
        success: true,
        pendingApproval: true,
        changeRequestId: queued.id,
        message: 'Article delete request submitted for moderator approval'
      });
    }

    const deleted = await contentRepository.deleteArticle(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Article not found' });
    }
    invalidateHotKey(HOT_CACHE_KEYS.articles);
    await auditAction(req, 'delete_article', 'article', req.params.id);

    res.json({ success: true, message: 'Article deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete article' });
  }
});

// ==================== EVENTS ROUTES ====================

router.get('/events', async (req, res) => {
  try {
    const events = await readOrLoadHot(HOT_CACHE_KEYS.events, () => contentRepository.getAllEvents());
    res.json(canIncludePastEvents(req) ? events : events.filter(event => isActiveOrUpcomingEvent(event)));
  } catch {
    res.status(500).json({ error: 'Failed to load events' });
  }
});

router.get('/events/:id', validateRouteId(), async (req, res) => {
  try {
    const event = await contentRepository.getEventById(req.params.id);
    if (event) {
      res.json(event);
    } else {
      res.status(404).json({ error: 'Event not found' });
    }
  } catch {
    res.status(500).json({ error: 'Failed to load event' });
  }
});

router.post('/events', authenticateAdmin, requirePasswordChangeComplete, requireContentWriteAccess, upload.single('image'), async (req, res) => {
  try {
    const {
      title,
      description,
      date,
      end_date,
      time,
      start_at,
      end_at,
      timezone,
      location,
      category,
      details_url
    } = req.body;

    if (!title || !description || !date || !location) {
      return res.status(400).json({
        error: 'Title, description, date and location are required'
      });
    }

    const newEvent = {
      id: uuidv4(),
      title,
      description: normalizeEditableText(description),
      date,
      end_date: end_date || null,
      time: time || null,
      startAt: start_at || null,
      endAt: end_at || null,
      timezone: timezone || null,
      location,
      category: category || null,
      details_url: details_url || null,
      image: req.file ? `/uploads/${req.file.filename}` : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.admin.username,
      published: false
    };

    if (req.admin.role === ADMIN_ROLES.EDITOR) {
      const queued = await queueChangeRequest(req, {
        resourceType: 'event',
        operation: 'create',
        payload: { event: newEvent }
      });

      return res.status(202).json({
        success: true,
        pendingApproval: true,
        changeRequestId: queued.id,
        message: 'Event create request submitted for moderator approval'
      });
    }

    const saved = await contentRepository.createEvent(newEvent);
    invalidateHotKey(HOT_CACHE_KEYS.events);
    await auditAction(req, 'create_event', 'event', saved.id);

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      event: saved
    });
  } catch {
    res.status(500).json({ error: 'Failed to create event' });
  }
});

router.put('/events/:id', validateRouteId(), authenticateAdmin, requirePasswordChangeComplete, requireContentWriteAccess, upload.single('image'), async (req, res) => {
  try {
    const existing = await contentRepository.getEventById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const updatePayload = {
      ...existing,
      title: req.body.title || existing.title,
      description: Object.prototype.hasOwnProperty.call(req.body, 'description')
        ? normalizeEditableText(req.body.description) || existing.description
        : existing.description,
      date: req.body.date || existing.date,
      end_date: Object.prototype.hasOwnProperty.call(req.body, 'end_date') ? req.body.end_date || null : existing.end_date,
      time: Object.prototype.hasOwnProperty.call(req.body, 'time') ? req.body.time || null : existing.time,
      startAt: Object.prototype.hasOwnProperty.call(req.body, 'start_at') ? req.body.start_at || null : existing.startAt || null,
      endAt: Object.prototype.hasOwnProperty.call(req.body, 'end_at') ? req.body.end_at || null : existing.endAt || null,
      timezone: Object.prototype.hasOwnProperty.call(req.body, 'timezone') ? req.body.timezone || null : existing.timezone || null,
      location: req.body.location || existing.location,
      image: req.file
        ? `/uploads/${req.file.filename}`
        : req.body.image || existing.image,
      category: req.body.category || existing.category,
      details_url: req.body.details_url || existing.details_url,
      updatedAt: new Date().toISOString()
    };

    if (req.admin.role === ADMIN_ROLES.EDITOR) {
      const queued = await queueChangeRequest(req, {
        resourceType: 'event',
        operation: 'update',
        resourceId: req.params.id,
        payload: {
          id: req.params.id,
          event: updatePayload
        }
      });

      return res.status(202).json({
        success: true,
        pendingApproval: true,
        changeRequestId: queued.id,
        message: 'Event update request submitted for moderator approval'
      });
    }

    const updated = await contentRepository.updateEvent(req.params.id, updatePayload);
    invalidateHotKey(HOT_CACHE_KEYS.events);
    await auditAction(req, 'update_event', 'event', req.params.id);

    res.json({ success: true, message: 'Event updated', event: updated });
  } catch {
    res.status(500).json({ error: 'Failed to update event' });
  }
});

router.delete('/events/:id', validateRouteId(), authenticateAdmin, requirePasswordChangeComplete, requireContentWriteAccess, async (req, res) => {
  try {
    if (req.admin.role === ADMIN_ROLES.EDITOR) {
      const existing = await contentRepository.getEventById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const queued = await queueChangeRequest(req, {
        resourceType: 'event',
        operation: 'delete',
        resourceId: req.params.id,
        payload: { id: req.params.id }
      });

      return res.status(202).json({
        success: true,
        pendingApproval: true,
        changeRequestId: queued.id,
        message: 'Event delete request submitted for moderator approval'
      });
    }

    const deleted = await contentRepository.deleteEvent(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Event not found' });
    }
    invalidateHotKey(HOT_CACHE_KEYS.events);
    await auditAction(req, 'delete_event', 'event', req.params.id);

    res.json({ success: true, message: 'Event deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// ==================== GALLERY ROUTES ====================

router.get('/gallery/categories', async (req, res) => {
  try {
    const categories = await contentRepository.getAllGalleryCategories();
    res.json(categories);
  } catch {
    res.status(500).json({ error: 'Failed to load gallery categories' });
  }
});

router.get('/gallery', async (req, res) => {
  try {
    const categories = await contentRepository.getAllGalleryCategories();
    const images = await contentRepository.getAllGalleryImages();
    const categoryBySlug = new Map(categories.map(category => [category.slug, category]));

    res.json({
      categories,
      images: images.map(item => {
        const category = categoryBySlug.get(item.category);
        const encodedFile = encodeURIComponent(item.file || '');
        const encodedFolder = encodeURIComponent(category?.folder || item.category || '');

        return {
          id: item.id,
          title: item.title || item.file,
          category: item.category,
          file: item.file,
          date: item.date,
          description: item.caption || '',
          caption: item.caption || '',
          isUpload: item.isUpload,
          url: item.isUpload
            ? `/uploads/${encodedFile}`
            : `/assets/images/gallery/${encodedFolder}/${encodedFile}`
        };
      })
    });
  } catch {
    res.status(500).json({ error: 'Gallery load failed' });
  }
});

router.post('/gallery/categories', authenticateAdmin, requirePasswordChangeComplete, requireContentWriteAccess, async (req, res) => {
  try {
    const { name, slug, folder, filterClass } = req.body;

    if (!name && !slug) {
      return res.status(400).json({
        error: 'Name or slug required'
      });
    }

    const normalizedSlug = normalizeSlug(slug || name);
    if (!normalizedSlug) {
      return res.status(400).json({
        error: 'Invalid category slug'
      });
    }

    const categoryPayload = {
      name: name || normalizedSlug,
      slug: normalizedSlug,
      folder: folder || normalizedSlug,
      filterClass: filterClass || normalizedSlug
    };

    if (req.admin.role === ADMIN_ROLES.EDITOR) {
      const queued = await queueChangeRequest(req, {
        resourceType: 'gallery_category',
        operation: 'create',
        resourceId: normalizedSlug,
        payload: {
          category: categoryPayload
        }
      });

      return res.status(202).json({
        success: true,
        pendingApproval: true,
        changeRequestId: queued.id,
        message: 'Gallery category request submitted for moderator approval'
      });
    }

    const category = await contentRepository.addGalleryCategory(categoryPayload);

    const folderPath = path.join(galleryAssetsDir, category.folder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    await auditAction(req, 'create_gallery_category', 'gallery_category', category.slug);

    res.json({
      success: true,
      category
    });
  } catch {
    res.status(500).json({
      error: 'Failed to add category'
    });
  }
});

router.put('/gallery/categories/:slug', validateRouteId('slug'), authenticateAdmin, requirePasswordChangeComplete, requireSuperAdmin, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, error: 'Category name is required' });
    }

    const category = await contentRepository.updateGalleryCategory(req.params.slug, {
      name,
      folder: req.body.folder,
      filterClass: req.body.filterClass
    });
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    await auditAction(req, 'update_gallery_category', 'gallery_category', req.params.slug);
    res.json({ success: true, category });
  } catch (err) {
    handleCategoryError(res, err, 'Failed to update gallery category');
  }
});

router.delete('/gallery/categories/:slug', validateRouteId('slug'), authenticateAdmin, requirePasswordChangeComplete, requireSuperAdmin, async (req, res) => {
  try {
    const category = await contentRepository.deleteGalleryCategory(req.params.slug);
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    await auditAction(req, 'delete_gallery_category', 'gallery_category', req.params.slug);
    res.json({ success: true, category });
  } catch (err) {
    handleCategoryError(res, err, 'Failed to delete gallery category');
  }
});

router.post('/gallery', authenticateAdmin, requirePasswordChangeComplete, requireContentWriteAccess, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Image file is required'
      });
    }

    const categoryInput = req.body.category || 'uploads';
    const categorySlug = normalizeSlug(categoryInput) || 'uploads';
    const categories = await contentRepository.getAllGalleryCategories();
    const existingCategory = categories.find(category => category.slug === categorySlug);
    const categoryPayload = existingCategory || {
      name: String(categoryInput).trim() || 'Uploads',
      slug: categorySlug,
      folder: categorySlug,
      filterClass: categorySlug
    };
    const now = new Date();
    const caption = req.body.description || req.body.caption || null;
    const galleryItem = {
      id: uuidv4(),
      title: req.body.title || req.file.originalname,
      category: categorySlug,
      file: req.file.filename,
      date: now.toISOString().split('T')[0],
      caption,
      originalName: req.file.originalname,
      uploadedBy: req.admin.username,
      createdAt: now.toISOString(),
      size: req.file.size,
      mimeType: req.file.mimetype,
      isUpload: true
    };

    if (req.admin.role === ADMIN_ROLES.EDITOR) {
      const queued = await queueChangeRequest(req, {
        resourceType: 'gallery_image',
        operation: 'create',
        resourceId: galleryItem.id,
        payload: {
          image: galleryItem,
          category: existingCategory ? null : categoryPayload
        }
      });

      return res.status(202).json({
        success: true,
        pendingApproval: true,
        changeRequestId: queued.id,
        message: 'Gallery upload request submitted for moderator approval'
      });
    }

    if (!existingCategory) {
      await contentRepository.addGalleryCategory(categoryPayload);
    }

    const saved = await contentRepository.addGalleryImage(galleryItem);
    await auditAction(req, 'upload_gallery_image', 'gallery_image', saved.id, {
      file: saved.file,
      category: saved.category
    });

    res.status(201).json({
      success: true,
      image: {
        ...saved,
        description: saved.caption || '',
        url: `/uploads/${encodeURIComponent(saved.file)}`
      }
    });
  } catch (err) {
    if (req.file?.filename) {
      await removeUploadedFile(req.file.filename).catch(() => {});
    }

    res.status(500).json({
      success: false,
      error: 'Failed to upload gallery image'
    });
  }
});

router.put('/gallery/:id', validateRouteId(), authenticateAdmin, requirePasswordChangeComplete, requireContentWriteAccess, async (req, res) => {
  try {
    const existing = await contentRepository.getGalleryImageById(req.params.id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Gallery image not found'
      });
    }

    const categoryInput = existing.isUpload
      ? req.body.category || existing.category || 'uploads'
      : existing.category || 'uploads';
    const categorySlug = normalizeSlug(categoryInput) || existing.category || 'uploads';
    const categories = await contentRepository.getAllGalleryCategories();
    const existingCategory = categories.find(category => category.slug === categorySlug);
    const categoryPayload = existingCategory || {
      name: String(categoryInput).trim() || categorySlug,
      slug: categorySlug,
      folder: categorySlug,
      filterClass: categorySlug
    };

    const updatePayload = {
      title: req.body.title || existing.title || existing.file,
      category: categorySlug,
      caption: Object.prototype.hasOwnProperty.call(req.body, 'description')
        ? req.body.description || null
        : Object.prototype.hasOwnProperty.call(req.body, 'caption')
          ? req.body.caption || null
          : existing.caption || null,
      date: req.body.date || existing.date || null
    };

    if (req.admin.role === ADMIN_ROLES.EDITOR) {
      const queued = await queueChangeRequest(req, {
        resourceType: 'gallery_image',
        operation: 'update',
        resourceId: req.params.id,
        payload: {
          id: req.params.id,
          image: updatePayload,
          category: existingCategory ? null : categoryPayload
        }
      });

      return res.status(202).json({
        success: true,
        pendingApproval: true,
        changeRequestId: queued.id,
        message: 'Gallery image update request submitted for moderator approval'
      });
    }

    if (!existingCategory) {
      await contentRepository.addGalleryCategory(categoryPayload);
    }

    const updated = await contentRepository.updateGalleryImage(req.params.id, updatePayload);
    await auditAction(req, 'update_gallery_image', 'gallery_image', req.params.id, {
      file: existing.file,
      category: updated.category
    });

    res.json({
      success: true,
      image: {
        ...updated,
        description: updated.caption || '',
        url: updated.isUpload
          ? `/uploads/${encodeURIComponent(updated.file)}`
          : null
      }
    });
  } catch {
    res.status(500).json({
      success: false,
      error: 'Failed to update gallery image'
    });
  }
});

router.get('/gallery/count', async (req, res) => {
  try {
    const count = await contentRepository.countGalleryImages();
    res.json({ count });
  } catch {
    res.status(500).json({ error: 'Count failed' });
  }
});

router.delete('/gallery/:file', validateGalleryFile, authenticateAdmin, requirePasswordChangeComplete, requireContentWriteAccess, async (req, res) => {
  try {
    if (req.admin.role === ADMIN_ROLES.EDITOR) {
      const queued = await queueChangeRequest(req, {
        resourceType: 'gallery_image',
        operation: 'delete',
        resourceId: req.params.file,
        payload: { file: req.params.file }
      });

      return res.status(202).json({
        success: true,
        pendingApproval: true,
        changeRequestId: queued.id,
        message: 'Gallery delete request submitted for moderator approval'
      });
    }

    const deleted = await contentRepository.deleteGalleryImagesByFile(req.params.file);
    if (deleted.some(item => item.isUpload)) {
      await removeUploadedFile(req.params.file);
    }

    await auditAction(req, 'delete_gallery_image', 'gallery_image', req.params.file);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Delete failed' });
  }
});

router.get('/principles', async (req, res) => {
  try {
    const content = await readOrLoadHot(HOT_CACHE_KEYS.principles, () => contentRepository.getContentBlob('why_we_do'));
    if (!content) {
      return res.json({
        sectionTitle: 'Why We Do What We Do',
        organization: 'The Africa Apostolic Church',
        items: []
      });
    }

    res.json(content);
  } catch {
    res.status(500).json({ error: 'Failed to load principles content' });
  }
});

// ==================== ERROR HANDLING ====================

router.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

module.exports = router;
