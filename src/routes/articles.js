const express = require('express');
const router = express.Router();
const articleController = require('../controllers/articleController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { adminLimiter } = require('../middleware/rateLimiter');
const { validateArticle, validateId } = require('../middleware/validate');

router.get('/', articleController.getAllArticles);
router.get('/:id', validateId, articleController.getArticleById);

router.post(
  '/',
  authenticateToken,
  requireAdmin,
  adminLimiter,
  validateArticle,
  articleController.createArticle
);

router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  adminLimiter,
  validateId,
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