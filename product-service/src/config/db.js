import mongoose from 'mongoose';

export const connectDB = async (retries = 3, delay = 2000) => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI chưa được cấu hình trong biến môi trường');
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const conn = await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 30000,
      });
      console.log(`✅ Product MongoDB: ${conn.connection.host}/${conn.connection.name}`);
      return conn;
    } catch (err) {
      console.error(`❌ Lỗi kết nối MongoDB (lần thử ${attempt}/${retries}):`, err.message);
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw err;
      }
    }
  }
};
