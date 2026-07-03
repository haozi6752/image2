<template>
  <Transition name="fade">
    <div v-if="isOpen" class="modal-overlay" @click.self="close">
      <div class="modal-content glass-panel">
        <!-- 头部 -->
        <div class="modal-header">
          <h3>API 方案配置管理</h3>
          <button class="close-btn" @click="close">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        
        <!-- 主体：分栏布局 -->
        <div class="modal-layout" v-if="tempProfiles.length > 0">
          <!-- 左栏：方案列表 -->
          <div class="profiles-sidebar">
            <div class="sidebar-header">
              <span>方案列表</span>
            </div>
            <div class="profiles-list">
              <div 
                v-for="profile in tempProfiles" 
                :key="profile.id"
                class="profile-item"
                :class="{ 'active': selectedProfileId === profile.id }"
                @click="selectedProfileId = profile.id"
              >
                <span class="profile-item-name" :title="profile.name">{{ profile.name }}</span>
                <button 
                  v-if="tempProfiles.length > 1" 
                  class="profile-item-delete"
                  @click.stop="deleteProfile(profile.id)"
                  title="删除方案"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            </div>
            <button class="add-profile-btn" @click="addProfile">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>新增方案</span>
            </button>
          </div>

          <!-- 右栏：方案表单详情 -->
          <div class="profile-form" v-if="currentProfile">
            <div class="form-group">
              <label for="profileName">方案名称</label>
              <input 
                id="profileName" 
                type="text" 
                v-model="currentProfile.name" 
                placeholder="例如: 官方标准方案" 
                class="form-input"
              />
            </div>

            <div class="form-group">
              <label for="baseURL">API 基础路径 (Base URL)</label>
              <input 
                id="baseURL" 
                type="text" 
                v-model="currentProfile.baseURL" 
                placeholder="https://api.openai.com/v1" 
                class="form-input"
              />
              <span class="input-desc">第三方 API 中转站通常为 https://api.xxx.com/v1</span>
            </div>

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
                <button class="toggle-password" @click="showKey = !showKey">
                  <svg v-if="showKey" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                </button>
              </div>
              <span class="input-desc">配置将安全保存在浏览器本地，绝不会上传。</span>
            </div>

            <div class="form-group">
              <label for="defaultModel">默认生图模型</label>
              <input 
                id="defaultModel" 
                type="text" 
                v-model="currentProfile.model" 
                placeholder="gpt-image-2" 
                class="form-input"
              />
              <span class="input-desc">建议填入: gpt-image-2 或 dall-e-3</span>
            </div>

            <div class="form-group checkbox-group">
              <input 
                id="useProxy" 
                type="checkbox" 
                v-model="currentProfile.useProxy" 
                class="form-checkbox"
              />
              <label for="useProxy" class="checkbox-label">通过 Vercel 服务端代理请求 (解决浏览器跨域 CORS 限制)</label>
            </div>
          </div>
        </div>

        <!-- 底部操作按钮 -->
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="close">取消</button>
          <button class="btn btn-primary" @click="save">保存方案</button>
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

// 当前选中的修改方案
const currentProfile = computed(() => {
  return tempProfiles.value.find(p => p.id === selectedProfileId.value);
});

// 监听打开状态，进行草稿数据复制
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    showKey.value = false;
    if (props.profiles && props.profiles.length > 0) {
      tempProfiles.value = JSON.parse(JSON.stringify(props.profiles));
      selectedProfileId.value = props.activeProfileId || props.profiles[0].id;
    } else {
      // 回退初始化
      tempProfiles.value = [{
        id: 'default',
        name: '默认方案',
        baseURL: 'https://api.openai.com/v1',
        apiKey: '',
        model: 'gpt-image-2',
        useProxy: true
      }];
      selectedProfileId.value = 'default';
    }
  }
});

// 新增方案
const addProfile = () => {
  const newId = Date.now().toString();
  const nextNumber = tempProfiles.value.length + 1;
  const newProfile = {
    id: newId,
    name: `新增方案 ${nextNumber}`,
    baseURL: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-image-2',
    useProxy: true
  };
  tempProfiles.value.push(newProfile);
  selectedProfileId.value = newId;
};

