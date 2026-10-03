import Notification from '../models/notification.model.js';
import User from '../models/user.model.js';
import { sendOrderPlacedEmail } from '../email.service.js';

/**
 * Xử lý event: order.placed
 * Payload từ monolith: { orderId, userId, userName, userEmail, totalAmount, orderItems, shippingAddress, paymentMethod }
 */
export const handleOrderPlaced = async (payload) => {
  const { orderId, userId, userName, userEmail, totalAmount, orderItems, paymentMethod } = payload;

  console.log(`📦 [Handler] order.placed → Đơn #${orderId} của ${userName}`);

  // 1. Lưu in-app notification cho user (bổ sung, monolith đã lưu — bỏ qua nếu muốn)
  // (Đây là ví dụ — trong thực tế monolith đã lưu, service này chỉ gửi email)

  // 2. Gửi email xác nhận đặt hàng
  if (userEmail) {
    try {
      await sendOrderPlacedEmail({
        toEmail: userEmail,
        userName,
        order: { _id: orderId, totalAmount, orderItems, paymentMethod },
      });
    } catch (err) {
      console.error(`❌ [Handler] Gửi email order.placed thất bại:`, err.message);
      throw err; // ném lại để consumer nack và retry
    }
  }

  // 3. Thông báo cho admin (lưu vào DB)
  try {
    const admins = await User.find({ role: 'admin' }).select('_id name email');
    const formattedAmount = Number(totalAmount || 0).toLocaleString('vi-VN');

    await Promise.all(
      admins.map((admin) =>
        Notification.create({
          recipient: admin._id,
          title: `Đơn hàng mới từ ${userName}`,
          message: `${userName} (${userEmail}) vừa đặt đơn #${orderId} trị giá ${formattedAmount}đ.`,
          type: 'ADMIN_ORDER_ALERT',
          data: { orderId, customerId: userId, customerName: userName, totalAmount },
        })
      )
    );

    console.log(`✅ [Handler] order.placed xử lý xong — Notified ${admins.length} admin(s)`);
  } catch (err) {
    console.error(`❌ [Handler] Lỗi lưu admin notification:`, err.message);
  }
};
