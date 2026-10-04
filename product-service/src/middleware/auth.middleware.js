import jwt from 'jsonwebtoken';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';

export const protect = catchAsync(async (req, res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.split(' ')[1] : null;
  if (!token) throw new AppError('Bạn chưa đăng nhập', 401);

  const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  req.user = { id: payload.id, role: payload.role };
  next();
});

export const restrictTo =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return next(new AppError('Bạn không có quyền thực hiện hành động này', 403));
    }
    next();
  };

export const requireInternalKey = catchAsync(async (req, res, next) => {
  const key = req.headers['x-internal-key'];
  if (!process.env.PRODUCT_INTERNAL_SECRET || key !== process.env.PRODUCT_INTERNAL_SECRET) {
    throw new AppError('Unauthorized internal call', 401);
  }
  next();
});
