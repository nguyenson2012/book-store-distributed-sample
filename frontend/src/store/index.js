import { configureStore } from '@reduxjs/toolkit';
import auth from './authSlice';
import cart from './cartSlice';

export const store = configureStore({ reducer: { auth, cart } });