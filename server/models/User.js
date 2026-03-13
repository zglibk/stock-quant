const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 30 },
  password: { type: String, required: true, minlength: 6, select: false },
  role:     { type: String, enum: ['admin', 'analyst', 'viewer'], default: 'analyst' },
  nickname: { type: String, trim: true },
  email:    { type: String, trim: true },
  settings: {
    watchlist: [String],   // 自选股代码列表
    defaultProvider: String,
    theme: { type: String, default: 'dark' },
    ai: mongoose.Schema.Types.Mixed
  },
  aiUsage: {
    todayTokens: { type: Number, default: 0 },
    todayVisionCount: { type: Number, default: 0 },
    lastResetDate: { type: String }
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
