<template>
  <div class="app-wrapper">
    <!-- 顶部通栏状态栏与导航 (无悬浮胶囊外壳，完全贴顶通栏) -->
    <header class="app-header">
      <!-- 左侧：品牌 Logo -->
      <div class="header-logo">
        <div class="logo-glow"></div>
        <div class="logo-icon-wrapper">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="logo-icon"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
        </div>
        <div class="logo-text">
          <h1 class="brand-title">智能生图工坊</h1>
        </div>
      </div>

      <!-- 中间：沉浸式极简双页导航 (无胶囊底壳，直接纯净选项与滑动指示光) -->
      <nav class="header-nav-tabs">
        <button 
          class="nav-tab-item" 
          :class="{ active: currentTab === 'canvas' }"
          @click="currentTab = 'canvas'"
          title="节点式无限探索画布，支持多图参考融合衍生"
        >
          <span class="nav-tab-indicator" v-if="currentTab === 'canvas'"></span>
          <span class="tab-name">灵感画布</span>
        </button>
        <button 
          class="nav-tab-item" 
          :class="{ active: currentTab === 'gallery' }"
          @click="currentTab = 'gallery'"
          title="浏览已生成的历史画作档案"
        >
          <span class="nav-tab-indicator" v-if="currentTab === 'gallery'"></span>
          <span class="tab-name">成果画廊</span>
          <span v-if="historyList.length > 0" class="history-count-num">{{ historyList.length }}</span>
        </button>
      </nav>

      <!-- 右上角：沉浸式原生功能组 (无外层胶囊岛，纯净幽灵交互 + 悬停微光) -->
      <div class="header-actions">
        <!-- 方案快捷切换 (全新自定义毛玻璃极简浮动菜单，风格完全统一) -->
        <div class="profile-dropdown-wrapper" v-if="apiProfiles.length > 0" ref="profileDropdownRef">
          <button 
            class="header-action-item profile-trigger-btn"
            :class="{ 'open': isProfileMenuOpen }"
            @click.stop="isProfileMenuOpen = !isProfileMenuOpen"
            title="点击切换当前生图方案"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="action-icon profile-icon"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            <span class="active-profile-name">{{ activeProfile?.name || '选择方案' }}</span>
            <svg class="select-chevron" :class="{ 'rotated': isProfileMenuOpen }" xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>

          <!-- 自定义浮动毛玻璃下拉菜单 -->
          <Transition name="dropdown-pop">
            <div v-if="isProfileMenuOpen" class="profile-dropdown-menu glass-panel" @click.stop>
              <div class="dropdown-menu-header">
                <span class="dropdown-menu-title">切换服务商方案</span>
                <span class="profile-count">{{ apiProfiles.length }} 个方案</span>
              </div>
              <div class="profile-options-list">
                <div 
                  v-for="p in apiProfiles" 
                  :key="p.id" 
                  class="profile-option-row"
                  :class="{ 'active': p.id === activeProfileId }"
                  @click="selectProfileFromMenu(p.id)"
                >
                  <div class="option-row-left">
                    <span class="option-indicator" :class="{ 'active': p.id === activeProfileId }"></span>
                    <span class="option-name">{{ p.name }}</span>
                  </div>
                  <span class="option-provider-tag" v-if="p.provider">{{ p.provider }}</span>
                </div>
              </div>
              <div class="dropdown-menu-footer">
                <button class="footer-manage-btn" @click="openSettingsFromDropdown">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06-.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                  <span>管理与添加配置方案</span>
                </button>
              </div>
            </div>
          </Transition>
        </div>

        <!-- API 连接状态 (仅呼吸光点 + 柔和状态字，零边框) -->
        <div 
          class="header-action-item api-status" 
          :class="{ 'configured': isApiConfigured }"
          :title="isApiConfigured ? 'API 连接正常' : 'API 未配置，点击打开配置'"
          @click="!isApiConfigured ? isSettingsOpen = true : null"
        >
          <span class="status-pulse-dot"></span>
          <span class="status-label">{{ isApiConfigured ? '已就绪' : '未配置' }}</span>
        </div>

        <!-- 日间 / 夜间 模式无缝切换 -->
        <button 
          class="header-action-item theme-toggle" 
          @click="toggleTheme" 
          :title="currentTheme === 'dark' ? '切换为雅致日间模式' : '切换为深邃夜间模式'"
        >
          <span class="theme-icon-slot">
            <!-- 太阳图标 (日间) -->
            <svg v-if="currentTheme === 'light'" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="theme-icon sun">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
            <!-- 月亮图标 (夜间) -->
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="theme-icon moon">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          </span>
          <span class="action-text">{{ currentTheme === 'dark' ? '夜间' : '日间' }}</span>
        </button>

        <!-- API 设置弹窗触发入口 -->
        <button class="header-action-item settings-entry" @click="isSettingsOpen = true" title="配置 API 服务商与模型方案">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="settings-gear"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06-.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
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
              @set-as-ref="handleGallerySetAsRef"
              @add-to-canvas="handleGalleryAddToCanvas"
              @batch-set-as-ref="handleGalleryBatchSetAsRef"
              @batch-add-to-canvas="handleGalleryBatchAddToCanvas"
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
import { ref, computed, onMounted, onUnmounted } from 'vue';
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
import { createThumbnail, revokeThumbnail, clearThumbnailCache } from './utils/thumbnail';

