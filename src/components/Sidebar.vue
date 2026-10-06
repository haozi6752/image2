<template>
  <div class="sidebar-container" :class="{ 'collapsed': !isVisible }">
    <!-- 折叠/展开控制按钮 -->
    <button class="toggle-sidebar-btn" @click="toggleSidebar" :title="isVisible ? '收起面板' : '展开面板'">
      <svg v-if="isVisible" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
    </button>

    <div class="sidebar-content glass-panel">
      <!-- 顶部标题 (已去除 GPT-Image 2.5 标识) -->
      <div class="section-title">
        <span class="main-title">画布与生图配置</span>
      </div>

      <!-- 1. 模型选择 -->
      <div class="setting-group">
        <label class="group-label">生图模型</label>
        <div class="model-select-grid">
          <button 
            v-for="m in modelList" 
            :key="m.id"
            class="model-card"
            :class="{ active: currentModel === m.id }"
            @click="selectModel(m.id)"
          >
            <div class="model-card-top">
              <span class="model-icon">{{ m.icon }}</span>
              <span class="model-name">{{ m.name }}</span>
              <span v-if="m.tag" class="model-tag" :class="m.tagType">{{ m.tag }}</span>
            </div>
          </button>
        </div>
        <!-- 自定义模型 ID 输入框 -->
        <div v-if="currentModel === 'custom'" class="custom-model-sidebar-box">
          <input 
            v-model="customModelId" 
            @input="onCustomModelInput" 
            placeholder="输入第三方支持的模型名称 (如: gpt-image-2)..." 
            class="sidebar-custom-model-input"
          />
        </div>
      </div>

      <!-- 2. 个性指令集 (Prompt Skills) - 下拉菜单显示，支持多选开关与快捷编辑 -->
      <div class="setting-group skills-group">
        <div class="skills-header">
          <div class="skills-header-left">
            <label class="group-label">个性指令词库</label>
            <span class="active-count-tag" v-if="activeSkillsCount > 0">{{ activeSkillsCount }} 项生效</span>
          </div>
        </div>

        <!-- 下拉菜单容器 -->
        <div class="skills-dropdown-wrapper">
          <!-- 下拉触发条 -->
          <div 
            class="skills-dropdown-trigger"
            :class="{ 'open': isSkillsDropdownOpen, 'active': activeSkillsCount > 0 }"
            @click="isSkillsDropdownOpen = !isSkillsDropdownOpen"
          >
            <div class="trigger-left">
              <span class="trigger-icon">🎯</span>
              <span class="trigger-text">{{ dropdownSummaryText }}</span>
            </div>
            <div class="trigger-right">
              <span class="pulse-dot" v-if="activeSkillsCount > 0"></span>
              <svg 
                class="dropdown-arrow" 
                :class="{ 'rotated': isSkillsDropdownOpen }"
                xmlns="http://www.w3.org/2000/svg" 
                width="14" 
                height="14" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                stroke-width="2"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>

          <!-- 下拉展开菜单 -->
          <Transition name="dropdown-slide">
            <div v-if="isSkillsDropdownOpen" class="skills-dropdown-menu glass-panel">
              <div class="dropdown-skills-list">
                <div 
                  v-for="(skill, index) in promptSkills" 
                  :key="skill.id" 
                  class="dropdown-skill-item"
                  :class="{ 'checked': skill.enabled, 'editing': editingSkillId === skill.id }"
                >
                  <!-- 顶行：复选开关、名称与操作按钮 -->
                  <div class="skill-row-main">
                    <label class="skill-check-area" @click.stop>
                      <input 
                        type="checkbox" 
                        v-model="skill.enabled"
                        @change="handleSkillsChange"
                        class="skill-checkbox"
                      />
                      <span class="skill-item-title">{{ skill.name || '未命名指令' }}</span>
                    </label>

                    <div class="skill-item-btns">
                      <!-- 展开编辑详情按钮 -->
                      <button 
                        class="skill-icon-btn" 
                        :class="{ 'active': editingSkillId === skill.id }"
                        @click.stop="toggleEditSkill(skill.id)" 
                        :title="editingSkillId === skill.id ? '收起编辑' : '编辑指令内容'"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                      </button>

                      <!-- 删除按钮 -->
                      <button 
                        class="skill-icon-btn del-btn" 
                        @click.stop="deleteSkill(index)" 
                        title="删除该指令"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                    </div>
                  </div>

                  <!-- 展开项：编辑指令名称与内容文本框 -->
                  <div v-if="editingSkillId === skill.id" class="skill-edit-box" @click.stop>
                    <div class="edit-input-group">
                      <span class="edit-input-label">指令名称:</span>
                      <input 
                        v-model="skill.name" 
                        @input="handleSkillsChange" 
                        class="edit-name-field"
                        placeholder="给指令起个名字..."
                      />
                    </div>
                    <div class="edit-input-group">
                      <span class="edit-input-label">指令内容 (Prompt):</span>
                      <textarea 
                        v-model="skill.content" 
                        @input="handleSkillsChange" 
                        class="edit-textarea-field"
                        rows="2"
                        placeholder="输入提示词设定，开启后将自动注入..."
                      ></textarea>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 下拉底部：添加新指令按钮 -->
              <div class="dropdown-footer-row">
                <button class="add-skill-button" @click.stop="addNewSkill">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  <span>添加新指令预设</span>
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <!-- 3. 预设宽高比 -->
      <div class="setting-group">
        <label class="group-label">图片比例</label>
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

      <!-- 4. 分辨率等级 -->
      <div class="setting-group">
        <label class="group-label">画质规格</label>
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

      <!-- 5. 尺寸微调 -->
      <div class="setting-group">
        <div class="size-header">
          <label class="group-label">尺寸微调</label>
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
          <span v-if="isPixelLimitExceeded" class="limit-warning">(超出规范范围)</span>
        </div>
      </div>

      <!-- 6. 生成质量 (Quality) -->
      <div class="setting-group">
        <label class="group-label">生成质量</label>
        <div class="quality-grid">
          <button 
            v-for="q in qualityList"
            :key="q.id"
            class="quality-btn-new" 
            :class="{ active: quality === q.id, 'highlight-quality': q.isNew }"
            @click="updateQuality(q.id)"
          >
            <span class="quality-text">{{ q.name }}</span>
            <span v-if="q.badge" class="quality-badge">{{ q.badge }}</span>
          </button>
        </div>
      </div>

      <!-- 7. 输出格式与特性 -->
      <div class="setting-group">
        <label class="group-label">输出格式</label>
        <div class="format-grid">
          <button 
            v-for="f in ['png', 'jpeg', 'webp']"
            :key="f"
            class="format-btn" 
            :class="{ active: outputFormat === f }"
            @click="updateOutputFormat(f)"
          >
            {{ f.toUpperCase() }}
          </button>
        </div>
      </div>

      <!-- 透明背景 (PNG / WEBP 特权) -->
      <div class="setting-group" v-show="outputFormat === 'png' || outputFormat === 'webp'">
        <div class="feature-toggle-row">
          <div class="feature-toggle-info">
            <span class="feature-title">透明背景 (Alpha Channel)</span>
            <span class="feature-desc">去除画面多余背景，专供图标与 UI 设计素材提取</span>
          </div>
          <input 
            type="checkbox" 
            id="transparencyToggle" 
            v-model="transparentBackground" 
            @change="emitSettings"
            class="toggle-checkbox"
          />
          <label for="transparencyToggle" class="toggle-label"></label>
        </div>
      </div>

      <!-- 图像压缩率 -->
      <div class="setting-group" v-show="outputFormat === 'jpeg' || outputFormat === 'webp'">
        <div class="size-header">
          <label class="group-label">图像压缩率 (Compression: {{ outputCompression }}%)</label>
        </div>
        <div class="slider-container">
          <input 
            type="range" 
            min="0" 
            max="100" 
            step="1" 
            v-model.number="outputCompression"
            @input="emitSettings"
            class="custom-slider"
          />
        </div>
        <span class="param-desc">数值越低体积越小，默认 80。</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

