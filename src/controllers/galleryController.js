const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const cache = require('../storage/cache');
const { validate } = require('../schemas');
const { uploadDir, validateMagicNumber } = require('../middleware/upload');
const config = require('../config');

class GalleryController {
  async getAllGallery(req, res) {
    try {
      const gallery = cache.get('gallery.json', []);
      
      res.json({
        success: true,
        data: gallery
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
      const gallery = cache.get('gallery.json', []);
      const item = gallery.find(g => g.id === id);

      if (!item) {
        return res.status(404).json({
          success: false,
          error: 'Gallery item not found'
        });
      }

      res.json({
        success: true,
        data: item
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

      const { category, caption } = req.body;
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

      const galleryItem = {
        id: uuidv4(),
        filename: req.file.filename,
        originalName: req.file.originalname,
        category,
        caption,
        uploadedBy: userId,
        createdAt: new Date().toISOString(),
        size: req.file.size,
        mimeType: req.file.mimetype
      };

      const result = validate('gallery', galleryItem);
      if (!result.valid) {
        await fs.unlink(filePath);
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: result.errors
        });
      }

      await cache.update('gallery.json', (gallery) => {
        gallery.push(galleryItem);
        return gallery;
      }, 'gallery');

      logger.info('Image uploaded', {
        id: galleryItem.id,
        filename: req.file.filename,
        userId,
        ip: req.ip
      });

      res.status(201).json({
        success: true,
        message: 'Image uploaded successfully',
        data: galleryItem
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

      await cache.update('gallery.json', async (gallery) => {
        const index = gallery.findIndex(g => g.id === id);
        
        if (index === -1) {
          throw new Error('Gallery item not found');
        }

        const item = gallery[index];
        const filePath = path.join(uploadDir, item.filename);

        try {
          await fs.unlink(filePath);
        } catch (err) {
          logger.warn('Failed to delete file', { filePath, error: err.message });
        }

        gallery.splice(index, 1);
        return gallery;
      });

      logger.info('Image deleted', { id, userId, ip: req.ip });

      res.json({
        success: true,
        message: 'Image deleted successfully'
      });
    } catch (error) {
      if (error.message === 'Gallery item not found') {
        return res.status(404).json({
          success: false,
          error: 'Gallery item not found'
        });
      }

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

      const gallery = cache.get('gallery.json', []);
      const item = gallery.find(g => g.filename === filename);

      if (!item) {
        return res.status(404).json({
          success: false,
          error: 'Image not found'
        });
      }

      const filePath = path.join(uploadDir, filename);
      
      if (!(await fs.access(filePath).then(() => true).catch(() => false))) {
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