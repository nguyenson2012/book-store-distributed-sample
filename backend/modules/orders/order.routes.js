import { Router } from 'express';
import { protect, restrictTo } from '../../middleware/auth.middleware.js';
import {
  createOrder, getMyOrders, getAllOrders, updateOrderStatus, cancelMyOrder,
} from './order.controller.js';

const router = Router();
router.use(protect);

router.post('/', createOrder);
router.get('/my', getMyOrders);
router.patch('/:id/cancel', cancelMyOrder);

router.get('/', restrictTo('admin'), getAllOrders);
router.patch('/:id/status', restrictTo('admin'), updateOrderStatus);

export default router;