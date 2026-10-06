<template>
  <div class="app-wrapper">
    <!-- 顶部状态栏与导航 -->
    <header class="app-header glass-panel">
      <!-- 左侧：品牌 Logo -->
      <div class="header-logo">
        <div class="logo-glow"></div>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="logo-icon"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
        <div class="logo-text">
          <h1>智能生图工坊</h1>
        </div>
      </div>

      <!-- 中间：顶部悬浮双页切换按钮 (灵感画布 vs 成果画廊) -->
      <div class="nav-segment-control">
        <button 
          class="nav-tab-btn" 
          :class="{ active: currentTab === 'canvas' }"
          @click="currentTab = 'canvas'"
          title="节点式无限探索画布，支持图与图多轮参考衍生"
        >
          <span class="tab-icon">🎨</span>
          <span class="tab-label">灵感画布</span>
        </button>
        <button 
          class="nav-tab-btn" 
          :class="{ active: currentTab === 'gallery' }"
          @click="currentTab = 'gallery'"
          title="浏览已生成的历史画作档案"
        >
          <span class="tab-icon">🖼️</span>
          <span class="tab-label">成果画廊</span>
          <span v-if="historyList.length > 0" class="history-count-badge">{{ historyList.length }}</span>
        </button>
      </div>

      <!-- 右上角控制 -->
      <div class="header-controls">
        <!-- 方案快捷切换 -->
        <div class="profile-quick-switch" v-if="apiProfiles.length > 0">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="profile-icon"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          <select 
            v-model="activeProfileId" 
            @change="handleProfileSwitch"
            class="profile-select"
          >
            <option v-for="p in apiProfiles" :key="p.id" :value="p.id">
              {{ p.provider ? `[${p.provider}] ` : '' }}{{ p.name }}
            </option>
          </select>
        </div>

        <div class="api-status-badge" :class="{ 'configured': isApiConfigured }">
          <span class="status-dot"></span>
          <span class="status-text">{{ isApiConfigured ? 'API 已配置' : 'API 未设置' }}</span>
        </div>
        <button class="icon-btn settings-btn" @click="isSettingsOpen = true" title="配置 API 服务商与方案">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="settings-gear"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        </button>
      </div>
    </header>

    <!-- 主体区域 -->
    <div class="app-main">
      <!-- 仅在画布页展示全局控制侧栏，画廊页隐藏以全屏沉浸浏览 -->
      <Sidebar 
        v-if="currentTab === 'canvas'"
        v-model:isVisible="sidebarVisible" 
        @change-settings="handleSettingsChange"
      />

      <!-- 中央页面视口容器 -->
      <div class="content-viewport">
        <!-- 页面一：灵感画布 (Canvas Workbench) -->
        <div v-show="currentTab === 'canvas'" class="tab-page canvas-page">
          <CanvasWorkbench 
            ref="canvasRef"
            :isGenerating="isGenerating"
            :currentSettings="genSettings"
            :historyItems="historyList"
            @generate="handleCanvasGenerate"
            @preview="openPreview"
            @show-toast="showToastMsg"
          />
        </div>

        <!-- 页面二：成果画廊 (Gallery Archive，纯粹浏览档案) -->
        <div v-show="currentTab === 'gallery'" class="tab-page gallery-page">
          <div class="gallery-inner-container">
            <Gallery 
              :items="historyList" 
              :isGenerating="isGenerating"
              @preview="openPreview"
              @reuse-prompt="handleReusePrompt"
              @delete="handleDeleteImage"
              @clear-all="handleClearAllGallery"
              @goto-canvas="currentTab = 'canvas'"
              @show-toast="showToastMsg"
              @send-to-canvas="handleSendToCanvas"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- API 设置弹窗 -->
    <SettingsModal 
      :isOpen="isSettingsOpen"
      :profiles="apiProfiles"
      :activeProfileId="activeProfileId"
      @close="isSettingsOpen = false"
      @save="saveApiProfiles"
    />

    <!-- 全屏大图预览灯箱 -->
    <Lightbox 
      :isOpen="isLightboxOpen"
      :item="activePreviewItem"
      @close="closePreview"
    />

    <!-- 全局 Toast 提示消息 -->
    <Transition name="slide-toast">
      <div v-if="toast.show" class="toast-notification" :class="toast.type">
        <span class="toast-icon">
          <svg v-if="toast.type === 'success'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          <svg v-else-if="toast.type === 'error'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
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
import CanvasWorkbench from './components/CanvasWorkbench.vue';
import { 
  initDB, 
  getAllHistoryRecords, 
  saveHistoryRecord, 
  deleteHistoryRecord, 
  clearAllRecords,
  migrateFromLocalStorage, 
  cacheImage, 
  getCachedImageUrl 
} from './utils/db';

