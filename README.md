# 📚 Bookstore — Fullstack Monolith

Ứng dụng bán sách trực tuyến fullstack được xây dựng theo kiến trúc **monolith module-based**, thiết kế sẵn sàng để tách thành **microservices** trong tương lai. Hệ thống được tự động triển khai lên **Google Cloud Run** qua CI/CD pipeline sử dụng GitHub Actions.

[![CI/CD Pipeline](https://github.com/nguyenson2012/book-store-distributed-sample/actions/workflows/deploy.yml/badge.svg)](https://github.com/nguyenson2012/book-store-distributed-sample/actions/workflows/deploy.yml)

---

## 🏗️ Kiến trúc hệ thống

```
bookstore-monolith/
├── auth-service/          # Microservice: Xác thực, Người dùng, JWT, Email xác nhận (DB: bookstore_auth)
├── product-service/       # Microservice: Catalog sách, Meilisearch, Redis cache (DB: bookstore_products)
├── notification-service/  # Worker: Xử lý email bất đồng bộ qua RabbitMQ
├── backend/               # Core Monolith: Giỏ hàng, Đơn hàng, Thông báo in-app
│   ├── modules/           # cart, orders, notifications
│   ├── middleware/        # Auth guard (xác thực qua auth-service), error handler
│   ├── config/            # Kết nối MongoDB (DB: bookstore)
│   └── utils/             # RabbitMQ, productClient, authClient, AppError
│
├── frontend/              # React 19 + Vite + TailwindCSS 4
│   └── src/
│       ├── pages/         # Home, BookDetail, Cart, Checkout, Auth, VerifyEmail, Admin
│       ├── components/    # Navbar, Footer, BookCard, FlashSaleSection, RouteGuards
│       ├── store/         # Redux Toolkit (auth, cart, notification)
│       ├── services/      # Axios client (api, authApi, catalogApi)
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
| Email | Nodemailer + Resend SMTP (production) / Ethereal (development) |
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
- 📧 **Xác nhận email**: Gửi email xác nhận sau đăng ký — tài khoản chỉ hoạt động sau khi click link (token có hiệu lực 24 giờ)
- 📖 **Duyệt sách**: Xem danh sách, tìm kiếm theo tên/tác giả, lọc theo danh mục và khoảng giá, sắp xếp
- ⚡ **Flash Sale**: Section sản phẩm Flash Sale nổi bật ngay trên trang chủ với đồng hồ đếm ngược; badge `-50%` hiển thị trên mỗi thẻ sách
- 🛒 **Giỏ hàng**: Thêm / xóa / cập nhật số lượng; giá Flash Sale được tính tự động tại thời điểm thêm vào giỏ
- 💳 **Đặt hàng**: Thanh toán, quản lý địa chỉ giao hàng
- 🔔 **Thông báo**: Cập nhật trạng thái đơn hàng theo thời gian thực (polling)
- 👤 **Hồ sơ**: Quản lý thông tin cá nhân, địa chỉ

### Quản trị viên
- 📊 **Dashboard**: Thống kê tổng quan đơn hàng, trạng thái xử lý
- 📚 **Quản lý sách** (nâng cao):
  - Thêm sách mới với đầy đủ thông tin
  - **Cập nhật thông tin sách** qua modal chỉnh sửa trực quan (tiêu đề, tác giả, danh mục, giá, mô tả, tồn kho)
  - **Dán link ảnh bìa sách**: Hỗ trợ paste URL ảnh trực tiếp từ clipboard, xem trước ảnh ngay lập tức, phản hồi trạng thái (hợp lệ / lỗi URL)
  - Tìm kiếm nhanh sách trong danh sách
  - Lọc tab "Đang Flash Sale" để quản lý chiến dịch
  - **Bật / Tắt Flash Sale nhanh** (1 click) — mặc định 24 giờ, giảm 50%
  - **Cấu hình Flash Sale chi tiết**: Chọn thời lượng nhanh (1h, 6h, 12h, 24h, 3 ngày, 7 ngày) hoặc nhập thời điểm kết thúc cụ thể; preview giá Flash Sale (-50%) ngay trên form
- 📦 **Quản lý đơn hàng**: Cập nhật trạng thái xử lý (Pending → Processing → Shipped → Delivered)

### Flash Sale System
- ⚡ Hệ thống Flash Sale hoàn chỉnh từ backend đến frontend:
  - Schema mở rộng `isFlashSale`, `flashSaleStartDate`, `flashSaleEndDate`, `flashSaleDiscount`
  - Virtual `isFlashSaleActive` tự động kiểm tra thời gian hiệu lực
  - Virtual `finalPrice` ưu tiên giá Flash Sale (-50%) nếu đang trong kỳ sale
  - Giá Flash Sale được tính và chốt tại backend khi thêm vào giỏ — không tin giá từ client
  - Đồng hồ đếm ngược realtime trên trang chủ và trang chi tiết sách
  - Flash Sale tự động hết hiệu lực sau thời gian đã cài đặt (không cần tác động thủ công)
  - Bộ lọc `?flashSale=true` trên trang danh sách sách

### Bảo mật
- HttpOnly Cookie cho Refresh Token (chống XSS)
- `sameSite: 'none'` + HTTPS trong production (cross-domain an toàn)
- Rate limiting trên các route xác thực
- Role-based access control (customer / admin)
- Helmet HTTP headers hardening
- Email verify token được hash SHA-256 trước khi lưu DB (chống lộ token)
- **Giá sản phẩm luôn lấy từ DB** tại thời điểm đặt hàng (chống gian lận giá từ phía client)

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

# Email — để trống để dùng Ethereal (test) trong dev
# Xem log console để lấy link preview email khi đăng ký
EMAIL_HOST=
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=
EMAIL_PASS=
EMAIL_FROM=noreply@bookstore.dev
```

> **Lưu ý khi dev**: Khi `EMAIL_HOST` để trống, backend tự tạo [Ethereal](https://ethereal.email) account và in preview URL vào console:
> ```
> 📧 Email preview URL: https://ethereal.email/message/xxxxx
> ```
> Mở URL đó để xem email và lấy link xác nhận.

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
| `EMAIL_HOST` | SMTP host (vd: `smtp.resend.com`) |
| `EMAIL_PORT` | SMTP port (vd: `587`) |
| `EMAIL_SECURE` | `false` cho TLS thường, `true` cho SSL |
| `EMAIL_USER` | SMTP username (vd: `resend`) |
| `EMAIL_PASS` | SMTP password / API Key |
| `EMAIL_FROM` | Địa chỉ gửi email (vd: `noreply@yourdomain.com`) |

> **Dịch vụ email miễn phí khuyến nghị cho production**: [Resend](https://resend.com) — 3,000 email/tháng, không cần credit card.
> ```
> EMAIL_HOST=smtp.resend.com
> EMAIL_PORT=587
> EMAIL_SECURE=false
> EMAIL_USER=resend
> EMAIL_PASS=re_xxxxxxxxxxxxxxxxxxxx   ← API Key từ resend.com
> EMAIL_FROM=onboarding@resend.dev      ← hoặc noreply@yourdomain.com sau khi verify domain
> ```

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

- **Backend Monolith**: `http://localhost:5001/api/v1` (Cart, Orders, Notifications)
- **Auth Service**: `http://localhost:5003/api/v1` (Register, Login, Refresh, Me, Validate)
- **Product Service**: `http://localhost:5002/api/v1` (Books, Search, Stock)

### Auth (`auth-service`)
| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| `POST` | `/auth/register` | Đăng ký — gửi email xác nhận | ❌ |
| `POST` | `/auth/login` | Đăng nhập (yêu cầu email đã xác nhận) | ❌ |
| `POST` | `/auth/refresh` | Gia hạn Access Token | Cookie |
| `POST` | `/auth/logout` | Đăng xuất | Cookie |
| `GET` | `/auth/verify-email?token=` | Xác nhận email từ link | ❌ |
| `GET` | `/auth/me` | Lấy thông tin user hiện tại | 🔒 Bearer |
| `PATCH`| `/auth/me` | Cập nhật thông tin profile/địa chỉ | 🔒 Bearer |
| `GET` | `/auth/validate` | Xác thực token (dành cho các service khác) | 🔒 Bearer |
| `GET` | `/auth/users` | Danh sách người dùng | 🔒 Admin |

### Books
| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| `GET` | `/books` | Danh sách sách (phân trang, tìm kiếm, lọc, `?flashSale=true`) | ❌ |
| `GET` | `/books/flash-sale` | Danh sách sách đang Flash Sale | ❌ |
| `GET` | `/books/:id` | Chi tiết sách | ❌ |
| `POST` | `/books` | Thêm sách mới | 🔒 Admin |
| `PATCH` | `/books/:id` | Cập nhật thông tin sách (bao gồm ảnh bìa, Flash Sale) | 🔒 Admin |
| `PUT` | `/books/:id` | Cập nhật sách (full replace) | 🔒 Admin |
| `PATCH` | `/books/:id/flash-sale` | Bật / tắt Flash Sale cho sách | 🔒 Admin |
| `DELETE` | `/books/:id` | Xóa sách | 🔒 Admin |

#### Query params cho `GET /books`
| Param | Kiểu | Mô tả |
|---|---|---|
| `search` | string | Tìm theo tên hoặc tác giả |
| `category` | string | Lọc theo danh mục |
| `minPrice` / `maxPrice` | number | Khoảng giá |
| `sort` | string | Sắp xếp (vd: `-price`, `title`, `-createdAt`) |
| `page` / `limit` | number | Phân trang (limit tối đa 50) |
| `flashSale` | `true` | Chỉ trả về sách đang trong kỳ Flash Sale |

#### Body cho `PATCH /books/:id/flash-sale`
```json
{
  "isFlashSale": true,
  "discountPercent": 50,
  "durationHours": 24,
  "endDate": "2026-10-05T00:00:00Z"
}
```

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