const props = defineProps({
  isVisible: Boolean
});

const emit = defineEmits(['update:isVisible', 'change-settings']);

// 规则约束
const minSize = 256;
const maxSize = 3840;
const minPixels = 655360;
const maxPixels = 8294400;

// 模型列表 (移除 dall-e-3，移除冗长小字，保留中立干净结构)
const modelList = [
  { id: 'gpt-image-2.5-flare', name: '2.5 Flare', icon: '⚡', tag: '极速', tagType: 'speed' },
  { id: 'gpt-image-2.5-sunburst', name: '2.5 Sunburst', icon: '✨', tag: '旗舰', tagType: 'quality' },
  { id: 'gpt-image-2', name: 'GPT Image 2', icon: '💎' },
  { id: 'custom', name: '自定义模型', icon: '✏️' },
];

const customModelId = ref('');

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

// 质量等级
const qualityList = [
  { id: 'auto', name: 'AUTO' },
  { id: 'low', name: 'LOW' },
  { id: 'medium', name: 'MEDIUM' },
  { id: 'high', name: 'HIGH' },
  { id: 'xhigh', name: 'X-HIGH', isNew: true, badge: '极清' },
  { id: 'max', name: 'MAX', isNew: true, badge: '极致' },
];

const currentModel = ref('gpt-image-2.5-flare');
const currentRatio = ref('1:1');
const currentLevel = ref('1k');
const width = ref(1024);
const height = ref(1024);
const quality = ref('high');
const outputFormat = ref('png');
const outputCompression = ref(80);
const transparentBackground = ref(false);