// 当前页面标签：'canvas' (灵感画布) | 'gallery' (成果画廊)
const currentTab = ref('canvas');

// API 配置与多方案管理状态
const apiProfiles = ref([]);
const activeProfileId = ref('');

const activeProfile = computed(() => {
  return apiProfiles.value.find(p => p.id === activeProfileId.value) || null;
});

const isApiConfigured = computed(() => {
  return activeProfile.value?.apiKey?.trim()?.length > 0;
});

const uploadedImageB64 = ref('');
const usePersonalPrompt = ref(false);
const personalPrompt = ref('');

// UI 状态
const sidebarVisible = ref(true);
const isSettingsOpen = ref(false);
const isGenerating = ref(false);
const isLightboxOpen = ref(false);
const activePreviewItem = ref({});

// 画布组件实例引用
const canvasRef = ref(null);
const promptInputRef = ref(null);

// 图像生成配置
const genSettings = ref({
  model: 'gpt-image-2.5-flare',
  width: 1024,
  height: 1024,
  quality: 'high',
  outputFormat: 'png',
  outputCompression: 80,
  ratio: '1:1',
  transparentBackground: false
});

// 历史作品列表 (从 IndexedDB 异步读取与维护)
const historyList = ref([]);

// Toast 状态
const toast = ref({
  show: false,
  message: '',
  type: 'info'
});

// 显示 Toast
const showToastMsg = ({ message, type = 'info' }) => {
  toast.value = { show: true, message, type };
  setTimeout(() => {
    toast.value.show = false;
  }, 3500);
};

// 保存方案数据至 localStorage
const saveProfilesToStorage = () => {
  localStorage.setItem('api_profiles', JSON.stringify(apiProfiles.value));
  localStorage.setItem('active_profile_id', activeProfileId.value);
};

// 保存 API 方案并提示
const saveApiProfiles = ({ profiles, activeProfileId: selectedId }) => {
  apiProfiles.value = profiles;
  activeProfileId.value = selectedId;
  saveProfilesToStorage();
  showToastMsg({ message: 'API 方案保存成功！', type: 'success' });
};

// 头部快捷切换方案
const handleProfileSwitch = () => {
  saveProfilesToStorage();
  showToastMsg({ message: `已切换至方案：${activeProfile.value?.name}`, type: 'success' });
};

