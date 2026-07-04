const { query } = require('../client');

const mapAdminRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    username: row.username,
    role: row.role || 'super',
    password: row.password_hash,
    forcePasswordChange: Boolean(row.force_password_change),
    passwordExpiresAt: row.password_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const mapRefreshTokenRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    token: row.token,
    type: row.token_type,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    revoked: row.revoked,
    ipAddress: row.ip_address,
    userAgent: row.user_agent
  };
};

const getAdminByUsername = async (username) => {
  const result = await query(
    `SELECT *
     FROM admins
     WHERE username = $1`,
    [username]
  );
  return mapAdminRow(result.rows[0]);
};

const createAdmin = async ({
  username,
  password,
  role = 'super',
  forcePasswordChange = false,
  passwordExpiresAt = null
}) => {
  const result = await query(
    `INSERT INTO admins (
      username, role, password_hash, force_password_change, password_expires_at, created_at, updated_at
     )
     VALUES ($1, $2, $3, $4, $5::timestamptz, NOW(), NOW())
     ON CONFLICT (username)
     DO UPDATE SET
       role = EXCLUDED.role,
       password_hash = EXCLUDED.password_hash,
       force_password_change = EXCLUDED.force_password_change,
       password_expires_at = EXCLUDED.password_expires_at,
       updated_at = NOW()
     RETURNING *`,
    [username, role, password, Boolean(forcePasswordChange), passwordExpiresAt || null]
  );
  return mapAdminRow(result.rows[0]);
};

const updateAdminPassword = async (
  username,
  passwordHash,
  { forcePasswordChange = false, passwordExpiresAt = null } = {}
) => {
  const result = await query(
    `UPDATE admins
     SET password_hash = $2,
         force_password_change = $3,
         password_expires_at = $4::timestamptz,
         updated_at = NOW()
     WHERE username = $1
     RETURNING *`,
    [username, passwordHash, Boolean(forcePasswordChange), passwordExpiresAt || null]
  );
  return mapAdminRow(result.rows[0]);
};

const updateAdminRole = async (username, role) => {
  const result = await query(
    `UPDATE admins
     SET role = $2, updated_at = NOW()
     WHERE username = $1
     RETURNING *`,
    [username, role]
  );
  return mapAdminRow(result.rows[0]);
};

const listAdmins = async () => {
  const result = await query(
    `SELECT username, role, force_password_change, password_expires_at, created_at, updated_at
     FROM admins
     ORDER BY username ASC`
  );

  return result.rows.map(row => ({
    username: row.username,
    role: row.role || 'super',
    forcePasswordChange: Boolean(row.force_password_change),
    passwordExpiresAt: row.password_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
};

const countAdminsByRole = async (role) => {
  const result = await query(
    `SELECT COUNT(*)::int AS count
     FROM admins
     WHERE role = $1`,
    [role]
  );
  return result.rows[0]?.count || 0;
};

const deleteAdmin = async (username) => {
  const result = await query(
    `DELETE FROM admins
     WHERE username = $1
     RETURNING username, role, created_at, updated_at`,
    [username]
  );
  return result.rows[0]
    ? {
      username: result.rows[0].username,
      role: result.rows[0].role || 'super',
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at
    }
    : null;
};

const insertRefreshToken = async (record) => {
  const result = await query(
    `INSERT INTO refresh_tokens (
      id, user_id, token, token_type, expires_at, created_at, revoked, ip_address, user_agent
    )
    VALUES (
      $1, $2, $3, $4, $5::timestamptz, COALESCE($6::timestamptz, NOW()), $7, $8, $9
    )
    RETURNING *`,
    [
      record.id,
      record.userId,
      record.token,
      record.type || 'refresh',
      record.expiresAt,
      record.createdAt || null,
      Boolean(record.revoked),
      record.ipAddress || null,
      record.userAgent || null
    ]
  );
  return mapRefreshTokenRow(result.rows[0]);
};

const findActiveRefreshToken = async (token) => {
  const result = await query(
    `SELECT *
     FROM refresh_tokens
     WHERE token = $1
       AND revoked = FALSE
       AND expires_at > NOW()
     LIMIT 1`,
    [token]
  );
  return mapRefreshTokenRow(result.rows[0]);
};

const revokeRefreshTokenById = async (id) => {
  await query(
    `UPDATE refresh_tokens
     SET revoked = TRUE
     WHERE id = $1`,
    [id]
  );
};

const revokeRefreshTokenByToken = async (token) => {
  await query(
    `UPDATE refresh_tokens
     SET revoked = TRUE
     WHERE token = $1`,
    [token]
  );
};

const revokeRefreshTokensByUserId = async (userId) => {
  await query(
    `UPDATE refresh_tokens
     SET revoked = TRUE
     WHERE user_id = $1`,
    [userId]
  );
};

const insertAuditLog = async (entry) => {
  await query(
    `INSERT INTO audit_logs (
      id, action, resource, resource_id, username, details, severity, created_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6::jsonb, $7, COALESCE($8::timestamptz, NOW())
    )`,
    [
      entry.id,
      entry.action,
      entry.resource || null,
      entry.resourceId || null,
      entry.username || null,
      JSON.stringify(entry.details || {}),
      entry.severity || 'info',
      entry.timestamp || null
    ]
  );
};

const listAuditLogs = async ({ limit = 100, action, username, severity } = {}) => {
  const normalizedLimit = Math.max(1, Math.min(500, Number.parseInt(limit, 10) || 100));
  const values = [];
  const where = [];

  if (action) {
    values.push(action);
    where.push(`action = $${values.length}`);
  }

  if (username) {
    values.push(username);
    where.push(`username = $${values.length}`);
  }

  if (severity) {
    values.push(severity);
    where.push(`severity = $${values.length}`);
  }

  values.push(normalizedLimit);
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const result = await query(
    `SELECT id, action, resource, resource_id, username, details, severity, created_at
     FROM audit_logs
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${values.length}`,
    values
  );

  return result.rows.map(row => ({
    id: row.id,
    action: row.action,
    resource: row.resource,
    resourceId: row.resource_id,
    username: row.username,
    details: row.details || {},
    severity: row.severity,
    createdAt: row.created_at
  }));
};

const pruneExpiredRefreshTokens = async () => {
  await query(
    `DELETE FROM refresh_tokens
     WHERE expires_at < NOW() - INTERVAL '7 days'`
  );
};

module.exports = {
  getAdminByUsername,
  createAdmin,
  updateAdminPassword,
  updateAdminRole,
  listAdmins,
  countAdminsByRole,
  deleteAdmin,
  insertRefreshToken,
  findActiveRefreshToken,
  revokeRefreshTokenById,
  revokeRefreshTokenByToken,
  revokeRefreshTokensByUserId,
  insertAuditLog,
  listAuditLogs,
  pruneExpiredRefreshTokens
};
