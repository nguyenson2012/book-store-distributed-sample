import { Router } from 'express';
import { protect, restrictTo } from '../../middleware/auth.middleware.js';
import { getAllBooks, getBook, createBook, updateBook, deleteBook } from './book.controller.js';

const router = Router();

router.get('/', getAllBooks);
router.get('/:id', getBook);

// Chỉ admin mới được thay đổi dữ liệu sách
router.use(protect, restrictTo('admin'));
router.post('/', createBook);
router.route('/:id').patch(updateBook).delete(deleteBook);

export default router;