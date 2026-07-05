const { query } = require('../client');

const toIsoValue = (value) => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
};

const mapArticleRow = (row) => ({
  id: row.id,
  title: row.title,
  content: row.content,
  author: row.author,
  excerpt: row.excerpt,
  date: row.date_text,
  category: row.category,
  tags: Array.isArray(row.tags) ? row.tags : [],
  imageUrl: row.image_url,
  published: row.published,
  createdAt: toIsoValue(row.created_at),
  updatedAt: toIsoValue(row.updated_at)
});

const mapEventRow = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  date: row.date_text,
  end_date: row.end_date_text,
  time: row.time_text,
  startAt: toIsoValue(row.start_at),
  endAt: toIsoValue(row.end_at),
  timezone: row.timezone,
  location: row.location,
  category: row.category,
  details_url: row.details_url,
  image: row.image,
  createdBy: row.created_by,
  published: row.published,
  createdAt: toIsoValue(row.created_at),
  updatedAt: toIsoValue(row.updated_at)
});

const mapCategoryRow = (row) => ({
  name: row.name,
  slug: row.slug,
  folder: row.folder,
  filterClass: row.filter_class
});

const mapNamedCategoryRow = (row) => ({
  name: row.name,
  slug: row.slug
});

const mapGalleryImageRow = (row) => ({
  id: row.id,
  title: row.title,
  category: row.category_slug,
  file: row.file,
  date: row.date_text,
  caption: row.caption,
  originalName: row.original_name,
  uploadedBy: row.uploaded_by,
  createdAt: toIsoValue(row.created_at),
  size: row.size,
  mimeType: row.mime_type,
  isUpload: row.is_upload
});

const normalizeSlug = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

const getAllArticleCategories = async () => {
  const result = await query(
    `SELECT slug, name
     FROM article_categories
     ORDER BY name ASC`
  );
  return result.rows.map(mapNamedCategoryRow);
};

const addArticleCategory = async (category) => {
  const name = String(category.name || category.slug || '').trim();
  const slug = normalizeSlug(category.slug || name);
  const result = await query(
    `INSERT INTO article_categories (slug, name, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (slug)
     DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
     RETURNING slug, name`,
    [slug, name]
  );
  return mapNamedCategoryRow(result.rows[0]);
};

const updateArticleCategory = async (slug, category) => {
  const existing = await query(
    `SELECT slug, name
     FROM article_categories
     WHERE slug = $1`,
    [slug]
  );
  if (!existing.rows[0]) return null;

  const nextName = String(category.name || existing.rows[0].name).trim();
  const nextSlug = normalizeSlug(category.slug || nextName);
  const result = await query(
    `UPDATE article_categories
     SET slug = $2, name = $3, updated_at = NOW()
     WHERE slug = $1
     RETURNING slug, name`,
    [slug, nextSlug, nextName]
  );

  await query(
    `UPDATE articles
     SET category = $2
     WHERE category = $1`,
    [existing.rows[0].name, nextName]
  );

  return result.rows[0] ? mapNamedCategoryRow(result.rows[0]) : null;
};

const deleteArticleCategory = async (slug) => {
  const existing = await query(
    `SELECT slug, name
     FROM article_categories
     WHERE slug = $1`,
    [slug]
  );
  if (!existing.rows[0]) return null;

  const usage = await query(
    `SELECT COUNT(*)::int AS count
     FROM articles
     WHERE category = $1`,
    [existing.rows[0].name]
  );
  if ((usage.rows[0]?.count || 0) > 0) {
    const error = new Error('Category is in use');
    error.code = 'CATEGORY_IN_USE';
    throw error;
  }

  await query(
    `DELETE FROM article_categories
     WHERE slug = $1`,
    [slug]
  );
  return mapNamedCategoryRow(existing.rows[0]);
};

const getAllEventCategories = async () => {
  const result = await query(
    `SELECT slug, name
     FROM event_categories
     ORDER BY name ASC`
  );
  return result.rows.map(mapNamedCategoryRow);
};

