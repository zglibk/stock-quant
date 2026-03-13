import request from './request'

export default {
  list: () => request.get('/backtest'),
  run: (data) => request.post('/backtest/run', data)
}
