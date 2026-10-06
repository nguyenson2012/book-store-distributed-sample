import AppError from './AppError.js';

// Client gọi Auth Service (nguồn duy nhất của dữ liệu user). Bắt buộc có AUTH_SERVICE_URL.
const base = () => {
  const url = process.env.AUTH_SERVICE_URL?.replace(/\/$/, '');
  if (!url) throw new AppError('Thiếu cấu hình AUTH_SERVICE_URL', 500);
  return url;
};
const internalKey = () => process.env.AUTH_INTERNAL_SECRET;

const unavailable = () => new AppError('Dịch vụ xác thực tạm thời không khả dụng', 503);

/** Xác thực Bearer token qua GET /api/v1/auth/validate → { id, role, email, name } */
export const validateToken = async (token) => {
  let res;
  try {
    res = await fetch(`${base()}/api/v1/auth/validate`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    console.error('❌ Auth service unreachable:', err.message);
    throw unavailable();
  }
  if (res.status === 401 || res.status === 403) {
    throw new AppError('Token không hợp lệ hoặc đã hết hạn', 401);
  }
  if (!res.ok) throw unavailable();
  const { data } = await res.json();
  return data.user;
};

const internalCall = async (path, { method = 'GET', body } = {}) => {
  if (!internalKey()) throw new AppError('Thiếu AUTH_INTERNAL_SECRET', 500);
  let res;
  try {
    res = await fetch(`${base()}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-internal-key': internalKey() },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    console.error('❌ Auth service unreachable:', err.message);
    throw unavailable();
  }
  if (!res.ok) throw new AppError('Lỗi Auth Service', res.status === 401 ? 500 : 503);
  return (await res.json()).data;
};

/** Danh sách user theo role (vd: 'admin') */
export const getUsersByRole = async (role) =>
  (await internalCall(`/internal/v1/users?role=${encodeURIComponent(role)}`)).users;

/** Lấy nhiều user theo id (thay cho populate) */
export const getUsersByIds = async (ids) => {
  const unique = [...new Set(ids.map(String))];
  if (!unique.length) return [];
  return (await internalCall('/internal/v1/users/batch', { method: 'POST', body: { ids: unique } })).users;
};