// 全新：个性指令集 (Prompt Skills) - 类似于 Skill，按设定好的指令操作，支持独立多项开关
const promptSkills = ref([
  {
    id: 'skill_1',
    name: '画质强化大师',
    content: 'masterpiece, best quality, extremely detailed, 8k wallpaper',
    enabled: false
  },
  {
    id: 'skill_2',
    name: '写实摄影风格',
    content: 'photorealistic, 35mm photograph, soft natural lighting, high dynamic range',
    enabled: false
  },
  {
    id: 'skill_3',
    name: '多图融合与风格迁移',
    content: 'Image 1 provides the main character subject and composition. Image 2 provides the artistic style, color scheme and atmospheric lighting. Blend the references together seamlessly with high fidelity.',
    enabled: false
  }
]);

// 下拉菜单与编辑展开状态
const isSkillsDropdownOpen = ref(false);
const editingSkillId = ref(null);

const toggleEditSkill = (id) => {
  editingSkillId.value = editingSkillId.value === id ? null : id;
};

const activeSkillsCount = computed(() => {
  return promptSkills.value.filter(s => s.enabled).length;
});

// 下拉框触发条展示文案
const dropdownSummaryText = computed(() => {
  const active = promptSkills.value.filter(s => s.enabled);
  if (active.length === 0) return '未启用预设指令';
  if (active.length === 1) return `已生效: ${active[0].name}`;
  return `已生效 ${active.length} 项预设指令`;
});

// 计算所有启用的 Skill 拼接得到的指令
const combinedSkillsPrompt = computed(() => {
  const activeList = promptSkills.value
    .filter(s => s.enabled && s.content && s.content.trim())
    .map(s => s.content.trim());
  return activeList.join('\n');
});

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

// 添加新的 Skill 指令并自动展开编辑
const addNewSkill = () => {
  const newId = 'skill_' + Date.now();
  promptSkills.value.push({
    id: newId,
    name: `指令预设 ${promptSkills.value.length + 1}`,
    content: '',
    enabled: true
  });
  editingSkillId.value = newId;
  isSkillsDropdownOpen.value = true;
  handleSkillsChange();
};

// 删除指定 Skill
const deleteSkill = (index) => {
  const item = promptSkills.value[index];
  if (item && editingSkillId.value === item.id) {
    editingSkillId.value = null;
  }
  promptSkills.value.splice(index, 1);
  handleSkillsChange();
};

