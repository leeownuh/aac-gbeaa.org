const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config');

const logsDir = path.resolve(config.paths.logs);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...metadata }) => {
    let log = `${timestamp} [${level.toUpperCase()}]`;
    if (metadata.ip) log += ` [IP: ${metadata.ip}]`;
    if (metadata.userAgent) log += ` [UA: ${metadata.userAgent}]`;
    if (metadata.userId) log += ` [User: ${metadata.userId}]`;
    if (metadata.role) log += ` [Role: ${metadata.role}]`;
    log += ` ${message}`;
    if (stack) log += `\n${stack}`;
    if (Object.keys(metadata).length > 0) {
      const metaStr = JSON.stringify(
        Object.fromEntries(
          Object.entries(metadata).filter(([k]) => !['ip', 'userAgent', 'userId', 'role'].includes(k))
        )
      );
      if (metaStr !== '{}') log += ` ${metaStr}`;
    }
    return log;
  })
);

const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 20 * 1024 * 1024,
      maxFiles: config.logging.maxFiles
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 20 * 1024 * 1024,
      maxFiles: config.logging.maxFiles
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'security.log'),
      level: 'warn',
      maxsize: 20 * 1024 * 1024,
      maxFiles: config.logging.maxFiles
    })
  ]
});

module.exports = logger;