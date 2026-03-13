/**
 * 新浪财经数据源 - 实时行情 + 分钟K线
 */
const axios = require('axios');
const iconv = require('iconv-lite');

class SinaProvider {
  constructor() {
    this.baseURL = 'https://hq.sinajs.cn';
    this.headers = { Referer: 'https://finance.sina.com.cn' };
  }

  // 获取实时行情 (支持批量)
  async getRealtime(codes) {
    const symbols = codes.map(c => {
      if (c.startsWith('6') || c.startsWith('5')) return `sh${c}`;
      return `sz${c}`;
    });

    const url = `${this.baseURL}/list=${symbols.join(',')}`;
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: this.headers,
      timeout: 10000
    });

    const text = iconv.decode(res.data, 'gb2312');
    return this._parseRealtimeText(text);
  }

  _parseRealtimeText(text) {
    return text.split(';\n').filter(Boolean).map(line => {
      const match = line.match(/hq_str_(\w+)="(.*)"/);
      if (!match || !match[2]) return null;

      const [symbol, rawData] = [match[1], match[2]];
      const f = rawData.split(',');
      if (f.length < 32) return null;

      return {
        code: symbol.slice(2),
        name: f[0],
        open: +f[1],
        prevClose: +f[2],
        price: +f[3],
        high: +f[4],
        low: +f[5],
        bid: +f[6],
        ask: +f[7],
        volume: +f[8],
        amount: +f[9],
        date: f[30],
        time: f[31],
        changePercent: f[2] > 0 ? (((+f[3] - +f[2]) / +f[2]) * 100).toFixed(2) : '0.00'
      };
    }).filter(Boolean);
  }

  // 获取分钟K线
  async getMinuteKline(code, scale = 60, datalen = 200) {
    const symbol = (code.startsWith('6') || code.startsWith('5')) ? `sh${code}` : `sz${code}`;
    const url = `https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData`;
    const res = await axios.get(url, {
      params: { symbol, scale, ma: 'no', datalen },
      timeout: 10000
    });
    return res.data;
  }
}

module.exports = new SinaProvider();
