import User from '../users/user.model.js';
import AppError from '../../utils/AppError.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import { sendVerificationEmail } from '../../utils/email.js';
import crypto from 'crypto';

export const registerUser = async ({ name, email, password }, clientUrl) => {
  // Cố tình KHÔNG nhận role từ client để tránh tự phong admin
  const user = await User.create({ name, email, password });

  // Tạo token xác nhận và gửi email
  const rawToken = user.createEmailVerifyToken();
  await user.save({ validateBeforeSave: false });

  const verifyUrl = `${clientUrl}/verify-email?token=${rawToken}`;
  await sendVerificationEmail(email, verifyUrl);

  return user;
};

export const authenticate = async (email, password) => {
  if (!email || !password) throw new AppError('Vui lòng nhập email và mật khẩu', 400);
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Email hoặc mật khẩu không đúng', 401);
  }
  if (!user.emailVerified) {
    throw new AppError('Vui lòng xác nhận email trước khi đăng nhập. Kiểm tra hộp thư của bạn.', 403);
  }
  return user;
};

export const verifyEmail = async (rawToken) => {
  const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');
  const user = await User.findOne({
    emailVerifyToken: hashed,
    emailVerifyExpires: { $gt: Date.now() },
  }).select('+emailVerifyToken +emailVerifyExpires');

  if (!user) throw new AppError('Token xác nhận không hợp lệ hoặc đã hết hạn', 400);

  user.emailVerified = true;
  user.emailVerifyToken = undefined;
  user.emailVerifyExpires = undefined;
  await user.save({ validateBeforeSave: false });
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