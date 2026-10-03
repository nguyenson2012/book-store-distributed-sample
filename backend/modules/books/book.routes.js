import { Router } from 'express';
import { protect, restrictTo } from '../../middleware/auth.middleware.js';
import {
  getAllBooks,
  getFlashSaleBooks,
  getBook,
  createBook,
  updateBook,
  toggleFlashSale,
  deleteBook,
} from './book.controller.js';

const router = Router();

router.get('/flash-sale', getFlashSaleBooks);
router.get('/', getAllBooks);
router.get('/:id', getBook);

// Chỉ admin mới được thay đổi dữ liệu sách
router.use(protect, restrictTo('admin'));
router.post('/', createBook);
router.patch('/:id/flash-sale', toggleFlashSale);
router.route('/:id').patch(updateBook).put(updateBook).delete(deleteBook);

export default router;