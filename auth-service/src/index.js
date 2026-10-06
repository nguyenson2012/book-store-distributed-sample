import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.js';

const PORT = process.env.PORT || 5003;

// Lắng nghe ngay để vượt qua Cloud Run Startup Probe, kết nối DB bất đồng bộ
app.listen(PORT, () => {
  console.log(`🚀 Auth Service running on port ${PORT}`);
});

connectDB();
