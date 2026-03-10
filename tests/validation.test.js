const { validate } = require('../src/schemas');
const { v4: uuidv4 } = require('uuid');

describe('Schema Validation', () => {
  describe('Event Validation', () => {
    test('should validate a valid event', () => {
      const event = {
        id: uuidv4(),
        title: 'Test Event',
        description: 'This is a test event',
        date: new Date(Date.now() + 86400000).toISOString(),
        location: 'Test Location',
        createdAt: new Date().toISOString()
      };

      const result = validate('event', event);
      expect(result.valid).toBe(true);
    });

    test('should reject event with short title', () => {
      const event = {
        id: uuidv4(),
        title: 'ab',
        description: 'This is a test event',
        date: new Date().toISOString(),
        location: 'Test Location',
        createdAt: new Date().toISOString()
      };

      const result = validate('event', event);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    test('should reject event with missing required fields', () => {
      const event = {
        id: uuidv4(),
        title: 'Test'
      };

      const result = validate('event', event);
      expect(result.valid).toBe(false);
    });

    test('should reject event with invalid UUID', () => {
      const event = {
        id: 'not-a-uuid',
        title: 'Test Event',
        description: 'This is a test event',
        date: new Date().toISOString(),
        location: 'Test Location',
        createdAt: new Date().toISOString()
      };

      const result = validate('event', event);
      expect(result.valid).toBe(false);
    });
  });

  describe('User Validation', () => {
    test('should validate a valid user', () => {
      const user = {
        id: uuidv4(),
        username: 'testuser',
        password: 'Password@123',
        role: 'admin',
        createdAt: new Date().toISOString()
      };

      const result = validate('user', user);
      expect(result.valid).toBe(true);
    });

    test('should reject user with short username', () => {
      const user = {
        id: uuidv4(),
        username: 'ab',
        password: 'Password@123',
        role: 'admin',
        createdAt: new Date().toISOString()
      };

      const result = validate('user', user);
      expect(result.valid).toBe(false);
    });

    test('should reject user with invalid role', () => {
      const user = {
        id: uuidv4(),
        username: 'testuser',
        password: 'Password@123',
        role: 'invalid',
        createdAt: new Date().toISOString()
      };

      const result = validate('user', user);
      expect(result.valid).toBe(false);
    });
  });

  describe('Article Validation', () => {
    test('should validate a valid article', () => {
      const article = {
        id: uuidv4(),
        title: 'Test Article',
        content: 'This is test content',
        author: 'Test Author',
        createdAt: new Date().toISOString()
      };

      const result = validate('article', article);
      expect(result.valid).toBe(true);
    });

    test('should reject article without content', () => {
      const article = {
        id: uuidv4(),
        title: 'Test Article',
        author: 'Test Author',
        createdAt: new Date().toISOString()
      };

      const result = validate('article', article);
      expect(result.valid).toBe(false);
    });
  });

  describe('Gallery Validation', () => {
    test('should validate a valid gallery item', () => {
      const gallery = {
        id: uuidv4(),
        filename: 'test-image.jpg',
        uploadedBy: 'admin',
        createdAt: new Date().toISOString()
      };

      const result = validate('gallery', gallery);
      expect(result.valid).toBe(true);
    });
  });
});