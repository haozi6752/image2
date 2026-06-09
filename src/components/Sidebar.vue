<template>
  <div class="sidebar-container" :class="{ 'collapsed': !isVisible }">
    <!-- 折叠/展开控制按钮 -->
    <button class="toggle-sidebar-btn" @click="toggleSidebar" :title="isVisible ? '收起面板' : '展开面板'">
      <svg v-if="isVisible" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
    </button>

    <div class="sidebar-content glass-panel" v-show="isVisible">
      <div class="section-title">
        <span>画布设置</span>
      </div>

      <!-- 预设宽高比 -->
      <div class="setting-group">
        <label class="group-label">图片比例 (Aspect Ratio)</label>
        <div class="ratio-grid">
          <button 
            v-for="item in ratioPresets" 
            :key="item.name"
            class="ratio-card" 
            :class="{ active: currentRatio === item.value }"
            @click="selectRatio(item.value)"
          >
            <div class="ratio-box" :style="getRatioStyle(item.value)"></div>
            <span class="ratio-name">{{ item.name }}</span>
            <span class="ratio-desc">{{ item.label }}</span>
          </button>
        </div>
      </div>

      <!-- 分辨率等级 -->
      <div class="setting-group">
        <label class="group-label">画质级别 (Resolution Level)</label>
        <div class="level-selector">
          <button 
            v-for="lvl in levels" 
            :key="lvl.id"
            class="level-btn"
            :class="{ active: currentLevel === lvl.id }"
            @click="selectLevel(lvl.id)"
          >
            {{ lvl.name }}
          </button>
        </div>
      </div>

      <!-- 尺寸微调 -->
      <div class="setting-group">
        <div class="size-header">
          <label class="group-label">自定义尺寸 (16倍数)</label>
          <button class="link-btn" @click="resetToPreset">重置预设</button>
        </div>
        <div class="size-sliders">
          <div class="slider-row">
            <span class="slider-label">宽度: {{ width }}px</span>
            <input 
              type="range" 
              :min="minSize" 
              :max="maxSize" 
              :step="16" 
              v-model.number="width"
              @input="onSizeInput('width')"
              class="custom-slider"
            />
          </div>
          <div class="slider-row">
            <span class="slider-label">高度: {{ height }}px</span>
            <input 
              type="range" 
              :min="minSize" 
              :max="maxSize" 
              :step="16" 
              v-model.number="height"
              @input="onSizeInput('height')"
              class="custom-slider"
            />
          </div>
        </div>
        <div class="pixel-info" :class="{ 'warning': isPixelLimitExceeded }">
          像素总数: {{ formattedPixels }}
          <span v-if="isPixelLimitExceeded" class="limit-warning">(超出 DALL-E 3 / GPT Image 2 上限)</span>
        </div>
      </div>

      <!-- 其它参数：生图模型、生成质量等 -->
      <div class="setting-group">
        <label class="group-label">生成质量 (Quality)</label>
        <div class="quality-selector">
          <button 
            class="quality-btn" 
            :class="{ active: quality === 'standard' }"
            @click="updateQuality('standard')"
          >
            标准 (Standard)
          </button>
          <button 
            class="quality-btn" 
            :class="{ active: quality === 'hd' }"
            @click="updateQuality('hd')"
          >
            高清 (HD)
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';

const props = defineProps({
  isVisible: Boolean
});

const emit = defineEmits(['update:isVisible', 'change-settings']);

// GPT Image 2 规则约束
const minSize = 256;
const maxSize = 3840;
const minPixels = 655360;   // 对应约 816x816
const maxPixels = 8294400;  // 对应 3840x2160 (4K)

