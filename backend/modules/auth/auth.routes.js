import { Router } from 'express';
import { register, login, refresh, logout, verifyEmail } from './auth.controller.js';

const router = Router();
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/verify-email', verifyEmail);
export default router;