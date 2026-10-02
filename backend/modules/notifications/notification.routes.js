import express from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from './notification.controller.js';

const router = express.Router();

router.use(protect); // Tất cả các route thông báo đều yêu cầu đăng nhập

router.get('/', getMyNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

export default router;
