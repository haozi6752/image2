<template>
  <div 
    class="prompt-input-container" 
    :class="{ 
      'focused': isFocused || prompt.trim().length > 0, 
      'generating': isGenerating 
    }"
  >
    <div class="input-panel glass-panel">
      <!-- 文本输入区 -->
      <div class="input-row">
        <textarea
          ref="textareaRef"
          v-model="prompt"
          class="prompt-textarea"
          placeholder="描述你想要生成的画面... (支持中文/英文)"
          rows="1"
          @focus="onFocus"
          @blur="onBlur"
          @keydown.enter.prevent="handleEnter"
          :disabled="isGenerating"
        ></textarea>

        <!-- 一键清空 -->
        <button 
          v-if="prompt.length > 0 && !isGenerating" 
          class="clear-btn" 
          @click="clearPrompt"
          title="清空"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
        </button>

        <!-- 随机灵感 -->
        <button 
          v-if="!isGenerating && (!isFocused && prompt.length === 0)" 
          class="random-btn" 
          @click="getRandomPrompt"
          title="随机灵感"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>
        </button>

        <!-- 发送/生成按钮 -->
        <button 
          class="generate-btn" 
          :class="{ 'active': prompt.trim().length > 0, 'generating': isGenerating }"
          :disabled="prompt.trim().length === 0 || isGenerating"
          @click="submit"
        >
          <span v-if="!isGenerating">生成图片</span>
          <span v-else class="generating-text">
            <svg class="spinner" viewBox="0 0 50 50">
              <circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
            </svg>
            渲染中...
          </span>
        </button>
      </div>

      <!-- 展开后的辅助区域 (随机词、快捷提示词配置) -->
      <div class="expand-footer" v-if="isFocused || prompt.trim().length > 0">
        <div class="suggestions">
          <span class="suggestion-label">灵感灵感:</span>
          <button 
            v-for="sug in currentSuggestions" 
            :key="sug"
            class="suggestion-tag"
            @click="useSuggestion(sug)"
          >
            {{ sug }}
          </button>
          <button class="refresh-suggestions-btn" @click="refreshSuggestions" title="换一批">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick } from 'vue';

const props = defineProps({
  isGenerating: Boolean
});

const emit = defineEmits(['generate']);

const prompt = ref('');
const isFocused = ref(false);
const textareaRef = ref(null);

// 随机灵感词池
const promptPool = [
  "Cyberpunk street with glowing neon lights, rain reflections, futuristic flying cars, hyper-detailed, 8k resolution",
  "A majestic dragon perched on a snow-covered mountain peak, sunset glowing through clouds, digital fantasy art",
  "A cozy cabin in the woods surrounded by glowing bioluminescent mushrooms and fireflies, starry night, digital painting",
  "Astronaut floating in a sea of vintage flowers, cosmic background with galaxies, surrealism, high fidelity",
  "一只戴着宇航员头盔的猫咪在太空中捕捉流星，皮克斯风格，温暖治愈",
  "A sleek futuristic sports car driving on a coastal road during golden hour, cinematic lighting, photorealistic",
  "赛博朋克风格的古风江南水乡，霓虹倒影在石板路和小河中，虚幻引擎5渲染",
  "An ancient library with towering bookshelves, magical floating spell books, warm candle lighting, oil painting style",
  "Studio Ghibli style meadow, wind blowing through tall green grass, fluffy white clouds in a bright blue sky, detailed watercolor",
  "A futuristic biomechanical plant that grows crystals, glowing in the dark, dark macro photography"
];

const tagsPool = [
  "赛博朋克街道", "科幻太空舱", "写实猫咪", "治愈吉卜力风", "微距发光水晶", 
  "史诗级极光", "机械恐龙", "水彩森林", "古风仙侠"
];

const currentSuggestions = ref([]);

const refreshSuggestions = () => {
  // 随机取3个标签
  const shuffled = [...tagsPool].sort(() => 0.5 - Math.random());
  currentSuggestions.value = shuffled.slice(0, 3);
};

const getRandomPrompt = () => {
  const randomIndex = Math.floor(Math.random() * promptPool.length);
  prompt.value = promptPool[randomIndex];
  adjustHeight();
  textareaRef.value?.focus();
};

const useSuggestion = (tag) => {
  const extra = `A beautiful ${tag}, detailed, trending on artstation`;
  if (prompt.value.trim().length === 0) {
    prompt.value = extra;
  } else {
    prompt.value += `, ${tag}`;
  }
  adjustHeight();
  textareaRef.value?.focus();
};

