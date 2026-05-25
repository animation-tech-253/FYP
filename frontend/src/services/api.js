import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:7800/api/v1';


const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

const PUBLIC_ENDPOINTS = ['/users/me', '/departments', '/auth/login', '/auth/signup', '/auth/logout'];
const isPublicEndpoint = (url = '') => PUBLIC_ENDPOINTS.some((path) => url.includes(path));

let appInitialized = false;
export const setAppInitialized = () => { appInitialized = true; };

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url    = error.config?.url || '';
    if (status === 401 && appInitialized && !isPublicEndpoint(url)) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  signUp:  (data) => api.post('/auth/signup', data),
  signIn:  (data) => api.post('/auth/login',  data),
  signOut: ()     => api.post('/auth/logout'),
};

export const userAPI = {
  getMe:            ()           => api.get('/users/me'),
  getAll:           (params)     => api.get('/users', { params }),
  create:           (data)       => api.post('/users', data),
  update:           (id, fd)     => api.put(`/users/${id}`, fd, { headers: { 'Content-Type': undefined } }),
  deactivate:       (id)         => api.patch(`/users/${id}/deactivate`),
  toggleActive:     (id, data)   => api.patch(`/users/${id}/toggle-active`, data),
  delete:           (id)         => api.delete(`/users/${id}`),
  getStats:         ()           => api.get('/users/stats'),
  getActivity:      (id)         => api.get(`/users/${id}/activity`),
  updateMyProfile:  (fd)         => api.patch('/users/me/update', fd, { headers: { 'Content-Type': undefined } }),
  getStaffByDepartment:     (deptId)              => api.get(`/users/department/${deptId}/staff`),
  getForwardable:           (params)              => api.get('/users/forwardable', { params }),
  getSocietiesByDepartment: (deptId)              => api.get(`/users/department/${deptId}/societies`),
  getSocietyMembers:        (deptId, societyName) => api.get(`/users/department/${deptId}/societies/${encodeURIComponent(societyName)}`),
  addToSociety:             (userId, data)        => api.patch(`/users/${userId}/societies`, data),
  removeFromSociety:        (userId, data)        => api.delete(`/users/${userId}/societies`, { data }),
};

export const departmentAPI = {
  getAll:  ()         => api.get('/departments'),
  create:  (data)     => api.post('/departments', data),
  update:  (id, data) => api.patch(`/departments/${id}`, data),
  delete:  (id)       => api.delete(`/departments/${id}`),
};

export const applicationAPI = {
  submit:                 (data)    => api.post('/applications', data),
  getMyApplications:      ()        => api.get('/applications/my'),
  getForReview:           ()        => api.get('/applications/review'),
  getById:                (id)      => api.get(`/applications/${id}`),
  getAllAdmin:             (params)  => api.get('/applications/admin/all', { params }),
  process:                (id, data)=> api.patch(`/applications/${id}/process`, data),
  getPDF:                 (id)      => api.get(`/applications/${id}/pdf`, { responseType: 'blob' }),
  resolveDocumentRequest: (id)      => api.patch(`/applications/${id}/resolve-docs`),
};

export const examinerAPI = {
  getDashboard:  (params) => api.get('/applications/examiner/dashboard', { params }),
  getAnalytics:  ()       => api.get('/applications/examiner/analytics'),
  bulkProcess:   (data)   => api.patch('/applications/examiner/bulk-process', data),
};

export const hodAPI = {
  getDepartmentApplications: (params) => api.get('/applications/department', { params }),
  getDepartmentStats:        ()        => api.get('/applications/department/stats'),
  getStaffWorkload:          ()        => api.get('/applications/department/staff-workload'),
  getDepartmentAppById:      (id)      => api.get(`/applications/department/${id}`),
};

export const vcAPI = {
  getPersonal:       ()             => api.get('/vc/personal'),
  getUniversity:     ()             => api.get('/vc/university'),
  getDepartment:     (departmentId) => api.get(`/vc/department/${departmentId}`),
  getAllApplications: (params)       => api.get('/vc/applications', { params }),
  getApplicationById:(id)           => api.get(`/vc/applications/${id}`),
};

export const adminAPI = {
  getOverview:        ()             => api.get('/admin/overview'),
  getNoDeptRoles:     ()             => api.get('/admin/no-dept-roles'),
  getDepartment:      (departmentId) => api.get(`/admin/department/${departmentId}`),
  getAllApplications:  (params)       => api.get('/admin/applications', { params }),
  getApplicationById: (id)           => api.get(`/admin/applications/${id}`),
};

export const notificationAPI = {
  getAll:         ()    => api.get('/notifications'),
  getUnreadCount: ()    => api.get('/notifications/unread-count'),
  markRead:       (id)  => api.patch(`/notifications/${id}`),
  markAllRead:    ()    => api.patch('/notifications/read-all'),
  deleteOne:      (id)  => api.delete(`/notifications/${id}`),
  deleteAll:      ()    => api.delete('/notifications/delete-all'),
};

export const fileAPI = {
  upload:           (fd)            => api.post('/files', fd, { headers: { 'Content-Type': undefined } }),
  getByApplication: (applicationId) => api.get(`/files/application/${applicationId}`),
  deleteFile:       (fileId)        => api.delete(`/files/${fileId}`),
};

export const settingsAPI = {
  get:    ()     => api.get('/settings'),
  update: (data) => api.patch('/settings', data),
};

export const chatbotAPI = {
  getMessage:    (data) => api.post('/chatbot',         data),
  getSuggestion: (data) => api.post('/chatbot/suggest', data),
};

export default api;