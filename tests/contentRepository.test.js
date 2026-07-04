jest.mock('../src/db/client', () => ({
  query: jest.fn()
}));

const { query } = require('../src/db/client');
const repository = require('../src/db/repositories/contentRepository');

describe('Content Repository (PostgreSQL adapter)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('maps article rows to API shape', async () => {
    query.mockResolvedValue({
      rows: [
        {
          id: 'a1',
          title: 'Title',
          content: 'Body',
          author: 'Admin',
          excerpt: 'Body',
          date_text: '2026-04-14',
          category: 'General',
          tags: ['one', 'two'],
          image_url: '/img.png',
          published: false,
          created_at: new Date('2026-04-14T00:00:00.000Z'),
          updated_at: new Date('2026-04-14T01:00:00.000Z')
        }
      ]
    });

    const result = await repository.getAllArticles();
    expect(result[0]).toEqual({
      id: 'a1',
      title: 'Title',
      content: 'Body',
      author: 'Admin',
      excerpt: 'Body',
      date: '2026-04-14',
      category: 'General',
      tags: ['one', 'two'],
      imageUrl: '/img.png',
      published: false,
      createdAt: '2026-04-14T00:00:00.000Z',
      updatedAt: '2026-04-14T01:00:00.000Z'
    });
  });

  test('returns null for missing event id', async () => {
    query.mockResolvedValue({ rows: [] });
    const result = await repository.getEventById('missing');
    expect(result).toBeNull();
  });

  test('counts gallery images', async () => {
    query.mockResolvedValue({ rows: [{ count: 17 }] });
    const count = await repository.countGalleryImages();
    expect(count).toBe(17);
  });
});
