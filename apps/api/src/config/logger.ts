// apps/api/src/config/logger.ts

import winston from 'winston';
import { env } from './env';

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    env.NODE_ENV === 'production' ? winston.format.json() : winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ level, message, timestamp, module: mod, ...meta }) => {
        const tag = mod ? `[${mod}] ` : '';
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} ${level}: ${tag}${message}${metaStr}`;
      }),
    ),
  ),
  transports: [new winston.transports.Console()],
});