// 当前页面标签：'canvas' (灵感画布) | 'gallery' (成果画廊)
const currentTab = ref('canvas');

// 主题状态：'dark' (夜间·星海绀青) | 'light' (日间·晨曦暖白微彩)
const currentTheme = ref('dark');

const applyTheme = () => {
  document.documentElement.setAttribute('data-theme', currentTheme.value);
  localStorage.setItem('app_theme_mode', currentTheme.value);
};

const toggleTheme = () => {
  currentTheme.value = currentTheme.value === 'dark' ? 'light' : 'dark';
  applyTheme();
  showToastMsg({ 
    message: currentTheme.value === 'dark' ? '已切换至深邃夜间模式' : '已切换至温润日间模式', 
    type: 'info' 
  });
};

// API 配置与多方案管理状态
const apiProfiles = ref([]);
const activeProfileId = ref('');
const isProfileMenuOpen = ref(false);
const profileDropdownRef = ref(null);

const activeProfile = computed(() => {
  return apiProfiles.value.find(p => p.id === activeProfileId.value) || null;
});

const isApiConfigured = computed(() => {
  return activeProfile.value?.apiKey?.trim()?.length > 0;
});

// 方案菜单选择
const selectProfileFromMenu = (profileId) => {
  activeProfileId.value = profileId;
  saveProfilesToStorage();
  isProfileMenuOpen.value = false;
  showToastMsg({ message: `已切换至方案：${activeProfile.value?.name}`, type: 'success' });
};

// 从下拉菜单直接打开配置面板
const openSettingsFromDropdown = () => {
  isProfileMenuOpen.value = false;
  isSettingsOpen.value = true;
};

// 全局监听点击外部收起下拉菜单
const handleGlobalClick = (e) => {
  if (isProfileMenuOpen.value && profileDropdownRef.value && !profileDropdownRef.value.contains(e.target)) {
    isProfileMenuOpen.value = false;
  }
};

const uploadedImageB64 = ref('');
const usePersonalPrompt = ref(false);
const personalPrompt = ref('');

// UI 状态
const sidebarVisible = ref(true);
const isSettingsOpen = ref(false);
const isGenerating = ref(false);
const activeTasksCount = ref(0);
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
  // 0. 初始化主题偏好
  const savedTheme = localStorage.getItem('app_theme_mode');
  if (savedTheme === 'light' || savedTheme === 'dark') {
    currentTheme.value = savedTheme;
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    currentTheme.value = 'light';
  } else {
    currentTheme.value = 'dark';
  }
  applyTheme();

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

  // 监听全局点击以关闭方案菜单
  window.addEventListener('click', handleGlobalClick);
});

