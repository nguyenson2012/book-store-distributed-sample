import User from './user.model.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const getMe = (req, res) => res.json({ status: 'success', data: { user: req.user } });

export const updateMe = catchAsync(async (req, res) => {
  // Chỉ cho phép sửa các field an toàn (không cho đổi role/password ở đây)
  const { name, addresses } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { ...(name && { name }), ...(addresses && { addresses }) },
    { new: true, runValidators: true }
  );
  res.json({ status: 'success', data: { user } });
});

export const getAllUsers = catchAsync(async (req, res) => {
  const users = await User.find();
  res.json({ status: 'success', results: users.length, data: { users } });
});