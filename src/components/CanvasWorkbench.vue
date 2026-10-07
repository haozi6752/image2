<template>
  <div 
    class="canvas-viewport" 
    ref="viewportRef"
    @mousedown.capture="onViewportMouseDownCapture"
    @mousedown="onViewportMouseDown"
    @wheel="onWheel"
    :class="{ 
      'panning': isPanning, 
      'pointer-mode': toolMode === 'pointer',
      'space-panning-ready': isSpacePressed && !isPanning
    }"
  >
    <!-- 背景网格坐标层 (优化：仅铺满 100% 视口，消除 20000x20000 的巨型图层重绘卡顿) -->
    <div class="canvas-grid-bg" ref="gridEl" :style="gridBackgroundStyle"></div>

    <!-- Canvas 2D 高性能批量连线渲染层 (视口原生分辨率，零 DOM 节点，硬件批量绘制) -->
    <canvas 
      v-show="renderEngine === 'canvas'"
      ref="connectionsCanvasRef"
      class="connections-canvas-layer"
    ></canvas>

    <!-- 无限画布转换容器 -->
    <div 
      class="canvas-world" 
      ref="worldEl"
      :style="worldTransformStyle"
    >
      <!-- 贝塞尔连线 SVG 层 (SVG 矢量双模引擎) -->
      <svg v-if="renderEngine === 'svg'" class="connections-layer">
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
            :class="['connection-curve-underlay', { 'faded-heritage': link.type === 'heritage' && isAnyRefActive && hoveredPipelineId !== link.pipelineId }]" 
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
        <!-- 1. 生图主控制节点列表 (支持多个创作窗口并行生图，数量不做上限) -->
        <div 
          v-for="win in creationWindows"
          :key="win.id"
          :ref="el => registerWinEl(win.id, el)"
          class="canvas-node config-node glass-panel"
          :class="{ 
            'is-dragging': draggingNode === win,
            'is-active-window': activeConfigId === win.id
          }"
          :style="{ transform: `translate(${Math.round(win.x)}px, ${Math.round(win.y)}px)` }"
          @mousedown.stop="startNodeDrag($event, win)"
          @mouseenter="hoveredNodeId = win.id"
          @mouseleave="hoveredNodeId = null"
          @click="activeConfigId = win.id"
        >
          <!-- 节点顶部拖拽柄 (无胶囊边框，极简状态指示) -->
          <div class="node-header">
            <div class="node-title">
              <span class="node-icon">✨</span>
              <span>{{ win.name || '创作配置中心' }}</span>
              <span v-if="activeConfigId === win.id && creationWindows.length > 1" class="active-win-tag">焦点</span>
            </div>
            <div class="node-header-right">
              <div class="node-status-indicator">
                <span class="status-indicator-dot" :class="win.refImages && win.refImages.length > 0 ? 'mode-image' : 'mode-text'"></span>
                <span class="status-indicator-text">
                  {{ win.refImages && win.refImages.length > 1 ? `多图融合 (${win.refImages.length}/16)` : win.refImages && win.refImages.length === 1 ? '单图参考' : '纯文生图' }}
                </span>
              </div>
              <button 
                v-if="creationWindows.length > 1"
                class="win-close-btn"
                @click.stop="closeCreationWindow(win.id)"
                title="关闭并移除此创作窗口"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          </div>

          <!-- 提示词输入区 -->
          <div class="node-body">
            <!-- 多图参考托盘与引用区域 (支持最多 16 张，符合 OpenAI 规范) -->
            <div v-if="win.refImages && win.refImages.length > 0" class="multi-reference-container">
              <div class="ref-container-header">
                <span class="ref-container-title">
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                  <span>已载入参考图 ({{ win.refImages.length }}/16 张)</span>
                </span>
                <button class="clear-all-refs-btn" @click.stop="clearWindowRefImages(win)" title="清空全部参考图">清空组合</button>
              </div>

              <!-- 缩略图横向列表 -->
              <div class="ref-thumbnails-list">
                <div 
                  v-for="(img, idx) in win.refImages" 
                  :key="img.id || idx" 
                  class="ref-thumbnail-card"
                  :title="`参考图 [Image ${idx + 1}]`"
                >
                  <img :src="img.thumbnailUrl || img.url" :alt="`Image ${idx + 1}`" class="ref-thumb-img" decoding="async" loading="lazy" @error="img.thumbnailUrl = null" />
                  <span class="ref-order-tag">Image {{ idx + 1 }}</span>
                  <button class="remove-ref-btn" @click.stop="removeWindowRefImage(win, idx)" title="移除此参考图">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>

                <!-- 托盘末尾快捷追加本地图片小卡片 -->
                <label v-if="win.refImages.length < 16" class="ref-add-card" title="导入更多本地参考图 (单次或批量)">
                  <input type="file" multiple accept="image/*" @change="handleWindowLocalRefUpload(win, $event)" style="display: none;" />
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  <span>添加</span>
                </label>
              </div>

              <!-- 快捷引用小芯片栏 -->
              <div class="quick-ref-pills">
                <span class="pills-label">提示词引用:</span>
                <button 
                  v-for="(_, idx) in win.refImages" 
                  :key="idx" 
                  class="ref-pill-btn"
                  @click.stop="insertWindowRefPill(win, idx + 1)"
                  :title="`在提示词中插入 [Image ${idx + 1}]`"
                >
                  + Image {{ idx + 1 }}
                </button>
                <button 
                  v-if="win.refImages.length >= 2"
                  class="ref-pill-btn template-pill"
                  @click.stop="insertWindowBlendTemplate(win)"
                  title="插入经典多图融合提示词句式"
                >
                  ⚡ 融合句式
                </button>
              </div>
            </div>

            <!-- 侧栏参数规格流 -->
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
              v-model="win.prompt"
              class="node-prompt-input"
              placeholder="在此输入画面创意描述或修改指令... (多图时可使用 Image 1、Image 2 指定角色与画风)"
              rows="4"
              @keydown.enter.ctrl.prevent="triggerGenerateForWindow(win)"
              @keydown.enter.meta.prevent="triggerGenerateForWindow(win)"
              @mousedown.stop
              @mouseup.stop
              @click.stop
              @wheel.stop
            ></textarea>

            <!-- 操作按钮行 -->
            <div class="node-actions" @mousedown.stop>
              <!-- 上传自定义本地图作为参考 -->
              <label class="action-icon-btn upload-ref-btn" title="批量导入本地图片作为参考 (最多16张)">
                <input type="file" multiple accept="image/*" @change="handleWindowLocalRefUpload(win, $event)" style="display: none;" />
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                <span>{{ win.refImages && win.refImages.length > 0 ? '追加参考图' : '导入参考图' }}</span>
              </label>

              <!-- 开始生成按钮 (多窗口独立状态，互不阻塞，并行生图) -->
              <button 
                class="generate-main-btn" 
                :disabled="win.isGenerating || !win.prompt.trim()"
                @click="triggerGenerateForWindow(win)"
              >
                <span v-if="win.isGenerating" class="btn-spinner"></span>
                <span v-else>
                  {{ win.refImages && win.refImages.length > 1 ? `＋ 融合生成 (${win.refImages.length}图)` : '＋ 开始渲染' }}
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
            'is-referenced': isNodeInRefImages(node.id),
            'has-active-popover': activePromptNodeId === node.id
          }"
          :style="{ transform: `translate(${Math.round(node.x)}px, ${Math.round(node.y)}px)`, width: `${node.width || 280}px` }"
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
            <img :src="node.thumbnailUrl || node.url" :alt="node.prompt" class="img-preview" decoding="async" loading="lazy" @error="node.thumbnailUrl = null" />
            
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
                  :title="(activeConfigNode?.refImages?.length || 0) === 0 ? '设为参考图 (将清空输入框文本以输入新构思)' : '追加到参考组合中进行多图融合'"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  <span>{{ (activeConfigNode?.refImages?.length || 0) === 0 ? '设为参考' : '+ 追加参考' }}</span>
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
          :style="{ transform: `translate(${Math.round(pipe.x)}px, ${Math.round(pipe.y)}px)` }"
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

        <!-- 创作窗口添加与关闭控制 (多窗口并行生图与管理) -->
        <div class="dock-group window-control-group">
          <button 
            class="dock-btn add-win-dock-btn" 
            @click="addCreationWindow" 
            title="＋ 添加新创作窗口 (支持多窗口并行独立生图，不设数量上限)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
            <span class="dock-btn-label">＋ 创作窗口</span>
          </button>
          <button 
            v-if="creationWindows.length > 1"
            class="dock-btn remove-win-dock-btn" 
            @click="closeCreationWindow(activeConfigId)" 
            title="关闭当前获得焦点的创作窗口"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="8" y1="12" x2="16" y2="12"></line></svg>
            <span class="dock-btn-label">－ 关闭窗口</span>
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
          <!-- 连线渲染双模引擎切换 (Canvas 2D 硬件批量绘制 vs SVG 矢量) -->
          <button 
            class="dock-btn render-engine-dock-btn" 
            :class="{ active: renderEngine === 'canvas' }" 
            @click="toggleRenderEngine" 
            :title="renderEngine === 'canvas' ? '连线引擎: Canvas 2D 硬件批量绘制 (超低开销满帧渲染，点击切换为 SVG)' : '连线引擎: SVG 矢量模式 (点击切换为 Canvas 2D)'"
          >
            <span class="engine-badge">{{ renderEngine === 'canvas' ? 'CANVAS' : 'SVG' }}</span>
          </button>

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
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { createThumbnail, isBlobUrlActive } from '../utils/thumbnail';

const props = defineProps({
  isGenerating: Boolean,
  currentSettings: Object,
  historyItems: Array
});

const emit = defineEmits(['generate', 'preview', 'show-toast', 'update-settings']);

const viewportRef = ref(null);
const worldEl = ref(null);
const gridEl = ref(null);

// 连线渲染双模引擎：'canvas' (Canvas 2D 硬件批量绘制，极速满帧，默认) | 'svg' (SVG 矢量 DOM 模式)
const renderEngine = ref(localStorage.getItem('connections_render_engine') || 'canvas');

