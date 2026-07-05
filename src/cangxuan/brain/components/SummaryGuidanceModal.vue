<template>
  <div v-show="visible" class="zhino-sg-overlay" :class="{ mobile: isMobile }" :style="overlayStyle" @click.self="$emit('skip')">
    <div class="zhino-sg-card">
      <div class="zhino-sg-header">
        <span class="zhino-sg-title">📝 剧情总结即将开始</span>
        <button class="zhino-sg-close" @click="$emit('cancel')">✕</button>
      </div>
      <div class="zhino-sg-body">
        <p class="zhino-sg-desc">
          智脑即将对最近的剧情进行总结。<br>
          你可以写下最想保留的记忆要点，AI 将围绕这些方向展开总结。<br>
          <span class="zhino-sg-hint">留空则由 AI 自行判断总结方向。</span>
        </p>
        <textarea
          ref="textareaRef"
          v-model="userGuidance"
          class="zhino-sg-textarea"
          placeholder="例如：&#10;• 白娅在湖边的告白很重要&#10;• 主角获得了火焰剑&#10;• 与商人的交易细节不要遗漏&#10;• 洛月对主角态度的微妙变化"
          rows="6"
        />
        <div class="zhino-sg-info">
          <span>待总结楼层: {{ pendingFloors }} 层</span>
          <span>预计耗时: 30-60秒</span>
        </div>
      </div>
      <div class="zhino-sg-footer">
        <button class="zhino-sg-btn secondary" @click="$emit('skip')">跳过（AI自行判断）</button>
        <button class="zhino-sg-btn primary" @click="onConfirm">开始总结</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  visible: boolean;
  pendingFloors: number;
  initialGuidance?: string;
  isMobile?: boolean;
}>();

const emit = defineEmits<{
  confirm: [guidance: string];
  skip: [];
  cancel: [];
}>();

const userGuidance = ref('');
const textareaRef = ref<HTMLTextAreaElement | null>(null);

// ═══ overlay 填满父窗口：position:fixed + inline px ═══
// 关键：快照模式——在 visible 变为 true 时获取一次尺寸，之后不再变化
// 避免键盘弹出后 viewport 变化导致 overlay 延迟缩小、弹窗被裁切
const overlaySize = ref({ w: 0, h: 0 });

watch(() => props.visible, (val) => {
  if (val) {
    // 快照当前父窗口尺寸
    const hw = window.parent ?? window;
    overlaySize.value = {
      w: hw.innerWidth,
      h: hw.innerHeight,
    };
    userGuidance.value = props.initialGuidance || '';
    nextTick(() => textareaRef.value?.focus());
  }
});

const overlayStyle = computed(() => ({
  left: '0px',
  top: '0px',
  width: overlaySize.value.w + 'px',
  height: overlaySize.value.h + 'px',
}));

function onConfirm() {
  emit('confirm', userGuidance.value.trim());
}
</script>

<style scoped>
.zhino-sg-overlay {
  position: fixed;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
/* 手机端：卡片上移 + 缩小，避免键盘遮挡按钮 */
.zhino-sg-overlay.mobile {
  align-items: flex-start;
  padding: 5vh 16px 16px;
}
.zhino-sg-card {
  background: #0a0d14;
  border: 1px solid rgba(167, 139, 250, 0.2);
  border-radius: 12px;
  box-shadow: 0 0 40px rgba(167, 139, 250, 0.1), 0 20px 60px rgba(0, 0, 0, 0.5);
  width: 100%;
  max-width: 480px;
  max-height: 90%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.zhino-sg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(167, 139, 250, 0.12);
}
.zhino-sg-title {
  font-size: 14px;
  font-weight: 600;
  color: #a78bfa;
}
.zhino-sg-close {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.zhino-sg-close:hover {
  background: rgba(167, 139, 250, 0.15);
  color: #a78bfa;
}
.zhino-sg-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.zhino-sg-desc {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.75);
  line-height: 1.6;
  margin: 0;
}
.zhino-sg-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}
.zhino-sg-textarea {
  width: 100%;
  min-height: 120px;
  padding: 10px 12px;
  border: 1px solid rgba(167, 139, 250, 0.2);
  border-radius: 8px;
  background: rgba(5, 8, 16, 0.8);
  color: rgba(255, 255, 255, 0.88);
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
  font-family: inherit;
  box-sizing: border-box;
}
.zhino-sg-textarea:focus {
  outline: none;
  border-color: rgba(167, 139, 250, 0.5);
  box-shadow: 0 0 0 2px rgba(167, 139, 250, 0.1);
}
.zhino-sg-textarea::placeholder {
  color: rgba(255, 255, 255, 0.25);
}
.zhino-sg-info {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
}
.zhino-sg-footer {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid rgba(167, 139, 250, 0.12);
}
.zhino-sg-btn {
  flex: 1;
  padding: 9px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
}
.zhino-sg-btn.primary {
  background: rgba(167, 139, 250, 0.15);
  border-color: rgba(167, 139, 250, 0.3);
  color: #a78bfa;
}
.zhino-sg-btn.primary:hover {
  background: rgba(167, 139, 250, 0.25);
  border-color: rgba(167, 139, 250, 0.5);
}
.zhino-sg-btn.secondary {
  background: transparent;
  border-color: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
}
.zhino-sg-btn.secondary:hover {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
}
</style>
