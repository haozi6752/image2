<template>
  <div class="sidebar-container" :class="{ 'collapsed': !isVisible }">
    <!-- 折叠/展开控制按钮 -->
    <button class="toggle-sidebar-btn" @click="toggleSidebar" :title="isVisible ? '收起面板' : '展开面板'">
      <svg v-if="isVisible" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
    </button>

    <div class="sidebar-content glass-panel" v-show="isVisible">
      <!-- 顶部标题 (已去除 GPT-Image 2.5 标识) -->
      <div class="section-title">
        <span class="main-title">画布与生图配置</span>
      </div>

      <!-- 1. 模型选择 (已去除 dall-e-3，去掉多余小字) -->
      <div class="setting-group">
        <label class="group-label">生图模型 (MODEL) <span class="model-multi-hint">(支持 1~16 张参考图融合)</span></label>
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
            <label class="group-label">个性指令集 (PROMPT SKILLS)</label>
            <span class="active-count-tag" v-if="activeSkillsCount > 0">{{ activeSkillsCount }} 项生效</span>
          </div>
        </div>
        <span class="skills-subdesc">类似于 Skill 设定，下拉勾选即自动注入提示词。</span>

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
        <label class="group-label">图片比例 (ASPECT RATIO)</label>
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
        <label class="group-label">画质级别 (RESOLUTION LEVEL)</label>
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
          <span v-if="isPixelLimitExceeded" class="limit-warning">(超出规范范围)</span>
        </div>
      </div>

      <!-- 6. 生成质量 (Quality) -->
      <div class="setting-group">
        <label class="group-label">生成质量 (QUALITY)</label>
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
        <label class="group-label">输出格式 (OUTPUT FORMAT)</label>
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
  if (active.length === 0) return '未启用个性指令 (点击下拉选择)';
  if (active.length === 1) return `已启用: ${active[0].name}`;
  return `已启用 ${active.length} 项个性指令`;
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
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 10;
}

.sidebar-container.collapsed {
  width: 0;
}

.toggle-sidebar-btn {
  position: absolute;
  right: -16px;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 48px;
  background: rgba(18, 20, 29, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 20;
  transition: all 0.2s;
}

.toggle-sidebar-btn:hover {
  background: #6366f1;
  color: #fff;
  border-color: #6366f1;
}

.sidebar-content {
  width: 320px;
  height: 100%;
  overflow-y: auto;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  background: rgba(15, 17, 26, 0.85);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
}

.section-title {
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.main-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #f1f5f9;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-label {
  font-size: 0.76rem;
  font-weight: 600;
  color: #94a3b8;
  letter-spacing: 0.5px;
}

.model-multi-hint {
  font-size: 0.66rem;
  color: #a5b4fc;
  font-weight: normal;
  margin-left: 6px;
  opacity: 0.9;
}

/* 模型选择网格 */
.model-select-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.model-card {
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  display: flex;
  flex-direction: column;
  transition: all 0.15s;
}

.model-card:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.15);
}

.model-card.active {
  background: rgba(99, 102, 241, 0.15);
  border-color: #6366f1;
}

.model-card-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.model-icon {
  font-size: 0.9rem;
}

.model-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: #f8fafc;
}

.model-tag {
  font-size: 0.65rem;
  padding: 1px 5px;
  border-radius: 4px;
  margin-left: auto;
}

.model-tag.speed {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.35);
  color: #34d399;
}

.model-tag.quality {
  background: rgba(236, 72, 153, 0.15);
  border: 1px solid rgba(236, 72, 153, 0.35);
  color: #f472b6;
}

.custom-model-sidebar-box {
  margin-top: 4px;
}

.sidebar-custom-model-input {
  width: 100%;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(99, 102, 241, 0.4);
  border-radius: 8px;
  color: #f8fafc;
  font-size: 0.75rem;
  outline: none;
  transition: all 0.2s;
}

.sidebar-custom-model-input:focus {
  border-color: #818cf8;
  background: rgba(99, 102, 241, 0.12);
}

/* 核心：个性指令集 (Prompt Skills) 下拉菜单样式 */
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
  padding: 1px 7px;
  border-radius: 10px;
  background: rgba(16, 185, 129, 0.2);
  border: 1px solid rgba(16, 185, 129, 0.4);
  color: #34d399;
}

.skills-subdesc {
  font-size: 0.68rem;
  color: #64748b;
  line-height: 1.35;
}

.skills-dropdown-wrapper {
  position: relative;
  width: 100%;
}

/* 下拉触发器 */
.skills-dropdown-trigger {
  width: 100%;
  padding: 9px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 9px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
}

.skills-dropdown-trigger:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(99, 102, 241, 0.4);
}

.skills-dropdown-trigger.open {
  border-color: #6366f1;
  background: rgba(99, 102, 241, 0.1);
  box-shadow: 0 0 12px rgba(99, 102, 241, 0.25);
}

.skills-dropdown-trigger.active {
  border-color: rgba(99, 102, 241, 0.5);
}

