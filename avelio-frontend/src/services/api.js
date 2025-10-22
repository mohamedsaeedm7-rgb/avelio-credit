import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  changePassword: (body) => api.post('/auth/change-password', body),
};

// Receipts API
export const receiptsAPI = {
  create: (data) => api.post('/receipts', data),
  getAll: (params) => api.get('/receipts', { params }),
  getById: (id) => api.get(`/receipts/${id}`),
  downloadPDF: (id) => api.get(`/receipts/${id}/pdf`, { responseType: 'blob' }),
};

// Stats API
export const statsAPI = {
  getDashboardSummary: () => api.get('/stats/dashboard'),
  getTodayStats: () => api.get('/stats/today'),
};

export default api;