const onFocus = () => {
  isFocused.value = true;
};

const onBlur = () => {
  // 如果输入框没有内容，失焦后返回收缩状态
  setTimeout(() => {
    if (prompt.value.trim().length === 0) {
      isFocused.value = false;
    }
  }, 200);
};

const clearPrompt = () => {
  prompt.value = '';
  isFocused.value = false;
  adjustHeight();
};

const handleEnter = (e) => {
  if (e.shiftKey) {
    // 换行，支持
    return;
  }
  submit();
};

const submit = () => {
  if (prompt.value.trim().length === 0 || props.isGenerating) return;
  emit('generate', prompt.value.trim());
  textareaRef.value?.blur();
};

const adjustHeight = () => {
  nextTick(() => {
    const el = textareaRef.value;
    if (!el) return;
    el.style.height = 'auto';
    // 限制最高高度
    const newHeight = Math.min(el.scrollHeight, 180);
    el.style.height = `${newHeight}px`;
  });
};

// 监听内容变化，自动调节高度
watch(prompt, () => {
  adjustHeight();
});

onMounted(() => {
  refreshSuggestions();
});
</script>

<style scoped>
.prompt-input-container {
  width: 100%;
  max-width: 680px;
  margin: 0 auto;
  transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1);
  z-index: 100;
}

/* 正常输入状态 */
.prompt-input-container.focused {
  max-width: 720px;
}

/* 生图时下移 */
.prompt-input-container.generating {
  transform: translateY(0); /* 这里的动画定位最终由父组件的 Flex/Layout 控制更为简单，或者直接用 class 控制 */
}

.input-panel {
  padding: 12px 16px;
  border-radius: 24px;
  border: 1px solid var(--border-color);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: var(--transition-smooth);
  background: rgba(15, 22, 42, 0.7);
}

.focused .input-panel {
  border-color: rgba(99, 102, 241, 0.4);
  box-shadow: 0 16px 50px rgba(99, 102, 241, 0.15), 0 0 0 1px rgba(99, 102, 241, 0.2);
  background: rgba(15, 22, 42, 0.85);
}

.input-row {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  position: relative;
}

.prompt-textarea {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  color: var(--text-primary);
  font-size: 0.95rem;
  line-height: 1.5;
  padding: 8px 0;
  max-height: 180px;
  min-height: 24px;
  height: 36px;
  font-family: var(--font-family);
}

.prompt-textarea::placeholder {
  color: var(--text-muted);
}

.clear-btn, .random-btn {
  color: var(--text-secondary);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-bottom: 4px;
}

.clear-btn:hover, .random-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-primary);
}

.generate-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  border-radius: 14px;
  padding: 0 20px;
  height: 40px;
  font-size: 0.9rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: var(--transition-smooth);
}

.generate-btn.active {
  background: var(--primary-gradient);
  border-color: transparent;
  color: #ffffff;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.3);
}

.generate-btn.active:hover {
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
  transform: translateY(-1px);
}

.generate-btn.generating {
  background: rgba(99, 102, 241, 0.2);
  border-color: rgba(99, 102, 241, 0.3);
  color: var(--text-primary);
  pointer-events: none;
}

/* 旋转器 */
.spinner {
  animation: rotate 2s linear infinite;
  width: 14px;
  height: 14px;
  margin-right: 8px;
}

.spinner .path {
  stroke: var(--text-primary);
  stroke-linecap: round;
  animation: dash 1.5s ease-in-out infinite;
}

@keyframes dash {
  0% {
    stroke-dasharray: 1, 150;
    stroke-dashoffset: 0;
  }
  50% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -35;
  }
  100% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -124;
  }
}

.generating-text {
  display: flex;
  align-items: center;
}

/* 建议标签区 */
.expand-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  animation: slideDown 0.2s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.suggestions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.suggestion-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 500;
}

.suggestion-tag {
  font-size: 0.75rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-color);
  padding: 4px 10px;
  border-radius: 99px;
  color: var(--text-secondary);
}

.suggestion-tag:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
  border-color: rgba(255, 255, 255, 0.15);
}

.refresh-suggestions-btn {
  color: var(--text-muted);
  display: flex;
  align-items: center;
  padding: 4px;
}

.refresh-suggestions-btn:hover {
  color: var(--text-primary);
}
</style>
