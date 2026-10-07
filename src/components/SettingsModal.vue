<template>
  <Transition name="fade">
    <div v-if="isOpen" class="modal-overlay" @click.self="close">
      <div class="modal-content glass-panel">
        <!-- 头部导航与标题 -->
        <div class="modal-header">
          <div class="header-title-box">
            <div class="header-icon-badge">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </div>
            <div>
              <h3>API 服务商与方案管理</h3>
              <p class="header-subtitle">支持按第三方服务商归类分组，灵活匹配多分辨率与计费方案</p>
            </div>
          </div>
          <button class="close-btn" @click="close" title="关闭设置">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        
        <!-- 主体：分栏自适应布局 -->
        <div class="modal-layout" v-if="tempProfiles.length > 0">
          <!-- 左栏：方案树与分组列表 (支持无限平滑滚动与折叠) -->
          <div class="profiles-sidebar">
            <div class="sidebar-search">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="search-icon"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input 
                v-model="searchQuery" 
                type="text" 
                placeholder="搜索服务商或方案..." 
                class="search-input"
              />
              <button v-if="searchQuery" class="clear-search-btn" @click="searchQuery = ''">×</button>
            </div>

            <!-- 分组折叠树容器 (自适应撑满高度，超出平滑滚动) -->
            <div class="grouped-profiles-list">
              <div 
                v-for="group in filteredGroups" 
                :key="group.provider" 
                class="provider-group"
              >
                <!-- 分组标题行 -->
                <div 
                  class="group-header" 
                  @click="toggleGroup(group.provider)"
                >
                  <div class="group-header-left">
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="12" 
                      height="12" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      stroke-width="2.5" 
                      stroke-linecap="round" 
                      stroke-linejoin="round"
                      class="collapse-arrow"
                      :class="{ 'expanded': !collapsedGroups[group.provider] }"
                    >
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                    <span class="provider-title" :title="group.provider">{{ group.provider }}</span>
                  </div>
                  <div class="group-header-right">
                    <span class="group-count-badge">{{ group.items.length }}</span>
                    <button 
                      class="mini-add-btn" 
                      @click.stop="addProfileToGroup(group.provider)" 
                      title="在此服务商下添加新配置"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button>
                  </div>
                </div>

                <!-- 分组内的子方案项 (展开列表，支持超量平滑滚动) -->
                <div 
                  v-show="!collapsedGroups[group.provider]" 
                  class="group-children"
                >
                  <div 
                    v-for="profile in group.items" 
                    :key="profile.id"
                    class="profile-item"
                    :class="{ 'active': selectedProfileId === profile.id }"
                    @click="selectedProfileId = profile.id"
                  >
                    <div class="profile-item-indicator" v-if="selectedProfileId === profile.id"></div>
                    <div class="profile-item-info">
                      <span class="profile-item-name" :title="profile.name">{{ profile.name }}</span>
                    </div>

                    <div class="item-actions">
                      <!-- 快速克隆 -->
                      <button 
                        class="profile-action-btn clone-btn"
                        @click.stop="duplicateProfile(profile.id)"
                        title="复制此方案"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                      </button>
                      <!-- 删除 -->
                      <button 
                        v-if="tempProfiles.length > 1" 
                        class="profile-action-btn delete-btn"
                        @click.stop="deleteProfile(profile.id)"
                        title="删除方案"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 底部新增独立方案按钮 -->
            <button class="add-profile-btn" @click="addNewEmptyProfile">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>新增独立方案/服务商</span>
            </button>
          </div>

          <!-- 右栏：方案表单详情 (纯平流式排版，彻底消灭层层卡片边框嵌套) -->
          <div class="profile-form" v-if="currentProfile">
            <div class="profile-status-bar">
              <span class="status-indicator-dot"></span>
              <span class="status-tip">正在配置方案：</span>
              <span class="status-name">{{ currentProfile.name || '未命名' }}</span>
              <span class="status-provider">· {{ currentProfile.provider || '默认服务商' }}</span>
            </div>

            <!-- 模块 1：基础身份属性 -->
            <div class="form-section-block">
              <h4 class="section-title">基础方案信息</h4>
              <div class="form-row-two">
                <div class="form-group">
                  <label for="providerName">服务商 / 分组名称</label>
                  <input 
                    id="providerName" 
                    type="text" 
                    v-model="currentProfile.provider" 
                    placeholder="例如: OpenAI、ZECTAI、Midjourney等" 
                    class="form-input"
                  />
                  <span class="input-desc">同名服务商将自动归入左侧同一分组</span>
                </div>

                <div class="form-group">
                  <label for="profileName">方案标签 / 名称</label>
                  <input 
                    id="profileName" 
                    type="text" 
                    v-model="currentProfile.name" 
                    placeholder="例如: 标准1K、4K超清极速等" 
                    class="form-input"
                  />
                  <span class="input-desc">用于在右上角快捷菜单中识别出图规格</span>
                </div>
              </div>
            </div>

            <!-- 模块 2：网络接口设置 -->
            <div class="form-section-block">
              <h4 class="section-title">接口连接凭证</h4>
              <!-- Base URL -->
              <div class="form-group">
                <div class="label-with-action">
                  <label for="baseURL">API 基础路径 (Base URL)</label>
                  <button 
                    v-if="canAppendV1" 
                    class="quick-v1-link" 
                    type="button" 
                    @click="autoAppendV1"
                  >
                    ⚡ 补全 /v1
                  </button>
                </div>
                <div class="input-wrapper-with-suffix">
                  <input 
                    id="baseURL" 
                    type="text" 
                    v-model="currentProfile.baseURL" 
                    @blur="handleBaseURLBlur"
                    placeholder="https://api.openai.com/v1" 
                    class="form-input"
                  />
                </div>
                <span class="input-desc">
                  第三方中转 API 通常以 /v1 结尾（输入后点击右上角可一键自动补齐）
                </span>
              </div>

              <!-- API Key -->
              <div class="form-group">
                <label for="apiKey">API 密钥 (API Key)</label>
                <div class="password-wrapper">
                  <input 
                    id="apiKey" 
                    :type="showKey ? 'text' : 'password'" 
                    v-model="currentProfile.apiKey" 
                    placeholder="sk-..." 
                    class="form-input password-input"
                  />
                  <button class="toggle-password" type="button" @click="showKey = !showKey" :title="showKey ? '隐藏密钥' : '显示密钥'">
                    <svg v-if="showKey" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  </button>
                </div>
                <span class="input-desc">密钥仅安全留存在您的浏览器本地，绝不上报第三方。</span>
              </div>
            </div>

            <!-- 模块 3：服务端代理开关 (极简无框条目行) -->
            <div class="form-section-block">
              <h4 class="section-title">网络高级设置</h4>
              <div 
                class="proxy-toggle-row"
                :class="{ 'active': currentProfile.useProxy }"
                @click="currentProfile.useProxy = !currentProfile.useProxy"
              >
                <div class="proxy-info-col">
                  <div class="proxy-title-row">
                    <span class="proxy-icon">🛡️</span>
                    <span class="proxy-title">通过 Vercel 服务端代理请求</span>
                    <span class="proxy-tag" :class="currentProfile.useProxy ? 'enabled' : 'disabled'">
                      {{ currentProfile.useProxy ? '推荐开启' : '客户端直连' }}
                    </span>
                  </div>
                  <span class="proxy-desc">
                    有效规避浏览器调用第三方 API 时的 CORS 跨域限制，保障多图融合流畅稳定。
                  </span>
                </div>
                <div class="glass-switch" :class="{ 'checked': currentProfile.useProxy }">
                  <div class="switch-handle"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部操作按钮 -->
        <div class="modal-footer">
          <div class="footer-left-hint">
            <span class="hint-icon">🔒</span>
            <span>设置自动实时同步，保存后立即应用于生图工作流</span>
          </div>
          <div class="footer-right-btns">
            <button class="btn btn-secondary" @click="close">取消</button>
            <button class="btn btn-primary" @click="save">保存并应用方案</button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  isOpen: Boolean,
  profiles: Array,
  activeProfileId: String
});

