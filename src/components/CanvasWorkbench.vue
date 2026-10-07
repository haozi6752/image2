<template>
  <div 
    class="canvas-viewport" 
    ref="viewportRef"
    @mousedown="onViewportMouseDown"
    @wheel="onWheel"
    :class="{ 'panning': isPanning, 'pointer-mode': toolMode === 'pointer' }"
  >
    <!-- 无限画布转换容器 -->
    <div 
      class="canvas-world" 
      :style="worldTransformStyle"
    >
      <!-- 背景网格坐标层 -->
      <div class="canvas-grid-bg" :style="gridBackgroundStyle"></div>

      <!-- 贝塞尔连线 SVG 层 -->
      <svg class="connections-layer">
        <defs>
          <!-- 1. 当前活跃参考连线：紫蓝渐变 -->
          <linearGradient id="linkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#6366f1" stop-opacity="0.85" />
            <stop offset="100%" stop-color="#a855f7" stop-opacity="0.85" />
          </linearGradient>
          <!-- 2. 最新生成图高亮输出线：亮霓虹青绿发光渐变 (新图从创作框连出) -->
          <linearGradient id="recentOutputGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.95" />
            <stop offset="100%" stop-color="#10b981" stop-opacity="0.95" />
          </linearGradient>
          <!-- 3. 独立后的历史血脉与提示词小方框连线：暖金流光渐变 (与参考线颜色不同) -->
          <linearGradient id="heritageGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.85" />
            <stop offset="100%" stop-color="#fbbf24" stop-opacity="0.85" />
          </linearGradient>
          <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glowRecent" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <!-- 动态渲染节点之间的关联连线 -->
        <g v-for="link in activeLinks" :key="link.id">
          <!-- 1. 底层暗色衬托描边：用于线条立体分层与交叉时清晰辨识，区分归属 -->
          <path 
            :d="link.path" 
            class="connection-curve-underlay"
            fill="none" 
            :stroke-width="(link.strokeWidth || 2.4) + 5"
          />
          <!-- 2. 顶层发光渐变主曲线 -->
          <path 
            :d="link.path" 
            :class="[
              'connection-curve', 
              link.type, 
              { 
                'faded-heritage': link.type === 'heritage' && isAnyRefActive && hoveredPipelineId !== link.pipelineId,
                'highlighted-link': hoveredNodeId && (link.id.includes(hoveredNodeId))
              }
            ]"
            :stroke="link.stroke" 
            fill="none" 
            :stroke-width="link.strokeWidth || 2.4"
            :filter="link.filter"
          />
          <!-- 起点与终点锚点 (动态沿边缘平滑移动的物理节点) -->
          <circle 
            :cx="link.fromX" 
            :cy="link.fromY" 
            :r="link.type === 'recent-output' ? 5 : 4" 
            :class="['connection-point', 'from', link.type, { 'faded-point': link.type === 'heritage' && isAnyRefActive && hoveredPipelineId !== link.pipelineId }]" 
          />
          <circle 
            :cx="link.toX" 
            :cy="link.toY" 
            :r="link.type === 'recent-output' ? 5 : 4" 
            :class="['connection-point', 'to', link.type, { 'faded-point': link.type === 'heritage' && isAnyRefActive && hoveredPipelineId !== link.pipelineId }]" 
          />
        </g>
      </svg>

      <!-- 画布上的所有卡片节点 -->
      <div class="nodes-container">
        <!-- 1. 生图主控制节点 (尺寸随内容真实变化，连线动态贴合当前真实边缘) -->
        <div 
          ref="configNodeEl"
          class="canvas-node config-node glass-panel"
          :class="{ 'is-dragging': draggingNode === configNode }"
          :style="{ transform: `translate3d(${configNode.x}px, ${configNode.y}px, 0)` }"
          @mousedown.stop="startNodeDrag($event, configNode)"
        >
          <!-- 节点顶部拖拽柄 (无胶囊边框，极简状态指示) -->
          <div class="node-header">
            <div class="node-title">
              <span class="node-icon">✨</span>
              <span>创作配置中心</span>
            </div>
            <div class="node-status-indicator">
              <span class="status-indicator-dot" :class="configNode.refImages && configNode.refImages.length > 0 ? 'mode-image' : 'mode-text'"></span>
              <span class="status-indicator-text">
                {{ configNode.refImages && configNode.refImages.length > 1 ? `多图融合 (${configNode.refImages.length}/16)` : configNode.refImages && configNode.refImages.length === 1 ? '单图参考' : '纯文生图' }}
              </span>
            </div>
          </div>

          <!-- 提示词输入区 -->
          <div class="node-body">
            <!-- 多图参考托盘与引用区域 (支持最多 16 张，符合 OpenAI 规范) -->
            <div v-if="configNode.refImages && configNode.refImages.length > 0" class="multi-reference-container">
              <div class="ref-container-header">
                <span class="ref-container-title">
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                  <span>已载入参考图 ({{ configNode.refImages.length }}/16 张)</span>
                </span>
                <button class="clear-all-refs-btn" @click.stop="clearConfigRefImages" title="清空全部参考图">清空组合</button>
              </div>

              <!-- 缩略图横向列表 -->
              <div class="ref-thumbnails-list">
                <div 
                  v-for="(img, idx) in configNode.refImages" 
                  :key="img.id || idx" 
                  class="ref-thumbnail-card"
                  :title="`参考图 [Image ${idx + 1}]`"
                >
                  <img :src="img.url" :alt="`Image ${idx + 1}`" class="ref-thumb-img" />
                  <span class="ref-order-tag">Image {{ idx + 1 }}</span>
                  <button class="remove-ref-btn" @click.stop="removeRefImage(idx)" title="移除此参考图">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>

                <!-- 托盘末尾快捷追加本地图片小卡片 -->
                <label v-if="configNode.refImages.length < 16" class="ref-add-card" title="导入更多本地参考图 (单次或批量)">
                  <input type="file" multiple accept="image/*" @change="handleLocalRefUpload" style="display: none;" />
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  <span>添加</span>
                </label>
              </div>

              <!-- 快捷引用小芯片栏 (去除厚重胶囊边框) -->
              <div class="quick-ref-pills">
                <span class="pills-label">提示词引用:</span>
                <button 
                  v-for="(_, idx) in configNode.refImages" 
                  :key="idx" 
                  class="ref-pill-btn"
                  @click.stop="insertImageRefToPrompt(idx + 1)"
                  :title="`在提示词中插入 [Image ${idx + 1}]`"
                >
                  + Image {{ idx + 1 }}
                </button>
                <button 
                  v-if="configNode.refImages.length >= 2"
                  class="ref-pill-btn template-pill"
                  @click.stop="insertBlendTemplate"
                  title="插入经典多图融合提示词句式"
                >
                  ⚡ 融合句式
                </button>
              </div>
            </div>

            <!-- 侧栏参数极简规格流 (彻底消灭胶囊框叠胶囊！纯净文字排版与中圆点分隔) -->
            <div class="config-active-specs" v-if="currentSettings">
              <span class="spec-item spec-model" title="当前模型 (在侧边栏选择切换)">
                <span class="spec-dot"></span>
                {{ currentSettings.model || 'gpt-image-2.5-flare' }}
              </span>
              <span class="spec-sep">·</span>
              <span class="spec-item spec-ratio" title="当前图片比例">
                📐 {{ currentSettings.ratio || '1:1' }}
              </span>
              <span class="spec-sep">·</span>
              <span class="spec-item spec-quality" title="当前画质等级">
                {{ (currentSettings.level === '4k' || currentSettings.level === 'ultra') ? '4K 超清' : (currentSettings.level === '2k' || currentSettings.level === 'hd') ? '2K 进阶' : '1K 基准' }}
              </span>
            </div>

            <textarea 
              v-model="configNode.prompt"
              class="node-prompt-input"
              placeholder="在此输入画面创意描述或修改指令... (多图时可使用 Image 1、Image 2 指定角色与画风)"
              rows="4"
              @keydown.enter.ctrl.prevent="triggerGenerate"
              @keydown.enter.meta.prevent="triggerGenerate"
              @mousedown.stop
              @mouseup.stop
              @click.stop
              @wheel.stop
            ></textarea>

            <!-- 操作按钮行 -->
            <div class="node-actions" @mousedown.stop>
              <!-- 上传自定义本地图作为参考 (支持单选或多选) -->
              <label class="action-icon-btn upload-ref-btn" title="批量导入本地图片作为参考 (最多16张)">
                <input type="file" multiple accept="image/*" @change="handleLocalRefUpload" style="display: none;" />
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                <span>{{ configNode.refImages && configNode.refImages.length > 0 ? '追加参考图' : '导入参考图' }}</span>
              </label>

              <!-- 开始生成按钮 -->
              <button 
                class="generate-main-btn" 
                :disabled="isGenerating || !configNode.prompt.trim()"
                @click="triggerGenerate"
              >
                <span v-if="isGenerating" class="btn-spinner"></span>
                <span v-else>
                  {{ configNode.refImages && configNode.refImages.length > 1 ? `＋ 融合生成 (${configNode.refImages.length}图)` : '＋ 开始渲染' }}
                </span>
              </button>
            </div>
          </div>
        </div>

        <!-- 2. 图片卡片节点 (双击放大、一键参考、新生成高亮独立、提示词气泡) -->
        <div 
          v-for="node in imageNodes" 
          :key="node.id"
          class="canvas-node image-node glass-panel"
          :class="{ 
            'selected': selectedNodeId === node.id, 
            'recent-node': node.isRecentGenerated,
            'is-dragging': draggingNode === node,
            'is-referenced': isNodeInRefImages(node.id)
          }"
          :style="{ transform: `translate3d(${node.x}px, ${node.y}px, 0)`, width: `${node.width || 280}px` }"
          @mousedown.stop="startNodeDrag($event, node)"
          @mouseenter="hoveredNodeId = node.id"
          @mouseleave="hoveredNodeId = null"
        >
          <!-- 最新衍生成果横幅与独立按钮 -->
          <div v-if="node.isRecentGenerated" class="recent-output-banner" @mousedown.stop>
            <span class="recent-glow-dot"></span>
            <span class="recent-banner-title">最新衍生</span>
            <button 
              class="separate-node-btn" 
              @click.stop="separateGeneratedNode(node.id)" 
              title="将此图确立为独立分支，自动建立提示词血统节点，并使创作中心完全独立"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
              <span>独立此图</span>
            </button>
          </div>

          <!-- 卡片头部 (右上角展示图片画面宽高比规格) -->
          <div class="img-node-header">
            <span class="img-node-tag">{{ node.model || 'GPT-Image' }}</span>
            <span class="img-node-ratio" title="图片宽高比规格 (如 1:1 正方形, 16:9 横屏, 9:16 竖屏)">{{ node.ratio || '1:1' }}</span>
          </div>

          <!-- 图像主体与交互浮层 (双击图片直接全屏预览放大) -->
          <div 
            class="img-node-media" 
            @dblclick.stop="$emit('preview', node)"
            title="双击图片放大预览"
          >
            <img :src="node.url" :alt="node.prompt" class="img-preview" />
            
            <!-- 悬浮操作面板 -->
            <div class="img-hover-overlay" @mousedown.stop>
              <div class="overlay-actions">
                <!-- 快捷参考控制：已在参考组显示【移出参考】，未在参考组显示【设为参考】/【+追加参考】 -->
                <button 
                  v-if="isNodeInRefImages(node.id)"
                  class="action-pill-btn in-ref-btn" 
                  @click.stop="removeNodeFromRefImages(node.id)"
                  title="从创作中心参考组合中移出此图"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  <span>移出参考</span>
                </button>

                <button 
                  v-else
                  class="action-pill-btn add-ref-btn" 
                  @click.stop="toggleNodeInRefImages(node)"
                  :title="configNode.refImages.length === 0 ? '设为参考图 (将清空输入框文本以输入新构思)' : '追加到参考组合中进行多图融合'"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  <span>{{ configNode.refImages.length === 0 ? '设为参考' : '+ 追加参考' }}</span>
                </button>

                <!-- 如果当前为最新衍生图，浮层也提供一键独立按钮 -->
                <button 
                  v-if="node.isRecentGenerated"
                  class="action-pill-btn separate-action-pill" 
                  @click.stop="separateGeneratedNode(node.id)"
                  title="将生成的图独立出去，建立血统连接，使创作中心独立"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                  <span>独立此图</span>
                </button>

                <div class="secondary-actions">
                  <!-- 仅以此图为唯一参考（清空其他与提示词） -->
                  <button 
                    class="icon-circle-btn sole-ref-btn" 
                    @click.stop="setAsSoleReference(node)" 
                    title="以此图重新开启独立分支 (清空其他参考图与提示词)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><path d="M13 6h3a2 2 0 0 1 2 2v7"></path><line x1="6" y1="9" x2="6" y2="21"></line></svg>
                  </button>

                  <!-- 查看提示词 (引出带复制按钮的文本框) -->
                  <button 
                    class="icon-circle-btn" 
                    :class="{ active: activePromptNodeId === node.id }"
                    @click="togglePromptPopover(node.id)" 
                    title="查看并复制提示词"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                  </button>

                  <!-- 重新设计的复用提示词按钮 (填入创作框) -->
                  <button 
                    class="icon-circle-btn reuse-btn" 
                    @click="copyPromptToConfig(node.prompt)" 
                    title="填入创作框"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </button>

                  <!-- 下载图片 -->
                  <button class="icon-circle-btn" @click="downloadImage(node)" title="下载保存">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  </button>

                  <!-- 从画布移除 -->
                  <button class="icon-circle-btn delete-btn" @click="removeNodeFromCanvas(node.id)" title="从画布中移除">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 从图片框引出的独立提示词文本框 (带复制按钮与箭头) -->
          <div 
            v-if="activePromptNodeId === node.id" 
            class="node-prompt-callout glass-panel"
            @mousedown.stop
          >
            <div class="callout-arrow"></div>
            <div class="callout-header">
              <div class="callout-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                <span>完整提示词</span>
              </div>
              <button class="callout-close-btn" @click.stop="activePromptNodeId = null" title="关闭">×</button>
            </div>
            <div class="callout-body">
              <p class="callout-text">{{ node.prompt }}</p>
            </div>
            <div class="callout-actions">
              <button class="callout-action-btn copy-action-btn" @click.stop="copyPromptText(node.prompt, node.id)">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                <span>{{ copiedPromptNodeId === node.id ? '已复制！' : '复制提示词' }}</span>
              </button>
              <button class="callout-action-btn fill-action-btn" @click.stop="copyPromptToConfig(node.prompt)">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                <span>填入创作框</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 3. 提示词血脉小方框节点 (Derivation Prompt Hubs) -->
        <div 
          v-for="pipe in derivationPipelines" 
          :key="pipe.id"
          class="canvas-node derivation-hub-node glass-panel"
          :class="{ 
            'faded-hub': isAnyRefActive && activePipelineId !== pipe.id && hoveredPipelineId !== pipe.id,
            'active-hub': activePipelineId === pipe.id 
          }"
          :style="{ transform: `translate3d(${pipe.x}px, ${pipe.y}px, 0)` }"
          @click.stop="togglePipelineDetail(pipe.id)"
          @mousedown.stop="startPipeDrag($event, pipe)"
          @mouseenter="hoveredPipelineId = pipe.id"
          @mouseleave="hoveredPipelineId = null"
          title="点击查看生成此图所用的提示词记录"
        >
          <div class="hub-icon-inner">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            <span class="hub-pill-tag">Prompt</span>
          </div>

          <!-- 点击小方框展开的提示词气泡详情 -->
          <div v-if="activePipelineId === pipe.id" class="pipeline-popover glass-panel" @mousedown.stop>
            <div class="popover-header">
              <span class="popover-title">🧬 衍生提示词记录</span>
              <button class="popover-close-btn" @click.stop="activePipelineId = null">×</button>
            </div>
            <div class="popover-body">
              <div class="popover-meta">
                <span class="meta-tag">{{ pipe.model || 'GPT-Image' }}</span>
                <span class="meta-tag">{{ pipe.ratio || '1:1' }}</span>
                <span class="meta-time">{{ pipe.createdAt }}</span>
              </div>
              <p class="popover-prompt">{{ pipe.prompt }}</p>
            </div>
            <div class="popover-actions">
              <button class="pipe-btn copy-btn" @click.stop="copyPipelinePrompt(pipe.prompt, pipe.id)">
                <span>{{ copiedPipeId === pipe.id ? '已复制！' : '复制提示词' }}</span>
              </button>
              <button class="pipe-btn reuse-btn" @click.stop="reusePipelinePrompt(pipe.prompt)">
                <span>填入创作中心</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部悬浮控制坞 (Floating Dock Toolbar，灵感源自图五) -->
    <div class="floating-dock-wrapper" @mousedown.stop>
      <div class="dock-panel glass-panel">
        <!-- 模式切换：选择 vs 抓手 -->
        <div class="dock-group">
          <button 
            class="dock-btn" 
            :class="{ active: toolMode === 'grab' }" 
            @click="toolMode = 'grab'"
            title="抓手漫游 (按住空白拖动画布)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"></path><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"></path><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"></path><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"></path></svg>
          </button>
          <button 
            class="dock-btn" 
            :class="{ active: toolMode === 'pointer' }" 
            @click="toolMode = 'pointer'"
            title="指针选择"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 3 10.07 19.97 12.58 12.58 19.97 10.07 3 3"></polygon></svg>
          </button>
        </div>

        <div class="dock-divider"></div>

        <!-- 缩放控制栏 -->
        <div class="dock-group zoom-group">
          <button class="dock-btn" @click="zoomOut" title="缩小画布">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
          <span class="zoom-value" @click="resetZoom" title="点击还原 100%">{{ Math.round(scale * 100) }}%</span>
          <button class="dock-btn" @click="zoomIn" title="放大画布">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
        </div>

        <div class="dock-divider"></div>

        <!-- 视图与整理操作 -->
        <div class="dock-group">
          <!-- 视角重置居中 -->
          <button class="dock-btn" @click="fitView" title="聚焦配置中心">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
          </button>

          <!-- 自动整齐排布节点 -->
          <button class="dock-btn" @click="autoOrganizeNodes" title="自动排版对齐">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          </button>

          <!-- 清空当前画布节点 -->
          <button class="dock-btn danger" @click="clearCanvasNodes" title="清空画布内容 (历史记录仍保留在成果画廊中)">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue';