// 初始化：平滑迁移历史至 IndexedDB，彻底根除 localStorage 5MB 限制
onMounted(async () => {
  // 1. 初始化方案配置
  const savedProfiles = localStorage.getItem('api_profiles');
  const savedActiveId = localStorage.getItem('active_profile_id');
  
  if (savedProfiles) {
    try {
      apiProfiles.value = JSON.parse(savedProfiles);
      activeProfileId.value = savedActiveId || apiProfiles.value[0]?.id || '';
    } catch (e) {
      apiProfiles.value = [];
    }
  }

  if (apiProfiles.value.length === 0) {
    const defaultProfile = {
      id: 'default',
      provider: '官方 OpenAI',
      name: '标准方案',
      baseURL: 'https://api.openai.com/v1',
      apiKey: '',
      model: 'gpt-image-2.5-flare',
      useProxy: true
    };
    apiProfiles.value = [defaultProfile];
    activeProfileId.value = 'default';
    saveProfilesToStorage();
  }
  
  const savedSidebar = localStorage.getItem('sidebar_visible');
  sidebarVisible.value = savedSidebar !== null ? JSON.parse(savedSidebar) : true;

  // 2. 数据库初始化与数据迁移 (解决图四 QuotaExceededError 核心)
  try {
    await initDB();
    // 自动将用户原有的 localStorage 历史无损迁移到 IndexedDB，并清空 localStorage 缓存
    await migrateFromLocalStorage();
    
    // 从 IndexedDB 读取全部历史记录
    const records = await getAllHistoryRecords();
    historyList.value = records;

    // 异步解析离线 Blob 图片地址
    resolveOfflineUrls();
  } catch (e) {
    console.error('IndexedDB 历史加载失败:', e);
  }
});

// 解析 IndexedDB 离线缓存
const resolveOfflineUrls = async () => {
  for (let i = 0; i < historyList.value.length; i++) {
    const item = historyList.value[i];
    const localUrl = await getCachedImageUrl(item.id, item.url);
    if (localUrl !== item.url) {
      item.url = localUrl;
    }
  }
};

// 处理生图设置的变更
const handleSettingsChange = (newSettings) => {
  genSettings.value = { ...genSettings.value, ...newSettings };
  usePersonalPrompt.value = newSettings.usePersonalPrompt || false;
  personalPrompt.value = newSettings.personalPrompt || '';
};

// 处理参考图上传
const handleUploadImage = (base64) => {
  uploadedImageB64.value = base64;
};