// 宽高比预设
const ratioPresets = [
  { name: '1:1', label: '正方形', value: '1:1' },
  { name: '16:9', label: '横屏视频', value: '16:9' },
  { name: '9:16', label: '竖屏海报', value: '9:16' },
  { name: '4:3', label: '标准横屏', value: '4:3' },
  { name: '3:4', label: '标准竖屏', value: '3:4' },
  { name: '21:9', label: '电影宽屏', value: '21:9' },
  { name: '9:21', label: '全面手机', value: '9:21' },
  { name: '3:2', label: '经典相片', value: '3:2' },
  { name: '2:3', label: '经典竖相', value: '2:3' },
];

// 分辨率画质等级
const levels = [
  { id: '1k', name: '1K 基准', baseSize: 1024 },
  { id: '2k', name: '2K 进阶', baseSize: 2048 },
  { id: '4k', name: '4K 超清', baseSize: 3840 },
];

const currentRatio = ref('1:1');
const currentLevel = ref('1k');
const width = ref(1024);
const height = ref(1024);
const quality = ref('standard'); // standard / hd

const isPixelLimitExceeded = computed(() => {
  const total = width.value * height.value;
  return total < minPixels || total > maxPixels;
});

const formattedPixels = computed(() => {
  const total = width.value * height.value;
  if (total >= 1000000) {
    return `${(total / 1000000).toFixed(2)} Mpx`;
  }
  return `${total.toLocaleString()} px`;
});

// 计算比例缩放的尺寸
const calculateSize = (ratioStr, levelId) => {
  const parts = ratioStr.split(':').map(Number);
  const wRatio = parts[0];
  const hRatio = parts[1];
  
  const levelObj = levels.find(l => l.id === levelId) || levels[0];
  const base = levelObj.baseSize;

  let newW, newH;

  // 以基准为最长边，计算另一边并做 16 像素的对齐
  if (wRatio >= hRatio) {
    newW = base;
    newH = Math.round((base * (hRatio / wRatio)) / 16) * 16;
  } else {
    newH = base;
    newW = Math.round((base * (wRatio / hRatio)) / 16) * 16;
  }

  // 边界约束
  newW = Math.max(minSize, Math.min(maxSize, newW));
  newH = Math.max(minSize, Math.min(maxSize, newH));

  // 检查像素总数是否满足要求限制
  let total = newW * newH;
  if (total < minPixels) {
    // 如果太小，同比放大到最小像素限制
    const scale = Math.sqrt(minPixels / total);
    newW = Math.round((newW * scale) / 16) * 16;
    newH = Math.round((newH * scale) / 16) * 16;
  }
  if (total > maxPixels) {
    // 如果太大，同比缩小到最大像素限制
    const scale = Math.sqrt(maxPixels / total);
    newW = Math.round((newW * scale) / 16) * 16;
    newH = Math.round((newH * scale) / 16) * 16;
  }

  return { w: newW, h: newH };
};

const selectRatio = (ratioVal) => {
  currentRatio.value = ratioVal;
  const { w, h } = calculateSize(ratioVal, currentLevel.value);
  width.value = w;
  height.value = h;
  emitSettings();
};

const selectLevel = (levelId) => {
  currentLevel.value = levelId;
  const { w, h } = calculateSize(currentRatio.value, levelId);
  width.value = w;
  height.value = h;
  emitSettings();
};

const updateQuality = (val) => {
  quality.value = val;
  emitSettings();
};

const resetToPreset = () => {
  const { w, h } = calculateSize(currentRatio.value, currentLevel.value);
  width.value = w;
  height.value = h;
  emitSettings();
};

const onSizeInput = (changedAttr) => {
  // 当手动拉动滑块时，清空选中的绝对比例和级别（变为自定义状态）
  currentRatio.value = 'custom';
  currentLevel.value = 'custom';
  
  // 确保是 16 的倍数
  if (changedAttr === 'width') {
    width.value = Math.round(width.value / 16) * 16;
  } else {
    height.value = Math.round(height.value / 16) * 16;
  }
  emitSettings();
};

// 发送更新配置
const emitSettings = () => {
  emit('change-settings', {
    width: width.value,
    height: height.value,
    quality: quality.value,
    ratio: currentRatio.value
  });
};

