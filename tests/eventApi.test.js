const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/db/repositories/contentRepository', () => ({
  getAllEvents: jest.fn(),
  getEventById: jest.fn(),
  createEvent: jest.fn(),
  updateEvent: jest.fn(),
  deleteEvent: jest.fn()
}));

const contentRepository = require('../src/db/repositories/contentRepository');
const config = require('../src/config');
const { app } = require('../src/index');

const generateToken = (role = 'admin') =>
  jwt.sign(
    { userId: 'test-user', username: 'tester', role },
    config.jwt.secret,
    { expiresIn: '1h' }
  );

describe('Event API Endpoints (v2, PostgreSQL-backed)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v2/events', () => {
    test('returns events from repository', async () => {
      const fakeEvents = [
        { id: '11111111-1111-4111-8111-111111111111', title: 'One' },
        { id: '22222222-2222-4222-8222-222222222222', title: 'Two' }
      ];
      contentRepository.getAllEvents.mockResolvedValue(fakeEvents);

      const response = await request(app)
        .get('/api/v2/events')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: fakeEvents
      });
      expect(contentRepository.getAllEvents).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /api/v2/events', () => {
    test('creates a new event with admin token', async () => {
      const adminToken = generateToken('admin');
      const input = {
        title: 'Test Event',
        description: 'Event description',
        date: new Date(Date.now() + 86400000).toISOString(),
        location: 'Test Location'
      };

      const created = {
        id: '33333333-3333-4333-8333-333333333333',
        ...input
      };
      contentRepository.createEvent.mockResolvedValue(created);

      const response = await request(app)
        .post('/api/v2/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(input)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id', created.id);
      expect(contentRepository.createEvent).toHaveBeenCalledTimes(1);
    });

    test('rejects editor direct writes (editor must use moderation queue APIs)', async () => {
      const editorToken = generateToken('editor');
      const input = {
        title: 'Editor Event',
        description: 'Event created by editor role',
        date: new Date(Date.now() + 86400000).toISOString(),
        location: 'Editor Location'
      };

      const response = await request(app)
        .post('/api/v2/events')
        .set('Authorization', `Bearer ${editorToken}`)
        .send(input)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(contentRepository.createEvent).toHaveBeenCalledTimes(0);
    });

    test('rejects when unauthenticated', async () => {
      const response = await request(app)
        .post('/api/v2/events')
        .send({
          title: 'Test Event',
          description: 'Event description',
          date: new Date(Date.now() + 86400000).toISOString(),
          location: 'Test Location'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('rejects non-admin users', async () => {
      const userToken = generateToken('user');

      const response = await request(app)
        .post('/api/v2/events')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Test Event',
          description: 'Event description',
          date: new Date(Date.now() + 86400000).toISOString(),
          location: 'Test Location'
        })
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    test('rejects moderator direct writes (approval flow only via admin queue)', async () => {
      const moderatorToken = generateToken('moderator');

      const response = await request(app)
        .post('/api/v2/events')
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({
          title: 'Moderation Event',
          description: 'Attempt from moderator',
          date: new Date(Date.now() + 86400000).toISOString(),
          location: 'Test Location'
        })
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/v2/events/:id', () => {
    test('rejects invalid UUID id format', async () => {
      const response = await request(app)
        .get('/api/v2/events/not-a-uuid')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Health Check', () => {
    test('returns health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('status', 'healthy');
    });
  });
});
