import request from './request'

export default {
  login: (username, password) => request.post('/auth/login', { username, password }),
  register: (username, password, nickname) => request.post('/auth/register', { username, password, nickname }),
  getProfile: () => request.get('/auth/profile'),
  updateProfile: (data) => request.put('/auth/profile', data),
  refresh: (refreshToken) => request.post('/auth/refresh', { refreshToken }),
}
