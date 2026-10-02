import Cart from './cart.model.js';
import Book from '../books/book.model.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const getMyCart = catchAsync(async (req, res) => {
  const cart = await Cart.findOne({ userId: req.user.id }).populate('items.bookId', 'title coverImage stock');
  res.json({ status: 'success', data: { cart: cart ?? { items: [], totalPrice: 0 } } });
});

export const addToCart = catchAsync(async (req, res) => {
  const { bookId, quantity = 1 } = req.body;
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1) throw new AppError('Số lượng không hợp lệ', 400);

  const book = await Book.findById(bookId);
  if (!book) throw new AppError('Không tìm thấy sách', 404);

  let cart = await Cart.findOne({ userId: req.user.id });
  if (!cart) cart = new Cart({ userId: req.user.id, items: [] });

  const existing = cart.items.find((i) => i.bookId.equals(bookId));
  const newQty = (existing?.quantity ?? 0) + qty;
  if (newQty > book.stock) throw new AppError(`Chỉ còn ${book.stock} cuốn trong kho`, 400);

  if (existing) {
    existing.quantity = newQty;
    existing.price = book.finalPrice;
  } else {
    // Lấy giá từ DB, KHÔNG tin giá client gửi lên
    cart.items.push({ bookId, quantity: qty, price: book.finalPrice });
  }

  await cart.save(); // pre('save') tự tính totalPrice
  res.status(200).json({ status: 'success', data: { cart } });
});

export const removeFromCart = catchAsync(async (req, res) => {
  const cart = await Cart.findOne({ userId: req.user.id });
  if (!cart) throw new AppError('Giỏ hàng trống', 404);
  cart.items = cart.items.filter((i) => !i.bookId.equals(req.params.bookId));
  await cart.save();
  res.json({ status: 'success', data: { cart } });
});