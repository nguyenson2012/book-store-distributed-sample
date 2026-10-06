import Order, { ORDER_STATUS } from './order.model.js';
import Cart from '../cart/cart.model.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';
import notificationService from '../notifications/notification.service.js';
import { publishEvent } from '../../utils/rabbitmq.js';
import { reserveStock, restoreStock } from '../../utils/productClient.js';
import { getUsersByIds } from '../../utils/authClient.js';

/** POST /api/v1/orders  — tạo đơn từ giỏ hàng hiện tại */
export const createOrder = catchAsync(async (req, res) => {
  const { shippingAddress, paymentMethod = 'COD' } = req.body;
  if (!shippingAddress) throw new AppError('Vui lòng cung cấp địa chỉ giao hàng', 400);

  const cart = await Cart.findOne({ userId: req.user.id });
  if (!cart || cart.items.length === 0) throw new AppError('Giỏ hàng đang trống', 400);

  let reserved = [];
  const orderItems = [];

  try {
    reserved = await reserveStock(
      cart.items.map((item) => ({ bookId: item.bookId, quantity: item.quantity }))
    );

    for (const item of reserved) {
      orderItems.push({
        bookId: item.bookId,
        title: item.title,
        quantity: item.quantity,
        price: item.price,
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

    // Publish event sang Notification Service qua RabbitMQ
    publishEvent('order.placed', {
      orderId: order._id,
      userId: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      totalAmount: order.totalAmount,
      orderItems: order.orderItems,
      shippingAddress: order.shippingAddress,
      paymentMethod: order.paymentMethod,
    });

    res.status(201).json({ status: 'success', data: { order } });
  } catch (err) {
    await restoreStock(reserved);
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
  // User nằm ở auth-service => không populate được, ghép thông tin user theo lô
  const orders = (await Order.find(filter).sort('-createdAt')).map((o) => o.toObject());
  const users = await getUsersByIds(orders.map((o) => o.userId));
  const byId = new Map(users.map((u) => [String(u.id), u]));
  for (const o of orders) {
    const u = byId.get(String(o.userId));
    if (u) o.userId = { _id: u.id, name: u.name, email: u.email };
  }
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

  // Khi order được giao thành công => gửi thông báo in-app và email cho khách hàng
  if (status === 'Delivered') {
    const [user] = await getUsersByIds([order.userId]);

    notificationService.notifyOrderDelivered({ order, user }).catch((err) => {
      console.error('❌ Lỗi gửi thông báo/email khi giao hàng thành công:', err.message);
    });

    // Publish event sang Notification Service qua RabbitMQ (kèm thông tin user để consumer không cần query DB user cũ)
    publishEvent('order.delivered', {
      orderId: order._id,
      userId: order.userId,
      userName: user?.name,
      userEmail: user?.email,
      totalAmount: order.totalAmount,
      orderItems: order.orderItems,
      shippingAddress: order.shippingAddress,
      paymentMethod: order.paymentMethod,
    });
  }

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