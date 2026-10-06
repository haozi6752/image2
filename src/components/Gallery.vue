<template>
  <div class="gallery-container">
    <!-- 画廊顶部信息与工具栏 -->
    <div v-if="items.length > 0" class="gallery-toolbar glass-panel">
      <div class="toolbar-left">
        <span class="gallery-title">画作档案库</span>
        <span class="gallery-badge">{{ filteredItems.length }} / {{ items.length }} 张</span>
      </div>

      <div class="toolbar-right">
        <!-- 搜索提示词过滤 -->
        <div class="search-box">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input 
            v-model="searchKeyword" 
            type="text" 
            placeholder="搜索提示词或模型..." 
            class="search-input"
          />
          <button v-if="searchKeyword" class="clear-search-btn" @click="searchKeyword = ''">×</button>
        </div>

        <!-- 清空所有记录按钮 -->
        <button class="clear-all-btn" @click="handleClearAll" title="清空全部历史记录">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          <span>清空档案</span>
        </button>
      </div>
    </div>

    <!-- 瀑布流/网格排版 -->
    <div v-if="filteredItems.length > 0 || isGenerating" class="image-grid">
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

      <!-- 历史图片列表 (双击图片阅览，删除小字提示词，悬停只显示按钮，点击按钮引出提示词框) -->
      <div 
        v-for="item in filteredItems" 
        :key="item.id" 
        class="image-card glass-panel"
      >
        <div 
          class="media-container" 
          @dblclick.stop="preview(item)" 
          title="双击图片全屏阅览大图"
        >
          <img :src="item.url" :alt="item.prompt" class="gallery-img" loading="lazy" />
          
          <!-- 悬浮操作面板 (无文字遮罩与深色蒙版，仅底部优雅浮现快捷操作栏) -->
          <div class="card-overlay" @click.stop>
            <div class="overlay-header">
              <span class="size-badge">{{ item.width }}x{{ item.height }}</span>
              <span class="model-badge">{{ item.model || 'GPT-Image' }}</span>
            </div>

            <div class="overlay-footer">
              <!-- 发送至灵感画布衍生 -->
              <button class="action-btn highlight-btn" @click.stop="$emit('send-to-canvas', item)" title="在灵感画布中以此图参考衍生">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><path d="M13 6h3a2 2 0 0 1 2 2v7"></path><line x1="6" y1="9" x2="6" y2="21"></line></svg>
              </button>

              <!-- 查看提示词 (引出气泡文本框) -->
              <button 
                class="action-btn" 
                :class="{ active: activePromptItemId === item.id }"
                @click.stop="togglePromptPopover(item.id)" 
                title="查看并复制提示词"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              </button>

              <!-- 下载图片 -->
              <button class="action-btn" @click.stop="downloadImage(item)" title="保存高清大图至本地">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              </button>

              <!-- 删除图片 -->
              <button class="action-btn delete-btn" @click.stop="deleteItem(item.id)" title="删除此记录">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              </button>
            </div>
          </div>

          <!-- 从图片框引出的独立提示词文本框 (带箭头与复制按钮) -->
          <div 
            v-if="activePromptItemId === item.id" 
            class="gallery-prompt-callout glass-panel"
            @click.stop
          >
            <div class="callout-arrow"></div>
            <div class="callout-header">
              <div class="callout-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                <span>提示词详情</span>
              </div>
              <button class="callout-close-btn" @click.stop="activePromptItemId = null" title="关闭">×</button>
            </div>
            <div class="callout-body">
              <p class="callout-text">{{ item.prompt }}</p>
            </div>
            <div class="callout-actions">
              <button class="callout-action-btn copy-btn" @click.stop="copyItemPrompt(item.prompt, item.id)">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                <span>{{ copiedItemId === item.id ? '已复制！' : '复制提示词' }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 卡片底部精简元数据 (彻底删除底部小字提示词) -->
        <div class="card-info">
          <div class="card-meta">
            <span class="card-time">{{ formatTime(item.timestamp) }}</span>
            <span class="card-model-tag">{{ item.model }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 极简中性空状态 (移除所有诱导输入框的文字) -->
    <div v-else class="empty-state">
      <div class="empty-icon-wrapper">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
      </div>
      <h3>暂无生成历史</h3>
      <p class="empty-desc">已生成的画面将集中归档在此展厅中供随时检索与导出。</p>
      <button class="goto-canvas-btn" @click="$emit('goto-canvas')">
        <span>🎨 前往灵感画布开始创作</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  items: Array,
  isGenerating: Boolean
});

