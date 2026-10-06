import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api, { authApi, setAccessToken } from '../services/api';
import { errMsg } from '../utils/helpers';

// Chạy 1 lần khi mở app: dùng refresh token (HttpOnly cookie) để khôi phục phiên đăng nhập
export const bootstrapAuth = createAsyncThunk('auth/bootstrap', async () => {
  try {
    const { data } = await authApi.post('/auth/refresh');
    setAccessToken(data.accessToken);
    const me = await authApi.get('/auth/me');
    return me.data.data.user;
  } catch {
    return null; // chưa đăng nhập hoặc refresh token hết hạn
  }
});

const authThunk = (name, url) =>
  createAsyncThunk(`auth/${name}`, async (body, { rejectWithValue }) => {
    try {
      const { data } = await authApi.post(url, body);
      setAccessToken(data.accessToken);
      return data.data.user;
    } catch (e) {
      return rejectWithValue(errMsg(e));
    }
  });

export const login = authThunk('login', '/auth/login');

// Register giờ chỉ trả về message (cần xác nhận email trước)
export const register = createAsyncThunk('auth/register', async (body, { rejectWithValue }) => {
  try {
    const { data } = await authApi.post('/auth/register', body);
    return { message: data.message }; // không có user
  } catch (e) {
    return rejectWithValue(errMsg(e));
  }
});

// Xác nhận email với token từ link email
export const verifyEmail = createAsyncThunk('auth/verifyEmail', async (token, { rejectWithValue }) => {
  try {
    const { data } = await authApi.get(`/auth/verify-email?token=${token}`);
    setAccessToken(data.accessToken);
    return data.data.user;
  } catch (e) {
    return rejectWithValue(errMsg(e));
  }
});

export const logout = createAsyncThunk('auth/logout', async () => {
  await authApi.post('/auth/logout').catch(() => {});
  setAccessToken(null);
});

export const updateProfile = createAsyncThunk('auth/updateProfile', async (body, { rejectWithValue }) => {
  try {
    const { data } = await authApi.patch('/auth/me', body);
    return data.data.user;
  } catch (e) {
    return rejectWithValue(errMsg(e));
  }
});

const slice = createSlice({
  name: 'auth',
  initialState: { user: null, initialized: false, loading: false, error: null, registerMessage: null },
  reducers: {
    clearError: (s) => { s.error = null; },
    clearRegisterMessage: (s) => { s.registerMessage = null; },
  },
  extraReducers: (b) => {
    b.addCase(bootstrapAuth.fulfilled, (s, a) => { s.user = a.payload; s.initialized = true; });

    // login
    b.addCase(login.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(login.fulfilled, (s, a) => { s.loading = false; s.user = a.payload; })
      .addCase(login.rejected, (s, a) => { s.loading = false; s.error = a.payload; });

    // register → chỉ set message, không set user
    b.addCase(register.pending, (s) => { s.loading = true; s.error = null; s.registerMessage = null; })
      .addCase(register.fulfilled, (s, a) => { s.loading = false; s.registerMessage = a.payload.message; })
      .addCase(register.rejected, (s, a) => { s.loading = false; s.error = a.payload; });

    // verifyEmail → đăng nhập luôn sau khi xác nhận
    b.addCase(verifyEmail.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(verifyEmail.fulfilled, (s, a) => { s.loading = false; s.user = a.payload; })
      .addCase(verifyEmail.rejected, (s, a) => { s.loading = false; s.error = a.payload; });

    b.addCase(logout.fulfilled, (s) => { s.user = null; })
      .addCase(updateProfile.fulfilled, (s, a) => { s.user = a.payload; });
  },
});

export const { clearError, clearRegisterMessage } = slice.actions;
export default slice.reducer;