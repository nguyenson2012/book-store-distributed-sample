import User from '../users/user.model.js';
import AppError from '../../utils/AppError.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';

export const registerUser = async ({ name, email, password }) => {
  // Cố tình KHÔNG nhận role từ client để tránh tự phong admin
  return User.create({ name, email, password });
};

export const authenticate = async (email, password) => {
  if (!email || !password) throw new AppError('Vui lòng nhập email và mật khẩu', 400);
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Email hoặc mật khẩu không đúng', 401);
  }
  return user;
};

export const issueTokens = (userId) => ({
  accessToken: signAccessToken(userId),
  refreshToken: signRefreshToken(userId),
});

export const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) throw new AppError('Chưa đăng nhập', 401);
  const { id } = verifyRefreshToken(refreshToken);
  const user = await User.findById(id);
  if (!user) throw new AppError('Người dùng không còn tồn tại', 401);
  return signAccessToken(user.id);
};