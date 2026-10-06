<template>
  <Transition name="fade">
    <div v-if="isOpen" class="modal-overlay" @click.self="close">
      <div class="modal-content glass-panel">
        <!-- 头部 -->
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
          <button class="close-btn" @click="close">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        
        <!-- 主体：分栏布局 -->
        <div class="modal-layout" v-if="tempProfiles.length > 0">
          <!-- 左栏：方案树与分组列表 -->
          <div class="profiles-sidebar">
            <div class="sidebar-search">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="search-icon"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input 
                v-model="searchQuery" 
                type="text" 
                placeholder="搜索服务商或方案..." 
                class="search-input"
              />
            </div>

            <!-- 分组折叠树 -->
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
                      stroke-width="2" 
                      stroke-linecap="round" 
                      stroke-linejoin="round"
                      class="collapse-arrow"
                      :class="{ 'expanded': !collapsedGroups[group.provider] }"
                    >
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                    <span class="provider-title">{{ group.provider }}</span>
                  </div>
                  <div class="group-header-right">
                    <span class="group-count-badge">{{ group.items.length }}</span>
                    <button 
                      class="mini-add-btn" 
                      @click.stop="addProfileToGroup(group.provider)" 
                      title="在此供应商下添加新配置"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button>
                  </div>
                </div>

                <!-- 分组内的子方案项 -->
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

            <!-- 底部新增方案按钮 -->
            <button class="add-profile-btn" @click="addNewEmptyProfile">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>新增独立方案/供应商</span>
            </button>
          </div>

          <!-- 右栏：方案表单详情 -->
          <div class="profile-form" v-if="currentProfile">
            <!-- 所属供应商组 -->
            <div class="form-row-two">
              <div class="form-group">
                <label for="providerName">服务商 / 分组名称</label>
                <input 
                  id="providerName" 
                  type="text" 
                  v-model="currentProfile.provider" 
                  placeholder="服务商名称 (如: OpenAI, 第三方中转等)" 
                  class="form-input"
                />
                <span class="input-desc">同名服务商将自动聚类到同一分组中</span>
              </div>

              <div class="form-group">
                <label for="profileName">方案标签 / 名称</label>
                <input 
                  id="profileName" 
                  type="text" 
                  v-model="currentProfile.name" 
                  placeholder="方案名称 (如: 默认方案, 高清出图等)" 
                  class="form-input"
                />
                <span class="input-desc">自定义方案标识，便于快速识别与切换</span>
              </div>
            </div>

            <!-- Base URL（带自动填充 /v1 增强） -->
            <div class="form-group">
              <div class="label-with-action">
                <label for="baseURL">API 基础路径 (Base URL)</label>
                <button 
                  v-if="canAppendV1" 
                  class="quick-v1-btn" 
                  type="button" 
                  @click="autoAppendV1"
                >
                  ⚡ 点击自动补充 /v1
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
                第三方 API 中转站通常为 https://api.xxx.com/v1（失去焦点或点击上方按钮时可自动规范化补齐）
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
                  class="form-input"
                />
                <button class="toggle-password" type="button" @click="showKey = !showKey">
                  <svg v-if="showKey" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                </button>
              </div>
              <span class="input-desc">密钥仅安全保存在本地，绝对不会外传。</span>
            </div>

            <!-- 反向代理开关 -->
            <div class="form-group checkbox-card">
              <input 
                id="useProxy" 
                type="checkbox" 
                v-model="currentProfile.useProxy" 
                class="form-checkbox"
              />
              <label for="useProxy" class="checkbox-label">
                <div class="checkbox-text-title">通过 Vercel 服务端代理请求</div>
                <div class="checkbox-text-desc">有效解决浏览器直接调用第三方 API 时的 CORS 跨域限制，保障图生图与传输畅通</div>
              </label>
            </div>
          </div>
        </div>

        <!-- 底部操作按钮 -->
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="close">取消</button>
          <button class="btn btn-primary" @click="save">保存并应用方案</button>
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
  // 从 name 中提取，如 "MikotoPro 1k/..." -> "MikotoPro"
  const rawName = (item.name || '').trim();
  const spaceParts = rawName.split(/[\s/_]/);
  if (spaceParts.length > 1 && spaceParts[0].length >= 2) {
    return spaceParts[0];
  }
  // 从 baseURL 中提取域名关键字段
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
  // 继承该分组下前一个方案的 baseURL 和 apiKey
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
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
}

.modal-content {
  width: 92%;
  max-width: 820px;
  max-height: 88vh;
  padding: 24px;
  border-radius: 20px;
  background: rgba(18, 20, 29, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65), 0 0 40px rgba(99, 102, 241, 0.1);
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
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
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2));
  border: 1px solid rgba(99, 102, 241, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #818cf8;
}

