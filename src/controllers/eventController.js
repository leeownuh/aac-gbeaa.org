const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const cache = require('../storage/cache');
const { validate } = require('../schemas');
const intrusionDetection = require('../services/intrusionDetection');

class EventController {
  async getAllEvents(req, res) {
    try {
      const events = cache.get('events.json', []);
      
      logger.info('Events retrieved', {
        count: events.length,
        ip: req.ip
      });

      res.json({
        success: true,
        data: events
      });
    } catch (error) {
      logger.error('Failed to retrieve events', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve events'
      });
    }
  }

  async getEventById(req, res) {
    try {
      const { id } = req.params;
      const events = cache.get('events.json', []);
      const event = events.find(e => e.id === id);

      if (!event) {
        return res.status(404).json({
          success: false,
          error: 'Event not found'
        });
      }

      res.json({
        success: true,
        data: event
      });
    } catch (error) {
      logger.error('Failed to retrieve event', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve event'
      });
    }
  }

  async createEvent(req, res) {
    try {
      const { title, description, date, location } = req.body;
      const userId = req.user.userId;
      const username = req.user.username;

      if (!title || !description || !date || !location) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: title, description, date, location'
        });
      }

      const event = {
        id: uuidv4(),
        title,
        description,
        date,
        location,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: userId,
        published: false
      };

      const result = validate('event', event);
      if (!result.valid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: result.errors
        });
      }

      await cache.update('events.json', (events) => {
        const existing = events.find(e => e.id === event.id);
        if (existing) {
          throw new Error('Event ID already exists');
        }
        events.push(event);
        return events;
      }, 'event');

      logger.info('Event created', {
        eventId: event.id,
        title: event.title,
        userId,
        username,
        ip: req.ip
      });

      res.status(201).json({
        success: true,
        message: 'Event created successfully',
        data: event
      });
    } catch (error) {
      logger.error('Failed to create event', {
        error: error.message,
        userId: req.user?.userId,
        ip: req.ip
      });

      if (error.message === 'Event ID already exists') {
        return res.status(409).json({
          success: false,
          error: 'Event ID already exists'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create event'
      });
    }
  }

  async updateEvent(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;
      const userId = req.user.userId;

      const events = await cache.update('events.json', (events) => {
        const index = events.findIndex(e => e.id === id);
        
        if (index === -1) {
          throw new Error('Event not found');
        }

        const updatedEvent = {
          ...events[index],
          ...updates,
          id: events[index].id,
          createdAt: events[index].createdAt,
          updatedAt: new Date().toISOString()
        };

        const result = validate('event', updatedEvent);
        if (!result.valid) {
          throw new Error(JSON.stringify(result.errors));
        }

        events[index] = updatedEvent;
        return events;
      }, 'event');

      const event = events.find(e => e.id === id);

      logger.info('Event updated', {
        eventId: id,
        userId,
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Event updated successfully',
        data: event
      });
    } catch (error) {
      if (error.message === 'Event not found') {
        return res.status(404).json({
          success: false,
          error: 'Event not found'
        });
      }

      logger.error('Failed to update event', {
        eventId: req.params.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to update event'
      });
    }
  }

  async deleteEvent(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const events = await cache.update('events.json', (events) => {
        const index = events.findIndex(e => e.id === id);
        
        if (index === -1) {
          throw new Error('Event not found');
        }

        const deleted = events.splice(index, 1)[0];
        return events;
      });

      intrusionDetection.trackSuspiciousAction('deletes', {
        userId,
        resource: 'event',
        resourceId: id,
        ip: req.ip
      });

      logger.info('Event deleted', {
        eventId: id,
        userId,
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Event deleted successfully'
      });
    } catch (error) {
      if (error.message === 'Event not found') {
        return res.status(404).json({
          success: false,
          error: 'Event not found'
        });
      }

      logger.error('Failed to delete event', {
        eventId: req.params.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to delete event'
      });
    }
  }
}

module.exports = new EventController();