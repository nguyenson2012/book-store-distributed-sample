# 🚀 Hướng Dẫn Triển Khai Product Service (Deployment Guide)

> **Mục tiêu:** Tách `product-service` chạy độc lập với cơ sở dữ liệu MongoDB Atlas riêng, Meilisearch trên Google Cloud Platform (VM e2-micro Always Free) và Redis Caching trên Upstash.

---

## 🔒 Quy tắc bảo mật

> [!WARNING]
> **Tuyệt đối không commit key bí mật thật lên Git repository.**  
> Các thông số như MongoDB connection string, JWT secrets, Meilisearch master key, Upstash Redis URL và internal shared secrets phải được lưu trong GitHub Secrets, Cloud Secret Manager hoặc file `.env` cục bộ (đã khai báo trong `.gitignore`). Trong tài liệu này, toàn bộ giá trị nhạy cảm đều sử dụng placeholder mẫu dạng `<your_secret>`.

---

## 🏗️ Kiến trúc hệ thống tổng quan

```
[ Frontend (React / Vite) ]
          │
          ├── /api/v1/books/* ──► [ Backend Monolith (:5001) ]
          │                             │ PRODUCT_SERVICE_URL được cấu hình?
          │                             ├── CÓ ➔ Proxy sang Product Service
          │                             └── KHÔNG ➔ Fallback MongoDB monolith cũ
          │
          └── (Admin trực tiếp) ──► [ Product Service (:5002) ]
                                          │
                                ┌─────────┼──────────────┐
                                ▼         ▼              ▼
                         MongoDB Atlas  Meilisearch   Upstash Redis
                        (bookstore_    (GCP VM e2-   (Serverless TLS,
                         products DB)   micro :7700)   Free Tier)
```

---

## Bước 1: Thiết lập MongoDB Atlas riêng cho Product Service

