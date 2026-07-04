const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const { validate } = require('../schemas');
const { uploadDir, validateMagicNumber } = require('../middleware/upload');
const contentRepository = require('../db/repositories/contentRepository');

const normalizeSlug = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

const toV2GalleryItem = (item) => ({
  id: item.id,
  filename: item.file,
  originalName: item.originalName,
  category: item.category,
  caption: item.caption,
  uploadedBy: item.uploadedBy,
  createdAt: item.createdAt,
  size: item.size,
  mimeType: item.mimeType
});

class GalleryController {
  async getAllGallery(req, res) {
    try {
      const gallery = await contentRepository.getAllGalleryImages();
      const uploadsOnly = gallery.filter(item => item.isUpload);

      res.json({
        success: true,
        data: uploadsOnly.map(toV2GalleryItem)
      });
    } catch (error) {
      logger.error('Failed to retrieve gallery', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve gallery'
      });
    }
  }

  async getGalleryItem(req, res) {
    try {
      const { id } = req.params;
      const item = await contentRepository.getGalleryImageById(id);

      if (!item || !item.isUpload) {
        return res.status(404).json({
          success: false,
          error: 'Gallery item not found'
        });
      }

      res.json({
        success: true,
        data: toV2GalleryItem(item)
      });
    } catch (error) {
      logger.error('Failed to retrieve gallery item', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve gallery item'
      });
    }
  }

  async uploadImage(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      const categoryInput = req.body.category || 'uploads';
      const categorySlug = normalizeSlug(categoryInput) || 'uploads';
      const categoryName = String(categoryInput).trim() || 'Uploads';
      const { caption } = req.body;
      const userId = req.user.userId;
      const filePath = path.join(uploadDir, req.file.filename);

      const isValid = await validateMagicNumber(filePath, req.file.mimetype);
      if (!isValid) {
        await fs.unlink(filePath);
        logger.warn('Invalid file uploaded - magic number mismatch', {
          filename: req.file.filename,
          userId
        });
        return res.status(400).json({
          success: false,
          error: 'Invalid file type'
        });
      }

      await contentRepository.addGalleryCategory({
        name: categoryName,
        slug: categorySlug,
        folder: categorySlug,
        filterClass: categorySlug
      });

      const galleryItem = {
        id: uuidv4(),
        file: req.file.filename,
        originalName: req.file.originalname,
        category: categorySlug,
        title: caption || req.file.originalname,
        caption,
        uploadedBy: userId,
        createdAt: new Date().toISOString(),
        size: req.file.size,
        mimeType: req.file.mimetype,
        isUpload: true
      };

      const validationPayload = {
        id: galleryItem.id,
        filename: galleryItem.file,
        originalName: galleryItem.originalName,
        category: galleryItem.category,
        caption: galleryItem.caption,
        uploadedBy: galleryItem.uploadedBy,
        createdAt: galleryItem.createdAt,
        size: galleryItem.size,
        mimeType: galleryItem.mimeType
      };

      const result = validate('gallery', validationPayload);
      if (!result.valid) {
        await fs.unlink(filePath);
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: result.errors
        });
      }

      const savedItem = await contentRepository.addGalleryImage(galleryItem);

      logger.info('Image uploaded', {
        id: savedItem.id,
        filename: savedItem.file,
        userId,
        ip: req.ip
      });

      res.status(201).json({
        success: true,
        message: 'Image uploaded successfully',
        data: toV2GalleryItem(savedItem)
      });
    } catch (error) {
      logger.error('Failed to upload image', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to upload image'
      });
    }
  }

  async deleteImage(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const item = await contentRepository.getGalleryImageById(id);
      if (!item || !item.isUpload) {
        return res.status(404).json({
          success: false,
          error: 'Gallery item not found'
        });
      }

      const filePath = path.join(uploadDir, item.file);
      try {
        await fs.unlink(filePath);
      } catch (err) {
        logger.warn('Failed to delete file', { filePath, error: err.message });
      }

      await contentRepository.deleteGalleryImageById(id);
      logger.info('Image deleted', { id, userId, ip: req.ip });

      res.json({
        success: true,
        message: 'Image deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to delete image'
      });
    }
  }

  async serveImage(req, res) {
    try {
      const { filename } = req.params;

      if (filename.includes('..')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid filename'
        });
      }

      const item = await contentRepository.getUploadedGalleryImageByFile(filename);
      if (!item) {
        return res.status(404).json({
          success: false,
          error: 'Image not found'
        });
      }

      const filePath = path.join(uploadDir, filename);
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      if (!exists) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }

      res.sendFile(filePath, { root: '/' });
    } catch (error) {
      logger.error('Failed to serve image', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to serve image'
      });
    }
  }
}

module.exports = new GalleryController();