const props = defineProps({
  isGenerating: Boolean,
  currentSettings: Object,
  historyItems: Array
});

const emit = defineEmits(['generate', 'preview', 'show-toast', 'update-settings']);

const viewportRef = ref(null);

// 画布视口平移与缩放
const panX = ref(150);
const panY = ref(100);
const scale = ref(0.9);
const toolMode = ref('grab'); // 'grab' | 'pointer'
const isPanning = ref(false);
const startPanX = ref(0);
const startPanY = ref(0);

// 选中的节点与提示词气泡弹层状态
const selectedNodeId = ref(null);
const activePromptNodeId = ref(null);
const copiedPromptNodeId = ref(null);

// 拖拽节点状态
let draggingNode = null;
let dragStartX = 0;
let dragStartY = 0;
let nodeOrigX = 0;
let nodeOrigY = 0;

// 配置中心主节点（支持多张参考图，最多16张，符合 OpenAI 官方规范）
const configNode = reactive({
  id: 'config-center',
  x: 100,
  y: 120,
  prompt: '',
  refImages: [], // 数组：[{ id, url, name, parentId }]
  parentImageId: null // 兼容字段
});

// 创作配置中心真实 DOM 引用与动态尺寸测量 (解决视频中创作窗口大小改变但节点连接判定原大小的缺陷)
const configNodeEl = ref(null);
const configRealWidth = ref(440);
const configRealHeight = ref(360);
const hoveredNodeId = ref(null);

// 记录最新生成的节点ID与血统小方框列表
const recentGeneratedNodeId = ref(null);
const derivationPipelines = ref([]);
const activePipelineId = ref(null);
const copiedPipeId = ref(null);
const hoveredPipelineId = ref(null);

// 判断当前是否有活跃的参考图组合
const isAnyRefActive = computed(() => {
  return configNode.refImages && configNode.refImages.length > 0;
});

// 计算卡片动态总高度（精确对准卡片右侧中点 handle 坐标）
const getNodeHeight = (node) => {
  const w = (node.width || 280) - 20;
  let imgH = w;
  if (node.ratio === '16:9') imgH = Math.round(w * 9 / 16);
  else if (node.ratio === '9:16') imgH = Math.round(w * 16 / 9);
  let extraH = 56;
  if (node.isRecentGenerated) extraH += 32;
  return imgH + extraH;
};

