import catchAsync from '../utils/catchAsync.js';
import User from '../models/user.model.js';
import * as authService from '../services/auth.service.js';

// Refresh token nằm trong HttpOnly cookie => JS phía client không đọc được (chống XSS)
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/v1/auth',
};

const sendAuth = (user, statusCode, res) => {
  const { accessToken, refreshToken } = authService.issueTokens(user);
  res.cookie('refreshToken', refreshToken, cookieOptions);
  user.password = undefined;
  res.status(statusCode).json({ status: 'success', accessToken, data: { user } });
};

export const register = catchAsync(async (req, res) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  await authService.registerUser(req.body, clientUrl);
  res.status(201).json({
    status: 'success',
    message: 'Tài khoản đã được tạo! Vui lòng kiểm tra email để xác nhận tài khoản.',
  });
});

export const verifyEmail = catchAsync(async (req, res) => {
  const { token } = req.query;
  const user = await authService.verifyEmail(token);
  sendAuth(user, 200, res);
});

export const login = catchAsync(async (req, res) => {
  const user = await authService.authenticate(req.body.email, req.body.password);
  sendAuth(user, 200, res);
});

export const refresh = catchAsync(async (req, res) => {
  const accessToken = await authService.refreshAccessToken(req.cookies.refreshToken);
  res.json({ status: 'success', accessToken });
});

// Thông tin user hiện tại (đã qua middleware protect)
export const me = (req, res) => {
  res.json({ status: 'success', data: { user: req.user } });
};

// Dành cho service khác: kiểm tra token + trả về danh tính tối thiểu
export const validate = (req, res) => {
  const { _id, role, email, name } = req.user;
  res.json({ status: 'success', valid: true, data: { user: { id: _id, role, email, name } } });
};

// Cập nhật hồ sơ (chỉ các field an toàn, không cho đổi role/password)
export const updateMe = catchAsync(async (req, res) => {
  const { name, addresses } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { ...(name && { name }), ...(addresses && { addresses }) },
    { new: true, runValidators: true }
  );
  res.json({ status: 'success', data: { user } });
});

// Admin: danh sách user
export const listUsers = catchAsync(async (req, res) => {
  const users = await User.find();
  res.json({ status: 'success', results: users.length, data: { users } });
});

export const logout = (req, res) => {
  res.clearCookie('refreshToken', { ...cookieOptions, maxAge: 0 });
  res.json({ status: 'success', message: 'Đã đăng xuất' });
};