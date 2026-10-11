import { getRedis, isRedisEnabled } from '../config/redis.js';

const CATALOG_V = 'catalog:v';

const json = (doc) => (typeof doc.toJSON === 'function' ? doc.toJSON() : doc);

// ─── Tầng L1: In-Memory Node.js RAM Cache (Phản hồi < 0.05ms) ───────────
const l1Cache = new Map();
const L1_MAX_SIZE = 2000;
const L1_DEFAULT_TTL_SEC = 15; // Giữ 15s trong RAM

const l1Get = (key) => {
  const item = l1Cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    l1Cache.delete(key);
    return null;
  }
  return item.value;
};

const l1Set = (key, value, ttlSec = L1_DEFAULT_TTL_SEC) => {
  if (l1Cache.size >= L1_MAX_SIZE) {
    const oldest = l1Cache.keys().next().value;
    if (oldest) l1Cache.delete(oldest);
  }
  l1Cache.set(key, {
    value,
    expiresAt: Date.now() + Math.min(ttlSec, L1_DEFAULT_TTL_SEC) * 1000,
  });
};

const l1Del = (key) => {
  l1Cache.delete(key);
};

const l1ClearLists = () => {
  // Xóa toàn bộ key danh sách sách trong L1 khi có cập nhật từ admin
  for (const k of l1Cache.keys()) {
    if (k.startsWith('books:')) {
      l1Cache.delete(k);
    }
  }
};

// ─── Multi-tier Cache: L1 (RAM) -> L2 (Upstash Redis) ───────────────────

export const cacheGet = async (key) => {
  // 1. Kiểm tra L1 in-memory cache trước (< 0.05ms)
  const l1Val = l1Get(key);
  if (l1Val !== null) return l1Val;

  // 2. L1 miss: Kiểm tra L2 Upstash Redis (20-40ms)
  if (!isRedisEnabled()) return null;
  try {
    const raw = await getRedis().get(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Lưu ngược lại vào L1 để các request tiếp theo lấy ngay trong RAM
    l1Set(key, parsed, L1_DEFAULT_TTL_SEC);
    return parsed;
  } catch (err) {
    console.error('Redis GET failed:', err.message);
    return null;
  }
};

export const cacheSet = async (key, value, ttlSec) => {
  // 1. Lưu vào L1 RAM cache
  l1Set(key, value, ttlSec);

  // 2. Lưu vào L2 Upstash Redis (nếu bật)
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
  // Xóa ngay danh sách trong L1 RAM
  l1ClearLists();

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
  l1Del(bookCacheKey(id));
  if (isRedisEnabled()) {
    try {
      await getRedis().del(bookCacheKey(id));
    } catch (err) {
      console.error('Redis DEL failed:', err.message);
    }
  }
  await bumpCatalog();
};
