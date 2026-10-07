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

        <!-- 多选模式切换按钮 -->
        <button 
          class="batch-mode-toggle-btn" 
          :class="{ active: isBatchMode }" 
          @click="toggleBatchMode"
          :title="isBatchMode ? '退出多选模式' : '开启多选模式 (可批量作为参考图或加入画布)'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
          <span>{{ isBatchMode ? '退出多选' : '多选管理' }}</span>
        </button>

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

      <!-- 历史图片列表 (双击图片阅览，悬停快捷操作栏) -->
      <div 
        v-for="item in filteredItems" 
        :key="item.id" 
        class="image-card glass-panel"
        :class="{ 'batch-selected': isSelected(item.id) }"
        @click="isBatchMode ? toggleSelectItem(item.id) : null"
      >
        <div 
          class="media-container" 
          @dblclick.stop="!isBatchMode ? preview(item) : null" 
          :title="isBatchMode ? '点击选中/取消' : '双击图片全屏阅览大图'"
        >
          <img :src="item.url" :alt="item.prompt" class="gallery-img" loading="lazy" decoding="async" />
          
          <!-- 多选模式下的复选框 -->
          <div 
            v-if="isBatchMode" 
            class="batch-card-checkbox" 
            :class="{ checked: isSelected(item.id) }"
            @click.stop="toggleSelectItem(item.id)"
          >
            <svg v-if="isSelected(item.id)" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>

          <!-- 悬浮操作面板 (仅在非多选模式下浮现) -->
          <div v-if="!isBatchMode" class="card-overlay" @click.stop>
            <div class="overlay-header">
              <span class="size-badge">{{ item.width }}x{{ item.height }}</span>
              <span class="model-badge">{{ item.model || 'GPT-Image' }}</span>
            </div>

            <div class="overlay-footer">
              <!-- 1. 作为参考图衍生：点击不跳转画布，可连续多选点击，等效于将选择的图作为参考图 -->
              <button 
                class="action-btn highlight-btn" 
                @click.stop="handleSetAsRef(item)" 
                title="作为参考图 (不离开画廊，可多选)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><path d="M13 6h3a2 2 0 0 1 2 2v7"></path><line x1="6" y1="9" x2="6" y2="21"></line></svg>
              </button>

              <!-- 2. 加入到画布：放在参考衍生的右边，仅加入画布作为独立图片，不直接作为参考图 -->
              <button 
                class="action-btn add-canvas-btn" 
                @click.stop="handleAddToCanvas(item)" 
                title="加入画布 (作为独立卡片，不作为参考图)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="16"></line></svg>
              </button>

              <!-- 3. 查看提示词 (引出气泡文本框) -->
              <button 
                class="action-btn" 
                :class="{ active: activePromptItemId === item.id }"
                @click.stop="togglePromptPopover(item.id)" 
                title="查看并复制提示词"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              </button>

              <!-- 4. 下载图片 -->
              <button class="action-btn" @click.stop="downloadImage(item)" title="保存高清大图至本地">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              </button>

              <!-- 5. 删除图片 -->
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

    <!-- 底部悬浮批量管理栏 (多选模式下激活) -->
    <Transition name="slide-up">
      <div v-if="isBatchMode" class="batch-floating-bar glass-panel" @click.stop>
        <div class="batch-bar-left">
          <span class="batch-count-tag">已选 {{ selectedIds.length }} 张</span>
          <button class="batch-text-btn" @click="selectAllItems">
            {{ selectedIds.length === filteredItems.length && filteredItems.length > 0 ? '取消全选' : '全选本页' }}
          </button>
        </div>
        <div class="batch-bar-right">
          <button 
            class="batch-action-btn primary-btn" 
            :disabled="selectedIds.length === 0"
            @click="handleBatchSetAsRef"
            title="将选中的图片批量设为参考图"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><path d="M13 6h3a2 2 0 0 1 2 2v7"></path><line x1="6" y1="9" x2="6" y2="21"></line></svg>
            <span>作为参考图 ({{ selectedIds.length }})</span>
          </button>

          <button 
            class="batch-action-btn secondary-btn" 
            :disabled="selectedIds.length === 0"
            @click="handleBatchAddToCanvas"
            title="将选中的图片批量加入画布 (不作为参考图)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="16"></line></svg>
            <span>加入画布 ({{ selectedIds.length }})</span>
          </button>

          <button class="batch-close-btn" @click="isBatchMode = false" title="退出多选">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  items: Array,
  isGenerating: Boolean
});

