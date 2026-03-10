const encryption = require('../src/utils/encryption');
const fs = require('fs').promises;
const path = require('path');
const { TEST_DIR } = require('./setup');

describe('Integrity Verification', () => {
  test('should generate consistent hash for same data', () => {
    const data = 'test data for hashing';
    const hash1 = encryption.generateHash(data);
    const hash2 = encryption.generateHash(data);

    expect(hash1).toBe(hash2);
  });

  test('should generate different hash for different data', () => {
    const data1 = 'test data 1';
    const data2 = 'test data 2';
    const hash1 = encryption.generateHash(data1);
    const hash2 = encryption.generateHash(data2);

    expect(hash1).not.toBe(hash2);
  });

  test('should verify valid hash', () => {
    const data = 'test data';
    const hash = encryption.generateHash(data);

    expect(encryption.verifyHash(data, hash)).toBe(true);
  });

  test('should reject invalid hash', () => {
    const data = 'test data';
    const hash = encryption.generateHash(data);

    expect(encryption.verifyHash('different data', hash)).toBe(false);
  });

  test('should detect tampered data', async () => {
    const testFile = path.join(TEST_DIR, 'integrity-test.json');
    const originalData = { value: 'original' };
    
    await fs.writeFile(testFile, JSON.stringify(originalData), 'utf8');
    
    const content = await fs.readFile(testFile, 'utf8');
    const originalHash = encryption.generateHash(content);
    
    const tamperedData = { value: 'tampered' };
    await fs.writeFile(testFile, JSON.stringify(tamperedData), 'utf8');
    
    const tamperedContent = await fs.readFile(testFile, 'utf8');
    
    expect(encryption.verifyHash(tamperedContent, originalHash)).toBe(false);
    
    await fs.unlink(testFile);
  });
});