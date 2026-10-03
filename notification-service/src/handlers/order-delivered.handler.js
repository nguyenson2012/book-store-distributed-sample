import User from '../models/user.model.js';
import Notification from '../models/notification.model.js';
import { sendOrderDeliveredEmail } from '../email.service.js';

/**
 * Xử lý event: order.delivered
 * Payload từ monolith: { orderId, userId, totalAmount, orderItems, shippingAddress, paymentMethod }
 */
export const handleOrderDelivered = async (payload) => {
  const { orderId, userId, totalAmount, orderItems, shippingAddress, paymentMethod } = payload;

  console.log(`🚚 [Handler] order.delivered → Đơn #${orderId}`);

  // 1. Lấy thông tin user từ DB
  const user = await User.findById(userId).select('name email');
  if (!user) {
    console.warn(`⚠️ [Handler] Không tìm thấy user ${userId} cho đơn #${orderId}`);
    return;
  }

  // 2. Gửi email thông báo giao hàng thành công
  if (user.email) {
    try {
      await sendOrderDeliveredEmail({
        toEmail: user.email,
        userName: user.name || 'Quý khách',
        order: { _id: orderId, totalAmount, orderItems, shippingAddress, paymentMethod },
      });
    } catch (err) {
      console.error(`❌ [Handler] Gửi email order.delivered thất bại:`, err.message);
      throw err; // ném lại để consumer nack và retry
    }
  } else {
    console.warn(`⚠️ [Handler] User ${userId} không có email`);
  }

  console.log(`✅ [Handler] order.delivered xử lý xong cho đơn #${orderId}`);
};
