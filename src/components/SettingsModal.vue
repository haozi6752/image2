<template>
  <Transition name="fade">
    <div v-if="isOpen" class="modal-overlay" @click.self="close">
      <div class="modal-content glass-panel">
        <div class="modal-header">
          <h3>API 参数设置</h3>
          <button class="close-btn" @click="close">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        
        <div class="modal-body">
          <div class="form-group">
            <label for="baseURL">API 接口基础路径 (Base URL)</label>
            <input 
              id="baseURL" 
              type="text" 
              v-model="tempBaseURL" 
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
                v-model="tempApiKey" 
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
              v-model="tempModel" 
              placeholder="gpt-image-2" 
              class="form-input"
            />
            <span class="input-desc">例如：gpt-image-2 或 dall-e-3</span>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="close">取消</button>
          <button class="btn btn-primary" @click="save">保存配置</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  isOpen: Boolean,
  baseURL: String,
  apiKey: String,
  model: String
});

const emit = defineEmits(['close', 'save']);

const tempBaseURL = ref('');
const tempApiKey = ref('');
const tempModel = ref('');
const showKey = ref(false);

// 监听打开状态，每次打开同步临时变量
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    tempBaseURL.value = props.baseURL;
    tempApiKey.value = props.apiKey;
    tempModel.value = props.model;
  }
});

const close = () => {
  emit('close');
};

const save = () => {
  emit('save', {
    baseURL: tempBaseURL.value.trim(),
    apiKey: tempApiKey.value.trim(),
    model: tempModel.value.trim() || 'gpt-image-2'
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
  max-width: 480px;
  padding: 24px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
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

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-bottom: 24px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.form-input {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 10px 14px;
  color: var(--text-primary);
  font-size: 0.9rem;
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
  font-size: 0.75rem;
  color: var(--text-muted);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn {
  padding: 10px 18px;
  border-radius: 10px;
  font-size: 0.9rem;
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
