/**
 * 图片处理器 - sharp 压缩 + Base64 转换
 * 针对 2G 内存服务器优化：不落盘，处理完立即释放
 */
const sharp = require('sharp');

class ImageProcessor {
  async process(buffer, options = {}) {
    // 降级分辨率以避免 Base64 过大导致 API 报错 (400 Bad Request)
    const { maxDimension = 1024, quality = 80 } = options;

    const compressed = await sharp(buffer)
      .resize(maxDimension, maxDimension, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality })
      .toBuffer();

    return {
      base64: compressed.toString('base64'),
      mediaType: 'image/jpeg',
      size: compressed.length,
      originalSize: buffer.length
    };
  }
}

module.exports = new ImageProcessor();
