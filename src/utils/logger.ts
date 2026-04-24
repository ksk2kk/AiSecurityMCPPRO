import * as winston from 'winston';
import { LogEntry } from '../types';
import { getConfig } from '../config';

const { combine, timestamp, printf, colorize, align } = winston.format;

let loggerInstance: winston.Logger | null = null;

const customFormat = printf(({ level, message, timestamp: ts, ...metadata }) => {
  let msg = `${ts} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});

export function getLogger(): winston.Logger {
  if (!loggerInstance) {
    const config = getConfig();
    
    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: combine(
          colorize(),
          timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          align(),
          customFormat
        )
      })
    ];
    
    try {
      const fs = require('fs');
      const path = require('path');
      const logDir = path.join(process.cwd(), 'logs');
      
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      transports.push(
        new winston.transports.File({
          filename: path.join(logDir, 'error.log'),
          level: 'error',
          format: combine(
            timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            align(),
            customFormat
          )
        }),
        new winston.transports.File({
          filename: path.join(logDir, 'combined.log'),
          format: combine(
            timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            align(),
            customFormat
          )
        })
      );
    } catch (error) {
      // Ignore file transport errors
    }
    
    loggerInstance = winston.createLogger({
      level: config.toolChain.logLevel,
      levels: {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3
      },
      transports
    });
  }
  
  return loggerInstance;
}

export function createLogEntry(
  level: LogEntry['level'],
  source: string,
  message: string,
  data?: unknown
): LogEntry {
  return {
    timestamp: new Date(),
    level,
    source,
    message,
    data
  };
}

export function logDebug(source: string, message: string, data?: unknown): void {
  const logger = getLogger();
  logger.debug(`[${source}] ${message}`, { data });
}

export function logInfo(source: string, message: string, data?: unknown): void {
  const logger = getLogger();
  logger.info(`[${source}] ${message}`, { data });
}

export function logWarn(source: string, message: string, data?: unknown): void {
  const logger = getLogger();
  logger.warn(`[${source}] ${message}`, { data });
}

export function logError(source: string, message: string, data?: unknown): void {
  const logger = getLogger();
  logger.error(`[${source}] ${message}`, { data });
}
