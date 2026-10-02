import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001/api/v1',
  withCredentials: true, // gửi HttpOnly cookie (refresh token)
});

let accessToken = null; // giữ trong bộ nhớ, không lưu localStorage
export const setAccessToken = (t) => (accessToken = t);

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const isAuthCall = original.url.includes('/auth/');
    if (error.response?.status === 401 && !original._retry && !isAuthCall) {
      original._retry = true;
      try {
        const { data } = await api.post('/auth/refresh');
        setAccessToken(data.accessToken);
        return api(original); // gọi lại request ban đầu
      } catch {
        setAccessToken(null); // refresh thất bại => buộc đăng nhập lại
      }
    }
    return Promise.reject(error);
  }
);

export default api;