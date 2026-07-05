<script setup lang="ts">
import { useMainStore, type SmallSummaryRecord } from '../stores/mainStore';
import { executeSmallSummary } from '../core/smallSummary';
import { enqueueAnalysis } from '../core/backgroundQueue';

const store = useMainStore();

//── API状态（仅自定义API） ───
const currentModel = computed(() => {
  return store.settings.customApiModel || '未设置';
});

const apiStatus = computed(() => {
  const hasUrl = !!store.settings.customApiUrl;
  const hasKey = !!store.settings.customApiKey;
  const hasModel = !!store.settings.customApiModel;
  if (hasUrl && hasKey && hasModel) return { ok: true, text: '自定义API已配置' };
  return { ok: false, text: '自定义API未完整配置' };
});

// ─── 小总结数据（倒序） ───
const PAGE_SIZE = 15;
const currentPage = ref(0);

const allSummaries = computed(() => {
  const raw = store.chatData.smallSummaries || [];
  return [...raw].reverse(); // 最新在前
});

const totalPages = computed(() => Math.max(1, Math.ceil(allSummaries.value.length / PAGE_SIZE)));

const pagedSummaries = computed(() => {
  const start = currentPage.value * PAGE_SIZE;
  return allSummaries.value.slice(start, start + PAGE_SIZE);
});

function prevPage() { if (currentPage.value > 0) currentPage.value--; }
function nextPage() { if (currentPage.value < totalPages.value - 1) currentPage.value++; }

// ── 展开编辑 ───
const expandedId = ref<string | null>(null);
const editingText = ref('');

function toggleExpand(s: SmallSummaryRecord) {
  if (expandedId.value === s.id) {
    expandedId.value = null;
  } else {
    expandedId.value = s.id;
    editingText.value = s.mainEvent || '';
  }
}

function saveEdit(s: SmallSummaryRecord) {
  const original = (store.chatData.smallSummaries || []).find((x: any) => x.id === s.id);
  if (original) {
    original.mainEvent = editingText.value;
    store.forcePersist();
  }
  expandedId.value = null;
}

// ─── 手动重试 ───
function retrySmallSummary(s: SmallSummaryRecord) {
  enqueueAnalysis('small_summary', async () => {
    // 找到对应的用户输入和AI回复
    const userRecord = store.userInputRecords.find(
      (r: any) => r.messageId === s.floorRange.start || r.messageId === s.floorRange.start - 1,
    );
    const captured = store.capturedContents.find(
      (c: any) => c.messageId === s.floorRange.end,
    );
    const userText = userRecord?.userInput || '';
    const aiText = captured?.content || '';
    const allNames = store.getAllCharacterNames();

    const newRecord = await executeSmallSummary(userText, aiText, s.floorRange.start, s.floorRange.end, allNames, store.getUserName());

    // 替换旧记录
    const idx = (store.chatData.smallSummaries || []).findIndex((x: any) => x.id === s.id);
    if (idx !== -1) {
      store.chatData.smallSummaries[idx] = newRecord;
    } else {
      store.chatData.smallSummaries.push(newRecord);
    }
    store.forcePersist();
  });
}

// ── 工具函数 ───
function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: '待生成',
    ready: '就绪',
    failed: '失败',
    'hidden-active': '替代中',
    absorbed: '已吸收',
    ignored: '已忽略',
  };
  return map[status] || status;
}

function floorRangeText(s: SmallSummaryRecord): string {
  return `#${s.floorRange.start}~${s.floorRange.end}`;
}
</script>

