import Book from './book.model.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * GET /api/v1/books
 * ?search=harry&category=Fantasy&minPrice=50000&maxPrice=200000
 * &sort=-price,title&page=2&limit=12
 */
export const getAllBooks = catchAsync(async (req, res) => {
  const { search, category, minPrice, maxPrice, sort, page = 1, limit = 12 } = req.query;
  const filter = {};

  // Tìm kiếm theo tiêu đề hoặc tác giả (không phân biệt hoa thường)
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ title: regex }, { author: regex }];
  }

  if (category) filter.category = category;

  // Lọc khoảng giá
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  // Sắp xếp: "-price,title" => "-price title"; mặc định mới nhất trước
  const sortBy = sort ? sort.split(',').join(' ') : '-createdAt';

  // Phân trang (giới hạn tối đa 50 để tránh bị lạm dụng)
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
  const book = await Book.findById(req.params.id);
  if (!book) throw new AppError('Không tìm thấy sách', 404);
  res.json({ status: 'success', data: { book } });
});

export const createBook = catchAsync(async (req, res) => {
  const book = await Book.create(req.body);
  res.status(201).json({ status: 'success', data: { book } });
});

export const updateBook = catchAsync(async (req, res) => {
  const book = await Book.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!book) throw new AppError('Không tìm thấy sách', 404);
  res.json({ status: 'success', data: { book } });
});

export const deleteBook = catchAsync(async (req, res) => {
  const book = await Book.findByIdAndDelete(req.params.id);
  if (!book) throw new AppError('Không tìm thấy sách', 404);
  res.status(204).send();
});