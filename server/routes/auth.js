const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

// 生成 Token 对
function generateTokens(userId) {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' });
  return { accessToken, refreshToken };
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, password, nickname } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: '用户名和密码必填' });

    const exists = await User.findOne({ username });
    if (exists) return res.status(400).json({ success: false, message: '用户名已存在' });

    const user = await User.create({ username, password, nickname: nickname || username });
    const tokens = generateTokens(user._id);

    res.status(201).json({ success: true, data: { user, ...tokens } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username, isActive: true }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    const tokens = generateTokens(user._id);
    res.json({ success: true, data: { user: user.toJSON(), ...tokens } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const tokens = generateTokens(decoded.userId);
    res.json({ success: true, data: tokens });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Refresh Token 无效' });
  }
});

// GET /api/auth/profile
router.get('/profile', auth, async (req, res) => {
  res.json({ success: true, data: req.user });
});

// PUT /api/auth/profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { nickname, email, settings } = req.body;
    const patch = {};
    if (nickname !== undefined) patch.nickname = nickname;
    if (email !== undefined) patch.email = email;
    if (settings !== undefined) patch.settings = settings;
    const user = await User.findByIdAndUpdate(req.userId,
      { $set: patch },
      { new: true, runValidators: true }
    );
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