// 判断节点是否在参考组合中
const isNodeInRefImages = (nodeId) => {
  return configNode.refImages && configNode.refImages.some(img => img.id === nodeId || img.parentId === nodeId);
};

// 获取节点在参考组合中的序号 (Image 1, Image 2...)
const getRefIndex = (nodeId) => {
  if (!configNode.refImages) return '';
  const idx = configNode.refImages.findIndex(img => img.id === nodeId || img.parentId === nodeId);
  return idx !== -1 ? idx + 1 : '';
};

// 移出单个参考图
const removeNodeFromRefImages = (nodeId) => {
  if (configNode.refImages) {
    configNode.refImages = configNode.refImages.filter(img => img.id !== nodeId && img.parentId !== nodeId);
    if (configNode.refImages.length === 0) {
      configNode.parentImageId = null;
    } else if (configNode.parentImageId === nodeId) {
      configNode.parentImageId = configNode.refImages[0].parentId || configNode.refImages[0].id || null;
    }
    emit('show-toast', { message: `已移出参考图 (剩余 ${configNode.refImages.length} 张)`, type: 'info' });
  }
};

// 切换节点在参考组合中的选中状态 (加入 / 移除)
const toggleNodeInRefImages = (node) => {
  if (!configNode.refImages) configNode.refImages = [];
  const existingIdx = configNode.refImages.findIndex(img => img.id === node.id || img.parentId === node.id);
  
  if (existingIdx !== -1) {
    removeNodeFromRefImages(node.id);
  } else {
    if (configNode.refImages.length >= 16) {
      emit('show-toast', { message: '已达到 OpenAI 规范上限：单次生图最多支持 16 张参考图', type: 'error' });
      return;
    }
    // 用户规则：当选择一张图为参考图时，如果是首张参考图，清除提示词输入框文本！
    if (configNode.refImages.length === 0) {
      configNode.prompt = '';
      configNode.parentImageId = node.id;
    }
    configNode.refImages.push({
      id: node.id,
      url: node.url,
      name: `Image ${configNode.refImages.length + 1}`,
      parentId: node.id
    });
    emit('show-toast', { 
      message: `已设为 [Image ${configNode.refImages.length}] 参考图${configNode.refImages.length === 1 ? ' (提示词已清空)' : ''}`, 
      type: 'success' 
    });
  }
};

// 核心功能：以此图作为唯一基准衍生（清空其他组合与提示词）
const setAsSoleReference = (node) => {
  configNode.refImages = [{
    id: node.id,
    url: node.url,
    name: 'Image 1',
    parentId: node.id
  }];
  configNode.parentImageId = node.id;
  configNode.prompt = ''; // 按用户要求清空
  emit('show-toast', { message: '已设为唯一基准参考（提示词已清空，可输入新构想）', type: 'success' });
};

// 核心功能：将生成的图独立出去 (断开与创作框的连线，固化为提示词血统小方框，创作中心同时独立)
const separateGeneratedNode = (nodeId) => {
  const node = imageNodes.value.find(n => n.id === nodeId);
  if (!node) return;

  node.isRecentGenerated = false;
  if (recentGeneratedNodeId.value === nodeId) {
    recentGeneratedNodeId.value = null;
  }

  // 如果生成时使用了参考图，为其建立血统小方框
  const parentIds = Array.isArray(node.sourceRefIds) ? node.sourceRefIds : [];
  if (parentIds.length > 0) {
    const parentNodes = imageNodes.value.filter(n => parentIds.includes(n.id));
    let refAvgX = configNode.x - 80;
    let refAvgY = configNode.y;
    if (parentNodes.length > 0) {
      refAvgX = parentNodes.reduce((sum, p) => sum + (p.x + (p.width || 280)), 0) / parentNodes.length;
      refAvgY = parentNodes.reduce((sum, p) => sum + (p.y + Math.round(getNodeHeight(p) / 2)), 0) / parentNodes.length;
    }
    const childCenterX = node.x;
    const childCenterY = node.y + Math.round(getNodeHeight(node) / 2);

    const boxX = Math.round((refAvgX + childCenterX) / 2 - 20);
    const boxY = Math.round((refAvgY + childCenterY) / 2 - 16);

    const pipeline = {
      id: 'pipe_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      parentIds: [...parentIds],
      childId: node.id,
      prompt: node.sourcePrompt || node.prompt || '',
      model: node.sourceModel || node.model || 'GPT-Image',
      ratio: node.sourceRatio || node.ratio || '1:1',
      createdAt: node.generatedAt || new Date().toLocaleTimeString(),
      x: boxX,
      y: boxY
    };
    derivationPipelines.value.push(pipeline);
  }

  // 创作中心同时独立，原本连接到四周的参考线全部清除
  configNode.refImages = [];
  configNode.parentImageId = null;

  emit('show-toast', { 
    message: parentIds.length > 0 ? '已确立为独立分支，并建立提示词血统节点！' : '图片已独立，创作中心已就绪！', 
    type: 'success' 
  });
};

// 提示词小方框交互
const togglePipelineDetail = (pipeId) => {
  activePipelineId.value = activePipelineId.value === pipeId ? null : pipeId;
};

const copyPipelinePrompt = (text, pipeId) => {
  navigator.clipboard.writeText(text).then(() => {
    copiedPipeId.value = pipeId;
    setTimeout(() => { copiedPipeId.value = null; }, 2000);
    emit('show-toast', { message: '衍生提示词已复制！', type: 'success' });
  });
};

const reusePipelinePrompt = (text) => {
  configNode.prompt = text;
  activePipelineId.value = null;
  emit('show-toast', { message: '提示词已填入创作中心', type: 'info' });
};

// 小方框拖拽
let draggingPipe = null;
let pipeDragStartX = 0;
let pipeDragStartY = 0;
let pipeOrigX = 0;
let pipeOrigY = 0;

const startPipeDrag = (e, pipe) => {
  if (e.button !== 0) return;
  draggingPipe = pipe;
  pipeDragStartX = e.clientX;
  pipeDragStartY = e.clientY;
  pipeOrigX = pipe.x;
  pipeOrigY = pipe.y;
  window.addEventListener('mousemove', onPipeMouseMove);
  window.addEventListener('mouseup', onPipeMouseUp);
};

const onPipeMouseMove = (e) => {
  if (draggingPipe) {
    const dx = (e.clientX - pipeDragStartX) / scale.value;
    const dy = (e.clientY - pipeDragStartY) / scale.value;
    draggingPipe.x = Math.round(pipeOrigX + dx);
    draggingPipe.y = Math.round(pipeOrigY + dy);
  }
};

const onPipeMouseUp = () => {
  draggingPipe = null;
  window.removeEventListener('mousemove', onPipeMouseMove);
  window.removeEventListener('mouseup', onPipeMouseUp);
};

// 切换提示词气泡展开/收起
const togglePromptPopover = (nodeId) => {
  activePromptNodeId.value = activePromptNodeId.value === nodeId ? null : nodeId;
};

// 复制提示词并提示反馈
const copyPromptText = (text, nodeId) => {
  navigator.clipboard.writeText(text).then(() => {
    copiedPromptNodeId.value = nodeId;
    setTimeout(() => {
      copiedPromptNodeId.value = null;
    }, 2000);
    emit('show-toast', { message: '提示词已成功复制到剪贴板！', type: 'success' });
  });
};

// 画布上的图片节点数组
const imageNodes = ref([]);

// 视口变换样式
const worldTransformStyle = computed(() => {
  return {
    transform: `translate3d(${panX.value}px, ${panY.value}px, 0) scale(${scale.value})`
  };
});

// 背景网格随平移与缩放动态平铺
const gridBackgroundStyle = computed(() => {
  const gridSize = 32 * scale.value;
  return {
    backgroundSize: `${gridSize}px ${gridSize}px`,
    backgroundPosition: `${panX.value}px ${panY.value}px`
  };
});

// 核心算法：计算从中心 A 射向中心 B 的射线与矩形 A 真实边界的连续平滑交点及向外法向量
// 彻底消灭原有的硬编码 4 方向离散阶跃，模拟真实物理张力，支持 360 度任意旋转与平滑沿边缘滑动
const getRayRectangleIntersection = (rectA, rectB) => {
  const cxA = rectA.x + rectA.w / 2;
  const cyA = rectA.y + rectA.h / 2;
  const cxB = rectB.x + rectB.w / 2;
  const cyB = rectB.y + rectB.h / 2;

  const dx = cxB - cxA;
  const dy = cyB - cyA;

  const hw = rectA.w / 2;
  const hh = rectA.h / 2;

  if (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4) {
    return { x: cxA + hw, y: cyA, nx: 1, ny: 0 };
  }

  const sx = Math.abs(dx) > 1e-4 ? hw / Math.abs(dx) : Infinity;
  const sy = Math.abs(dy) > 1e-4 ? hh / Math.abs(dy) : Infinity;
  const t = Math.min(sx, sy);

  const x = cxA + t * dx;
  const y = cyA + t * dy;

  let nx = 0;
  let ny = 0;
  const diff = Math.abs(sx - sy);
  // 转角处平滑插值过渡，消除突变
  if (diff < 0.08) {
    nx = (dx > 0 ? 1 : -1) * 0.7071;
    ny = (dy > 0 ? 1 : -1) * 0.7071;
  } else if (sx < sy) {
    nx = dx > 0 ? 1 : -1;
    ny = 0;
  } else {
    nx = 0;
    ny = dy > 0 ? 1 : -1;
  }

  return { 
    x: Math.round(x * 10) / 10, 
    y: Math.round(y * 10) / 10, 
    nx, 
    ny 
  };
};

// 计算两个矩形之间的物理贝塞尔曲线与两端端点
const calculateSmartConnector = (rectFrom, rectTo) => {
  const ptFrom = getRayRectangleIntersection(rectFrom, rectTo);
  const ptTo = getRayRectangleIntersection(rectTo, rectFrom);

  const dist = Math.hypot(ptTo.x - ptFrom.x, ptTo.y - ptFrom.y);
  // 物理张力根据两端距离动态自适应：拉近时更圆润，拉远时张力拉直
  const tension = Math.min(150, Math.max(32, dist * 0.34));

  const c1x = Math.round((ptFrom.x + ptFrom.nx * tension) * 10) / 10;
  const c1y = Math.round((ptFrom.y + ptFrom.ny * tension) * 10) / 10;
  const c2x = Math.round((ptTo.x + ptTo.nx * tension) * 10) / 10;
  const c2y = Math.round((ptTo.y + ptTo.ny * tension) * 10) / 10;

  const path = `M ${ptFrom.x} ${ptFrom.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${ptTo.x} ${ptTo.y}`;

  return {
    fromX: ptFrom.x,
    fromY: ptFrom.y,
    toX: ptTo.x,
    toY: ptTo.y,
    path
  };
};