// 核心网络请求逻辑 (文生图 / 单图衍生 / 多图融合)
const executeApiCall = async ({ prompt, model, size, refImageB64, refImagesB64 }) => {
  const currentConfig = activeProfile.value;
  if (!currentConfig || !currentConfig.apiKey) {
    throw new Error('请先在右上角设置中配置有效的 API Key！');
  }

  // 整理单图或多图列表 (兼容单字符串与多图数组，最多 16 张)
  let imagesList = [];
  if (Array.isArray(refImagesB64) && refImagesB64.length > 0) {
    imagesList = refImagesB64.filter(Boolean);
  } else if (refImageB64) {
    imagesList = [refImageB64];
  }

  const isEditMode = imagesList.length > 0;
  const targetPath = isEditMode ? '/images/edits' : '/images/generations';

  const cleanBase = currentConfig.baseURL.replace(/\/$/, '');
  let requestURL = cleanBase;
  if (cleanBase.endsWith(targetPath)) {
    requestURL = cleanBase;
  } else if (cleanBase.endsWith('/v1')) {
    requestURL = `${cleanBase}${targetPath}`;
  } else {
    if (cleanBase.includes('/images/')) {
      requestURL = cleanBase.replace(/\/images\/(generations|edits|variations)$/, targetPath);
    } else if (!cleanBase.includes('/v1') && !cleanBase.includes('/v1/')) {
      requestURL = `${cleanBase}/v1${targetPath}`;
    } else {
      requestURL = `${cleanBase}${targetPath}`;
    }
  }

  const chosenModel = model || genSettings.value.model || currentConfig.model || 'gpt-image-2.5-flare';
  const chosenSize = size || `${genSettings.value.width}x${genSettings.value.height}`;

  let response;
  if (currentConfig.useProxy) {
    // 经由反代 (透传多图数组 imagesB64)
    response = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseURL: currentConfig.baseURL,
        apiKey: currentConfig.apiKey,
        model: chosenModel,
        prompt: prompt,
        size: chosenSize,
        quality: genSettings.value.quality,
        output_format: genSettings.value.outputFormat,
        output_compression: genSettings.value.outputCompression,
        imageB64: imagesList[0] || undefined,
        imagesB64: imagesList.length > 0 ? imagesList : undefined
      })
    });
  } else {
    // 客户端直连
    if (isEditMode) {
      const formData = new FormData();
      // 多张图使用 image[] 数组键名，单图使用兼容的 image 键名
      const fieldName = imagesList.length > 1 ? 'image[]' : 'image';

      for (let i = 0; i < imagesList.length; i++) {
        const blobRes = await fetch(imagesList[i]);
        const blob = await blobRes.blob();
        formData.append(fieldName, blob, `image_${i + 1}.png`);
      }

      formData.append('prompt', prompt);
      formData.append('model', chosenModel);
      formData.append('size', chosenSize);
      if (genSettings.value.quality) formData.append('quality', genSettings.value.quality);
      if (genSettings.value.outputFormat) formData.append('output_format', genSettings.value.outputFormat);

      response = await fetch(requestURL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${currentConfig.apiKey}` },
        body: formData
      });
    } else {
      response = await fetch(requestURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentConfig.apiKey}`
        },
        body: JSON.stringify({
          model: chosenModel,
          prompt: prompt,
          n: 1,
          size: chosenSize,
          quality: genSettings.value.quality,
          ...(genSettings.value.outputFormat ? { output_format: genSettings.value.outputFormat } : {})
        })
      });
    }
  }

  let data = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  }

  if (!response.ok) {
    let errMsg = `服务商接口返回错误 (HTTP ${response.status})`;
    if (data && data.error && data.error.message) {
      errMsg = `${errMsg}: ${data.error.message}`;
    } else if (response.status === 404) {
      errMsg = `${errMsg}。可能原因：1. 当前中转服务商未支持模型名称 [${chosenModel}]，请切换为 gpt-image-2 或 dall-e-3；2. Base URL 地址有误。`;
    }
    throw new Error(errMsg);
  }

  if (!data || !data.data || data.data.length === 0 || (!data.data[0].url && !data.data[0].b64_json)) {
    throw new Error('服务商未返回图片数据');
  }

  const imageUrl = data.data[0].url || `data:image/png;base64,${data.data[0].b64_json}`;
  return { imageUrl, chosenModel, chosenSize };
};

// 处理来自灵感画布的工作流生成 (支持单图或多图融合工作流)
const handleCanvasGenerate = async ({ prompt, model, ratio, refImage, refImages, parentId, parentIds }) => {
  if (!isApiConfigured.value) {
    showToastMsg({ message: '请先在右上角配置有效的 API 方案！', type: 'error' });
    isSettingsOpen.value = true;
    return;
  }

  const images = (Array.isArray(refImages) && refImages.length > 0) ? refImages : (refImage ? [refImage] : []);
  const parents = (Array.isArray(parentIds) && parentIds.length > 0) ? parentIds : (parentId ? [parentId] : []);

  isGenerating.value = true;
  const toastText = images.length > 1 
    ? `多图融合任务提交 (${images.length}张参考图)，正在渲染...` 
    : '画布渲染任务已提交，正在生成...';
  showToastMsg({ message: toastText, type: 'info' });

  let finalPrompt = prompt;
  if (genSettings.value.skillsPrompt && genSettings.value.skillsPrompt.trim()) {
    finalPrompt = `${genSettings.value.skillsPrompt.trim()}\n${prompt}`;
  } else if (usePersonalPrompt.value && personalPrompt.value.trim()) {
    finalPrompt = `${personalPrompt.value.trim()}\n${prompt}`;
  }

  try {
    const { imageUrl, chosenModel, chosenSize } = await executeApiCall({
      prompt: finalPrompt,
      model: model || genSettings.value.model,
      size: `${genSettings.value.width}x${genSettings.value.height}`,
      refImagesB64: images
    });

    const recordId = Date.now();
    const newRecord = {
      id: recordId,
      url: imageUrl,
      prompt: finalPrompt,
      width: genSettings.value.width,
      height: genSettings.value.height,
      model: chosenModel,
      ratio: ratio || '1:1',
      timestamp: recordId,
      parentId: parents[0] || null,
      parentIds: parents,
      refImageCount: images.length
    };

    // 写入 IndexedDB (彻底解决 quota 异常)
    await saveHistoryRecord(newRecord);
    historyList.value.unshift(newRecord);

    // 将新图片节点推送到无限画布中，自动建立多父级连线
    if (canvasRef.value) {
      canvasRef.value.addGeneratedImageToCanvas(newRecord, parents);
    }

    // 后台缓存 Blob
    cacheImage(recordId, imageUrl).catch(() => {});

    const successMsg = images.length > 1 
      ? `多图融合绘制完成！汇聚衍生画面已锚定。` 
      : '灵感画布渲染完成！新画面已锚定。';
    showToastMsg({ message: successMsg, type: 'success' });
  } catch (err) {
    console.error('Canvas generate error:', err);
    showToastMsg({ message: `生成失败: ${err.message}`, type: 'error' });
  } finally {
    isGenerating.value = false;
  }
};

