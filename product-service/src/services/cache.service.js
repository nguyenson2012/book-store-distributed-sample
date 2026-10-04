import { getRedis, isRedisEnabled } from '../config/redis.js';

const CATALOG_V = 'catalog:v';

const json = (doc) => (typeof doc.toJSON === 'function' ? doc.toJSON() : doc);

export const cacheGet = async (key) => {
  if (!isRedisEnabled()) return null;
  try {
    const raw = await getRedis().get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('Redis GET failed:', err.message);
    return null;
  }
};

export const cacheSet = async (key, value, ttlSec) => {
  if (!isRedisEnabled()) return;
  try {
    await getRedis().set(key, JSON.stringify(value), 'EX', ttlSec);
  } catch (err) {
    console.error('Redis SET failed:', err.message);
  }
};

export const catalogVersion = async () => {
  if (!isRedisEnabled()) return '0';
  try {
    return (await getRedis().get(CATALOG_V)) || '0';
  } catch {
    return '0';
  }
};

export const bumpCatalog = async () => {
  if (!isRedisEnabled()) return;
  try {
    await getRedis().incr(CATALOG_V);
  } catch (err) {
    console.error('Redis INCR failed:', err.message);
  }
};

export const bookCacheKey = (id) => `book:${id}`;

export const listCacheKey = async (suffix) => {
  const v = await catalogVersion();
  return `books:v${v}:${suffix}`;
};

export const cacheBook = (book, ttlSec = 60) =>
  cacheSet(bookCacheKey(book._id || book.id), json(book), ttlSec);

export const invalidateBook = async (id) => {
  if (!isRedisEnabled()) return;
  try {
    await getRedis().del(bookCacheKey(id));
  } catch (err) {
    console.error('Redis DEL failed:', err.message);
  }
  await bumpCatalog();
};
