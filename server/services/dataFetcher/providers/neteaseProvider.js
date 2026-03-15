/**
 * K线数据源（多源降级，强制 IPv4）
 * 
 * 优先: 腾讯日K (web.ifzq.gtimg.cn) — HTTPS，跟随302重定向
 * 备用: 东方财富 / 网易（阿里云ECS可能不通）
 */
const http = require('http');
const https = require('https');
const axios = require('axios');

const httpAgent = new http.Agent({ family: 4, keepAlive: true });
const httpsAgent = new https.Agent({ family: 4, keepAlive: true });

class KlineProvider {
  constructor() {
    this.sourceStatus = {};
  }

  async getDailyKline(code, year) {
    const sources = [
      { name: 'tencent', fn: () => this._fetchFromTencent(code, year) },
      { name: 'eastmoney', fn: () => this._fetchFromEastmoney(code, year) },
      { name: 'netease', fn: () => this._fetchFromNetease(code, year) },
    ];

    for (const src of sources) {
      if (this.sourceStatus[src.name] === false) continue;
      try {
        const data = await src.fn();
        if (data?.length > 0) {
          this.sourceStatus[src.name] = true;
          return data;
        }
      } catch (err) {
        if (['ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET', 'ECONNREFUSED'].includes(err.code)) {
          this.sourceStatus[src.name] = false;
          console.warn(`[Kline] ${src.name} 不可达(${err.code})，已禁用`);
        }
      }
    }
    return [];
  }

  /**
   * 腾讯日K — 直接用 HTTPS（HTTP 会 302 到 HTTPS）
   */
  async _fetchFromTencent(code, year) {
    const symbol = (code.startsWith('6') || code.startsWith('5') || code.startsWith('9'))
      ? `sh${code}` : `sz${code}`;

    const { data } = await axios.get('https://web.ifzq.gtimg.cn/appstock/app/fqkline/get', {
      params: { param: `${symbol},day,${year}-01-01,${year}-12-31,640,qfq` },
      httpsAgent,
      timeout: 15000,
      maxRedirects: 3,
    });

    const stockData = data?.data?.[symbol];
    const klines = stockData?.qfqday || stockData?.day || [];
    if (!Array.isArray(klines)) return [];

    return klines
      .filter(k => Array.isArray(k) && k.length >= 6)
      .map(k => ({
        code,
        date: k[0],
        open: Number(k[1]) || 0,
        close: Number(k[2]) || 0,
        high: Number(k[3]) || 0,
        low: Number(k[4]) || 0,
        volume: Number(k[5]) || 0,
        amount: 0,
      }));
  }

  async _fetchFromEastmoney(code, year) {
    const secid = (code.startsWith('6') || code.startsWith('5') || code.startsWith('9'))
      ? `1.${code}` : `0.${code}`;
    const { data } = await axios.get('https://push2his.eastmoney.com/api/qt/stock/kline/get', {
      params: {
        secid, klt: 101, fqt: 1,
        beg: `${year}0101`, end: `${year}1231`,
        fields1: 'f1,f2,f3,f4,f5,f6',
        fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
        ut: 'fa5fd1943c7b386f172d6893dbfba10b'
      },
      httpAgent, httpsAgent, timeout: 20000,
      headers: { 'Referer': 'https://quote.eastmoney.com/', 'User-Agent': 'Mozilla/5.0' }
    });
    return (data?.data?.klines || []).map(row => {
      const p = String(row).split(',');
      return { code, date: p[0], open: +p[1]||0, close: +p[2]||0, high: +p[3]||0, low: +p[4]||0, volume: +p[5]||0, amount: +p[6]||0 };
    });
  }

  async _fetchFromNetease(code, year) {
    const symbol = (code.startsWith('6') || code.startsWith('5')) ? `0${code}` : `1${code}`;
    const { data } = await axios.get(`https://img1.money.126.net/data/hs/kline/day/history/${year}/${symbol}.json`, {
      timeout: 15000, httpsAgent, headers: { 'Referer': 'https://money.163.com/' }
    });
    if (!data?.data) return [];
    return data.data.map(d => ({
      code, date: this._fmtDate(d[0]), open: d[1], close: d[2], high: d[3], low: d[4], volume: d[5], amount: d[6]
    }));
  }

  _fmtDate(s) { return s.includes('-') ? s : `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`; }
}

module.exports = new KlineProvider();