const emit = defineEmits(['close', 'save']);

const tempProfiles = ref([]);
const selectedProfileId = ref('');
const showKey = ref(false);
const searchQuery = ref('');
const collapsedGroups = ref({});

// 当前选中的修改方案
const currentProfile = computed(() => {
  return tempProfiles.value.find(p => p.id === selectedProfileId.value);
});

// 从名称或域名中提取供应商名称作为智能分组依据
const extractProvider = (item) => {
  if (item.provider && item.provider.trim()) {
    return item.provider.trim();
  }
  const rawName = (item.name || '').trim();
  const spaceParts = rawName.split(/[\s/_]/);
  if (spaceParts.length > 1 && spaceParts[0].length >= 2) {
    return spaceParts[0];
  }
  if (item.baseURL) {
    try {
      const url = new URL(item.baseURL.startsWith('http') ? item.baseURL : `https://${item.baseURL}`);
      const hostParts = url.hostname.split('.');
      if (hostParts.length >= 2) {
        return hostParts[hostParts.length - 2].toUpperCase();
      }
    } catch (e) {}
  }
  return '默认服务商';
};

// 分组计算属性
const groupedProfiles = computed(() => {
  const map = {};
  tempProfiles.value.forEach(p => {
    const prov = p.provider?.trim() || extractProvider(p);
    if (!map[prov]) {
      map[prov] = [];
    }
    map[prov].push(p);
  });

  return Object.keys(map).map(prov => ({
    provider: prov,
    items: map[prov]
  }));
});

