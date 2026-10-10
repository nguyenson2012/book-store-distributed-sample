# 🚀 Hướng dẫn Chạy Stress Test Toàn Diện với Grafana k6

Thư mục này chứa toàn bộ kịch bản kiểm thử tải (Stress / Concurrency / Bottleneck Testing) cho kiến trúc Distributed Microservices của dự án **BookStore**.

---

## 🛠️ 1. Cài đặt Grafana k6

Bạn có thể chọn 1 trong 2 cách cài đặt:

### Cách 1: Cài trực tiếp trên macOS qua Homebrew (Khuyến nghị - Nhanh & Tiện nhất)
```bash
brew install k6
```
Kiểm tra cài đặt thành công:
```bash
k6 version
```

### Cách 2: Chạy thông qua Docker (Không cần cài phần mềm ngoài)
```bash
# Alias lệnh k6 để chạy trực tiếp container k6 kết nối mạng host
alias k6="docker run --rm -i --network=host -v \$(pwd):/scripts grafana/k6"
```

---

## 📋 2. Khởi động các dịch vụ ở Local

Trước khi chạy test, đảm bảo các dịch vụ sau đang chạy ở local:

```bash
# 1. Cơ sở hạ tầng phụ trợ: Meilisearch & RabbitMQ
docker compose up -d meilisearch

# 2. Auth Service (:5003)
cd auth-service && npm run dev

# 3. Product Service (:5002)
cd product-service && npm run dev

# 4. Core Backend Monolith (:5001)
cd backend && npm run dev

# 5. Notification Service (Worker)
cd notification-service && npm run dev
```

---

## ⚙️ 3. Chuẩn bị Dữ liệu Test (Setup Tokens & Cart)

Chạy script tự động lấy JWT token và chuẩn bị giỏ hàng:

```bash
cd tests/stress
node setup-test-data.js
```

Script sẽ sinh ra file `tests/stress/data/config.json` chứa:
- `customerToken`: Bearer JWT token của khách hàng.
- `adminToken`: Bearer JWT token của Admin.
- `testBookId`: ID cuốn sách có sẵn trong catalog.

---

## 🧪 4. Thực thi 4 Kịch bản Stress Test

Tại thư mục `tests/stress/`:

### 📌 Kịch bản 1: Read-Heavy, Upstash Redis Cache & Meilisearch Benchmark
Đo lường tốc độ đọc danh sách sách (cache hit), chi tiết sách và tìm kiếm tiếng Việt typo-tolerant.
```bash
k6 run 01-catalog-cache.js
```
- **Chỉ số quan sát:**
  - `duration_books_list`: Thời gian trả về danh sách sách từ Redis cache (kỳ vọng < 30ms).
  - `duration_search`: Thời gian Meilisearch tìm kiếm (kỳ vọng < 50ms).
  - `http_req_duration (p95)`: Dưới 200ms khi chịu tải 100 VUs.

---

### 📌 Kịch bản 2: Inter-Service Auth Bottleneck (Xác thực Liên Dịch vụ)
Đo độ trễ và khả năng chịu tải khi Backend liên tục gọi sang Auth Service (`/api/v1/auth/validate`) để xác thực token.
```bash
k6 run 02-auth-validate.js
```
- **Chỉ số quan sát:**
  - `duration_direct_validate`: Tốc độ Auth Service tự xử lý xác thực token.
  - `duration_backend_protected_cart`: Tốc độ Backend nhận request + gọi HTTP nội bộ sang Auth Service.
  - So sánh độ chênh lệch để đánh giá chi phí mạng liên dịch vụ (Inter-service network overhead).

---

### 📌 Kịch bản 3: Flash Sale Concurrency & Atomic Stock Reservation (QUAN TRỌNG NHẤT)
Mô phỏng 30 người dùng cùng bấm "Đặt hàng" trong cùng 1 giây để kiểm tra race condition.
```bash
k6 run 03-flash-sale-checkout.js
```
- **Chỉ số quan sát:**
  - `orders_success_201`: Số đơn hàng được tạo thành công.
  - `orders_out_of_stock_400`: Số đơn hàng bị từ chối do hết hàng.
  - **Quy tắc vàng:** Tổng số đơn tạo thành công **không được vượt quá số lượng tồn kho ban đầu**. Tồn kho trong MongoDB tuyệt đối không bị âm (`stock >= 0`).

---

### 📌 Kịch bản 4: RabbitMQ Asynchronous Backpressure & Notification Lag
Đẩy dồn dập các đơn hàng vào hệ thống để kiểm tra khả năng đệm của RabbitMQ và worker.
```bash
k6 run 04-rabbitmq-lag.js
```
- **Chỉ số quan sát:**
  - Mở RabbitMQ UI tại: `http://localhost:15672` (User: `guest`, Pass: `guest`).
  - Quan sát hàng đợi `notification_service_queue`: Queue có tăng độ dài khi có spike đơn hàng không? Sau khi test dừng, worker có tiêu thụ sạch hàng đợi về 0 không?

---

## 📊 5. Hướng dẫn đọc kết quả đầu ra của k6

Khi k6 kết thúc, màn hình terminal sẽ hiển thị bảng tóm tắt:

```
     ✓ books list status is 200
     ✓ book detail status is 200

     checks.........................: 100.00% ✓ 4500     ✗ 0
     duration_books_list............: avg=18.4ms  min=4.2ms  med=12.1ms  max=112.5ms p(90)=25.6ms p(95)=34.8ms
     http_req_duration..............: avg=24.5ms  min=5.1ms  med=16.3ms  max=145.2ms p(90)=38.1ms p(95)=52.4ms
     http_req_failed................: 0.00%   ✓ 0        ✗ 4500
     http_reqs......................: 4500    75.00/s
     vus............................: 100     min=20     max=100
```

- **`checks`:** Tỷ lệ các điều kiện kiểm tra đạt (mục tiêu 100%).
- **`http_reqs` & `/s`:** Tổng số request đã gửi và thông lượng đạt được (RPS).
- **`p(95)`:** 95% số lượng request có tốc độ phản hồi nhanh hơn con số này.
- **`http_req_failed`:** Tỷ lệ request trả về mã lỗi HTTP 4xx hoặc 5xx (mục tiêu 0% hoặc < 1%).
