// src/utils/db.js - 由首席架构师设计的 IndexedDB 本地图片缓存工具

const DB_NAME = 'GPTImage2DB';
const DB_VERSION = 1;
const STORE_NAME = 'cached_images';

let dbInstance = null;

// 初始化 IndexedDB 数据库
export const initDB = () => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('IndexedDB 打开失败:', event.target.error);
      reject(event.target.error);
    };
  });
};

// 缓存图片：将 URL 对应的图片以下载 Blob 形式存入数据库
export const cacheImage = async (id, url) => {
  try {
    const db = await initDB();
    let dataToStore = null;

    if (url.startsWith('data:')) {
      // 已经是 base64 格式，直接存储
      dataToStore = url;
    } else {
      // 通过 fetch 下载为 Blob 存储
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`下载图片失败: ${response.status}`);
      }
      dataToStore = await response.blob();
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(dataToStore, String(id));

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.warn(`无法离线缓存图片 (id: ${id}), 回退为使用原 URL:`, err);
    // 即使缓存失败也返回 true，不中断主流程
    return false;
  }
};

// 获取缓存图片的本地访问链接 (ObjectURL 或 Base64)
export const getCachedImageUrl = async (id, fallbackUrl) => {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(String(id));

      request.onsuccess = (event) => {
        const result = event.target.result;
        if (!result) {
          // 没找到缓存，返回原 URL
          resolve(fallbackUrl);
          return;
        }

        if (typeof result === 'string') {
          // 是 base64 字符串直接返回
          resolve(result);
        } else if (result instanceof Blob) {
          // 是 Blob 则转换为本地 ObjectURL
          const objectUrl = URL.createObjectURL(result);
          resolve(objectUrl);
        } else {
          resolve(fallbackUrl);
        }
      };

      request.onerror = () => {
        resolve(fallbackUrl);
      };
    });
  } catch (err) {
    return fallbackUrl;
  }
};

// 删除缓存图片
export const deleteCachedImage = async (id) => {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(String(id));

      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  } catch (err) {
    return false;
  }
};

// 清空所有缓存
export const clearAllCachedImages = async () => {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  } catch (err) {
    return false;
  }
};
