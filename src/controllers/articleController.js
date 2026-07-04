const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { validate } = require('../schemas');
const intrusionDetection = require('../services/intrusionDetection');
const contentRepository = require('../db/repositories/contentRepository');

const generateExcerpt = (text, length = 150) => {
  if (!text || typeof text !== 'string') {
    return '';
  }
  return text.length > length ? `${text.slice(0, length)}...` : text;
};

class ArticleController {
  async getAllArticles(req, res) {
    try {
      const articles = await contentRepository.getAllArticles();

      res.json({
        success: true,
        data: articles
      });
    } catch (error) {
      logger.error('Failed to retrieve articles', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve articles'
      });
    }
  }

  async getArticleById(req, res) {
    try {
      const { id } = req.params;
      const article = await contentRepository.getArticleById(id);

      if (!article) {
        return res.status(404).json({
          success: false,
          error: 'Article not found'
        });
      }

      res.json({
        success: true,
        data: article
      });
    } catch (error) {
      logger.error('Failed to retrieve article', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve article'
      });
    }
  }

  async createArticle(req, res) {
    try {
      const { title, content, author, category, tags, imageUrl } = req.body;
      const userId = req.user.userId;

      const article = {
        id: uuidv4(),
        title,
        content,
        author,
        category,
        tags: Array.isArray(tags) ? tags : [],
        imageUrl: imageUrl || null,
        excerpt: generateExcerpt(content),
        published: false,
        date: new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const result = validate('article', article);
      if (!result.valid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: result.errors
        });
      }

      const savedArticle = await contentRepository.createArticle(article);

      logger.info('Article created', {
        articleId: savedArticle.id,
        userId
      });

      res.status(201).json({
        success: true,
        message: 'Article created successfully',
        data: savedArticle
      });
    } catch (error) {
      logger.error('Failed to create article', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to create article'
      });
    }
  }

  async updateArticle(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;
      const existing = await contentRepository.getArticleById(id);

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Article not found'
        });
      }

      const updatedArticle = {
        ...existing,
        ...updates,
        id: existing.id,
        excerpt: updates.excerpt || generateExcerpt(updates.content || existing.content),
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString()
      };

      const validationResult = validate('article', updatedArticle);
      if (!validationResult.valid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validationResult.errors
        });
      }

      const savedArticle = await contentRepository.updateArticle(id, updatedArticle);

      res.json({
        success: true,
        message: 'Article updated successfully',
        data: savedArticle
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to update article'
      });
    }
  }

  async deleteArticle(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const deleted = await contentRepository.deleteArticle(id);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Article not found'
        });
      }

      intrusionDetection.trackSuspiciousAction('deletes', {
        userId,
        resource: 'article',
        resourceId: id
      });

      res.json({
        success: true,
        message: 'Article deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to delete article'
      });
    }
  }
}

module.exports = new ArticleController();
