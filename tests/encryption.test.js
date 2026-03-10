const encryption = require('../src/utils/encryption');

describe('Encryption Service', () => {
  test('should encrypt data successfully', () => {
    const data = 'Hello, World!';
    const encrypted = encryption.encrypt(data);

    expect(encrypted).toBeDefined();
    expect(typeof encrypted).toBe('string');
    expect(encrypted.split(':').length).toBe(3);
  });

  test('should decrypt data successfully', () => {
    const data = 'Hello, World!';
    const encrypted = encryption.encrypt(data);
    const decrypted = encryption.decrypt(encrypted);

    expect(decrypted).toBe(data);
  });

  test('should handle complex objects', () => {
    const data = JSON.stringify({
      id: '123',
      name: 'Test',
      nested: { key: 'value' }
    });
    const encrypted = encryption.encrypt(data);
    const decrypted = encryption.decrypt(encrypted);

    expect(decrypted).toBe(data);
  });

  test('should fail to decrypt invalid data', () => {
    expect(() => {
      encryption.decrypt('invalid:encrypted:data');
    }).toThrow();
  });

  test('should generate SHA-256 hash', () => {
    const data = 'test data';
    const hash = encryption.generateHash(data);

    expect(hash).toBeDefined();
    expect(hash.length).toBe(64);
    expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
  });

  test('should verify hash correctly', () => {
    const data = 'test data';
    const hash = encryption.generateHash(data);

    expect(encryption.verifyHash(data, hash)).toBe(true);
    expect(encryption.verifyHash(data + 'modified', hash)).toBe(false);
  });

  test('should handle empty strings', () => {
    const data = '';
    const encrypted = encryption.encrypt(data);
    const decrypted = encryption.decrypt(encrypted);

    expect(decrypted).toBe(data);
  });
});