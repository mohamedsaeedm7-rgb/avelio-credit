import axios from 'axios';

// ========================================
// AXIOS INSTANCE WITH BASE CONFIGURATION
// ========================================
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5001/api/v1',
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000 // 30 second timeout
});

// ========================================
// REQUEST INTERCEPTOR - Add token to every request
// ========================================
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    
    // Add token to headers if it exists
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('🔐 Token attached to request');
    } else {
      console.warn('⚠️ No token found in localStorage');
    }
    
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// ========================================
// RESPONSE INTERCEPTOR - Handle errors globally
// ========================================
api.interceptors.response.use(
  (response) => {
    // Success response - just return it
    return response;
  },
  (error) => {
    // Handle different error scenarios
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          // Unauthorized - token invalid or expired
          console.error('🚫 Authentication failed - redirecting to login');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          break;
          
        case 403:
          // Forbidden - user doesn't have permission
          console.error('🚫 Access forbidden');
          break;
          
        case 404:
          // Not found
          console.error('🔍 Resource not found');
          break;
          
        case 500:
          // Server error
          console.error('💥 Server error:', data?.message);
          break;
          
        default:
          console.error(`❌ Error ${status}:`, data?.message);
      }
    } else if (error.request) {
      // Request was made but no response received
      console.error('📡 No response from server - check your connection');
    } else {
      // Something else happened
      console.error('❌ Request error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// ========================================
// RECEIPTS API ENDPOINTS
// ========================================
export const receiptsAPI = {
  // Create new receipt
  create: (data) => {
    console.log('📝 Creating receipt:', data);
    return api.post('/receipts', data);
  },
  
  // Get all receipts with filters
  getAll: (params) => {
    console.log('📋 Fetching receipts with params:', params);
    return api.get('/receipts', { params });
  },
  
  // Get single receipt by ID
  getById: (id) => {
    console.log('🔍 Fetching receipt:', id);
    return api.get(`/receipts/${id}`);
  },
  
  // Update receipt status
  updateStatus: (id, data) => {
    console.log('✏️ Updating receipt status:', id, data);
    return api.put(`/receipts/${id}/status`, data);
  },
  
  // Void receipt
  void: (id, reason) => {
    console.log('🗑️ Voiding receipt:', id, reason);
    return api.post(`/receipts/${id}/void`, { reason });
  },
  
  // Generate PDF
  generatePDF: (id) => {
    console.log('📄 Generating PDF for receipt:', id);
    return api.get(`/receipts/${id}/pdf`, { 
      responseType: 'blob' 
    });
  },
  
  // Download PDF (alias for generatePDF)
  downloadPDF: (id) => {
    console.log('📥 Downloading PDF for receipt:', id);
    return api.get(`/receipts/${id}/pdf`, { 
      responseType: 'blob' 
    });
  }
};

// ========================================
// AGENCIES API ENDPOINTS
// ========================================
export const agenciesAPI = {
  // Get all agencies
  getAll: (params) => {
    console.log('🏢 Fetching agencies');
    return api.get('/agencies', { params });
  },
  
  // Get single agency
  getById: (id) => {
    console.log('🏢 Fetching agency:', id);
    return api.get(`/agencies/${id}`);
  },
  
  // Create agency
  create: (data) => {
    console.log('🏢 Creating agency:', data);
    return api.post('/agencies', data);
  },
  
  // Update agency
  update: (id, data) => {
    console.log('🏢 Updating agency:', id);
    return api.put(`/agencies/${id}`, data);
  }
};

// ========================================
// AUTH API ENDPOINTS
// ========================================
export const authAPI = {
  // Login
  login: (credentials) => {
    console.log('🔐 Logging in...');
    return api.post('/auth/login', credentials);
  },
  
  // Logout
  logout: () => {
    console.log('👋 Logging out...');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  },
  
  // Get current user
  getCurrentUser: () => {
    console.log('👤 Fetching current user');
    return api.get('/auth/me');
  },
  
  // Update password
  updatePassword: (data) => {
    console.log('🔑 Updating password');
    return api.put('/auth/password', data);
  },
  
  // Change password (alias for updatePassword)
  changePassword: (data) => {
    console.log('🔑 Changing password');
    return api.post('/auth/change-password', data);
  }
};

// ========================================
// UTILITY FUNCTIONS
// ========================================
export const utils = {
  // Check if user is authenticated
  isAuthenticated: () => {
    const token = localStorage.getItem('token');
    return !!token;
  },
  
  // Get stored user data
  getUser: () => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },
  
  // Save user data
  setUser: (user) => {
    localStorage.setItem('user', JSON.stringify(user));
  },
  
  // Get token
  getToken: () => {
    return localStorage.getItem('token');
  },
  
  // Set token
  setToken: (token) => {
    localStorage.setItem('token', token);
  },
  
  // Clear all auth data
  clearAuth: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
};

export default api;