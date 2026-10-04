import Cart from './cart.model.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';
import { getProduct, getProductsByIds, isProductServiceEnabled } from '../../utils/productClient.js';

const attachBooks = async (cart) => {
  if (!cart) return { items: [], totalPrice: 0 };
  if (!isProductServiceEnabled()) {
    await cart.populate('items.bookId', 'title coverImage stock');
    return cart;
  }
  const obj = cart.toObject();
  const books = await getProductsByIds(obj.items.map((i) => i.bookId));
  const map = new Map(books.map((b) => [String(b._id), b]));
  obj.items = obj.items.map((i) => ({
    ...i,
    bookId: map.get(String(i.bookId)) || i.bookId,
  }));
  return obj;
};

export const getMyCart = catchAsync(async (req, res) => {
  const cart = await Cart.findOne({ userId: req.user.id });
  res.json({ status: 'success', data: { cart: await attachBooks(cart) } });
});

export const addToCart = catchAsync(async (req, res) => {
  const { bookId, quantity = 1 } = req.body;
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1) throw new AppError('Số lượng không hợp lệ', 400);

  const book = await getProduct(bookId);
  if (!book) throw new AppError('Không tìm thấy sách', 404);
  const stock = book.stock;
  const finalPrice = book.finalPrice ?? book.discountPrice ?? book.price;

  let cart = await Cart.findOne({ userId: req.user.id });
  if (!cart) cart = new Cart({ userId: req.user.id, items: [] });

  const existing = cart.items.find((i) => i.bookId.equals(bookId));
  const newQty = (existing?.quantity ?? 0) + qty;
  if (newQty > stock) throw new AppError(`Chỉ còn ${stock} cuốn trong kho`, 400);

  if (existing) {
    existing.quantity = newQty;
    existing.price = finalPrice;
  } else {
    cart.items.push({ bookId, quantity: qty, price: finalPrice });
  }

  await cart.save();
  res.status(200).json({ status: 'success', data: { cart: await attachBooks(cart) } });
});

export const removeFromCart = catchAsync(async (req, res) => {
  const cart = await Cart.findOne({ userId: req.user.id });
  if (!cart) throw new AppError('Giỏ hàng trống', 404);
  cart.items = cart.items.filter((i) => !i.bookId.equals(req.params.bookId));
  await cart.save();
  res.json({ status: 'success', data: { cart: await attachBooks(cart) } });
});
