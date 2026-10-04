import Book from '../modules/books/book.model.js';
import AppError from './AppError.js';

const base = () => process.env.PRODUCT_SERVICE_URL?.replace(/\/$/, '');
const internalKey = () => process.env.PRODUCT_INTERNAL_SECRET;

export const isProductServiceEnabled = () => Boolean(base() && internalKey());

const call = async (path, { method = 'GET', body } = {}) => {
  const url = `${base()}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-internal-key': internalKey(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  let payload = {};
  try {
    payload = await res.json();
  } catch {
    payload = {};
  }

  if (!res.ok) {
    throw new AppError(payload.message || 'Lỗi Product Service', res.status);
  }
  return payload;
};

export const getProduct = async (id) => {
  if (!isProductServiceEnabled()) return Book.findById(id);
  const payload = await call(`/internal/v1/books/${id}`);
  return payload.data.book;
};

export const getProductsByIds = async (ids) => {
  const unique = [...new Set(ids.map(String).filter((id) => id && id !== 'undefined'))];
  if (!unique.length) return [];
  if (!isProductServiceEnabled()) return Book.find({ _id: { $in: unique } });
  const payload = await call(`/internal/v1/books?ids=${unique.join(',')}`);
  return payload.data.books;
};

export const reserveStock = async (items) => {
  if (!isProductServiceEnabled()) {
    const reserved = [];
    try {
      for (const item of items) {
        const book = await Book.findOneAndUpdate(
          { _id: item.bookId, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { new: true }
        );
        if (!book) throw new AppError('Một số sách đã hết hàng hoặc không đủ số lượng', 400);
        reserved.push({
          bookId: book.id,
          quantity: item.quantity,
          title: book.title,
          price: book.finalPrice,
        });
      }
      return reserved;
    } catch (err) {
      await restoreStock(reserved);
      throw err;
    }
  }
  const payload = await call('/internal/v1/stock/reserve', { method: 'POST', body: { items } });
  return payload.data.items;
};

export const restoreStock = async (items) => {
  if (!items?.length) return;
  if (!isProductServiceEnabled()) {
    await Promise.all(items.map((i) => Book.updateOne({ _id: i.bookId }, { $inc: { stock: i.quantity } })));
    return;
  }
  await call('/internal/v1/stock/restore', { method: 'POST', body: { items } });
};