.trigger-left {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.trigger-icon {
  font-size: 0.85rem;
}

.trigger-text {
  font-size: 0.78rem;
  font-weight: 500;
  color: #f1f5f9;
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
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 6px #10b981;
}

.dropdown-arrow {
  color: #94a3b8;
  transition: transform 0.25s ease;
}

.dropdown-arrow.rotated {
  transform: rotate(180deg);
  color: #6366f1;
}

/* 下拉菜单面板 */
.skills-dropdown-menu {
  margin-top: 6px;
  background: rgba(18, 20, 30, 0.98);
  border: 1px solid rgba(99, 102, 241, 0.35);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.6), 0 0 16px rgba(99, 102, 241, 0.15);
  border-radius: 10px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  backdrop-filter: blur(12px);
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
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 6px 8px;
  transition: all 0.15s ease;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dropdown-skill-item.checked {
  background: rgba(99, 102, 241, 0.09);
  border-color: rgba(99, 102, 241, 0.3);
}

.dropdown-skill-item.editing {
  border-color: #818cf8;
  background: rgba(99, 102, 241, 0.12);
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
  width: 15px;
  height: 15px;
  accent-color: #6366f1;
  cursor: pointer;
  flex-shrink: 0;
}

.skill-item-title {
  font-size: 0.78rem;
  color: #f1f5f9;
  font-weight: 500;
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
  color: #94a3b8;
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.skill-icon-btn:hover,
.skill-icon-btn.active {
  color: #6366f1;
  background: rgba(99, 102, 241, 0.2);
}

.skill-icon-btn.del-btn:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.2);
}

/* 展开的编辑区 */
.skill-edit-box {
  padding-top: 6px;
  border-top: 1px dashed rgba(255, 255, 255, 0.08);
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
  font-size: 0.65rem;
  color: #94a3b8;
}

.edit-name-field {
  width: 100%;
  padding: 5px 8px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #fff;
  font-size: 0.74rem;
  outline: none;
}

.edit-name-field:focus {
  border-color: #6366f1;
}

.edit-textarea-field {
  width: 100%;
  padding: 6px 8px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #e2e8f0;
  font-size: 0.72rem;
  line-height: 1.4;
  resize: vertical;
  outline: none;
}

.edit-textarea-field:focus {
  border-color: #6366f1;
}

.dropdown-footer-row {
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.add-skill-button {
  width: 100%;
  padding: 6px;
  background: rgba(99, 102, 241, 0.15);
  border: 1px dashed rgba(99, 102, 241, 0.4);
  border-radius: 6px;
  color: #a5b4fc;
  font-size: 0.74rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.15s;
}

.add-skill-button:hover {
  background: rgba(99, 102, 241, 0.3);
  color: #fff;
}

/* 比例网格 */
.ratio-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.ratio-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10px 4px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  color: #94a3b8;
  gap: 4px;
}

.ratio-card:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #e2e8f0;
}

.ratio-card.active {
  background: rgba(99, 102, 241, 0.18);
  border-color: #6366f1;
  color: #fff;
}

.ratio-box {
  background: currentColor;
  opacity: 0.45;
  border-radius: 2px;
  margin-bottom: 2px;
}

.ratio-card.active .ratio-box {
  opacity: 0.9;
  background: #818cf8;
}

.ratio-name {
  font-size: 0.78rem;
  font-weight: 600;
}

.ratio-desc {
  font-size: 0.65rem;
  opacity: 0.7;
}

/* 级别 */
.level-selector {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.level-btn {
  padding: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  color: #94a3b8;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.level-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #f1f5f9;
}

.level-btn.active {
  background: rgba(99, 102, 241, 0.18);
  border-color: #6366f1;
  color: #fff;
  font-weight: 600;
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
  color: #818cf8;
  font-size: 0.72rem;
  cursor: pointer;
}

.link-btn:hover {
  text-decoration: underline;
}

.size-sliders {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.slider-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.slider-label {
  font-size: 0.72rem;
  color: #cbd5e1;
}

.custom-slider {
  width: 100%;
  accent-color: #6366f1;
  cursor: pointer;
}

.pixel-info {
  font-size: 0.7rem;
  color: #64748b;
  margin-top: 4px;
  text-align: right;
}

.pixel-info.warning {
  color: #ef4444;
}

/* 质量网格 */
.quality-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.quality-btn-new {
  position: relative;
  padding: 8px 4px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  color: #94a3b8;
  font-size: 0.73rem;
  cursor: pointer;
  transition: all 0.15s;
}

.quality-btn-new:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}

.quality-btn-new.active {
  background: rgba(99, 102, 241, 0.2);
  border-color: #6366f1;
  color: #fff;
  font-weight: 600;
}

.quality-btn-new.highlight-quality.active {
  border-color: #ec4899;
  background: rgba(236, 72, 153, 0.2);
}

.quality-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  font-size: 0.55rem;
  padding: 1px 4px;
  border-radius: 4px;
  background: #ec4899;
  color: #fff;
}

/* 输出格式 */
.format-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.format-btn {
  padding: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  color: #94a3b8;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s;
}

.format-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}

.format-btn.active {
  background: rgba(99, 102, 241, 0.2);
  border-color: #6366f1;
  color: #fff;
  font-weight: 600;
}

/* 特性开关 */
.feature-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.feature-toggle-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.feature-title {
  font-size: 0.75rem;
  font-weight: 500;
  color: #cbd5e1;
}

.feature-desc {
  font-size: 0.65rem;
  color: #64748b;
}

.toggle-checkbox {
  width: 16px;
  height: 16px;
  accent-color: #6366f1;
  cursor: pointer;
}

.param-desc {
  font-size: 0.68rem;
  color: #64748b;
  margin-top: 4px;
  line-height: 1.35;
}

::-webkit-scrollbar {
  width: 4px;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
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
