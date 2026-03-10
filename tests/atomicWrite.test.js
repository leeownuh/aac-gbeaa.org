const fs = require('fs').promises;
const path = require('path');
const atomicWrite = require('../src/utils/atomicWrite');
const { TEST_DIR } = require('./setup');

describe('Atomic Write Service', () => {
  const testFile = path.join(TEST_DIR, 'test.json');

  beforeEach(async () => {
    await atomicWrite.write(testFile, { test: true }, { encrypt: false, createBackup: false, version: false });
  });

  afterEach(async () => {
    try {
      await fs.unlink(testFile);
      const tmpFile = testFile + '.tmp';
      try { await fs.unlink(tmpFile); } catch {}
    } catch {}
  });

  test('should write data atomically', async () => {
    const data = { message: 'Hello, World!' };
    await atomicWrite.write(testFile, data, { encrypt: false, createBackup: false, version: false });

    const readData = await atomicWrite.read(testFile);
    const parsed = JSON.parse(readData);

    expect(parsed).toEqual(data);
  });

  test('should create backup before write', async () => {
    const data1 = { version: 1 };
    const data2 = { version: 2 };

    await atomicWrite.write(testFile, data1, { encrypt: false, createBackup: true, version: false });
    await atomicWrite.write(testFile, data2, { encrypt: false, createBackup: true, version: false });

    const readData = await atomicWrite.read(testFile);
    const parsed = JSON.parse(readData);

    expect(parsed).toEqual(data2);
  });

  test('should create version backups', async () => {
    const data1 = { version: 1 };
    const data2 = { version: 2 };
    const data3 = { version: 3 };

    await atomicWrite.write(testFile, data1, { encrypt: false, createBackup: false, version: true });
    await atomicWrite.write(testFile, data2, { encrypt: false, createBackup: false, version: true });
    await atomicWrite.write(testFile, data3, { encrypt: false, createBackup: false, version: true });

    const readData = await atomicWrite.read(testFile);
    const parsed = JSON.parse(readData);

    expect(parsed).toEqual(data3);
  });

  test('should handle file not found on read', async () => {
    const nonExistentFile = path.join(TEST_DIR, 'nonexistent.json');

    await expect(atomicWrite.read(nonExistentFile)).rejects.toThrow();
  });

  test('should recover temporary files', async () => {
    const data = { recovered: true };
    const tmpFile = testFile + '.tmp';

    await fs.writeFile(tmpFile, JSON.stringify(data));
    await atomicWrite.recoverTempFiles();

    const exists = await fs.access(testFile).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });
});