// 搜索过滤后的分组
const filteredGroups = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return groupedProfiles.value;

  return groupedProfiles.value
    .map(g => {
      const matchedItems = g.items.filter(item => 
        (item.name || '').toLowerCase().includes(q) ||
        (item.provider || '').toLowerCase().includes(q) ||
        (item.baseURL || '').toLowerCase().includes(q)
      );
      return {
        provider: g.provider,
        items: matchedItems
      };
    })
    .filter(g => g.items.length > 0);
});

// 折叠/展开分组
const toggleGroup = (provider) => {
  collapsedGroups.value[provider] = !collapsedGroups.value[provider];
};

// 检查当前 Base URL 是否可以自动补全 /v1
const canAppendV1 = computed(() => {
  if (!currentProfile.value || !currentProfile.value.baseURL) return false;
  const url = currentProfile.value.baseURL.trim();
  if (!url) return false;
  const clean = url.replace(/\/+$/, '');
  return !clean.endsWith('/v1') && !clean.endsWith('/v1/') && !clean.includes('/images/');
});

// 自动补全 /v1 方法
const autoAppendV1 = () => {
  if (!currentProfile.value || !currentProfile.value.baseURL) return;
  const url = currentProfile.value.baseURL.trim();
  if (!url) return;
  const clean = url.replace(/\/+$/, '');
  if (!clean.endsWith('/v1')) {
    currentProfile.value.baseURL = `${clean}/v1`;
  }
};

// Base URL 失焦时自动补全 /v1
const handleBaseURLBlur = () => {
  if (canAppendV1.value) {
    autoAppendV1();
  }
};

// 监听打开状态
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    showKey.value = false;
    searchQuery.value = '';
    collapsedGroups.value = {};
    if (props.profiles && props.profiles.length > 0) {
      tempProfiles.value = JSON.parse(JSON.stringify(props.profiles)).map(item => {
        if (!item.provider) {
          item.provider = extractProvider(item);
        }
        return item;
      });
      selectedProfileId.value = props.activeProfileId || props.profiles[0].id;
    } else {
      tempProfiles.value = [{
        id: 'default',
        provider: '官方 OpenAI',
        name: '标准官方方案',
        baseURL: 'https://api.openai.com/v1',
        apiKey: '',
        model: 'gpt-image-2.5-flare',
        useProxy: true
      }];
      selectedProfileId.value = 'default';
    }
  }
});

// 新增空白方案
const addNewEmptyProfile = () => {
  const newId = Date.now().toString();
  const nextNum = tempProfiles.value.length + 1;
  const newProfile = {
    id: newId,
    provider: '新服务商',
    name: `方案 ${nextNum}`,
    baseURL: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-image-2.5-flare',
    useProxy: true
  };
  tempProfiles.value.push(newProfile);
  selectedProfileId.value = newId;
};

