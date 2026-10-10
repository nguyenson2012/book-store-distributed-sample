# Auth Service

Microservice xác thực và quản lý tài khoản người dùng, được tách độc lập từ Monolith sang cơ sở dữ liệu riêng `bookstore_auth`.

---

## 📡 Danh sách Endpoints

### 1. Public & User APIs (`/api/v1/auth`)

| Phương thức | Đường dẫn | Chức năng | Phân quyền |
|---|---|---|---|
| `POST` | `/register` | Đăng ký tài khoản, gửi email xác nhận | Public |
| `GET` | `/verify-email?token=` | Kích hoạt tài khoản từ email | Public |
| `POST` | `/login` | Đăng nhập, trả `accessToken` + cookie `refreshToken` | Public |
| `POST` | `/refresh` | Cấp lại `accessToken` từ HttpOnly cookie | Cookie |
| `POST` | `/logout` | Xoá refresh token cookie | Public |
| `GET` | `/me` | Xem thông tin người dùng hiện tại | 🔒 Bearer |
| `PATCH` | `/me` | Cập nhật hồ sơ / địa chỉ giao hàng | 🔒 Bearer |
| `GET` | `/validate` | Endpoint dành cho service khác xác thực token (`{ valid, data: { user } }`) | 🔒 Bearer |
| `GET` | `/users` | Danh sách người dùng | 🔒 Admin |
| `GET` | `/health` | Health check endpoint | Public |

### 2. Internal APIs (`/internal/v1/users`)
*Yêu cầu header `x-internal-key: <AUTH_INTERNAL_SECRET>`*

| Phương thức | Đường dẫn | Chức năng |
|---|---|---|
| `GET` | `/:id` | Lấy thông tin cơ bản của user theo ID (tên, email, role, phone, address) |
| `POST` | `/batch` | Lấy danh sách nhiều user theo mảng IDs (`{"userIds": ["id1", "id2"]}`) |

---

## 🚀 Chạy local (Local Development)

```bash
cd auth-service
cp sample.env .env   # Điền MONGO_URI, JWT_*, EMAIL_*
npm install
npm run dev          # http://localhost:5003
```

Hoặc khởi chạy qua Docker Compose ở thư mục gốc:
```bash
docker compose up --build auth-service
```

---

## 🔗 Tích hợp hệ thống (System Integration)

- **backend (Monolith Core):** Đặt `AUTH_SERVICE_URL=http://localhost:5003` và `AUTH_INTERNAL_SECRET`. Middleware `auth.middleware.js` gọi `/api/v1/auth/validate` để xác thực token và tra cứu user qua `/internal/v1/users`.
- **product-service:** Đặt `AUTH_SERVICE_URL=http://localhost:5003`. Middleware gọi `/validate` để kiểm tra quyền Admin khi CRUD sách.
- **frontend:** Đặt `VITE_AUTH_API_URL=<auth-url>/api/v1` để trực tiếp gọi xác thực tới Auth Service.
- **Database:** Sử dụng DB riêng `bookstore_auth` (cùng MongoDB cluster Atlas).

---

## 📦 Di chuyển dữ liệu từ Monolith (Migration)

```bash
# Trong file .env của auth-service cần có cả 2 URI:
# MONGO_URI=.../bookstore_auth
# MONOLITH_MONGO_URI=.../bookstore

npm run migrate -- --dry-run   # Chế độ kiểm tra (chỉ đếm số lượng user)
npm run migrate                # Thực hiện copy (upsert theo _id, giữ nguyên password hash)
```
