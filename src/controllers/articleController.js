const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const cache = require('../storage/cache');
const { validate } = require('../schemas');
const intrusionDetection = require('../services/intrusionDetection');

class ArticleController {
  async getAllArticles(req, res) {
    try {
      const articles = cache.get('article.json', []);
      
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
      const articles = cache.get('article.json', []);
      const article = articles.find(a => a.id === id);

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
        tags: tags || [],
        imageUrl,
        published: false,
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

      await cache.update('article.json', (articles) => {
        articles.push(article);
        return articles;
      }, 'article');

      logger.info('Article created', {
        articleId: article.id,
        userId
      });

      res.status(201).json({
        success: true,
        message: 'Article created successfully',
        data: article
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

      const articles = await cache.update('article.json', (articles) => {
        const index = articles.findIndex(a => a.id === id);
        
        if (index === -1) {
          throw new Error('Article not found');
        }

        const updatedArticle = {
          ...articles[index],
          ...updates,
          id: articles[index].id,
          createdAt: articles[index].createdAt,
          updatedAt: new Date().toISOString()
        };

        const result = validate('article', updatedArticle);
        if (!result.valid) {
          throw new Error(JSON.stringify(result.errors));
        }

        articles[index] = updatedArticle;
        return articles;
      }, 'article');

      const article = articles.find(a => a.id === id);

      res.json({
        success: true,
        message: 'Article updated successfully',
        data: article
      });
    } catch (error) {
      if (error.message === 'Article not found') {
        return res.status(404).json({
          success: false,
          error: 'Article not found'
        });
      }

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

      await cache.update('article.json', (articles) => {
        const index = articles.findIndex(a => a.id === id);
        
        if (index === -1) {
          throw new Error('Article not found');
        }

        articles.splice(index, 1);
        return articles;
      });

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
      if (error.message === 'Article not found') {
        return res.status(404).json({
          success: false,
          error: 'Article not found'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to delete article'
      });
    }
  }
}

module.exports = new ArticleController();