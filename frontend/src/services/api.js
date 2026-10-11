import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001/api/v1',
  withCredentials: true, // gửi HttpOnly cookie (refresh token)
});

// Auth Service (login/register/refresh/me/profile...) — monolith không còn route /auth
export const authApi = axios.create({
  baseURL: import.meta.env.VITE_AUTH_API_URL || 'http://localhost:5003/api/v1',
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
          const { data } = await authApi.post('/auth/refresh');
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
attachAuth(authApi);

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

// ─── Client-side In-Memory Cache (TTL 30s) ─────────────────────────────
const clientCatalogCache = new Map();
const CLIENT_CACHE_TTL = 30 * 1000;

export const clearClientCatalogCache = () => {
  clientCatalogCache.clear();
};

const makeCacheKey = (url, params) => {
  if (!params) return url;
  try {
    const sorted = Object.entries(params).sort(([a], [b]) => a.localeCompare(b));
    return `${url}?${new URLSearchParams(sorted).toString()}`;
  } catch {
    return url;
  }
};

// Tự động xoá cache client khi có thao tác ghi (Admin thêm/sửa/xoá sách)
const invalidateOnWrite = (instance) => {
  if (!instance) return;
  instance.interceptors.response.use((res) => {
    const method = res.config?.method?.toLowerCase();
    if (['post', 'patch', 'put', 'delete'].includes(method)) {
      clearClientCatalogCache();
    }
    return res;
  });
};
invalidateOnWrite(api);
if (productApi) invalidateOnWrite(productApi);

/** Đọc catalog: canary 0→100% sang Product Service, hỗ trợ in-memory cache 30s */
export const catalogApi = {
  get: async (url, config) => {
    const key = makeCacheKey(url, config?.params);
    const cached = clientCatalogCache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.response;
    }

    const client = useProductReads() ? productApi : api;
    const response = await client.get(url, config);

    if (response?.data?.status === 'success') {
      if (clientCatalogCache.size >= 200) {
        const oldest = clientCatalogCache.keys().next().value;
        if (oldest) clientCatalogCache.delete(oldest);
      }
      clientCatalogCache.set(key, {
        response,
        expiresAt: Date.now() + CLIENT_CACHE_TTL,
      });
    }

    return response;
  },
};

/** Ghi catalog (admin): luôn Product Service nếu đã cấu hình */
export const catalogWriteApi = productApi || api;

export default api;