// 处理来自底部常规输入的生成
const generateFromBottomInput = async (promptText) => {
  if (!isApiConfigured.value) {
    showToastMsg({ message: '请先配置 API Key！', type: 'error' });
    isSettingsOpen.value = true;
    return;
  }

  isGenerating.value = true;
  showToastMsg({ message: '正在渲染新画面...', type: 'info' });

  let finalPrompt = promptText;
  if (usePersonalPrompt.value && personalPrompt.value.trim()) {
    finalPrompt = `${personalPrompt.value.trim()}\n${promptText}`;
  }

  try {
    const { imageUrl, chosenModel } = await executeApiCall({
      prompt: finalPrompt,
      model: genSettings.value.model,
      refImageB64: uploadedImageB64.value || null
    });

    if (promptInputRef.value) {
      promptInputRef.value.clearUploadedImage();
    }
    uploadedImageB64.value = '';

    const recordId = Date.now();
    const newRecord = {
      id: recordId,
      url: imageUrl,
      prompt: finalPrompt,
      width: genSettings.value.width,
      height: genSettings.value.height,
      model: chosenModel,
      ratio: genSettings.value.ratio,
      timestamp: recordId
    };

    // 存储至 IndexedDB
    await saveHistoryRecord(newRecord);
    historyList.value.unshift(newRecord);

    // 同步给画布
    if (canvasRef.value) {
      canvasRef.value.addGeneratedImageToCanvas(newRecord);
    }

    cacheImage(recordId, imageUrl).catch(() => {});
    showToastMsg({ message: '绘制大功告成！画面已保存至画廊。', type: 'success' });
  } catch (err) {
    console.error('Bottom input generate error:', err);
    showToastMsg({ message: `生成失败: ${err.message}`, type: 'error' });
  } finally {
    isGenerating.value = false;
  }
};

// 从画廊卡片点击“在灵感画布中参考衍生”
const handleSendToCanvas = (item) => {
  currentTab.value = 'canvas';
  if (canvasRef.value) {
    canvasRef.value.loadExternalImageToCanvas(item);
    canvasRef.value.branchFromImage(item);
  }
  showToastMsg({ message: '已载入画布并开启参考衍生分支！', type: 'success' });
};

// 删除单张历史图片
const handleDeleteImage = async (id) => {
  const success = await deleteHistoryRecord(id);
  if (success) {
    historyList.value = historyList.value.filter(item => item.id !== id);
    showToastMsg({ message: '记录已成功删除', type: 'info' });
  }
};

// 清空所有历史画作
const handleClearAllGallery = async () => {
  await clearAllRecords();
  historyList.value = [];
  showToastMsg({ message: '历史画作档案已全部清空', type: 'info' });
};