const handleSkillsChange = () => {
  saveSkillsLocal();
  emitSettings();
};

const saveSkillsLocal = () => {
  localStorage.setItem('prompt_skills_v1', JSON.stringify(promptSkills.value));
};

// 计算比例缩放的尺寸
const calculateSize = (ratioStr, levelId) => {
  const parts = ratioStr.split(':').map(Number);
  const wRatio = parts[0];
  const hRatio = parts[1];
  
  const levelObj = levels.find(l => l.id === levelId) || levels[0];
  const base = levelObj.baseSize;

  let newW, newH;

  if (wRatio >= hRatio) {
    newW = base;
    newH = Math.round((base * (hRatio / wRatio)) / 16) * 16;
  } else {
    newH = base;
    newW = Math.round((base * (wRatio / hRatio)) / 16) * 16;
  }

  newW = Math.max(minSize, Math.min(maxSize, newW));
  newH = Math.max(minSize, Math.min(maxSize, newH));

  let total = newW * newH;
  if (total < minPixels) {
    const scaleFactor = Math.sqrt(minPixels / total);
    newW = Math.min(maxSize, Math.round((newW * scaleFactor) / 16) * 16);
    newH = Math.min(maxSize, Math.round((newH * scaleFactor) / 16) * 16);
  } else if (total > maxPixels) {
    const scaleFactor = Math.sqrt(maxPixels / total);
    newW = Math.max(minSize, Math.floor((newW * scaleFactor) / 16) * 16);
    newH = Math.max(minSize, Math.floor((newH * scaleFactor) / 16) * 16);
  }

  return { w: newW, h: newH };
};

const getRatioStyle = (ratioStr) => {
  const parts = ratioStr.split(':').map(Number);
  let w = parts[0];
  let h = parts[1];
  const maxD = 18;
  if (w >= h) {
    return { width: `${maxD}px`, height: `${Math.round(maxD * (h / w))}px` };
  } else {
    return { height: `${maxD}px`, width: `${Math.round(maxD * (w / h))}px` };
  }
};

const selectModel = (modelId) => {
  currentModel.value = modelId;
  saveLocal();
  emitSettings();
};

const onCustomModelInput = () => {
  saveLocal();
  emitSettings();
};

const selectRatio = (ratioVal) => {
  currentRatio.value = ratioVal;
  const { w, h } = calculateSize(ratioVal, currentLevel.value);
  width.value = w;
  height.value = h;
  saveLocal();
  emitSettings();
};

const selectLevel = (levelId) => {
  currentLevel.value = levelId;
  const { w, h } = calculateSize(currentRatio.value, levelId);
  width.value = w;
  height.value = h;
  saveLocal();
  emitSettings();
};

const resetToPreset = () => {
  const { w, h } = calculateSize(currentRatio.value, currentLevel.value);
  width.value = w;
  height.value = h;
  saveLocal();
  emitSettings();
};

const onSizeInput = (type) => {
  if (width.value % 16 !== 0) width.value = Math.round(width.value / 16) * 16;
  if (height.value % 16 !== 0) height.value = Math.round(height.value / 16) * 16;
  currentRatio.value = 'custom';
  saveLocal();
  emitSettings();
};

const updateQuality = (q) => {
  quality.value = q;
  saveLocal();
  emitSettings();
};

const updateOutputFormat = (f) => {
  outputFormat.value = f;
  saveLocal();
  emitSettings();
};

const toggleSidebar = () => {
  emit('update:isVisible', !props.isVisible);
};

const emitSettings = () => {
  const actualModel = currentModel.value === 'custom' 
    ? (customModelId.value.trim() || 'gpt-image-2') 
    : currentModel.value;

  emit('change-settings', {
    model: actualModel,
    width: width.value,
    height: height.value,
    ratio: currentRatio.value,
    level: currentLevel.value,
    quality: quality.value,
    outputFormat: outputFormat.value,
    outputCompression: outputCompression.value,
    transparentBackground: transparentBackground.value,
    skillsPrompt: combinedSkillsPrompt.value
  });
};

