// apps/api/src/config/redis.ts

import { env } from './env';

export const bullmqConnection = {
  url: env.REDIS_URL,
  maxRetriesPerRequest: null,
};

export const QUEUE_PREFIX = 'academy-automation';