const connectionsCanvasRef = ref(null);
let canvasWidth = 0;
let canvasHeight = 0;
let currentDpr = 1;
let animFrameId = null;
let globalDashOffset = 0;
let lastFrameTime = performance.now();
let viewportResizeObserver = null;
let themeObserver = null;

// 切换连线渲染双模引擎
const toggleRenderEngine = () => {
  renderEngine.value = renderEngine.value === 'canvas' ? 'svg' : 'canvas';
  localStorage.setItem('connections_render_engine', renderEngine.value);
  emit('show-toast', {
    message: renderEngine.value === 'canvas' 
      ? '已启用 Canvas 2D 极速批量连线引擎 (超低开销，满帧渲染)' 
      : '已切换至 SVG 矢量连线引擎 (高精矢量 DOM)',
    type: 'info'
  });
  if (renderEngine.value === 'canvas') {
    nextTick(() => {
      updateCanvasSize();
      drawConnections(panX.value, panY.value, scale.value);
      startCanvasAnimLoop();
    });
  }
};

// 自动为节点生成并绑定轻量缩略图 (释放 95%+ GPU 纹理显存)
const ensureNodeThumbnail = (node) => {
  if (!node || !node.url) return;
  // 如果无缩略图或缩略图为失效的旧会话 blob，异步生成有效缩略图
  if (!node.thumbnailUrl || (typeof node.thumbnailUrl === 'string' && node.thumbnailUrl.startsWith('blob:') && !isBlobUrlActive(node.thumbnailUrl))) {
    createThumbnail(node.url).then(tUrl => {
      if (tUrl && tUrl !== node.url) {
        node.thumbnailUrl = tUrl;
      }
    }).catch(() => {});
  }
};

// 画布视口平移与缩放
const panX = ref(150);
const panY = ref(100);
const scale = ref(0.9);
const toolMode = ref('grab'); // 'grab' | 'pointer'
const isPanning = ref(false);
const isSpacePressed = ref(false);
let startPanX = 0;
let startPanY = 0;
let currentPanX = 150;
let currentPanY = 100;
let panRafId = null;

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

// 创作配置中心节点列表（支持无限添加多个创作窗口，各自独立参数与并行生图）
const creationWindows = ref([
  {
    id: 'config-center-1',
    name: '创作中心 #1',
    x: 100,
    y: 120,
    prompt: '',
    refImages: [], // 数组：[{ id, url, name, parentId }]
    parentImageId: null,
    isGenerating: false,
    recentGeneratedIds: [] // 本次任务生成的图片ID列表，支持一次生成多张各连一根发光线
  }
]);

// 当前活跃获得焦点的创作窗口 ID
const activeConfigId = ref('config-center-1');

const activeConfigNode = computed(() => {
  return creationWindows.value.find(w => w.id === activeConfigId.value) || creationWindows.value[0];
});

// 兼容单节点调用的计算属性
const configNode = computed(() => activeConfigNode.value);

// 添加新创作窗口
const addCreationWindow = () => {
  const newIndex = creationWindows.value.length + 1;
  const newId = `config-center-${Date.now()}`;
  const lastWin = creationWindows.value[creationWindows.value.length - 1];
  const newX = lastWin ? Math.round(lastWin.x + 480) : 100;
  const newY = lastWin ? Math.round(lastWin.y) : 120;

  const newWindow = {
    id: newId,
    name: `创作中心 #${newIndex}`,
    x: newX,
    y: newY,
    prompt: '',
    refImages: [],
    parentImageId: null,
    isGenerating: false,
    recentGeneratedIds: []
  };

  creationWindows.value.push(newWindow);
  activeConfigId.value = newId;
  emit('show-toast', { message: `已添加新创作窗口 #${newIndex}！可并行独立生图。`, type: 'success' });
};

// 关闭创作窗口
const closeCreationWindow = (winId) => {
  if (creationWindows.value.length <= 1) {
    emit('show-toast', { message: '至少保留一个创作窗口，不可关闭', type: 'info' });
    return;
  }
  const closingWin = creationWindows.value.find(w => w.id === winId);
  creationWindows.value = creationWindows.value.filter(w => w.id !== winId);
  winEls.delete(winId);

  if (activeConfigId.value === winId) {
    activeConfigId.value = creationWindows.value[0]?.id || null;
  }
  emit('show-toast', { message: `已成功关闭并移除 [${closingWin?.name || '创作窗口'}]`, type: 'info' });
};

// 触发特定创作窗口的独立生图
const triggerGenerateForWindow = (win) => {
  if (!win.prompt.trim() || win.isGenerating) return;

  win.isGenerating = true;
  activeConfigId.value = win.id;

  // 关键：新任务启动时，清空当前窗口上一轮生成产物连线，为本次任务的多张新图准备连线
  win.recentGeneratedIds = [];

  const refImagesUrls = (win.refImages || []).map(img => img.url);
  const parentIds = (win.refImages || []).filter(img => img.parentId).map(img => img.parentId);

  emit('generate', {
    windowId: win.id,
    prompt: win.prompt.trim(),
    model: props.currentSettings?.model || 'gpt-image-2.5-flare',
    ratio: props.currentSettings?.ratio || '1:1',
    refImage: refImagesUrls[0] || null,
    refImages: refImagesUrls,
    parentId: parentIds[0] || null,
    parentIds: parentIds
  });
};

// 完成特定创作窗口的生图任务 (由父组件在 API 返回后调用)
const finishWindowGenerate = (windowId) => {
  if (!windowId) {
    creationWindows.value.forEach(w => { w.isGenerating = false; });
    return;
  }
  const targetWin = creationWindows.value.find(w => w.id === windowId);
  if (targetWin) {
    targetWin.isGenerating = false;
  }
};

