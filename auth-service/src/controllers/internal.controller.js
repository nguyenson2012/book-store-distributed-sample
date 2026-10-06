import User from '../models/user.model.js';
import catchAsync from '../utils/catchAsync.js';

const pick = (u) => ({ id: u._id, _id: u._id, name: u.name, email: u.email, role: u.role });

// GET /internal/v1/users?role=admin — dùng cho monolith gửi thông báo cho admin
export const listInternal = catchAsync(async (req, res) => {
  const filter = req.query.role ? { role: req.query.role } : {};
  const users = await User.find(filter).select('_id name email role');
  res.json({ status: 'success', data: { users: users.map(pick) } });
});

// POST /internal/v1/users/batch { ids: [...] } — thay cho populate('userId')
export const batchInternal = catchAsync(async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.slice(0, 500) : [];
  const users = ids.length ? await User.find({ _id: { $in: ids } }).select('_id name email role') : [];
  res.json({ status: 'success', data: { users: users.map(pick) } });
});
