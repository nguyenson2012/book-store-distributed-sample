import Book from './book.model.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';
import { isProductServiceEnabled } from '../../utils/productClient.js';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ─── Helpers để proxy sang product-service ─────────────────────────── */

const psBase = () => process.env.PRODUCT_SERVICE_URL?.replace(/\/$/, '');
const psKey = () => process.env.PRODUCT_INTERNAL_SECRET;

/**
 * Forward một public GET /api/v1/books request sang product-service.
 * Giữ nguyên tất cả query params, stream response về client.
 */
const proxyPublic = async (req, res, path) => {
  const qs = new URLSearchParams(req.query).toString();
  const url = `${psBase()}/api/v1/books${path}${qs ? `?${qs}` : ''}`;

  try {
    const upstream = await fetch(url, {
      headers: {
        Authorization: req.headers.authorization || '',
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (upstream.ok) {
      const body = await upstream.json();
      res.status(upstream.status).json(body);
      return true;
    }
    console.warn(`⚠️ Product Service trả về status ${upstream.status}, fallback về MongoDB local`);
  } catch (err) {
    console.warn(`⚠️ Lỗi kết nối Product Service (${err.message}), fallback về MongoDB local`);
  }

  return false;
};

/**
 * Forward một admin request (CRUD) sang product-service.
 * Đính kèm JWT của người dùng để product-service tự xác thực admin.
 */
const proxyAdmin = async (req, res, path, method = 'GET') => {
  const url = `${psBase()}/api/v1/books${path}`;

  const upstream = await fetch(url, {
    method,
    headers: {
      Authorization: req.headers.authorization || '',
      'Content-Type': 'application/json',
    },
    body: ['GET', 'DELETE'].includes(method) ? undefined : JSON.stringify(req.body),
  });

  if (upstream.status === 204) return res.status(204).send();
  const body = await upstream.json();
  res.status(upstream.status).json(body);
};

/* ─── Public routes ──────────────────────────────────────────────────── */

export const getFlashSaleBooks = catchAsync(async (req, res) => {
  if (isProductServiceEnabled()) {
    const handled = await proxyPublic(req, res, '/flash-sale');
    if (handled) return;
  }

  // Fallback: MongoDB local
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

  res.json({ status: 'success', results: books.length, data: { books } });
});

export const getAllBooks = catchAsync(async (req, res) => {
  if (isProductServiceEnabled()) {
    const handled = await proxyPublic(req, res, '/');
    if (handled) return;
  }

  // Fallback: MongoDB local
  const { search, category, minPrice, maxPrice, sort, page = 1, limit = 12, flashSale } = req.query;
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

  const sortBy = sort ? sort.split(',').join(' ') : '-createdAt';
  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = Math.min(Math.max(Number(limit) || 12, 1), 50);

  const [books, total] = await Promise.all([
    Book.find(filter).sort(sortBy).skip((pageNum - 1) * limitNum).limit(limitNum),
    Book.countDocuments(filter),
  ]);

  res.json({
    status: 'success',
    results: books.length,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    data: { books },
  });
});

export const getBook = catchAsync(async (req, res) => {
  if (isProductServiceEnabled()) {
    const handled = await proxyPublic(req, res, `/${req.params.id}`);
    if (handled) return;
  }

  const book = await Book.findById(req.params.id);
  if (!book) throw new AppError('Không tìm thấy sách', 404);
  res.json({ status: 'success', data: { book } });
});

/* ─── Admin routes (proxy giữ nguyên JWT của admin) ─────────────────── */

export const createBook = catchAsync(async (req, res) => {
  if (isProductServiceEnabled()) return proxyAdmin(req, res, '/', 'POST');

  const data = { ...req.body };
  if (data.discountPrice === '' || data.discountPrice === null) delete data.discountPrice;
  if (data.coverImage && typeof data.coverImage === 'string') data.coverImage = data.coverImage.trim();
  const book = await Book.create(data);
  res.status(201).json({ status: 'success', data: { book } });
});

export const updateBook = catchAsync(async (req, res) => {
  if (isProductServiceEnabled()) return proxyAdmin(req, res, `/${req.params.id}`, 'PATCH');

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
      if (!updates.flashSaleStartDate && !book.flashSaleStartDate) updates.flashSaleStartDate = new Date();
    }
  }

  if (updates.coverImage && typeof updates.coverImage === 'string') updates.coverImage = updates.coverImage.trim();
  Object.assign(book, updates);
  await book.save();
  res.json({ status: 'success', data: { book } });
});

export const toggleFlashSale = catchAsync(async (req, res) => {
  if (isProductServiceEnabled()) return proxyAdmin(req, res, `/${req.params.id}/flash-sale`, 'PATCH');

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

  await book.save();
  res.json({ status: 'success', data: { book } });
});

export const deleteBook = catchAsync(async (req, res) => {
  if (isProductServiceEnabled()) return proxyAdmin(req, res, `/${req.params.id}`, 'DELETE');

  const book = await Book.findByIdAndDelete(req.params.id);
  if (!book) throw new AppError('Không tìm thấy sách', 404);
  res.status(204).send();
});