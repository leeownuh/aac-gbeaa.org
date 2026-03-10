const fs = require('fs').promises;
const path = require('path');
const config = require('../config');
const encryption = require('../utils/encryption');
const atomicWrite = require('../utils/atomicWrite');
const logger = require('../utils/logger');
const { validate } = require('../schemas');

class CacheService {
  constructor() {
    this.cache = new Map();
    this.hashes = new Map();
    this.encryptedFiles = new Set(['users.json', 'tokens.json', 'audit.json']);
  }

  getPrivateKey(filePath) {
    return path.join(config.paths.private, path.basename(filePath));
  }

  isEncrypted(filePath) {
    const basename = path.basename(filePath);
    return this.encryptedFiles.has(basename);
  }

  async initialize() {
    logger.info('Initializing cache...');
    await this.loadAll();
    await atomicWrite.recoverTempFiles();
    logger.info('Cache initialization complete');
  }

  async loadAll() {
    await this.loadPublicData();
    await this.loadPrivateData();
  }

  async loadPublicData() {
    const dataDir = config.paths.data;
    
    try {
      const files = await fs.readdir(dataDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      for (const file of jsonFiles) {
        const filePath = path.join(dataDir, file);
        await this.loadFile(filePath);
      }
    } catch (error) {
      logger.error('Failed to load public data', { error: error.message });
    }
  }

  async loadPrivateData() {
    const privateDir = config.paths.private;
    
    try {
      if (!(await atomicWrite.exists(privateDir))) {
        await fs.mkdir(privateDir, { recursive: true });
      }
      
      // Ensure encrypted files exist
      for (const file of this.encryptedFiles) {
        const filePath = path.join(privateDir, file);
        if (!(await atomicWrite.exists(filePath))) {
          await this.saveFile(filePath, [], false);
          logger.info(`Created encrypted file: ${file}`);
        }
      }
      
      const files = await fs.readdir(privateDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      for (const file of jsonFiles) {
        const filePath = path.join(privateDir, file);
        await this.loadFile(filePath, this.isEncrypted(filePath));
      }
    } catch (error) {
      logger.error('Failed to load private data', { error: error.message });
    }
  }

  async loadFile(filePath, decrypt = false) {
    try {
      const shouldEncrypt = this.isEncrypted(filePath);
      
      if (!(await atomicWrite.exists(filePath))) {
        const defaultData = [];
        await this.saveFile(filePath, defaultData, false);
        return defaultData;
      }

      const data = await atomicWrite.read(filePath, { decrypt: shouldEncrypt });
      
      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch (parseError) {
        logger.warn('Failed to parse file, creating empty array', { filePath, error: parseError.message });
        parsed = [];
        await this.saveFile(filePath, parsed, false);
      }
      
      const key = shouldEncrypt ? this.getPrivateKey(filePath) : filePath;
      this.cache.set(key, parsed);
      
      const hash = encryption.generateHash(data);
      this.hashes.set(key, hash);
      
      logger.debug('File loaded to cache', { filePath });
      return parsed;
    } catch (error) {
      logger.error('Failed to load file', { filePath, error: error.message });
      const defaultData = [];
      await this.saveFile(filePath, defaultData, false);
      return defaultData;
    }
  }

  get(filePath, defaultValue = []) {
    const key = this.getPrivateKey(filePath);
    
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath);
    }
    
    return defaultValue;
  }

  set(filePath, data) {
    const key = this.isEncrypted(filePath) ? this.getPrivateKey(filePath) : filePath;
    this.cache.set(key, data);
  }

  async saveFile(filePath, data, createVersion = true) {
    const isEncrypted = this.isEncrypted(filePath);
    const key = isEncrypted ? this.getPrivateKey(filePath) : filePath;

    await atomicWrite.write(key, data, {
      encrypt: isEncrypted,
      createBackup: false,
      version: createVersion
    });

    this.cache.set(key, data);
    
    const dataString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    const hash = encryption.generateHash(dataString);
    this.hashes.set(key, hash);
    
    return true;
  }

  async update(filePath, updateFn, schemaName = null) {
    const isEncrypted = this.isEncrypted(filePath);
    const key = isEncrypted ? this.getPrivateKey(filePath) : filePath;
    
    let data = this.get(key);
    if (!data) {
      data = await this.loadFile(key, isEncrypted);
    }

    const updated = await updateFn(data);
    
    if (schemaName) {
      const valid = this.validateArray(key, updated, schemaName);
      if (!valid) {
        throw new Error('Schema validation failed');
      }
    }

    await this.saveFile(key, updated);
    return updated;
  }

  validateArray(filePath, data, schemaName) {
    if (!Array.isArray(data)) {
      return false;
    }
    
    for (const item of data) {
      const result = validate(schemaName, item);
      if (!result.valid) {
        logger.error('Validation failed', { filePath, errors: result.errors });
        return false;
      }
    }
    
    return true;
  }

  verifyIntegrity(filePath) {
    const isEncrypted = this.isEncrypted(filePath);
    const key = isEncrypted ? this.getPrivateKey(filePath) : filePath;
    
    const cached = this.cache.get(key);
    if (!cached) return true;
    
    const dataString = JSON.stringify(cached, null, 2);
    const currentHash = encryption.generateHash(dataString);
    const storedHash = this.hashes.get(key);
    
    if (storedHash && currentHash !== storedHash) {
      logger.error('Integrity check failed', { filePath, storedHash, currentHash });
      return false;
    }
    
    return true;
  }

  async clear() {
    this.cache.clear();
    this.hashes.clear();
    logger.info('Cache cleared');
  }

  async reload(filePath) {
    const isEncrypted = this.isEncrypted(filePath);
    const key = isEncrypted ? this.getPrivateKey(filePath) : filePath;
    return await this.loadFile(key, isEncrypted);
  }
}

module.exports = new CacheService();