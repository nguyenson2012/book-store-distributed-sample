import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

let config = {};
try {
  config = JSON.parse(open('./data/config.json'));
} catch (e) {
  config = {
    authServiceUrl: __ENV.AUTH_SERVICE_URL || 'http://localhost:5003',
    backendUrl: __ENV.BACKEND_URL || 'http://localhost:5001',
    customerToken: __ENV.CUSTOMER_TOKEN || '',
  };
}

const AUTH_URL = config.authServiceUrl || 'http://localhost:5003';
const BACKEND_URL = config.backendUrl || 'http://localhost:5001';
const TOKEN = config.customerToken || '';

const directValidateDuration = new Trend('duration_direct_validate');
const backendProtectedDuration = new Trend('duration_backend_protected_cart');
const errorRate = new Rate('custom_error_rate');

export const options = {
  stages: [
    { duration: '15s', target: 20 },
    { duration: '30s', target: 60 },  // 60 VUs gọi liên tục
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<600'],
    http_req_failed: ['rate<0.02'],
    custom_error_rate: ['rate<0.02'],
  },
};

export default function () {
  const authHeaders = {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  };

  // 1. Gọi trực tiếp endpoint xác thực trên Auth Service (Đo trần năng lực của auth-service)
  {
    const res = http.get(`${AUTH_URL}/api/v1/auth/validate`, { headers: authHeaders });
    directValidateDuration.add(res.timings.duration);
    const success = check(res, {
      'direct validate status is 200': (r) => r.status === 200,
      'token is valid': (r) => {
        try {
          return JSON.parse(r.body).valid === true;
        } catch (e) {
          return false;
        }
      },
    });
    errorRate.add(!success);
  }

  sleep(0.05);

  // 2. Gọi protected endpoint /api/v1/cart trên Backend (Backend gọi nội bộ sang Auth Service)
  {
    const res = http.get(`${BACKEND_URL}/api/v1/cart`, { headers: authHeaders });
    backendProtectedDuration.add(res.timings.duration);
    const success = check(res, {
      'backend cart status is 200': (r) => r.status === 200,
    });
    errorRate.add(!success);
  }

  sleep(0.1);
}