onUnmounted(() => {
  window.removeEventListener('click', handleGlobalClick);
});

// 解析 IndexedDB 离线缓存与轻量缩略图
const resolveOfflineUrls = async () => {
  for (let i = 0; i < historyList.value.length; i++) {
    const item = historyList.value[i];
    const localUrl = await getCachedImageUrl(item.id, item.url);
    if (localUrl !== item.url) {
      item.url = localUrl;
    }
    // 异步生成/绑定轻量缩略图
    createThumbnail(item.url).then(tUrl => {
      if (tUrl && tUrl !== item.url) {
        item.thumbnailUrl = tUrl;
      }
    }).catch(() => {});
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
  const countParam = Number(genSettings.value.imageCount) > 0 ? Number(genSettings.value.imageCount) : 1;

  // 决定 background 参数 (针对透明背景：当选择 PNG 或 WEBP 时传递 transparent)
  const bgParam = (genSettings.value.transparentBackground && (genSettings.value.outputFormat === 'png' || genSettings.value.outputFormat === 'webp'))
    ? 'transparent'
    : undefined;

  let response;
  if (currentConfig.useProxy) {
    // 经由反代 (透传多图数组 imagesB64 与完整生图特性参数，包含 n)
    response = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseURL: currentConfig.baseURL,
        apiKey: currentConfig.apiKey,
        model: chosenModel,
        prompt: prompt,
        n: countParam,
        size: chosenSize,
        quality: genSettings.value.quality,
        background: bgParam,
        output_format: genSettings.value.outputFormat,
        output_compression: (genSettings.value.outputFormat === 'jpeg' || genSettings.value.outputFormat === 'webp') ? genSettings.value.outputCompression : undefined,
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
      formData.append('n', String(countParam));
      formData.append('size', chosenSize);
      if (genSettings.value.quality) formData.append('quality', genSettings.value.quality);
      if (bgParam) formData.append('background', bgParam);
      if (genSettings.value.outputFormat) formData.append('output_format', genSettings.value.outputFormat);
      if (genSettings.value.outputCompression !== undefined && (genSettings.value.outputFormat === 'jpeg' || genSettings.value.outputFormat === 'webp')) {
        formData.append('output_compression', String(genSettings.value.outputCompression));
      }

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
          n: countParam,
          size: chosenSize,
          quality: genSettings.value.quality,
          ...(bgParam ? { background: bgParam } : {}),
          ...(genSettings.value.outputFormat ? { output_format: genSettings.value.outputFormat } : {}),
          ...((genSettings.value.outputCompression !== undefined && (genSettings.value.outputFormat === 'jpeg' || genSettings.value.outputFormat === 'webp'))
            ? { output_compression: Number(genSettings.value.outputCompression) }
            : {})
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

  if (!data || !data.data || data.data.length === 0) {
    throw new Error('服务商未返回图片数据');
  }

  const imageUrls = (data.data || [])
    .map(item => item.url || (item.b64_json ? `data:image/png;base64,${item.b64_json}` : null))
    .filter(Boolean);

  if (imageUrls.length === 0) {
    throw new Error('服务商返回的数据中未包含有效图片');
  }

  return { imageUrls, imageUrl: imageUrls[0], chosenModel, chosenSize };
};

// 处理来自灵感画布的工作流生成 (支持单图或多图融合工作流，支持多窗口并行生图与多张批量渲染)
const handleCanvasGenerate = async ({ prompt, model, ratio, refImage, refImages, parentId, parentIds, windowId }) => {
  if (!isApiConfigured.value) {
    showToastMsg({ message: '请先在右上角配置有效的 API 方案！', type: 'error' });
    isSettingsOpen.value = true;
    if (canvasRef.value) {
      canvasRef.value.finishWindowGenerate(windowId);
    }
    return;
  }

  const images = (Array.isArray(refImages) && refImages.length > 0) ? refImages : (refImage ? [refImage] : []);
  const parents = (Array.isArray(parentIds) && parentIds.length > 0) ? parentIds : (parentId ? [parentId] : []);

  activeTasksCount.value++;
  isGenerating.value = true;
  const countToGen = Number(genSettings.value.imageCount) > 0 ? Number(genSettings.value.imageCount) : 1;
  const toastText = images.length > 1 
    ? `多图融合任务提交 (${images.length}张参考图，生成${countToGen}张)，正在并行渲染...` 
    : `画布渲染任务已提交 (生成${countToGen}张)，正在并行绘制...`;
  showToastMsg({ message: toastText, type: 'info' });

  let finalPrompt = prompt;
  if (genSettings.value.skillsPrompt && genSettings.value.skillsPrompt.trim()) {
    finalPrompt = `${genSettings.value.skillsPrompt.trim()}\n${prompt}`;
  } else if (usePersonalPrompt.value && personalPrompt.value.trim()) {
    finalPrompt = `${personalPrompt.value.trim()}\n${prompt}`;
  }

  try {
    const { imageUrls, chosenModel } = await executeApiCall({
      prompt: finalPrompt,
      model: model || genSettings.value.model,
      size: `${genSettings.value.width}x${genSettings.value.height}`,
      refImagesB64: images
    });

    const baseTimestamp = Date.now();
    for (let i = 0; i < imageUrls.length; i++) {
      const imgUrl = imageUrls[i];
      const recordId = baseTimestamp + i;
      const thumbUrl = await createThumbnail(imgUrl).catch(() => null);
      const newRecord = {
        id: recordId,
        url: imgUrl,
        thumbnailUrl: thumbUrl || null,
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

      // 写入 IndexedDB (解决存储容量瓶颈)
      await saveHistoryRecord(newRecord);
      historyList.value.unshift(newRecord);

      // 将新图片节点推送到无限画布中，自动建立多父级连线并根据触发窗口智能定位
      if (canvasRef.value) {
        canvasRef.value.addGeneratedImageToCanvas(newRecord, parents, i, windowId);
      }

      // 后台缓存 Blob (若处于纯网络云端模式，db.js 自动跳过持久缓存)
      cacheImage(recordId, imgUrl).catch(() => {});
    }

    const successMsg = imageUrls.length > 1 
      ? `已成功生成 ${imageUrls.length} 张画面！已全部归档并锚定至画布。` 
      : (images.length > 1 ? '多图融合绘制完成！汇聚衍生画面已锚定。' : '灵感画布渲染完成！新画面已锚定。');
    showToastMsg({ message: successMsg, type: 'success' });
  } catch (err) {
    console.error('Canvas generate error:', err);
    showToastMsg({ message: `生成失败: ${err.message}`, type: 'error' });
  } finally {
    if (canvasRef.value) {
      canvasRef.value.finishWindowGenerate(windowId);
    }
    activeTasksCount.value = Math.max(0, activeTasksCount.value - 1);
    isGenerating.value = activeTasksCount.value > 0;
  }
};

// 处理来自底部常规输入的生成 (支持多张批量生成)
const generateFromBottomInput = async (promptText) => {
  if (!isApiConfigured.value) {
    showToastMsg({ message: '请先配置 API Key！', type: 'error' });
    isSettingsOpen.value = true;
    return;
  }

  isGenerating.value = true;
  const countToGen = Number(genSettings.value.imageCount) > 0 ? Number(genSettings.value.imageCount) : 1;
  showToastMsg({ message: `正在渲染新画面 (生成 ${countToGen} 张)...`, type: 'info' });

  let finalPrompt = promptText;
  if (usePersonalPrompt.value && personalPrompt.value.trim()) {
    finalPrompt = `${personalPrompt.value.trim()}\n${promptText}`;
  }

  try {
    const { imageUrls, chosenModel } = await executeApiCall({
      prompt: finalPrompt,
      model: genSettings.value.model,
      refImageB64: uploadedImageB64.value || null
    });

    if (promptInputRef.value) {
      promptInputRef.value.clearUploadedImage();
    }
    uploadedImageB64.value = '';

    const baseTimestamp = Date.now();
    for (let i = 0; i < imageUrls.length; i++) {
      const imgUrl = imageUrls[i];
      const recordId = baseTimestamp + i;
      const thumbUrl = await createThumbnail(imgUrl).catch(() => null);
      const newRecord = {
        id: recordId,
        url: imgUrl,
        thumbnailUrl: thumbUrl || null,
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
        canvasRef.value.addGeneratedImageToCanvas(newRecord, null, i);
      }

      cacheImage(recordId, imgUrl).catch(() => {});
    }

    const successMsg = imageUrls.length > 1
      ? `绘制完成！共生成 ${imageUrls.length} 张图片，已保存至画廊。`
      : '绘制大功告成！画面已保存至画廊。';
    showToastMsg({ message: successMsg, type: 'success' });
  } catch (err) {
    console.error('Bottom input generate error:', err);
    showToastMsg({ message: `生成失败: ${err.message}`, type: 'error' });
  } finally {
    isGenerating.value = false;
  }
};

// 从画廊卡片点击“在灵感画布中参考衍生” (保留兼容)
const handleSendToCanvas = (item) => {
  currentTab.value = 'canvas';
  if (canvasRef.value) {
    canvasRef.value.loadExternalImageToCanvas(item);
    canvasRef.value.branchFromImage(item);
  }
  showToastMsg({ message: '已载入画布并开启参考衍生分支！', type: 'success' });
};

// 画廊新功能：点击“设为参考图”，不跳转画布，可多张点击连续设为参考
const handleGallerySetAsRef = (item) => {
  if (canvasRef.value) {
    const res = canvasRef.value.addGalleryItemAsReference(item);
    if (res.added) {
      showToastMsg({ message: `已加入画布并设为 [Image ${res.index}] 参考图`, type: 'success' });
    } else {
      showToastMsg({ message: res.message || '已处理参考图', type: 'info' });
    }
  }
};

// 画廊新功能：点击“加入到画布”，不跳转画布，仅加入画布独立图片卡片
const handleGalleryAddToCanvas = (item) => {
  if (canvasRef.value) {
    const res = canvasRef.value.addGalleryItemToCanvas(item);
    if (res.alreadyExists) {
      showToastMsg({ message: '该图片已在画布中存在', type: 'info' });
    } else {
      showToastMsg({ message: '已成功添加至画布', type: 'success' });
    }
  }
};

// 画廊多选批量设为参考图
const handleGalleryBatchSetAsRef = (items) => {
  if (canvasRef.value) {
    const count = canvasRef.value.batchAddGalleryItemsAsReference(items);
    showToastMsg({ message: `已成功将 ${count} 张图片设为参考图！`, type: 'success' });
  }
};

// 画廊多选批量加入画布
const handleGalleryBatchAddToCanvas = (items) => {
  if (canvasRef.value) {
    const count = canvasRef.value.batchAddGalleryItemsToCanvas(items);
    showToastMsg({ message: `已成功将 ${count} 张图片添加至画布！`, type: 'success' });
  }
};

// 删除单张历史图片
const handleDeleteImage = async (id) => {
  const targetItem = historyList.value.find(item => item.id === id);
  if (targetItem?.url) {
    revokeThumbnail(targetItem.url);
  }
  const success = await deleteHistoryRecord(id);
  if (success) {
    historyList.value = historyList.value.filter(item => item.id !== id);
    showToastMsg({ message: '记录已成功删除', type: 'info' });
  }
};

// 清空所有历史画作
const handleClearAllGallery = async () => {
  clearThumbnailCache();
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
  background-color: transparent;
  color: var(--text-primary);
  transition: var(--transition-theme);
}

/* 顶部通栏 - 完全贴顶、无悬浮外围大胶囊、纯粹一体通栏 */
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  height: 54px;
  z-index: 100;
  border-radius: 0 !important;
  border: none;
  border-bottom: 1px solid var(--border-divider);
  background: var(--header-bg);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.03);
  transition: var(--transition-theme);
}

.header-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
  user-select: none;
}

