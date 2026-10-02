import Order, { ORDER_STATUS } from './order.model.js';
import Cart from '../cart/cart.model.js';
import Book from '../books/book.model.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';
import notificationService from '../notifications/notification.service.js';

// Hoàn lại tồn kho cho danh sách item (dùng khi rollback hoặc hủy đơn)
const restoreStock = (items) =>
  Promise.all(items.map((i) => Book.updateOne({ _id: i.bookId }, { $inc: { stock: i.quantity } })));

/** POST /api/v1/orders  — tạo đơn từ giỏ hàng hiện tại */
export const createOrder = catchAsync(async (req, res) => {
  const { shippingAddress, paymentMethod = 'COD' } = req.body;
  if (!shippingAddress) throw new AppError('Vui lòng cung cấp địa chỉ giao hàng', 400);

  const cart = await Cart.findOne({ userId: req.user.id });
  if (!cart || cart.items.length === 0) throw new AppError('Giỏ hàng đang trống', 400);

  const reserved = []; // các item đã trừ kho thành công (để rollback nếu lỗi)
  const orderItems = [];

  try {
    for (const item of cart.items) {
      // Trừ kho nguyên tử: chỉ thành công nếu stock còn đủ
      const book = await Book.findOneAndUpdate(
        { _id: item.bookId, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { new: true }
      );
      if (!book) throw new AppError('Một số sách đã hết hàng hoặc không đủ số lượng', 400);

      reserved.push(item);
      // Giá lấy lại từ DB tại thời điểm đặt hàng để luôn chính xác
      orderItems.push({
        bookId: book.id,
        title: book.title,
        quantity: item.quantity,
        price: book.finalPrice,
      });
    }

    const totalAmount = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);

    const order = await Order.create({
      userId: req.user.id,
      orderItems,
      shippingAddress,
      paymentMethod,
      totalAmount,
    });

    // Đặt hàng thành công => làm trống giỏ
    cart.items = [];
    await cart.save();

    // Gửi thông báo cho khách hàng và tất cả admin (bất đồng bộ không chặn response)
    notificationService.notifyOrderPlaced({ order, user: req.user }).catch((err) => {
      console.error('❌ Lỗi gửi thông báo đơn hàng:', err.message);
    });

    res.status(201).json({ status: 'success', data: { order } });
  } catch (err) {
    await restoreStock(reserved); // rollback kho nếu có bước nào thất bại
    throw err;
  }
});

/** GET /api/v1/orders/my — đơn hàng của tôi */
export const getMyOrders = catchAsync(async (req, res) => {
  const orders = await Order.find({ userId: req.user.id }).sort('-createdAt');
  res.json({ status: 'success', results: orders.length, data: { orders } });
});

/** GET /api/v1/orders — admin xem tất cả */
export const getAllOrders = catchAsync(async (req, res) => {
  const filter = req.query.status ? { orderStatus: req.query.status } : {};
  const orders = await Order.find(filter).populate('userId', 'name email').sort('-createdAt');
  res.json({ status: 'success', results: orders.length, data: { orders } });
});

/** PATCH /api/v1/orders/:id/status — admin cập nhật trạng thái */
export const updateOrderStatus = catchAsync(async (req, res) => {
  const { status } = req.body;
  if (!ORDER_STATUS.includes(status)) throw new AppError('Trạng thái không hợp lệ', 400);

  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);

  if (['Delivered', 'Cancelled'].includes(order.orderStatus)) {
    throw new AppError('Đơn hàng đã kết thúc, không thể đổi trạng thái', 400);
  }

  if (status === 'Cancelled') await restoreStock(order.orderItems); // hủy đơn => hoàn kho

  if (status === 'Delivered' && order.paymentMethod === 'COD') {
    order.isPaid = true; // COD: thu tiền khi giao
    order.paidAt = new Date();
  }

  order.orderStatus = status;
  await order.save();
  res.json({ status: 'success', data: { order } });
});

/** PATCH /api/v1/orders/:id/cancel — khách tự hủy khi còn Pending */
export const cancelMyOrder = catchAsync(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, userId: req.user.id });
  if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
  if (order.orderStatus !== 'Pending') throw new AppError('Chỉ hủy được đơn đang chờ xử lý', 400);

  await restoreStock(order.orderItems);
  order.orderStatus = 'Cancelled';
  await order.save();
  res.json({ status: 'success', data: { order } });
});