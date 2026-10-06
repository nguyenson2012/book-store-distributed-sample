import { Router } from 'express';
import { requireInternalKey } from '../middleware/auth.middleware.js';
import { listInternal, batchInternal } from '../controllers/internal.controller.js';

const router = Router();
router.use(requireInternalKey);
router.get('/users', listInternal);
router.post('/users/batch', batchInternal);
export default router;
