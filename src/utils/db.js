// src/utils/db.js - 由首席架构师设计的 IndexedDB 高性能本地存储层
// 彻底解决 localStorage 5MB 配额限制，支持海量 4K 大图与生图历史记录持久化

const DB_NAME = 'GPTImage2DB';
const DB_VERSION = 2;
const STORE_IMAGES = 'cached_images';
const STORE_RECORDS = 'image_records';

let dbPromise = null;

// 初始化并获取 IndexedDB 实例
export const initDB = () => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        db.createObjectStore(STORE_IMAGES);
      }
      if (!db.objectStoreNames.contains(STORE_RECORDS)) {
        // 创建记录存储表，以 id 为主键，并建立时间戳索引
        const recordStore = db.createObjectStore(STORE_RECORDS, { keyPath: 'id' });
        recordStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      console.error('IndexedDB 打开失败:', event.target.error);
      reject(event.target.error);
    };
  });

  return dbPromise;
};

// 缓存单张图片（支持 Blob 或 Base64 存储）
export const cacheImage = async (id, url) => {
  try {
    const db = await initDB();
    let dataToStore = null;

    if (url.startsWith('data:')) {
      dataToStore = url;
    } else {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`下载图片失败: ${response.status}`);
      }
      dataToStore = await response.blob();
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_IMAGES], 'readwrite');
      const store = tx.objectStore(STORE_IMAGES);
      const req = store.put(dataToStore, String(id));

      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.warn(`无法离线缓存图片 (id: ${id}), 使用原 URL:`, err);
    return false;
  }
};

// 获取缓存图片的本地访问链接
export const getCachedImageUrl = async (id, fallbackUrl) => {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const tx = db.transaction([STORE_IMAGES], 'readonly');
      const store = tx.objectStore(STORE_IMAGES);
      const req = store.get(String(id));

      req.onsuccess = (event) => {
        const result = event.target.result;
        if (!result) {
          resolve(fallbackUrl);
          return;
        }

        if (typeof result === 'string') {
          resolve(result);
        } else if (result instanceof Blob) {
          const objectUrl = URL.createObjectURL(result);
          resolve(objectUrl);
        } else {
          resolve(fallbackUrl);
        }
      };

      req.onerror = () => resolve(fallbackUrl);
    });
  } catch (err) {
    return fallbackUrl;
  }
};

// 保存一条历史记录到 IndexedDB（主存储，不受 localStorage 5MB 限制）
export const saveHistoryRecord = async (record) => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_RECORDS], 'readwrite');
      const store = tx.objectStore(STORE_RECORDS);
      const req = store.put(record);

      req.onsuccess = () => resolve(true);
      req.onerror = (e) => {
        console.error('保存历史记录至 IndexedDB 失败:', e.target.error);
        reject(e.target.error);
      };
    });
  } catch (err) {
    console.error('保存记录异常:', err);
    throw err;
  }
};

// 获取所有历史记录（按时间倒序排列）
export const getAllHistoryRecords = async () => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_RECORDS], 'readonly');
      const store = tx.objectStore(STORE_RECORDS);
      let req;
      if (store.indexNames.contains('timestamp')) {
        const index = store.index('timestamp');
        req = index.getAll();
      } else {
        req = store.getAll();
      }

      req.onsuccess = (e) => {
        const records = e.target.result || [];
        // 按时间倒序排序
        records.sort((a, b) => (b.timestamp || b.id) - (a.timestamp || a.id));
        resolve(records);
      };

      req.onerror = (e) => {
        console.error('读取历史记录失败:', e.target.error);
        reject(e.target.error);
      };
    });
  } catch (err) {
    console.error('获取所有记录异常:', err);
    return [];
  }
};

// 删除一条历史记录与关联缓存
export const deleteHistoryRecord = async (id) => {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const tx = db.transaction([STORE_RECORDS, STORE_IMAGES], 'readwrite');
      const recordStore = tx.objectStore(STORE_RECORDS);
      const imgStore = tx.objectStore(STORE_IMAGES);

      recordStore.delete(Number(id) || id);
      imgStore.delete(String(id));

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (err) {
    return false;
  }
};

// 清空所有历史与图片缓存
export const clearAllRecords = async () => {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const tx = db.transaction([STORE_RECORDS, STORE_IMAGES], 'readwrite');
      tx.objectStore(STORE_RECORDS).clear();
      tx.objectStore(STORE_IMAGES).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (err) {
    return false;
  }
};

// 自动从 localStorage 迁移老历史数据到 IndexedDB，并释放 localStorage 空间
export const migrateFromLocalStorage = async () => {
  try {
    const oldHistoryStr = localStorage.getItem('image_history');
    if (!oldHistoryStr) return [];

    let oldList = [];
    try {
      oldList = JSON.parse(oldHistoryStr);
    } catch (e) {
      console.warn('解析旧 localStorage 历史失败，跳过迁移');
      localStorage.removeItem('image_history');
      return [];
    }

    if (Array.isArray(oldList) && oldList.length > 0) {
      console.log(`正在将 ${oldList.length} 条旧历史记录迁移至 IndexedDB...`);
      for (const item of oldList) {
        await saveHistoryRecord(item);
        if (item.id && item.url) {
          cacheImage(item.id, item.url).catch(() => {});
        }
      }
      console.log('历史记录迁移完成，正在清理 localStorage 配额占用');
    }

    // 无论如何彻底清理 localStorage 中的 image_history，解除 5MB 限制
    localStorage.removeItem('image_history');
    return oldList;
  } catch (err) {
    console.error('数据迁移过程发生异常:', err);
    return [];
  }
};
