import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');


    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    } else {
      console.warn(`⚠️  No token found for ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ========== AUTH API ==========
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

// ========== WORKSPACE API ==========
export const workspaceAPI = {
  get: () => api.get('/workspaces/me'),
  update: (data) => api.put('/workspaces/me', data),
  activate: () => api.post('/workspaces/activate'),
  generateDummyData: () => api.post('/workspaces/generate-dummy-data'),
  testEmail: (email) => api.post('/workspaces/test-email', { test_email: email }),
};

// ========== DASHBOARD API ==========
export const dashboardAPI = {
  get: () => api.get('/dashboard'),
  getAnalytics: () => api.get('/dashboard/analytics'),
};

// ========== CONTACTS API ==========
export const contactsAPI = {
  list: (params) => api.get('/contacts', { params }),
  create: (data) => api.post('/contacts', data),
  get: (id) => api.get(`/contacts/${id}`),
  update: (id, data) => api.put(`/contacts/${id}`, data),
};

// ========== SERVICES API ==========
export const servicesAPI = {
  list: () => api.get('/services'),
  create: (data) => api.post('/services', data),
  get: (id) => api.get(`/services/${id}`),
  update: (id, data) => api.put(`/services/${id}`, data),
};

// ========== BOOKINGS API ==========
export const bookingsAPI = {
  list: (params) => api.get('/bookings', { params }),
  create: (data) => api.post('/bookings', data),
  get: (id) => api.get(`/bookings/${id}`),
  update: (id, data) => api.put(`/bookings/${id}`, data),
  validateTime: (params) => api.get('/availability/validate', { params }),
  getTodayDetailed: () => api.get('/bookings/today/detailed'),
};

// ========== FORMS API ==========
export const formsAPI = {
  list: () => api.get('/forms'),
  create: (data) => api.post('/forms', data),
  get: (id) => api.get(`/forms/${id}`),
  getFormSubmission: (id) => api.get(`/forms/${id}/submissions`),
  getFormIdAnalytics: (id) => api.get(`/forms/${id}/analytics`),
  update: (id, data) => api.put(`/forms/${id}`, data),
  listSubmissions: (params) => api.get('/form-submissions', { params }),
  getFormSubmissions: (formId) => api.get(`/forms/${formId}/submissions`),
  getFormAnalytics: (formId) => api.get(`/forms/${formId}/analytics`),
};

// ========== INVENTORY API ==========
export const inventoryAPI = {
  list: () => api.get('/inventory'),
  create: (data) => api.post('/inventory', data),
  get: (id) => api.get(`/inventory/${id}`),
  update: (id, data) => api.put(`/inventory/${id}`, data),
  createTransaction: (data) => api.post('/inventory/transactions', data),
};

// ========== INBOX API ==========
export const inboxAPI = {
  listConversations: () => api.get('/conversations'),
  getConversation: (id) => api.get(`/conversations/${id}`),
  sendMessage: (conversationId, data) => api.post(`/conversations/${conversationId}/messages`, data),
};

export const emailConnectionAPI = {
  get: () => api.get('/email-connection'),
  save: (data) => api.post('/email-connection', data),
  test: (data) => api.post('/email-connection/test', data),
  disconnect: () => api.delete('/email-connection'),
  syncNow: () => api.post('/email-connection/sync'),
}


// ========== STAFF API ==========
export const staffAPI = {
  list: () => api.get('/staff'),
  create: (data) => api.post('/staff', data),
  delete: (id) => api.delete(`/staff/${id}`),
};

// ========== EMAIL TEMPLATES API ==========
export const emailTemplatesAPI = {
  list: () => api.get('/email-templates'),
  create: (data) => api.post('/email-templates', data),
  update: (id, data) => api.put(`/email-templates/${id}`, data),
}

// ========== PUBLIC API (No Auth) ==========
export const publicAPI = {
  captureLead: (slug, data) => axios.post(`${API_URL}/public/leads/${slug}`, data),
  getWorkspace: (slug) => axios.get(`${API_URL}/public/workspaces/${slug}`),
  getServices: (slug) => axios.get(`${API_URL}/public/services/${slug}`),
  getAvailability: (slug, serviceId, date) => 
    axios.get(`${API_URL}/public/availability/${slug}/${serviceId}`, { params: { date } }),
  createBooking: (slug, data) => axios.post(`${API_URL}/public/bookings/${slug}`, data),
  getForm: (token) => axios.get(`${API_URL}/public/forms/${token}`),
  submitForm: (token, data) => axios.post(`${API_URL}/public/forms/${token}/submit`, data),
};


export default api;