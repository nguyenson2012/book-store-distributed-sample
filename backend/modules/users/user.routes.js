import { Router } from 'express';
import { protect, restrictTo } from '../../middleware/auth.middleware.js';
import { getMe, updateMe, getAllUsers } from './user.controller.js';

const router = Router();
router.use(protect);
router.route('/me').get(getMe).patch(updateMe);
router.get('/', restrictTo('admin'), getAllUsers);
export default router;