const addEventCategory = async (category) => {
  const name = String(category.name || category.slug || '').trim();
  const slug = normalizeSlug(category.slug || name);
  const result = await query(
    `INSERT INTO event_categories (slug, name, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (slug)
     DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
     RETURNING slug, name`,
    [slug, name]
  );
  return mapNamedCategoryRow(result.rows[0]);
};

const updateEventCategory = async (slug, category) => {
  const existing = await query(
    `SELECT slug, name
     FROM event_categories
     WHERE slug = $1`,
    [slug]
  );
  if (!existing.rows[0]) return null;

  const nextName = String(category.name || existing.rows[0].name).trim();
  const nextSlug = normalizeSlug(category.slug || nextName);
  const result = await query(
    `UPDATE event_categories
     SET slug = $2, name = $3, updated_at = NOW()
     WHERE slug = $1
     RETURNING slug, name`,
    [slug, nextSlug, nextName]
  );

  await query(
    `UPDATE events
     SET category = $2
     WHERE category = $1`,
    [existing.rows[0].name, nextName]
  );

  return result.rows[0] ? mapNamedCategoryRow(result.rows[0]) : null;
};

const deleteEventCategory = async (slug) => {
  const existing = await query(
    `SELECT slug, name
     FROM event_categories
     WHERE slug = $1`,
    [slug]
  );
  if (!existing.rows[0]) return null;

  const usage = await query(
    `SELECT COUNT(*)::int AS count
     FROM events
     WHERE category = $1`,
    [existing.rows[0].name]
  );
  if ((usage.rows[0]?.count || 0) > 0) {
    const error = new Error('Category is in use');
    error.code = 'CATEGORY_IN_USE';
    throw error;
  }

  await query(
    `DELETE FROM event_categories
     WHERE slug = $1`,
    [slug]
  );
  return mapNamedCategoryRow(existing.rows[0]);
};

const getAllArticles = async () => {
  const result = await query(
    `SELECT *
     FROM articles
     ORDER BY COALESCE(updated_at, created_at) DESC`
  );
  return result.rows.map(mapArticleRow);
};

const getArticleById = async (id) => {
  const result = await query(
    `SELECT *
     FROM articles
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] ? mapArticleRow(result.rows[0]) : null;
};

const createArticle = async (article) => {
  const result = await query(
    `INSERT INTO articles (
      id, title, content, author, excerpt, date_text, category, tags, image_url,
      published, created_at, updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9,
      $10, COALESCE($11::timestamptz, NOW()), COALESCE($12::timestamptz, NOW())
    )
    RETURNING *`,
    [
      article.id,
      article.title,
      article.content,
      article.author,
      article.excerpt,
      article.date || null,
      article.category || null,
      JSON.stringify(Array.isArray(article.tags) ? article.tags : []),
      article.imageUrl || null,
      Boolean(article.published),
      article.createdAt || null,
      article.updatedAt || null
    ]
  );
  return mapArticleRow(result.rows[0]);
};

const updateArticle = async (id, article) => {
  const result = await query(
    `UPDATE articles
     SET title = $2,
         content = $3,
         author = $4,
         excerpt = $5,
         date_text = $6,
         category = $7,
         tags = $8::jsonb,
         image_url = $9,
         published = $10,
         updated_at = COALESCE($11::timestamptz, NOW())
     WHERE id = $1
     RETURNING *`,
    [
      id,
      article.title,
      article.content,
      article.author,
      article.excerpt,
      article.date || null,
      article.category || null,
      JSON.stringify(Array.isArray(article.tags) ? article.tags : []),
      article.imageUrl || null,
      Boolean(article.published),
      article.updatedAt || null
    ]
  );

  return result.rows[0] ? mapArticleRow(result.rows[0]) : null;
};

const deleteArticle = async (id) => {
  const result = await query(
    `DELETE FROM articles
     WHERE id = $1`,
    [id]
  );
  return result.rowCount > 0;
};

const getAllEvents = async () => {
  const result = await query(
    `SELECT *
     FROM events
     ORDER BY COALESCE(updated_at, created_at) DESC`
  );
  return result.rows.map(mapEventRow);
};

const getEventById = async (id) => {
  const result = await query(
    `SELECT *
     FROM events
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] ? mapEventRow(result.rows[0]) : null;
};

