<template>
  <div class="app-wrapper">
    <!-- 顶部状态栏 -->
    <header class="app-header glass-panel">
      <div class="header-logo">
        <div class="logo-glow"></div>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="logo-icon"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
        <div class="logo-text">
          <h1>智能生图工坊</h1>
          <span class="version-tag">GPT Image 2</span>
        </div>
      </div>

      <!-- 右上角控制 -->
      <div class="header-controls">
        <div class="api-status-badge" :class="{ 'configured': isApiConfigured }">
          <span class="status-dot"></span>
          <span class="status-text">{{ isApiConfigured ? 'API 已配置' : 'API 未设置' }}</span>
        </div>
        <button class="icon-btn settings-btn" @click="isSettingsOpen = true" title="设置 API 参数">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="settings-gear"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        </button>
      </div>
    </header>

    <!-- 主体区域 -->
    <div class="app-main">
      <!-- 左侧设置栏 -->
      <Sidebar 
        v-model:isVisible="sidebarVisible" 
        @change-settings="handleSettingsChange"
      />

      <!-- 中央展示与输入区 -->
      <div class="content-area" :class="{ 'empty': historyList.length === 0 && !isGenerating }">
        <!-- 历史作品瀑布流 -->
        <div class="gallery-wrapper" :class="{ 'visible': historyList.length > 0 || isGenerating }">
          <Gallery 
            :items="historyList" 
            :isGenerating="isGenerating"
            @preview="openPreview"
            @reuse-prompt="handleReusePrompt"
            @delete="handleDeleteImage"
            @show-toast="showToastMsg"
          />
        </div>

        <!-- 空白时的主页展示 -->
        <div class="hero-section" :class="{ 'collapsed': historyList.length > 0 || isGenerating }">
          <div class="hero-title">
            <h2>创造你的视觉世界</h2>
            <p>基于先进的 GPT Image 2 模型，支持全维度自定义比例与极清图像生成。</p>
          </div>
        </div>

        <!-- 底部输入框容器 -->
        <div class="input-wrapper">
          <PromptInput 
            ref="promptInputRef"
            :isGenerating="isGenerating" 
            @generate="generateImage"
          />
        </div>
      </div>
    </div>

    <!-- API 设置弹窗 -->
    <SettingsModal 
      :isOpen="isSettingsOpen"
      :baseURL="baseURL"
      :apiKey="apiKey"
      :model="model"
      @close="isSettingsOpen = false"
      @save="saveApiConfig"
    />

    <!-- 全屏大图预览灯箱 -->
    <Lightbox 
      :isOpen="isLightboxOpen"
      :item="activePreviewItem"
      @close="closePreview"
    />

    <!-- Toast 提示消息 -->
    <Transition name="slide-toast">
      <div v-if="toast.show" class="toast-notification" :class="toast.type">
        <span class="toast-icon">
          <svg v-if="toast.type === 'success'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          <svg v-else-if="toast.type === 'error'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        </span>
        <span class="toast-text">{{ toast.message }}</span>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import Sidebar from './components/Sidebar.vue';
import SettingsModal from './components/SettingsModal.vue';
import PromptInput from './components/PromptInput.vue';
import Gallery from './components/Gallery.vue';
import Lightbox from './components/Lightbox.vue';

// API 配置状态
const baseURL = ref('');
const apiKey = ref('');
const model = ref('gpt-image-2');

// UI 状态
const sidebarVisible = ref(true);
const isSettingsOpen = ref(false);
const isGenerating = ref(false);
const isLightboxOpen = ref(false);
const activePreviewItem = ref({});

// 图像生成配置
const genSettings = ref({
  width: 1024,
  height: 1024,
  quality: 'standard',
  ratio: '1:1'
});

// 历史作品列表
const historyList = ref([]);

// Toast 弹窗状态
const toast = ref({
  show: false,
  message: '',
  type: 'info'
});

// PromptInput 实例引用，用于重填词
const promptInputRef = ref(null);

const isApiConfigured = computed(() => {
  return apiKey.value.trim().length > 0;
});

