import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  changePassword: (data) => api.post('/auth/change-password', data),
};

// Workspace API
export const workspaceAPI = {
  create: (data) => api.post('/workspace/', data),
  get: () => api.get('/workspace/'),
  update: (data) => api.put('/workspace/', data),
  setupEmail: (resendApiKey) => api.post('/workspace/setup-email', null, { params: { resend_api_key: resendApiKey } }),
  testEmail: () => api.post('/workspace/test-email'),
  activate: () => api.post('/workspace/activate'),
  getOnboardingStatus: () => api.get('/workspace/onboarding-status'),
};

// Staff API
export const staffAPI = {
  create: (data) => api.post('/staff/', data),
  getAll: () => api.get('/staff/'),
  delete: (id) => api.delete(`/staff/${id}`),
};

// Booking API
export const bookingAPI = {
  create: (data) => api.post('/bookings/', data),
  getAll: (params) => api.get('/bookings/', { params }),
  getOne: (id) => api.get(`/bookings/${id}`),
  update: (id, data) => api.put(`/bookings/${id}`, data),
  getAvailability: (serviceId, date) => 
    api.get(`/bookings/availability/${serviceId}`, { params: { target_date: date } }),
};

// Service API
export const serviceAPI = {
  create: (data) => api.post('/services/', data),
  getAll: () => api.get('/services/'),
  createAvailability: (data) => api.post('/services/availability', data),
  getAvailability: () => api.get('/services/availability'),
};

// Dashboard API
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getRecentActivity: (limit = 20) => api.get('/dashboard/recent-activity', { params: { limit } }),
};

// Inventory API
export const inventoryAPI = {
  create: (data) => api.post('/inventory/', data),
  getAll: () => api.get('/inventory/'),
  update: (id, data) => api.put(`/inventory/${id}`, data),
  adjust: (id, quantityChange, reason, notes) => 
    api.post(`/inventory/${id}/adjust`, null, { 
      params: { quantity_change: quantityChange, reason, notes } 
    }),
  getAlerts: () => api.get('/inventory/alerts'),
};

// Form API
export const formAPI = {
  create: (data) => api.post('/forms/', data),
  getAll: () => api.get('/forms/'),
  getOne: (id) => api.get(`/forms/${id}`),
  getBySlug: (slug) => api.get(`/forms/public/${slug}`),
  submit: (submissionId, data) => api.post(`/forms/submissions/${submissionId}`, data),
  getSubmissions: (status) => api.get('/forms/submissions', { params: { status_filter: status } }),
};

// Inbox API
export const inboxAPI = {
  createContact: (data) => api.post('/inbox/contacts', data),
  getConversations: () => api.get('/inbox/conversations'),
  getMessages: (conversationId) => api.get(`/inbox/conversations/${conversationId}/messages`),
  sendMessage: (conversationId, data) => api.post(`/inbox/conversations/${conversationId}/messages`, data),
};

export default api;
