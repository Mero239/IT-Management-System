import axios from 'axios'

// In production, point VITE_API_URL at the deployed backend (e.g. Railway),
// e.g. https://my-backend.up.railway.app/api — falls back to the dev proxy locally.
export const API_BASE = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({ baseURL: API_BASE })

export const departmentsApi = {
  list: () => api.get('/departments/'),
  create: (data) => api.post('/departments/', data),
  update: (id, data) => api.put(`/departments/${id}`, data),
  delete: (id) => api.delete(`/departments/${id}`),
}

export const assetsApi = {
  list: (params) => api.get('/assets/', { params }),
  get: (id) => api.get(`/assets/${id}`),
  create: (data) => api.post('/assets/', data),
  update: (id, data) => api.put(`/assets/${id}`, data),
  delete: (id) => api.delete(`/assets/${id}`),
}

export const requestsApi = {
  list: (params) => api.get('/requests/', { params }),
  get: (id) => api.get(`/requests/${id}`),
  create: (data) => api.post('/requests/', data),
  update: (id, data) => api.put(`/requests/${id}`, data),
  updateStatus: (id, status) => api.patch(`/requests/${id}/status`, null, { params: { status } }),
  delete: (id) => api.delete(`/requests/${id}`),
}

export const ticketsApi = {
  list: (params) => api.get('/tickets/', { params }),
  engineerStats: (engineer_name) => api.get('/tickets/engineer-stats', { params: { engineer_name } }),
  get: (id) => api.get(`/tickets/${id}`),
  create: (data) => api.post('/tickets/', data),
  update: (id, data) => api.put(`/tickets/${id}`, data),
  updateStatus: (id, status, assigned_to, resolution) =>
    api.patch(`/tickets/${id}/status`, null, { params: { status, assigned_to, resolution } }),
  assign: (id, engineer_name) =>
    api.patch(`/tickets/${id}/assign`, null, { params: { engineer_name } }),
  knowledgeBase: (params) => api.get('/tickets/knowledge-base', { params }),
  adminLog: (params) => api.get('/tickets/admin-log', { params }),
  listComments: (id) => api.get(`/tickets/${id}/comments`),
  addComment: (id, data) => api.post(`/tickets/${id}/comments`, data),
  deleteComment: (ticketId, commentId) => api.delete(`/tickets/${ticketId}/comments/${commentId}`),
  delete: (id) => api.delete(`/tickets/${id}`),
}

export const reportsApi = {
  stats: () => api.get('/reports/stats'),
  byType: () => api.get('/reports/assets-by-type'),
  byStatus: () => api.get('/reports/assets-by-status'),
  byDepartment: () => api.get('/reports/assets-by-department'),
  ticketsByPriority: () => api.get('/reports/tickets-by-priority'),
  bySoftware: () => api.get('/reports/by-software'),
  adminDashboard:   () => api.get('/reports/admin-dashboard'),
  advanced: (days) => api.get('/reports/advanced', { params: { days } }),
}

export const engineersApi = {
  list: () => api.get('/engineers/'),
  create: (data) => api.post('/engineers/', data),
  update: (id, data) => api.put(`/engineers/${id}`, data),
  setPermission: (id, level) => api.patch(`/engineers/${id}/permission`, null, { params: { permission_level: level } }),
  setActive: (id, active) => api.patch(`/engineers/${id}/active`, null, { params: { active } }),
  stats: (id) => api.get(`/engineers/${id}/stats`),
  permissionMatrix: () => api.get('/engineers/permission-matrix'),
  resetPassword: (id) => api.post(`/auth/reset-password/${id}`),
  delete: (id) => api.delete(`/engineers/${id}`),
}

export const licensedSoftwareApi = {
  list: (params) => api.get('/licensed-software/', { params }),
  create: (data) => api.post('/licensed-software/', data),
  update: (id, data) => api.put(`/licensed-software/${id}`, data),
  delete: (id) => api.delete(`/licensed-software/${id}`),
}

export const agreementsApi = {
  list: () => api.get('/agreements/'),
  upload: (formData) => api.post('/agreements/', formData),
  delete: (id) => api.delete(`/agreements/${id}`),
  downloadUrl: (id) => `${API_BASE}/agreements/${id}/download`,
}

export const ticketRoutingApi = {
  list: () => api.get('/ticket-routing/'),
  create: (data) => api.post('/ticket-routing/', data),
  update: (id, data) => api.put(`/ticket-routing/${id}`, data),
  delete: (id) => api.delete(`/ticket-routing/${id}`),
}

export const authApi = {
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  confirmReset:   (token, new_password) => api.post('/auth/confirm-reset', { token, new_password }),
  confirmOtp:     (email, code, new_password) => api.post('/auth/confirm-otp', { email, code, new_password }),
  updateProfile:  (data) => api.patch('/auth/profile', data),
}

export const notificationsApi = {
  list: (params) => api.get('/notifications/', { params }),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/mark-all-read'),
}

export default api
