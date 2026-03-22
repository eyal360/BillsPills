import winston from 'winston';
import fs from 'fs';
import path from 'path';

// On Vercel (Production), we only log to Console as the filesystem is read-only
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

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

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: isProduction ? customFormat : consoleFormat,
  }),
];

// Only add file logging if NOT on Vercel/Production 
// In a real local environment, this will still work
if (!isProduction) {
  const logDir = path.join(process.cwd(), 'logs');
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir);
    }
    transports.push(
      new winston.transports.File({ 
        filename: path.join(logDir, 'error.log'), 
        level: 'error',
        format: winston.format.combine(winston.format.uncolorize(), customFormat)
      }),
      new winston.transports.File({ 
        filename: path.join(logDir, 'combined.log'),
        format: winston.format.combine(winston.format.uncolorize(), customFormat)
      })
    );
  } catch (e) {
    console.warn('Logging to file disabled (likely read-only filesystem)');
  }
}

export const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  format: customFormat,
  transports,
});
