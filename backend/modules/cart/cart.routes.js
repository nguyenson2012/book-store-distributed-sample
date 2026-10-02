import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import { getMyCart, addToCart, removeFromCart } from './cart.controller.js';

const router = Router();
router.use(protect);
router.route('/').get(getMyCart).post(addToCart);
router.delete('/:bookId', removeFromCart);
export default router;