// 在指定分组下新增方案
const addProfileToGroup = (provider) => {
  const newId = Date.now().toString();
  const sibling = tempProfiles.value.find(p => (p.provider || extractProvider(p)) === provider);
  const newProfile = {
    id: newId,
    provider: provider,
    name: `${provider} 方案 ${tempProfiles.value.filter(p => (p.provider || extractProvider(p)) === provider).length + 1}`,
    baseURL: sibling ? sibling.baseURL : 'https://api.openai.com/v1',
    apiKey: sibling ? sibling.apiKey : '',
    model: sibling?.model || 'gpt-image-2.5-flare',
    useProxy: sibling ? sibling.useProxy : true
  };
  tempProfiles.value.push(newProfile);
  selectedProfileId.value = newId;
  collapsedGroups.value[provider] = false;
};

// 克隆方案
const duplicateProfile = (id) => {
  const target = tempProfiles.value.find(p => p.id === id);
  if (!target) return;
  const newId = Date.now().toString();
  const cloned = {
    ...JSON.parse(JSON.stringify(target)),
    id: newId,
    name: `${target.name} (副本)`
  };
  tempProfiles.value.push(cloned);
  selectedProfileId.value = newId;
};

// 删除方案
const deleteProfile = (id) => {
  if (tempProfiles.value.length <= 1) return;
  const index = tempProfiles.value.findIndex(p => p.id === id);
  if (index !== -1) {
    tempProfiles.value.splice(index, 1);
    if (selectedProfileId.value === id) {
      selectedProfileId.value = tempProfiles.value[0].id;
    }
  }
};

const close = () => {
  emit('close');
};

const save = () => {
  tempProfiles.value.forEach(p => {
    p.provider = (p.provider || '默认服务商').trim();
    p.name = (p.name || '未命名方案').trim();
    p.baseURL = (p.baseURL || '').trim();
    if (p.baseURL && !p.baseURL.endsWith('/v1') && !p.baseURL.includes('/images/')) {
      p.baseURL = p.baseURL.replace(/\/+$/, '') + '/v1';
    }
    p.apiKey = (p.apiKey || '').trim();
    p.model = (p.model || 'gpt-image-2.5-flare').trim();
  });

  emit('save', {
    profiles: tempProfiles.value,
    activeProfileId: selectedProfileId.value
  });
  close();
};
</script>

<style scoped>
/* 弹窗打开/关闭平滑柔和动效 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-enter-active .modal-content,
.fade-leave-active .modal-content {
  transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-from .modal-content,
.fade-leave-to .modal-content {
  opacity: 0;
  transform: scale(0.95) translateY(12px);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
}

.modal-content {
  width: 94%;
  max-width: 940px;
  max-height: 88vh;
  padding: 24px 28px;
  border-radius: 16px;
  background: var(--bg-surface-elevated, rgba(20, 22, 32, 0.94));
  border: none !important;
  box-shadow: 0 25px 75px rgba(0, 0, 0, 0.55), 0 0 1px rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
  padding-bottom: 0;
  border-bottom: none !important;
}

.header-title-box {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon-badge {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: var(--primary-gradient-subtle, rgba(139, 92, 246, 0.12));
  border: none !important;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-color);
}

.modal-header h3 {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.header-subtitle {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin: 3px 0 0 0;
}

.close-btn {
  background: transparent;
  border: none !important;
  color: var(--text-muted);
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-smooth);
}

.close-btn:hover {
  color: var(--text-primary);
  background: var(--bg-subtle-hover, rgba(255, 255, 255, 0.08));
}

/* 分栏布局：两栏并排，固定高度约束，双向自适应独立滚动 */
.modal-layout {
  display: grid;
  grid-template-columns: 290px 1fr;
  gap: 22px;
  height: 520px;
  min-height: 440px;
  max-height: calc(86vh - 150px);
  overflow: hidden;
}

/* 左侧栏容器 (彻底消除外部边框，纯净平滑背景) */
.profiles-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.02);
  border: none !important;
  border-radius: 12px;
  padding: 12px;
  gap: 10px;
}

:root[data-theme="light"] .profiles-sidebar {
  background: rgba(0, 0, 0, 0.02);
}

.sidebar-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.045);
  border: none !important;
  border-radius: 8px;
  flex-shrink: 0;
  transition: var(--transition-smooth);
}

