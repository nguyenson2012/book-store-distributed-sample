import mongoose from 'mongoose';

export const connectDB = async () => {
  const conn = await mongoose.connect(process.env.MONGO_URI);
  console.log(`✅ Product MongoDB: ${conn.connection.host}/${conn.connection.name}`);
};
