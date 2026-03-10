const express = require('express');
const router = express.Router();
const galleryController = require('../controllers/galleryController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { adminLimiter, uploadLimiter } = require('../middleware/rateLimiter');
const { upload, uploadErrorHandler } = require('../middleware/upload');
const { validateGallery, validateId, validateFileName } = require('../middleware/validate');

router.get('/', galleryController.getAllGallery);
router.get('/:id', validateId, galleryController.getGalleryItem);
router.get('/image/:filename', validateFileName, galleryController.serveImage);

router.post(
  '/',
  authenticateToken,
  requireAdmin,
  uploadLimiter,
  upload.single('image'),
  uploadErrorHandler,
  validateGallery,
  galleryController.uploadImage
);

router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  adminLimiter,
  validateId,
  galleryController.deleteImage
);

module.exports = router;