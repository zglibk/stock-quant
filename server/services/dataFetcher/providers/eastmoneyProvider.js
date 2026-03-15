/**
 * A股数据源 - 腾讯行情接口（主）+ 东方财富（备）
 * 支持 onProgress 回调汇报进度
 */
const http = require('http');
const https = require('https');
const axios = require('axios');
const iconv = require('iconv-lite');

const httpAgent = new http.Agent({ family: 4, keepAlive: true });
const httpsAgent = new https.Agent({ family: 4, keepAlive: true });

class StockListProvider {
  async getStockList(onProgress) {
    const methods = [
      { name: '腾讯行情', fn: () => this._fetchFromTencent(onProgress) },
      { name: '东方财富', fn: () => this._fetchFromEastmoney(onProgress) },
    ];
    for (const m of methods) {
      try {
        console.log(`[StockList] 尝试: ${m.name}...`);
        const result = await m.fn();
        if (result?.length > 100) {
          console.log(`[StockList] ${m.name} 成功: ${result.length} 只`);
          return result;
        }
      } catch (err) {
        console.warn(`[StockList] ${m.name} 失败: ${err.code || ''} ${err.message}`);
      }
    }
    throw new Error('所有数据源不可用。请在ECS执行: curl -s "http://qt.gtimg.cn/q=sh603612"');
  }

  async _fetchFromTencent(onProgress) {
    const allCodes = this._generateCodes();
    const totalCodes = allCodes.length;
    const allStocks = [];
    const batchSize = 80;
    const startTime = Date.now();

    if (onProgress) onProgress({ totalCodes, processedCodes: 0, validStocks: 0, phase: 'fetching' });

    for (let i = 0; i < totalCodes; i += batchSize) {
      const batch = allCodes.slice(i, i + batchSize);
      const symbols = batch.map(c => (c.startsWith('6') || c.startsWith('5') || c.startsWith('9')) ? `sh${c}` : `sz${c}`);

      try {
        const { data } = await axios.get(`http://qt.gtimg.cn/q=${symbols.join(',')}`, {
          httpAgent, timeout: 15000, responseType: 'arraybuffer',
        });
        const stocks = this._parseTencent(iconv.decode(data, 'gbk'));
        allStocks.push(...stocks);
      } catch (err) {
        if (i === 0) throw err;
      }

      if (onProgress) {
        onProgress({
          totalCodes,
          processedCodes: Math.min(i + batchSize, totalCodes),
          validStocks: allStocks.length,
          phase: 'fetching',
        });
      }

      if (i + batchSize < totalCodes) await new Promise(r => setTimeout(r, 100));
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[StockList] 腾讯查询完成: ${allStocks.length} 只, ${elapsed}s`);
    return allStocks;
  }

  _parseTencent(text) {
    const stocks = [];
    for (const line of text.split(';').filter(l => l.includes('="'))) {
      try {
        const m = line.match(/v_(\w+)="(.*)"/);
        if (!m?.[2]) continue;
        const f = m[2].split('~');
        if (f.length < 45 || !f[1] || !f[2]) continue;
        const price = parseFloat(f[3]) || 0;
        if (price <= 0) continue;
        stocks.push({
          code: f[2], name: f[1],
          market: f[2].startsWith('6') ? 'SH' : 'SZ',
          industry: '',  // 腾讯接口不含行业字段，后续通过 syncIndustry 补充
          price,
          changePercent: parseFloat(f[32]) || 0,
          pe: parseFloat(f[39]) || 0,
          pb: parseFloat(f[46]) || 0,
          marketCap: (parseFloat(f[45]) || 0) * 10000,
          floatMarketCap: (parseFloat(f[44]) || 0) * 10000,
          turnoverRate: parseFloat(f[38]) || 0,
          isActive: true,
        });
      } catch {}
    }
    return stocks;
  }

  _generateCodes() {
    const codes = [];
    for (let i = 600000; i <= 603999; i++) codes.push(String(i));
    for (let i = 605000; i <= 605599; i++) codes.push(String(i));
    for (let i = 688000; i <= 688599; i++) codes.push(String(i));
    for (let i = 1; i <= 2999; i++) codes.push(String(i).padStart(6, '0'));
    for (let i = 300001; i <= 301599; i++) codes.push(String(i));
    return codes;
  }

  async _fetchFromEastmoney(onProgress) {
    const { data } = await axios.get('https://push2.eastmoney.com/api/qt/clist/get', {
      params: {
        pn: 1, pz: 6000, po: 1, np: 1,
        ut: 'bd1d9ddb04089700cf9c27f6f7426281',
        fltt: 2, invt: 2, fid: 'f3',
        fs: 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048',
        fields: 'f12,f14,f100,f2,f3,f9,f23,f20,f21,f8',
      },
      httpsAgent, httpAgent, timeout: 30000,
      headers: { 'Referer': 'https://quote.eastmoney.com/', 'User-Agent': 'Mozilla/5.0' }
    });
    if (!data?.data?.diff) return [];
    const stocks = data.data.diff
      .map(item => ({
        code: String(item.f12 || ''), name: String(item.f14 || ''),
        market: String(item.f12 || '').startsWith('6') ? 'SH' : 'SZ',
        industry: String(item.f100 || ''),
        price: Number(item.f2) || 0, changePercent: Number(item.f3) || 0,
        pe: Number(item.f9) || 0, pb: Number(item.f23) || 0,
        marketCap: Number(item.f20) || 0, floatMarketCap: Number(item.f21) || 0,
        turnoverRate: Number(item.f8) || 0, isActive: true,
      }))
      .filter(s => s.code && s.name && s.name !== '-' && s.code.length === 6);
    if (onProgress) onProgress({ totalCodes: stocks.length, processedCodes: stocks.length, validStocks: stocks.length, phase: 'fetching' });
    return stocks;
  }
}

module.exports = new StockListProvider();
