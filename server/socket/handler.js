/**
 * Socket.IO 事件处理
 */
const logger = require('../utils/logger');

module.exports = function (io) {
  io.on('connection', (socket) => {
    logger.debug(`Socket 连接: ${socket.id}`);

    // 加入自选股房间
    socket.on('join:watchlist', (userId) => {
      socket.join(`user:${userId}`);
    });

    // 加入个股房间 (实时行情)
    socket.on('subscribe:stock', (code) => {
      socket.join(`stock:${code}`);
    });

    socket.on('unsubscribe:stock', (code) => {
      socket.leave(`stock:${code}`);
    });

    socket.on('disconnect', () => {
      logger.debug(`Socket 断开: ${socket.id}`);
    });
  });
};
