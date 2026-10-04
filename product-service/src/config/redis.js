import Redis from 'ioredis';

let redis;

export const isRedisEnabled = () => Boolean(process.env.REDIS_URL);

export const connectRedis = () => {
  if (!isRedisEnabled()) {
    console.warn('⚠️  REDIS_URL chưa cấu hình — bỏ qua cache');
    return null;
  }

  let redisUrl = process.env.REDIS_URL;
  if (redisUrl.startsWith('redis://') && redisUrl.includes('upstash.io')) {
    redisUrl = redisUrl.replace(/^redis:\/\//, 'rediss://');
  }

  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
  });

  redis.on('connect', () => console.log('✅ Redis (Upstash) connected'));
  redis.on('error', (err) => console.error('❌ Redis error:', err.message));
  return redis;
};

export const getRedis = () => redis;
