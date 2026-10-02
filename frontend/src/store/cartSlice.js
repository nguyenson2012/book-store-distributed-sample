import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/api';
import { errMsg } from '../utils/helpers';

// GET /cart có populate bookId (title, coverImage, stock) nên luôn lấy lại giỏ sau mỗi thay đổi
const loadCart = async () => (await api.get('/cart')).data.data.cart;

export const fetchCart = createAsyncThunk('cart/fetch', loadCart);

export const addToCart = createAsyncThunk('cart/add', async ({ bookId, quantity = 1 }, { rejectWithValue }) => {
  try {
    await api.post('/cart', { bookId, quantity });
    return await loadCart();
  } catch (e) {
    return rejectWithValue(errMsg(e));
  }
});

export const removeFromCart = createAsyncThunk('cart/remove', async (bookId, { rejectWithValue }) => {
  try {
    await api.delete(`/cart/${bookId}`);
    return await loadCart();
  } catch (e) {
    return rejectWithValue(errMsg(e));
  }
});

const setCart = (s, a) => { s.items = a.payload.items; s.totalPrice = a.payload.totalPrice; };

const slice = createSlice({
  name: 'cart',
  initialState: { items: [], totalPrice: 0 },
  reducers: { clearCart: (s) => { s.items = []; s.totalPrice = 0; } },
  extraReducers: (b) => {
    b.addCase(fetchCart.fulfilled, setCart)
      .addCase(addToCart.fulfilled, setCart)
      .addCase(removeFromCart.fulfilled, setCart);
  },
});

export const { clearCart } = slice.actions;
export default slice.reducer;