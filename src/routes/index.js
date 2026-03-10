const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const eventsRoutes = require('./events');
const articlesRoutes = require('./articles');
const galleryRoutes = require('./gallery');

router.use('/auth', authRoutes);
router.use('/events', eventsRoutes);
router.use('/articles', articlesRoutes);
router.use('/gallery', galleryRoutes);

router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

module.exports = router;