:root[data-theme="light"] .sidebar-search {
  background: rgba(0, 0, 0, 0.035);
}

.sidebar-search:focus-within {
  background: rgba(255, 255, 255, 0.07);
  box-shadow: 0 0 0 1.5px var(--primary-color);
}

.search-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.search-input {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 0.8rem;
}

.clear-search-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0 2px;
}

/* 方案分组与列表容器 */
.grouped-profiles-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 4px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.16) transparent;
}

.grouped-profiles-list::-webkit-scrollbar {
  width: 4px;
}

.grouped-profiles-list::-webkit-scrollbar-track {
  background: transparent;
}

.grouped-profiles-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.16);
  border-radius: 4px;
}

/* 服务商分组：彻底消除外圈实线盒子，纯粹优雅树结构 */
.provider-group {
  display: flex;
  flex-direction: column;
  background: transparent !important;
  border: none !important;
  border-radius: 0;
  overflow: hidden;
  flex-shrink: 0;
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 8px;
  cursor: pointer;
  user-select: none;
  background: transparent !important;
  border: none !important;
  border-radius: 6px;
  transition: background 0.15s;
}

.group-header:hover {
  background: rgba(255, 255, 255, 0.04) !important;
}

:root[data-theme="light"] .group-header:hover {
  background: rgba(0, 0, 0, 0.035) !important;
}

.group-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
}

.collapse-arrow {
  color: var(--text-muted);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.collapse-arrow.expanded {
  transform: rotate(90deg);
}

.provider-title {
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.group-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.group-count-badge {
  font-size: 0.65rem;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-muted);
  border: none !important;
}

.mini-add-btn {
  background: transparent;
  border: none !important;
  color: var(--text-muted);
  padding: 2px 4px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-fast);
}

.mini-add-btn:hover {
  color: var(--primary-color);
  background: rgba(139, 92, 246, 0.15);
}

.group-children {
  display: flex;
  flex-direction: column;
  padding: 2px 0 4px 6px;
  gap: 2px;
}

/* 方案单项：彻底去除边框胶囊，采用柔和高斯微底色 */
.profile-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.78rem;
  color: var(--text-secondary);
  border: none !important;
  outline: none !important;
  background: transparent;
  transition: all 0.18s;
}

.profile-item:hover {
  background: rgba(255, 255, 255, 0.045);
  color: var(--text-primary);
}

:root[data-theme="light"] .profile-item:hover {
  background: rgba(0, 0, 0, 0.04);
}

.profile-item.active {
  background: rgba(139, 92, 246, 0.14) !important;
  border: none !important;
  color: var(--primary-color);
  font-weight: 600;
}

.profile-item-indicator {
  position: absolute;
  left: 0;
  top: 7px;
  bottom: 7px;
  width: 3px;
  background: var(--primary-gradient);
  border-radius: 0 2px 2px 0;
}

.profile-item-info {
  flex: 1;
  overflow: hidden;
  margin-right: 6px;
}

.profile-item-name {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-actions {
  display: flex;
  align-items: center;
  gap: 3px;
  opacity: 0;
  transition: opacity 0.15s;
}

.profile-item:hover .item-actions,
.profile-item.active .item-actions {
  opacity: 1;
}

.profile-action-btn {
  background: transparent;
  border: none !important;
  color: var(--text-muted);
  cursor: pointer;
  padding: 3px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-fast);
}

.profile-action-btn:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.08);
}

.delete-btn:hover {
  color: var(--color-error);
  background: rgba(244, 63, 94, 0.15);
}

/* 底部新增方案按钮：彻底去除虚线框胶囊，现代幽灵按钮 */
.add-profile-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  background: transparent;
  border: none !important;
  outline: none !important;
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition: var(--transition-smooth);
}

.add-profile-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--primary-color);
}

:root[data-theme="light"] .add-profile-btn:hover {
  background: rgba(0, 0, 0, 0.04);
}

/* 右侧表单区域：纯平通透流式布局 (无边框卡片盒子嵌套) */
.profile-form {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 8px;
  gap: 18px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.16) transparent;
}

.profile-form::-webkit-scrollbar {
  width: 4px;
}

.profile-form::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.16);
  border-radius: 4px;
}