const emit = defineEmits(['preview', 'reuse-prompt', 'delete', 'show-toast', 'send-to-canvas', 'clear-all', 'goto-canvas']);

const searchKeyword = ref('');
const activePromptItemId = ref(null);
const copiedItemId = ref(null);

const togglePromptPopover = (itemId) => {
  activePromptItemId.value = activePromptItemId.value === itemId ? null : itemId;
};

const copyItemPrompt = (text, itemId) => {
  navigator.clipboard.writeText(text)
    .then(() => {
      copiedItemId.value = itemId;
      setTimeout(() => {
        copiedItemId.value = null;
      }, 2000);
      emit('show-toast', { message: '提示词已成功复制到剪贴板！', type: 'success' });
    })
    .catch(() => {
      emit('show-toast', { message: '复制失败，请重试', type: 'error' });
    });
};

const filteredItems = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase();
  if (!kw) return props.items || [];
  return (props.items || []).filter(item => 
    (item.prompt && item.prompt.toLowerCase().includes(kw)) ||
    (item.model && item.model.toLowerCase().includes(kw))
  );
});

const preview = (item) => {
  emit('preview', item);
};

const handleClearAll = () => {
  if (confirm('确认清空所有历史画作记录吗？此操作无法撤销。')) {
    emit('clear-all');
  }
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
  emit('show-toast', { message: '正在准备下载图片...', type: 'info' });
  fetch(item.url)
    .then(res => res.blob())
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `image-${item.id || Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      emit('show-toast', { message: '图片已成功保存！', type: 'success' });
    })
    .catch(err => {
      console.error('Download error:', err);
      window.open(item.url, '_blank');
      emit('show-toast', { message: '已在新标签页中打开大图，请右键保存。', type: 'warning' });
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
  display: flex;
  flex-direction: column;
  gap: 22px;
}

/* 顶部工具栏 - 胶囊悬浮 */
.gallery-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  border-radius: var(--radius-pill);
  background: var(--bg-card);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  transition: var(--transition-theme);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.gallery-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.gallery-badge {
  font-size: 0.68rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--radius-micro);
  background: var(--accent-indigo-bg);
  border: 1px solid rgba(99, 102, 241, 0.3);
  color: var(--accent-indigo);
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--bg-subtle);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-control);
  position: relative;
  transition: var(--transition-smooth);
}

.search-box:focus-within {
  border-color: var(--primary-color);
  background: var(--bg-subtle-hover);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.search-icon {
  color: var(--text-muted);
}

.search-input {
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 0.8rem;
  width: 170px;
}

.clear-search-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 1.1rem;
  line-height: 1;
  padding: 0 2px;
}

.clear-search-btn:hover {
  color: var(--text-primary);
}

.clear-all-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: var(--radius-control);
  background: var(--accent-coral-bg);
  border: 1px solid rgba(244, 63, 94, 0.3);
  color: var(--color-error);
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition-smooth);
}

.clear-all-btn:hover {
  background: var(--color-error);
  color: #ffffff;
  border-color: var(--color-error);
  transform: translateY(-1px);
}

/* 瀑布流/网格 */
.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
  gap: 24px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.image-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.28s ease, border-color 0.25s ease;
  cursor: pointer;
}

.image-card:hover {
  transform: translateY(-6px);
  box-shadow: var(--shadow-lg), var(--glow-shadow);
  border-color: var(--border-focus);
}

.media-container {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  background: var(--bg-subtle);
  overflow: hidden;
}

.gallery-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.image-card:hover .gallery-img {
  transform: scale(1.05);
}

.card-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(180deg, rgba(10, 12, 18, 0.75) 0%, transparent 35%, transparent 60%, rgba(10, 12, 18, 0.88) 100%);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 14px;
  opacity: 0;
  transition: opacity 0.25s ease;
}

.image-card:hover .card-overlay {
  opacity: 1;
}

.overlay-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.size-badge, .model-badge {
  font-size: 0.65rem;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: var(--radius-micro);
  background: rgba(0, 0, 0, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #cbd5e1;
  backdrop-filter: blur(4px);
}

.model-badge {
  color: #a5b4fc;
}

.overlay-footer {
  display: flex;
  gap: 8px;
  padding-top: 8px;
}

.action-btn {
  background: rgba(255, 255, 255, 0.16);
  border: none;
  color: #ffffff;
  border-radius: var(--radius-control);
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: var(--transition-smooth);
}

.action-btn:hover,
.action-btn.active {
  background: var(--primary-color);
  color: #ffffff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--accent-glow);
}

.action-btn.highlight-btn {
  color: #ffffff;
  background: var(--primary-gradient);
}

.action-btn.highlight-btn:hover {
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 4px 14px var(--accent-glow);
}

.action-btn.delete-btn:hover {
  background: var(--color-error);
  color: #ffffff;
}

/* 从图片框引出的独立提示词文本框 */
.gallery-prompt-callout {
  position: absolute;
  bottom: 12px;
  left: 12px;
  right: 12px;
  background: var(--bg-surface-elevated);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--border-focus);
  box-shadow: var(--shadow-lg);
  border-radius: var(--radius-md);
  padding: 14px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 10px;
  animation: popoverFadeIn 0.2s ease-out;
}

@keyframes popoverFadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.callout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 6px;
}

.callout-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--accent-indigo);
}

.callout-close-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.callout-close-btn:hover {
  color: var(--text-primary);
}

.callout-body {
  max-height: 110px;
  overflow-y: auto;
}

.callout-text {
  font-size: 0.78rem;
  line-height: 1.5;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
  margin: 0;
}

.callout-actions {
  display: flex;
  padding-top: 4px;
  border-top: 1px solid var(--border-color);
}

.callout-action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 12px;
  font-size: 0.74rem;
  font-weight: 600;
  border-radius: var(--radius-pill);
  background: var(--accent-indigo-bg);
  border: 1px solid var(--accent-indigo);
  color: var(--accent-indigo);
  cursor: pointer;
  transition: var(--transition-fast);
}

.callout-action-btn:hover {
  background: var(--primary-color);
  color: #ffffff;
}

.card-info {
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
}

.card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.72rem;
  color: var(--text-muted);
}

.card-model-tag {
  color: var(--accent-indigo);
  font-weight: 600;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 65vh;
  text-align: center;
  max-width: 440px;
  margin: 0 auto;
  gap: 14px;
}

.empty-icon-wrapper {
  width: 72px;
  height: 72px;
  border-radius: var(--radius-pill);
  background: var(--bg-subtle);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
  box-shadow: var(--shadow-sm);
}

.empty-icon {
  width: 34px;
  height: 34px;
  color: var(--text-muted);
}

.empty-state h3 {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.empty-desc {
  font-size: 0.84rem;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
}

.goto-canvas-btn {
  margin-top: 10px;
  padding: 10px 24px;
  background: var(--primary-gradient);
  border: none;
  border-radius: var(--radius-pill);
  color: #ffffff;
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 16px var(--accent-glow);
  transition: var(--transition-smooth);
}

.goto-canvas-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 22px var(--accent-glow);
}

/* 骨架屏 */
.skeleton-card {
  height: 360px;
}
.skeleton-media {
  width: 100%;
  height: 290px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-subtle);
}
.spinner-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.spinner-large {
  width: 36px;
  height: 36px;
  animation: rotate 2s linear infinite;
}
.spinner-large .path {
  stroke: var(--primary-color);
  stroke-linecap: round;
  animation: dash 1.5s ease-in-out infinite;
}
.loading-label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-secondary);
}
@keyframes rotate {
  100% { transform: rotate(360deg); }
}
@keyframes dash {
  0% { stroke-dasharray: 1, 150; stroke-dashoffset: 0; }
  50% { stroke-dasharray: 90, 150; stroke-dashoffset: -35; }
  100% { stroke-dasharray: 90, 150; stroke-dashoffset: -124; }
}
</style>