.logo-glow {
  position: absolute;
  left: 0;
  width: 28px;
  height: 28px;
  background: var(--primary-gradient);
  filter: blur(12px);
  opacity: 0.45;
  border-radius: 50%;
}

.logo-icon-wrapper {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--primary-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  box-shadow: 0 3px 12px var(--accent-glow);
  z-index: 1;
  transition: transform 0.25s ease;
}

.logo-icon-wrapper:hover {
  transform: rotate(4deg) scale(1.05);
}

.logo-text {
  display: flex;
  align-items: center;
}

.brand-title {
  font-size: 0.98rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0;
  color: var(--text-primary);
}

/* 核心：中央双页导航 (彻底去除胶囊底壳！纯净文本 + 滑动光感指示器) */
.header-nav-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  position: relative;
}

.nav-tab-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.84rem;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition-smooth);
}

.nav-tab-item:hover {
  color: var(--text-primary);
  background: var(--bg-subtle-hover);
}

.nav-tab-item.active {
  color: var(--text-primary);
  font-weight: 600;
  background: var(--bg-subtle);
}

.nav-tab-indicator {
  position: absolute;
  bottom: -9px;
  left: 10px;
  right: 10px;
  height: 2px;
  background: var(--primary-gradient);
  box-shadow: 0 0 10px var(--accent-glow);
  border-radius: 2px;
}

