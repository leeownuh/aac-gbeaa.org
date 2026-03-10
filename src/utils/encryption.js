const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('./logger');

class EncryptionService {
  constructor() {
    this.algorithm = config.encryption.algorithm;
    this.key = this.deriveKey(config.encryption.key);
    this.saltLength = config.encryption.saltLength;
  }

  deriveKey(password) {
    return crypto.scryptSync(password, 'salt', 32);
  }

  encrypt(data) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      const result = iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
      return result;
    } catch (error) {
      logger.error('Encryption failed', { error: error.message });
      throw new Error('Encryption failed');
    }
  }

  decrypt(encryptedData) {
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }
      
      const [ivHex, authTagHex, encrypted] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Decryption failed', { error: error.message });
      throw new Error('Decryption failed');
    }
  }

  encryptFile(filePath) {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      const encrypted = this.encrypt(data);
      fs.writeFileSync(filePath, encrypted, 'utf8');
      logger.info('File encrypted', { filePath });
      return true;
    } catch (error) {
      logger.error('File encryption failed', { filePath, error: error.message });
      throw error;
    }
  }

  decryptFile(filePath) {
    try {
      const encryptedData = fs.readFileSync(filePath, 'utf8');
      return this.decrypt(encryptedData);
    } catch (error) {
      logger.error('File decryption failed', { filePath, error: error.message });
      throw error;
    }
  }

  generateHash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  verifyHash(data, hash) {
    return this.generateHash(data) === hash;
  }
}

module.exports = new EncryptionService();