.modal-header h3 {
  font-size: 1.15rem;
  font-weight: 600;
  color: #f8fafc;
  margin: 0;
}

.header-subtitle {
  font-size: 0.8rem;
  color: #94a3b8;
  margin: 2px 0 0 0;
}

.close-btn {
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
}

.modal-layout {
  display: flex;
  gap: 20px;
  min-height: 420px;
  max-height: 58vh;
  overflow: hidden;
}

/* 左侧栏 */
.profiles-sidebar {
  width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: rgba(10, 12, 18, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  padding: 12px;
  gap: 10px;
}

.sidebar-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
}

.search-icon {
  color: #64748b;
  flex-shrink: 0;
}

.search-input {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  color: #e2e8f0;
  font-size: 0.8rem;
}

.grouped-profiles-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 4px;
}

.provider-group {
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.04);
  overflow: hidden;
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  cursor: pointer;
  user-select: none;
  background: rgba(255, 255, 255, 0.03);
  transition: background 0.15s;
}

.group-header:hover {
  background: rgba(255, 255, 255, 0.06);
}

.group-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
}

.collapse-arrow {
  color: #94a3b8;
  transition: transform 0.2s ease;
}

.collapse-arrow.expanded {
  transform: rotate(90deg);
}

.provider-title {
  font-size: 0.82rem;
  font-weight: 600;
  color: #cbd5e1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.group-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.group-count-badge {
  font-size: 0.7rem;
  padding: 1px 6px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  color: #94a3b8;
}

.mini-add-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  padding: 2px 4px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.mini-add-btn:hover {
  color: #818cf8;
  background: rgba(99, 102, 241, 0.15);
}

.group-children {
  display: flex;
  flex-direction: column;
  padding: 4px 6px 6px 6px;
  gap: 4px;
}

.profile-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.8rem;
  color: #94a3b8;
  border: 1px solid transparent;
  transition: all 0.15s ease;
}

.profile-item:hover {
  background: rgba(255, 255, 255, 0.04);
  color: #e2e8f0;
}

.profile-item.active {
  background: rgba(99, 102, 241, 0.18);
  border-color: rgba(99, 102, 241, 0.4);
  color: #fff;
  font-weight: 500;
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
  gap: 4px;
  opacity: 0.4;
  transition: opacity 0.15s;
}

.profile-item:hover .item-actions,
.profile-item.active .item-actions {
  opacity: 1;
}

.profile-action-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 3px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.profile-action-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.delete-btn:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.15);
}

.add-profile-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(99, 102, 241, 0.12);
  border: 1px dashed rgba(99, 102, 241, 0.35);
  border-radius: 8px;
  color: #a5b4fc;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.add-profile-btn:hover {
  background: rgba(99, 102, 241, 0.22);
  border-color: #818cf8;
  color: #fff;
}

/* 右侧表单 */
.profile-form {
  flex: 1;
  overflow-y: auto;
  padding-right: 8px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-row-two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label-with-action {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

label {
  font-size: 0.82rem;
  font-weight: 500;
  color: #cbd5e1;
}

.quick-v1-btn {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #34d399;
  font-size: 0.72rem;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.quick-v1-btn:hover {
  background: rgba(16, 185, 129, 0.25);
  color: #6ee7b7;
}

.form-input {
  width: 100%;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: #f8fafc;
  font-size: 0.85rem;
  outline: none;
  transition: all 0.2s;
}

.form-input:focus {
  border-color: #6366f1;
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

.password-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.toggle-password {
  position: absolute;
  right: 10px;
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: 4px;
}

.toggle-password:hover {
  color: #e2e8f0;
}

.input-desc {
  font-size: 0.73rem;
  color: #64748b;
  line-height: 1.35;
}

.checkbox-card {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  margin-top: 4px;
}

.form-checkbox {
  margin-top: 3px;
  width: 16px;
  height: 16px;
  accent-color: #6366f1;
  cursor: pointer;
}

.checkbox-label {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.checkbox-text-title {
  font-size: 0.82rem;
  font-weight: 500;
  color: #e2e8f0;
}

.checkbox-text-desc {
  font-size: 0.73rem;
  color: #64748b;
}

/* 底部操作 */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.btn {
  padding: 9px 18px;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.btn-primary {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border: none;
  color: #fff;
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.35);
}

.btn-primary:hover {
  opacity: 0.92;
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
  transform: translateY(-1px);
}

/* 滚动条 */
::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
}
</style>
