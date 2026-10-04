import mongoose from 'mongoose';

export const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI chưa được cấu hình trong biến môi trường');
  }
  const conn = await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  });
  console.log(`✅ Product MongoDB: ${conn.connection.host}/${conn.connection.name}`);
};
