import axios from 'axios';

const BASE_URL = 'http://localhost:8080/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Only clear session on 401 (unauthorized / expired token)
      localStorage.removeItem('token');
      localStorage.removeItem('finance_user');
      window.location.href = '/login';
    }
    // 403 = forbidden (wrong role) — don't wipe session, just reject
    return Promise.reject(error);
  }
);

// ─── Income ────────────────────────────────────────────
export const incomeApi = {
  getAll: () => api.get('/income'),
  create: (data) => api.post('/income', data),
  update: (id, data) => api.put(`/income/${id}`, data),
  delete: (id) => api.delete(`/income/${id}`),
};

// ─── Transactions ───────────────────────────────────────
export const transactionApi = {
  getAll: () => api.get('/transactions'),
  create: (data) => api.post('/transactions', data),
  update: (id, data) => api.put(`/transactions/${id}`, data),
  delete: (id) => api.delete(`/transactions/${id}`),
  uploadCsv: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/transactions/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ─── Assets ─────────────────────────────────────────────
export const assetApi = {
  getAll: () => api.get('/assets'),
  create: (data) => api.post('/assets', data),
  update: (id, data) => api.put(`/assets/${id}`, data),
  delete: (id) => api.delete(`/assets/${id}`),
};

// ─── Liabilities ────────────────────────────────────────
export const liabilityApi = {
  getAll: () => api.get('/liabilities'),
  create: (data) => api.post('/liabilities', data),
  update: (id, data) => api.put(`/liabilities/${id}`, data),
  delete: (id) => api.delete(`/liabilities/${id}`),
};

// ─── Financial Profile ──────────────────────────────────
export const profileApi = {
  getSummary: () => api.get('/profile/summary'),
};

// ─── Retirement Planner ─────────────────────────────────
export const retirementApi = {
  calculate: (data) => api.post('/retirement/calculate', data),
  getPlan: () => api.get('/retirement/plan'),
  savePlan: (data) => api.post('/retirement/plan', data),
};

// ─── Goals ───────────────────────────────────────────────
export const goalApi = {
  getAll: () => api.get('/goals'),
  create: (data) => api.post('/goals', data),
  update: (id, data) => api.put(`/goals/${id}`, data),
  delete: (id) => api.delete(`/goals/${id}`),
  acknowledge: (id) => api.put(`/goals/${id}/acknowledge`),
};

// ─── Coach Specific ───────────────────────────────────────
export const coachApi = {
  getAssignedUsers: () => api.get('/coach/users'),
};

// ─── Chat ──────────────────────────────────────────────────
export const chatApi = {
  getHistory: (partnerId) => api.get('/chat/history', { params: { partnerId } }),
  getMyCoach: () => api.get('/chat/my-coach'),
  sendMessage: (data) => api.post('/chat/send', data),
  getUnreadCount: () => api.get('/chat/unread-count'),
  markAsRead: (partnerId) => api.put('/chat/mark-read', null, { params: { partnerId } })
};

export default api;
