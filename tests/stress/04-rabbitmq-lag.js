import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

let config = {};
try {
  config = JSON.parse(open('./data/config.json'));
} catch (e) {
  config = {
    backendUrl: __ENV.BACKEND_URL || 'http://localhost:5001',
    customerToken: __ENV.CUSTOMER_TOKEN || '',
  };
}

const AUTH_URL = config.authServiceUrl || 'http://localhost:5003';
const BACKEND_URL = config.backendUrl || 'http://localhost:5001';
const BOOK_ID = config.testBookId || '';
const TOKEN = config.customerToken || '';

const eventDispatchDuration = new Trend('duration_event_dispatch');
const errorRate = new Rate('custom_error_rate');

export const options = {
  stages: [
    { duration: '10s', target: 10 },
    { duration: '30s', target: 30 }, // Duy trì 30 VUs liên tục tạo đơn hàng để bơm message vào RabbitMQ
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
  },
};

// Đăng nhập lấy token tươi mới trước khi test chạy
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
  return { token };
}

export default function (data) {
  const token = data?.token || TOKEN;
  const payload = JSON.stringify({
    shippingAddress: {
      fullName: 'RabbitMQ Stress Test User',
      phone: '0912345678',
      street: '456 Phố Sách',
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
  eventDispatchDuration.add(res.timings.duration);

  // Status 201 hoặc 400 (hết hàng do trừ liên tục) đều được chấp nhận ở mức đo khả năng chịu tải của backend
  const validResponse = res.status === 201 || res.status === 400;
  check(res, {
    'valid status 201 or 400': () => validResponse,
  });
  errorRate.add(!validResponse);

  sleep(0.1);
}