.history-count-num {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--accent-indigo);
  opacity: 0.85;
  margin-left: 1px;
}

/* 核心：右上角原生交互组 (彻底去除胶囊岛框！幽灵交互 + 悬停微光聚光灯) */
.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.header-action-item {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  border-radius: 6px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition-smooth);
}

.header-action-item:hover {
  background: var(--bg-subtle-hover);
  color: var(--text-primary);
}

/* 方案快速选择：极简浮动毛玻璃 (Floating Glassmorphism - 彻底告别系统方框与刺眼白底) */
.profile-dropdown-wrapper {
  position: relative;
  user-select: none;
}

.profile-trigger-btn {
  appearance: none !important;
  -webkit-appearance: none !important;
  outline: none !important;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  border-radius: 6px;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition-smooth);
}

:root[data-theme="light"] .profile-trigger-btn {
  background: transparent !important;
  border: none !important;
}

.profile-trigger-btn:hover {
  background: var(--bg-subtle-hover) !important;
  border: none !important;
  color: var(--text-primary);
  box-shadow: none !important;
}

:root[data-theme="light"] .profile-trigger-btn:hover {
  background: var(--bg-subtle-hover) !important;
  border: none !important;
}

.profile-trigger-btn.open {
  background: var(--bg-subtle-hover) !important;
  border: none !important;
  color: var(--primary-color) !important;
  box-shadow: none !important;
}

