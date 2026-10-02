import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api, { setAccessToken } from '../services/api';
import { errMsg } from '../utils/helpers';

// Chạy 1 lần khi mở app: dùng refresh token (HttpOnly cookie) để khôi phục phiên đăng nhập
export const bootstrapAuth = createAsyncThunk('auth/bootstrap', async () => {
  try {
    const { data } = await api.post('/auth/refresh');
    setAccessToken(data.accessToken);
    const me = await api.get('/users/me');
    return me.data.data.user;
  } catch {
    return null; // chưa đăng nhập hoặc refresh token hết hạn
  }
});

const authThunk = (name, url) =>
  createAsyncThunk(`auth/${name}`, async (body, { rejectWithValue }) => {
    try {
      const { data } = await api.post(url, body);
      setAccessToken(data.accessToken);
      return data.data.user;
    } catch (e) {
      return rejectWithValue(errMsg(e));
    }
  });

export const login = authThunk('login', '/auth/login');
export const register = authThunk('register', '/auth/register');

export const logout = createAsyncThunk('auth/logout', async () => {
  await api.post('/auth/logout').catch(() => {});
  setAccessToken(null);
});

export const updateProfile = createAsyncThunk('auth/updateProfile', async (body, { rejectWithValue }) => {
  try {
    const { data } = await api.patch('/users/me', body);
    return data.data.user;
  } catch (e) {
    return rejectWithValue(errMsg(e));
  }
});

const slice = createSlice({
  name: 'auth',
  initialState: { user: null, initialized: false, loading: false, error: null },
  reducers: { clearError: (s) => { s.error = null; } },
  extraReducers: (b) => {
    b.addCase(bootstrapAuth.fulfilled, (s, a) => { s.user = a.payload; s.initialized = true; });
    for (const t of [login, register]) {
      b.addCase(t.pending, (s) => { s.loading = true; s.error = null; })
        .addCase(t.fulfilled, (s, a) => { s.loading = false; s.user = a.payload; })
        .addCase(t.rejected, (s, a) => { s.loading = false; s.error = a.payload; });
    }
    b.addCase(logout.fulfilled, (s) => { s.user = null; })
      .addCase(updateProfile.fulfilled, (s, a) => { s.user = a.payload; });
  },
});

export const { clearError } = slice.actions;
export default slice.reducer;