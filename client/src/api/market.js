import request from './request'

export default {
  getStocks: (params = {}) => {
    const query = { ...params }
    if (query.q && !query.keyword) {
      query.keyword = query.q
      delete query.q
    }
    return request.get('/stocks', { params: query })
  },
  getStock: (code) => request.get(`/stocks/${code}`),
  getKline: (code, params) => request.get(`/market/kline/${code}`, { params }),
  getIndicators: (code, params) => request.get(`/market/indicators/${code}`, { params }),
  getRealtime: (codes) => request.get(`/market/realtime/${codes.join(',')}`),
  getOverview: () => request.get('/market/overview'),
  syncData: (body) => request.post('/market/sync', body),
  getSyncStatus: () => request.get('/market/sync/status'),
  calcIndicators: (codes) => request.post('/market/calc-indicators', { codes }),
}