const toggleSidebar = () => {
  emit('update:isVisible', !props.isVisible);
};

// 画布比例示意框样式
const getRatioStyle = (ratioStr) => {
  const parts = ratioStr.split(':').map(Number);
  const w = parts[0];
  const h = parts[1];
  const max = Math.max(w, h);
  return {
    width: `${(w / max) * 100}%`,
    height: `${(h / max) * 100}%`
  };
};

// 初始化
onMounted(() => {
  emitSettings();
});
</script>

<style scoped>
.sidebar-container {
  position: relative;
  height: 100%;
  width: 300px;
  display: flex;
  transition: var(--transition-smooth);
  z-index: 10;
}

.sidebar-container.collapsed {
  width: 0;
}

.sidebar-content {
  width: 300px;
  height: 100%;
  border-radius: 0;
  border-left: none;
  border-top: none;
  border-bottom: none;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow-y: auto;
  transition: var(--transition-smooth);
}

.sidebar-container.collapsed .sidebar-content {
  transform: translateX(-100%);
  opacity: 0;
  pointer-events: none;
}

/* 浮动收起按钮 */
.toggle-sidebar-btn {
  position: absolute;
  top: 50%;
  right: -32px;
  transform: translateY(-50%);
  width: 32px;
  height: 64px;
  background: var(--bg-card);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--border-color);
  border-left: none;
  border-radius: 0 12px 12px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  box-shadow: 6px 0 16px rgba(0,0,0,0.15);
  z-index: 11;
}

.toggle-sidebar-btn:hover {
  color: var(--text-primary);
  background: var(--bg-card-hover);
}

.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  background: linear-gradient(135deg, #a5b4fc 0%, #e0e7ff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.group-label {
  font-size: 0.8rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}

/* 比例网格 */
.ratio-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.ratio-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 10px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 86px;
  transition: var(--transition-fast);
}

.ratio-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.2);
}

.ratio-card.active {
  background: rgba(99, 102, 241, 0.1);
  border-color: var(--accent-color);
  box-shadow: 0 0 10px var(--accent-glow);
}

.ratio-box {
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  max-width: 28px;
  max-height: 28px;
  transition: var(--transition-fast);
}

.ratio-card.active .ratio-box {
  background: var(--primary-gradient);
  border-color: transparent;
  box-shadow: 0 2px 8px var(--accent-glow);
}

.ratio-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary);
}

.ratio-desc {
  font-size: 0.65rem;
  color: var(--text-muted);
}

/* 分辨率等级 */
.level-selector {
  display: flex;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 2px;
  border: 1px solid var(--border-color);
}

.level-btn {
  flex: 1;
  font-size: 0.75rem;
  font-weight: 500;
  padding: 8px 4px;
  border-radius: 6px;
  color: var(--text-secondary);
  text-align: center;
}

.level-btn.active {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
}

/* 尺寸微调 */
.size-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.link-btn {
  font-size: 0.75rem;
  color: var(--accent-color);
  font-weight: 500;
}

.link-btn:hover {
  text-decoration: underline;
}

.size-sliders {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 10px;
  padding: 12px;
  border: 1px solid var(--border-color);
}

.slider-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.slider-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.custom-slider {
  -webkit-appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.1);
  outline: none;
}

.custom-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent-color);
  cursor: pointer;
  transition: var(--transition-fast);
}

.custom-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
  box-shadow: 0 0 8px var(--accent-color);
}

.pixel-info {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-align: right;
  display: flex;
  flex-direction: column;
}

.pixel-info.warning {
  color: var(--color-warning);
}

.limit-warning {
  font-size: 0.65rem;
  color: var(--color-error);
}

/* 质量选择 */
.quality-selector {
  display: flex;
  gap: 8px;
}

.quality-btn {
  flex: 1;
  font-size: 0.75rem;
  padding: 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.quality-btn.active {
  background: rgba(99, 102, 241, 0.1);
  border-color: var(--accent-color);
  color: var(--text-primary);
}
</style>
