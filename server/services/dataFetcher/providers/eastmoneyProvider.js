/**
 * 东方财富数据源 - 股票列表 + 基础财务
 */
const axios = require('axios');

class EastmoneyProvider {
  // 获取全 A 股列表
  async getStockList(pageSize = 5000) {
    const url = 'https://push2.eastmoney.com/api/qt/clist/get';
    const params = {
      pn: 1, pz: pageSize, po: 1,
      np: 1, ut: 'bd1d9ddb04089700cf9c27f6f7426281',
      fltt: 2, invt: 2, fid: 'f3',
      fs: 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048',  // A股
      fields: 'f12,f14,f100,f2,f3,f9,f23,f20,f21,f8' // f2:最新价, f3:涨幅, f9:PE, f23:PB, f20:总市值, f21:流通值, f8:换手
    };

    const { data } = await axios.get(url, { params, timeout: 15000 });
    if (!data?.data?.diff) return [];

    return data.data.diff.map(item => ({
      code: item.f12,
      name: item.f14,
      market: item.f12.startsWith('6') ? 'SH' : 'SZ',
      industry: item.f100 || '',
      price:          Number(item.f2) || 0,
      changePercent:  Number(item.f3) || 0,
      pe:             Number(item.f9) || 0,
      pb:             Number(item.f23) || 0,
      marketCap:      Number(item.f20) || 0,
      floatMarketCap: Number(item.f21) || 0,
      turnoverRate:   Number(item.f8) || 0,
      isActive: true
    })).filter(s => s.code && s.name && s.name !== '-');
  }
}

module.exports = new EastmoneyProvider();
