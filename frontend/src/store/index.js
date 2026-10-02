import { configureStore } from '@reduxjs/toolkit';
import auth from './authSlice';
import cart from './cartSlice';
import notifications from './notificationSlice';

export const store = configureStore({ reducer: { auth, cart, notifications } });