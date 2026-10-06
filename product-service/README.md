# Product Catalog & Search Service

Microservice độc lập chịu trách nhiệm quản lý danh mục sản phẩm (sách), tồn kho, chương trình Flash Sale, công cụ tìm kiếm tiếng Việt và bộ nhớ đệm (caching) cho hệ thống **BookStore**.

---

## 🏗️ Kiến trúc tổng thể (System Architecture)

```mermaid
flowchart TD
    subgraph Clients["Clients"]
        FE["Frontend (React / Vite :5173)"]
        ADMIN["Admin Dashboard"]
    end

    subgraph Gateway["Backend Monolith (:5001)"]
        MONO["Express Monolith API"]
        ORDER_MOD["Order Module"]
    end

    subgraph ProductService["Product Service (:5002)"]
        API["Express API Server"]
        CACHE_SVC["Cache Service"]
        SEARCH_SVC["Search Service"]
        STOCK_SVC["Stock Manager"]
    end

    subgraph Infrastructure["External Cloud Infrastructure"]
        MONGO[("MongoDB Atlas\n(Database: bookstore_products)")]
        MEILI[("Meilisearch Search Engine\n(GCP VM e2-micro :7700)")]
        UPSTASH[("Upstash Redis Cache\n(TLS Serverless Redis)")]
    end

    FE -->|Public Book Queries| MONO
    ADMIN -->|CRUD Books| MONO
    MONO -->|Proxy Requests| API
    ORDER_MOD -->|Reserve/Restore Stock (x-internal-key)| API

    API --> CACHE_SVC
    API --> SEARCH_SVC
    API --> STOCK_SVC

    CACHE_SVC <-->|Read / Invalidate Cache| UPSTASH
    SEARCH_SVC <-->|Full-Text / Typo-Tolerant Search| MEILI
    STOCK_SVC <-->|CRUD / Atomically Update Stock| MONGO
```

---

## ✨ Tính năng nổi bật (Key Features)

### 1. 🔍 Full-Text Search & Typo-Tolerance (Meilisearch trên GCP VM)
- Hỗ trợ tìm kiếm tiếng Việt có dấu (`"dế mèn"`) lẫn không dấu (`"de men"`).
- Khả năng chịu lỗi chính tả (Typo-tolerant) với tốc độ phản hồi cực nhanh (< 20ms).
- Tìm kiếm phân cấp kết hợp bộ lọc linh hoạt: lọc theo danh mục (`category`), khoảng giá (`price`), chương trình Flash Sale.
- Tự động đồng bộ (Auto-sync) dữ liệu giữa MongoDB và Meilisearch khi khởi động hoặc khi Admin thêm/sửa/xóa sách.

### 2. ⚡ Hiệu năng cao với Upstash Redis Caching
- **Cache chi tiết sách:** Lưu từng cuốn sách theo key `book:<id>` với thời gian sống (TTL) linh hoạt.
- **Cache danh sách thông minh (Catalog Versioning):** 
  - Các danh sách (phân trang, danh mục, flash sale) được lưu theo key: `books:v<version>:<params>`.
  - Quản lý phiên bản danh mục thông qua `catalog:v`. Khi có bất kỳ thay đổi nào từ Admin (tạo, cập nhật, xóa sách), `catalog:v` được tăng lên (`INCR`), tự động vô hiệu hóa toàn bộ cache danh sách cũ ngay lập tức mà không cần quét từng key.

### 3. 🛡️ Cơ chế Đặt trước Tồn kho (Atomic Stock Reservation)
- Cung cấp API nội bộ cho Monolith Backend phục vụ quá trình đặt hàng:
  - `POST /internal/v1/stock/reserve`: Giữ hàng và trừ tồn kho nguyên tử (`$gte` và `$inc`).
  - `POST /internal/v1/stock/restore`: Hoàn trả tồn kho khi đơn hàng bị hủy hoặc quá trình thanh toán thất bại.