/* 纯净状态行 */
.profile-status-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 0 4px 0;
  border: none !important;
  background: transparent;
  font-size: 0.76rem;
}

.status-indicator-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-emerald, #10b981);
  box-shadow: 0 0 6px var(--accent-emerald, #10b981);
}

.status-tip {
  color: var(--text-muted);
}

.status-name {
  color: var(--text-primary);
  font-weight: 700;
}

.status-provider {
  color: var(--primary-color);
  font-weight: 500;
}

/* 模块分块：彻底消除卡片边框背景，纯平流式排列 */
.form-section-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0;
  background: transparent !important;
  border: none !important;
}

.section-title {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-secondary);
  margin: 0 0 2px 0;
  letter-spacing: 0.2px;
}

.form-row-two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.label-with-action {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-secondary);
}

/* 极简无框快捷操作链接 */
.quick-v1-link {
  background: rgba(16, 185, 129, 0.12) !important;
  border: none !important;
  outline: none !important;
  color: var(--accent-emerald, #10b981) !important;
  font-size: 0.68rem;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 4px;
  cursor: pointer;
  transition: var(--transition-fast);
}

.quick-v1-link:hover {
  background: var(--accent-emerald, #10b981) !important;
  color: #ffffff !important;
}

/* 输入框：彻底消除边框线，平整纯黑/微灰底槽 */
.form-input {
  width: 100%;
  padding: 9px 12px;
  background: rgba(255, 255, 255, 0.045) !important;
  border: none !important;
  outline: none !important;
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 0.82rem;
  transition: var(--transition-smooth);
}

:root[data-theme="light"] .form-input {
  background: rgba(0, 0, 0, 0.035) !important;
}

.form-input:focus {
  background: rgba(255, 255, 255, 0.08) !important;
  box-shadow: 0 0 0 1.5px var(--primary-color) !important;
}

:root[data-theme="light"] .form-input:focus {
  background: rgba(0, 0, 0, 0.055) !important;
}

.password-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input {
  padding-right: 36px;
}

.toggle-password {
  position: absolute;
  right: 10px;
  background: transparent;
  border: none !important;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
}

.toggle-password:hover {
  color: var(--text-primary);
}

.input-desc {
  font-size: 0.68rem;
  color: var(--text-muted);
  line-height: 1.35;
}

/* 代理切换行：现代无框平整行 */
.proxy-toggle-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.035);
  border: none !important;
  border-radius: 8px;
  cursor: pointer;
  user-select: none;
  transition: var(--transition-smooth);
}

:root[data-theme="light"] .proxy-toggle-row {
  background: rgba(0, 0, 0, 0.025);
}

.proxy-toggle-row:hover {
  background: rgba(255, 255, 255, 0.065);
}

:root[data-theme="light"] .proxy-toggle-row:hover {
  background: rgba(0, 0, 0, 0.05);
}

.proxy-toggle-row.active {
  background: rgba(139, 92, 246, 0.08);
}

.proxy-info-col {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.proxy-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.proxy-icon {
  font-size: 0.84rem;
}

.proxy-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary);
}

.proxy-tag {
  font-size: 0.58rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  border: none !important;
}

.proxy-tag.enabled {
  background: rgba(16, 185, 129, 0.15);
  color: var(--accent-emerald, #10b981);
}

.proxy-tag.disabled {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-muted);
}

.proxy-desc {
  font-size: 0.68rem;
  color: var(--text-muted);
  line-height: 1.35;
}

/* 底部操作行：无生硬分割线 */
.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  padding-top: 0;
  border-top: none !important;
}

.footer-left-hint {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.7rem;
  color: var(--text-muted);
}

.hint-icon {
  font-size: 0.75rem;
}

.footer-right-btns {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn {
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition-smooth);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.05) !important;
  border: none !important;
  color: var(--text-secondary);
}

:root[data-theme="light"] .btn-secondary {
  background: rgba(0, 0, 0, 0.04) !important;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.09) !important;
  color: var(--text-primary);
}

.btn-primary {
  background: var(--primary-gradient) !important;
  border: none !important;
  color: #ffffff;
  box-shadow: 0 4px 14px var(--accent-glow);
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px var(--accent-glow);
}
</style>
