<template>
  <div class="gallery-container">
    <!-- 瀑布流/网格排版 -->
    <div v-if="items.length > 0 || isGenerating" class="image-grid">
      <!-- 正在生成中的骨架屏占位 -->
      <div v-if="isGenerating" class="image-card skeleton-card glass-panel">
        <div class="skeleton-media skeleton">
          <div class="spinner-container">
            <svg class="spinner-large" viewBox="0 0 50 50">
              <circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="4"></circle>
            </svg>
            <span class="loading-label">正在构思奇妙画面...</span>
          </div>
        </div>
        <div class="card-info skeleton-info">
          <div class="skeleton-text skeleton" style="width: 80%; height: 14px;"></div>
          <div class="skeleton-text skeleton" style="width: 40%; height: 10px; margin-top: 6px;"></div>
        </div>
      </div>

      <!-- 历史图片列表 -->
      <div 
        v-for="item in items" 
        :key="item.id" 
        class="image-card glass-panel"
        @click="preview(item)"
      >
        <div class="media-container">
          <img :src="item.url" :alt="item.prompt" class="gallery-img" loading="lazy" />
          
          <!-- 悬浮操作面板 -->
          <div class="card-overlay" @click.stop>
            <div class="overlay-header">
              <span class="size-badge">{{ item.width }}x{{ item.height }}</span>
              <span class="model-badge">{{ item.model || 'gpt-image-2' }}</span>
            </div>
            
            <div class="overlay-body">
              <p class="overlay-prompt" :title="item.prompt">{{ item.prompt }}</p>
            </div>

            <div class="overlay-footer">
              <!-- 重用提示词 -->
              <button class="action-btn" @click="reusePrompt(item.prompt)" title="重用提示词">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>
              </button>
              
              <!-- 复制提示词 -->
              <button class="action-btn" @click="copyText(item.prompt)" title="复制提示词">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </button>

              <!-- 下载图片 -->
              <button class="action-btn" @click="downloadImage(item)" title="保存到本地">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              </button>

              <!-- 删除图片 -->
              <button class="action-btn delete-btn" @click="deleteItem(item.id)" title="删除记录">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              </button>
            </div>
          </div>
        </div>

        <div class="card-info">
          <p class="card-prompt">{{ item.prompt }}</p>
          <span class="card-time">{{ formatTime(item.timestamp) }}</span>
        </div>
      </div>
    </div>

    <!-- 空状态提示 -->
    <div v-else class="empty-state">
      <div class="empty-icon-wrapper">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
      </div>
      <h2>开启你的艺术创作</h2>
      <p>在下方输入框中描述你的奇思妙想，点击“生成图片”即可开始画作。</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  items: Array,
  isGenerating: Boolean
});

const emit = defineEmits(['preview', 'reuse-prompt', 'delete', 'show-toast']);

const preview = (item) => {
  emit('preview', item);
};

const reusePrompt = (promptText) => {
  emit('reuse-prompt', promptText);
};

const deleteItem = (id) => {
  if (confirm('确认删除这张生成的图片记录吗？')) {
    emit('delete', id);
  }
};

const copyText = (text) => {
  navigator.clipboard.writeText(text)
    .then(() => {
      emit('show-toast', { message: '提示词已成功复制到剪贴板！', type: 'success' });
    })
    .catch(() => {
      emit('show-toast', { message: '复制失败，请重试', type: 'error' });
    });
};

const downloadImage = (item) => {
  // 由于可能存在跨域问题，我们先尝试通过 fetch 转为 blob 下载，若失败则回退至 direct open
  emit('show-toast', { message: '开始保存图片...', type: 'info' });
  fetch(item.url)
    .then(res => res.blob())
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `gpt-image-${item.id || Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      emit('show-toast', { message: '图片已成功保存到您的电脑！', type: 'success' });
    })
    .catch(err => {
      console.error('Download failed via blob', err);
      // 回退方案：在新窗口中打开图片
      window.open(item.url, '_blank');
      emit('show-toast', { message: '下载失败，已在新窗口中打开图片，请右键保存。', type: 'warning' });
    });
};

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};
</script>

<style scoped>
.gallery-container {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 24px;
}

/* 网格瀑布流 */
.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.image-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), box-shadow 0.3s ease;
  cursor: pointer;
  height: max-content;
}

.image-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4);
}

.media-container {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1; /* 默认比例，实际按生成图片大小或适应填充 */
  background: rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.gallery-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}

.image-card:hover .gallery-img {
  transform: scale(1.04);
}

/* 悬浮遮罩 */
.card-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(to bottom, rgba(6, 9, 19, 0.4) 0%, rgba(6, 9, 19, 0.8) 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 16px;
  pointer-events: none;
}

.image-card:hover .card-overlay {
  opacity: 1;
  pointer-events: auto;
}

.overlay-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.size-badge, .model-badge {
  font-size: 0.7rem;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255,255,255,0.1);
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 500;
  color: #fff;
  backdrop-filter: blur(4px);
}

.overlay-body {
  margin-top: auto;
  margin-bottom: 12px;
}

.overlay-prompt {
  font-size: 0.85rem;
  line-height: 1.4;
  color: var(--text-primary);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-shadow: 0 2px 4px rgba(0,0,0,0.5);
}

.overlay-footer {
  display: flex;
  gap: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 10px;
}

.action-btn {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
  border-radius: 8px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-fast);
}

.action-btn:hover {
  background: var(--primary-gradient);
  color: #ffffff;
}

.action-btn.delete-btn:hover {
  background: var(--color-error);
}

/* 卡片下方说明栏 */
.card-info {
  padding: 14px 16px;
  border-top: 1px solid var(--border-color);
}

.card-prompt {
  font-size: 0.85rem;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}

.card-time {
  font-size: 0.75rem;
  color: var(--text-muted);
  display: block;
  margin-top: 4px;
}

/* 骨架屏占位卡片 */
.skeleton-card {
  cursor: default;
}

.skeleton-card:hover {
  transform: none;
  box-shadow: var(--glass-shadow);
}

.skeleton-media {
  width: 100%;
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.spinner-large {
  animation: rotate 2s linear infinite;
  width: 36px;
  height: 36px;
}

.spinner-large .path {
  stroke: var(--accent-color);
  stroke-linecap: round;
  animation: dash 1.5s ease-in-out infinite;
}

.loading-label {
  font-size: 0.8rem;
  color: var(--text-secondary);
  animation: pulse 1.5s ease-in-out infinite;
}

.skeleton-info {
  display: flex;
  flex-direction: column;
  padding: 14px 16px;
}

.skeleton-text {
  border-radius: 4px;
}

/* 空白状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60vh;
  text-align: center;
  max-width: 420px;
  margin: 0 auto;
}

.empty-icon-wrapper {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border-color);
  border-radius: 30px;
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  color: var(--text-muted);
}

.empty-icon {
  width: 40px;
  height: 40px;
}

.empty-state h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 10px;
  background: linear-gradient(135deg, #a5b4fc 0%, #e0e7ff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.empty-state p {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.6;
}
</style>
