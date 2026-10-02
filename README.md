# 📚 Bookstore — Fullstack Monolith

Ứng dụng bán sách trực tuyến fullstack được xây dựng theo kiến trúc **monolith module-based**, thiết kế sẵn sàng để tách thành **microservices** trong tương lai. Hệ thống được tự động triển khai lên **Google Cloud Run** qua CI/CD pipeline sử dụng GitHub Actions.

[![CI/CD Pipeline](https://github.com/nguyenson2012/book-store-distributed-sample/actions/workflows/deploy.yml/badge.svg)](https://github.com/nguyenson2012/book-store-distributed-sample/actions/workflows/deploy.yml)

---

## 🏗️ Kiến trúc hệ thống

```
bookstore-monolith/
├── backend/               # Node.js + Express API Server
│   ├── modules/           # Domain modules (sẵn sàng tách microservice)
│   │   ├── auth/          # Xác thực — JWT, Refresh Token
│   │   ├── users/         # Người dùng, địa chỉ giao hàng
│   │   ├── books/         # Quản lý sách, tìm kiếm
│   │   ├── cart/          # Giỏ hàng
│   │   ├── orders/        # Đơn hàng, xử lý thanh toán
│   │   ├── notifications/ # Thông báo người dùng
│   │   └── reviews/       # Đánh giá sách
│   ├── middleware/        # Auth guard, error handler
│   ├── config/            # Kết nối MongoDB
│   └── utils/             # JWT helper, AppError, catchAsync
│
├── frontend/              # React 19 + Vite + TailwindCSS 4
│   └── src/
│       ├── pages/         # Home, BookDetail, Cart, Checkout, Auth, Admin
│       ├── components/    # Navbar, Footer, BookCard, RouteGuards
│       ├── store/         # Redux Toolkit (auth, cart, notification)
│       ├── services/      # Axios instance + interceptors
│       └── utils/
│
└── .github/workflows/     # CI/CD tự động lên Google Cloud Run
```

---

## 🛠️ Tech Stack

### Backend
| Thành phần | Công nghệ |
|---|---|
| Runtime | Node.js 20 (ES Modules) |
| Framework | Express 5 |
| Database | MongoDB Atlas (Mongoose 9) |
| Auth | JWT Access Token + Refresh Token (HttpOnly Cookie) |
| Security | Helmet, CORS, express-rate-limit, bcryptjs |
| Logging | Morgan |

### Frontend
| Thành phần | Công nghệ |
|---|---|
| UI Framework | React 19 |
| Build Tool | Vite 8 |
| State Management | Redux Toolkit |
| HTTP Client | Axios (với interceptor tự động refresh token) |
| Routing | React Router DOM 7 |
| Styling | TailwindCSS 4 |

### DevOps & Infrastructure
| Thành phần | Công nghệ |
|---|---|
| CI/CD | GitHub Actions |
| Container Registry | Google Artifact Registry |
| Hosting | Google Cloud Run (Free Tier) |
| Database Hosting | MongoDB Atlas (Free Tier) |
| Container | Docker (multi-stage build) |

---

## ✨ Tính năng

### Khách hàng
- 🔐 **Xác thực**: Đăng ký / Đăng nhập với JWT Access Token + Refresh Token tự động gia hạn
- 📖 **Duyệt sách**: Xem danh sách, tìm kiếm, xem chi tiết sách
- 🛒 **Giỏ hàng**: Thêm / xóa / cập nhật số lượng
- 💳 **Đặt hàng**: Thanh toán, quản lý địa chỉ giao hàng
- 🔔 **Thông báo**: Cập nhật trạng thái đơn hàng theo thời gian thực (polling)
- 👤 **Hồ sơ**: Quản lý thông tin cá nhân, địa chỉ

### Quản trị viên
- 📊 **Dashboard**: Thống kê tổng quan doanh thu, đơn hàng
- 📚 **Quản lý sách**: Thêm / sửa / xóa sản phẩm
- 📦 **Quản lý đơn hàng**: Cập nhật trạng thái xử lý

### Bảo mật
- HttpOnly Cookie cho Refresh Token (chống XSS)
- `sameSite: 'none'` + HTTPS trong production (cross-domain an toàn)
- Rate limiting trên các route xác thực
- Role-based access control (customer / admin)
- Helmet HTTP headers hardening

---

## 🚀 Chạy dự án cục bộ (Local Development)

### Yêu cầu
- Node.js >= 20
- Tài khoản [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (Free Tier)

### 1. Clone repository
```bash
git clone https://github.com/nguyenson2012/book-store-distributed-sample.git
cd book-store-distributed-sample
```

### 2. Cài đặt Backend
```bash
cd backend
npm install
```

Tạo file `.env` (dựa trên `sample.env`):
```bash
cp sample.env .env
```

Chỉnh sửa `.env`:
```env
NODE_ENV=development
PORT=5001
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxx.mongodb.net/bookstore
CLIENT_URL=http://localhost:5173

JWT_ACCESS_SECRET=<chuỗi_bí_mật_dài_ngẫu_nhiên>
JWT_REFRESH_SECRET=<chuỗi_bí_mật_khác>
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
```

Khởi tạo dữ liệu mẫu (tùy chọn):
```bash
npm run seed
```

Chạy server:
```bash
npm run dev       # Chạy với nodemon (hot-reload)
# → http://localhost:5001
```

### 3. Cài đặt Frontend
```bash
# Mở terminal mới
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## 🌐 CI/CD & Triển khai lên Google Cloud Run

Mỗi lần push code lên nhánh `main`, GitHub Actions sẽ tự động:

1. **Test**: Kiểm tra build Frontend + xác thực Backend dependencies.
2. **Deploy Backend**: Build Docker image → Push lên Artifact Registry → Deploy lên Cloud Run.
3. **Deploy Frontend**: Build Vite (với URL Backend tự động) → Push → Deploy Cloud Run → Cập nhật CORS.

### Sơ đồ pipeline

```
Push to main
    │
    ▼
[test] Build check
    │
    ▼
[deploy-backend] ──► Docker Build ──► Artifact Registry ──► Cloud Run
    │                                                          │
    │                                               backend_url (output)
    ▼
[deploy-frontend] ──► Docker Build (VITE_API_URL inject) ──► Cloud Run
                                                                │
                                              Update CLIENT_URL CORS on Backend
```

### Thiết lập GitHub Secrets

Vào **Settings → Secrets and variables → Actions** của repository và thêm:

| Secret | Mô tả |
|---|---|
| `GCP_PROJECT_ID` | Google Cloud Project ID |
| `GCP_SA_KEY` | Nội dung JSON của Service Account Key |
| `MONGO_URI` | Chuỗi kết nối MongoDB Atlas |
| `JWT_ACCESS_SECRET` | Secret cho Access Token |
| `JWT_REFRESH_SECRET` | Secret cho Refresh Token |

### Cấu hình tối ưu Free Tier

| Thông số | Backend | Frontend |
|---|---|---|
| Min instances | 0 (scale to zero) | 0 (scale to zero) |
| Max instances | 2 | 2 |
| Memory | 512Mi | 256Mi |
| Region | us-central1 | us-central1 |

> **Free Tier của Cloud Run**: 2 triệu request/tháng miễn phí. Scale về 0 khi không có traffic → chi phí = $0 khi hệ thống nhàn rỗi.

---

## 📡 API Endpoints

Base URL: `http://localhost:5001/api/v1` (Local) hoặc URL Cloud Run của bạn.

### Auth
| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| `POST` | `/auth/register` | Đăng ký tài khoản | ❌ |
| `POST` | `/auth/login` | Đăng nhập | ❌ |
| `POST` | `/auth/refresh` | Gia hạn Access Token | Cookie |
| `POST` | `/auth/logout` | Đăng xuất | Cookie |

### Books
| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| `GET` | `/books` | Danh sách sách (có phân trang, tìm kiếm) | ❌ |
| `GET` | `/books/:id` | Chi tiết sách | ❌ |
| `POST` | `/books` | Thêm sách mới | 🔒 Admin |
| `PUT` | `/books/:id` | Cập nhật sách | 🔒 Admin |
| `DELETE` | `/books/:id` | Xóa sách | 🔒 Admin |

### Cart
| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| `GET` | `/cart` | Xem giỏ hàng | 🔒 User |
| `POST` | `/cart` | Thêm vào giỏ | 🔒 User |
| `PUT` | `/cart/:itemId` | Cập nhật số lượng | 🔒 User |
| `DELETE` | `/cart/:itemId` | Xóa sản phẩm | 🔒 User |

### Orders
| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| `POST` | `/orders` | Tạo đơn hàng | 🔒 User |
| `GET` | `/orders/my` | Đơn hàng của tôi | 🔒 User |
| `GET` | `/orders` | Tất cả đơn hàng | 🔒 Admin |
| `PATCH` | `/orders/:id/status` | Cập nhật trạng thái | 🔒 Admin |

---

## 🔧 Scripts

### Backend
```bash
npm run dev          # Chạy development (nodemon)
npm run start        # Chạy production
npm run seed         # Nhập dữ liệu mẫu
npm run seed:destroy # Xóa toàn bộ dữ liệu mẫu
```

### Frontend
```bash
npm run dev          # Chạy development server
npm run build        # Build production
npm run preview      # Preview bản build
npm run lint         # Kiểm tra lỗi ESLint
```

---

## 📄 License

MIT © 2026 — [nguyenson2012](https://github.com/nguyenson2012)
