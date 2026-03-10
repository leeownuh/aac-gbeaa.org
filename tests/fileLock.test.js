const fileLock = require('../src/utils/fileLock');
const fs = require('fs').promises;
const path = require('path');
const { TEST_DIR } = require('./setup');

describe('File Lock Service', () => {
  const testFile = path.join(TEST_DIR, 'lock-test.json');

  beforeEach(async () => {
    await fs.writeFile(testFile, '{}');
  });

  afterEach(async () => {
    try { await fileLock.release(testFile); } catch {}
    try { await fs.unlink(testFile); } catch {}
  });

  test('should acquire lock successfully', async () => {
    const release = await fileLock.acquire(testFile);
    expect(release).toBeDefined();
    expect(typeof release).toBe('function');
    await release();
  });

  test('should release lock successfully', async () => {
    const release = await fileLock.acquire(testFile);
    await fileLock.release(testFile);

    const release2 = await fileLock.acquire(testFile);
    expect(release2).toBeDefined();
    await release2();
  });

  test('should execute callback within lock', async () => {
    const result = await fileLock.withLock(testFile, async () => {
      return 'success';
    });

    expect(result).toBe('success');
  });

  test('should release lock even on error', async () => {
    await expect(
      fileLock.withLock(testFile, async () => {
        throw new Error('Test error');
      })
    ).rejects.toThrow('Test error');

    const release = await fileLock.acquire(testFile);
    expect(release).toBeDefined();
    await release();
  });

  test('should handle multiple operations', async () => {
    let count = 0;

    await Promise.all([
      fileLock.withLock(testFile, async () => {
        count++;
        await new Promise(resolve => setTimeout(resolve, 10));
      }),
      fileLock.withLock(testFile, async () => {
        count++;
        await new Promise(resolve => setTimeout(resolve, 10));
      })
    ]);

    expect(count).toBe(2);
  });

  test('should cleanup all locks', async () => {
    await fileLock.acquire(testFile);

    await fileLock.cleanup();

    const release = await fileLock.acquire(testFile);
    expect(release).toBeDefined();
    await release();
  });
});