<template>
  <div class="story-begin">
    <!-- API状态概览 -->
    <div class="sb-section">
      <div class="sb-section-title">后台引擎状态</div>
      <div class="sb-status-row">
        <span class="sb-status-dot" :class="{ ok: apiStatus.ok }"></span>
        <span class="sb-status-text">{{ apiStatus.text }}</span>
      </div>
      <div class="sb-info-row">
        <span class="sb-info-label">当前模型：</span>
        <span class="sb-info-value">{{ currentModel }}</span>
      </div>
    </div>

    <!-- 小总结表格 -->
    <div class="sb-section sb-section-grow">
      <div class="sb-section-header">
        <div class="sb-section-title">小总结</div>
        <span class="sb-count">{{ allSummaries.length }} 条</span>
      </div>

      <div v-if="allSummaries.length === 0" class="sb-placeholder">
        暂无小总结记录。AI 回复后将自动生成每轮摘要。
      </div>

      <template v-else>
        <!--翻页控制 -->
        <div class="sb-pagination">
          <button class="sb-page-btn" :disabled="currentPage === 0" @click="prevPage">上一页</button>
          <span class="sb-page-info">{{ currentPage + 1 }} / {{ totalPages }}</span>
          <button class="sb-page-btn" :disabled="currentPage >= totalPages - 1" @click="nextPage">下一页</button>
        </div>

        <!-- 列表 -->
        <div class="sb-list">
          <div
            v-for="s in pagedSummaries"
            :key="s.id"
            class="sb-item"
            :class="['sb-status-' + s.status, { expanded: expandedId === s.id }]"
          >
            <div class="sb-item-header" @click="toggleExpand(s)">
              <span class="sb-item-floor">{{ floorRangeText(s) }}</span>
              <span class="sb-item-badge" :class="s.status">{{ statusLabel(s.status) }}</span>
              <span class="sb-item-event">{{ s.mainEvent || '—' }}</span>
              <span class="sb-item-chars">{{ (s.presentCharacters || []).join('、') }}</span>
            </div>

            <!-- 展开详情 -->
            <div v-if="expandedId === s.id" class="sb-item-detail">
              <div class="sb-detail-row">
                <span class="sb-detail-label">时间：</span>
                <span>{{ s.storyTime || '未提及' }}</span>
              </div>
              <div class="sb-detail-row">
                <span class="sb-detail-label">地点：</span>
                <span>{{ s.location || '未提及' }}</span>
              </div>
              <div class="sb-detail-row">
                <span class="sb-detail-label">在场：</span>
                <span>{{ (s.presentCharacters || []).join('、') || '无' }}</span>
              </div>

              <div class="sb-edit-area">
                <label class="sb-detail-label">事件摘要：</label>
                <textarea v-model="editingText" class="sb-textarea" rows="3"></textarea>
                <div class="sb-edit-actions">
                  <button class="sb-btn-save" @click="saveEdit(s)">保存</button>
                  <button v-if="s.status === 'failed'" class="sb-btn-retry" @click="retrySmallSummary(s)">重试</button>
                </div>
              </div>

              <div v-if="s.error" class="sb-error">{{ s.error }}</div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 配置入口 -->
    <div class="sb-section">
      <div class="sb-section-title">配置</div>
      <div class="sb-hint">
        后台分析 API 配置位于「设置」Tab → 通用后台 API 区域。
      </div>
    </div>
  </div>
</template>

<style scoped>
.story-begin {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sb-section {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 10px 12px;
}
.sb-section-grow {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sb-section-title {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 6px;
}
.sb-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.sb-count {
  font-size: 11px;
  color: rgba(167, 139, 250, 0.7);
}

.sb-status-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.sb-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(248, 113, 0.8);
  flex-shrink: 0;
}
.sb-status-dot.ok {
  background: rgba(74, 222, 128, 0.8);
}
.sb-status-text {
  font-size: 12px;
  color: rgba(255, 255, 0.75);
}

.sb-info-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}
.sb-info-label {
  color: rgba(255, 255, 0.4);
}
.sb-info-value {
  color: rgba(255, 255, 255, 0.8);
  font-family: monospace;
  font-size: 11px;
}

