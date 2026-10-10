import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

let config = {};
try {
  config = JSON.parse(open('./data/config.json'));
} catch (e) {
  config = {
    backendUrl: __ENV.BACKEND_URL || 'http://localhost:5001',
    customerToken: __ENV.CUSTOMER_TOKEN || '',
    testBookId: __ENV.TEST_BOOK_ID || '',
  };
}

const AUTH_URL = config.authServiceUrl || 'http://localhost:5003';
const BACKEND_URL = config.backendUrl || 'http://localhost:5001';
const BOOK_ID = config.testBookId || '';
const TOKEN = config.customerToken || '';

// Custom counters để đếm kết quả đặt hàng đồng thời
const successfulOrders = new Counter('orders_success_201');
const outOfStockErrors = new Counter('orders_out_of_stock_400');
const orderDuration = new Trend('duration_order_checkout');

export const options = {
  // Chạy 30 VUs trong cùng một đợt tức thì (Spike / Burst)
  scenarios: {
    flash_sale_burst: {
      executor: 'per-vu-iterations',
      vus: 30,             // 30 người dùng đồng thời bấm đặt hàng
      iterations: 1,       // Mỗi người bấm 1 lần cùng lúc
      maxDuration: '20s',
    },
  },
  thresholds: {
    duration_order_checkout: ['p(95)<1500'],
  },
};

// Chuẩn bị token và giỏ hàng tươi mới ngay trước khi test chạy
export function setup() {
  const loginRes = http.post(
    `${AUTH_URL}/api/v1/auth/login`,
    JSON.stringify({ email: 'customer@bookstore.com', password: 'Customer@123' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  let token = TOKEN;
  try {
    const json = loginRes.json();
    if (json.accessToken) token = json.accessToken;
  } catch (e) {}

  // Đảm bảo sách có trong giỏ hàng trước khi burst
  if (BOOK_ID && token) {
    http.post(
      `${BACKEND_URL}/api/v1/cart`,
      JSON.stringify({ bookId: BOOK_ID, quantity: 1 }),
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
  }

  return { token };
}

export default function (data) {
  const token = data?.token || TOKEN;
  const payload = JSON.stringify({
    shippingAddress: {
      fullName: 'Khách hàng Test Flash Sale',
      phone: '0987654321',
      street: '123 Đường Công Nghệ',
      city: 'Hà Nội',
    },
    paymentMethod: 'COD',
  });

  const params = {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(`${BACKEND_URL}/api/v1/orders`, payload, params);
  orderDuration.add(res.timings.duration);

  if (res.status === 201) {
    successfulOrders.add(1);
    check(res, {
      'order created successfully (201)': (r) => r.status === 201,
    });
  } else if (res.status === 400) {
    outOfStockErrors.add(1);
    check(res, {
      'order rejected properly due to out of stock (400)': (r) => r.status === 400,
    });
  } else {
    check(res, {
      'unexpected status code': (r) => false,
    });
  }
}