const createEvent = async (event) => {
  const result = await query(
    `INSERT INTO events (
      id, title, description, date_text, end_date_text, time_text, start_at, end_at,
      timezone, location, category, details_url, image, created_by, published, created_at,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz,
      $9, $10, $11, $12, $13, $14, $15, COALESCE($16::timestamptz, NOW()),
      COALESCE($17::timestamptz, NOW())
    )
    RETURNING *`,
    [
      event.id,
      event.title,
      event.description,
      event.date,
      event.end_date || null,
      event.time || null,
      event.startAt || event.start_at || null,
      event.endAt || event.end_at || null,
      event.timezone || null,
      event.location,
      event.category || null,
      event.details_url || null,
      event.image || null,
      event.createdBy || null,
      Boolean(event.published),
      event.createdAt || null,
      event.updatedAt || null
    ]
  );
  return mapEventRow(result.rows[0]);
};

const updateEvent = async (id, event) => {
  const result = await query(
    `UPDATE events
     SET title = $2,
         description = $3,
         date_text = $4,
         end_date_text = $5,
         time_text = $6,
         start_at = $7::timestamptz,
         end_at = $8::timestamptz,
         timezone = $9,
         location = $10,
         category = $11,
         details_url = $12,
         image = $13,
         created_by = $14,
         published = $15,
         updated_at = COALESCE($16::timestamptz, NOW())
     WHERE id = $1
     RETURNING *`,
    [
      id,
      event.title,
      event.description,
      event.date,
      event.end_date || null,
      event.time || null,
      event.startAt || event.start_at || null,
      event.endAt || event.end_at || null,
      event.timezone || null,
      event.location,
      event.category || null,
      event.details_url || null,
      event.image || null,
      event.createdBy || null,
      Boolean(event.published),
      event.updatedAt || null
    ]
  );
  return result.rows[0] ? mapEventRow(result.rows[0]) : null;
};

const deleteEvent = async (id) => {
  const result = await query(
    `DELETE FROM events
     WHERE id = $1`,
    [id]
  );
  return result.rowCount > 0;
};

const getAllGalleryCategories = async () => {
  const result = await query(
    `SELECT *
     FROM gallery_categories
     ORDER BY name ASC`
  );
  return result.rows.map(mapCategoryRow);
};

const addGalleryCategory = async (category) => {
  const result = await query(
    `INSERT INTO gallery_categories (name, slug, folder, filter_class)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (slug)
     DO UPDATE SET
       name = EXCLUDED.name,
       folder = EXCLUDED.folder,
       filter_class = EXCLUDED.filter_class
     RETURNING *`,
    [category.name, category.slug, category.folder, category.filterClass]
  );
  return mapCategoryRow(result.rows[0]);
};

const updateGalleryCategory = async (slug, category) => {
  const existing = await query(
    `SELECT *
     FROM gallery_categories
     WHERE slug = $1`,
    [slug]
  );
  if (!existing.rows[0]) return null;

  const result = await query(
    `UPDATE gallery_categories
     SET name = $2,
         folder = $3,
         filter_class = $4
     WHERE slug = $1
     RETURNING *`,
    [
      slug,
      category.name || existing.rows[0].name,
      category.folder || existing.rows[0].folder,
      category.filterClass || category.filter_class || existing.rows[0].filter_class
    ]
  );
  return result.rows[0] ? mapCategoryRow(result.rows[0]) : null;
};

const deleteGalleryCategory = async (slug) => {
  const existing = await query(
    `SELECT *
     FROM gallery_categories
     WHERE slug = $1`,
    [slug]
  );
  if (!existing.rows[0]) return null;

  const usage = await query(
    `SELECT COUNT(*)::int AS count
     FROM gallery_images
     WHERE category_slug = $1`,
    [slug]
  );
  if ((usage.rows[0]?.count || 0) > 0) {
    const error = new Error('Category is in use');
    error.code = 'CATEGORY_IN_USE';
    throw error;
  }

  await query(
    `DELETE FROM gallery_categories
     WHERE slug = $1`,
    [slug]
  );
  return mapCategoryRow(existing.rows[0]);
};

