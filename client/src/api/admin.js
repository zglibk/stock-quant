import request from './request'

export default {
  stats: () => request.get('/admin/stats')
}