// 删除方案
const deleteProfile = (id) => {
  if (tempProfiles.value.length <= 1) return;
  const index = tempProfiles.value.findIndex(p => p.id === id);
  if (index !== -1) {
    tempProfiles.value.splice(index, 1);
    // 如果删除的是当前选中的，则切换到第一个
    if (selectedProfileId.value === id) {
      selectedProfileId.value = tempProfiles.value[0].id;
    }
  }
};

const close = () => {
  emit('close');
};

const save = () => {
  // 表单完整性微调
  tempProfiles.value.forEach(p => {
    p.name = p.name.trim() || '未命名方案';
    p.baseURL = p.baseURL.trim();
    p.apiKey = p.apiKey.trim();
    p.model = p.model.trim() || 'gpt-image-2';
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
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
}

.modal-content {
  width: 90%;
  max-width: 680px; /* 从 480px 调大以支持分栏 */
  padding: 24px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.modal-header h3 {
  font-size: 1.25rem;
  font-weight: 600;
  background: linear-gradient(135deg, #a5b4fc 0%, #e0e7ff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.close-btn {
  color: var(--text-secondary);
  border-radius: 50%;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
}

/* 分栏布局 */
.modal-layout {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 24px;
  margin-bottom: 24px;
  min-height: 340px;
}

@media (max-width: 600px) {
  .modal-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
    gap: 16px;
    min-height: auto;
  }
}

/* 左侧栏样式 */
.profiles-sidebar {
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  padding-right: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@media (max-width: 600px) {
  .profiles-sidebar {
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    padding-right: 0;
    padding-bottom: 12px;
  }
}

.sidebar-header {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}

.profiles-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  max-height: 240px;
  flex: 1;
}

.profile-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.01);
  border: 1px solid transparent;
  transition: var(--transition-fast);
  gap: 8px;
}

.profile-item:hover {
  background: rgba(255, 255, 255, 0.04);
}

.profile-item.active {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.3);
  color: var(--text-primary);
}

.profile-item-name {
  font-size: 0.8rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.profile-item.active .profile-item-name {
  color: var(--accent-color);
}

.profile-item-delete {
  color: var(--text-muted);
  border-radius: 4px;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.5;
  transition: var(--transition-fast);
}

.profile-item:hover .profile-item-delete {
  opacity: 1;
}

.profile-item-delete:hover {
  background: rgba(244, 63, 94, 0.15);
  color: var(--color-error);
}

.add-profile-btn {
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed var(--border-color);
  border-radius: 8px;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition-fast);
}

.add-profile-btn:hover {
  background: rgba(99, 102, 241, 0.05);
  border-color: var(--accent-color);
  color: var(--text-primary);
}

/* 右侧栏表单样式 */
.profile-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.form-input {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 10px 14px;
  color: var(--text-primary);
  font-size: 0.85rem;
  width: 100%;
  transition: var(--transition-fast);
  outline: none;
}

.form-input:focus {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px var(--accent-glow);
}

.password-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.toggle-password {
  position: absolute;
  right: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.toggle-password:hover {
  color: var(--text-primary);
}

.input-desc {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.checkbox-group {
  flex-direction: row !important;
  align-items: center;
  gap: 10px !important;
  margin-top: 6px;
  cursor: pointer;
}

.form-checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--accent-color);
}

.checkbox-label {
  font-size: 0.75rem !important;
  color: var(--text-primary) !important;
  cursor: pointer;
  user-select: none;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 16px;
}

.btn {
  padding: 10px 18px;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 500;
  transition: var(--transition-fast);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

.btn-primary {
  background: var(--primary-gradient);
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
}

.btn-primary:hover {
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
}

/* 动效过渡 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-active .modal-content,
.fade-leave-active .modal-content {
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.fade-enter-from .modal-content {
  transform: scale(0.9) translateY(-20px);
}

.fade-leave-to .modal-content {
  transform: scale(0.95) translateY(10px);
}
</style>