const emit = defineEmits([
  'preview', 
  'reuse-prompt', 
  'delete', 
  'show-toast', 
  'send-to-canvas', 
  'set-as-ref', 
  'add-to-canvas', 
  'batch-set-as-ref', 
  'batch-add-to-canvas', 
  'clear-all', 
  'goto-canvas'
]);

const searchKeyword = ref('');
const activePromptItemId = ref(null);
const copiedItemId = ref(null);

// 批量管理多选状态
const isBatchMode = ref(false);
const selectedIds = ref([]);

const toggleBatchMode = () => {
  isBatchMode.value = !isBatchMode.value;
  if (!isBatchMode.value) {
    selectedIds.value = [];
  }
};

const isSelected = (id) => selectedIds.value.includes(id);

const toggleSelectItem = (id) => {
  const idx = selectedIds.value.indexOf(id);
  if (idx !== -1) {
    selectedIds.value.splice(idx, 1);
  } else {
    selectedIds.value.push(id);
  }
};

const selectAllItems = () => {
  if (selectedIds.value.length === filteredItems.value.length) {
    selectedIds.value = [];
  } else {
    selectedIds.value = filteredItems.value.map(item => item.id);
  }
};

// 单张设为参考图：不跳转画布，可多张点击连续设为参考
const handleSetAsRef = (item) => {
  emit('set-as-ref', item);
};

// 单张加入画布：放在参考衍生右侧，仅加入画布不作为参考图
const handleAddToCanvas = (item) => {
  emit('add-to-canvas', item);
};

// 批量设为参考图
const handleBatchSetAsRef = () => {
  const selectedItems = (props.items || []).filter(item => selectedIds.value.includes(item.id));
  if (selectedItems.length > 0) {
    emit('batch-set-as-ref', selectedItems);
    isBatchMode.value = false;
    selectedIds.value = [];
  }
};

// 批量加入画布
const handleBatchAddToCanvas = () => {
  const selectedItems = (props.items || []).filter(item => selectedIds.value.includes(item.id));
  if (selectedItems.length > 0) {
    emit('batch-add-to-canvas', selectedItems);
    isBatchMode.value = false;
    selectedIds.value = [];
  }
};

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
  padding: 16px 24px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  scroll-behavior: smooth;
}

/* 顶部工具栏 - 固定悬浮毛玻璃 (向下滑动时始终吸顶常驻，随时可点击多选等操作) */
.gallery-toolbar {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  border-radius: 12px;
  background: var(--bg-surface-elevated, rgba(16, 18, 28, 0.88));
  backdrop-filter: blur(28px);
  -webkit-backdrop-filter: blur(28px);
  border: 1px solid var(--border-divider) !important;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
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
  border-radius: 6px;
  background: rgba(139, 92, 246, 0.14);
  border: none !important;
  color: var(--primary-color);
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
  padding: 7px 12px;
  background: rgba(255, 255, 255, 0.045);
  border: none !important;
  border-radius: 8px;
  position: relative;
  transition: var(--transition-smooth);
}

:root[data-theme="light"] .search-box {
  background: rgba(0, 0, 0, 0.035);
}

.search-box:focus-within {
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 0 1.5px var(--primary-color);
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
  padding: 7px 14px;
  border-radius: 8px;
  background: rgba(244, 63, 94, 0.09);
  border: none !important;
  color: var(--color-error);
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition-smooth);
}

.clear-all-btn:hover {
  background: var(--color-error);
  color: #ffffff;
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
  border-radius: 14px;
  background: var(--bg-surface-elevated, rgba(20, 22, 32, 0.85));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: none !important;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.28s ease;
  cursor: pointer;
}

.image-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.55), 0 0 24px rgba(139, 92, 246, 0.25);
}

.media-container {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  background: var(--bg-subtle, rgba(255, 255, 255, 0.02));
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
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.6);
  border: none !important;
  color: #cbd5e1;
  backdrop-filter: blur(8px);
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
  border: none !important;
  outline: none !important;
  color: #ffffff;
  border-radius: 8px;
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
  background: var(--primary-color) !important;
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
  background: var(--color-error) !important;
  color: #ffffff;
}

/* 从图片框引出的独立提示词文本框 (极致纯平毛玻璃，彻底消灭生硬边框) */
.gallery-prompt-callout {
  position: absolute;
  bottom: 12px;
  left: 12px;
  right: 12px;
  background: rgba(18, 20, 30, 0.94);
  backdrop-filter: blur(32px);
  -webkit-backdrop-filter: blur(32px);
  border: none !important;
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.6), 0 0 1px rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 14px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 10px;
  animation: popoverFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

