/**
 * Canvas 前端图片压缩
 * 手机拍照可能 5-10MB，压缩到 ≤2MB 再上传
 */
export function compressImage(file, maxSizeMB = 2, maxDimension = 2048) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img

        // 限制最大尺寸
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)

        // 递减 quality 直到满足大小限制
        let quality = 0.9
        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (blob.size > maxSizeMB * 1024 * 1024 && quality > 0.3) {
                quality -= 0.1
                tryCompress()
              } else {
                // 转为 File 对象保留文件名
                const compressed = new File([blob], file.name || 'image.jpg', {
                  type: 'image/jpeg',
                  lastModified: Date.now()
                })
                resolve(compressed)
              }
            },
            'image/jpeg',
            quality
          )
        }
        tryCompress()
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}
