# Notification Service

Microservice độc lập xử lý Email/Notification cho BookStore.

**Lắng nghe events từ RabbitMQ:**
- `order.placed` → Gửi email xác nhận đặt hàng + thông báo admin
- `order.delivered` → Gửi email thông báo giao hàng thành công

---

## 🚀 Chạy local (dev)

### Bước 1: Cài RabbitMQ bằng Docker

```bash
# Chạy RabbitMQ với Management UI
docker run -d \
  --name rabbitmq-dev \
  -p 5672:5672 \
  -p 15672:15672 \
  rabbitmq:3-management

# Kiểm tra đã chạy chưa
docker ps | grep rabbitmq
```

- **AMQP port:** `5672` (monolith + service dùng cổng này)
- **Management UI:** http://localhost:15672 (user: `guest` / pass: `guest`)

> Nếu chưa có Docker: [tải Docker Desktop](https://www.docker.com/products/docker-desktop/)

### Bước 2: Cài dependencies

```bash
cd notification-service
npm install
```

### Bước 3: Cấu hình `.env`

File `.env` đã có sẵn với cấu hình mặc định cho local.
- `MONGO_URI` đã được điền sẵn (cùng Atlas cluster với monolith)
- `RABBITMQ_URL=amqp://localhost:5672` (Docker local)
- `RESEND_API_KEY` — API key từ [resend.com](https://resend.com)
- `EMAIL_FROM` — địa chỉ gửi (dev: `BookStore <onboarding@resend.dev>`)

### Bước 4: Chạy service

```bash
npm run dev
```

Bạn sẽ thấy:
```
╔══════════════════════════════════════════╗
║      BookStore — Notification Service    ║
╚══════════════════════════════════════════╝

✅ MongoDB connected
🐰 [Consumer] Đang lắng nghe queue: "notification_service_queue"
   Routing keys: order.placed, order.delivered
🟢 Notification Service is running. Waiting for events...
```

---

## 🧪 Test flow

1. Đảm bảo **monolith backend** đang chạy (`npm run dev` trong `/backend`)
2. Đảm bảo **RabbitMQ Docker** đang chạy
3. Đảm bảo **notification-service** đang chạy (`npm run dev`)
4. Tạo đơn hàng từ frontend hoặc gọi API trực tiếp

**Kết quả mong đợi trong console notification-service:**
```
📥 [Consumer] Event nhận được: order.placed
✅ [Handler] order.placed xử lý xong
📧 [EmailService] Sent via Resend: [BookStore] Đặt hàng thành công ... (id: ...)
```

**Xem email:** inbox người nhận, hoặc Resend dashboard → Emails.

---

## 📁 Cấu trúc

```
notification-service/
├── src/
│   ├── index.js                      # Entry point
│   ├── consumer.js                   # RabbitMQ subscriber
│   ├── email.service.js              # Resend API
│   ├── models/
│   │   ├── notification.model.js     # Schema đồng bộ với monolith
│   │   └── user.model.js             # Schema tối giản để query email
│   └── handlers/
│       ├── order-placed.handler.js   # Xử lý event order.placed
│       └── order-delivered.handler.js # Xử lý event order.delivered
├── .env
├── package.json
└── README.md
```

---

## 📧 Cấu hình Resend

Sửa `.env`:
```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=BookStore <onboarding@resend.dev>
```

- Tạo API key tại [resend.com/api-keys](https://resend.com/api-keys)
- `onboarding@resend.dev` dùng được ngay khi test (chỉ gửi tới email tài khoản Resend)
- Production: verify domain rồi đặt `EMAIL_FROM=BookStore <noreply@yourdomain.com>`

---

## 🐳 Dockerfile (deploy Cloud Run)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
ENV PORT=8080
CMD ["node", "src/index.js"]
```
