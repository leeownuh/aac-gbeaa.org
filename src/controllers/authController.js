const logger = require('../utils/logger');
const authService = require('../services/authService');
const intrusionDetection = require('../services/intrusionDetection');

class AuthController {
  async login(req, res) {
    try {
      const { username, password } = req.body;
      const ip = req.ip;
      const userAgent = req.get('user-agent');

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: 'Username and password are required'
        });
      }

      const tokens = await authService.authenticateUser(username, password, ip, userAgent);

      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          accessToken: tokens.accessToken,
          user: tokens.user
        }
      });
    } catch (error) {
      intrusionDetection.trackFailedLogin(req.ip, req.body?.username || 'unknown');
      logger.error('Login failed', {
        username: req.body.username,
        error: error.message,
        ip: req.ip
      });

      res.status(401).json({
        success: false,
        error: error.message
      });
    }
  }

  async logout(req, res) {
    try {
      const refreshToken = req.cookies.refreshToken;

      if (refreshToken) {
        await authService.logout(refreshToken);
        res.clearCookie('refreshToken');
      }

      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      logger.error('Logout failed', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to logout'
      });
    }
  }

  async refresh(req, res) {
    try {
      const refreshToken = req.cookies.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          error: 'Refresh token required'
        });
      }

      const ip = req.ip;
      const userAgent = req.get('user-agent');

      const tokens = await authService.refreshAccessToken(refreshToken, ip, userAgent);

      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken: tokens.accessToken
        }
      });
    } catch (error) {
      logger.error('Token refresh failed', { error: error.message });
      
      res.clearCookie('refreshToken');
      
      res.status(401).json({
        success: false,
        error: error.message || 'Failed to refresh token'
      });
    }
  }

  async getCurrentUser(req, res) {
    try {
      const userId = req.user.userId;
      
      res.json({
        success: true,
        data: {
          userId,
          username: req.user.username,
          role: req.user.role
        }
      });
    } catch (error) {
      logger.error('Failed to get current user', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get current user'
      });
    }
  }

  async changePassword(req, res) {
    try {
      const userId = req.user.userId;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Current password and new password are required'
        });
      }

      await authService.changePassword(
        req.user.username,
        currentPassword,
        newPassword,
        req.ip,
        req.get('user-agent')
      );

      logger.info('Password changed', { userId, ip: req.ip });

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      logger.error('Failed to change password', { error: error.message });
      if (error.message === 'Current password is incorrect' || error.message === 'New password must be different from current password') {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }
      res.status(500).json({
        success: false,
        error: 'Failed to change password'
      });
    }
  }
}

module.exports = new AuthController();
