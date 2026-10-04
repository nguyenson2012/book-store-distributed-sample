import catchAsync from '../../utils/catchAsync.js';
import * as authService from './auth.service.js';

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

export const logout = (req, res) => {
  res.clearCookie('refreshToken', { ...cookieOptions, maxAge: 0 });
  res.json({ status: 'success', message: 'Đã đăng xuất' });
};