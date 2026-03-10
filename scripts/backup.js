const fs = require('fs').promises;
const path = require('path');
const config = require('../src/config');
const encryption = require('../src/utils/encryption');
const logger = require('../src/utils/logger');

class BackupService {
  constructor() {
    this.backupDir = path.resolve(config.paths.backups);
  }

  async createBackup() {
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const backupPath = path.join(this.backupDir, timestamp);
      
      await fs.mkdir(backupPath, { recursive: true });
      
      await this.backupDirectory(config.paths.data, path.join(backupPath, 'public'));
      await this.backupDirectory(config.paths.private, path.join(backupPath, 'private'));
      await this.backupDirectory(config.paths.uploads, path.join(backupPath, 'uploads'));
      
      await this.createIntegrityHash(backupPath);
      
      logger.info('Backup completed successfully', { backupPath });
      return { success: true, backupPath };
    } catch (error) {
      logger.error('Backup failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  async backupDirectory(sourceDir, targetDir) {
    try {
      await fs.mkdir(targetDir, { recursive: true });
      
      const files = await fs.readdir(sourceDir);
      
      for (const file of files) {
        const sourcePath = path.join(sourceDir, file);
        const targetPath = path.join(targetDir, file);
        const stat = await fs.stat(sourcePath);
        
        if (stat.isDirectory()) {
          await this.backupDirectory(sourcePath, targetPath);
        } else {
          await fs.copyFile(sourcePath, targetPath);
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async createIntegrityHash(backupPath) {
    const hashFile = path.join(backupPath, 'integrity.json');
    const hashes = {};
    
    await this.calculateDirectoryHash(backupPath, hashes, backupPath);
    
    const integrityData = {
      timestamp: new Date().toISOString(),
      hashes
    };
    
    await fs.writeFile(hashFile, JSON.stringify(integrityData, null, 2), 'utf8');
  }

  async calculateDirectoryHash(dirPath, hashes, basePath) {
    const files = await fs.readdir(dirPath);
    
    for (const file of files) {
      if (file === 'integrity.json') continue;
      
      const filePath = path.join(dirPath, file);
      const stat = await fs.stat(filePath);
      const relativePath = path.relative(basePath, filePath);
      
      if (stat.isDirectory()) {
        await this.calculateDirectoryHash(filePath, hashes, basePath);
      } else {
        const content = await fs.readFile(filePath, 'utf8');
        hashes[relativePath] = encryption.generateHash(content);
      }
    }
  }

  async cleanupOldBackups() {
    try {
      const backups = await fs.readdir(this.backupDir);
      
      const backupDateMap = backups
        .filter(b => /^\d{4}-\d{2}-\d{2}$/.test(b))
        .map(async (backupName) => {
          const backupPath = path.join(this.backupDir, backupName);
          const stat = await fs.stat(backupPath);
          return {
            name: backupName,
            path: backupPath,
            createdAt: stat.birthtime
          };
        });

      const backupStats = await Promise.all(backupDateMap);
      const cutoffDate = new Date(Date.now() - (config.backup.retentionDays * 24 * 60 * 60 * 1000));
      
      for (const backup of backupStats) {
        if (backup.createdAt < cutoffDate) {
          await this.deleteBackup(backup.path);
          logger.info('Old backup deleted', { backup: backup.name });
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup old backups', { error: error.message });
    }
  }

  async deleteBackup(backupPath) {
    const deleteRecursive = async (dir) => {
      const files = await fs.readdir(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = await fs.stat(filePath);
        
        if (stat.isDirectory()) {
          await deleteRecursive(filePath);
        } else {
          await fs.unlink(filePath);
        }
      }
      
      await fs.rmdir(dir);
    };
    
    await deleteRecursive(backupPath);
  }

  async verifyBackup(backupPath) {
    try {
      const hashFile = path.join(backupPath, 'integrity.json');
      const integrityData = JSON.parse(await fs.readFile(hashFile, 'utf8'));
      
      for (const [relativePath, expectedHash] of Object.entries(integrityData.hashes)) {
        const filePath = path.join(backupPath, relativePath);
        const content = await fs.readFile(filePath, 'utf8');
        const actualHash = encryption.generateHash(content);
        
        if (actualHash !== expectedHash) {
          logger.error('Backup verification failed', {
            relativePath,
            expectedHash,
            actualHash
          });
          return { success: false, error: 'Integrity check failed' };
        }
      }
      
      return { success: true };
    } catch (error) {
      logger.error('Backup verification error', { error: error.message });
      return { success: false, error: error.message };
    }
  }
}

const backup = new BackupService();

backup.createBackup()
  .then(result => {
    console.log(result);
    if (result.success) {
      return backup.cleanupOldBackups();
    }
  })
  .then(() => {
    console.log('Backup process completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Backup process failed:', error);
    process.exit(1);
  });