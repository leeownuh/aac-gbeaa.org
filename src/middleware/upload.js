const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');

const uploadDir = path.resolve(config.paths.uploads);

const initializeUploadDir = async () => {
  try {
    await fs.mkdir(uploadDir, { recursive: true });
  } catch (error) {
    logger.error('Failed to create upload directory', { error: error.message });
  }
};

initializeUploadDir();

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uuid = crypto.randomUUID();
    const filename = `${uuid}${ext}`;
    cb(null, filename);
  }
});

const fileFilter = async (req, file, cb) => {
  try {
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (!config.upload.allowedExtensions.includes(ext)) {
      return cb(new Error(`File type not allowed. Allowed types: ${config.upload.allowedExtensions.join(', ')}`));
    }

    if (!config.upload.allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error(`MIME type not allowed: ${file.mimetype}`));
    }

    if (file.originalname.includes('..')) {
      logger.warn('Path traversal attempt detected', { filename: file.originalname });
      return cb(new Error('Invalid filename'));
    }

    if (file.originalname.length > 255) {
      return cb(new Error('Filename too long'));
    }

    cb(null, true);
  } catch (error) {
    logger.error('File filter error', { error: error.message });
    cb(error);
  }
};

const validateMagicNumber = async (filePath, mimetype) => {
  try {
    const buffer = await fs.readFile(filePath);
    const magicNumbers = config.upload.magicNumbers[mimetype];
    
    if (magicNumbers) {
      for (let i = 0; i < magicNumbers.length; i++) {
        if (buffer[i] !== magicNumbers[i]) {
          return false;
        }
      }
    }
    
    return true;
  } catch (error) {
    logger.error('Magic number validation failed', { filePath, error: error.message });
    return false;
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize
  }
});

const uploadErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files' });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Unexpected field name' });
    }
    return res.status(400).json({ error: err.message });
  }

  if (err) {
    return res.status(400).json({ error: err.message });
  }

  next();
};

module.exports = {
  upload,
  uploadErrorHandler,
  validateMagicNumber,
  uploadDir
};