- Được bảo vệ bằng token bí mật nội bộ `x-internal-key` (ngăn chặn truy cập trái phép từ bên ngoài).

### 4. ⚡ Quản lý Flash Sale
- Quản lý khung giờ giảm giá (`flashSaleStartDate`, `flashSaleEndDate`) và tỷ lệ phần trăm (`flashSaleDiscount`).
- Tự động xác định trạng thái hiệu lực (`isFlashSaleActive`) và tính toán đơn giá sau giảm (`finalPrice`).

---

## 📁 Cấu trúc thư mục (Directory Structure)

```
product-service/
├── src/
│   ├── index.js                      # Entry point, khởi tạo Express server & kết nối dịch vụ
│   ├── config/
│   │   ├── db.js                     # Kết nối MongoDB Atlas (DB: bookstore_products)
│   │   ├── meili.js                  # Kết nối & khởi tạo index Meilisearch
│   │   └── redis.js                  # Kết nối Upstash Redis (hỗ trợ TLS rediss://)
│   ├── controllers/
│   │   └── product.controller.js     # Controller xử lý CRUD, Flash Sale, Stock, Search
│   ├── models/
│   │   └── book.model.js             # Mongoose Schema & Model cho Book
│   ├── routes/
│   │   ├── product.routes.js         # Public & Admin endpoints (/api/v1/books)
│   │   └── internal.routes.js        # Internal endpoints (/internal/v1/books, /internal/v1/stock)
│   └── services/
│       ├── cache.service.js          # Logic quản lý Cache (Catalog Versioning)
│       └── search.service.js         # Logic tìm kiếm & đồng bộ Meilisearch
├── deploy/
│   ├── install-meilisearch-vm.sh     # Script tự động cài đặt Meilisearch trên GCP VM
│   └── setup-nginx-meili.sh          # Script cấu hình Nginx reverse proxy + SSL Let's Encrypt
├── scripts/
│   ├── migrate-from-monolith.js      # Copy sách từ monolith DB sang bookstore_products DB
│   └── seed.js                       # Script tạo dữ liệu mẫu độc lập
├── .env                              # Biến môi trường
├── Dockerfile                        # Dockerfile đóng gói service
└── package.json                      # Dependencies & NPM scripts
```

---

## ⚙️ Biến môi trường (`.env`)

Tạo file `.env` tại thư mục gốc của `product-service/` với cấu hình mẫu sau:

```env
NODE_ENV=development
PORT=5002

# 1. MongoDB Atlas — Database riêng cho Product Service
MONGO_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/bookstore_products

CLIENT_URL=http://localhost:5173

# 2. JWT Secret — Đồng bộ với Backend Monolith để xác thực Admin
AUTH_SERVICE_URL=http://localhost:5003   # URL của auth-service để validate token admin

# 3. Meilisearch — Trên GCP VM (hoặc Docker local)
MEILI_HOST=http://<ip_vm_gcp_hoac_localhost>:7700
MEILI_MASTER_KEY=<your_meilisearch_master_key>
MEILI_INDEX=books

# 4. Redis Cache — Upstash (Lưu ý giao thức rediss:// cho TLS)
REDIS_URL=rediss://default:<password>@<your_redis_host>.upstash.io:6379

# 5. Secret giao tiếp nội bộ giữa Monolith & Product Service
PRODUCT_INTERNAL_SECRET=<your_product_internal_secret>

# 6. URI Monolith cũ (chỉ dùng khi chạy script migrate-from-monolith.js)
MONOLITH_MONGO_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/bookstore
```

---

## 🚀 Hướng dẫn chạy cục bộ (Local Development)

### 1. Cài đặt thư viện
```bash
cd product-service
npm install
```

### 2. Di chuyển dữ liệu từ Monolith (Migration)
Nếu bạn vừa tách service và muốn sao chép toàn bộ dữ liệu sách từ database cũ sang `bookstore_products` đồng thời đồng bộ lên Meilisearch:
```bash
npm run migrate
```

