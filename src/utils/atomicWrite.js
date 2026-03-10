const fs = require('fs').promises;
const path = require('path');
const encryption = require('./encryption');
const fileLock = require('./fileLock');
const logger = require('./logger');
const config = require('../config');

class AtomicWriteService {
  constructor() {
    this.tempSuffix = '.tmp';
  }

  async write(filePath, data, options = {}) {
    const { 
      encrypt = false, 
      createBackup = true,
      version = true 
    } = options;

    const tmpPath = filePath + this.tempSuffix;
    
    try {
      await fileLock.acquire(filePath);

      if (createBackup) {
        await this.createBackup(filePath);
      }

      if (version) {
        await this.createVersion(filePath, data);
      }

      let dataToWrite = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      
      if (encrypt) {
        dataToWrite = encryption.encrypt(dataToWrite);
      }

      await fs.writeFile(tmpPath, dataToWrite, 'utf8');
      
      await fs.rename(tmpPath, filePath);
      
      logger.info('Atomic write successful', { filePath, encrypted: encrypt });
      return true;
    } catch (error) {
      logger.error('Atomic write failed', { filePath, error: error.message });
      
      try {
        if (await this.exists(tmpPath)) {
          await fs.unlink(tmpPath);
        }
      } catch (cleanupError) {
        logger.error('Failed to cleanup temp file', { tmpPath, error: cleanupError.message });
      }
      
      throw error;
    } finally {
      await fileLock.release(filePath);
    }
  }

  async read(filePath, options = {}) {
    const { decrypt = false } = options;
    
    try {
      const data = await fs.readFile(filePath, 'utf8');
      
      if (decrypt) {
        return encryption.decrypt(data);
      }
      
      return data;
    } catch (error) {
      logger.error('File read failed', { filePath, error: error.message });
      throw error;
    }
  }

  async createBackup(filePath) {
    try {
      if (!(await this.exists(filePath))) {
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(config.paths.backups, `${path.basename(filePath)}.${timestamp}.bak`);
      
      await fs.mkdir(config.paths.backups, { recursive: true });
      await fs.copyFile(filePath, backupPath);
      
      logger.info('Backup created', { filePath, backupPath });
    } catch (error) {
      logger.error('Backup creation failed', { filePath, error: error.message });
    }
  }

  async createVersion(filePath, data) {
    try {
      const versionsDir = path.join(config.paths.backups, 'versions', path.basename(filePath));
      await fs.mkdir(versionsDir, { recursive: true });

      const timestamp = Date.now();
      const versionPath = path.join(versionsDir, `v${timestamp}.json`);

      let versionData = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      await fs.writeFile(versionPath, versionData, 'utf8');

      await this.cleanupOldVersions(versionsDir);
      
      logger.debug('Version created', { filePath, versionPath });
    } catch (error) {
      logger.error('Version creation failed', { filePath, error: error.message });
    }
  }

  async cleanupOldVersions(versionsDir) {
    try {
      const files = await fs.readdir(versionsDir);
      
      if (files.length <= config.backup.maxVersions) {
        return;
      }

      const versionFiles = files
        .filter(f => f.endsWith('.json'))
        .map(f => ({
          name: f,
          path: path.join(versionsDir, f),
          timestamp: parseInt(f.replace('v', '').replace('.json', ''))
        }))
        .sort((a, b) => b.timestamp - a.timestamp);

      const filesToDelete = versionFiles.slice(config.backup.maxVersions);
      
      for (const file of filesToDelete) {
        await fs.unlink(file.path);
        logger.debug('Old version deleted', { file: file.name });
      }
    } catch (error) {
      logger.error('Version cleanup failed', { versionsDir, error: error.message });
    }
  }

  async recoverTempFiles() {
    try {
      const dataDir = config.paths.data;
      const privateDir = config.paths.private;
      
      const dirs = [dataDir, privateDir];
      
      for (const dir of dirs) {
        if (!(await this.exists(dir))) continue;
        
        const files = await fs.readdir(dir);
        const tempFiles = files.filter(f => f.endsWith(this.tempSuffix));
        
        for (const tempFile of tempFiles) {
          const tempPath = path.join(dir, tempFile);
          const originalPath = tempPath.replace(this.tempSuffix, '');
          
          logger.warn('Recovering temp file', { tempFile, originalPath });
          await fs.rename(tempPath, originalPath);
        }
      }
    } catch (error) {
      logger.error('Temp file recovery failed', { error: error.message });
    }
  }

  async exists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = new AtomicWriteService();