// 计算所有活跃的连接线（四周无缝连续物理滑动 + 创作窗口实时实际大小对齐 + 交叉分层）
const activeLinks = computed(() => {
  const links = [];
  // 实时采用创作中心的真实 DOM 测量高宽，绝不使用死值
  const W_c = configRealWidth.value || 440;
  const H_c = configRealHeight.value || 360;

  const rectConfig = {
    x: configNode.x,
    y: configNode.y,
    w: W_c,
    h: H_c
  };

  // 1. 汇入创作配置中心的参考图连线
  if (configNode.refImages && configNode.refImages.length > 0) {
    const parentNodes = [];
    configNode.refImages.forEach(refItem => {
      const pid = refItem.parentId || refItem.id;
      if (pid) {
        const parent = imageNodes.value.find(n => n.id === pid);
        if (parent && !parentNodes.some(item => item.id === parent.id)) {
          parentNodes.push(parent);
        }
      }
    });

    parentNodes.forEach(parent => {
      const cardW = parent.width || 280;
      const cardH = getNodeHeight(parent);
      const rectCard = {
        x: parent.x,
        y: parent.y,
        w: cardW,
        h: cardH
      };

      // 实时计算平滑边界滑动连接
      const conn = calculateSmartConnector(rectCard, rectConfig);

      links.push({
        id: `ref-link-${parent.id}`,
        type: 'reference',
        stroke: 'url(#linkGradient)',
        strokeWidth: 2.2,
        fromX: conn.fromX,
        fromY: conn.fromY,
        toX: conn.toX,
        toY: conn.toY,
        path: conn.path
      });
    });
  }

  // 2. 最新生成图的高亮输出连线 (创作配置中心 -> 新图)
  if (recentGeneratedNodeId.value) {
    const recentNode = imageNodes.value.find(n => n.id === recentGeneratedNodeId.value);
    if (recentNode && recentNode.isRecentGenerated) {
      const rectRecent = {
        x: recentNode.x,
        y: recentNode.y,
        w: recentNode.width || 280,
        h: getNodeHeight(recentNode)
      };
      const conn = calculateSmartConnector(rectConfig, rectRecent);

      links.push({
        id: `recent-output-${recentNode.id}`,
        type: 'recent-output',
        stroke: 'url(#recentOutputGradient)',
        strokeWidth: 2.8,
        filter: 'url(#glowRecent)',
        fromX: conn.fromX,
        fromY: conn.fromY,
        toX: conn.toX,
        toY: conn.toY,
        path: conn.path
      });
    }
  }

  // 3. 提示词血统小方框连线 (参考图 -> 小方框 -> 生成图)
  derivationPipelines.value.forEach(pipe => {
    const child = imageNodes.value.find(n => n.id === pipe.childId);
    if (!child) return;

    const rectPipe = {
      x: pipe.x,
      y: pipe.y,
      w: 42,
      h: 42
    };

    // 参考图 -> 小方框
    pipe.parentIds.forEach((pid, pIdx) => {
      const parent = imageNodes.value.find(n => n.id === pid);
      if (parent) {
        const rectParent = {
          x: parent.x,
          y: parent.y,
          w: parent.width || 280,
          h: getNodeHeight(parent)
        };
        const conn = calculateSmartConnector(rectParent, rectPipe);
        links.push({
          id: `pipe-in-${pipe.id}-${pid}-${pIdx}`,
          type: 'heritage',
          pipelineId: pipe.id,
          stroke: 'url(#heritageGradient)',
          strokeWidth: 2,
          fromX: conn.fromX,
          fromY: conn.fromY,
          toX: conn.toX,
          toY: conn.toY,
          path: conn.path
        });
      }
    });

    // 小方框 -> 生成图
    const rectChild = {
      x: child.x,
      y: child.y,
      w: child.width || 280,
      h: getNodeHeight(child)
    };
    const connOut = calculateSmartConnector(rectPipe, rectChild);
    links.push({
      id: `pipe-out-${pipe.id}-${child.id}`,
      type: 'heritage',
      pipelineId: pipe.id,
      stroke: 'url(#heritageGradient)',
      strokeWidth: 2,
      fromX: connOut.fromX,
      fromY: connOut.fromY,
      toX: connOut.toX,
      toY: connOut.toY,
      path: connOut.path
    });
  });

  return links;
});

// 平移画布开始
const onViewportMouseDown = (e) => {
  const target = e.target;
  // 如果点击的目标是输入框、可滚动区域或其交互控件，严禁触发画布漫游，保证正常的文字选择与滑动
  if (
    target &&
    (target.tagName === 'TEXTAREA' ||
      target.tagName === 'INPUT' ||
      target.closest('textarea') ||
      target.closest('.node-prompt-input') ||
      target.closest('.ref-thumbnails-list'))
  ) {
    return;
  }

  // 如果当前有运镜动画在进行，用户主动点击立即取消动画
  if (viewportAnimId) { cancelAnimationFrame(viewportAnimId); viewportAnimId = null; }

  // 如果是鼠标中键或者当前为抓手模式，且不是右键
  if (e.button === 1 || (e.button === 0 && toolMode.value === 'grab')) {
    isPanning.value = true;
    startPanX.value = e.clientX - panX.value;
    startPanY.value = e.clientY - panY.value;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }
};

// 性能调度器：利用 requestAnimationFrame 节流鼠标高频位移，保证 60/120fps 丝滑响应且不浪费 CPU
let dragRafId = null;
let pendingPanX = null;
let pendingPanY = null;
let pendingNode = null;
let pendingNodeX = null;
let pendingNodeY = null;

const flushMouseDrag = () => {
  dragRafId = null;
  if (pendingPanX !== null && pendingPanY !== null) {
    panX.value = pendingPanX;
    panY.value = pendingPanY;
    pendingPanX = null;
    pendingPanY = null;
  }
  if (pendingNode && pendingNodeX !== null && pendingNodeY !== null) {
    pendingNode.x = pendingNodeX;
    pendingNode.y = pendingNodeY;
    pendingNode = null;
    pendingNodeX = null;
    pendingNodeY = null;
  }
};

const onMouseMove = (e) => {
  if (isPanning.value) {
    pendingPanX = e.clientX - startPanX.value;
    pendingPanY = e.clientY - startPanY.value;
    if (!dragRafId) {
      dragRafId = requestAnimationFrame(flushMouseDrag);
    }
  } else if (draggingNode) {
    const dx = (e.clientX - dragStartX) / scale.value;
    const dy = (e.clientY - dragStartY) / scale.value;
    pendingNode = draggingNode;
    pendingNodeX = Math.round(nodeOrigX + dx);
    pendingNodeY = Math.round(nodeOrigY + dy);
    if (!dragRafId) {
      dragRafId = requestAnimationFrame(flushMouseDrag);
    }
  }
};

const onMouseUp = () => {
  if (dragRafId) {
    cancelAnimationFrame(dragRafId);
    dragRafId = null;
  }
  flushMouseDrag();
  isPanning.value = false;
  draggingNode = null;
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
};

// 滚轮缩放控制
const onWheel = (e) => {
  const target = e.target;
  // 防御性隔离：如果在输入框、下拉框或局部滚动区域滚动，放行原生滚动，坚决不劫持画布缩放
  if (
    target &&
    (target.tagName === 'TEXTAREA' ||
      target.tagName === 'INPUT' ||
      target.closest('textarea') ||
      target.closest('.node-prompt-input') ||
      target.closest('.ref-thumbnails-list') ||
      target.closest('.node-prompt-callout'))
  ) {
    return;
  }

  e.preventDefault();
  if (viewportAnimId) { cancelAnimationFrame(viewportAnimId); viewportAnimId = null; }

  const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
  const newScale = Math.max(0.2, Math.min(2.5, scale.value * zoomFactor));

  // 以鼠标为原点缩放
  if (viewportRef.value) {
    const rect = viewportRef.value.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    panX.value = mouseX - (mouseX - panX.value) * (newScale / scale.value);
    panY.value = mouseY - (mouseY - panY.value) * (newScale / scale.value);
  }

  scale.value = newScale;
};

// 节点拖拽
const startNodeDrag = (e, node) => {
  if (e.button !== 0) return;
  const target = e.target;
  // 如果点击的目标是输入框、按钮或交互组件，不要触发节点整体拖拽，保证光标选取与拖拽滚动
  if (
    target &&
    (target.tagName === 'TEXTAREA' ||
      target.tagName === 'INPUT' ||
      target.closest('textarea') ||
      target.closest('.node-prompt-input') ||
      target.closest('.ref-thumbnails-list') ||
      target.closest('.node-actions') ||
      target.closest('.quick-ref-pills'))
  ) {
    return;
  }

  if (nodeAnimId) { cancelAnimationFrame(nodeAnimId); nodeAnimId = null; }
  selectedNodeId.value = node.id;
  draggingNode = node;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  nodeOrigX = node.x;
  nodeOrigY = node.y;
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
};

// 缩放操作
const zoomIn = () => {
  scale.value = Math.min(2.5, scale.value * 1.15);
};
const zoomOut = () => {
  scale.value = Math.max(0.2, scale.value * 0.85);
};
const resetZoom = () => {
  scale.value = 1.0;
};
// 动画调度引擎：提供专业级丝滑柔和的过渡曲线
let viewportAnimId = null;
let nodeAnimId = null;

