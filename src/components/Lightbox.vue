<template>
  <Transition name="lightbox-fade">
    <div v-if="isOpen" class="lightbox-overlay" @click.self="close" @keydown.esc="close" tabindex="0" ref="overlayRef">
      <!-- 控制按钮栏 -->
      <div class="lightbox-toolbar">
        <div class="info-tag">
          <span class="prompt-text">{{ item.prompt }}</span>
        </div>
        <div class="toolbar-actions">
          <button class="tool-btn" @click="zoomIn" title="放大">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
          </button>
          <button class="tool-btn" @click="zoomOut" title="缩小">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
          </button>
          <button class="tool-btn" @click="resetTransform" title="重置缩放">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path></svg>
          </button>
          <button class="tool-btn download" @click="download" title="保存本地">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          </button>
          <button class="tool-btn close" @click="close" title="关闭 (Esc)">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>

      <!-- 图片展示区 -->
      <div 
        class="image-wrapper"
        @mousedown="startDrag"
        @mousemove="onDrag"
        @mouseup="stopDrag"
        @mouseleave="stopDrag"
        @wheel.prevent="handleWheel"
      >
        <img 
          :src="item.url" 
          :alt="item.prompt" 
          class="lightbox-img" 
          :style="imageStyle"
          @dblclick="resetTransform"
          draggable="false"
        />
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';

const props = defineProps({
  isOpen: Boolean,
  item: Object
});

const emit = defineEmits(['close']);

const overlayRef = ref(null);

// 变换状态
const scale = ref(1);
const translateX = ref(0);
const translateY = ref(0);

// 拖拽状态
const isDragging = ref(false);
const startX = ref(0);
const startY = ref(0);

const imageStyle = computed(() => {
  return {
    transform: `translate(${translateX.value}px, ${translateY.value}px) scale(${scale.value})`,
    cursor: isDragging.value ? 'grabbing' : scale.value > 1 ? 'grab' : 'zoom-in'
  };
});

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    resetTransform();
    // 聚焦容器以响应键盘事件
    nextTick(() => {
      overlayRef.value?.focus();
    });
  }
});

const close = () => {
  emit('close');
};

const resetTransform = () => {
  scale.value = 1;
  translateX.value = 0;
  translateY.value = 0;
};

const zoomIn = () => {
  scale.value = Math.min(scale.value + 0.25, 5);
};

const zoomOut = () => {
  scale.value = Math.max(scale.value - 0.25, 0.5);
};

const handleWheel = (e) => {
  const zoomFactor = 0.1;
  if (e.deltaY < 0) {
    scale.value = Math.min(scale.value + zoomFactor, 5);
  } else {
    scale.value = Math.max(scale.value - zoomFactor, 0.5);
  }
};

const startDrag = (e) => {
  if (scale.value <= 1 && translateX.value === 0 && translateY.value === 0) {
    // 没放大时只有双击放大，不需要拖拽
    return;
  }
  isDragging.value = true;
  startX.value = e.clientX - translateX.value;
  startY.value = e.clientY - translateY.value;
};

const onDrag = (e) => {
  if (!isDragging.value) return;
  translateX.value = e.clientX - startX.value;
  translateY.value = e.clientY - startY.value;
};

const stopDrag = () => {
  isDragging.value = false;
};

const download = () => {
  const link = document.createElement('a');
  link.href = props.item.url;
  link.download = `gpt-image-${props.item.id || Date.now()}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
</script>

<style scoped>
.lightbox-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(4, 6, 12, 0.95);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  z-index: 2000;
  display: flex;
  flex-direction: column;
  outline: none;
}

/* 顶部工具栏 */
.lightbox-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%);
  z-index: 2100;
}

.info-tag {
  max-width: 60%;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 8px 16px;
  border-radius: 12px;
}

.prompt-text {
  font-size: 0.85rem;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.toolbar-actions {
  display: flex;
  gap: 10px;
}

.tool-btn {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-secondary);
  border-radius: 10px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-fast);
}

.tool-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: var(--text-primary);
}

.tool-btn.close:hover {
  background: var(--color-error);
  color: #fff;
}

.tool-btn.download:hover {
  background: var(--color-success);
  color: #fff;
}

/* 图片区域 */
.image-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
  width: 100%;
  height: 100%;
}

.lightbox-img {
  max-width: 90%;
  max-height: 85vh;
  object-fit: contain;
  box-shadow: 0 25px 60px rgba(0,0,0,0.8);
  border-radius: 8px;
  user-select: none;
  transition: transform 0.1s ease-out; /* 顺滑拖动 */
}

/* 灯箱淡入淡出 */
.lightbox-fade-enter-active,
.lightbox-fade-leave-active {
  transition: opacity 0.3s ease;
}

.lightbox-fade-enter-from,
.lightbox-fade-leave-to {
  opacity: 0;
}

.lightbox-fade-enter-active .lightbox-img,
.lightbox-fade-leave-active .lightbox-img {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.lightbox-fade-enter-from .lightbox-img {
  transform: scale(0.9) translateY(20px);
}
</style>
