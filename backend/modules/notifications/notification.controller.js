import notificationService from './notification.service.js';
import catchAsync from '../../utils/catchAsync.js';
import AppError from '../../utils/AppError.js';

export const getMyNotifications = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, isRead } = req.query;
  const isReadBool = isRead === undefined ? undefined : isRead === 'true';

  const result = await notificationService.getUserNotifications(req.user.id, {
    page: Number(page),
    limit: Number(limit),
    isRead: isReadBool,
  });

  res.json({
    status: 'success',
    data: result,
  });
});

export const getUnreadCount = catchAsync(async (req, res) => {
  const unreadCount = await notificationService.getUnreadCount(req.user.id);
  res.json({
    status: 'success',
    data: { unreadCount },
  });
});

export const markAsRead = catchAsync(async (req, res) => {
  const notification = await notificationService.markAsRead(req.params.id, req.user.id);
  if (!notification) {
    throw new AppError('Không tìm thấy thông báo', 404);
  }

  res.json({
    status: 'success',
    data: { notification },
  });
});

export const markAllAsRead = catchAsync(async (req, res) => {
  await notificationService.markAllAsRead(req.user.id);
  res.json({
    status: 'success',
    message: 'Tất cả thông báo đã được đánh dấu là đã đọc',
  });
});

export const deleteNotification = catchAsync(async (req, res) => {
  const notification = await notificationService.deleteNotification(req.params.id, req.user.id);
  if (!notification) {
    throw new AppError('Không tìm thấy thông báo', 404);
  }

  res.json({
    status: 'success',
    message: 'Đã xóa thông báo',
  });
});
