import { catalogApi } from './api';

// In-memory cache cho chi tiết sách (TTL 2 phút)
const cache = new Map();
const TTL = 2 * 60 * 1000;

// Tránh gọi trùng lặp nếu đang có request đang chạy (Request Deduplication)
const inflight = new Map();

/**
 * Lưu sách vào in-memory cache
 */
export const setCachedBook = (id, book) => {
  if (!id || !book) return;
  cache.set(String(id), {
    book,
    expiresAt: Date.now() + TTL,
  });
};

/**
 * Lấy sách từ in-memory cache nếu còn hạn
 */
export const getCachedBook = (id) => {
  if (!id) return null;
  const item = cache.get(String(id));
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cache.delete(String(id));
    return null;
  }
  return item.book;
};

/**
 * Tải trước chi tiết sách và ảnh bìa khi người dùng rê chuột (Hover) hoặc chạm (Touch)
 * @param {string} id - ID của cuốn sách
 * @param {string} [coverImage] - URL ảnh bìa sách để pre-load vào bộ nhớ trình duyệt
 */
export const prefetchBook = (id, coverImage) => {
  if (!id) return;
  const key = String(id);

  // Nếu dữ liệu đã có trong cache và còn hạn thì bỏ qua
  if (getCachedBook(key)) return;

  // Nếu đang có request ngầm đang chạy thì không gọi thêm
  if (inflight.has(key)) return;

  // Pre-load ảnh bìa vào browser cache để khi mở trang ảnh hiển thị ngay
  if (coverImage && (coverImage.startsWith('http') || coverImage.startsWith('/'))) {
    const img = new Image();
    img.src = coverImage;
  }

  // Gửi request lấy dữ liệu chi tiết sách ngầm
  const promise = catalogApi
    .get(`/books/${key}`)
    .then(({ data }) => {
      const book = data.data?.book;
      if (book) {
        setCachedBook(key, book);
        if (book.coverImage && (book.coverImage.startsWith('http') || book.coverImage.startsWith('/'))) {
          const img = new Image();
          img.src = book.coverImage;
        }
      }
      return book;
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
};