// 重用提示词
const handleReusePrompt = (promptText) => {
  if (promptInputRef.value) {
    promptInputRef.value.setPrompt(promptText);
  }
  currentTab.value = 'canvas';
  showToastMsg({ message: '提示词已填入！', type: 'info' });
};

// 大图灯箱
const openPreview = (item) => {
  activePreviewItem.value = item;
  isLightboxOpen.value = true;
};

const closePreview = () => {
  isLightboxOpen.value = false;
};
</script>

<style scoped>
.app-wrapper {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: var(--bg-primary);
  color: var(--text-primary);
}

/* 顶部栏 */
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 24px;
  height: 62px;
  z-index: 100;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(12, 14, 22, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.header-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
}

.logo-glow {
  position: absolute;
  width: 28px;
  height: 28px;
  background: var(--primary-gradient);
  filter: blur(12px);
  opacity: 0.6;
  border-radius: 50%;
}

.logo-icon {
  color: #818cf8;
  z-index: 1;
}

.logo-text {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-text h1 {
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  margin: 0;
}

.version-tag {
  font-size: 0.65rem;
  background: linear-gradient(135deg, #6366f1, #a855f7);
  color: #fff;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 700;
}

/* 核心：顶部中央悬浮双页胶囊控制器 */
.nav-segment-control {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 3px;
  border-radius: 30px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}

.nav-tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  border-radius: 24px;
  border: none;
  background: transparent;
  color: #94a3b8;
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.nav-tab-btn:hover {
  color: #f1f5f9;
}

.nav-tab-btn.active {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.9), rgba(168, 85, 247, 0.9));
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 2px 10px rgba(99, 102, 241, 0.4);
}

.tab-icon {
  font-size: 0.95rem;
}

.history-count-badge {
  font-size: 0.68rem;
  padding: 1px 6px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

/* 右上角方案与状态 */
.header-controls {
  display: flex;
  align-items: center;
  gap: 14px;
}

.profile-quick-switch {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 4px 10px;
  border-radius: 8px;
}

.profile-icon {
  color: #818cf8;
}

.profile-select {
  background: transparent;
  border: none;
  color: #cbd5e1;
  font-size: 0.78rem;
  outline: none;
  cursor: pointer;
  max-width: 160px;
}

.profile-select option {
  background: #12141d;
  color: #e2e8f0;
}

.api-status-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.72rem;
  color: #94a3b8;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ef4444;
}

.api-status-badge.configured .status-dot {
  background: #10b981;
  box-shadow: 0 0 6px #10b981;
}

.icon-btn {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

/* 主体区域 */
.app-main {
  display: flex;
  flex: 1;
  height: calc(100vh - 62px);
  overflow: hidden;
  position: relative;
}

.content-viewport {
  flex: 1;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.tab-page {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

/* 画布页面全屏撑满 */
.canvas-page {
  display: flex;
}

/* 画廊页面带底部悬浮输入 */
.gallery-page {
  display: flex;
  flex-direction: column;
}

.gallery-inner-container {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 90px;
}

.gallery-bottom-input {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 820px;
  z-index: 50;
}

/* Toast 提示 */
.toast-notification {
  position: fixed;
  top: 76px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 10px;
  font-size: 0.85rem;
  background: rgba(18, 20, 29, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(12px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

.toast-notification.success {
  border-color: rgba(16, 185, 129, 0.4);
  color: #34d399;
}

.toast-notification.error {
  border-color: rgba(239, 68, 68, 0.4);
  color: #f87171;
}

.toast-notification.info {
  border-color: rgba(99, 102, 241, 0.4);
  color: #818cf8;
}

.toast-notification.warning {
  border-color: rgba(245, 158, 11, 0.4);
  color: #fbbf24;
}

.slide-toast-enter-active,
.slide-toast-leave-active {
  transition: all 0.25s ease;
}

.slide-toast-enter-from,
.slide-toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -15px);
}
</style>