// 三次贝塞尔缓动：启动平滑柔和，定格优雅自然
const easeInOutCubic = (t) => {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

// 视口平滑运镜动画 (480ms 柔和镜头过渡)
const animateViewportSmooth = (targetX, targetY, targetScale, duration = 480, onComplete = null) => {
  if (viewportAnimId) cancelAnimationFrame(viewportAnimId);

  const startX = panX.value;
  const startY = panY.value;
  const startScale = scale.value;
  const startTime = performance.now();

  const frame = (now) => {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    const ease = easeInOutCubic(progress);

    panX.value = Math.round(startX + (targetX - startX) * ease);
    panY.value = Math.round(startY + (targetY - startY) * ease);
    scale.value = Number((startScale + (targetScale - startScale) * ease).toFixed(4));

    if (progress < 1) {
      viewportAnimId = requestAnimationFrame(frame);
    } else {
      viewportAnimId = null;
      if (onComplete) onComplete();
    }
  };

  viewportAnimId = requestAnimationFrame(frame);
};

// 多节点协同平滑移动动画 (520ms 柔和位移过渡，连线动态跟随)
const animateNodesSmooth = (nodeMoveList, duration = 520, onComplete = null) => {
  if (nodeAnimId) cancelAnimationFrame(nodeAnimId);

  const startTime = performance.now();

  const frame = (now) => {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    const ease = easeInOutCubic(progress);

    nodeMoveList.forEach(item => {
      item.node.x = Math.round(item.startX + (item.targetX - item.startX) * ease);
      item.node.y = Math.round(item.startY + (item.targetY - item.startY) * ease);
    });

    if (progress < 1) {
      nodeAnimId = requestAnimationFrame(frame);
    } else {
      nodeAnimId = null;
      if (onComplete) onComplete();
    }
  };

  nodeAnimId = requestAnimationFrame(frame);
};

// 视角重置：平滑柔和地对焦至创作配置中心卡片
const fitView = () => {
  if (!viewportRef.value) return;
  const vRect = viewportRef.value.getBoundingClientRect();
  const targetScale = 0.95;
  
  // 创作框宽 432px，高约 260px，中心点 (configNode.x + 216, configNode.y + 130)
  const nodeCenterX = configNode.x + 216;
  const nodeCenterY = configNode.y + 130;
  
  const targetPanX = Math.round(vRect.width / 2 - nodeCenterX * targetScale);
  const targetPanY = Math.round(vRect.height / 2 - nodeCenterY * targetScale);
  
  animateViewportSmooth(targetPanX, targetPanY, targetScale, 480);
  emit('show-toast', { message: '视角已平滑聚焦至创作配置中心', type: 'info' });
};

// 触发生成事件 (支持多图与单图数组传递)
const triggerGenerate = () => {
  if (!configNode.prompt.trim() || props.isGenerating) return;

  const refImagesUrls = (configNode.refImages || []).map(img => img.url);
  const parentIds = (configNode.refImages || []).filter(img => img.parentId).map(img => img.parentId);

  emit('generate', {
    prompt: configNode.prompt.trim(),
    model: props.currentSettings?.model || 'gpt-image-2.5-flare',
    ratio: props.currentSettings?.ratio || '1:1',
    refImage: refImagesUrls[0] || null, // 保持向后兼容
    refImages: refImagesUrls,           // 新增多图列表
    parentId: parentIds[0] || null,     // 保持向后兼容
    parentIds: parentIds                // 多个父级 ID 列表
  });
};

// 本地参考图上传 (支持一次多选，上限 16 张，自动前端画布降采样压缩)
const handleLocalRefUpload = (e) => {
  const files = Array.from(e.target.files || []);
  if (files.length === 0) return;

  if (!configNode.refImages) configNode.refImages = [];

  const availableSlots = 16 - configNode.refImages.length;
  if (availableSlots <= 0) {
    emit('show-toast', { message: '参考图数量已达上限 (单次最多 16 张)', type: 'error' });
    e.target.value = '';
    return;
  }

  const filesToProcess = files.slice(0, availableSlots);
  let processedCount = 0;

  filesToProcess.forEach(file => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const max_dim = 1536;

        if (width > max_dim || height > max_dim) {
          if (width > height) {
            height = Math.round((height * max_dim) / width);
            width = max_dim;
          } else {
            width = Math.round((width * max_dim) / height);
            height = max_dim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/png');
        configNode.refImages.push({
          id: 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          url: compressedDataUrl,
          name: `Image ${configNode.refImages.length + 1}`,
          parentId: null
        });

        processedCount++;
        if (processedCount === filesToProcess.length) {
          emit('show-toast', { 
            message: `成功载入 ${filesToProcess.length} 张本地参考图 (当前共 ${configNode.refImages.length}/16 张)`, 
            type: 'info' 
          });
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  e.target.value = '';
};

// 移除单个参考图
const removeRefImage = (index) => {
  if (configNode.refImages) {
    const removed = configNode.refImages.splice(index, 1)[0];
    if (configNode.refImages.length === 0) {
      configNode.parentImageId = null;
    } else if (removed && configNode.parentImageId === (removed.parentId || removed.id)) {
      configNode.parentImageId = configNode.refImages[0].parentId || configNode.refImages[0].id || null;
    }
    emit('show-toast', { message: `已移出参考图 (剩余 ${configNode.refImages.length} 张)`, type: 'info' });
  }
};

// 清空全部参考图 (恢复为纯独立文生图)
const clearConfigRefImages = () => {
  configNode.refImages = [];
  configNode.parentImageId = null;
  emit('show-toast', { message: '已清空参考组合，图片已独立，切换为纯文生图', type: 'info' });
};

// 快捷向提示词注入 [Image N] 引用
const insertImageRefToPrompt = (imageIndex) => {
  const refTag = `Image ${imageIndex}`;
  if (!configNode.prompt.includes(refTag)) {
    if (configNode.prompt.trim().length > 0) {
      configNode.prompt += `，融合 ${refTag} 的视觉特征`;
    } else {
      configNode.prompt = `以 ${refTag} 为主要参考，`;
    }
  } else {
    configNode.prompt += ` ${refTag}`;
  }
  emit('show-toast', { message: `已在提示词插入 [${refTag}] 引用`, type: 'info' });
};

// 插入典型多图融合提示词模版
const insertBlendTemplate = () => {
  const count = configNode.refImages?.length || 0;
  let template = '';
  if (count === 2) {
    template = '\n将 Image 1 的构图与主体角色，与 Image 2 的艺术画风、材质纹理完美融合。';
  } else if (count >= 3) {
    template = '\n以 Image 1 作为主体人物，融合 Image 2 的服装与材质，置于 Image 3 展现的场景光影中。';
  } else {
    template = '\n参考 Image 1 的视觉细节进行高质量衍生优化。';
  }
  configNode.prompt = (configNode.prompt.trim() + template).trim();
  emit('show-toast', { message: '已填充多图融合提示词模版！', type: 'success' });
};

// 核心功能：以此图作为独立基准衍生（调用 setAsSoleReference）
const branchFromImage = (node) => {
  setAsSoleReference(node);
};

// 将画面的 Prompt 拷贝到配置框
const copyPromptToConfig = (prompt) => {
  configNode.prompt = prompt;
  emit('show-toast', { message: '提示词已填入创作配置中心', type: 'info' });
};

// 下载图片
const downloadImage = (node) => {
  const link = document.createElement('a');
  link.href = node.url;
  link.download = `canvas_image_${node.id}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// 从画布移除节点 (同步清理参考组、血统小方框及生成高亮状态)
const removeNodeFromCanvas = (id) => {
  imageNodes.value = imageNodes.value.filter(n => n.id !== id);
  // 深度同步：若该节点在创作中心的参考组中，立即同步移除
  if (configNode.refImages) {
    configNode.refImages = configNode.refImages.filter(img => img.id !== id && img.parentId !== id);
    if (configNode.refImages.length === 0) {
      configNode.parentImageId = null;
    }
  }
  if (configNode.parentImageId === id) {
    configNode.parentImageId = null;
  }
  // 清理涉及该节点的衍生记录
  derivationPipelines.value = derivationPipelines.value.filter(p => p.childId !== id && !p.parentIds.includes(id));
  if (recentGeneratedNodeId.value === id) {
    recentGeneratedNodeId.value = null;
  }
  emit('show-toast', { message: '已从画布中移除该卡片', type: 'info' });
};

// 清空当前画布
const clearCanvasNodes = () => {
  imageNodes.value = [];
  configNode.refImages = [];
  configNode.parentImageId = null;
  activePromptNodeId.value = null;
  recentGeneratedNodeId.value = null;
  derivationPipelines.value = [];
  emit('show-toast', { message: '画布已重置清空', type: 'info' });
};

// 自适应聚焦一组节点，确保其全部纳入当前屏幕视野中心 (不被遮挡)
const fitNodesInView = (nodes) => {
  if (!viewportRef.value || !nodes || nodes.length === 0) {
    fitView();
    return;
  }
  const vRect = viewportRef.value.getBoundingClientRect();
  const vW = vRect.width;
  const vH = vRect.height;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(n => {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + (n.w || 280));
    maxY = Math.max(maxY, n.y + (n.h || 330));
  });

  const pad = 90;
  const totalW = Math.max(100, maxX - minX);
  const totalH = Math.max(100, maxY - minY);

  const targetScale = Math.min(0.95, Math.max(0.3, Math.min((vW - pad * 2) / totalW, (vH - pad * 2) / totalH)));
  const boxCenterX = (minX + maxX) / 2;
  const boxCenterY = (minY + maxY) / 2;

  const targetPanX = Math.round(vW / 2 - boxCenterX * targetScale);
  const targetPanY = Math.round(vH / 2 - boxCenterY * targetScale);

  animateViewportSmooth(targetPanX, targetPanY, targetScale, 480);
};

// 自动排版对齐：四张图排成一列为最大限度，超过4张采用多列紧凑布局，原则是参与参考图尽可能在页面视野内，不被遮挡
const autoOrganizeNodes = () => {
  const CARD_WIDTH = 280;
  const CARD_HEIGHT = 330;
  const ROW_GAP = 28;
  const COL_GAP = 90;
  const MAX_PER_COL = 4; // 铁律规则：四张图排成一列已经是最大限度！

  const configW = configRealWidth.value || 440;
  const configH = configRealHeight.value || 360;

  if (imageNodes.value.length === 0) {
    animateNodesSmooth([
      { node: configNode, startX: configNode.x, startY: configNode.y, targetX: 100, targetY: 100 }
    ], 450, () => fitView());
    emit('show-toast', { message: '创作卡片已就位', type: 'info' });
    return;
  }

  const targetsMap = new Map();
  const allNodes = imageNodes.value;
  const nodeMap = new Map();
  allNodes.forEach(n => nodeMap.set(n.id, n));

  // 1. 优先提取当前配置中心引用的所有参考图
  const refNodeIds = [];
  if (configNode.refImages && configNode.refImages.length > 0) {
    configNode.refImages.forEach(refItem => {
      const targetId = refItem.parentId || refItem.id;
      if (targetId && nodeMap.has(targetId) && !refNodeIds.includes(targetId)) {
        refNodeIds.push(targetId);
      }
    });
  } else if (configNode.parentImageId && nodeMap.has(configNode.parentImageId)) {
    refNodeIds.push(configNode.parentImageId);
  }

  const totalRefs = refNodeIds.length;
  let configTargetX = 400;
  let configTargetY = 200;

  if (totalRefs > 0) {
    // 列数计算：每列最多 4 张
    const numCols = Math.ceil(totalRefs / MAX_PER_COL);
    // 均衡分配每列数量，使得各列垂直高度最小化，最大限度保留在视口内
    const itemsPerCol = Math.ceil(totalRefs / numCols);

    const maxItemsInCol = Math.min(MAX_PER_COL, itemsPerCol);
    const refColHeight = maxItemsInCol * CARD_HEIGHT + (maxItemsInCol - 1) * ROW_GAP;
    
    // 让创作中心在垂直方向居中对齐参考图区域
    configTargetY = Math.max(80, Math.round((refColHeight - configH) / 2 + 80));
    // 创作中心的 X 坐标：放在所有参考图列的右侧
    const totalRefWidth = numCols * CARD_WIDTH + (numCols - 1) * COL_GAP;
    configTargetX = 80 + totalRefWidth + COL_GAP;

    // 排布参考图各列（紧挨创作中心的是第 0 列，再往左是第 1 列）
    let currentRefIdx = 0;
    for (let c = 0; c < numCols; c++) {
      const colX = configTargetX - COL_GAP - (c + 1) * CARD_WIDTH - c * COL_GAP;
      const countInThisCol = Math.min(itemsPerCol, totalRefs - currentRefIdx);
      const thisColHeight = countInThisCol * CARD_HEIGHT + (countInThisCol - 1) * ROW_GAP;
      let startY = 80 + Math.round((refColHeight - thisColHeight) / 2);

      for (let r = 0; r < countInThisCol; r++) {
        const id = refNodeIds[currentRefIdx++];
        targetsMap.set(id, { x: colX, y: startY });
        startY += CARD_HEIGHT + ROW_GAP;
      }
    }
  } else {
    configTargetX = 100;
    configTargetY = 100;
  }

  // 2. 收集非参考图（下游衍生图或未绑定图），排布在创作中心的右侧
  const remainingNodes = allNodes.filter(n => !refNodeIds.includes(n.id));
  if (remainingNodes.length > 0) {
    const rightStartX = configTargetX + configW + COL_GAP;
    remainingNodes.forEach((node, idx) => {
      const col = Math.floor(idx / 3);
      const row = idx % 3;
      const x = rightStartX + col * (CARD_WIDTH + 60);
      const y = 80 + row * (CARD_HEIGHT + ROW_GAP);
      targetsMap.set(node.id, { x, y });
    });
  }

  // 3. 构建全部节点的平滑移动任务列表
  const moveList = [];
  moveList.push({
    node: configNode,
    startX: configNode.x,
    startY: configNode.y,
    targetX: configTargetX,
    targetY: configTargetY
  });

  allNodes.forEach(n => {
    const target = targetsMap.get(n.id);
    if (target) {
      moveList.push({
        node: n,
        startX: n.x,
        startY: n.y,
        targetX: target.x,
        targetY: target.y
      });
    }
  });

  // 柔和启动 520ms 平滑多节点排版动画，并在动画完成后自适应镜头包围盒
  animateNodesSmooth(moveList, 520, () => {
    fitNodesInView(moveList.map(m => ({ 
      x: m.targetX, 
      y: m.targetY, 
      w: m.node === configNode ? configW : CARD_WIDTH, 
      h: m.node === configNode ? configH : CARD_HEIGHT 
    })));
  });

  emit('show-toast', { 
    message: totalRefs > 4 
      ? `已自适应为双列智能排布（单列4张上限生效），所有参考图均在视野内呈现` 
      : '已按一列居中自动重排参考图', 
    type: 'info' 
  });
};

// 监听新的生成图片，推送到画布中呈现
const addGeneratedImageToCanvas = (record, parentIds = null, offsetIndex = 0) => {
  let parents = [];
  if (Array.isArray(parentIds)) {
    parents = parentIds;
  } else if (parentIds) {
    parents = [parentIds];
  } else if (Array.isArray(record.parentIds)) {
    parents = record.parentIds;
  } else if (record.parentId) {
    parents = [record.parentId];
  }

  let targetX = configNode.x + (configRealWidth.value || 440) + 70;
  let targetY = configNode.y;

  if (parents.length > 0) {
    const parentNodes = imageNodes.value.filter(n => parents.includes(n.id));
    if (parentNodes.length > 0) {
      const maxX = Math.max(...parentNodes.map(p => p.x + (p.width || 280)));
      targetX = maxX + 120;
      const avgY = Math.round(parentNodes.reduce((sum, p) => sum + p.y, 0) / parentNodes.length);
      targetY = avgY;
    }
  }

  const existingCount = imageNodes.value.filter(n => Math.abs(n.x - targetX) < 80).length;
  targetY += existingCount * 120 + (offsetIndex * 35);
  targetX += (offsetIndex * 25);

  const newNode = {
    id: record.id,
    url: record.url,
    prompt: record.prompt,
    model: record.model,
    ratio: record.ratio || '1:1',
    width: 290,
    x: targetX,
    y: targetY,
    parentId: parents[0] || null,
    parentIds: parents,
    isRecentGenerated: true,
    sourceRefIds: [...parents],
    sourcePrompt: record.prompt,
    sourceModel: record.model,
    sourceRatio: record.ratio || '1:1',
    generatedAt: new Date().toLocaleTimeString()
  };

  imageNodes.value.push(newNode);
  selectedNodeId.value = newNode.id;
  recentGeneratedNodeId.value = newNode.id;
};

// 外部调用：兼容旧方法
const loadExternalImageToCanvas = (item) => {
  let existing = imageNodes.value.find(n => n.id === item.id);
  if (!existing) {
    const configW = configRealWidth.value || 440;
    existing = {
      id: item.id,
      url: item.url,
      prompt: item.prompt,
      model: item.model,
      width: 280,
      x: configNode.x + configW + 70,
      y: configNode.y + 40,
      parentId: null
    };
    imageNodes.value.push(existing);
  }
  selectedNodeId.value = item.id;
};

// 外部调用新功能：画廊点击“设为参考图”（加入画布 + 设为参考图，放置在创作中心左侧空闲位置，绝不悬浮重叠）
const addGalleryItemAsReference = (item) => {
  if (!configNode.refImages) configNode.refImages = [];

  const existingInRef = configNode.refImages.find(r => r.id === item.id || r.parentId === item.id);
  if (existingInRef) {
    // 如果已经在参考中，移出它
    removeNodeFromRefImages(item.id);
    return { added: false, message: '已从参考组合中移出' };
  }

  if (configNode.refImages.length >= 16) {
    emit('show-toast', { message: '已达参考图上限 (单次最多 16 张)', type: 'error' });
    return { added: false, message: '已达上限' };
  }

  // 确保在画布上有节点卡片
  let node = imageNodes.value.find(n => n.id === item.id);
  if (!node) {
    const refCount = configNode.refImages.length;
    const col = Math.floor(refCount / 4);
    const row = refCount % 4;
    const posX = configNode.x - 340 - col * 310;
    const posY = configNode.y + row * 180 - 40;

    node = {
      id: item.id,
      url: item.url,
      prompt: item.prompt,
      model: item.model,
      width: 280,
      x: posX,
      y: posY,
      parentId: null
    };
    imageNodes.value.push(node);
  }

  if (configNode.refImages.length === 0) {
    configNode.prompt = '';
    configNode.parentImageId = item.id;
  }

  configNode.refImages.push({
    id: item.id,
    url: item.url,
    name: `Image ${configNode.refImages.length + 1}`,
    parentId: item.id
  });

  selectedNodeId.value = item.id;
  return { added: true, index: configNode.refImages.length };
};

// 外部调用新功能：画廊点击“加入到画布”（仅加入画布作为独立图片，不设为参考图，放置在创作中心右侧空闲位置）
const addGalleryItemToCanvas = (item) => {
  let node = imageNodes.value.find(n => n.id === item.id);
  if (node) {
    selectedNodeId.value = node.id;
    return { alreadyExists: true };
  }

  const existingCount = imageNodes.value.length;
  const col = Math.floor(existingCount / 3);
  const row = existingCount % 3;
  const configW = configRealWidth.value || 440;
  const posX = configNode.x + configW + 70 + col * 310;
  const posY = configNode.y + row * 190;

  const newNode = {
    id: item.id,
    url: item.url,
    prompt: item.prompt,
    model: item.model,
    width: 280,
    x: posX,
    y: posY,
    parentId: null
  };
  imageNodes.value.push(newNode);
  selectedNodeId.value = item.id;
  return { alreadyExists: false };
};

// 批量从画廊设为参考图
const batchAddGalleryItemsAsReference = (items) => {
  let count = 0;
  items.forEach(item => {
    if (configNode.refImages.length < 16 && !configNode.refImages.some(r => r.id === item.id || r.parentId === item.id)) {
      addGalleryItemAsReference(item);
      count++;
    }
  });
  return count;
};

// 批量从画廊加入画布
const batchAddGalleryItemsToCanvas = (items) => {
  let count = 0;
  items.forEach(item => {
    const res = addGalleryItemToCanvas(item);
    if (!res.alreadyExists) count++;
  });
  return count;
};

defineExpose({
  addGeneratedImageToCanvas,
  loadExternalImageToCanvas,
  addGalleryItemAsReference,
  addGalleryItemToCanvas,
  batchAddGalleryItemsAsReference,
  batchAddGalleryItemsToCanvas,
  branchFromImage
});

let configResizeObserver = null;

// 初始化时如果历史记录中有图片，自动加载最新的几张到画布供用户直接把玩
onMounted(() => {
  // 监听创作中心实际 DOM 尺寸变化，保证连线永远贴紧真实边缘
  if (configNodeEl.value) {
    configRealWidth.value = configNodeEl.value.offsetWidth || 440;
    configRealHeight.value = configNodeEl.value.offsetHeight || 360;
    configResizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.target === configNodeEl.value) {
          configRealWidth.value = configNodeEl.value.offsetWidth || 440;
          configRealHeight.value = configNodeEl.value.offsetHeight || 360;
        }
      }
    });
    configResizeObserver.observe(configNodeEl.value);
  }

  if (props.historyItems && props.historyItems.length > 0 && imageNodes.value.length === 0) {
    const initialItems = props.historyItems.slice(0, 4);
    initialItems.forEach((item, idx) => {
      imageNodes.value.push({
        id: item.id,
        url: item.url,
        prompt: item.prompt,
        model: item.model,
        width: 280,
        x: configNode.x + 500 + Math.floor(idx / 2) * 320,
        y: configNode.y + (idx % 2) * 360,
        parentId: null
      });
    });
  }
});

onUnmounted(() => {
  if (configResizeObserver) {
    configResizeObserver.disconnect();
    configResizeObserver = null;
  }
  if (dragRafId) {
    cancelAnimationFrame(dragRafId);
    dragRafId = null;
  }
});
</script>

<style scoped>
.canvas-viewport {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: var(--bg-color);
  user-select: none;
  cursor: grab;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  transition: var(--transition-theme);
}

.canvas-viewport.panning {
  cursor: grabbing;
}

.canvas-viewport.pointer-mode {
  cursor: default;
}

.canvas-world {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform-origin: 0 0;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* 无界网格点阵背景 (日夜自适应) */
.canvas-grid-bg {
  position: absolute;
  top: -10000px;
  left: -10000px;
  width: 20000px;
  height: 20000px;
  pointer-events: none;
  background-image: radial-gradient(var(--canvas-grid-dot) 1.2px, transparent 1.2px);
  transition: background-image 0.35s ease;
}

/* 贝塞尔连线层 */
.connections-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 10000px;
  height: 10000px;
  pointer-events: none;
  overflow: visible;
  z-index: 1;
}

/* 底层暗色描边衬托路径：连线相交时自然呈现立体桥式遮挡，清晰区分两条线归属 */
.connection-curve-underlay {
  stroke: var(--bg-card, #0b0f19);
  opacity: 0.95;
  stroke-linecap: round;
  transition: opacity 0.3s ease;
}

:root[data-theme="light"] .connection-curve-underlay {
  stroke: rgba(255, 255, 255, 0.98);
}

.connection-curve {
  stroke-dasharray: 6 3;
  stroke-linecap: round;
  animation: flowLine 25s linear infinite;
  transition: opacity 0.3s ease, stroke-width 0.2s ease;
}

.connection-curve.highlighted-link {
  stroke-width: 3.6px !important;
  filter: drop-shadow(0 0 10px rgba(168, 85, 247, 0.85)) !important;
  opacity: 1 !important;
}

.connection-curve.recent-output {
  stroke-dasharray: 8 3;
  animation: flowLineFast 12s linear infinite;
}

@keyframes flowLineFast {
  to {
    stroke-dashoffset: -1000;
  }
}

.connection-curve.heritage {
  stroke-dasharray: 5 4;
  animation: flowLine 35s linear infinite;
}

.connection-curve.faded-heritage {
  opacity: 0.18 !important;
  filter: grayscale(0.6);
}

.connection-point {
  fill: var(--accent-indigo);
  stroke: #ffffff;
  stroke-width: 2;
  transition: opacity 0.3s ease;
}

.connection-point.recent-output {
  fill: var(--accent-emerald);
  stroke: #ffffff;
}

.connection-point.heritage {
  fill: var(--accent-amber);
  stroke: #ffffff;
}

.connection-point.faded-point {
  opacity: 0.18 !important;
}

/* 节点容器 */
.nodes-container {
  position: relative;
  z-index: 2;
}

.canvas-node {
  position: absolute;
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-lg);
  cursor: default;
  transition: box-shadow 0.25s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s ease, transform 0.1s ease-out;
  transform-style: preserve-3d;
  backface-visibility: hidden;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* 性能优化：拖拽时关闭 transition，开启 will-change 与硬件加速 */
.canvas-node.is-dragging {
  transition: none !important;
  will-change: transform;
  z-index: 100 !important;
  cursor: grabbing !important;
}

.canvas-node.is-referenced {
  border-color: rgba(99, 102, 241, 0.6) !important;
  box-shadow: 0 0 20px rgba(99, 102, 241, 0.25), var(--shadow-lg) !important;
}

.custom-model-box {
  width: 100%;
  margin-top: -2px;
}

.custom-model-input {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg-input);
  border: 1px solid var(--border-focus);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 0.78rem;
  outline: none;
  transition: var(--transition-fast);
}

.custom-model-input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.canvas-node:hover {
  border-color: var(--border-focus);
  box-shadow: var(--shadow-lg), var(--glow-shadow);
}

.canvas-node.selected {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px var(--accent-glow), var(--shadow-lg);
}

/* 1. 生图主控制节点 (圆润饱满) */
.config-node {
  width: 440px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.config-active-specs {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 0 2px 0;
  font-size: 0.73rem;
  color: var(--text-secondary);
  user-select: none;
}

.spec-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
  transition: color 0.2s ease;
}

.spec-dot {
  width: 5.5px;
  height: 5.5px;
  border-radius: 50%;
  background: var(--color-success);
  box-shadow: 0 0 6px var(--color-success);
}

.spec-sep {
  color: var(--text-muted);
  opacity: 0.45;
  font-size: 0.7rem;
}

.spec-model {
  color: var(--text-primary);
  font-weight: 600;
}

.spec-quality {
  color: var(--accent-indigo);
  font-weight: 600;
}

.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: move;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color);
}

.node-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.98rem;
  font-weight: 700;
  color: var(--text-primary);
}

/* 节点状态微指示 (彻底告别胶囊框！微光点 + 柔和文本) */
.node-status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  user-select: none;
}

.status-indicator-dot {
  width: 6.5px;
  height: 6.5px;
  border-radius: 50%;
  background: var(--color-success);
  box-shadow: 0 0 6px var(--color-success);
}

.status-indicator-dot.mode-image {
  background: var(--accent-purple);
  box-shadow: 0 0 7px var(--accent-purple);
}

.status-indicator-text {
  font-size: 0.73rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.node-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 多参考图托盘与列表 */
.multi-reference-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  background: var(--bg-subtle);
  border-radius: var(--radius-md);
  border: 1px dashed var(--accent-indigo);
}

.ref-container-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ref-container-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--accent-indigo);
}

.clear-all-refs-btn {
  background: transparent;
  border: none;
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  transition: var(--transition-fast);
}

.clear-all-refs-btn:hover {
  background: var(--accent-coral-bg);
  color: var(--color-error);
}

.ref-thumbnails-list {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  padding: 4px 2px 6px 2px;
}

.ref-thumbnail-card {
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid var(--border-color);
  background: var(--bg-card-solid);
  box-shadow: var(--shadow-sm);
}

.ref-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ref-order-tag {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.75);
  font-size: 0.58rem;
  font-weight: 600;
  color: #ffffff;
  text-align: center;
  padding: 1px 0;
  line-height: 1.2;
}

.remove-ref-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  border-radius: var(--radius-pill);
  background: rgba(0, 0, 0, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-fast);
}

.remove-ref-btn:hover {
  background: var(--color-error);
  border-color: var(--color-error);
  transform: scale(1.15);
}

.ref-add-card {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-sm);
  border: 1px dashed var(--accent-indigo);
  background: var(--accent-indigo-bg);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: var(--accent-indigo);
  font-size: 0.68rem;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition: var(--transition-smooth);
}

.ref-add-card:hover {
  background: var(--primary-color);
  color: #ffffff;
  border-style: solid;
}

/* 快捷引用胶囊栏 */
.quick-ref-pills {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding-top: 2px;
}

.pills-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.ref-pill-btn {
  background: var(--bg-subtle);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  padding: 3px 8px;
  border-radius: var(--radius-micro);
  font-size: 0.7rem;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition-smooth);
}

.ref-pill-btn:hover {
  background: var(--bg-subtle-hover);
  color: var(--text-primary);
  border-color: var(--border-focus);
  transform: translateY(-1px);
}

.ref-pill-btn.template-pill {
  background: var(--accent-purple-bg);
  border-color: rgba(168, 85, 247, 0.3);
  color: var(--accent-purple);
}

.ref-pill-btn.template-pill:hover {
  background: var(--accent-purple);
  color: #ffffff;
}

/* 图片节点上的组合徽标与按钮 */
.img-node-combo-badge {
  font-size: 0.65rem;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: var(--radius-micro);
  background: var(--accent-purple-bg);
  border: 1px solid rgba(168, 85, 247, 0.4);
  color: var(--accent-purple);
  cursor: pointer;
}

.node-prompt-input {
  width: 100%;
  min-height: 100px;
  max-height: 200px;
  overflow-y: auto !important;
  overscroll-behavior: contain;
  user-select: text !important;
  cursor: text;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 0.88rem;
  line-height: 1.5;
  padding: 14px;
  resize: vertical;
  outline: none;
  transition: border-color 0.25s, box-shadow 0.25s;
}

.node-prompt-input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.node-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 4px;
}

.action-icon-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition-smooth);
}

:root[data-theme="light"] .action-icon-btn {
  background: rgba(0, 0, 0, 0.04);
}

.action-icon-btn:hover {
  background: rgba(255, 255, 255, 0.09);
  color: var(--text-primary);
  transform: translateY(-1px);
}

:root[data-theme="light"] .action-icon-btn:hover {
  background: rgba(0, 0, 0, 0.07);
}

.generate-main-btn {
  flex: 1;
  padding: 11px 24px;
  background: var(--primary-gradient);
  border: none;
  border-radius: 8px;
  color: #ffffff;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 18px var(--accent-glow);
  transition: var(--transition-smooth);
  display: flex;
  align-items: center;
  justify-content: center;
}

.generate-main-btn:hover:not(:disabled) {
  transform: translateY(-1.5px);
  box-shadow: 0 6px 24px var(--accent-glow);
  filter: brightness(1.06);
}

.generate-main-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.generate-main-btn:hover:not(:disabled) {
  transform: translateY(-1.5px);
  box-shadow: 0 6px 22px var(--accent-glow);
}

.generate-main-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #ffffff;
  border-radius: var(--radius-pill);
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 2. 图像卡片节点 (圆润饱满 Bento) */
.image-node {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: absolute;
  border-radius: var(--radius-lg);
}

.img-node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: move;
  padding: 2px 4px;
}

.img-node-tag {
  font-size: 0.7rem;
  color: var(--accent-indigo);
  font-weight: 600;
}

.img-node-ratio {
  font-size: 0.65rem;
  font-weight: 600;
  padding: 1px 6px;
  background: var(--bg-subtle);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-micro);
  color: var(--text-muted);
}

.img-node-media {
  position: relative;
  width: 100%;
  border-radius: var(--radius-md);
  overflow: hidden;
  aspect-ratio: 1;
  background: var(--bg-subtle);
  cursor: pointer;
}

.img-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* 悬停浮层 */
.img-hover-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(to top, rgba(10, 12, 18, 0.92) 0%, rgba(10, 12, 18, 0.4) 50%, transparent 80%);
  padding: 12px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  opacity: 0;
  transition: opacity 0.25s ease;
  border-radius: var(--radius-md);
}

.img-node-media:hover .img-hover-overlay {
  opacity: 1;
}

.overlay-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 最新生成成果横幅与一键独立按钮 */
.recent-node {
  border-color: var(--accent-cyan) !important;
  box-shadow: 0 0 25px rgba(6, 182, 212, 0.35), var(--shadow-lg) !important;
}

.recent-output-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 8px;
  background: var(--accent-cyan-bg);
  border: 1px solid rgba(6, 182, 212, 0.45);
  border-radius: var(--radius-control);
  margin-bottom: 2px;
}

.recent-glow-dot {
  width: 6.5px;
  height: 6.5px;
  border-radius: 50%;
  background: var(--accent-cyan);
  box-shadow: 0 0 8px var(--accent-cyan);
  flex-shrink: 0;
}

.recent-banner-title {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--accent-cyan);
}

.separate-node-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: linear-gradient(135deg, #06b6d4, #10b981);
  border: none;
  border-radius: var(--radius-micro);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  cursor: pointer;
  transition: var(--transition-smooth);
}

.separate-node-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 10px rgba(6, 182, 212, 0.5);
}

/* 快捷参考切换按钮 */
.action-pill-btn.add-ref-btn {
  background: var(--primary-gradient);
  border: none;
  color: #ffffff;
  padding: 8px 12px;
  border-radius: var(--radius-control);
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: var(--transition-smooth);
}

.action-pill-btn.add-ref-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px var(--accent-glow);
}

.action-pill-btn.in-ref-btn {
  background: var(--accent-coral-bg);
  border: 1px solid var(--accent-coral);
  color: var(--accent-coral);
  padding: 8px 12px;
  border-radius: var(--radius-control);
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: var(--transition-smooth);
}

.action-pill-btn.separate-action-pill {
  background: linear-gradient(135deg, #06b6d4, #10b981);
  border: none;
  color: #fff;
  padding: 7px 12px;
  border-radius: var(--radius-pill);
  font-size: 0.74rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  transition: var(--transition-smooth);
}

.branch-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--primary-gradient);
  border: none;
  border-radius: var(--radius-pill);
  color: #ffffff;
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition-smooth);
}

.branch-btn:hover {
  transform: translateY(-1px);
}

.secondary-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.icon-circle-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.18);
  border: none;
  color: #ffffff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-smooth);
}

.icon-circle-btn:hover,
.icon-circle-btn.active {
  background: var(--primary-color);
  color: #ffffff;
  box-shadow: 0 0 10px var(--accent-glow);
}

.icon-circle-btn.delete-btn:hover {
  background: var(--color-error);
  color: #ffffff;
}

/* 提示词气泡文本框 (极致纯平毛玻璃，彻底去除实线边框与生硬棱角) */
.node-prompt-callout {
  position: absolute;
  bottom: calc(100% + 14px);
  left: 50%;
  transform: translateX(-50%);
  width: 310px;
  background: rgba(18, 20, 30, 0.94);
  backdrop-filter: blur(32px);
  -webkit-backdrop-filter: blur(32px);
  border: none !important;
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.6), 0 0 1px rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 14px;
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: 10px;
  animation: popoverFadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

:root[data-theme="light"] .node-prompt-callout {
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 16px 45px rgba(0, 0, 0, 0.14), 0 0 1px rgba(0, 0, 0, 0.08);
}

@keyframes popoverFadeIn {
  from { opacity: 0; transform: translate(-50%, 6px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}

.callout-arrow {
  display: none !important;
}

.callout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: none !important;
  padding-bottom: 2px;
}

.callout-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--primary-color);
}

.callout-close-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.callout-close-btn:hover {
  color: var(--text-primary);
}

.callout-body {
  max-height: 130px;
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  padding: 9px 11px;
}

.callout-text {
  font-size: 0.78rem;
  line-height: 1.5;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
}

.callout-actions {
  display: flex;
  gap: 8px;
  padding-top: 4px;
  border-top: none !important;
}

.callout-action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 0.74rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  border: none !important;
  transition: var(--transition-smooth);
}

.copy-action-btn {
  background: var(--primary-gradient) !important;
  color: #ffffff !important;
  box-shadow: 0 4px 12px var(--accent-glow);
}

.copy-action-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px var(--accent-glow);
}

.fill-action-btn {
  background: rgba(255, 255, 255, 0.06) !important;
  color: var(--text-secondary);
}

:root[data-theme="light"] .fill-action-btn {
  background: rgba(0, 0, 0, 0.04) !important;
}

.fill-action-btn:hover {
  background: rgba(255, 255, 255, 0.12) !important;
  color: var(--text-primary);
}

.node-handle {
  position: absolute;
  right: -6px;
  top: 50%;
  transform: translateY(-50%);
  width: 12px;
  height: 12px;
  background: var(--primary-color);
  border: 2px solid #ffffff;
  border-radius: var(--radius-pill);
  cursor: pointer;
  z-index: 5;
  transition: var(--transition-fast);
}

.node-handle:hover {
  transform: translateY(-50%) scale(1.35);
  box-shadow: 0 0 10px var(--accent-indigo);
}

.node-handle.connected {
  background: var(--accent-purple);
  box-shadow: 0 0 8px var(--accent-purple);
}

/* 3. 提示词血脉小方框节点 (Derivation Prompt Hubs) */
.derivation-hub-node {
  width: 42px;
  height: 42px;
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  border: 1.5px solid var(--accent-amber);
  box-shadow: var(--shadow-md), 0 0 12px rgba(245, 158, 11, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 8;
  transition: var(--transition-smooth);
}

.derivation-hub-node:hover,
.derivation-hub-node.active-hub {
  border-color: #fbbf24;
  box-shadow: 0 0 20px rgba(245, 158, 11, 0.6), var(--shadow-lg);
  transform: scale(1.1);
  opacity: 1 !important;
}

.derivation-hub-node.faded-hub {
  opacity: 0.25;
  filter: grayscale(0.5);
}

.hub-icon-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  color: var(--accent-amber);
}

.hub-pill-tag {
  font-size: 0.54rem;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: var(--accent-amber);
  line-height: 1;
}

/* 小方框点击展开的提示词气泡弹窗 */
.pipeline-popover {
  position: absolute;
  bottom: calc(100% + 14px);
  left: 50%;
  transform: translateX(-50%);
  width: 320px;
  background: var(--bg-surface-elevated);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--accent-amber);
  box-shadow: var(--shadow-lg), 0 0 24px rgba(245, 158, 11, 0.25);
  border-radius: var(--radius-md);
  padding: 14px;
  z-index: 80;
  display: flex;
  flex-direction: column;
  gap: 10px;
  animation: popoverFadeIn 0.18s ease-out;
  cursor: default;
}

.popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 6px;
}

.popover-title {
  font-size: 0.84rem;
  font-weight: 700;
  color: var(--accent-amber);
}

.popover-close-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0 4px;
}

.popover-close-btn:hover {
  color: var(--text-primary);
}

.popover-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.popover-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.popover-meta .meta-tag {
  font-size: 0.68rem;
  font-weight: 600;
  padding: 1px 6px;
  background: var(--accent-amber-bg);
  border: none;
  border-radius: var(--radius-micro);
  color: var(--accent-amber);
}

.popover-meta .meta-time {
  font-size: 0.68rem;
  color: var(--text-muted);
  margin-left: auto;
}

.popover-prompt {
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--text-primary);
  max-height: 120px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
  background: var(--bg-subtle);
  padding: 8px 10px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--border-color);
}

.popover-actions {
  display: flex;
  gap: 8px;
  padding-top: 4px;
}

.pipe-btn {
  flex: 1;
  padding: 7px 12px;
  border-radius: var(--radius-xs);
  font-size: 0.74rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: var(--transition-smooth);
  display: flex;
  align-items: center;
  justify-content: center;
}

.pipe-btn.copy-btn {
  background: var(--accent-amber-bg);
  color: var(--accent-amber);
}

.pipe-btn.copy-btn:hover {
  background: var(--accent-amber);
  color: #ffffff;
}

.pipe-btn.reuse-btn {
  background: var(--accent-indigo-bg);
  color: var(--accent-indigo);
}

.pipe-btn.reuse-btn:hover {
  background: var(--primary-color);
  color: #ffffff;
}

/* 底部悬浮控制坞 (彻底去除大胶囊与小圆胶囊！专业线性微倒角工具条) */
.floating-dock-wrapper {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
}

.dock-panel {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 8px;
  box-shadow: var(--shadow-lg);
  transition: var(--transition-theme);
}

.dock-group {
  display: flex;
  align-items: center;
  gap: 3px;
}

.dock-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  width: 28px;
  height: 28px;
  border-radius: 5px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-smooth);
}

.dock-btn:hover {
  background: var(--bg-subtle-hover);
  color: var(--text-primary);
}

.dock-btn.active {
  background: var(--primary-gradient);
  color: #ffffff;
  box-shadow: 0 2px 8px var(--accent-glow);
}

.dock-btn.danger:hover {
  background: var(--accent-coral-bg);
  color: var(--color-error);
}

.dock-divider {
  width: 1px;
  height: 14px;
  background: var(--border-divider);
}

.zoom-group {
  display: flex;
  align-items: center;
  gap: 3px;
}

.zoom-value {
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--text-primary);
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  transition: var(--transition-fast);
}

.zoom-value:hover {
  background: var(--bg-subtle-hover);
}
</style>
