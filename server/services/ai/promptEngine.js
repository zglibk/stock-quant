/**
 * Prompt 模板引擎
 * 从文件系统加载 .hbs 模板，渲染变量后返回
 */
const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const logger = require('../../utils/logger');

class PromptEngine {
  constructor() {
    this.templates = {};
    this.templateDir = path.join(__dirname, '../../prompts');
    this._loadTemplates();
  }

  _loadTemplates() {
    try {
      if (!fs.existsSync(this.templateDir)) {
        fs.mkdirSync(this.templateDir, { recursive: true });
        logger.warn('Prompts 目录不存在，已创建');
        return;
      }
      const files = fs.readdirSync(this.templateDir).filter(f => f.endsWith('.hbs'));
      for (const file of files) {
        const name = path.basename(file, '.hbs');
        const content = fs.readFileSync(path.join(this.templateDir, file), 'utf-8');
        this.templates[name] = Handlebars.compile(content);
      }
      logger.info(`📝 已加载 ${files.length} 个 Prompt 模板`);
    } catch (err) {
      logger.error('Prompt 模板加载失败:', err);
    }
  }

  async render(scene, context = {}) {
    const template = this.templates[scene];
    if (!template) {
      logger.warn(`Prompt 模板 "${scene}" 不存在，使用默认`);
      return context.description || context.message || '请分析';
    }
    return template(context);
  }

  // 热重载模板
  reload() {
    this.templates = {};
    this._loadTemplates();
  }
}

module.exports = new PromptEngine();