:root[data-theme="light"] .gallery-prompt-callout {
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 16px 45px rgba(0, 0, 0, 0.14), 0 0 1px rgba(0, 0, 0, 0.08);
}

@keyframes popoverFadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.callout-arrow {
  display: none !important;
}

.callout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: none !important;
  padding-bottom: 2px;
}

.callout-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--primary-color);
}

.callout-close-btn {
  background: transparent;
  border: none !important;
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
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  padding: 9px 11px;
}

:root[data-theme="light"] .callout-body {
  background: rgba(0, 0, 0, 0.035);
}

.callout-text {
  font-size: 0.76rem;
  line-height: 1.5;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
  margin: 0;
}

.callout-actions {
  display: flex;
  padding-top: 2px;
  border-top: none !important;
}

.callout-action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 0.76rem;
  font-weight: 600;
  border-radius: 8px;
  background: var(--primary-gradient);
  border: none !important;
  color: #ffffff;
  cursor: pointer;
  box-shadow: 0 4px 12px var(--accent-glow);
  transition: var(--transition-smooth);
}

.callout-action-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px var(--accent-glow);
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
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.035);
  border: none !important;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
  box-shadow: none !important;
}

:root[data-theme="light"] .empty-icon-wrapper {
  background: rgba(0, 0, 0, 0.03);
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
  border: none !important;
  border-radius: 8px;
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

/* 批量多选模式按钮 */
.batch-mode-toggle-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 8px;
  background: rgba(99, 102, 241, 0.12);
  border: 1px solid rgba(99, 102, 241, 0.3) !important;
  color: var(--accent-indigo);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition-smooth);
}

.batch-mode-toggle-btn:hover,
.batch-mode-toggle-btn.active {
  background: var(--primary-gradient);
  color: #ffffff;
  border-color: transparent !important;
  box-shadow: 0 4px 14px var(--accent-glow);
}

/* 卡片选中高亮与复选框 */
.image-card.batch-selected {
  outline: 2.5px solid var(--primary-color) !important;
  box-shadow: 0 0 25px rgba(99, 102, 241, 0.4), var(--shadow-lg) !important;
  transform: translateY(-2px);
}

.batch-card-checkbox {
  position: absolute;
  top: 10px;
  left: 10px;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(8px);
  border: 1.5px solid rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 20;
  transition: var(--transition-fast);
}

.batch-card-checkbox.checked {
  background: var(--primary-gradient);
  border-color: transparent;
  color: #ffffff;
  box-shadow: 0 2px 8px var(--accent-glow);
}

.action-btn.add-canvas-btn {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

.action-btn.add-canvas-btn:hover {
  background: linear-gradient(135deg, #10b981, #059669) !important;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

/* 底部悬浮批量操作栏 */
.batch-floating-bar {
  position: fixed;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 12px 24px;
  border-radius: 16px;
  background: rgba(18, 22, 34, 0.94);
  backdrop-filter: blur(28px);
  -webkit-backdrop-filter: blur(28px);
  border: 1px solid rgba(99, 102, 241, 0.35) !important;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55), 0 0 20px rgba(99, 102, 241, 0.25);
  z-index: 100;
  min-width: 480px;
}

:root[data-theme="light"] .batch-floating-bar {
  background: rgba(255, 255, 255, 0.96);
  border-color: rgba(99, 102, 241, 0.2) !important;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.12), 0 0 20px rgba(99, 102, 241, 0.15);
}

.batch-bar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.batch-count-tag {
  font-size: 0.86rem;
  font-weight: 700;
  color: var(--text-primary);
}

.batch-text-btn {
  background: none;
  border: none;
  color: var(--accent-indigo);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 6px;
}

.batch-text-btn:hover {
  text-decoration: underline;
}

.batch-bar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.batch-action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: var(--transition-smooth);
}

.batch-action-btn.primary-btn {
  background: var(--primary-gradient);
  color: #ffffff;
  box-shadow: 0 4px 14px var(--accent-glow);
}

.batch-action-btn.primary-btn:hover:not(:disabled) {
  transform: translateY(-1.5px);
  box-shadow: 0 6px 18px var(--accent-glow);
}

.batch-action-btn.secondary-btn {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.4);
  color: #10b981;
}

.batch-action-btn.secondary-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #10b981, #059669);
  color: #ffffff;
  border-color: transparent;
  transform: translateY(-1.5px);
  box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
}

.batch-action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

.batch-close-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  border: none;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: var(--transition-fast);
}

.batch-close-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: var(--text-primary);
}

/* 浮动栏滑动动画 */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translate(-50%, 20px);
}
</style>