const saveLocal = () => {
  const settings = {
    model: currentModel.value,
    customModelId: customModelId.value,
    width: width.value,
    height: height.value,
    ratio: currentRatio.value,
    level: currentLevel.value,
    quality: quality.value,
    outputFormat: outputFormat.value,
    outputCompression: outputCompression.value,
    transparentBackground: transparentBackground.value
  };
  localStorage.setItem('sidebar_gen_settings_v3', JSON.stringify(settings));
};

onMounted(() => {
  // 加载 Skill 指令列表
  const savedSkills = localStorage.getItem('prompt_skills_v1');
  if (savedSkills) {
    try {
      const parsed = JSON.parse(savedSkills);
      if (Array.isArray(parsed) && parsed.length > 0) {
        promptSkills.value = parsed;
      }
    } catch (e) {}
  }

  // 加载通用设置
  const saved = localStorage.getItem('sidebar_gen_settings_v3') || localStorage.getItem('sidebar_gen_settings_v2');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.model) currentModel.value = parsed.model;
      if (parsed.customModelId) customModelId.value = parsed.customModelId;
      if (parsed.width) width.value = parsed.width;
      if (parsed.height) height.value = parsed.height;
      if (parsed.ratio) currentRatio.value = parsed.ratio;
      if (parsed.level) currentLevel.value = parsed.level;
      if (parsed.quality) quality.value = parsed.quality;
      if (parsed.outputFormat) outputFormat.value = parsed.outputFormat;
      if (parsed.outputCompression !== undefined) outputCompression.value = parsed.outputCompression;
      if (parsed.transparentBackground !== undefined) transparentBackground.value = parsed.transparentBackground;
    } catch (e) {}
  }
  emitSettings();
});
</script>

<style scoped>
.sidebar-container {
  position: relative;
  width: 320px;
  height: 100%;
  flex-shrink: 0;
  transition: width 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 20;
}

.sidebar-container.collapsed {
  width: 0;
}

/* 折叠/展开控制按钮 - 圆润饱满质感 */
.toggle-sidebar-btn {
  position: absolute;
  right: -16px;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 48px;
  background: var(--bg-card-solid);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 30;
  box-shadow: var(--shadow-md);
  transition: var(--transition-smooth);
}

.toggle-sidebar-btn:hover {
  background: var(--primary-color);
  color: #ffffff;
  border-color: var(--primary-color);
  transform: translateY(-50%) scale(1.05);
}

.sidebar-content {
  width: 320px;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  background: var(--bg-card);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-right: 1px solid var(--border-color);
  border-top: none;
  border-bottom: none;
  border-left: none;
  border-radius: 0;
  box-shadow: var(--shadow-sm);
  transform: translateX(0);
  opacity: 1;
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease, var(--transition-theme);
}

.sidebar-container.collapsed .sidebar-content {
  transform: translateX(-100%);
  opacity: 0;
  pointer-events: none;
}

