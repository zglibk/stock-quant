FROM node:20-alpine

WORKDIR /app

# 安装 sharp 需要的系统依赖
RUN apk add --no-cache python3 make g++ vips-dev

COPY package*.json ./
RUN npm ci --production && npm cache clean --force

COPY . .

# 内存限制 (2G 服务器优化)
ENV NODE_OPTIONS="--max-old-space-size=384"

EXPOSE 3000

CMD ["node", "app.js"]
