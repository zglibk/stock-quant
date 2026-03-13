/**
 * 网易财经数据源 - 历史日K线
 */
const axios = require('axios');

class NeteaseProvider {
  constructor() {
    this.neteaseBlocked = false;
  }

  async getDailyKline(code, year) {
    if (this.neteaseBlocked) {
      return this.getDailyKlineFromEastmoney(code, year);
    }
    const symbol = this._toNeteaseSymbol(code);
    const url = `https://img1.money.126.net/data/hs/kline/day/history/${year}/${symbol}.json`;

    try {
      const { data } = await axios.get(url, { timeout: 15000 });
      if (!data || !data.data) return [];

      return data.data.map(d => ({
        code,
        date: this._formatDate(d[0]),
        open: d[1],
        close: d[2],
        high: d[3],
        low: d[4],
        volume: d[5],
        amount: d[6]
      }));
    } catch (err) {
      if (err.response?.status === 404) return [];
      if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') {
        this.neteaseBlocked = true;
        return this.getDailyKlineFromEastmoney(code, year);
      }
      if (err.response?.status === 403 || err.response?.status === 451) {
        return this.getDailyKlineFromEastmoney(code, year);
      }
      throw err;
    }
  }

  async getDailyKlineFromEastmoney(code, year) {
    const secid = this._toEastmoneySecid(code);
    const url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get';
    const params = {
      secid,
      klt: 101,
      fqt: 1,
      beg: `${year}0101`,
      end: `${year}1231`,
      fields1: 'f1,f2,f3,f4,f5,f6',
      fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
      ut: 'fa5fd1943c7b386f172d6893dbfba10b'
    };
    const { data } = await axios.get(url, { params, timeout: 15000 });
    const rows = data?.data?.klines || [];
    return rows.map((row) => {
      const parts = String(row).split(',');
      return {
        code,
        date: parts[0],
        open: Number(parts[1]) || 0,
        close: Number(parts[2]) || 0,
        high: Number(parts[3]) || 0,
        low: Number(parts[4]) || 0,
        volume: Number(parts[5]) || 0,
        amount: Number(parts[6]) || 0
      };
    });
  }

  _toEastmoneySecid(code) {
    if (String(code).startsWith('6') || String(code).startsWith('5') || String(code).startsWith('9')) {
      return `1.${code}`;
    }
    return `0.${code}`;
  }

  _toNeteaseSymbol(code) {
    if (code.startsWith('6') || code.startsWith('5')) return `0${code}`;
    return `1${code}`;
  }

  _formatDate(dateStr) {
    if (dateStr.includes('-')) return dateStr;
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
}

module.exports = new NeteaseProvider();
