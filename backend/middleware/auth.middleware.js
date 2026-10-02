import User from '../modules/users/user.model.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import { verifyAccessToken } from '../utils/jwt.js';

// Xác thực: đọc "Authorization: Bearer <token>", gắn user vào req
export const protect = catchAsync(async (req, res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.split(' ')[1] : null;
  if (!token) throw new AppError('Bạn chưa đăng nhập', 401);

  const { id } = verifyAccessToken(token); // lỗi JWT sẽ được errorHandler xử lý
  const user = await User.findById(id);
  if (!user) throw new AppError('Người dùng không còn tồn tại', 401);

  req.user = user;
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