// 初始化加载配置
onMounted(() => {
  baseURL.value = localStorage.getItem('api_base_url') || 'https://api.openai.com/v1';
  apiKey.value = localStorage.getItem('api_key') || '';
  model.value = localStorage.getItem('api_model') || 'gpt-image-2';
  
  const savedSidebar = localStorage.getItem('sidebar_visible');
  sidebarVisible.value = savedSidebar !== null ? JSON.parse(savedSidebar) : true;

  try {
    const savedHistory = localStorage.getItem('image_history');
    historyList.value = savedHistory ? JSON.parse(savedHistory) : [];
  } catch (e) {
    console.error('Failed to parse history', e);
    historyList.value = [];
  }
});

// 处理生图设置的变更
const handleSettingsChange = (newSettings) => {
  genSettings.value = newSettings;
};

// 保存 API 参数
const saveApiConfig = (config) => {
  baseURL.value = config.baseURL;
  apiKey.value = config.apiKey;
  model.value = config.model;
  
  localStorage.setItem('api_base_url', config.baseURL);
  localStorage.setItem('api_key', config.apiKey);
  localStorage.setItem('api_model', config.model);
  
  showToastMsg({ message: '配置保存成功！', type: 'success' });
};

// 监听侧边栏可见度
const handleSidebarToggle = (val) => {
  sidebarVisible.value = val;
  localStorage.setItem('sidebar_visible', JSON.stringify(val));
};

// 重用提示词
const handleReusePrompt = (promptText) => {
  if (promptInputRef.value) {
    promptInputRef.value.prompt = promptText;
    promptInputRef.value.adjustHeight();
    promptInputRef.value.textareaRef?.focus();
    showToastMsg({ message: '提示词已填入输入框', type: 'info' });
  }
};

// 删除作品
const handleDeleteImage = (id) => {
  historyList.value = historyList.value.filter(item => item.id !== id);
  localStorage.setItem('image_history', JSON.stringify(historyList.value));
  showToastMsg({ message: '生图记录已删除', type: 'info' });
};

// 打开大图预览
const openPreview = (item) => {
  activePreviewItem.value = item;
  isLightboxOpen.value = true;
};

const closePreview = () => {
  isLightboxOpen.value = false;
};

// 全局 Toast
const showToastMsg = ({ message, type = 'info' }) => {
  toast.value.message = message;
  toast.value.type = type;
  toast.value.show = true;
  
  setTimeout(() => {
    toast.value.show = false;
  }, 3000);
};

