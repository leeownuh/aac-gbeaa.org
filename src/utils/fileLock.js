const lockfile = require('proper-lockfile');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');
const logger = require('./logger');

class FileLockService {
  constructor() {
    this.locks = new Map();
  }

  async acquire(filePath, options = {}) {
    const defaultOptions = {
      retries: {
        retries: 10,
        minTimeout: 100,
        maxTimeout: 500
      },
      stale: 30000,
      update: 10000
    };

    const opts = { ...defaultOptions, ...options };
    
    try {
      // Ensure the parent directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true }).catch(() => {});
      
      // Create the file if it doesn't exist with placeholder content
      const fileExists = await this.fileExists(filePath);
      if (!fileExists) {
        await fs.writeFile(filePath, '[]', 'utf8');
      }
      
      const release = await lockfile.lock(filePath, opts);
      this.locks.set(filePath, release);
      logger.debug('Lock acquired', { filePath });
      return release;
    } catch (error) {
      logger.error('Failed to acquire lock', { filePath, error: error.message });
      throw new Error(`Failed to acquire lock for ${filePath}`);
    }
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async release(filePath) {
    try {
      const release = this.locks.get(filePath);
      if (release) {
        await release();
        this.locks.delete(filePath);
        logger.debug('Lock released', { filePath });
      } else {
        await lockfile.unlock(filePath);
        logger.debug('Lock released (force)', { filePath });
      }
    } catch (error) {
      logger.error('Failed to release lock', { filePath, error: error.message });
    }
  }

  async withLock(filePath, callback) {
    let release;
    try {
      release = await this.acquire(filePath);
      const result = await callback();
      return result;
    } finally {
      if (release) {
        await release();
        this.locks.delete(filePath);
      }
    }
  }

  async cleanup() {
    const filePaths = Array.from(this.locks.keys());
    for (const filePath of filePaths) {
      await this.release(filePath);
    }
    logger.info('All locks cleaned up');
  }
}

module.exports = new FileLockService();