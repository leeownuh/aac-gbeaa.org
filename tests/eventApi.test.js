const request = require('supertest');
const jwt = require('jsonwebtoken');
const config = require('../src/config');
const { app } = require('../src/index');

let accessToken;
let adminToken;

const generateTestToken = (userId = 'test-user', role = 'admin') => {
  return jwt.sign(
    { userId, username: 'testuser', role },
    config.jwt.secret,
    { expiresIn: '1h' }
  );
};

describe('Event API Endpoints', () => {
  beforeAll(() => {
    adminToken = generateTestToken('admin-1', 'admin');
  });

  describe('GET /api/events', () => {
    test('should return all events', async () => {
      const response = await request(app)
        .get('/api/events')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('POST /api/events', () => {
    test('should create a new event with valid data', async () => {
      const eventData = {
        title: 'Test Event',
        description: 'This is a test event description',
        date: new Date(Date.now() + 86400000).toISOString(),
        location: 'Test Location'
      };

      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(eventData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.title).toBe(eventData.title);
    });

    test('should reject event without authentication', async () => {
      const eventData = {
        title: 'Test Event',
        description: 'Description',
        date: new Date().toISOString(),
        location: 'Location'
      };

      const response = await request(app)
        .post('/api/events')
        .send(eventData)
        .expect(401);
    });

    test('should reject event with missing fields', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Test' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('should reject event with short title', async () => {
      const eventData = {
        title: 'ab',
        description: 'Description',
        date: new Date().toISOString(),
        location: 'Location'
      };

      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(eventData)
        .expect(400);
    });

    test('should reject oversized payload', async () => {
      const largeContent = 'x'.repeat(1024 * 1024);
      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Test',
          description: largeContent,
          date: new Date().toISOString(),
          location: 'Location'
        });

      expect([400, 413]).toContain(response.status);
    });
  });

  describe('GET /api/events/:id', () => {
    test('should return 400 for invalid ID format', async () => {
      const response = await request(app)
        .get('/api/events/invalid-id')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/events/:id', () => {
    test('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/events/some-id')
        .expect(401);
    });

    test('should require admin role', async () => {
      const userToken = generateTestToken('user-1', 'user');
      
      const response = await request(app)
        .delete('/api/events/some-id')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe('Health Check', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('status', 'healthy');
    });
  });
});