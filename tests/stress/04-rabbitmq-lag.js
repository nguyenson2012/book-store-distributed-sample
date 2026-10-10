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

const BACKEND_URL = config.backendUrl || 'http://localhost:5001';
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

export default function () {
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
      Authorization: `Bearer ${TOKEN}`,
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
