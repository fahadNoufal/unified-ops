import { create } from 'zustand';
import { authAPI } from '../api/client';

export const useAuthStore = create((set) => ({
  user: null,
  loading: true,
  error: null,

  login: async (email, password) => {
    try {
      const response = await authAPI.login({ email, password });
      localStorage.setItem('access_token', response.data.access_token);
      const userResponse = await authAPI.getMe();
      set({ user: userResponse.data, error: null });
      return { success: true };
    } catch (error) {
      set({ error: error.response?.data?.detail || 'Login failed' });
      return { success: false, error: error.response?.data?.detail };
    }
  },

  register: async (data) => {
    try {
      const response = await authAPI.register(data);
      localStorage.setItem('access_token', response.data.access_token);
      const userResponse = await authAPI.getMe();
      set({ user: userResponse.data, error: null });
      return { success: true };
    } catch (error) {
      set({ error: error.response?.data?.detail || 'Registration failed' });
      return { success: false, error: error.response?.data?.detail };
    }
  },

  loadUser: async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        set({ loading: false, user: null });
        return;
      }
      const response = await authAPI.getMe();
      set({ user: response.data, loading: false });
    } catch (error) {
      localStorage.removeItem('access_token');
      set({ user: null, loading: false });
    }
  },

  logout: () => {
    localStorage.removeItem('access_token');
    set({ user: null });
    window.location.href = '/login';
  },
}));
