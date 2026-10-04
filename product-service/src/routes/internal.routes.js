import { Router } from 'express';
import { requireInternalKey } from '../middleware/auth.middleware.js';
import {
  getBookInternal,
  getBooksInternal,
  reserveStock,
  restoreStock,
} from '../controllers/book.controller.js';

const router = Router();
router.use(requireInternalKey);

router.get('/books', getBooksInternal);
router.get('/books/:id', getBookInternal);
router.post('/stock/reserve', reserveStock);
router.post('/stock/restore', restoreStock);

export default router;
