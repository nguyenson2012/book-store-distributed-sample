import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001/api/v1',
  withCredentials: true, // gửi HttpOnly cookie (refresh token)
});

let accessToken = null; // giữ trong bộ nhớ, không lưu localStorage
export const setAccessToken = (t) => (accessToken = t);
export const getAccessToken = () => accessToken;

const attachAuth = (instance) => {
  instance.interceptors.request.use((config) => {
    if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
    return config;
  });

  instance.interceptors.response.use(
    (res) => res,
    async (error) => {
      const original = error.config;
      const isAuthCall = original.url?.includes('/auth/');
      if (error.response?.status === 401 && !original._retry && !isAuthCall) {
        original._retry = true;
        try {
          const { data } = await api.post('/auth/refresh');
          setAccessToken(data.accessToken);
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${data.accessToken}`;
          return instance(original);
        } catch {
          setAccessToken(null);
        }
      }
      return Promise.reject(error);
    }
  );
};

attachAuth(api);

const PRODUCT_URL = import.meta.env.VITE_PRODUCT_API_URL;
const TRAFFIC_PERCENT = Number(import.meta.env.VITE_PRODUCT_TRAFFIC_PERCENT ?? 0);

const productApi = PRODUCT_URL
  ? axios.create({ baseURL: PRODUCT_URL, withCredentials: false })
  : null;

if (productApi) attachAuth(productApi);

const stickyBucket = () => {
  try {
    let v = localStorage.getItem('product_canary');
    if (v == null) {
      v = String(Math.floor(Math.random() * 100));
      localStorage.setItem('product_canary', v);
    }
    return Number(v);
  } catch {
    return 0;
  }
};

const useProductReads = () => {
  if (!productApi) return false;
  if (TRAFFIC_PERCENT >= 100) return true;
  if (TRAFFIC_PERCENT <= 0) return false;
  return stickyBucket() < TRAFFIC_PERCENT;
};

/** Đọc catalog: canary 0→100% sang Product Service */
export const catalogApi = {
  get: (url, config) => (useProductReads() ? productApi : api).get(url, config),
};

/** Ghi catalog (admin): luôn Product Service nếu đã cấu hình */
export const catalogWriteApi = productApi || api;

export default api;