### 1.1. Tạo Database riêng
1. Đăng nhập [MongoDB Atlas](https://cloud.mongodb.com) vào cụm Cluster hiện có (hoặc tạo Cluster mới).
2. Tạo database user mới tại mục **Database Access** → **Add New Database User**:
   - Authentication Method: Password
   - Username: `product_svc_user`
   - Role: `readWrite` trên database `bookstore_products`
3. Cấu hình IP Whitelist tại **Network Access** → **Add IP Address**:
   - Thêm `0.0.0.0/0` để cho phép Cloud Run và môi trường dev kết nối.
4. Lấy chuỗi kết nối:
   ```env
   MONGO_URI=mongodb+srv://product_svc_user:<password>@cluster0.xxxxx.mongodb.net/bookstore_products
   ```

### 1.2. Di chuyển dữ liệu từ Monolith sang Product DB
Trong thư mục `product-service`, tạo file `.env.migrate` tạm thời:

```env
MONOLITH_MONGO_URI=mongodb+srv://<monolith_user>:<monolith_password>@cluster0.xxxxx.mongodb.net/bookstore
MONGO_URI=mongodb+srv://product_svc_user:<password>@cluster0.xxxxx.mongodb.net/bookstore_products
MEILI_HOST=http://<VM_IP>:7700
MEILI_MASTER_KEY=<your_meili_master_key>
MEILI_INDEX=books
```

Chạy script migration:
```bash
cd product-service
node --env-file=.env.migrate scripts/migrate-from-monolith.js
```

> [!NOTE]
> Script này sẽ copy toàn bộ sách từ DB cũ sang `bookstore_products` và đồng bộ index ban đầu lên Meilisearch.

---

## Bước 2: Cài đặt Meilisearch trên GCP Compute Engine (VM e2-micro Free Tier)

### 2.1. Tạo máy ảo (VM Instance)
Sử dụng dòng máy `e2-micro` thuộc chính sách **Always Free** của GCP (chọn vùng Singapore `asia-southeast1` để có độ trễ thấp nhất):

```bash
gcloud compute instances create meilisearch-vm \
  --zone=asia-southeast1-a \
  --machine-type=e2-micro \
  --image-family=debian-12 \
  --image-project=debian-cloud \
  --tags=meilisearch \
  --boot-disk-size=20GB
```

### 2.2. Mở Firewall Port 7700 trên GCP
```bash
gcloud compute firewall-rules create allow-meilisearch \
  --allow tcp:7700 \
  --target-tags=meilisearch \
  --source-ranges=0.0.0.0/0 \
  --description="Allow Meilisearch HTTP traffic"
```

### 2.3. Cài đặt Meilisearch lên VM
> [!IMPORTANT]
> **Lưu ý:** Script cài đặt nằm ở máy tính của bạn (local). Không chạy `cat product-service/...` trực tiếp bên trong cửa sổ SSH của VM vì VM không có sẵn mã nguồn repo.

Chọn **1 trong 2 cách** thuận tiện sau:

#### 👉 Cách A: Chạy từ terminal máy local (Khuyên dùng — nhanh nhất)
Truyền script từ máy local qua kết nối SSH vào VM:

```bash
# Chạy lệnh này từ thư mục gốc của repository trên máy local:
cat product-service/deploy/install-meilisearch-vm.sh | gcloud compute ssh meilisearch-vm \
  --zone=asia-southeast1-a \
  --command="sudo MEILI_MASTER_KEY='<tao_chuoi_master_key_ngau_nhien>' bash"
```

#### 👉 Cách B: Copy file lên VM bằng `gcloud compute scp`
```bash
# 1. Copy script lên VM
gcloud compute scp product-service/deploy/install-meilisearch-vm.sh \
  meilisearch-vm:~/install-meili.sh \
  --zone=asia-southeast1-a

# 2. SSH vào VM và thực thi
gcloud compute ssh meilisearch-vm --zone=asia-southeast1-a
sudo MEILI_MASTER_KEY="<tao_chuoi_master_key_ngau_nhien>" bash ~/install-meili.sh
```

### 2.4. Kiểm tra Meilisearch hoạt động
Lấy External IP của máy ảo:
```bash
gcloud compute instances describe meilisearch-vm \
  --zone=asia-southeast1-a \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
```

Kiểm tra từ máy local:
```bash
curl http://<VM_EXTERNAL_IP>:7700/health
# Kết quả mong đợi: {"status":"available"}
```

---

## Bước 3: Thiết lập Upstash Redis (Cache Layer)

1. Đăng nhập [Upstash Console](https://console.upstash.com).
2. Bấm **Create Database**:
   - **Name:** `bookstore-product-cache`
   - **Type:** `Regional`
   - **Region:** `Singapore (ap-southeast-1)` (gần vùng máy chủ GCP)
   - **Eviction:** Bật `allkeys-lru` (tối ưu tự động giải phóng RAM khi đầy)
3. Lấy chuỗi kết nối **`REDIS_URL`**:
   ```
   rediss://default:<password>@<your_redis_host>.upstash.io:6379
   ```

> [!IMPORTANT]
> Chuỗi kết nối bắt buộc phải có tiền tố **`rediss://`** (2 chữ `s`) để kích hoạt giao thức mã hóa TLS. Nếu dùng `redis://`, kết nối sẽ bị từ chối với lỗi `ECONNRESET`.

---

## Bước 4: Cấu hình biến môi trường (`.env`)

Tạo file `product-service/.env` từ file mẫu:
```bash
cp product-service/sample.env product-service/.env
```

Nội dung chuẩn của `product-service/.env`:
```env
NODE_ENV=development
PORT=5002

# MongoDB Atlas
MONGO_URI=mongodb+srv://product_svc_user:<password>@cluster0.xxxxx.mongodb.net/bookstore_products

CLIENT_URL=http://localhost:5173

# Auth Service URL (để xác thực token admin qua /validate)
AUTH_SERVICE_URL=http://localhost:5003

# Meilisearch trên GCP VM
MEILI_HOST=http://<VM_EXTERNAL_IP>:7700
MEILI_MASTER_KEY=<your_meili_master_key>
MEILI_INDEX=books

# Redis Cache Upstash
REDIS_URL=rediss://default:<password>@<your_redis_host>.upstash.io:6379

# Token bảo vệ API nội bộ (Backend Monolith -> Product Service)
PRODUCT_INTERNAL_SECRET=<chuoi_token_ngau_nhien_64_ky_tu>
```

Tạo token ngẫu nhiên cho `PRODUCT_INTERNAL_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Cập nhật vào `backend/.env` của Monolith:
```env
# URL trỏ sang Product Service
PRODUCT_SERVICE_URL=http://localhost:5002
# Khớp với PRODUCT_INTERNAL_SECRET ở trên
PRODUCT_INTERNAL_SECRET=<cung_chuoi_token_ngau_nhien_64_ky_tu>
```

---

## Bước 5: Chạy kiểm thử ở môi trường Local

Khởi động các dịch vụ:
```bash
# Terminal 1: Chạy Product Service
cd product-service && npm run dev

# Terminal 2: Chạy Backend Monolith
cd backend && npm run dev

# Terminal 3: Chạy Frontend
cd frontend && npm run dev
```

Kiểm tra API:
```bash
# 1. Health check Product Service
curl http://localhost:5002/health

# 2. Tìm kiếm qua Meilisearch trực tiếp từ Product Service
curl "http://localhost:5002/api/v1/books?search=de+men"

# 3. Tìm kiếm qua Monolith (Monolith tự động proxy sang Product Service)
curl "http://localhost:5001/api/v1/books?search=de+men"

# 4. Kiểm tra dữ liệu cache trên Upstash Redis
node -e "
const Redis = require('ioredis');
const r = new Redis(process.env.REDIS_URL);
r.keys('*').then(k => { console.log('Redis Keys:', k); r.quit(); });
"
```

---

## Bước 6: Triển khai lên Google Cloud Run

Có 2 phương thức triển khai:

### Phương thức 1: Triển khai tự động bằng GitHub Actions CI/CD (Khuyên dùng)
Dự án đã tích hợp sẵn pipeline CI/CD tại `.github/workflows/deploy.yml`. Bạn chỉ cần:
1. Thêm các Secrets vào GitHub repository (**Settings** → **Secrets and variables** → **Actions**):
   - `GCP_PROJECT_ID`
   - `GCP_SA_KEY`
   - `PRODUCT_MONGO_URI`
   - `MEILI_HOST` (dạng `http://<VM_EXTERNAL_IP>:7700`)
   - `MEILI_MASTER_KEY`
   - `REDIS_URL` (dạng `rediss://...`)
   - `PRODUCT_INTERNAL_SECRET`
2. Push code lên nhánh `main`:
   ```bash
   git push origin main
   ```
GitHub Actions sẽ tự động build image cho `product-service`, push lên Artifact Registry và deploy lên Cloud Run (`bookstore-product`).

---

### Phương thức 2: Triển khai thủ công bằng gcloud CLI
1. Build & Push Docker image:
   ```bash
   cd product-service
   IMAGE="asia-southeast1-docker.pkg.dev/<PROJECT_ID>/bookstore/product-service:latest"
   gcloud auth configure-docker asia-southeast1-docker.pkg.dev
   docker build -t "$IMAGE" .
   docker push "$IMAGE"
   ```

2. Deploy lên Cloud Run:
   ```bash
   gcloud run deploy bookstore-product \
     --image "$IMAGE" \
     --region asia-southeast1 \
     --platform managed \
     --allow-unauthenticated \
     --port 8080 \
     --memory 512Mi \
     --cpu 1 \
     --min-instances 0 \
     --max-instances 2 \
     --set-env-vars "NODE_ENV=production,MONGO_URI=<product_mongo_uri>,AUTH_SERVICE_URL=<auth_service_url>,MEILI_HOST=http://<VM_IP>:7700,MEILI_MASTER_KEY=<master_key>,MEILI_INDEX=books,REDIS_URL=rediss://...,PRODUCT_INTERNAL_SECRET=<internal_secret>"
   ```

3. Lấy URL Cloud Run của Product Service:
   ```bash
   gcloud run services describe bookstore-product --region asia-southeast1 --format='value(status.url)'
   # Ví dụ: https://bookstore-product-xxxxx-as.a.run.app
   ```

4. Cập nhật URL này vào biến `PRODUCT_SERVICE_URL` của Backend Monolith.

---

## 🛠️ Tổng hợp các lỗi thường gặp & Cách xử lý (Troubleshooting)

### 1. Lỗi `cat: product-service/deploy/install-meilisearch-vm.sh: No such file or directory`
- **Nguyên nhân:** Lệnh `cat` chạy bên trong phiên SSH của máy ảo GCP VM, nơi chưa có mã nguồn Git của dự án.
- **Cách xử lý:** Chạy lệnh từ máy local và pipe qua SSH:
  ```bash
  cat product-service/deploy/install-meilisearch-vm.sh | gcloud compute ssh meilisearch-vm \
    --zone=asia-southeast1-a \
    --command="sudo MEILI_MASTER_KEY='<your_key>' bash"
  ```

### 2. Lỗi `Permission denied (os error 13)` khi khởi động Meilisearch
- **Nguyên nhân:** File systemd service của Meilisearch chưa khai báo `WorkingDirectory`, tiến trình mặc định truy cập thư mục gốc không có quyền ghi.
- **Cách xử lý:** Thêm `WorkingDirectory=/var/lib/meilisearch` vào khối `[Service]` trong `/etc/systemd/system/meilisearch.service`:
  ```ini
  [Service]
  User=meilisearch
  Group=meilisearch
  WorkingDirectory=/var/lib/meilisearch
  Environment=MEILI_DB_PATH=/var/lib/meilisearch
  Environment=MEILI_HTTP_ADDR=0.0.0.0:7700
  ```
  Sau đó reload và restart service:
  ```bash
  sudo systemctl daemon-reload && sudo systemctl restart meilisearch
  ```

### 3. Lỗi `read ECONNRESET` hoặc `MaxRetriesPerRequestError` với Upstash Redis
- **Nguyên nhân:** Cổng 6379 trên Upstash bắt buộc bảo mật bằng TLS/SSL, nhưng URL kết nối lại dùng giao thức thường `redis://`.
- **Cách xử lý:** Đổi `redis://` thành **`rediss://`** (2 chữ `s`) trong file `.env`:
  ```env
  REDIS_URL=rediss://default:<password>@<host>.upstash.io:6379
  ```

### 4. Lỗi không thể truy cập Meilisearch từ bên ngoài (Timeout / Connection Refused)
- **Nguyên nhân 1:** Meilisearch chỉ lắng nghe trên `127.0.0.1` (localhost của VM).
  - *Xử lý:* Đặt `Environment=MEILI_HTTP_ADDR=0.0.0.0:7700` trong file service systemd.
- **Nguyên nhân 2:** GCP Firewall chưa mở port 7700 hoặc VM chưa được gán network tag `meilisearch`.
  - *Xử lý:* Kiểm tra firewall rule bằng lệnh:
    ```bash
    gcloud compute firewall-rules describe allow-meilisearch
    ```

### 5. Backend Monolith không nhận Product Service sau khi sửa `.env`
- **Nguyên nhân:** Tiến trình Node.js / Nodemon không tự động nạp lại các file ẩn bắt đầu bằng dấu chấm (`.env`) trừ khi file code `.js` thay đổi.
- **Cách xử lý:** Restart tiến trình backend hoặc gõ lệnh `touch backend/server.js` để nodemon khởi động lại và nhận giá trị `PRODUCT_SERVICE_URL`.

### 6. Lỗi YAML syntax trên GitHub Actions (`cache-dependency-path` indented error)
- **Nguyên nhân:** Thuộc tính `cache-dependency-path` bị thụt lề 12 khoảng trắng thay vì 10 khoảng trắng, khiến parser YAML hiểu nhầm là phần tử con của `cache: 'npm'`.
- **Cách xử lý:** Đặt `cache-dependency-path:` thẳng hàng với `cache:` và `node-version:`.