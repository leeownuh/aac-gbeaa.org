const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../utils/logger');
const { query, withTransaction } = require('./client');

const fileExists = async (targetPath) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const readJson = async (targetPath) => {
  if (!(await fileExists(targetPath))) {
    return null;
  }

  try {
    const raw = await fs.readFile(targetPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const readFirstValidJson = async (paths, validator) => {
  for (const candidate of paths) {
    const parsed = await readJson(candidate);
    if (parsed !== null && validator(parsed)) {
      return parsed;
    }
  }
  return null;
};

const parseDateTime = (value) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
};

const excerptFromContent = (value, length = 160) => {
  if (!value || typeof value !== 'string') {
    return '';
  }
  return value.length > length ? `${value.slice(0, length)}...` : value;
};

const normalizeSlug = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

const tableHasRows = async (tableName) => {
  const result = await query(`SELECT EXISTS (SELECT 1 FROM ${tableName}) AS has_rows`);
  return result.rows[0]?.has_rows === true;
};

const seedAdmins = async () => {
  if (await tableHasRows('admins')) {
    return;
  }

  const privateAdminPath = path.join(config.paths.private, 'admin.json');
  const legacyAdminPath = path.join(config.paths.appRoot, 'src', 'data', 'admin.json');
  const admin = await readFirstValidJson(
    [privateAdminPath, legacyAdminPath],
    (data) => Boolean(data && typeof data.username === 'string' && typeof data.password === 'string')
  );

  if (!admin) {
    return;
  }

  await query(
    `INSERT INTO admins (username, role, password_hash, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     ON CONFLICT (username) DO NOTHING`,
    [admin.username, admin.role || 'super', admin.password]
  );

  logger.info('Seeded admin credentials from JSON');
};

const seedArticles = async () => {
  if (await tableHasRows('articles')) {
    return;
  }

  const sourcePaths = [
    path.join(config.paths.data, 'article.json'),
    path.join(config.paths.appRoot, 'data', 'article.json')
  ];

  const articles = await readFirstValidJson(sourcePaths, Array.isArray);
  if (!articles || articles.length === 0) {
    return;
  }

  await withTransaction(async (client) => {
    for (const item of articles) {
      const id = String(item.id || uuidv4());
      const title = String(item.title || 'Untitled');
      const content = String(item.content || '');
      const author = String(item.author || 'Admin');
      const excerpt = String(item.excerpt || excerptFromContent(content));
      const dateText = item.date ? String(item.date) : null;
      const category = item.category ? String(item.category) : 'General';
      const tags = Array.isArray(item.tags) ? item.tags : [];
      const imageUrl = item.imageUrl ? String(item.imageUrl) : null;
      const published = typeof item.published === 'boolean' ? item.published : false;
      const createdAt = parseDateTime(item.createdAt || item.created_at);
      const updatedAt = parseDateTime(item.updatedAt || item.updated_at || item.createdAt || item.created_at);

      await client.query(
        `INSERT INTO articles (
          id, title, content, author, excerpt, date_text, category, tags,
          image_url, published, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8::jsonb,
          $9, $10, COALESCE($11::timestamptz, NOW()), COALESCE($12::timestamptz, NOW())
        )
        ON CONFLICT (id) DO NOTHING`,
        [id, title, content, author, excerpt, dateText, category, JSON.stringify(tags), imageUrl, published, createdAt, updatedAt]
      );
    }
  });

  logger.info('Seeded articles from JSON', { count: articles.length });
};

const seedEvents = async () => {
  if (await tableHasRows('events')) {
    return;
  }

  const sourcePaths = [
    path.join(config.paths.data, 'events.json'),
    path.join(config.paths.appRoot, 'data', 'events.json')
  ];

  const events = await readFirstValidJson(sourcePaths, Array.isArray);
  if (!events || events.length === 0) {
    return;
  }

  await withTransaction(async (client) => {
    for (const item of events) {
      const id = String(item.id || uuidv4());
      const title = String(item.title || 'Untitled Event');
      const description = String(item.description || '');
      const dateText = item.date ? String(item.date) : new Date().toISOString().slice(0, 10);
      const endDateText = item.end_date ? String(item.end_date) : null;
      const timeText = item.time ? String(item.time) : null;
      const startAt = parseDateTime(item.startAt || item.start_at);
      const endAt = parseDateTime(item.endAt || item.end_at);
      const timezone = item.timezone ? String(item.timezone) : null;
      const location = String(item.location || '');
      const category = item.category ? String(item.category) : null;
      const detailsUrl = item.details_url ? String(item.details_url) : null;
      const image = item.image ? String(item.image) : null;
      const createdBy = item.createdBy ? String(item.createdBy) : null;
      const published = typeof item.published === 'boolean' ? item.published : false;
      const createdAt = parseDateTime(item.createdAt || item.created_at);
      const updatedAt = parseDateTime(item.updatedAt || item.updated_at || item.createdAt || item.created_at);

      await client.query(
        `INSERT INTO events (
          id, title, description, date_text, end_date_text, time_text, start_at,
          end_at, timezone, location, category, details_url, image, created_by,
          published, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7::timestamptz,
          $8::timestamptz, $9, $10, $11, $12, $13, $14,
          $15, COALESCE($16::timestamptz, NOW()), COALESCE($17::timestamptz, NOW())
        )
        ON CONFLICT (id) DO NOTHING`,
        [
          id,
          title,
          description,
          dateText,
          endDateText,
          timeText,
          startAt,
          endAt,
          timezone,
          location,
          category,
          detailsUrl,
          image,
          createdBy,
          published,
          createdAt,
          updatedAt
        ]
      );
    }
  });

  logger.info('Seeded events from JSON', { count: events.length });
};

const ensureCategoryExists = async (client, category) => {
  const slug = normalizeSlug(category.slug || category.name || category.category || 'general') || 'general';
  const name = String(category.name || slug);
  const folder = String(category.folder || slug);
  const filterClass = String(category.filterClass || slug);

  await client.query(
    `INSERT INTO gallery_categories (slug, name, folder, filter_class)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (slug) DO NOTHING`,
    [slug, name, folder, filterClass]
  );

  return slug;
};

const buildLegacyImageId = (item, fallbackSlug, index) => {
  if (item.id) {
    return String(item.id);
  }

  const base = `${fallbackSlug}-${String(item.file || item.filename || index)}`;
  return `legacy-${base.replace(/[^a-zA-Z0-9-_]/g, '-')}`;
};

const seedGallery = async () => {
  const categoriesHasRows = await tableHasRows('gallery_categories');
  const imagesHasRows = await tableHasRows('gallery_images');
  if (categoriesHasRows && imagesHasRows) {
    return;
  }

  const sourcePaths = [
    path.join(config.paths.data, 'gallery.json'),
    path.join(config.paths.appRoot, 'data', 'gallery.json')
  ];

  const gallery = await readFirstValidJson(
    sourcePaths,
    (data) => Boolean(data && Array.isArray(data.categories) && Array.isArray(data.images))
  );

  if (!gallery) {
    return;
  }

  await withTransaction(async (client) => {
    if (!categoriesHasRows) {
      for (const category of gallery.categories) {
        await ensureCategoryExists(client, category);
      }
    }

    if (!imagesHasRows) {
      let imageIndex = 0;
      for (const item of gallery.images) {
        const categorySlug = await ensureCategoryExists(client, {
          slug: item.category,
          name: item.category,
          folder: item.category,
          filterClass: item.category
        });

        const file = String(item.file || item.filename || '');
        if (!file) {
          imageIndex += 1;
          continue;
        }

        const id = buildLegacyImageId(item, categorySlug, imageIndex);
        const title = item.title ? String(item.title) : file;
        const dateText = item.date ? String(item.date) : null;
        const caption = item.caption ? String(item.caption) : null;
        const originalName = item.originalName ? String(item.originalName) : null;
        const uploadedBy = item.uploadedBy ? String(item.uploadedBy) : null;
        const size = Number.isFinite(item.size) ? Number(item.size) : null;
        const mimeType = item.mimeType ? String(item.mimeType) : null;
        const isUpload = Boolean(item.is_upload || item.uploadedBy || item.originalName);
        const createdAt = parseDateTime(item.createdAt || item.created_at);

        await client.query(
          `INSERT INTO gallery_images (
            id, title, category_slug, file, date_text, caption, original_name,
            uploaded_by, size, mime_type, is_upload, created_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, COALESCE($12::timestamptz, NOW())
          )
          ON CONFLICT (category_slug, file) DO NOTHING`,
          [id, title, categorySlug, file, dateText, caption, originalName, uploadedBy, size, mimeType, isUpload, createdAt]
        );

        imageIndex += 1;
      }
    }
  });

  logger.info('Seeded gallery data from JSON', {
    categories: gallery.categories.length,
    images: gallery.images.length
  });
};

const seedWhyWeDoContent = async () => {
  const sourcePaths = [
    path.join(config.paths.data, 'why-we-do.json'),
    path.join(config.paths.appRoot, 'data', 'why-we-do.json')
  ];
  const payload = await readFirstValidJson(
    sourcePaths,
    (data) => Boolean(data && typeof data === 'object' && Array.isArray(data.items))
  );

  if (!payload) {
    return;
  }

  await query(
    `INSERT INTO content_blobs (key, value, updated_at)
     VALUES ('why_we_do', $1::jsonb, NOW())
     ON CONFLICT (key) DO NOTHING`,
    [JSON.stringify(payload)]
  );

  logger.info('Seeded why-we-do content from JSON');
};

const seedRefreshTokens = async () => {
  if (await tableHasRows('refresh_tokens')) {
    return;
  }

  const sourcePaths = [
    path.join(config.paths.private, 'tokens.json'),
    path.join(config.paths.appRoot, 'data', 'private', 'tokens.json')
  ];
  const tokens = await readFirstValidJson(sourcePaths, Array.isArray);
  if (!tokens) {
    return;
  }

  await withTransaction(async (client) => {
    for (const token of tokens) {
      if (!token?.token) {
        continue;
      }

      await client.query(
        `INSERT INTO refresh_tokens (
          id, user_id, token, token_type, expires_at, created_at, revoked, ip_address, user_agent
        )
        VALUES (
          $1, $2, $3, $4, COALESCE($5::timestamptz, NOW() + INTERVAL '7 days'),
          COALESCE($6::timestamptz, NOW()), $7, $8, $9
        )
        ON CONFLICT (token) DO NOTHING`,
        [
          String(token.id || uuidv4()),
          String(token.userId || 'admin'),
          String(token.token),
          String(token.type || 'refresh'),
          parseDateTime(token.expiresAt),
          parseDateTime(token.createdAt),
          Boolean(token.revoked),
          token.ipAddress ? String(token.ipAddress) : null,
          token.userAgent ? String(token.userAgent) : null
        ]
      );
    }
  });
};

const seedAuditLogs = async () => {
  if (await tableHasRows('audit_logs')) {
    return;
  }

  const sourcePaths = [
    path.join(config.paths.private, 'audit.json'),
    path.join(config.paths.appRoot, 'data', 'private', 'audit.json')
  ];
  const logs = await readFirstValidJson(sourcePaths, Array.isArray);
  if (!logs) {
    return;
  }

  await withTransaction(async (client) => {
    for (const log of logs) {
      if (!log?.action) {
        continue;
      }

      await client.query(
        `INSERT INTO audit_logs (
          id, action, resource, resource_id, username, details, severity, created_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6::jsonb, $7, COALESCE($8::timestamptz, NOW())
        )
        ON CONFLICT (id) DO NOTHING`,
        [
          String(log.id || uuidv4()),
          String(log.action),
          log.resource ? String(log.resource) : null,
          log.resourceId ? String(log.resourceId) : null,
          log.username ? String(log.username) : null,
          JSON.stringify(log.details || {}),
          String(log.severity || 'info'),
          parseDateTime(log.timestamp || log.createdAt)
        ]
      );
    }
  });
};

const seedFromJson = async () => {
  await seedAdmins();
  await seedArticles();
  await seedEvents();
  await seedGallery();
  await seedWhyWeDoContent();
  await seedRefreshTokens();
  await seedAuditLogs();
};

module.exports = {
  seedFromJson
};