.sb-placeholder {
  font-size: 12px;
  color: rgba(255, 255, 0.35);
  line-height: 1.6;
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  border: 1px dashed rgba(255, 255, 255, 0.08);
}
.sb-hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
  line-height: 1.5;
}

/* 翻页 */
.sb-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 6px 0;
  flex-shrink: 0;
}
.sb-page-btn {
  padding: 3px 10px;
  font-size: 11px;
  border-radius: 4px;
  border: 1px solid rgba(167, 139, 250, 0.2);
  background: rgba(167, 139, 250, 0.06);
  color: rgba(167, 139, 250, 0.8);
  cursor: pointer;
}
.sb-page-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.sb-page-info {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

/* 列表 */
.sb-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sb-item {
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.15);
  transition: border-color 0.15s;
}
.sb-item.expanded {
  border-color: rgba(167, 139, 250, 0.2);
}
.sb-item.sb-status-failed {
  border-left: 2px solid rgba(248, 113, 113, 0.5);
}
.sb-item.sb-status-ready {
  border-left: 2px solid rgba(74, 222, 128, 0.3);
}

.sb-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  cursor: pointer;
  font-size: 12px;
}
.sb-item-header:hover {
  background: rgba(255, 255, 255, 0.02);
}

.sb-item-floor {
  flex-shrink: 0;
  color: rgba(167, 139, 250, 0.9);
  font-weight: 600;
  font-size: 11px;
  min-width: 52px;
}
.sb-item-badge {
  flex-shrink: 0;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.5);
}
.sb-item-badge.ready { color: rgba(74, 222, 128, 0.8); background: rgba(74, 222, 128, 0.08); }
.sb-item-badge.failed { color: rgba(248, 113, 113, 0.8); background: rgba(248, 113, 113, 0.08); }
.sb-item-badge.pending { color: rgba(251, 191, 36, 0.8); background: rgba(251, 191, 36, 0.08); }
.sb-item-badge.absorbed { color: rgba(148, 163, 184, 0.6); }

.sb-item-event {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(255, 255, 0.7);
}
.sb-item-chars {
  flex-shrink: 0;
  font-size: 10px;
  color: rgba(167, 139, 250, 0.5);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 详情展开 */
.sb-item-detail {
  padding: 8px 10px 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  font-size: 12px;
}
.sb-detail-row {
  display: flex;
  gap: 4px;
  margin-bottom: 3px;
  color: rgba(255, 255, 0.65);
}
.sb-detail-label {
  color: rgba(255, 255, 0.4);
  flex-shrink: 0;
  font-size: 11px;
}

.sb-edit-area {
  margin-top: 8px;
}
.sb-textarea {
  width: 100%;
  background: rgba(0, 0, 0.3);
  border: 1px solid rgba(255, 255, 0.1);
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 12px;
  color: rgba(255, 255, 0.85);
  resize: vertical;
  outline: none;
  margin-top: 4px;
}
.sb-textarea:focus {
  border-color: rgba(167, 139, 250, 0.4);
}

.sb-edit-actions {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}
.sb-btn-save {
  padding: 3px 12px;
  font-size: 11px;
  border-radius: 4px;
  border: 1px solid rgba(74, 222, 128, 0.3);
  background: rgba(74, 222, 128, 0.08);
  color: rgba(74, 222, 128, 0.9);
  cursor: pointer;
}
.sb-btn-retry {
  padding: 3px 12px;
  font-size: 11px;
  border-radius: 4px;
  border: 1px solid rgba(251, 191, 36, 0.3);
  background: rgba(251, 191, 36, 0.08);
  color: rgba(251, 191, 36, 0.9);
  cursor: pointer;
}

.sb-error {
  margin-top: 6px;
  padding: 4px 8px;
  font-size: 11px;
  color: rgba(248, 113, 0.8);
  background: rgba(248, 113, 113, 0.06);
  border-radius: 4px;
  border: 1px solid rgba(248, 113, 113, 0.15);
}
</style>
