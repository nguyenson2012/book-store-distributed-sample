# Auth Service

Microservice xác thực, tách ra từ monolith (`backend/modules/auth`).

## Endpoint (`/api/v1/auth`)

| Method | Path | Mô tả |
|---|---|---|
| POST | `/register` | Đăng ký, gửi email xác nhận |
| GET | `/verify-email?token=` | Xác nhận email, đăng nhập luôn |
| POST | `/login` | Trả `accessToken` + cookie `refreshToken` |
| POST | `/refresh` | Cấp lại `accessToken` từ cookie |
| POST | `/logout` | Xoá cookie |
| GET | `/me` | Thông tin user hiện tại (Bearer) |
| GET | `/validate` | Dành cho service khác: `{ valid, data: { user: { id, role, email } } }` (Bearer) |
| GET | `/health` (gốc) | Health check |

## Chạy local

```bash
cp sample.env .env   # điền MONGO_URI, JWT_*
npm install
npm run dev          # http://localhost:5003
```

Hoặc `docker compose up --build auth-service` ở thư mục gốc (cổng `5003`).

## Tích hợp

- **product-service**: đặt `AUTH_SERVICE_URL`; middleware `protect` gọi `/validate`.
- **frontend**: đặt `VITE_AUTH_API_URL=<auth-url>/api/v1`.
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` phải giống monolith để token hai bên tương thích.
- Auth-service dùng DB riêng `bookstore_auth` (cùng cluster Atlas với monolith). Secret GitHub: `AUTH_MONGO_URI`.

## Migrate users từ monolith

```bash
# .env của auth-service: MONGO_URI=.../bookstore_auth  và  MONOLITH_MONGO_URI=.../bookstore
npm run migrate -- --dry-run   # chỉ đếm
npm run migrate                # copy thật (upsert theo _id, giữ nguyên hash mật khẩu, chạy lại an toàn)
```

> Sau khi tách DB, user đăng ký mới chỉ nằm ở `bookstore_auth`. Các route còn lại của monolith (`protect` → `User.findById`, `/users/me`, orders...) vẫn đọc `bookstore.users` nên sẽ không thấy user mới cho tới khi monolith được chuyển sang xác thực qua `/validate`.