.action-icon.profile-icon {
  color: var(--accent-purple);
  filter: drop-shadow(0 0 4px var(--accent-purple));
  flex-shrink: 0;
}

.active-profile-name {
  max-width: 130px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.01em;
}

.select-chevron {
  color: var(--text-muted);
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  margin-left: 2px;
}

.select-chevron.rotated {
  transform: rotate(180deg);
  color: var(--primary-color);
}

/* 浮动毛玻璃下拉菜单面板 (极简无框纯净浮动岛) */
.profile-dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 250px;
  padding: 8px;
  border-radius: 12px;
  background: var(--bg-surface-elevated, #161822);
  backdrop-filter: blur(28px);
  -webkit-backdrop-filter: blur(28px);
  border: none !important;
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.45);
  z-index: 1000;
  transform-origin: top right;
}

.dropdown-menu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px 8px 8px;
  border-bottom: none !important;
  margin-bottom: 6px;
}

.dropdown-menu-title {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-secondary);
  letter-spacing: 0.3px;
}

.profile-count {
  font-size: 0.65rem;
  color: var(--text-muted);
  background: var(--bg-subtle);
  padding: 1px 6px;
  border-radius: var(--radius-micro);
}

.profile-options-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 220px;
  overflow-y: auto;
}

.profile-option-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px;
  border-radius: var(--radius-xs);
  cursor: pointer;
  transition: var(--transition-smooth);
}

