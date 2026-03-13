const jwt = require('jsonwebtoken');
const User = require('../models/User');

// JWT 认证中间件
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: '请先登录' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: '用户不存在或已禁用' });
    }

    req.user = user;
    req.userId = user._id;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token 已过期', code: 'TOKEN_EXPIRED' });
    }
    res.status(401).json({ success: false, message: '认证失败' });
  }
};

// RBAC 角色校验
const rbac = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: '权限不足' });
  }
  next();
};

module.exports = { auth, rbac };