.section-title {
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.main-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-label {
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--text-secondary);
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.model-multi-hint {
  font-size: 0.68rem;
  color: var(--accent-indigo);
  font-weight: 500;
  margin-left: 6px;
  text-transform: none;
}

/* 模型选择网格 - 圆润 Bento 卡片 */
.model-select-grid {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.model-card {
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  display: flex;
  flex-direction: column;
  transition: var(--transition-smooth);
}

:root[data-theme="light"] .model-card:not(.active) {
  background: rgba(0, 0, 0, 0.03);
}

.model-card:not(.active):hover {
  background: rgba(255, 255, 255, 0.07);
  transform: translateY(-1px);
}

:root[data-theme="light"] .model-card:not(.active):hover {
  background: rgba(0, 0, 0, 0.06);
}

.model-card.active,
:root[data-theme="light"] .model-card.active {
  background: var(--primary-gradient) !important;
  color: #ffffff !important;
  border-color: transparent !important;
  box-shadow: 0 4px 18px -2px var(--accent-glow) !important;
}

.model-card.active .model-name,
:root[data-theme="light"] .model-card.active .model-name {
  color: #ffffff !important;
}

.model-card-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.model-icon {
  font-size: 0.95rem;
  line-height: 1;
}

.model-name {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-primary);
  transition: color 0.2s ease;
}

/* 标签：彻底去除胶囊框，极简发光指示点 */
.model-tag {
  font-size: 0.64rem;
  font-weight: 600;
  margin-left: auto;
  background: transparent !important;
  border: none !important;
  padding: 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.model-tag::before {
  content: "";
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.model-tag.speed {
  color: var(--accent-emerald);
}

.model-card.active .model-tag.speed {
  color: #a7f3d0;
}

.model-tag.quality {
  color: var(--accent-coral);
}

.model-card.active .model-tag.quality {
  color: #fecdd3;
}

.custom-model-sidebar-box {
  margin-top: 4px;
}

.sidebar-custom-model-input {
  width: 100%;
  padding: 9px 12px;
  background: var(--bg-input);
  border: 1px solid var(--border-focus);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 0.78rem;
  outline: none;
  transition: var(--transition-smooth);
}

.sidebar-custom-model-input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

/* 核心：个性指令集 (Prompt Skills) - 极简高质感微曲面面板 */
.skills-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skills-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.skills-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.active-count-tag {
  font-size: 0.65rem;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: var(--radius-micro);
  background: var(--accent-emerald-bg);
  border: none;
  color: var(--accent-emerald);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.active-count-tag::before {
  content: "";
  display: inline-block;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 6px currentColor;
}

.skills-dropdown-wrapper {
  position: relative;
  width: 100%;
}

/* 下拉触发器：饱满实体微曲面，彻底告别硬质塑料胶囊框 */
.skills-dropdown-trigger {
  width: 100%;
  padding: 9px 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid transparent;
  border-radius: var(--radius-xs);
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: var(--transition-smooth);
  user-select: none;
}

:root[data-theme="light"] .skills-dropdown-trigger {
  background: rgba(0, 0, 0, 0.03);
}

.skills-dropdown-trigger:hover {
  background: rgba(255, 255, 255, 0.07);
  transform: translateY(-1px);
}

:root[data-theme="light"] .skills-dropdown-trigger:hover {
  background: rgba(0, 0, 0, 0.06);
}

.skills-dropdown-trigger.open,
.skills-dropdown-trigger.active {
  background: var(--primary-gradient-subtle);
  border-color: transparent;
  box-shadow: 0 2px 14px var(--accent-glow);
}

.trigger-left {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.trigger-icon {
  font-size: 0.9rem;
}

.trigger-text {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.trigger-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-pill);
  background: var(--color-success);
  box-shadow: 0 0 6px var(--color-success);
}

.dropdown-arrow {
  color: var(--text-muted);
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.dropdown-arrow.rotated {
  transform: rotate(180deg);
  color: var(--primary-color);
}

/* 下拉菜单面板 */
.skills-dropdown-menu {
  margin-top: 6px;
  background: var(--bg-surface-elevated);
  border: 1px solid var(--border-focus);
  box-shadow: var(--shadow-lg);
  border-radius: var(--radius-md);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  backdrop-filter: var(--glass-blur);
  z-index: 50;
}

.dropdown-skills-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 240px;
  overflow-y: auto;
  padding-right: 2px;
}

.dropdown-skill-item {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid transparent;
  border-radius: var(--radius-xs);
  padding: 8px 10px;
  transition: var(--transition-smooth);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

:root[data-theme="light"] .dropdown-skill-item {
  background: rgba(0, 0, 0, 0.03);
}

.dropdown-skill-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

:root[data-theme="light"] .dropdown-skill-item:hover {
  background: rgba(0, 0, 0, 0.05);
}

.dropdown-skill-item.checked {
  background: var(--primary-gradient-subtle);
  border-color: transparent;
}

.dropdown-skill-item.editing {
  background: var(--bg-card-hover);
  border-color: var(--border-focus);
}

.skill-row-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.skill-check-area {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  flex: 1;
  overflow: hidden;
}

.skill-checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--primary-color);
  cursor: pointer;
  flex-shrink: 0;
}

.skill-item-title {
  font-size: 0.8rem;
  color: var(--text-primary);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.skill-item-btns {
  display: flex;
  align-items: center;
  gap: 4px;
}

.skill-icon-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  padding: 4px;
  border-radius: var(--radius-xs);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-fast);
}

.skill-icon-btn:hover,
.skill-icon-btn.active {
  color: var(--primary-color);
  background: var(--accent-indigo-bg);
}

.skill-icon-btn.del-btn:hover {
  color: var(--color-error);
  background: var(--accent-coral-bg);
}

/* 展开的编辑区 */
.skill-edit-box {
  padding-top: 8px;
  border-top: 1px dashed var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.edit-input-group {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.edit-input-label {
  font-size: 0.68rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.edit-name-field {
  width: 100%;
  padding: 6px 10px;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xs);
  color: var(--text-primary);
  font-size: 0.76rem;
  outline: none;
}

.edit-name-field:focus {
  border-color: var(--primary-color);
}

.edit-textarea-field {
  width: 100%;
  padding: 6px 10px;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xs);
  color: var(--text-primary);
  font-size: 0.74rem;
  line-height: 1.4;
  resize: vertical;
  outline: none;
}

.edit-textarea-field:focus {
  border-color: var(--primary-color);
}

.dropdown-footer-row {
  padding-top: 6px;
  border-top: 1px solid var(--border-color);
}

.add-skill-button {
  width: 100%;
  padding: 7px;
  background: var(--accent-indigo-bg);
  border: 1px dashed var(--accent-indigo);
  border-radius: var(--radius-sm);
  color: var(--accent-indigo);
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: var(--transition-smooth);
}

.add-skill-button:hover {
  background: var(--primary-color);
  color: #ffffff;
  border-style: solid;
}

/* 比例网格 (彻底去除死板线框！平实底板 + 饱满实体激活) */
.ratio-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 7px;
}

.ratio-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10px 4px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: var(--transition-smooth);
  color: var(--text-secondary);
  gap: 4px;
}

:root[data-theme="light"] .ratio-card:not(.active) {
  background: rgba(0, 0, 0, 0.03);
}

.ratio-card:not(.active):hover {
  background: rgba(255, 255, 255, 0.07);
  color: var(--text-primary);
  transform: translateY(-1px);
}

:root[data-theme="light"] .ratio-card:not(.active):hover {
  background: rgba(0, 0, 0, 0.06);
}

.ratio-card.active,
:root[data-theme="light"] .ratio-card.active {
  background: var(--primary-gradient) !important;
  border-color: transparent !important;
  color: #ffffff !important;
  box-shadow: 0 4px 16px -2px var(--accent-glow) !important;
}

.ratio-box {
  background: currentColor;
  opacity: 0.45;
  border-radius: 3px;
  margin-bottom: 2px;
}

.ratio-card.active .ratio-box,
:root[data-theme="light"] .ratio-card.active .ratio-box {
  opacity: 1;
  background: #ffffff !important;
}

.ratio-name {
  font-size: 0.8rem;
  font-weight: 700;
}

.ratio-desc {
  font-size: 0.65rem;
  opacity: 0.75;
}

.ratio-card.active .ratio-desc,
:root[data-theme="light"] .ratio-card.active .ratio-desc {
  color: rgba(255, 255, 255, 0.85) !important;
  opacity: 0.9;
}

/* 级别选择器 (无缝沉浸式平滑轨道，彻底告别一个个胶囊框) */
.level-selector {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  background: rgba(255, 255, 255, 0.03);
  padding: 3px;
  border-radius: 8px;
}

:root[data-theme="light"] .level-selector {
  background: rgba(0, 0, 0, 0.03);
}

.level-btn {
  padding: 8px 4px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition-smooth);
}