### 3. Chạy service ở chế độ Development
```bash
npm run dev
```

Khi chạy thành công, console sẽ hiển thị:
```
✅ Product MongoDB: cluster0.xxxxx.mongodb.net/bookstore_products
✅ Redis (Upstash) connected
✅ Meilisearch: http://<meili_host>:7700 index=books
🔎 Đã đồng bộ 100 sách lên Meilisearch
🚀 Product Service running on port 5002
```

---

## 📡 Danh sách API Endpoints

### 1. Public APIs (Dành cho Người dùng & Frontend)

| Method | Endpoint | Mô tả | Query Parameters |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Kiểm tra tình trạng service | Không |
| `GET` | `/api/v1/books` | Lấy danh sách sách / Tìm kiếm | `search`, `category`, `minPrice`, `maxPrice`, `sort`, `page`, `limit` |
| `GET` | `/api/v1/books/flash-sale` | Lấy danh sách sách Flash Sale đang hoạt động | Không |
| `GET` | `/api/v1/books/:id` | Lấy chi tiết 1 cuốn sách (tự động cache vào Redis) | Không |

### 2. Admin APIs (Yêu cầu JWT Bearer Token với role `admin`)

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `POST` | `/api/v1/books` | Thêm mới 1 cuốn sách |
| `PATCH` | `/api/v1/books/:id` | Cập nhật thông tin sách (tự động xóa cache và cập nhật Meilisearch) |
| `DELETE` | `/api/v1/books/:id` | Xóa sách khỏi database và Meilisearch |

### 3. Internal APIs (Dành riêng cho Monolith Backend, Header `x-internal-key`)

| Method | Endpoint | Headers | Body / Query | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/internal/v1/books` | `x-internal-key` | `?ids=id1,id2` | Lấy danh sách nhiều sách theo danh sách ID |
| `GET` | `/internal/v1/books/:id` | `x-internal-key` | Không | Lấy thông tin sách nội bộ |
| `POST` | `/internal/v1/stock/reserve` | `x-internal-key` | `{"items": [{"bookId": "...", "quantity": 1}]}` | Trừ kho khi đặt hàng |
| `POST` | `/internal/v1/stock/restore` | `x-internal-key` | `{"items": [{"bookId": "...", "quantity": 1}]}` | Hoàn lại tồn kho khi hủy đơn |

---

## ☁️ Hướng dẫn triển khai lên Cloud (Deployment)

### 1. Cài đặt Meilisearch trên GCP VM (e2-micro Always Free)
1. Tạo VM trên GCP:
   ```bash
   gcloud compute instances create meilisearch-vm \
     --zone=asia-southeast1-a \
     --machine-type=e2-micro \
     --image-family=debian-12 \
     --image-project=debian-cloud \
     --tags=meilisearch \
     --boot-disk-size=20GB
   ```
2. Mở Firewall port 7700:
   ```bash
   gcloud compute firewall-rules create allow-meilisearch \
     --allow tcp:7700 --target-tags=meilisearch --source-ranges=0.0.0.0/0
   ```
3. SSH vào VM và chạy script cài đặt tự động:
   - Sử dụng script mẫu: [deploy/install-meilisearch-vm.sh](file:///Users/nguyenson/Documents/Working/bookstore-monolith/product-service/deploy/install-meilisearch-vm.sh).

### 2. Thiết lập Upstash Redis
1. Đăng ký tài khoản tại [Upstash](https://console.upstash.com).
2. Tạo database Regional chọn vùng **Singapore (`ap-southeast-1`)** với chính sách eviction **`allkeys-lru`**.
3. Lấy connection string TLS và điền vào `REDIS_URL=rediss://...` trong `.env`.

### 3. Đóng gói Docker
```bash
docker build -t bookstore-product-service .
docker run -d -p 5002:5002 --env-file .env bookstore-product-service
```
