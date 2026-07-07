const express = require('express');
const router = express.Router();
const articleController = require('../controllers/articleController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { adminLimiter, uploadLimiter } = require('../middleware/rateLimiter');
const { upload, uploadErrorHandler } = require('../middleware/upload');
const { validateArticle, validateId } = require('../middleware/validate');

router.get('/', articleController.getAllArticles);
router.get('/:id', validateId, articleController.getArticleById);

router.post(
  '/',
  authenticateToken,
  requireAdmin,
  uploadLimiter,
  upload.single('image'),
  uploadErrorHandler,
  validateArticle,
  articleController.createArticle
);

router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  uploadLimiter,
  validateId,
  upload.single('image'),
  uploadErrorHandler,
  validateArticle,
  articleController.updateArticle
);

router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  adminLimiter,
  validateId,
  articleController.deleteArticle
);

module.exports = router;
