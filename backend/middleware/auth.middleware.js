import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import { validateToken } from '../utils/authClient.js';

// Xác thực: đọc "Authorization: Bearer <token>", hỏi Auth Service qua /validate, gắn user vào req
export const protect = catchAsync(async (req, res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.split(' ')[1] : null;
  if (!token) throw new AppError('Bạn chưa đăng nhập', 401);

  const u = await validateToken(token);
  // giữ cả id và _id vì code dùng cả hai (req.user.id / user._id)
  req.user = { id: u.id, _id: u.id, role: u.role, name: u.name, email: u.email };
  next();
});

// Phân quyền: restrictTo('admin') hoặc restrictTo('admin', 'customer')
export const restrictTo =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Bạn không có quyền thực hiện hành động này', 403));
    }
    next();
  };