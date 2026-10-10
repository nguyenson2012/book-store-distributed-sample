import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Đọc file config nếu có, hoặc dùng biến môi trường mặc định
let config = {};
try {
  config = JSON.parse(open('./data/config.json'));
} catch (e) {
  config = {
    productServiceUrl: __ENV.PRODUCT_SERVICE_URL || 'http://localhost:5002',
    testBookId: __ENV.TEST_BOOK_ID || '',
  };
}

const BASE_URL = config.productServiceUrl || 'http://localhost:5002';
const BOOK_ID = config.testBookId || '';

// Custom metrics để đo hiệu năng
const errorRate = new Rate('custom_error_rate');
const booksListDuration = new Trend('duration_books_list');
const bookDetailDuration = new Trend('duration_book_detail');
const searchDuration = new Trend('duration_search');

export const options = {
  stages: [
    { duration: '15s', target: 20 },  // Ramp-up lên 20 VUs
    { duration: '30s', target: 50 },  // Duy trì tải 50 VUs
    { duration: '30s', target: 100 }, // Đẩy tải cao 100 VUs (stress test)
    { duration: '15s', target: 0 },   // Hạ nhiệt
  ],
  thresholds: {
    // 95% request phải có phản hồi dưới 200ms
    http_req_duration: ['p(95)<200', 'p(99)<400'],
    // Tỷ lệ lỗi dưới 1%
    http_req_failed: ['rate<0.01'],
    custom_error_rate: ['rate<0.01'],
  },
};

export default function () {
  // 1. Test GET /api/v1/books (Danh sách phân trang & bộ lọc - Đo Upstash Redis cache)
  {
    const res = http.get(`${BASE_URL}/api/v1/books?page=1&limit=10`);
    booksListDuration.add(res.timings.duration);
    const success = check(res, {
      'books list status is 200': (r) => r.status === 200,
      'books list has data': (r) => {
        try {
          return JSON.parse(r.body).status === 'success';
        } catch (e) {
          return false;
        }
      },
    });
    errorRate.add(!success);
  }

  sleep(0.1);

  // 2. Test GET /api/v1/books/:id (Chi tiết sách - Đo Book Cache)
  if (BOOK_ID) {
    const res = http.get(`${BASE_URL}/api/v1/books/${BOOK_ID}`);
    bookDetailDuration.add(res.timings.duration);
    const success = check(res, {
      'book detail status is 200': (r) => r.status === 200,
      'book detail has title': (r) => {
        try {
          return JSON.parse(r.body).data?.book?.title !== undefined;
        } catch (e) {
          return false;
        }
      },
    });
    errorRate.add(!success);
  }

  sleep(0.1);

  // 3. Test GET /api/v1/books?search=... (Tìm kiếm full-text tiếng Việt - Đo Meilisearch)
  {
    const searchQueries = ['sách', 'kinh tế', 'lập trình', 'tuổi trẻ', 'nam'];
    const query = searchQueries[Math.floor(Math.random() * searchQueries.length)];
    const res = http.get(`${BASE_URL}/api/v1/books?search=${encodeURIComponent(query)}`);
    searchDuration.add(res.timings.duration);
    const success = check(res, {
      'search status is 200': (r) => r.status === 200,
    });
    errorRate.add(!success);
  }

  sleep(0.2);
}
