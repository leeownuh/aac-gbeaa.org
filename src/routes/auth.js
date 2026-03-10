const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiter');
const { validateLogin, validatePassword } = require('../middleware/validate');

router.post('/login', loginLimiter, validateLogin, authController.login);
router.post('/logout', authenticateToken, authController.logout);
router.post('/refresh', authController.refresh);
router.get('/me', authenticateToken, authController.getCurrentUser);
router.post('/change-password', authenticateToken, validatePassword, authController.changePassword);

module.exports = router;