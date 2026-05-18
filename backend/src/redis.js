import Redis from 'ioredis';

const redis = new Redis({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  token: process.env.REDIS_TOKEN || '',
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

redis.on('error', (err) => {
  console.error('[redis] connection error:', err.message);
});

redis.on('connect', () => {
  console.log('[redis] connected');
});

export default redis;
