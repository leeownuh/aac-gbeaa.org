const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { adminLimiter } = require('../middleware/rateLimiter');
const { validateEvent, validateId } = require('../middleware/validate');

router.get('/', eventController.getAllEvents);
router.get('/:id', validateId, eventController.getEventById);

router.post(
  '/',
  authenticateToken,
  requireAdmin,
  adminLimiter,
  validateEvent,
  eventController.createEvent
);

router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  adminLimiter,
  validateId,
  validateEvent,
  eventController.updateEvent
);

router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  adminLimiter,
  validateId,
  eventController.deleteEvent
);

module.exports = router;