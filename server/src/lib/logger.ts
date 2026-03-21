import winston from 'winston';
import fs from 'fs';
import path from 'path';

const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return `${timestamp} [${level}]: ${message} ${stack || ''}`;
  })
);

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: customFormat,
  transports: [
    // Realtime colorful output for development
    new winston.transports.Console({
      format: consoleFormat,
    }),
    // All errors get saved here
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error',
      format: winston.format.combine(winston.format.uncolorize(), customFormat)
    }),
    // Everything gets saved here
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log'),
      format: winston.format.combine(winston.format.uncolorize(), customFormat)
    }),
  ],
});
