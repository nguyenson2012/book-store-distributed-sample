import User from '../models/user.model.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import { verifyAccessToken } from '../utils/jwt.js';

// In-memory cache cho user lookup (TTL 60s) để tránh query MongoDB Atlas lặp lại khi validate token
const userMemoryCache = new Map();
const USER_CACHE_TTL = 60 * 1000;

// Xác thực: đọc "Authorization: Bearer <token>", gắn user vào req
export const protect = catchAsync(async (req, res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.split(' ')[1] : null;
  if (!token) throw new AppError('Bạn chưa đăng nhập', 401);

  const { id } = verifyAccessToken(token); // lỗi JWT sẽ được errorHandler xử lý

  // Kiểm tra cache trong RAM trước (thời gian < 0.1ms)
  const cached = userMemoryCache.get(id);
  if (cached && Date.now() < cached.expiresAt) {
    req.user = cached.user;
    return next();
  }

  const user = await User.findById(id);
  if (!user) throw new AppError('Người dùng không còn tồn tại', 401);

  // Lưu vào cache
  if (userMemoryCache.size >= 5000) {
    const oldest = userMemoryCache.keys().next().value;
    if (oldest) userMemoryCache.delete(oldest);
  }
  userMemoryCache.set(id, {
    user,
    expiresAt: Date.now() + USER_CACHE_TTL,
  });

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

// Gọi nội bộ giữa các service (monolith → auth-service) bằng header x-internal-key
export const requireInternalKey = (req, res, next) => {
  const key = req.headers['x-internal-key'];
  if (!process.env.AUTH_INTERNAL_SECRET || key !== process.env.AUTH_INTERNAL_SECRET) {
    return next(new AppError('Unauthorized internal call', 401));
  }
  next();
};
