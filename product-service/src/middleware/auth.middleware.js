import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';

const AUTH_SERVICE_URL = (process.env.AUTH_SERVICE_URL || 'http://localhost:5003').replace(/\/$/, '');

// Xác thực qua auth-service: GET /api/v1/auth/validate với cùng Bearer token
export const protect = catchAsync(async (req, res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.split(' ')[1] : null;
  if (!token) throw new AppError('Bạn chưa đăng nhập', 401);

  let response;
  try {
    response = await fetch(`${AUTH_SERVICE_URL}/api/v1/auth/validate`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error('❌ Auth service unreachable:', err.message);
    throw new AppError('Dịch vụ xác thực tạm thời không khả dụng', 503);
  }

  if (response.status === 401 || response.status === 403) {
    throw new AppError('Token không hợp lệ hoặc đã hết hạn', 401);
  }
  if (!response.ok) throw new AppError('Dịch vụ xác thực tạm thời không khả dụng', 503);

  const { data } = await response.json();
  req.user = { id: data.user.id, role: data.user.role };
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