// 为特定创作窗口批量导入本地参考图
const handleWindowLocalRefUpload = (win, e) => {
  const files = Array.from(e.target.files || []);
  if (files.length === 0) return;

  if (!win.refImages) win.refImages = [];

  const availableSlots = 16 - win.refImages.length;
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
        const localId = 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const refItem = {
          id: localId,
          url: compressedDataUrl,
          thumbnailUrl: null,
          name: `Image ${win.refImages.length + 1}`,
          parentId: null
        };
        win.refImages.push(refItem);
        createThumbnail(compressedDataUrl).then(thumb => {
          if (thumb) refItem.thumbnailUrl = thumb;
        }).catch(() => {});

        processedCount++;
        if (processedCount === filesToProcess.length) {
          emit('show-toast', { 
            message: `成功载入 ${filesToProcess.length} 张本地参考图至 [${win.name}] (当前共 ${win.refImages.length}/16 张)`, 
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

// 清空特定创作窗口的参考图
const clearWindowRefImages = (win) => {
  win.refImages = [];
  win.parentImageId = null;
  emit('show-toast', { message: `已清空 [${win.name}] 参考组合，切换为纯文生图`, type: 'info' });
};

// 移除特定创作窗口的单张参考图
const removeWindowRefImage = (win, index) => {
  if (win.refImages) {
    const removed = win.refImages.splice(index, 1)[0];
    if (win.refImages.length === 0) {
      win.parentImageId = null;
    } else if (removed && win.parentImageId === (removed.parentId || removed.id)) {
      win.parentImageId = win.refImages[0].parentId || win.refImages[0].id || null;
    }
    emit('show-toast', { message: `已移出参考图 (剩余 ${win.refImages.length} 张)`, type: 'info' });
  }
};

// 插入特定窗口的参考引用标签
const insertWindowRefPill = (win, imageIndex) => {
  const refTag = `Image ${imageIndex}`;
  if (!win.prompt.includes(refTag)) {
    if (win.prompt.trim().length > 0) {
      win.prompt += `，融合 ${refTag} 的视觉特征`;
    } else {
      win.prompt = `以 ${refTag} 为主要参考，`;
    }
  } else {
    win.prompt += ` ${refTag}`;
  }
  emit('show-toast', { message: `已在 [${win.name}] 提示词插入 [${refTag}] 引用`, type: 'info' });
};

// 插入特定窗口的多图融合模板
const insertWindowBlendTemplate = (win) => {
  const count = win.refImages?.length || 0;
  let template = '';
  if (count === 2) {
    template = '\n将 Image 1 的构图与主体角色，与 Image 2 的艺术画风、材质纹理完美融合。';
  } else if (count >= 3) {
    template = '\n以 Image 1 作为主体人物，融合 Image 2 的服装与材质，置于 Image 3 展现的场景光影中。';
  } else {
    template = '\n参考 Image 1 的视觉细节进行高质量衍生优化。';
  }
  win.prompt = (win.prompt.trim() + template).trim();
  emit('show-toast', { message: `已填充 [${win.name}] 多图融合提示词模版！`, type: 'success' });
};

// 注册创作窗口 DOM 测量引用
const winEls = new Map();
const registerWinEl = (winId, el) => {
  if (el) {
    winEls.set(winId, el);
    configRealWidth.value = el.offsetWidth || 440;
    configRealHeight.value = el.offsetHeight || 360;
  } else {
    winEls.delete(winId);
  }
};

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
  return creationWindows.value.some(w => w.refImages && w.refImages.length > 0);
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

// 判断节点是否在当前活跃窗口的参考组合中
const isNodeInRefImages = (nodeId) => {
  const targetWin = activeConfigNode.value;
  return targetWin?.refImages && targetWin.refImages.some(img => img.id === nodeId || img.parentId === nodeId);
};

// 获取节点在活跃窗口参考组合中的序号 (Image 1, Image 2...)
const getRefIndex = (nodeId) => {
  const targetWin = activeConfigNode.value;
  if (!targetWin?.refImages) return '';
  const idx = targetWin.refImages.findIndex(img => img.id === nodeId || img.parentId === nodeId);
  return idx !== -1 ? idx + 1 : '';
};

// 移出当前活跃窗口的单个参考图
const removeNodeFromRefImages = (nodeId) => {
  const targetWin = activeConfigNode.value;
  if (targetWin?.refImages) {
    targetWin.refImages = targetWin.refImages.filter(img => img.id !== nodeId && img.parentId !== nodeId);
    if (targetWin.refImages.length === 0) {
      targetWin.parentImageId = null;
    } else if (targetWin.parentImageId === nodeId) {
      targetWin.parentImageId = targetWin.refImages[0].parentId || targetWin.refImages[0].id || null;
    }
    emit('show-toast', { message: `已移出参考图 (剩余 ${targetWin.refImages.length} 张)`, type: 'info' });
  }
};

// 切换节点在当前活跃窗口参考组合中的选中状态 (加入 / 移除)
const toggleNodeInRefImages = (node) => {
  const targetWin = activeConfigNode.value;
  if (!targetWin) return;
  if (!targetWin.refImages) targetWin.refImages = [];
  const existingIdx = targetWin.refImages.findIndex(img => img.id === node.id || img.parentId === node.id);
  
  if (existingIdx !== -1) {
    removeNodeFromRefImages(node.id);
  } else {
    if (targetWin.refImages.length >= 16) {
      emit('show-toast', { message: '已达到 OpenAI 规范上限：单次生图最多支持 16 张参考图', type: 'error' });
      return;
    }
    // 用户规则：当选择一张图为参考图时，如果是首张参考图，清除提示词输入框文本！
    if (targetWin.refImages.length === 0) {
      targetWin.prompt = '';
      targetWin.parentImageId = node.id;
    }
    targetWin.refImages.push({
      id: node.id,
      url: node.url,
      name: `Image ${targetWin.refImages.length + 1}`,
      parentId: node.id
    });
    emit('show-toast', { 
      message: `已设为 [${targetWin.name}] 的 [Image ${targetWin.refImages.length}] 参考图${targetWin.refImages.length === 1 ? ' (提示词已清空)' : ''}`, 
      type: 'success' 
    });
  }
};

// 核心功能：以此图作为当前活跃窗口的唯一基准衍生（清空其他组合与提示词）
const setAsSoleReference = (node) => {
  const targetWin = activeConfigNode.value;
  if (!targetWin) return;
  targetWin.refImages = [{
    id: node.id,
    url: node.url,
    name: 'Image 1',
    parentId: node.id
  }];
  targetWin.parentImageId = node.id;
  targetWin.prompt = '';
  emit('show-toast', { message: `已设为 [${targetWin.name}] 唯一基准参考（提示词已清空）`, type: 'success' });
};

// 核心功能：将生成的图独立出去 (断开与创作框的连线，固化为提示词血统小方框，创作中心同时独立)
const separateGeneratedNode = (nodeId) => {
  const node = imageNodes.value.find(n => n.id === nodeId);
  if (!node) return;

  node.isRecentGenerated = false;
  if (recentGeneratedNodeId.value === nodeId) {
    recentGeneratedNodeId.value = null;
  }

  // 找到对应的生成源创作窗口
  const targetWin = (node.sourceWindowId && creationWindows.value.find(w => w.id === node.sourceWindowId)) || activeConfigNode.value || creationWindows.value[0];
  if (targetWin && targetWin.recentGeneratedIds) {
    targetWin.recentGeneratedIds = targetWin.recentGeneratedIds.filter(id => id !== nodeId);
  }

  // 如果生成时使用了参考图，为其建立血统小方框
  const parentIds = Array.isArray(node.sourceRefIds) ? node.sourceRefIds : [];
  if (parentIds.length > 0) {
    const parentNodes = imageNodes.value.filter(n => parentIds.includes(n.id));
    let refAvgX = (targetWin ? targetWin.x : 100) - 80;
    let refAvgY = (targetWin ? targetWin.y : 120);
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
  if (targetWin) {
    targetWin.refImages = [];
    targetWin.parentImageId = null;
  }

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
  const targetWin = activeConfigNode.value || creationWindows.value[0];
  if (targetWin) {
    targetWin.prompt = text;
  }
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
  if (isSpacePressed.value || toolMode.value === 'grab') {
    startPanning(e);
    return;
  }
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

// 视口变换样式 (采用 2D translate 与 scale，确保浏览器在任意缩放比例下对子节点文本与边框进行高保真矢量栅格化，彻底消除模糊)
const worldTransformStyle = computed(() => {
  return {
    transform: `translate(${Math.round(panX.value)}px, ${Math.round(panY.value)}px) scale(${scale.value})`
  };
});

// 背景网格随平移与缩放动态硬件平移 (关键优化：固定 backgroundPosition: 0 0，仅使用 translate3d 偏移取模，彻底消除每帧全屏 Repaint 重绘)
const gridBackgroundStyle = computed(() => {
  const gridSize = 32 * scale.value;
  const offsetX = Math.round(((panX.value % gridSize) + gridSize) % gridSize);
  const offsetY = Math.round(((panY.value % gridSize) + gridSize) % gridSize);
  return {
    backgroundSize: `${gridSize}px ${gridSize}px`,
    transform: `translate3d(${offsetX}px, ${offsetY}px, 0)`
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
    c1x,
    c1y,
    c2x,
    c2y,
    path
  };
};

// 计算所有活跃的连接线（四周无缝连续物理滑动 + 支持多创作窗口独立连线 + 交叉分层）
const activeLinks = computed(() => {
  const links = [];

  // 1. 遍历所有创作窗口，独立计算各自的向心参考连线与向外输出连线
  creationWindows.value.forEach(win => {
    const el = winEls.get(win.id);
    const winW = el?.offsetWidth || 440;
    const winH = el?.offsetHeight || 360;

    const rectWin = {
      x: win.x,
      y: win.y,
      w: winW,
      h: winH
    };

    // 1.1 汇入该创作窗口的参考图连线
    if (win.refImages && win.refImages.length > 0) {
      const parentNodes = [];
      win.refImages.forEach(refItem => {
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

        const conn = calculateSmartConnector(rectCard, rectWin);

        links.push({
          id: `ref-link-${win.id}-${parent.id}`,
          type: 'reference',
          windowId: win.id,
          stroke: 'url(#linkGradient)',
          strokeWidth: 2.2,
          fromX: conn.fromX,
          fromY: conn.fromY,
          toX: conn.toX,
          toY: conn.toY,
          c1x: conn.c1x,
          c1y: conn.c1y,
          c2x: conn.c2x,
          c2y: conn.c2y,
          path: conn.path
        });
      });
    }

    // 1.2 从该创作窗口连向最新生成图的高亮输出连线 (支持同一次任务生成多张时，多张图同时各连一根发光线)
    const recentTargetIds = [];
    if (win.recentGeneratedIds && win.recentGeneratedIds.length > 0) {
      recentTargetIds.push(...win.recentGeneratedIds);
    } else if (recentGeneratedNodeId.value && win.id === activeConfigId.value) {
      recentTargetIds.push(recentGeneratedNodeId.value);
    }

    recentTargetIds.forEach(targetId => {
      const recentNode = imageNodes.value.find(n => n.id === targetId);
      if (recentNode && recentNode.isRecentGenerated) {
        // 如果该节点由当前窗口产生，或者属于当前获得焦点的窗口
        const isBelong = recentNode.sourceWindowId ? (recentNode.sourceWindowId === win.id) : (win.id === activeConfigId.value);
        if (isBelong) {
          const rectRecent = {
            x: recentNode.x,
            y: recentNode.y,
            w: recentNode.width || 280,
            h: getNodeHeight(recentNode)
          };
          const conn = calculateSmartConnector(rectWin, rectRecent);

          links.push({
            id: `recent-output-${win.id}-${recentNode.id}`,
            type: 'recent-output',
            windowId: win.id,
            stroke: 'url(#recentOutputGradient)',
            strokeWidth: 2.8,
            filter: 'url(#glowRecent)',
            fromX: conn.fromX,
            fromY: conn.fromY,
            toX: conn.toX,
            toY: conn.toY,
            c1x: conn.c1x,
            c1y: conn.c1y,
            c2x: conn.c2x,
            c2y: conn.c2y,
            path: conn.path
          });
        }
      }
    });
  });

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
          c1x: conn.c1x,
          c1y: conn.c1y,
          c2x: conn.c2x,
          c2y: conn.c2y,
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
      c1x: connOut.c1x,
      c1y: connOut.c1y,
      c2x: connOut.c2x,
      c2y: connOut.c2y,
      path: connOut.path
    });
  });

  return links;
});

// 更新 Canvas 视口物理像素尺寸 (适应 HiDPI / Retina 屏)
const updateCanvasSize = () => {
  const canvas = connectionsCanvasRef.value;
  const viewport = viewportRef.value;
  if (!canvas || !viewport) return;

  const dpr = window.devicePixelRatio || 1;
  const w = viewport.clientWidth;
  const h = viewport.clientHeight;

  if (canvasWidth !== w || canvasHeight !== h || currentDpr !== dpr) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvasWidth = w;
    canvasHeight = h;
    currentDpr = dpr;
  }
};

// 核心：Canvas 2D 批量绘制所有贝塞尔连线与物理端点
const drawConnections = (curPanX = panX.value, curPanY = panY.value, curScale = scale.value) => {
  const canvas = connectionsCanvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = currentDpr || window.devicePixelRatio || 1;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const links = activeLinks.value;
  if (!links || links.length === 0) return;

  // 保证视口尺寸已就绪，避免初始未测量导致误剔除
  if (canvasWidth === 0 || canvasHeight === 0) {
    updateCanvasSize();
  }
  const vpW = canvasWidth || viewportRef.value?.clientWidth || window.innerWidth;
  const vpH = canvasHeight || viewportRef.value?.clientHeight || window.innerHeight;

  // 视口视锥剔除 (Viewport AABB Culling，跳过视口外无意义计算与绘制)
  const margin = 160;
  const visMinX = (-curPanX) / curScale - margin;
  const visMaxX = (vpW - curPanX) / curScale + margin;
  const visMinY = (-curPanY) / curScale - margin;
  const visMaxY = (vpH - curPanY) / curScale + margin;

  const visibleLinks = links.filter(l => {
    const minX = Math.min(l.fromX, l.toX, l.c1x, l.c2x);
    const maxX = Math.max(l.fromX, l.toX, l.c1x, l.c2x);
    const minY = Math.min(l.fromY, l.toY, l.c1y, l.c2y);
    const maxY = Math.max(l.fromY, l.toY, l.c1y, l.c2y);
    return maxX >= visMinX && minX <= visMaxX && maxY >= visMinY && minY <= visMaxY;
  });

  if (visibleLinks.length === 0) return;

  ctx.save();
  // 设定与 canvas-world 完全一致的世界空间变换矩阵 (屏幕像素级对齐)
  ctx.setTransform(curScale * dpr, 0, 0, curScale * dpr, curPanX * dpr, curPanY * dpr);

  const isLight = document.documentElement.getAttribute('data-theme') === 'light' || document.body.classList.contains('light-theme');

  // ===== 第一阶段 (Pass 1)：底层暗色/亮色立体衬托描边 (分批一次性批量 BeginPath & Stroke) =====
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = isLight ? 'rgba(255, 255, 255, 0.96)' : 'rgba(11, 15, 25, 0.95)';
  ctx.lineWidth = 7.4;
  ctx.setLineDash([]);

  // 分离常规衬托与半透明淡化衬托，避免淡化血脉线后方呈现显眼的死黑粗线
  const normalUnderlays = [];
  const fadedUnderlays = [];
  for (let i = 0; i < visibleLinks.length; i++) {
    const l = visibleLinks[i];
    const isFaded = l.type === 'heritage' && isAnyRefActive.value && hoveredPipelineId.value !== l.pipelineId;
    if (isFaded) {
      fadedUnderlays.push(l);
    } else {
      normalUnderlays.push(l);
    }
  }

  if (normalUnderlays.length > 0) {
    ctx.beginPath();
    for (let i = 0; i < normalUnderlays.length; i++) {
      const l = normalUnderlays[i];
      ctx.moveTo(l.fromX, l.fromY);
      ctx.bezierCurveTo(l.c1x, l.c1y, l.c2x, l.c2y, l.toX, l.toY);
    }
    ctx.stroke();
  }

  if (fadedUnderlays.length > 0) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    for (let i = 0; i < fadedUnderlays.length; i++) {
      const l = fadedUnderlays[i];
      ctx.moveTo(l.fromX, l.fromY);
      ctx.bezierCurveTo(l.c1x, l.c1y, l.c2x, l.c2y, l.toX, l.toY);
    }
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // ===== 第二阶段 (Pass 2)：高精度流光渐变曲线绘制 =====
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 0; i < visibleLinks.length; i++) {
    const l = visibleLinks[i];
    const isHighlighted = hoveredNodeId.value && l.id.includes(String(hoveredNodeId.value));
    const isFaded = l.type === 'heritage' && isAnyRefActive.value && hoveredPipelineId.value !== l.pipelineId;

    ctx.save();

    // 透明度处理
    if (isFaded) {
      ctx.globalAlpha = 0.18;
    } else {
      ctx.globalAlpha = 1.0;
    }

    // 虚线与流动偏移
    let dashOffset = globalDashOffset;
    if (l.type === 'recent-output') {
      ctx.setLineDash([8, 3]);
      dashOffset = globalDashOffset * 2.2;
    } else if (l.type === 'heritage') {
      ctx.setLineDash([5, 4]);
      dashOffset = globalDashOffset * 0.72;
    } else {
      ctx.setLineDash([6, 3]);
    }
    ctx.lineDashOffset = dashOffset;

    // 线宽与发光阴影
    if (isHighlighted) {
      ctx.lineWidth = 3.6;
      ctx.shadowColor = 'rgba(168, 85, 247, 0.85)';
      ctx.shadowBlur = 10;
    } else if (l.type === 'recent-output') {
      ctx.lineWidth = 2.8;
      ctx.shadowColor = 'rgba(16, 185, 129, 0.7)';
      ctx.shadowBlur = 8;
    } else {
      ctx.lineWidth = l.strokeWidth || 2.2;
      ctx.shadowBlur = 0;
    }

    // 动态线性渐变 (沿曲线从起点指向终点)
    const dist = Math.hypot(l.toX - l.fromX, l.toY - l.fromY);
    if (dist < 1) {
      // 距离极近时纯色兜底，避免 createLinearGradient 产生空色块
      ctx.strokeStyle = l.type === 'recent-output' ? '#10b981' : l.type === 'heritage' ? '#f59e0b' : '#6366f1';
    } else {
      const grad = ctx.createLinearGradient(l.fromX, l.fromY, l.toX, l.toY);
      if (l.type === 'recent-output') {
        grad.addColorStop(0, '#06b6d4');
        grad.addColorStop(1, '#10b981');
      } else if (l.type === 'heritage') {
        grad.addColorStop(0, '#f59e0b');
        grad.addColorStop(1, '#fbbf24');
      } else {
        grad.addColorStop(0, '#6366f1');
        grad.addColorStop(1, '#a855f7');
      }
      ctx.strokeStyle = grad;
    }

    ctx.beginPath();
    ctx.moveTo(l.fromX, l.fromY);
    ctx.bezierCurveTo(l.c1x, l.c1y, l.c2x, l.c2y, l.toX, l.toY);
    ctx.stroke();

    ctx.restore();
  }
  ctx.restore();

  // ===== 第三阶段 (Pass 3)：物理边缘连接端点 (圆圈锚点) =====
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffffff';

  for (let i = 0; i < visibleLinks.length; i++) {
    const l = visibleLinks[i];
    const isFaded = l.type === 'heritage' && isAnyRefActive.value && hoveredPipelineId.value !== l.pipelineId;
    ctx.globalAlpha = isFaded ? 0.18 : 1.0;

    const r = l.type === 'recent-output' ? 5 : 4;
    let fillColor = '#6366f1';
    if (l.type === 'recent-output') fillColor = '#10b981';
    else if (l.type === 'heritage') fillColor = '#f59e0b';

    // 起点
    ctx.beginPath();
    ctx.arc(l.fromX, l.fromY, r, 0, Math.PI * 2);
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.stroke();

    // 终点
    ctx.beginPath();
    ctx.arc(l.toX, l.toY, r, 0, Math.PI * 2);
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  ctx.restore();
};

// 启动 Canvas 2D 流水动画循环
const startCanvasAnimLoop = () => {
  if (!animFrameId && renderEngine.value === 'canvas') {
    lastFrameTime = performance.now();
    animFrameId = requestAnimationFrame(canvasAnimLoop);
  }
};

// Canvas 2D 流光流动动画循环 (满帧且智能防卡顿)
const canvasAnimLoop = (now) => {
  if (renderEngine.value !== 'canvas') {
    animFrameId = null;
    return;
  }
  if (document.hidden) {
    animFrameId = requestAnimationFrame(canvasAnimLoop);
    return; // 切换后台标签页时休眠节省功耗
  }

  const dt = Math.min(100, now - lastFrameTime);
  lastFrameTime = now;

  // 在未平移且有活动连线时，顺畅流转虚线 dashOffset
  if (!isPanning.value && activeLinks.value.length > 0) {
    globalDashOffset = (globalDashOffset - dt * 0.032) % 1000;
    drawConnections(panX.value, panY.value, scale.value);
  }

  animFrameId = requestAnimationFrame(canvasAnimLoop);
};

// 开始平移漫游
const startPanning = (e) => {
  if (viewportAnimId) {
    cancelAnimationFrame(viewportAnimId);
    viewportAnimId = null;
  }
  isPanning.value = true;
  currentPanX = panX.value;
  currentPanY = panY.value;
  startPanX = e.clientX - panX.value;
  startPanY = e.clientY - panY.value;
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
};

// 捕获阶段拦截：确保按住空格键漫游或中键拖动时，即使点击在卡片、覆盖层或按钮上也能统一触发画布漫游
const onViewportMouseDownCapture = (e) => {
  const target = e.target;
  // 底部工具坞保持正常点击交互
  if (target && target.closest('.floating-dock-wrapper')) {
    return;
  }
  // 输入框、文本框等可编辑区域放行正常光标定位与选择
  if (isEditableElement(target)) {
    return;
  }

  // 1. 鼠标中键按下 -> 触发全局平移漫游
  if (e.button === 1) {
    e.preventDefault();
    e.stopPropagation();
    startPanning(e);
    return;
  }

  // 2. 按住空格键 + 鼠标左键 -> 标准抓手漫游交互 (最高优先级，允许在任意卡片或覆盖层上顺畅拖动画布)
  if (e.button === 0 && isSpacePressed.value) {
    e.preventDefault();
    e.stopPropagation();
    startPanning(e);
    return;
  }

  // 3. 抓手模式下 + 鼠标左键 -> 画布平移
  if (e.button === 0 && toolMode.value === 'grab') {
    e.preventDefault();
    e.stopPropagation();
    startPanning(e);
    return;
  }
};

// 平移画布开始 (冒泡兜底)
const onViewportMouseDown = (e) => {
  const target = e.target;
  if (target && (target.closest('.floating-dock-wrapper') || isEditableElement(target))) {
    return;
  }

  if (e.button === 1 || (e.button === 0 && (toolMode.value === 'grab' || isSpacePressed.value))) {
    startPanning(e);
  }
};

// 拖动画布 DOM 直出硬件加速 (直接通过 DOM 引用在 rAF 中更新，彻底绕过 Vue 3 响应式 Tick 与全量 VNode Diff)
const renderPanDirect = () => {
  panRafId = null;
  if (worldEl.value) {
    worldEl.value.style.transform = `translate3d(${currentPanX}px, ${currentPanY}px, 0) scale(${scale.value})`;
  }
  if (gridEl.value) {
    const gridSize = 32 * scale.value;
    const offsetX = Math.round(((currentPanX % gridSize) + gridSize) % gridSize);
    const offsetY = Math.round(((currentPanY % gridSize) + gridSize) % gridSize);
    gridEl.value.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
  }
  if (renderEngine.value === 'canvas') {
    drawConnections(currentPanX, currentPanY, scale.value);
  }
};

// 性能调度器：利用 requestAnimationFrame 节流卡片拖拽高频位移
let dragRafId = null;
let pendingNode = null;
let pendingNodeX = null;
let pendingNodeY = null;

const flushMouseDrag = () => {
  dragRafId = null;
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
    currentPanX = Math.round(e.clientX - startPanX);
    currentPanY = Math.round(e.clientY - startPanY);
    if (!panRafId) {
      panRafId = requestAnimationFrame(renderPanDirect);
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
  if (panRafId) {
    cancelAnimationFrame(panRafId);
    panRafId = null;
  }
  if (dragRafId) {
    cancelAnimationFrame(dragRafId);
    dragRafId = null;
  }
  if (isPanning.value) {
    isPanning.value = false;
    // 手势结束立即将最终坐标刷新到 DOM，避免依赖下一帧微任务的视觉掉帧或停顿
    renderPanDirect();
    panX.value = currentPanX;
    panY.value = currentPanY;
  }
  if (draggingNode) {
    flushMouseDrag();
    draggingNode = null;
  }
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
};

// Space 漫游按键交互检测
const isEditableElement = (el) => {
  if (!el) return false;
  const tagName = el.tagName;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return true;
  if (el.isContentEditable) return true;
  if (el.closest && el.closest('input, textarea, select, [contenteditable="true"], .node-prompt-input, .prompt-textarea')) {
    return true;
  }
  return false;
};

const onKeyDown = (e) => {
  if (e.code === 'Space' || e.key === ' ') {
    if (isEditableElement(e.target) || isEditableElement(document.activeElement)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    if (!e.repeat) {
      isSpacePressed.value = true;
    }
  }
};

const onKeyUp = (e) => {
  if (e.code === 'Space' || e.key === ' ') {
    isSpacePressed.value = false;
  }
};

const onWindowBlur = () => {
  isSpacePressed.value = false;
  if (isPanning.value || draggingNode) {
    onMouseUp();
  }
  if (draggingPipe) {
    onPipeMouseUp();
  }
};

// 滚轮缩放控制
const onWheel = (e) => {
  if (isPanning.value) return; // 平移漫游中阻止滚轮缩放竞争坐标
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
  if (isSpacePressed.value || toolMode.value === 'grab') {
    startPanning(e);
    return;
  }
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

// 视角重置：平滑柔和地对焦至当前活跃创作配置中心卡片
const fitView = () => {
  if (!viewportRef.value) return;
  const vRect = viewportRef.value.getBoundingClientRect();
  const targetScale = 0.95;
  
  const win = activeConfigNode.value || creationWindows.value[0];
  const winX = win ? win.x : 100;
  const winY = win ? win.y : 120;
  const el = win ? winEls.get(win.id) : null;
  const winW = el?.offsetWidth || 440;
  const winH = el?.offsetHeight || 360;

  const nodeCenterX = Math.round(winX + winW / 2);
  const nodeCenterY = Math.round(winY + winH / 2);
  
  const targetPanX = Math.round(vRect.width / 2 - nodeCenterX * targetScale);
  const targetPanY = Math.round(vRect.height / 2 - nodeCenterY * targetScale);
  
  animateViewportSmooth(targetPanX, targetPanY, targetScale, 480);
  emit('show-toast', { message: '视角已平滑聚焦至创作配置中心', type: 'info' });
};

// 触发生成事件 (兼容旧调用，默认调用当前活跃窗口)
const triggerGenerate = () => {
  const win = activeConfigNode.value || creationWindows.value[0];
  if (!win || !win.prompt.trim() || props.isGenerating) return;

  triggerGenerateForWindow(win);
};

// 本地参考图上传 (支持一次多选，上限 16 张，自动前端画布降采样压缩)
const handleLocalRefUpload = (e) => {
  const win = activeConfigNode.value || creationWindows.value[0];
  if (!win) return;
  const files = Array.from(e.target.files || []);
  if (files.length === 0) return;

  if (!win.refImages) win.refImages = [];

  const availableSlots = 16 - win.refImages.length;
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
        const localId = 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const refItem = {
          id: localId,
          url: compressedDataUrl,
          thumbnailUrl: null,
          name: `Image ${win.refImages.length + 1}`,
          parentId: null
        };
        win.refImages.push(refItem);
        createThumbnail(compressedDataUrl).then(thumb => {
          if (thumb) refItem.thumbnailUrl = thumb;
        }).catch(() => {});

        processedCount++;
        if (processedCount === filesToProcess.length) {
          emit('show-toast', { 
            message: `成功载入 ${filesToProcess.length} 张本地参考图 (当前共 ${win.refImages.length}/16 张)`, 
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
  const win = activeConfigNode.value || creationWindows.value[0];
  if (win && win.refImages) {
    const removed = win.refImages.splice(index, 1)[0];
    if (win.refImages.length === 0) {
      win.parentImageId = null;
    } else if (removed && win.parentImageId === (removed.parentId || removed.id)) {
      win.parentImageId = win.refImages[0].parentId || win.refImages[0].id || null;
    }
    emit('show-toast', { message: `已移出参考图 (剩余 ${win.refImages.length} 张)`, type: 'info' });
  }
};

// 清空全部参考图 (恢复为纯独立文生图)
const clearConfigRefImages = () => {
  const win = activeConfigNode.value || creationWindows.value[0];
  if (win) {
    win.refImages = [];
    win.parentImageId = null;
  }
  emit('show-toast', { message: '已清空参考组合，图片已独立，切换为纯文生图', type: 'info' });
};

// 快捷向提示词注入 [Image N] 引用
const insertImageRefToPrompt = (imageIndex) => {
  const win = activeConfigNode.value || creationWindows.value[0];
  if (!win) return;
  const refTag = `Image ${imageIndex}`;
  if (!win.prompt.includes(refTag)) {
    if (win.prompt.trim().length > 0) {
      win.prompt += `，融合 ${refTag} 的视觉特征`;
    } else {
      win.prompt = `以 ${refTag} 为主要参考，`;
    }
  } else {
    win.prompt += ` ${refTag}`;
  }
  emit('show-toast', { message: `已在提示词插入 [${refTag}] 引用`, type: 'info' });
};

// 插入典型多图融合提示词模版
const insertBlendTemplate = () => {
  const win = activeConfigNode.value || creationWindows.value[0];
  if (!win) return;
  const count = win.refImages?.length || 0;
  let template = '';
  if (count === 2) {
    template = '\n将 Image 1 的构图与主体角色，与 Image 2 的艺术画风、材质纹理完美融合。';
  } else if (count >= 3) {
    template = '\n以 Image 1 作为主体人物，融合 Image 2 的服装与材质，置于 Image 3 展现的场景光影中。';
  } else {
    template = '\n参考 Image 1 的视觉细节进行高质量衍生优化。';
  }
  win.prompt = (win.prompt.trim() + template).trim();
  emit('show-toast', { message: '已填充多图融合提示词模版！', type: 'success' });
};

// 核心功能：以此图作为独立基准衍生（调用 setAsSoleReference）
const branchFromImage = (node) => {
  setAsSoleReference(node);
};

// 将画面的 Prompt 拷贝到配置框
const copyPromptToConfig = (prompt) => {
  const win = activeConfigNode.value || creationWindows.value[0];
  if (win) {
    win.prompt = prompt;
  }
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
  creationWindows.value.forEach(win => {
    if (win.refImages) {
      win.refImages = win.refImages.filter(img => img.id !== id && img.parentId !== id);
      if (win.refImages.length === 0) {
        win.parentImageId = null;
      }
    }
    if (win.parentImageId === id) {
      win.parentImageId = null;
    }
    if (win.recentGeneratedIds) {
      win.recentGeneratedIds = win.recentGeneratedIds.filter(gid => gid !== id);
    }
  });
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
  creationWindows.value.forEach(win => {
    win.refImages = [];
    win.parentImageId = null;
    win.recentGeneratedIds = [];
  });
  derivationPipelines.value = [];
  recentGeneratedNodeId.value = null;
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

// 核心排版辅助：智能寻找创作窗口四周自然散落的空槽位 (自然错落四周，不拘泥确切方向，靠近创作窗口，重合部分极小)
const findSmartSurroundingSlot = (targetWin, isReference = false) => {
  const win = targetWin || activeConfigNode.value || creationWindows.value[0];
  const el = win ? winEls.get(win.id) : null;
  const winW = el?.offsetWidth || 440;
  const winH = el?.offsetHeight || 360;
  const winCenterX = win ? (win.x + winW / 2) : 320;
  const winCenterY = win ? (win.y + winH / 2) : 300;

  const CARD_W = 280;
  const CARD_H = 330;

  // 创作中心硬避让安全盒 (绝不允许遮挡创作窗口中心与输入区)
  const isWindowCovered = (cx, cy) => {
    return (
      Math.abs(cx - winCenterX) < (winW + CARD_W) / 2 + 30 &&
      Math.abs(cy - winCenterY) < (winH + CARD_H) / 2 + 25
    );
  };

  // 计算与现有已有卡片的重叠情况 (重合部分注意要小)
  const calculateNodeOverlap = (cx, cy) => {
    let maxOverlapArea = 0;
    let totalOverlapArea = 0;
    for (const node of imageNodes.value) {
      const nW = node.width || CARD_W;
      const nH = getNodeHeight(node);
      const nCenterX = node.x + nW / 2;
      const nCenterY = node.y + nH / 2;

      const ox = Math.max(0, (CARD_W + nW) / 2 - Math.abs(cx - nCenterX));
      const oy = Math.max(0, (CARD_H + nH) / 2 - Math.abs(cy - nCenterY));

      if (ox > 0 && oy > 0) {
        const area = ox * oy;
        totalOverlapArea += area;
        if (area > maxOverlapArea) maxOverlapArea = area;
      }
    }
    return { maxOverlapArea, totalOverlapArea };
  };

  // 轨道半径：紧密贴近创作窗口！基准间距仅 65px~80px (如用户图四所示的自然环绕)
  const baseRx = (winW + CARD_W) / 2 + 75; // ~435px
  const baseRy = (winH + CARD_H) / 2 + 55; // ~400px

  // 稠密自然有机角度池 (带有根据当前卡片数量的微扰动，打破死板的方向感)
  const existingCount = imageNodes.value.length;
  const jitterOffset = (((existingCount * 37) % 29) - 14) * (Math.PI / 180);

  const candidateAngles = [];
  const numSteps = 32;
  for (let i = 0; i < numSteps; i++) {
    const rawAngle = (i / numSteps) * Math.PI * 2 + jitterOffset;
    candidateAngles.push(rawAngle);
  }

  // 排序偏好：参考图优先偏向西/西北/西南，成果图优先偏向东/东北/东南，但允许360°任何可用空位
  candidateAngles.sort((a, b) => {
    if (isReference) {
      return Math.cos(a) - Math.cos(b);
    } else {
      return Math.cos(b) - Math.cos(a);
    }
  });

  const ringLayers = [
    { rx: baseRx, ry: baseRy, penalty: 0 },
    { rx: baseRx + 190, ry: baseRy + 170, penalty: 5000 },
    { rx: baseRx + 380, ry: baseRy + 340, penalty: 15000 }
  ];

  let bestSlot = null;
  let minScore = Infinity;

  for (const ring of ringLayers) {
    for (const angle of candidateAngles) {
      const cx = Math.round(winCenterX + ring.rx * Math.cos(angle));
      const cy = Math.round(winCenterY + ring.ry * Math.sin(angle));

      if (isWindowCovered(cx, cy)) continue;

      const { maxOverlapArea, totalOverlapArea } = calculateNodeOverlap(cx, cy);

      // 完全零重叠且在第一圈，直接采用
      if (totalOverlapArea === 0 && ring.penalty === 0) {
        return {
          x: Math.round(cx - CARD_W / 2),
          y: Math.round(cy - CARD_H / 2)
        };
      }

      const dirPenalty = isReference 
        ? (Math.cos(angle) > 0 ? 800 : 0) 
        : (Math.cos(angle) < 0 ? 800 : 0);

      const score = maxOverlapArea * 10 + totalOverlapArea + ring.penalty + dirPenalty;
      if (score < minScore) {
        minScore = score;
        bestSlot = {
          x: Math.round(cx - CARD_W / 2),
          y: Math.round(cy - CARD_H / 2)
        };
      }
    }

    if (bestSlot && minScore < 2000 + ring.penalty + 1000) {
      return bestSlot;
    }
  }

  return bestSlot || {
    x: Math.round(winCenterX + (isReference ? -baseRx : baseRx) - CARD_W / 2),
    y: Math.round(winCenterY - CARD_H / 2)
  };
};

// 自动排版对齐：围绕创作窗口四周自然散落环绕 (Surrounding Constellation Layout)
// 自由而乱中有序，拒绝死板刻板方向与高耸图腾柱，连线舒展，整体高度紧凑适宜 (如用户图四所示)
const autoOrganizeNodes = () => {
  const CARD_WIDTH = 280;
  const CARD_HEIGHT = 330;

  if (creationWindows.value.length === 0) return;

  const targetsMap = new Map();
  const allNodes = imageNodes.value;
  const nodeMap = new Map();
  allNodes.forEach(n => nodeMap.set(n.id, n));

  // 1. 排布各个创作窗口的位置 (如果有多个窗口，水平间隔 1450px 依次排开)
  const winMoveList = [];
  const baseSpacing = 1450;
  const startX = 650;
  const startY = 500;

  creationWindows.value.forEach((win, wIdx) => {
    const winTargetX = startX + wIdx * baseSpacing;
    const winTargetY = startY;
    winMoveList.push({
      node: win,
      startX: win.x,
      startY: win.y,
      targetX: winTargetX,
      targetY: winTargetY
    });
  });

  // 2. 针对每个创作窗口，收集其归属的参考图、衍生图与自由节点
  const assignedNodeIds = new Set();

  creationWindows.value.forEach((win, wIdx) => {
    const winTargetX = startX + wIdx * baseSpacing;
    const winTargetY = startY;
    const el = winEls.get(win.id);
    const winW = el?.offsetWidth || 440;
    const winH = el?.offsetHeight || 360;
    const winCenterX = winTargetX + winW / 2;
    const winCenterY = winTargetY + winH / 2;

    // A. 提取归属此窗口的参考图
    const refIds = [];
    if (win.refImages && win.refImages.length > 0) {
      win.refImages.forEach(refItem => {
        const tid = refItem.parentId || refItem.id;
        if (tid && nodeMap.has(tid) && !refIds.includes(tid) && !assignedNodeIds.has(tid)) {
          refIds.push(tid);
          assignedNodeIds.add(tid);
        }
      });
    }

    // B. 提取归属此窗口的生成图 (由该窗口产生)
    const genIds = [];
    allNodes.forEach(node => {
      if (!assignedNodeIds.has(node.id)) {
        const belongsToThisWin = node.sourceWindowId === win.id || 
          (Array.isArray(node.sourceRefIds) && node.sourceRefIds.some(rId => refIds.includes(rId)));
        if (belongsToThisWin) {
          genIds.push(node.id);
          assignedNodeIds.add(node.id);
        }
      }
    });

    // C. 归属此窗口周边的自由节点
    const freeIds = [];
    allNodes.forEach(node => {
      if (!assignedNodeIds.has(node.id)) {
        if (creationWindows.value.length === 1 || Math.abs(node.x - win.x) < baseSpacing / 2) {
          freeIds.push(node.id);
          assignedNodeIds.add(node.id);
        }
      }
    });

    // 核心轨道尺寸：紧密贴近创作窗口，拒绝垂直拉长，保持宜人的 16:9 / 4:3 宽高比
    const baseRx = (winW + CARD_WIDTH) / 2 + 75; // ~435px
    const baseRy = (winH + CARD_HEIGHT) / 2 + 55; // ~400px

    // 乱中有序分布算法：
    // 参考图错落摆放在左半周 (西面、西北、西南、正北侧，角度 115°~245°)
    if (refIds.length > 0) {
      const nRef = refIds.length;
      refIds.forEach((id, idx) => {
        const layer = nRef > 6 ? Math.floor(idx / 5) : 0;
        const idxInLayer = nRef > 6 ? (idx % 5) : idx;
        const countInLayer = nRef > 6 ? Math.min(5, nRef - layer * 5) : nRef;

        const rx = baseRx + layer * 210;
        const ry = baseRy + layer * 190;

        const span = Math.min(Math.PI * 0.76, 0.22 * Math.PI * countInLayer);
        const centerAngle = Math.PI; // 正西
        const startAngle = centerAngle - span / 2;
        const step = countInLayer > 1 ? span / (countInLayer - 1) : 0;
        const jitter = (((idx * 17) % 11) - 5) * 0.02; // 微小错落扰动
        const angle = countInLayer === 1 ? centerAngle : (startAngle + idxInLayer * step + jitter);

        const targetX = Math.round(winCenterX + rx * Math.cos(angle) - CARD_WIDTH / 2);
        const targetY = Math.round(winCenterY + ry * Math.sin(angle) - CARD_HEIGHT / 2);
        targetsMap.set(id, { x: targetX, y: targetY, origAngle: angle, rx, ry });
      });
    }

    // 成果图错落摆放在右半周 (东面、东北、东南、正南侧，角度 -65°~+65°)
    if (genIds.length > 0) {
      const nGen = genIds.length;
      genIds.forEach((id, idx) => {
        const layer = nGen > 6 ? Math.floor(idx / 5) : 0;
        const idxInLayer = nGen > 6 ? (idx % 5) : idx;
        const countInLayer = nGen > 6 ? Math.min(5, nGen - layer * 5) : nGen;

        const rx = baseRx + layer * 210;
        const ry = baseRy + layer * 190;

        const span = Math.min(Math.PI * 0.76, 0.22 * Math.PI * countInLayer);
        const centerAngle = 0; // 正东
        const startAngle = centerAngle - span / 2;
        const step = countInLayer > 1 ? span / (countInLayer - 1) : 0;
        const jitter = (((idx * 13) % 11) - 5) * 0.02;
        const angle = countInLayer === 1 ? centerAngle : (startAngle + idxInLayer * step + jitter);

        const targetX = Math.round(winCenterX + rx * Math.cos(angle) - CARD_WIDTH / 2);
        const targetY = Math.round(winCenterY + ry * Math.sin(angle) - CARD_HEIGHT / 2);
        targetsMap.set(id, { x: targetX, y: targetY, origAngle: angle, rx, ry });
      });
    }

    // 自由节点：摆放在正上方、正下方及环上空余槽位 (绝不垂直叠加成柱，而是在椭圆环上横向散开)
    if (freeIds.length > 0) {
      freeIds.forEach((id, idx) => {
        const rx = baseRx + (idx >= 6 ? 210 : 0);
        const ry = baseRy + (idx >= 6 ? 190 : 0);

        // 奇数在上，偶数在下，带有横向偏置，绝不竖排
        const isTop = idx % 2 === 0;
        const pairIndex = Math.floor(idx / 2);
        const horizontalOffsetAngle = (pairIndex * 0.26) * (pairIndex % 2 === 0 ? 1 : -1);
        const baseA = isTop ? -Math.PI * 0.5 : Math.PI * 0.5;
        const angle = baseA + horizontalOffsetAngle;

        const targetX = Math.round(winCenterX + rx * Math.cos(angle) - CARD_WIDTH / 2);
        const targetY = Math.round(winCenterY + ry * Math.sin(angle) - CARD_HEIGHT / 2);
        targetsMap.set(id, { x: targetX, y: targetY, origAngle: angle, rx, ry });
      });
    }
  });

  // 处理剩余未分配的全局节点
  const remaining = allNodes.filter(n => !assignedNodeIds.has(n.id));
  if (remaining.length > 0) {
    const firstWin = creationWindows.value[0];
    const winTarget = winMoveList[0];
    const el = winEls.get(firstWin.id);
    const winW = el?.offsetWidth || 440;
    const winH = el?.offsetHeight || 360;
    const winCenterX = winTarget.targetX + winW / 2;
    const winCenterY = winTarget.targetY + winH / 2;
    const baseRx = (winW + CARD_WIDTH) / 2 + 80;
    const baseRy = (winH + CARD_HEIGHT) / 2 + 60;

    remaining.forEach((node, idx) => {
      const angle = (idx / remaining.length) * Math.PI * 2 + 0.3;
      targetsMap.set(node.id, {
        x: Math.round(winCenterX + (baseRx + 210) * Math.cos(angle) - CARD_WIDTH / 2),
        y: Math.round(winCenterY + (baseRy + 190) * Math.sin(angle) - CARD_HEIGHT / 2)
      });
    });
  }

  // 3. 弹性物理排斥松弛阶段 (Physics Relaxation Pass - 乱中有序，重合微小，高度紧凑)
  const placedTargets = Array.from(targetsMap.entries()).map(([id, pos]) => ({
    id,
    x: pos.x,
    y: pos.y,
    w: CARD_WIDTH,
    h: CARD_HEIGHT,
    origY: pos.y
  }));

  const MIN_DIST_X = 290;
  const MIN_DIST_Y = 340;

  for (let iter = 0; iter < 25; iter++) {
    let changed = false;

    // A. 卡片与卡片之间的弹性分离
    for (let i = 0; i < placedTargets.length; i++) {
      for (let j = i + 1; j < placedTargets.length; j++) {
        const a = placedTargets[i];
        const b = placedTargets[j];
        const dx = (b.x + b.w / 2) - (a.x + a.w / 2);
        const dy = (b.y + b.h / 2) - (a.y + a.h / 2);
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        if (absX < MIN_DIST_X && absY < MIN_DIST_Y) {
          const overlapX = MIN_DIST_X - absX;
          const overlapY = MIN_DIST_Y - absY;

          if (overlapX / MIN_DIST_X < overlapY / MIN_DIST_Y) {
            const shift = overlapX * 0.45 + 2;
            const sign = dx >= 0 ? 1 : -1;
            b.x += shift * sign;
            a.x -= shift * sign;
          } else {
            const shift = overlapY * 0.45 + 2;
            const sign = dy >= 0 ? 1 : -1;
            b.y += shift * sign;
            a.y -= shift * sign;
          }
          changed = true;
        }
      }
    }

    // B. 卡片避让创作窗口 (绝不允许挡住创作中心)
    for (const item of placedTargets) {
      for (const wMove of winMoveList) {
        const el = winEls.get(wMove.node.id);
        const winW = el?.offsetWidth || 440;
        const winH = el?.offsetHeight || 360;
        const winCenterX = wMove.targetX + winW / 2;
        const winCenterY = wMove.targetY + winH / 2;

        const dx = (item.x + item.w / 2) - winCenterX;
        const dy = (item.y + item.h / 2) - winCenterY;
        const safeHalfW = (winW + item.w) / 2 + 35;
        const safeHalfH = (winH + item.h) / 2 + 25;

        if (Math.abs(dx) < safeHalfW && Math.abs(dy) < safeHalfH) {
          const penX = safeHalfW - Math.abs(dx);
          const penY = safeHalfH - Math.abs(dy);
          if (penX / safeHalfW < penY / safeHalfH) {
            item.x += penX * (dx >= 0 ? 1 : -1) * 0.6;
          } else {
            item.y += penY * (dy >= 0 ? 1 : -1) * 0.6;
          }
          changed = true;
        }
      }

      // C. 柔性约束：防止高度拉伸过长，向宜人宽屏比例收拢
      if (item.origY !== undefined) {
        item.y += (item.origY - item.y) * 0.08;
      }
    }

    if (!changed) break;
  }

  placedTargets.forEach(t => {
    targetsMap.set(t.id, { x: Math.round(t.x), y: Math.round(t.y) });
  });

  // 4. 构建全部节点的平滑移动任务列表
  const moveList = [...winMoveList];
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

  // 5. 启动平滑排版位移动画，完成后自动运镜聚焦包围盒
  animateNodesSmooth(moveList, 520, () => {
    fitNodesInView(moveList.map(m => {
      const isWin = creationWindows.value.includes(m.node);
      const el = isWin ? winEls.get(m.node.id) : null;
      return { 
        x: m.targetX, 
        y: m.targetY, 
        w: isWin ? (el?.offsetWidth || 440) : CARD_WIDTH, 
        h: isWin ? (el?.offsetHeight || 360) : CARD_HEIGHT 
      };
    }));
  });

  emit('show-toast', { 
    message: '已完成四周自然错落排版！乱中有序，高度适宜，脉络连线清晰灵动', 
    type: 'success' 
  });
};

// 监听新的生成图片，推送到画布中呈现 (支持定位到触发该生成的创作窗口，并支持一次生成多张各连一根发光线)
const addGeneratedImageToCanvas = (record, parentIds = null, offsetIndex = 0, windowId = null) => {
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

  // 找到对应的创作窗口
  const sourceWin = (windowId && creationWindows.value.find(w => w.id === windowId)) || activeConfigNode.value || creationWindows.value[0];
  const el = sourceWin ? winEls.get(sourceWin.id) : null;
  const winW = el?.offsetWidth || 440;

  let targetX = (sourceWin ? sourceWin.x : 100) + winW + 120;
  let targetY = (sourceWin ? sourceWin.y : 120);

  if (parents.length > 0) {
    const parentNodes = imageNodes.value.filter(n => parents.includes(n.id));
    if (parentNodes.length > 0) {
      const maxX = Math.max(...parentNodes.map(p => p.x + (p.width || 280)));
      targetX = maxX + 180;
      const avgY = Math.round(parentNodes.reduce((sum, p) => sum + p.y, 0) / parentNodes.length);
      targetY = avgY + (offsetIndex * 380);
    }
  } else {
    const slot = findSmartSurroundingSlot(sourceWin, false);
    targetX = slot.x;
    targetY = slot.y;
  }

  const newNode = {
    id: record.id,
    url: record.url,
    thumbnailUrl: record.thumbnailUrl || null,
    prompt: record.prompt,
    model: record.model,
    ratio: record.ratio || '1:1',
    width: 290,
    x: Math.round(targetX),
    y: Math.round(targetY),
    parentId: parents[0] || null,
    parentIds: parents,
    isRecentGenerated: true,
    sourceRefIds: [...parents],
    sourcePrompt: record.prompt,
    sourceModel: record.model,
    sourceRatio: record.ratio || '1:1',
    sourceWindowId: sourceWin ? sourceWin.id : null,
    generatedAt: new Date().toLocaleTimeString()
  };

  imageNodes.value.push(newNode);
  ensureNodeThumbnail(newNode);
  selectedNodeId.value = newNode.id;
  recentGeneratedNodeId.value = newNode.id;

  // 关键：将新图加入该窗口的近期生成产物列表 (支持单次生图任务一次生成多张各连一根发光线)
  if (sourceWin) {
    if (!sourceWin.recentGeneratedIds) sourceWin.recentGeneratedIds = [];
    sourceWin.recentGeneratedIds.push(newNode.id);
  }
};

// 外部调用：兼容旧方法
const loadExternalImageToCanvas = (item) => {
  let existing = imageNodes.value.find(n => n.id === item.id);
  const win = activeConfigNode.value || creationWindows.value[0];

  if (!existing) {
    const slot = findSmartSurroundingSlot(win, false);
    existing = {
      id: item.id,
      url: item.url,
      thumbnailUrl: item.thumbnailUrl || null,
      prompt: item.prompt,
      model: item.model,
      width: 280,
      x: slot.x,
      y: slot.y,
      parentId: null
    };
    imageNodes.value.push(existing);
    ensureNodeThumbnail(existing);
  }
  selectedNodeId.value = item.id;
};

// 外部调用新功能：画廊点击“设为参考图”（加入画布 + 设为参考图，四周智能空闲槽位，绝不悬浮重叠）
const addGalleryItemAsReference = (item) => {
  const win = activeConfigNode.value || creationWindows.value[0];
  if (!win) return { added: false, message: '无可用创作窗口' };
  if (!win.refImages) win.refImages = [];

  const existingInRef = win.refImages.find(r => r.id === item.id || r.parentId === item.id);
  if (existingInRef) {
    // 如果已经在参考中，移出它
    removeNodeFromRefImages(item.id);
    return { added: false, message: '已从参考组合中移出' };
  }

  if (win.refImages.length >= 16) {
    emit('show-toast', { message: '已达参考图上限 (单次最多 16 张)', type: 'error' });
    return { added: false, message: '已达上限' };
  }

  // 确保在画布上有合法坐标的节点卡片 (四周智能空闲槽位)
  let node = imageNodes.value.find(n => n.id === item.id);
  if (!node) {
    const slot = findSmartSurroundingSlot(win, true);
    node = {
      id: item.id,
      url: item.url,
      thumbnailUrl: item.thumbnailUrl || null,
      prompt: item.prompt,
      model: item.model,
      width: 280,
      x: slot.x,
      y: slot.y,
      parentId: null
    };
    imageNodes.value.push(node);
    ensureNodeThumbnail(node);
  }

  if (win.refImages.length === 0) {
    win.prompt = '';
    win.parentImageId = item.id;
  }

  win.refImages.push({
    id: item.id,
    url: item.url,
    thumbnailUrl: item.thumbnailUrl || null,
    name: `Image ${win.refImages.length + 1}`,
    parentId: item.id
  });

  selectedNodeId.value = item.id;
  return { added: true, index: win.refImages.length };
};

// 外部调用新功能：画廊点击“加入到画布”（仅加入画布作为独立图片，四周智能空闲分布，绝不单侧死板堆叠）
const addGalleryItemToCanvas = (item) => {
  let node = imageNodes.value.find(n => n.id === item.id);
  if (node) {
    selectedNodeId.value = node.id;
    return { alreadyExists: true };
  }

  const win = activeConfigNode.value || creationWindows.value[0];
  const slot = findSmartSurroundingSlot(win, false);

  const newNode = {
    id: item.id,
    url: item.url,
    thumbnailUrl: item.thumbnailUrl || null,
    prompt: item.prompt,
    model: item.model,
    width: 280,
    x: slot.x,
    y: slot.y,
    parentId: null
  };
  imageNodes.value.push(newNode);
  ensureNodeThumbnail(newNode);
  selectedNodeId.value = item.id;
  return { alreadyExists: false };
};

// 批量从画廊设为参考图
const batchAddGalleryItemsAsReference = (items) => {
  const win = activeConfigNode.value || creationWindows.value[0];
  if (!win) return 0;
  if (!win.refImages) win.refImages = [];
  let count = 0;
  items.forEach(item => {
    if (win.refImages.length < 16 && !win.refImages.some(r => r.id === item.id || r.parentId === item.id)) {
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
  finishWindowGenerate,
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
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onWindowBlur);

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
    const win = activeConfigNode.value || creationWindows.value[0];
    initialItems.forEach((item) => {
      const slot = findSmartSurroundingSlot(win, false);
      const initNode = {
        id: item.id,
        url: item.url,
        thumbnailUrl: item.thumbnailUrl || null,
        prompt: item.prompt,
        model: item.model,
        width: 280,
        x: slot.x,
        y: slot.y,
        parentId: null
      };
      imageNodes.value.push(initNode);
      ensureNodeThumbnail(initNode);
    });
  }

  // 启动 Canvas 2D 连线渲染引擎与自适应物理分辨率监听
  nextTick(() => {
    updateCanvasSize();
    if (renderEngine.value === 'canvas') {
      drawConnections(panX.value, panY.value, scale.value);
    }
  });

  if (viewportRef.value) {
    viewportResizeObserver = new ResizeObserver(() => {
      updateCanvasSize();
      if (renderEngine.value === 'canvas') {
        drawConnections(panX.value, panY.value, scale.value);
      }
    });
    viewportResizeObserver.observe(viewportRef.value);
  }

  // 监听主题切换，即时刷新 Canvas 2D 衬托连线暗色/亮色
  themeObserver = new MutationObserver(() => {
    if (renderEngine.value === 'canvas') {
      drawConnections(panX.value, panY.value, scale.value);
    }
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

  document.addEventListener('visibilitychange', handleVisibilityChange);

  startCanvasAnimLoop();
});

// 浏览器标签页切回前台时唤醒动画
const handleVisibilityChange = () => {
  if (!document.hidden && renderEngine.value === 'canvas') {
    lastFrameTime = performance.now();
    startCanvasAnimLoop();
    drawConnections(panX.value, panY.value, scale.value);
  }
};

// 监听响应式数据变动即刻重绘 Canvas 连线 (零滞后)
watch([panX, panY, scale, activeLinks, hoveredNodeId, hoveredPipelineId], () => {
  if (renderEngine.value === 'canvas') {
    drawConnections(panX.value, panY.value, scale.value);
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
  window.removeEventListener('blur', onWindowBlur);
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
  window.removeEventListener('mousemove', onPipeMouseMove);
  window.removeEventListener('mouseup', onPipeMouseUp);
  document.removeEventListener('visibilitychange', handleVisibilityChange);

  if (themeObserver) {
    themeObserver.disconnect();
    themeObserver = null;
  }
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  if (viewportResizeObserver) {
    viewportResizeObserver.disconnect();
    viewportResizeObserver = null;
  }
  if (configResizeObserver) {
    configResizeObserver.disconnect();
    configResizeObserver = null;
  }
  if (panRafId) {
    cancelAnimationFrame(panRafId);
    panRafId = null;
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

.canvas-viewport.panning,
.canvas-viewport.panning * {
  cursor: grabbing !important;
}

/* 性能极致优化：拖动画布漫游时阻止指针穿透并开启 GPU 合成层 */
.canvas-viewport.panning .canvas-world {
  pointer-events: none !important;
  will-change: transform;
}

/* 1. 平移态 GPU 负载全局熔断 (CSS 降级策略) */
.canvas-viewport.panning .canvas-node,
.canvas-viewport.panning .glass-panel,
.canvas-viewport.panning .config-node,
.canvas-viewport.panning .node-prompt-callout,
.canvas-viewport.panning .branch-heritage-tag {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  background: rgba(13, 18, 34, 0.94) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35) !important;
  transition: none !important;
}

.canvas-viewport.panning .canvas-node *,
.canvas-viewport.panning .glass-panel *,
.canvas-viewport.panning .config-node *,
.canvas-viewport.panning .node-prompt-callout *,
.canvas-viewport.panning .branch-heritage-tag * {
  transition: none !important;
}

:root[data-theme="light"] .canvas-viewport.panning .canvas-node,
:root[data-theme="light"] .canvas-viewport.panning .glass-panel,
:root[data-theme="light"] .canvas-viewport.panning .config-node,
:root[data-theme="light"] .canvas-viewport.panning .node-prompt-callout,
:root[data-theme="light"] .canvas-viewport.panning .branch-heritage-tag,
.light-theme .canvas-viewport.panning .canvas-node,
.light-theme .canvas-viewport.panning .glass-panel,
.light-theme .canvas-viewport.panning .config-node,
.light-theme .canvas-viewport.panning .node-prompt-callout,
.light-theme .canvas-viewport.panning .branch-heritage-tag {
  background: rgba(255, 255, 255, 0.96) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12) !important;
}

.canvas-viewport.panning .connections-layer,
.canvas-viewport.panning .connection-curve,
.canvas-viewport.panning .connections-layer * {
  animation-play-state: paused !important;
  filter: none !important;
  transition: none !important;
}

/* Space 键漫游就绪状态 (光标切换为抓手) */
.canvas-viewport.space-panning-ready,
.canvas-viewport.space-panning-ready * {
  cursor: grab !important;
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
  text-rendering: optimizeLegibility;
  z-index: 2;
}

/* 视口网格点阵背景 (优化：仅铺满视口+微余量，固定 0 0 点阵，由 GPU translate3d 驱动，彻底消除每帧全屏 Repaint) */
.canvas-grid-bg {
  position: absolute;
  top: -128px;
  left: -128px;
  width: calc(100% + 256px);
  height: calc(100% + 256px);
  pointer-events: none;
  background-image: radial-gradient(var(--canvas-grid-dot) 1.2px, transparent 1.2px);
  background-position: 0 0;
  will-change: transform;
}

/* Canvas 2D 高性能批量连线渲染图层 (视口原生分辨率，零 DOM 节点，单次 Draw Call 极致流畅) */
.connections-canvas-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.render-engine-dock-btn {
  padding: 0 6px !important;
}

.render-engine-dock-btn .engine-badge {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.5px;
  padding: 2px 5px;
  border-radius: 4px;
  background: rgba(99, 102, 241, 0.15);
  color: var(--accent-indigo);
  border: 1px solid rgba(99, 102, 241, 0.3);
  transition: all 0.2s ease;
}

.render-engine-dock-btn.active .engine-badge {
  background: var(--accent-indigo);
  color: #ffffff;
  border-color: var(--accent-indigo);
}

/* 贝塞尔连线层 (矢量自适应溢出容器，避免 1 亿像素巨型 raster 纹理，硬件层渲染极速流畅) */
.connections-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
  contain: layout style;
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

.connection-curve.faded-heritage,
.connection-curve-underlay.faded-heritage {
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
  transition: box-shadow 0.25s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s ease;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
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

/* 1. 生图主控制节点 (圆润饱满、高清晰度毛玻璃) */
.config-node {
  width: 440px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: rgba(14, 18, 32, 0.92);
  backdrop-filter: blur(28px);
  -webkit-backdrop-filter: blur(28px);
  text-rendering: optimizeLegibility;
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

.node-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
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

/* 2. 图像卡片节点 (圆润饱满 Bento) 与现代浏览器原生视锥剔除 */
.canvas-node.image-node,
.image-node {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: absolute;
  border-radius: var(--radius-lg);
  content-visibility: auto;
  contain-intrinsic-size: 290px 380px;
  contain: layout style paint;
}

/* 提示词气泡弹层展开或处于拖拽状态时解除 paint 裁剪与 visibility 限制，保证气泡完整向上展示且拖动不突兀剔除 */
.canvas-node.image-node.has-active-popover,
.canvas-node.image-node.is-dragging,
.canvas-node.image-node:has(.node-prompt-callout) {
  contain: layout style !important;
  content-visibility: visible !important;
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

/* 多创作窗口支持样式 */
.is-active-window {
  border-color: var(--primary-color) !important;
  box-shadow: 0 0 0 2px var(--accent-glow), var(--shadow-lg) !important;
}

.active-win-tag {
  font-size: 0.65rem;
  padding: 1px 6px;
  background: var(--accent-indigo-bg);
  color: var(--primary-color);
  border-radius: var(--radius-micro);
  font-weight: 600;
  margin-left: 6px;
}

.win-close-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  width: 24px;
  height: 24px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-fast);
}

.win-close-btn:hover {
  background: rgba(244, 63, 94, 0.2);
  border-color: rgba(244, 63, 94, 0.5);
  color: #fb7185;
}

.add-win-dock-btn {
  width: auto !important;
  padding: 0 11px;
  gap: 5px;
  background: var(--primary-gradient);
  color: #ffffff !important;
  font-weight: 600;
  box-shadow: 0 2px 8px var(--accent-glow);
}

.add-win-dock-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px var(--accent-glow);
}

.remove-win-dock-btn {
  width: auto !important;
  padding: 0 11px;
  gap: 5px;
  background: rgba(244, 63, 94, 0.12);
  border: 1px solid rgba(244, 63, 94, 0.3) !important;
  color: #fb7185 !important;
  font-weight: 600;
  transition: var(--transition-fast);
}

.remove-win-dock-btn:hover {
  background: rgba(244, 63, 94, 0.25);
  border-color: rgba(244, 63, 94, 0.6) !important;
  color: #ffffff !important;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(244, 63, 94, 0.25);
}

.dock-btn-label {
  font-size: 0.74rem;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .floating-dock-wrapper {
    bottom: 12px;
    max-width: 96vw;
  }
  .dock-panel {
    gap: 4px;
    padding: 3px 6px;
    overflow-x: auto;
  }
  .render-engine-dock-btn {
    padding: 0 4px !important;
  }
}
</style>
