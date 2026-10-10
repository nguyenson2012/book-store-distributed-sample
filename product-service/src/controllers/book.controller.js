import Book from '../models/book.model.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import { indexBook, removeFromIndex, searchBooks } from '../services/search.service.js';
import {
  cacheGet,
  cacheSet,
  cacheBook,
  bookCacheKey,
  listCacheKey,
  invalidateBook,
} from '../services/cache.service.js';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const serialize = (doc) => (typeof doc.toJSON === 'function' ? doc.toJSON() : doc);

const mongoFilter = ({ search, category, minPrice, maxPrice, flashSale }) => {
  const filter = {};
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ title: regex }, { author: regex }];
  }
  if (category) filter.category = category;
  if (flashSale === 'true') {
    const now = new Date();
    filter.isFlashSale = true;
    filter.flashSaleEndDate = { $gt: now };
    filter.$or = [
      { flashSaleStartDate: { $exists: false } },
      { flashSaleStartDate: null },
      { flashSaleStartDate: { $lte: now } },
    ];
  }
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }
  return filter;
};

export const getFlashSaleBooks = catchAsync(async (req, res) => {
  res.set('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
  const cacheKey = await listCacheKey('flash-sale');
  const cached = await cacheGet(cacheKey);
  if (cached) return res.json(cached);

  const now = new Date();
  const books = await Book.find({
    isFlashSale: true,
    flashSaleEndDate: { $gt: now },
    $or: [
      { flashSaleStartDate: { $exists: false } },
      { flashSaleStartDate: null },
      { flashSaleStartDate: { $lte: now } },
    ],
  }).sort({ flashSaleEndDate: 1 });

  const payload = {
    status: 'success',
    results: books.length,
    data: { books },
  };
  await cacheSet(cacheKey, payload, 15);
  res.json(payload);
});

export const getAllBooks = catchAsync(async (req, res) => {
  res.set('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
  const { search, category, minPrice, maxPrice, sort, page = 1, flashSale } = req.query;
  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = Math.min(Math.max(Number(req.query.limit) || 12, 1), 50);
  const offset = (pageNum - 1) * limitNum;
  const sortBy = sort ? sort.split(',').join(' ') : '-createdAt';

  const cacheKey = await listCacheKey(
    JSON.stringify({ search, category, minPrice, maxPrice, sort, page: pageNum, limit: limitNum, flashSale })
  );
  const cached = await cacheGet(cacheKey);
  if (cached) return res.json(cached);

  let books;
  let total;

  const meili = await searchBooks({
    search,
    category,
    minPrice,
    maxPrice,
    flashSale,
    sort: sort?.split(',')[0],
    offset,
    limit: limitNum,
  }).catch((err) => {
    console.error('Meili search fallback Mongo:', err.message);
    return null;
  });

  if (meili) {
    books = await Book.find({ _id: { $in: meili.ids } });
    const order = new Map(meili.ids.map((id, i) => [String(id), i]));
    books.sort((a, b) => (order.get(String(a._id)) ?? 0) - (order.get(String(b._id)) ?? 0));
    total = meili.estimatedTotal;
  } else {
    const filter = mongoFilter({ search, category, minPrice, maxPrice, flashSale });
    [books, total] = await Promise.all([
      Book.find(filter).sort(sortBy).skip(offset).limit(limitNum),
      Book.countDocuments(filter),
    ]);
  }

  const payload = {
    status: 'success',
    results: books.length,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    data: { books },
  };
  await cacheSet(cacheKey, payload, 30);
  res.json(payload);
});

export const getBook = catchAsync(async (req, res) => {
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
  const cached = await cacheGet(bookCacheKey(req.params.id));
  if (cached) return res.json({ status: 'success', data: { book: cached } });

  const book = await Book.findById(req.params.id);
  if (!book) throw new AppError('Không tìm thấy sách', 404);
  await cacheBook(book);
  res.json({ status: 'success', data: { book } });
});

const persistAndIndex = async (book) => {
  await book.save();
  await indexBook(book);
  await invalidateBook(book.id);
  return book;
};

export const createBook = catchAsync(async (req, res) => {
  const data = { ...req.body };
  if (data.discountPrice === '' || data.discountPrice === null) delete data.discountPrice;
  if (data.coverImage && typeof data.coverImage === 'string') data.coverImage = data.coverImage.trim();
  const book = await Book.create(data);
  await indexBook(book);
  await invalidateBook(book.id);
  res.status(201).json({ status: 'success', data: { book } });
});

export const updateBook = catchAsync(async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) throw new AppError('Không tìm thấy sách', 404);

  const updates = { ...req.body };

  if ('discountPrice' in updates) {
    if (updates.discountPrice === null || updates.discountPrice === '' || updates.discountPrice === undefined) {
      book.discountPrice = undefined;
      delete updates.discountPrice;
    }
  }

  if ('isFlashSale' in updates) {
    if (!updates.isFlashSale) {
      book.isFlashSale = false;
      book.flashSaleEndDate = undefined;
      book.flashSaleStartDate = undefined;
      delete updates.flashSaleEndDate;
      delete updates.flashSaleStartDate;
    } else {
      book.isFlashSale = true;
      if (!updates.flashSaleDiscount) updates.flashSaleDiscount = 50;
      if (!updates.flashSaleStartDate && !book.flashSaleStartDate) {
        updates.flashSaleStartDate = new Date();
      }
    }
  }

  if (updates.coverImage && typeof updates.coverImage === 'string') {
    updates.coverImage = updates.coverImage.trim();
  }

  Object.assign(book, updates);
  await persistAndIndex(book);
  res.json({ status: 'success', data: { book } });
});

