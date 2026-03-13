import request from './request'

export default {
  getStocks: (params) => request.get('/stocks', { params }),
  getStock: (code) => request.get(`/stocks/${code}`),
  getKline: (code, params) => request.get(`/market/kline/${code}`, { params }),
  getIndicators: (code, params) => request.get(`/market/indicators/${code}`, { params }),
  syncData: () => request.post('/market/sync'),
}