.profile-option-row:hover {
  background: var(--bg-subtle-hover);
}

.profile-option-row.active {
  background: var(--primary-gradient-subtle);
  color: var(--primary-color);
  font-weight: 600;
}

.option-row-left {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.option-indicator {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: transparent;
  flex-shrink: 0;
  transition: var(--transition-fast);
}

.option-indicator.active {
  background: var(--primary-color);
  box-shadow: 0 0 8px var(--accent-glow);
}

.option-name {
  font-size: 0.78rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.option-provider-tag {
  font-size: 0.65rem;
  color: var(--text-muted);
  padding: 1px 6px;
  border-radius: var(--radius-micro);
  background: var(--bg-subtle);
  flex-shrink: 0;
}

.dropdown-menu-footer {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--border-color);
}

.footer-manage-btn {
  appearance: none !important;
  -webkit-appearance: none !important;
  outline: none !important;
  border: 1px solid transparent !important;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: var(--radius-xs);
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-subtle);
  cursor: pointer;
  transition: var(--transition-smooth);
}

.footer-manage-btn:hover {
  background: var(--primary-gradient-subtle) !important;
  color: var(--primary-color) !important;
}

/* 下拉菜单平滑弹出动画 (柔和缩放与微平移) */
.dropdown-pop-enter-active,
.dropdown-pop-leave-active {
  transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.dropdown-pop-enter-from,
.dropdown-pop-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.96);
}

/* API 状态指示 (极简呼吸微光，零边框) */
.api-status {
  user-select: none;
}

.status-pulse-dot {
  width: 6.5px;
  height: 6.5px;
  border-radius: 50%;
  background: var(--color-error);
  box-shadow: 0 0 6px rgba(244, 63, 94, 0.45);
  transition: var(--transition-smooth);
}

.api-status.configured .status-pulse-dot {
  background: var(--color-success);
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
}

.status-label {
  font-size: 0.75rem;
  font-weight: 500;
}

.api-status.configured .status-label {
  color: var(--text-primary);
}

/* 主题模式切换 */
.theme-toggle {
  font-weight: 500;
}

.theme-icon-slot {
  display: flex;
  align-items: center;
  justify-content: center;
}

.theme-icon.sun {
  color: #f59e0b;
  filter: drop-shadow(0 0 4px rgba(245, 158, 11, 0.4));
}

.theme-icon.moon {
  color: #818cf8;
  filter: drop-shadow(0 0 4px rgba(129, 140, 248, 0.4));
}

.action-text {
  font-size: 0.75rem;
}

/* 设置入口 */
.settings-entry {
  padding: 0 8px;
  justify-content: center;
}

.settings-entry:hover .settings-gear {
  transform: rotate(45deg);
  color: var(--primary-color);
}

.settings-gear {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), color 0.2s ease;
}

/* 主体区域 */
.app-main {
  display: flex;
  flex: 1;
  height: calc(100vh - 64px);
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
  height: 100%;
  overflow: hidden;
  padding-bottom: 0;
}

/* Toast 提示 */
.toast-notification {
  position: fixed;
  top: 76px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px;
  border-radius: var(--radius-pill);
  font-size: 0.86rem;
  font-weight: 500;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  box-shadow: var(--shadow-lg);
  color: var(--text-primary);
  z-index: 2500;
  transition: var(--transition-theme);
}

.toast-notification.success {
  border-color: rgba(16, 185, 129, 0.4);
  color: var(--color-success);
}

.toast-notification.error {
  border-color: rgba(239, 68, 68, 0.4);
  color: var(--color-error);
}

.toast-notification.info {
  border-color: rgba(99, 102, 241, 0.4);
  color: var(--accent-indigo);
}

.toast-notification.warning {
  border-color: rgba(245, 158, 11, 0.4);
  color: var(--color-warning);
}

.slide-toast-enter-active,
.slide-toast-leave-active {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-toast-enter-from,
.slide-toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -16px) scale(0.95);
}
</style>
