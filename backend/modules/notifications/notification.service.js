import Notification from './notification.model.js';
import User from '../users/user.model.js';
import { sendOrderDeliveredEmail } from '../../utils/email.js';

class NotificationService {
  /**
   * Tạo 1 thông báo vào MongoDB
   */
  async createNotification({ recipient, title, message, type = 'SYSTEM', data = {} }) {
    return Notification.create({
      recipient,
      title,
      message,
      type,
      data,
    });
  }

  /**
   * Thông báo khi đơn hàng được mua thành công:
   * 1. Gửi thông báo cho khách hàng đã mua
   * 2. Gửi thông báo cho các tài khoản admin thông báo User A đã mua đơn hàng
   */
  async notifyOrderPlaced({ order, user }) {
    const formattedAmount = Number(order.totalAmount || 0).toLocaleString('vi-VN');
    const itemsCount =
      order.orderItems?.reduce((sum, item) => sum + (item.quantity || 1), 0) ||
      order.orderItems?.length ||
      0;

    // 1. Thông báo cho người mua (User)
    const userNotificationPromise = this.createNotification({
      recipient: user.id || user._id,
      title: 'Đặt hàng thành công 🎉',
      message: `Đơn hàng #${order._id || order.id} (${itemsCount} sản phẩm, tổng tiền: ${formattedAmount}đ) của bạn đã được đặt thành công.`,
      type: 'ORDER_PLACED',
      data: {
        orderId: order._id || order.id,
        totalAmount: order.totalAmount,
        itemsCount,
      },
    });

    // 2. Tìm tất cả tài khoản admin để thông báo
    const admins = await User.find({ role: 'admin' }).select('_id name email');
    const adminNotificationPromises = admins.map((admin) =>
      this.createNotification({
        recipient: admin._id,
        title: `Đơn hàng mới từ ${user.name}`,
        message: `Khách hàng ${user.name} (${user.email}) vừa đặt thành công đơn hàng #${order._id || order.id} trị giá ${formattedAmount}đ.`,
        type: 'ADMIN_ORDER_ALERT',
        data: {
          orderId: order._id || order.id,
          customerId: user.id || user._id,
          customerName: user.name,
          customerEmail: user.email,
          totalAmount: order.totalAmount,
        },
      })
    );

    const [userNotification, ...adminNotifications] = await Promise.all([
      userNotificationPromise,
      ...adminNotificationPromises,
    ]);

    console.log(`🔔 [NotificationService] Đã gửi thông báo đơn hàng #${order._id || order.id}:`);
    console.log(`   - Khách hàng: ${user.name} (${user.email})`);
    console.log(`   - Quản trị viên: Đã gửi tới ${admins.length} admin`);

    return {
      userNotification,
      adminNotifications,
    };
  }

  /**
   * Thông báo khi đơn hàng được giao thành công:
   * 1. Tạo thông báo in-app cho khách hàng
   * 2. Gửi email thông báo giao hàng thành công tới khách hàng
   */
  async notifyOrderDelivered({ order, user }) {
    let recipientUser = user;
    if (!recipientUser && order.userId) {
      if (typeof order.userId === 'object' && order.userId.email) {
        recipientUser = order.userId;
      } else {
        recipientUser = await User.findById(order.userId);
      }
    }

    if (!recipientUser) {
      console.warn(`⚠️ [NotificationService] Không tìm thấy thông tin user cho đơn hàng #${order._id || order.id}`);
      return null;
    }

    const orderId = order._id || order.id;
    const formattedAmount = Number(order.totalAmount || 0).toLocaleString('vi-VN');

    // 1. Tạo thông báo in-app
    const userNotification = await this.createNotification({
      recipient: recipientUser._id || recipientUser.id,
      title: 'Đơn hàng đã được giao thành công 🎉',
      message: `Đơn hàng #${orderId} (tổng tiền: ${formattedAmount}đ) của bạn đã được giao thành công. Cảm ơn bạn đã mua sắm tại BookStore!`,
      type: 'ORDER_DELIVERED',
      data: {
        orderId,
        totalAmount: order.totalAmount,
        status: 'Delivered',
      },
    });

    // 2. Gửi email xác nhận giao hàng
    let emailResult = null;
    if (recipientUser.email) {
      try {
        emailResult = await sendOrderDeliveredEmail({
          toEmail: recipientUser.email,
          userName: recipientUser.name || recipientUser.shippingAddress?.fullName || 'Quý khách',
          order,
        });
        console.log(`📧 [NotificationService] Đã gửi email giao hàng thành công đơn #${orderId} tới: ${recipientUser.email}`);
      } catch (err) {
        console.error(`❌ [NotificationService] Lỗi gửi email giao hàng cho đơn #${orderId}:`, err.message);
      }
    } else {
      console.warn(`⚠️ [NotificationService] User #${recipientUser._id || recipientUser.id} không có email để gửi`);
    }

    return {
      userNotification,
      emailResult,
    };
  }

  /**
   * Lấy danh sách thông báo của user với phân trang và lọc trạng thái đã đọc
   */
  async getUserNotifications(userId, { page = 1, limit = 20, isRead } = {}) {
    const filter = { recipient: userId };
    if (typeof isRead === 'boolean') {
      filter.isRead = isRead;
    }

    const skip = (page - 1) * limit;
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipient: userId, isRead: false }),
    ]);

    return {
      notifications,
      total,
      unreadCount,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Đánh dấu 1 thông báo là đã đọc
   */
  async markAsRead(notificationId, userId) {
    return Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
  }

  /**
   * Đánh dấu toàn bộ thông báo của user là đã đọc
   */
  async markAllAsRead(userId) {
    await Notification.updateMany(
      { recipient: userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    return { success: true };
  }

  /**
   * Đếm số lượng thông báo chưa đọc
   */
  async getUnreadCount(userId) {
    return Notification.countDocuments({ recipient: userId, isRead: false });
  }

  /**
   * Xóa một thông báo
   */
  async deleteNotification(notificationId, userId) {
    return Notification.findOneAndDelete({ _id: notificationId, recipient: userId });
  }
}

export const notificationService = new NotificationService();
export { sendOrderDeliveredEmail };
export default notificationService;

