# 📚 Bookstore — Distributed Microservices Architecture

Hệ thống bán sách trực tuyến fullstack được phát triển và chuyển đổi từ **Monolith** sang kiến trúc **Distributed Microservices** (Database-per-Service), sẵn sàng mở rộng quy mô và được triển khai tự động lên **Google Cloud Run (Free Tier)** qua CI/CD pipeline GitHub Actions.

[![CI/CD Pipeline](https://github.com/nguyenson2012/book-store-distributed-sample/actions/workflows/deploy.yml/badge.svg)](https://github.com/nguyenson2012/book-store-distributed-sample/actions/workflows/deploy.yml)

---

## 🏗️ Kiến trúc tổng thể (System Architecture)

```mermaid
flowchart TD
    subgraph Clients["Clients"]
        FE["Frontend (React 19 / Vite :5173)"]
        ADMIN["Admin Dashboard"]
    end

    subgraph Microservices["Microservices & Core Backend"]
        AUTH["Auth Service (:5003)\n- Đăng ký / Đăng nhập / Profile\n- JWT Access & HttpOnly Refresh\n- Token Validation API"]
        PRODUCT["Product Service (:5002)\n- Catalog sách, Flash Sale\n- Full-Text Search tiếng Việt\n- Upstash Redis Caching\n- Quản lý kho nguyên tử"]
        CORE["Backend Core Monolith (:5001)\n- Giỏ hàng (Cart)\n- Đơn hàng (Orders)\n- Thông báo in-app"]
        NOTIF["Notification Service (Worker)\n- Xử lý gửi email qua Queue"]
    end

    subgraph Broker["Message Broker"]
        RABBIT[("RabbitMQ / CloudAMQP\n(Events: order.placed, order.delivered)")]
    end

    subgraph Storage["Databases & Search / Cache"]
        DB_AUTH[("MongoDB Atlas\n(DB: bookstore_auth)")]
        DB_PROD[("MongoDB Atlas\n(DB: bookstore_products)")]
        DB_CORE[("MongoDB Atlas\n(DB: bookstore)")]
        MEILI[("Meilisearch Search Engine\n(GCP VM e2-micro :7700)")]
        REDIS[("Upstash Redis Cache\n(TLS Serverless)")]
    end

    FE -->|Auth & User Profile| AUTH
    FE -->|Browse / Search Books| PRODUCT
    FE -->|Cart & Orders| CORE
    ADMIN -->|CRUD Books| PRODUCT

    AUTH --- DB_AUTH
    PRODUCT --- DB_PROD
    PRODUCT <--> MEILI
    PRODUCT <--> REDIS
    CORE --- DB_CORE

    CORE -->|1. Validate JWT Bearer| AUTH
    PRODUCT -->|2. Validate Admin JWT| AUTH
    CORE -->|3. Reserve/Restore Stock (x-internal-key)| PRODUCT
    CORE -->|4. Publish Order Events| RABBIT
    RABBIT -->|5. Consume Events & Send Email| NOTIF
```

---

## 🧩 Danh sách các Dịch vụ (Services Overview)

| Dịch vụ | Thư mục | Port Local | Database | Nhiệm vụ chính |
|---|---|---|---|---|
| **Auth Service** | `auth-service/` | `:5003` | `bookstore_auth` | Quản lý người dùng, đăng ký, đăng nhập, JWT token, gửi email kích hoạt, cung cấp API xác thực token (`/validate`) và tra cứu user (`/internal/v1/users`). |
| **Product Service** | `product-service/` | `:5002` | `bookstore_products` | Danh mục sách, phân trang, lọc nâng cao, Flash Sale engine, tìm kiếm Full-Text tiếng Việt chịu lỗi chính tả qua **Meilisearch**, cache qua **Upstash Redis**, trừ/hoàn kho nguyên tử (`/internal/v1/stock`). |
| **Core Monolith** | `backend/` | `:5001` | `bookstore` | Quản lý giỏ hàng (Cart), quy trình thanh toán và đặt hàng (Orders), thông báo in-app (Notifications). Xác thực ủy quyền qua `auth-service`, điều phối kho qua `product-service`, phát sự kiện sang RabbitMQ. |
| **Notification Service** | `notification-service/` | Worker | — | Background worker lắng nghe hàng đợi RabbitMQ (`order.placed`, `order.delivered`) để gửi email tự động qua Resend/Nodemailer. |
| **Frontend Web** | `frontend/` | `:5173` | — | Giao diện Single Page Application (SPA) tương tác đa dịch vụ: Auth API (`auth-service`), Catalog API (`product-service`), Commerce API (`backend`). |

---

## 🛠️ Tech Stack & Hạ tầng

### Ứng dụng & Dịch vụ
- **Runtime:** Node.js 20 (ES Modules)
- **Backend Framework:** Express 5
- **Frontend Framework:** React 19, Vite, TailwindCSS 4, Redux Toolkit, React Router DOM 7
- **Database:** MongoDB Atlas (Mongoose 9) — Mô hình **Database-per-Service** (3 cơ sở dữ liệu độc lập)
- **Search Engine:** Meilisearch 1.11 (triển khai trên GCP Compute Engine VM `e2-micro`)
- **Cache Layer:** Upstash Redis (Serverless TLS Rediss) với kỹ thuật **Catalog Versioning** (`catalog:v`)
- **Message Broker:** RabbitMQ / CloudAMQP
- **Mailing:** Nodemailer (Gmail App Password / Resend SMTP / Ethereal Test)

### DevOps & Triển khai
- **Hosting:** Google Cloud Run (Container Managed — Tối ưu hóa Free Tier: Min instance = 0, Max = 2)
- **Container Registry:** Google Artifact Registry
- **CI/CD:** GitHub Actions với pipeline tự động build, test và deploy đa dịch vụ song song
- **Containerization:** Docker & Docker Compose

---

## 🔄 Giao tiếp liên dịch vụ (Inter-service Communication)

```
                     ┌─────────────────────────────────────────────────────────┐
                     │                      FRONTEND                           │
                     └─────────────┬─────────────────┬─────────────────┬───────┘
                                   │                 │                 │
            /api/v1/auth/*         │                 │                 │ /api/v1/cart
                                   ▼                 │                 │ /api/v1/orders
                             [auth-service]          │                 ▼
                                   ▲                 │           [backend monolith]
                                   │                 │                 │
                GET /auth/validate │                 │                 │ 1. GET /auth/validate
         (Xác thực Token & Admin) │                 │                 │    (Xác thực user)
                                   │                 │                 │ 2. GET /internal/v1/users
                                   │                 │                 │    (Tra cứu user đơn hàng)
                                   │                 │                 ▼
                             [product-service] ◄─────┴─────── POST /internal/v1/stock/reserve
                       (Sách, Tìm kiếm, Flash Sale)       (Trừ kho với x-internal-key)
                                                                       │
                                                                       │ Publish event
                                                                       ▼
                                                                 [RabbitMQ Queue]
                                                                       │
                                                                       │ Consume
                                                                       ▼
                                                             [notification-service]
                                                                 (Gửi email)
```

1. **Ủy quyền xác thực (Authentication Delegation):** Cả `backend` và `product-service` không tự xác thực mật khẩu hay truy vấn DB users. Middleware `auth.middleware.js` gửi request `GET /api/v1/auth/validate` kèm header `Authorization: Bearer <token>` sang `auth-service`.
2. **Khóa an toàn nội bộ (Internal Secrets):** Các endpoint nhạy cảm như điều chỉnh tồn kho (`/internal/v1/stock/*`) và lấy thông tin user hàng loạt (`/internal/v1/users`) được bảo vệ nghiêm ngặt bằng secret header (`x-internal-key`).
3. **Event-driven Notifications:** Sau khi đơn hàng được tạo hoặc cập nhật trạng thái, `backend` gửi tin nhắn bất đồng bộ vào RabbitMQ Exchange. `notification-service` tiêu thụ sự kiện và gửi email mà không làm chậm thời gian phản hồi của API đặt hàng.

---

## 🚀 Hướng dẫn chạy cục bộ (Local Development)

### Yêu cầu tiên quyết
- **Node.js** >= 20.x
- **Docker** & **Docker Compose** (dùng cho Meilisearch, RabbitMQ và Auth Service cục bộ)
- Cụm **MongoDB Atlas** (hoặc MongoDB Local)

### 1. Khởi động các dịch vụ phụ trợ với Docker
Tại thư mục gốc dự án:
```bash
# Khởi chạy Meilisearch (port 7700) và RabbitMQ (port 5672, UI 15672)
docker compose up -d meilisearch
```
*(Nếu cần RabbitMQ local: `docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management`)*

---

### 2. Cấu hình biến môi trường (`.env`)

Tạo file `.env` cho từng dịch vụ dựa trên các file `sample.env` có sẵn:

#### A. `auth-service/.env` (Cổng 5003)
```env
PORT=5003
MONGO_URI=mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/bookstore_auth
CLIENT_URL=http://localhost:5173
JWT_ACCESS_SECRET=your_jwt_access_secret_32bytes_hex
JWT_REFRESH_SECRET=your_jwt_refresh_secret_32bytes_hex
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password
EMAIL_FROM=BookStore <your_email@gmail.com>
AUTH_INTERNAL_SECRET=your_shared_auth_internal_secret
```

#### B. `product-service/.env` (Cổng 5002)
```env
PORT=5002
MONGO_URI=mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/bookstore_products
CLIENT_URL=http://localhost:5173
AUTH_SERVICE_URL=http://localhost:5003
MEILI_HOST=http://127.0.0.1:7700
MEILI_MASTER_KEY=dev_master_key_change_me
MEILI_INDEX=books
REDIS_URL=rediss://default:<pass>@<host>.upstash.io:6379  # Để trống nếu không dùng Redis cache
PRODUCT_INTERNAL_SECRET=your_shared_product_internal_secret
```

#### C. `backend/.env` (Cổng 5001)
```env
PORT=5001
MONGO_URI=mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/bookstore
CLIENT_URL=http://localhost:5173
AUTH_SERVICE_URL=http://localhost:5003
AUTH_INTERNAL_SECRET=your_shared_auth_internal_secret
PRODUCT_SERVICE_URL=http://localhost:5002
PRODUCT_INTERNAL_SECRET=your_shared_product_internal_secret
RABBITMQ_URL=amqp://localhost:5672  # Hoặc URL CloudAMQP
```

#### D. `frontend/.env` (Cổng 5173)
```env
VITE_API_URL=http://localhost:5001/api/v1
VITE_AUTH_API_URL=http://localhost:5003/api/v1
VITE_CATALOG_API_URL=http://localhost:5002/api/v1
```

---

### 3. Đồng bộ và Di chuyển dữ liệu (Data Migration)

Nếu bạn vừa tách service và cần sao chép dữ liệu từ database Monolith cũ sang các database microservice mới:

```bash
# 1. Di chuyển Users sang bookstore_auth:
cd auth-service
npm install
npm run migrate

# 2. Di chuyển Sách sang bookstore_products và đồng bộ Meilisearch:
cd ../product-service
npm install
npm run migrate
```

---

### 4. Khởi chạy toàn bộ hệ thống

Mở các terminal riêng biệt để chạy từng service:

```bash
# Terminal 1: Auth Service
cd auth-service && npm run dev          # http://localhost:5003

# Terminal 2: Product Service
cd product-service && npm run dev       # http://localhost:5002

# Terminal 3: Core Backend Monolith
cd backend && npm run dev               # http://localhost:5001

# Terminal 4: Notification Service (Worker)
cd notification-service && npm run dev

# Terminal 5: Frontend UI
cd frontend && npm run dev              # http://localhost:5173
```

---

## 📡 Tổng hợp API Endpoints

### 1. Auth Service (`:5003/api/v1`)
| Phương thức | Đường dẫn | Chức năng | Phân quyền |
|---|---|---|---|
| `POST` | `/auth/register` | Đăng ký tài khoản & gửi email xác nhận | Public |
| `GET` | `/auth/verify-email?token=` | Kích hoạt tài khoản từ liên kết email | Public |
| `POST` | `/auth/login` | Đăng nhập (trả JWT & set refresh token cookie) | Public |
| `POST` | `/auth/refresh` | Cấp mới access token từ cookie refresh | Cookie |
| `POST` | `/auth/logout` | Đăng xuất và xóa cookie | Public |
| `GET` | `/auth/me` | Lấy thông tin tài khoản hiện tại | 🔒 Bearer |
| `PATCH` | `/auth/me` | Cập nhật thông tin profile/địa chỉ | 🔒 Bearer |
| `GET` | `/auth/validate` | Endpoint cho service khác xác thực token | 🔒 Bearer |
| `GET` | `/auth/users` | Danh sách tài khoản người dùng | 🔒 Admin |
| `GET` | `/internal/v1/users/:id` | Lấy thông tin user nội bộ | 🔑 `x-internal-key` |
| `POST` | `/internal/v1/users/batch` | Lấy nhiều user theo danh sách ID | 🔑 `x-internal-key` |

### 2. Product Service (`:5002/api/v1`)
| Phương thức | Đường dẫn | Chức năng | Phân quyền |
|---|---|---|---|
| `GET` | `/books` | Danh sách sách, lọc giá/danh mục, tìm kiếm full-text | Public |
| `GET` | `/books/flash-sale` | Danh sách các sách đang Flash Sale (-50%) | Public |
| `GET` | `/books/:id` | Chi tiết cuốn sách (Redis Cached) | Public |
| `POST` | `/books` | Tạo sách mới (đồng bộ Meilisearch, xóa cache) | 🔒 Admin |
| `PATCH` | `/books/:id` | Cập nhật thông tin / ảnh bìa / Flash Sale | 🔒 Admin |
| `DELETE` | `/books/:id` | Xóa sách | 🔒 Admin |
| `POST` | `/internal/v1/stock/reserve` | Giữ & trừ tồn kho khi tạo đơn hàng | 🔑 `x-internal-key` |
| `POST` | `/internal/v1/stock/restore` | Hoàn trả tồn kho khi hủy đơn | 🔑 `x-internal-key` |

### 3. Core Backend (`:5001/api/v1`)
| Phương thức | Đường dẫn | Chức năng | Phân quyền |
|---|---|---|---|
| `GET` | `/cart` | Xem chi tiết giỏ hàng hiện tại | 🔒 User |
| `POST` | `/cart` | Thêm sản phẩm vào giỏ | 🔒 User |
| `PUT` | `/cart/:itemId` | Cập nhật số lượng sản phẩm | 🔒 User |
| `DELETE` | `/cart/:itemId` | Xóa sản phẩm khỏi giỏ | 🔒 User |
| `POST` | `/orders` | Đặt hàng (kiểm tra tồn kho, gửi event RabbitMQ) | 🔒 User |
| `GET` | `/orders/my` | Lịch sử đơn hàng của tôi | 🔒 User |
| `GET` | `/orders` | Danh sách toàn bộ đơn hàng | 🔒 Admin |
| `PATCH` | `/orders/:id/status` | Cập nhật trạng thái xử lý đơn hàng | 🔒 Admin |
| `GET` | `/notifications` | Danh sách thông báo in-app | 🔒 User |

---

## 🌐 CI/CD & Triển khai Google Cloud Run

Pipeline tự động hóa hoàn toàn trên GitHub Actions qua file `.github/workflows/deploy.yml`:

```
                           git push origin main
                                     │
                                     ▼
                          [test] Code Quality & Build
                                     │
              ┌──────────────────────┴──────────────────────┐
              ▼                                             ▼
     [deploy-auth]                                 [deploy-product]
Build & Deploy Cloud Run                       Build & Deploy Cloud Run
              │                                             │
              └──────────────────────┬──────────────────────┘
                                     ▼
                              [deploy-backend]
                           Build & Deploy Cloud Run
                                     │
                                     ▼
                              [deploy-frontend]
                      Build Vite với URL tự động inject
                                     │
                                     ▼
                        Cập nhật CORS liên dịch vụ
```

### Danh sách GitHub Secrets cần cấu hình

Vào **Settings → Secrets and variables → Actions** trên repository GitHub và cấu hình:

| Secret | Mô tả |
|---|---|
| `GCP_PROJECT_ID` | Google Cloud Project ID (vd: `github-cursor-ana`) |
| `GCP_SA_KEY` | Khóa JSON Service Account có quyền deploy Cloud Run & Artifact Registry |
| `AUTH_MONGO_URI` | MongoDB Connection String trỏ tới DB `bookstore_auth` |
| `PRODUCT_MONGO_URI` | MongoDB Connection String trỏ tới DB `bookstore_products` |
| `MONGO_URI` | MongoDB Connection String trỏ tới DB `bookstore` (Monolith) |
| `JWT_ACCESS_SECRET` | Secret mã hóa Access Token (dùng chung giữa auth và các service) |
| `JWT_REFRESH_SECRET` | Secret mã hóa Refresh Token |
| `AUTH_INTERNAL_SECRET` | Khóa bí mật giao tiếp nội bộ giữa Backend Monolith và Auth Service |
| `PRODUCT_INTERNAL_SECRET`| Khóa bí mật giao tiếp nội bộ giữa Backend Monolith và Product Service |
| `MEILI_HOST` | URL máy chủ Meilisearch (vd: `http://<VM_IP>:7700`) |
| `MEILI_MASTER_KEY` | Master key của Meilisearch |
| `REDIS_URL` | Upstash Redis TLS URL (`rediss://...`) |
| `RABBITMQ_URL` | URL kết nối CloudAMQP (`amqps://...`) |
| `EMAIL_HOST` | SMTP Host (vd: `smtp.gmail.com` hoặc `smtp.resend.com`) |
| `EMAIL_PORT` | SMTP Port (`587`) |
| `EMAIL_SECURE` | `false` |
| `EMAIL_USER` | Email gửi (vd: Gmail hoặc `resend`) |
| `EMAIL_PASS` | Gmail App Password hoặc API Key Resend |
| `EMAIL_FROM` | Tên người gửi hiển thị (vd: `BookStore <your_email@gmail.com>`) |

---

## 📄 Bản quyền (License)

Dự án phát hành theo giấy phép MIT © 2026 — [nguyenson2012](https://github.com/nguyenson2012).
