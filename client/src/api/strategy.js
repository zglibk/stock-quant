import request from './request'

export default {
  list: () => request.get('/strategy'),
  create: (data) => request.post('/strategy', data),
  update: (id, data) => request.put(`/strategy/${id}`, data),
  remove: (id) => request.delete(`/strategy/${id}`)
}
