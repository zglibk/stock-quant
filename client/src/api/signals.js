import request from './request'

export default {
  list: (params) => request.get('/signals', { params }),
  markRead: (id) => request.patch(`/signals/${id}/read`),
  markAllRead: () => request.patch('/signals/read-all')
}
