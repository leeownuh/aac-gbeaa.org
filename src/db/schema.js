const logger = require('../utils/logger');
const { query } = require('./client');

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS admins (
    username TEXT PRIMARY KEY,
    role TEXT NOT NULL DEFAULT 'super',
    password_hash TEXT NOT NULL,
    force_password_change BOOLEAN NOT NULL DEFAULT FALSE,
    password_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE admins
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'super'`,
  `ALTER TABLE admins
    ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE admins
    ADD COLUMN IF NOT EXISTS password_expires_at TIMESTAMPTZ`,
  `UPDATE admins
    SET role = 'super'
    WHERE role IS NULL OR TRIM(role) = ''`,
  `UPDATE admins
    SET role = 'moderator'
    WHERE role = 'viewer'`,
  `CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    token_type TEXT NOT NULL DEFAULT 'refresh',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    ip_address TEXT,
    user_agent TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_lookup
    ON refresh_tokens (token, revoked)`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    resource TEXT,
    resource_id TEXT,
    username TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    severity TEXT NOT NULL DEFAULT 'info',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_created
    ON audit_logs (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action
    ON audit_logs (username, action, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT NOT NULL,
    excerpt TEXT,
    date_text TEXT,
    category TEXT,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    image_url TEXT,
    published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    date_text TEXT NOT NULL,
    end_date_text TEXT,
    time_text TEXT,
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    timezone TEXT,
    location TEXT NOT NULL,
    category TEXT,
    details_url TEXT,
    image TEXT,
    created_by TEXT,
    published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE events
    ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ`,
  `ALTER TABLE events
    ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ`,
  `ALTER TABLE events
    ADD COLUMN IF NOT EXISTS timezone TEXT`,
  `CREATE TABLE IF NOT EXISTS gallery_categories (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    folder TEXT NOT NULL,
    filter_class TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS gallery_images (
    id TEXT PRIMARY KEY,
    title TEXT,
    category_slug TEXT NOT NULL REFERENCES gallery_categories(slug) ON DELETE RESTRICT,
    file TEXT NOT NULL,
    date_text TEXT,
    caption TEXT,
    original_name TEXT,
    uploaded_by TEXT,
    size BIGINT,
    mime_type TEXT,
    is_upload BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (category_slug, file)
  )`,
  `CREATE TABLE IF NOT EXISTS content_blobs (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS content_change_requests (
    id TEXT PRIMARY KEY,
    resource_type TEXT NOT NULL,
    operation TEXT NOT NULL,
    resource_id TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending',
    requested_by TEXT NOT NULL,
    reviewed_by TEXT,
    review_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
  )`,
  `CREATE INDEX IF NOT EXISTS idx_change_requests_status_created
    ON content_change_requests (status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_change_requests_resource
    ON content_change_requests (resource_type, resource_id)`
];

const ensureSchema = async () => {
  for (const sql of schemaStatements) {
    await query(sql);
  }

  logger.info('PostgreSQL schema ensured');
};

module.exports = {
  ensureSchema
};