export const toggleFlashSale = catchAsync(async (req, res) => {
  const { isFlashSale, durationHours, endDate, discountPercent = 50 } = req.body;
  const book = await Book.findById(req.params.id);
  if (!book) throw new AppError('Không tìm thấy sách', 404);

  if (isFlashSale) {
    book.isFlashSale = true;
    book.flashSaleDiscount = Number(discountPercent) || 50;
    book.flashSaleStartDate = new Date();
    if (endDate) book.flashSaleEndDate = new Date(endDate);
    else if (durationHours) book.flashSaleEndDate = new Date(Date.now() + Number(durationHours) * 60 * 60 * 1000);
    else book.flashSaleEndDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  } else {
    book.isFlashSale = false;
    book.flashSaleEndDate = undefined;
    book.flashSaleStartDate = undefined;
  }

  await persistAndIndex(book);
  res.json({ status: 'success', data: { book } });
});

export const deleteBook = catchAsync(async (req, res) => {
  const book = await Book.findByIdAndDelete(req.params.id);
  if (!book) throw new AppError('Không tìm thấy sách', 404);
  await removeFromIndex(book.id);
  await invalidateBook(book.id);
  res.status(204).send();
});

export const getBooksInternal = catchAsync(async (req, res) => {
  const ids = String(req.query.ids || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!ids.length) return res.json({ status: 'success', data: { books: [] } });
  const books = await Book.find({ _id: { $in: ids } });
  res.json({ status: 'success', data: { books: books.map(serialize) } });
});

export const getBookInternal = catchAsync(async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) throw new AppError('Không tìm thấy sách', 404);
  res.json({ status: 'success', data: { book: serialize(book) } });
});

export const reserveStock = catchAsync(async (req, res) => {
  const items = req.body.items || [];
  const reserved = [];
  try {
    for (const item of items) {
      const qty = Number(item.quantity);
      const book = await Book.findOneAndUpdate(
        { _id: item.bookId, stock: { $gte: qty } },
        { $inc: { stock: -qty } },
        { new: true }
      );
      if (!book) throw new AppError('Một số sách đã hết hàng hoặc không đủ số lượng', 400);
      reserved.push({ bookId: book.id, quantity: qty, title: book.title, price: book.finalPrice });
      await indexBook(book);
      await invalidateBook(book.id);
    }
    res.json({ status: 'success', data: { items: reserved } });
  } catch (err) {
    await Promise.all(
      reserved.map((i) => Book.updateOne({ _id: i.bookId }, { $inc: { stock: i.quantity } }))
    );
    throw err;
  }
});

export const restoreStock = catchAsync(async (req, res) => {
  const items = req.body.items || [];
  await Promise.all(
    items.map(async (i) => {
      const book = await Book.findByIdAndUpdate(i.bookId, { $inc: { stock: i.quantity } }, { new: true });
      if (book) {
        await indexBook(book);
        await invalidateBook(book.id);
      }
    })
  );
  res.json({ status: 'success' });
});