// 核心功能：调用 API 进行生图
const generateImage = async (promptText) => {
  if (!isApiConfigured.value) {
    showToastMsg({ message: '请先点击右上角设置，配置 API Key！', type: 'error' });
    isSettingsOpen.value = true;
    return;
  }

  isGenerating.value = true;
  showToastMsg({ message: '图像生成请求已提交，正在等待排队渲染...', type: 'info' });

  const requestURL = `${baseURL.value.replace(/\/$/, '')}/images/generations`;
  const sizeString = `${genSettings.value.width}x${genSettings.value.height}`;

  try {
    const response = await fetch(requestURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.value}`
      },
      body: JSON.stringify({
        model: model.value,
        prompt: promptText,
        n: 1,
        size: sizeString,
        quality: genSettings.value.quality
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data.error?.message || `生图接口返回错误 (状态码 ${response.status})`;
      throw new Error(errMsg);
    }

    if (!data.data || data.data.length === 0 || !data.data[0].url) {
      throw new Error('生图接口未返回有效的图片链接，请检查通道是否畅通。');
    }

    const imageUrl = data.data[0].url;

    // 新增历史记录
    const newRecord = {
      id: Date.now(),
      url: imageUrl,
      prompt: promptText,
      width: genSettings.value.width,
      height: genSettings.value.height,
      model: model.value,
      timestamp: Date.now()
    };

    historyList.value.unshift(newRecord);
    localStorage.setItem('image_history', JSON.stringify(historyList.value));

    showToastMsg({ message: '绘制大功告成！画面已呈现在相册中。', type: 'success' });

  } catch (error) {
    console.error('Image generation error:', error);
    showToastMsg({ message: `生成失败: ${error.message}`, type: 'error' });
  } finally {
    isGenerating.value = false;
  }
};
</script>

<style>
/* 全局应用架构布局 */
.app-wrapper {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background-color: var(--bg-color);
  background-image: 
    radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.05) 0px, transparent 50%),
    radial-gradient(at 50% 0%, rgba(139, 92, 246, 0.05) 0px, transparent 50%);
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 24px;
  height: 64px;
  z-index: 100;
  border-radius: 0;
  border-top: none;
  border-left: none;
  border-right: none;
  background: rgba(15, 23, 42, 0.4);
}

.header-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
}

.logo-glow {
  position: absolute;
  width: 30px;
  height: 30px;
  background: var(--primary-gradient);
  filter: blur(12px);
  opacity: 0.6;
  border-radius: 50%;
}

.logo-icon {
  color: var(--accent-color);
  z-index: 1;
}

.logo-text h1 {
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.logo-text {
  display: flex;
  align-items: center;
  gap: 8px;
}

.version-tag {
  font-size: 0.65rem;
  background: var(--primary-gradient);
  color: #fff;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 700;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

.api-status-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--border-color);
  padding: 4px 12px;
  border-radius: 99px;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-error);
}

.api-status-badge.configured .status-dot {
  background: var(--color-success);
  box-shadow: 0 0 8px var(--color-success);
}

.icon-btn {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
  border-color: rgba(255, 255, 255, 0.2);
}

.settings-btn:hover .settings-gear {
  transform: rotate(45deg);
}

.settings-gear {
  transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.app-main {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}

/* 中央生图展示与输入区布局 */
.content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  transition: var(--transition-smooth);
}

.gallery-wrapper {
  flex: 1;
  overflow: hidden;
  height: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.6s ease, height 0.6s cubic-bezier(0.25, 1, 0.5, 1);
}

.gallery-wrapper.visible {
  height: 100%;
  opacity: 1;
  pointer-events: auto;
}

.input-wrapper {
  padding: 24px;
  background: linear-gradient(to top, rgba(6, 9, 19, 0.8) 50%, rgba(6, 9, 19, 0) 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
  transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1), background-color 0.6s ease;
}

/* 页面没有生图历史时的居中排列 */
.content-area.empty {
  justify-content: center;
}

.content-area.empty .input-wrapper {
  margin-top: 20px;
  margin-bottom: auto;
  transform: translateY(-20px);
  background: transparent;
}

.hero-section {
  text-align: center;
  margin-top: auto;
  margin-bottom: 20px;
  padding: 0 24px;
  opacity: 1;
  max-height: 300px;
  transition: opacity 0.4s ease, max-height 0.6s cubic-bezier(0.25, 1, 0.5, 1), margin 0.6s cubic-bezier(0.25, 1, 0.5, 1), padding 0.6s cubic-bezier(0.25, 1, 0.5, 1);
}

.hero-section.collapsed {
  max-height: 0;
  opacity: 0;
  margin: 0;
  padding: 0;
  pointer-events: none;
  overflow: hidden;
}

.hero-title h2 {
  font-size: 2.25rem;
  font-weight: 800;
  margin-bottom: 12px;
  background: linear-gradient(135deg, #c7d2fe 0%, #8678f9 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: -0.02em;
}

.hero-title p {
  font-size: 1rem;
  color: var(--text-secondary);
  max-width: 500px;
  margin: 0 auto;
  line-height: 1.6;
}

/* Toast 通知样式 */
.toast-notification {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border-color);
  padding: 12px 20px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  z-index: 3000;
  max-width: 90vw;
}

.toast-icon {
  display: flex;
  align-items: center;
}

.toast-notification.success {
  border-color: rgba(16, 185, 129, 0.3);
}
.toast-notification.success .toast-icon {
  color: var(--color-success);
}

.toast-notification.error {
  border-color: rgba(244, 63, 94, 0.3);
}
.toast-notification.error .toast-icon {
  color: var(--color-error);
}

.toast-notification.warning {
  border-color: rgba(245, 158, 11, 0.3);
}
.toast-notification.warning .toast-icon {
  color: var(--color-warning);
}

.toast-notification.info .toast-icon {
  color: var(--accent-color);
}

.toast-text {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-primary);
}

/* Toast 动画 */
.slide-toast-enter-active,
.slide-toast-leave-active {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease;
}

.slide-toast-enter-from {
  transform: translate(-50%, -30px);
  opacity: 0;
}

.slide-toast-leave-to {
  transform: translate(-50%, -20px);
  opacity: 0;
}
</style>
