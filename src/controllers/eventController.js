const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { validate } = require('../schemas');
const intrusionDetection = require('../services/intrusionDetection');
const contentRepository = require('../db/repositories/contentRepository');

class EventController {
  async getAllEvents(req, res) {
    try {
      const events = await contentRepository.getAllEvents();

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
      const event = await contentRepository.getEventById(id);

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
        category: req.body.category || null,
        details_url: req.body.details_url || null,
        end_date: req.body.end_date || null,
        time: req.body.time || null,
        image: req.body.image || null,
        published: false
      };

      const result = validate('event', {
        ...event,
        date: new Date(event.date).toISOString()
      });
      if (!result.valid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: result.errors
        });
      }

      const savedEvent = await contentRepository.createEvent(event);

      logger.info('Event created', {
        eventId: savedEvent.id,
        title: savedEvent.title,
        userId,
        username,
        ip: req.ip
      });

      res.status(201).json({
        success: true,
        message: 'Event created successfully',
        data: savedEvent
      });
    } catch (error) {
      logger.error('Failed to create event', {
        error: error.message,
        userId: req.user?.userId,
        ip: req.ip
      });

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
      const existing = await contentRepository.getEventById(id);

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Event not found'
        });
      }

      const updatedEvent = {
        ...existing,
        ...updates,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString()
      };

      const result = validate('event', {
        ...updatedEvent,
        date: new Date(updatedEvent.date).toISOString()
      });
      if (!result.valid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: result.errors
        });
      }

      const savedEvent = await contentRepository.updateEvent(id, updatedEvent);

      logger.info('Event updated', {
        eventId: id,
        userId,
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Event updated successfully',
        data: savedEvent
      });
    } catch (error) {
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

      const deleted = await contentRepository.deleteEvent(id);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Event not found'
        });
      }

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