const getAllGalleryImages = async () => {
  const result = await query(
    `SELECT *
     FROM gallery_images
     ORDER BY COALESCE(date_text, ''), created_at DESC`
  );
  return result.rows.map(mapGalleryImageRow);
};

const getGalleryImageById = async (id) => {
  const result = await query(
    `SELECT *
     FROM gallery_images
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] ? mapGalleryImageRow(result.rows[0]) : null;
};

const getUploadedGalleryImageByFile = async (file) => {
  const result = await query(
    `SELECT *
     FROM gallery_images
     WHERE file = $1 AND is_upload = TRUE
     ORDER BY created_at DESC
     LIMIT 1`,
    [file]
  );
  return result.rows[0] ? mapGalleryImageRow(result.rows[0]) : null;
};

const addGalleryImage = async (item) => {
  const result = await query(
    `INSERT INTO gallery_images (
      id, title, category_slug, file, date_text, caption, original_name,
      uploaded_by, size, mime_type, is_upload, created_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, COALESCE($12::timestamptz, NOW())
    )
    ON CONFLICT (category_slug, file)
    DO UPDATE SET
      title = EXCLUDED.title,
      date_text = EXCLUDED.date_text,
      caption = EXCLUDED.caption,
      original_name = EXCLUDED.original_name,
      uploaded_by = EXCLUDED.uploaded_by,
      size = EXCLUDED.size,
      mime_type = EXCLUDED.mime_type,
      is_upload = EXCLUDED.is_upload,
      created_at = EXCLUDED.created_at
    RETURNING *`,
    [
      item.id,
      item.title || null,
      item.category,
      item.file,
      item.date || null,
      item.caption || null,
      item.originalName || null,
      item.uploadedBy || null,
      item.size || null,
      item.mimeType || null,
      Boolean(item.isUpload),
      item.createdAt || null
    ]
  );

  return mapGalleryImageRow(result.rows[0]);
};

const updateGalleryImage = async (id, item) => {
  const result = await query(
    `UPDATE gallery_images
     SET title = $2,
         category_slug = $3,
         caption = $4,
         date_text = $5
     WHERE id = $1
     RETURNING *`,
    [
      id,
      item.title || null,
      item.category,
      item.caption || null,
      item.date || null
    ]
  );

  return result.rows[0] ? mapGalleryImageRow(result.rows[0]) : null;
};

const deleteGalleryImageById = async (id) => {
  const result = await query(
    `DELETE FROM gallery_images
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  return result.rows[0] ? mapGalleryImageRow(result.rows[0]) : null;
};

const deleteGalleryImagesByFile = async (file) => {
  const result = await query(
    `DELETE FROM gallery_images
     WHERE file = $1
     RETURNING *`,
    [file]
  );
  return result.rows.map(mapGalleryImageRow);
};

const countGalleryImages = async () => {
  const result = await query(
    `SELECT COUNT(*)::int AS count
     FROM gallery_images`
  );
  return result.rows[0]?.count || 0;
};

const getContentBlob = async (key) => {
  const result = await query(
    `SELECT value
     FROM content_blobs
     WHERE key = $1`,
    [key]
  );
  return result.rows[0]?.value || null;
};

const upsertContentBlob = async (key, value) => {
  await query(
    `INSERT INTO content_blobs (key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, JSON.stringify(value)]
  );
};

module.exports = {
  getAllArticles,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  getAllArticleCategories,
  addArticleCategory,
  updateArticleCategory,
  deleteArticleCategory,
  getAllEventCategories,
  addEventCategory,
  updateEventCategory,
  deleteEventCategory,
  getAllGalleryCategories,
  addGalleryCategory,
  updateGalleryCategory,
  deleteGalleryCategory,
  getAllGalleryImages,
  getGalleryImageById,
  getUploadedGalleryImageByFile,
  addGalleryImage,
  updateGalleryImage,
  deleteGalleryImageById,
  deleteGalleryImagesByFile,
  countGalleryImages,
  getContentBlob,
  upsertContentBlob
};