.level-btn:not(.active):hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-primary);
}

:root[data-theme="light"] .level-btn:not(.active):hover {
  background: rgba(0, 0, 0, 0.05);
}

.level-btn.active,
:root[data-theme="light"] .level-btn.active {
  background: var(--primary-gradient) !important;
  border: none !important;
  color: #ffffff !important;
  box-shadow: 0 3px 12px var(--accent-glow) !important;
}

/* 尺寸与滑块 */
.size-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.link-btn {
  background: none;
  border: none;
  color: var(--accent-indigo);
  font-size: 0.74rem;
  font-weight: 600;
  cursor: pointer;
}

.link-btn:hover {
  text-decoration: underline;
}

.size-sliders {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 4px;
}

.slider-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.slider-label {
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.custom-slider {
  width: 100%;
  accent-color: var(--primary-color);
  cursor: pointer;
  height: 6px;
  border-radius: 4px;
}

.pixel-info {
  font-size: 0.72rem;
  color: var(--text-muted);
  margin-top: 4px;
  text-align: right;
  font-weight: 500;
}

.pixel-info.warning {
  color: var(--color-error);
  font-weight: 600;
}

/* 质量网格 (无框沉浸式，纯色饱满激活) */
.quality-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.quality-btn-new {
  position: relative;
  padding: 9px 4px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition-smooth);
}

