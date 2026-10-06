import { Router } from 'express';
import {
  register, login, refresh, logout, verifyEmail, me, validate, updateMe, listUsers,
} from '../controllers/auth.controller.js';
import { protect, restrictTo } from '../middleware/auth.middleware.js';

const router = Router();
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/verify-email', verifyEmail);
router.get('/me', protect, me);
router.patch('/me', protect, updateMe);
router.get('/validate', protect, validate);
router.get('/users', protect, restrictTo('admin'), listUsers);
export default router;