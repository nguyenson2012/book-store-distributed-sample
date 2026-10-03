import mongoose from 'mongoose';

// Schema tối giản để query email + name, không cần toàn bộ user schema
const userSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    role: String,
  },
  { strict: false } // bỏ qua các field không khai báo → an toàn khi dùng chung collection
);

export default mongoose.model('User', userSchema);
