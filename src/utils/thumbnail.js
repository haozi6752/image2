// src/utils/thumbnail.js - 极轻量前端缩略图管线 (Thumbnail Pipeline)
// 专为 1K~4K 高清图与多卡片画布打造：离屏等比缩放至 ~360px 轻量 WebP/JPEG 缩略图
// 显存开销从 ~33MB/张 暴降至 ~300KB/张，释放 95%+ GPU 纹理显存，消除缩放与平移重采样开销

// 内存单例缓存表 (URL -> Thumbnail Object URL / Data URL / Promise)
const thumbnailCache = new Map();

// 活跃 Blob Object URL 追踪集合，彻底杜绝内存泄漏
const activeBlobUrls = new Set();

const registerBlobUrl = (url) => {
  if (url && typeof url === 'string' && url.startsWith('blob:')) {
    activeBlobUrls.add(url);
  }
  return url;
};

/**
 * 判断指定 Blob URL 是否为当前页面会话生成的有效活跃对象
 */
export function isBlobUrlActive(url) {
  if (!url || typeof url !== 'string') return false;
  if (!url.startsWith('blob:')) return true;
  return activeBlobUrls.has(url);
}

/**
 * 离屏等比生成轻量缩略图
 * @param {string} source 图片原图 URL、Blob URL 或 Data URL
 * @param {number} maxDimension 最大边长，默认 360px
 * @param {number} quality 压缩质量，默认 0.82
 * @returns {Promise<string>} 缩略图 Object URL 或 Data URL，如果失败或受限则安全回退原 source
 */
export async function createThumbnail(source, maxDimension = 360, quality = 0.82) {
  if (!source || typeof source !== 'string') return source;

  // 1. 如果已经缓存，直接返回已创建的缩略图地址 (或等待正在进行的 Promise)
  if (thumbnailCache.has(source)) {
    const cached = thumbnailCache.get(source);
    return cached;
  }

  // 2. 如果本身是极小的矢量 SVG，无需降采样
  if (source.startsWith('data:image/svg+xml') || source.endsWith('.svg')) {
    thumbnailCache.set(source, source);
    return source;
  }

  const promise = new Promise((resolve) => {
    const img = new Image();
    
    // 如果是远程非 Blob/非 Data 链接，声明 anonymous crossOrigin 尝试离屏 Canvas 像素提取
    if (!source.startsWith('data:') && !source.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }

    // 容错定时器：若图片加载超过 5 秒，优雅回退原图，绝不卡死主逻辑
    const timer = setTimeout(() => {
      resolve(source);
    }, 5000);

    img.onload = async () => {
      clearTimeout(timer);
      try {
        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;

        // 如果原图本身就已经小于等于设定尺寸，无需重复压缩
        if (srcW > 0 && srcH > 0 && srcW <= maxDimension && srcH <= maxDimension) {
          resolve(source);
          return;
        }

        // 计算等比缩放尺寸
        let targetW = srcW;
        let targetH = srcH;
        if (srcW > srcH) {
          if (srcW > maxDimension) {
            targetH = Math.round((srcH * maxDimension) / srcW);
            targetW = maxDimension;
          }
        } else {
          if (srcH > maxDimension) {
            targetW = Math.round((srcW * maxDimension) / srcH);
            targetH = maxDimension;
          }
        }

        targetW = Math.max(1, targetW);
        targetH = Math.max(1, targetH);

        // 优先使用 OffscreenCanvas，否则回退离屏 DOM Canvas
        let canvas = null;
        if (typeof OffscreenCanvas !== 'undefined') {
          try {
            canvas = new OffscreenCanvas(targetW, targetH);
          } catch (e) {
            canvas = document.createElement('canvas');
            canvas.width = targetW;
            canvas.height = targetH;
          }
        } else {
          canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
        }

        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) {
          resolve(source);
          return;
        }

        // 启用平滑高质量双线性/双三次重采样
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'medium';
        ctx.drawImage(img, 0, 0, targetW, targetH);

        // 异步转换为二进制 Blob 并生成极速 Object URL (非阻塞 UI 线程)
        if (canvas.convertToBlob) {
          try {
            const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
            const thumbUrl = registerBlobUrl(URL.createObjectURL(blob));
            resolve(thumbUrl);
            return;
          } catch (err) {
            // WebP 不支持时降级 JPEG
            try {
              const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
              const thumbUrl = registerBlobUrl(URL.createObjectURL(blob));
              resolve(thumbUrl);
              return;
            } catch (err2) {
              resolve(source);
              return;
            }
          }
        } else if (canvas.toBlob) {
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const thumbUrl = registerBlobUrl(URL.createObjectURL(blob));
                resolve(thumbUrl);
              } else {
                // 降级为 JPEG
                canvas.toBlob(
                  (jpegBlob) => {
                    if (jpegBlob) {
                      const thumbUrl = registerBlobUrl(URL.createObjectURL(jpegBlob));
                      resolve(thumbUrl);
                    } else {
                      resolve(source);
                    }
                  },
                  'image/jpeg',
                  quality
                );
              }
            },
            'image/webp',
            quality
          );
        } else {
          // 同步兜底 dataURL
          resolve(canvas.toDataURL('image/webp', quality));
        }
      } catch (err) {
        // 跨域或安全受限（如远程第三方 CDN 未配置 CORS 头）导致 canvas 导出受限，平滑降级使用原图
        resolve(source);
      }
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve(source);
    };

    img.src = source;
  });

  // 挂载 Promise，待完成后替换为具体结果字符串
  thumbnailCache.set(source, promise);
  promise.then((resolvedUrl) => {
    thumbnailCache.set(source, resolvedUrl);
  }).catch(() => {
    thumbnailCache.set(source, source);
  });

  return promise;
}

/**
 * 撤销单张图片的缩略图缓存并释放内存
 */
export function revokeThumbnail(source) {
  if (!source) return;
  const cached = thumbnailCache.get(source);
  if (typeof cached === 'string' && cached.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(cached);
    } catch (e) {}
    activeBlobUrls.delete(cached);
  }
  thumbnailCache.delete(source);
}

/**
 * 清空内存缩略图缓存并彻底释放所有 Object URL 内存
 */
export function clearThumbnailCache() {
  activeBlobUrls.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch (e) {}
  });
  activeBlobUrls.clear();
  thumbnailCache.clear();
}