:root[data-theme="light"] .quality-btn-new:not(.active) {
  background: rgba(0, 0, 0, 0.03);
}

.quality-btn-new:not(.active):hover {
  background: rgba(255, 255, 255, 0.07);
  color: var(--text-primary);
}

:root[data-theme="light"] .quality-btn-new:not(.active):hover {
  background: rgba(0, 0, 0, 0.06);
}

.quality-btn-new.active,
:root[data-theme="light"] .quality-btn-new.active {
  background: var(--primary-gradient) !important;
  border-color: transparent !important;
  color: #ffffff !important;
  box-shadow: 0 3px 12px var(--accent-glow) !important;
}

.quality-btn-new.highlight-quality.active,
:root[data-theme="light"] .quality-btn-new.highlight-quality.active {
  background: linear-gradient(135deg, #ec4899 0%, #f43f5e 100%) !important;
}

.quality-badge {
  position: absolute;
  top: -3px;
  right: -3px;
  font-size: 0.58rem;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 4px;
  background: var(--accent-coral);
  color: #fff;
  box-shadow: 0 1px 4px rgba(244, 63, 94, 0.4);
}

/* 输出格式 (无框纯色激活) */
.format-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.format-btn {
  padding: 9px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;
  transition: var(--transition-smooth);
}

:root[data-theme="light"] .format-btn:not(.active) {
  background: rgba(0, 0, 0, 0.03);
}

.format-btn:not(.active):hover {
  background: rgba(255, 255, 255, 0.07);
  color: var(--text-primary);
}

:root[data-theme="light"] .format-btn:not(.active):hover {
  background: rgba(0, 0, 0, 0.06);
}

.format-btn.active,
:root[data-theme="light"] .format-btn.active {
  background: var(--primary-gradient) !important;
  border-color: transparent !important;
  color: #ffffff !important;
  box-shadow: 0 3px 12px var(--accent-glow) !important;
}

/* 特性开关 */
.feature-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--bg-subtle);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
}

.feature-toggle-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.feature-title {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-primary);
}

.feature-desc {
  font-size: 0.68rem;
  color: var(--text-muted);
}

.toggle-checkbox {
  width: 17px;
  height: 17px;
  accent-color: var(--primary-color);
  cursor: pointer;
}

.param-desc {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-top: 4px;
  line-height: 1.4;
}

/* 下拉滑动过渡 */
.dropdown-slide-enter-active,
.dropdown-slide-leave-active {
  transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  transform-origin: top;
}

.dropdown-slide-enter-from,
.dropdown-slide-leave-to {
  opacity: 0;
  transform: scaleY(0.92) translateY(-6px);
}
</style>
