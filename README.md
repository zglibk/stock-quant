# 📊 AI 驱动的量化交易分析系统

> 基于 Vue 3 + Express + MongoDB + LLM 多模型的全栈量化交易平台

## 技术栈

| 层次 | 技术 |
|------|------|
| 前端 | Vue 3 + Vite + Element Plus + Tailwind CSS |
| K线图 | TradingView Lightweight Charts |
| 图表 | ECharts 5 |
| 后端 | Express.js (Node 20 LTS) |
| 数据库 | MongoDB 7 + Mongoose |
| 缓存 | Redis 7 + ioredis |
| AI | Claude / GPT-4o / DeepSeek (多模型网关) |
| 数据源 | 新浪 + 网易 + 东方财富 (纯 Node.js) |
| 部署 | Docker Compose + Nginx |

## 核心功能

- 📈 **行情数据** — A股日K线、实时行情、技术指标
- 🧠 **AI 智能分析** — 智能选股、策略生成、行情解读、对话问答
- 📸 **图片识别** — 截图 K 线/持仓/研报，AI 多模态识别分析
- 🔄 **策略回测** — 事件驱动回测引擎，20+ 绩效指标
- 🔔 **信号提醒** — 选股信号推送、WebSocket 实时通知

## 快速开始

```bash
# 1. 克隆项目
git clone <repo-url> && cd stock-quant

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 AI API Key 等

# 3. 安装依赖
cd server && npm install
cd ../client && npm install

# 4. 启动开发服务器
cd .. && npm run dev

# 或使用 Docker
docker compose up -d
```

## 项目结构

```
stock-quant/
├── client/          # Vue 3 前端
├── server/          # Express 后端
│   ├── services/
│   │   ├── ai/          # AI 网关 + Vision
│   │   └── dataFetcher/ # A股数据采集
│   ├── models/      # Mongoose Schema
│   ├── routes/      # API 路由
│   └── prompts/     # Prompt 模板
├── docker-compose.yml
└── .env.example
```

## License

MIT
