<script setup lang="ts">
import { useMainStore, type SmallSummaryRecord } from '../stores/mainStore';
import { executeSmallSummary } from '../core/smallSummary';
import { executeOutlineConversation, createEmptyOutline, activateOutline, abandonOutline, advanceOutlineStage, buildMultiSummaryInjection } from '../core/plotDirector';
import { enqueueAnalysis } from '../core/backgroundQueue';
import type { WorldProgressRecord } from '../core/worldProgress';
import type { PlotOutline } from '../core/plotDirector';
import type { ItemMemory } from '../core/itemMemory';
import { invalidateItemEmbedding } from '../core/itemMemory';

const store = useMainStore();

// ─── 子面板切换 ───
type SubPanel = 'small_summary' | 'world_progress' | 'plot_director' | 'items';
const activePanel = ref<SubPanel>('small_summary');

// ═══════════════════════════════════════
// 小总结面板（从 StoryBeginTab 迁移）
// ═══════════════════════════════════════

const PAGE_SIZE = 15;
const currentPage = ref(0);

const allSummaries = computed(() => {
  const raw = store.chatData.smallSummaries || [];
  return [...raw].reverse();
});

const totalPages = computed(() => Math.max(1, Math.ceil(allSummaries.value.length / PAGE_SIZE)));

const pagedSummaries = computed(() => {
  const start = currentPage.value * PAGE_SIZE;
  return allSummaries.value.slice(start, start + PAGE_SIZE);
});

function prevPage() { if (currentPage.value > 0) currentPage.value--; }
function nextPage() { if (currentPage.value < totalPages.value - 1) currentPage.value++; }

const expandedId = ref<string | null>(null);
const editingText = ref('');
const editingTime = ref('');
const editingLocation = ref('');
const editingChars = ref('');

function toggleExpand(s: SmallSummaryRecord) {
  if (expandedId.value === s.id) {
    expandedId.value = null;
  } else {
    expandedId.value = s.id;
    editingText.value = s.mainEvent || '';
    editingTime.value = s.storyTime || '';
    editingLocation.value = s.location || '';
    editingChars.value = (s.presentCharacters || []).join('、');
  }
}

function saveEdit(s: SmallSummaryRecord) {
  const original = (store.chatData.smallSummaries || []).find((x: any) => x.id === s.id);
  if (original) {
    original.mainEvent = editingText.value;
    original.storyTime = editingTime.value || undefined;
    original.location = editingLocation.value || undefined;
    original.presentCharacters = editingChars.value
      .split(/[,，、]/).map((c: string) => c.trim()).filter(Boolean);
    store.forcePersist();
  }
  expandedId.value = null;
}

function retrySmallSummary(s: SmallSummaryRecord) {
  enqueueAnalysis('small_summary', async () => {
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
    const idx = (store.chatData.smallSummaries || []).findIndex((x: any) => x.id === s.id);
    if (idx !== -1) {
      store.chatData.smallSummaries[idx] = newRecord;
    } else {
      store.chatData.smallSummaries.push(newRecord);
    }
    store.forcePersist();
  });
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: '待生成', ready: '就绪', failed: '失败',
    'hidden-active': '替代中', absorbed: '已吸收', ignored: '已忽略',
  };
  return map[status] || status;
}

function floorRangeText(s: SmallSummaryRecord): string {
  return `#${s.floorRange.start}~${s.floorRange.end}`;
}

// 第0层开场白小总结
const hasFloorZeroSummary = computed(() =>
  (store.chatData.smallSummaries || []).some((s: any) => s.floorRange?.start === 0 && s.floorRange?.end === 0),
);
const floorZeroGenerating = ref(false);

function generateFloorZeroSummary() {
  const captured = store.capturedContents.find((c: any) => c.messageId === 0);
  if (!captured || floorZeroGenerating.value) return;
  floorZeroGenerating.value = true;
  enqueueAnalysis('small_summary', async () => {
    try {
      const allNames = store.getAllCharacterNames();
      const record = await executeSmallSummary('', captured.content, 0, 0, allNames, store.getUserName());
      const existingIdx = (store.chatData.smallSummaries || []).findIndex(
        (s: any) => s.floorRange?.start === 0 && s.floorRange?.end === 0,
      );
      if (existingIdx !== -1) {
        store.chatData.smallSummaries[existingIdx] = record;
      } else {
        (store.chatData.smallSummaries || (store.chatData.smallSummaries = [])).unshift(record);
      }
      store.forcePersist();
    } finally {
      floorZeroGenerating.value = false;
    }
  });
}

// ═══════════════════════════════════════
// 世界推进面板
// ═══════════════════════════════════════

const worldRecords = computed(() => {
  const raw = store.chatData.worldProgressRecords || [];
  return [...raw].reverse();
});

const expandedWPId = ref<string | null>(null);

function toggleWPExpand(r: WorldProgressRecord) {
  expandedWPId.value = expandedWPId.value === r.id ? null : r.id;
}

// ═══════════════════════════════════════
// 剧情导演面板
// ═══════════════════════════════════════

const plotOutline = computed(() => store.chatData.plotOutline as PlotOutline | null);
const plotConversing = ref(false);
const plotUserInput = ref('');
const plotOutlineType = ref<'short' | 'medium' | 'long'>('medium');
const plotMessages = ref<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
const showWorldBookSelector = ref(false);

// 大总结注入控制（来自 settings）
const summaryCount = computed({
  get: () => store.settings.plotDirectorSummaryCount ?? 1,
  set: (v) => { store.settings.plotDirectorSummaryCount = v; store.forcePersist(); },
});
const summaryMode = computed<'detail' | 'overview'>({
  get: () => (store.settings.plotDirectorSummaryMode === 'detail' ? 'detail' : 'overview'),
  set: (v) => { store.settings.plotDirectorSummaryMode = v; store.forcePersist(); },
});
// 可用的总轮数
const totalSummaryVersions = computed(() => (store.chatData.summaries || []).length);

// 防剧透模式
const spoilerMode = computed({
  get: () => store.settings.plotDirectorSpoilerMode ?? false,
  set: (v) => { store.settings.plotDirectorSpoilerMode = v; store.forcePersist(); },
});

/**
 * 防剧透：移除 AI 回复中的 <plot_outline> 块
 * 正常对话内容保留，只隐藏大纲 JSON
 */
function sanitizeSpoiler(content: string): string {
  // 移除 <plot_outline>...</plot_outline> 块（含前后可能的多余空行）
  const cleaned = content.replace(/<plot_outline>[\s\S]*?<\/plot_outline>/gi, '');
  // 如果移除后内容为空，返回占位提示
  const trimmed = cleaned.trim();
  if (!trimmed) return '';
  // 清理多余连续空行
  return trimmed.replace(/\n{3,}/g, '\n\n');
}

// 世界书条目（供剧情导演勾选）
const worldBookEntries = computed(() => store.chatData.worldBookEntries || []);
const worldBookSearch = ref('');
const filteredWorldBookEntries = computed(() => {
  const q = worldBookSearch.value.trim().toLowerCase();
  let entries = worldBookEntries.value;
  if (q) {
    entries = entries.filter(e => e.key.toLowerCase().includes(q) || e.content.toLowerCase().includes(q));
  }
  return entries;
});
// 有效条目的 key 集合
const worldBookKeySet = computed(() => new Set(worldBookEntries.value.map(e => e.key)));
// 已保存的选中 key
const selectedWorldBookKeys = computed(() => {
  const keys = store.chatData.selectedWorldBookKeys || [];
  return keys.filter(k => worldBookKeySet.value.has(k));
});
// 草稿：本地勾选状态，点了保存才提交到 store
const draftPlotWBKeys = ref<Set<string>>(new Set());
function openPlotWorldBook() {
  showWorldBookSelector.value = true;
  draftPlotWBKeys.value = new Set(selectedWorldBookKeys.value);
}
function closePlotWorldBook() {
  showWorldBookSelector.value = false;
  worldBookSearch.value = '';
}
function toggleWorldBookKey(key: string) {
  const s = draftPlotWBKeys.value;
  if (s.has(key)) s.delete(key);
  else s.add(key);
  // 触发响应式
  draftPlotWBKeys.value = new Set(s);
}
function savePlotWBKeys() {
  store.chatData.selectedWorldBookKeys = [...draftPlotWBKeys.value];
  store.forcePersist();
  closePlotWorldBook();
}

// 选中的世界书内容
const selectedWorldBookContent = computed(() =>
  worldBookEntries.value.filter(e => selectedWorldBookKeys.value.includes(e.key)),
);

// 世界推进的世界书选择（独立于剧情导演）
const showWPWorldBook = ref(false);
const wpWorldBookSearch = ref('');
const filteredWPWorldBookEntries = computed(() => {
  const q = wpWorldBookSearch.value.trim().toLowerCase();
  let entries = worldBookEntries.value;
  if (q) {
    entries = entries.filter(e => e.key.toLowerCase().includes(q) || e.content.toLowerCase().includes(q));
  }
  return entries;
});
const wpSavedKeys = computed(() => store.chatData.worldProgressWorldBookKeys || []);
const draftWPWBKeys = ref<Set<string>>(new Set());
function openWPWorldBook() {
  showWPWorldBook.value = true;
  draftWPWBKeys.value = new Set(wpSavedKeys.value);
}
function closeWPWorldBook() {
  showWPWorldBook.value = false;
  wpWorldBookSearch.value = '';
}
function toggleWPWorldBookKey(key: string) {
  const s = draftWPWBKeys.value;
  if (s.has(key)) s.delete(key);
  else s.add(key);
  draftWPWBKeys.value = new Set(s);
}
function saveWPWBKeys() {
  store.chatData.worldProgressWorldBookKeys = [...draftWPWBKeys.value];
  store.forcePersist();
  closeWPWorldBook();
}

// 切 tab 后组件重新挂载时 plotMessages 会丢失，从 store 恢复
watch(plotOutline, (outline) => {
  if (outline?.conversationHistory && outline.conversationHistory.length > 0) {
    plotMessages.value = [...outline.conversationHistory];
  }
}, { immediate: true });

function startNewOutline() {
  const outline = createEmptyOutline(plotOutlineType.value);
  store.chatData.plotOutline = outline;
  plotMessages.value = outline.conversationHistory || [];
  store.forcePersist();
}

async function sendPlotMessage() {
  if (!plotUserInput.value.trim() || plotConversing.value) return;
  const msg = plotUserInput.value.trim();
  plotUserInput.value = '';
  plotConversing.value = true;

  plotMessages.value.push({ role: 'user', content: msg });

  try {
    const existingChars = store.getAllCharacterNames();
    // 构建多轮大总结注入文本
    const deltas = (store.chatData.summaries || []) as any[];
    const multiSummaryText = buildMultiSummaryInjection(
      deltas,
      summaryCount.value,
      summaryMode.value,
    );

    const { reply, outline: newOutline } = await executeOutlineConversation(
      msg,
      plotMessages.value,
      plotOutlineType.value,
      existingChars,
      multiSummaryText,
      store.getUserName(),
      undefined,
      selectedWorldBookContent.value,
    );

    plotMessages.value.push({ role: 'assistant', content: reply });

    if (newOutline && store.chatData.plotOutline) {
      store.chatData.plotOutline = {
        ...newOutline,
        conversationHistory: [...plotMessages.value],
      };
    }

    if (store.chatData.plotOutline) {
      (store.chatData.plotOutline as any).conversationHistory = [...plotMessages.value];
    }
    store.forcePersist();
  } catch (e: any) {
    plotMessages.value.push({ role: 'assistant', content: `[错误] ${e?.message || e}` });
  } finally {
    plotConversing.value = false;
  }
}

function doActivateOutline() {
  if (store.chatData.plotOutline) {
    store.chatData.plotOutline = activateOutline(store.chatData.plotOutline as PlotOutline);
    store.forcePersist();
  }
}

function doAbandonOutline() {
  if (store.chatData.plotOutline) {
    store.chatData.plotOutline = abandonOutline(store.chatData.plotOutline as PlotOutline);
    store.forcePersist();
  }
}

function doAdvanceStage() {
  if (store.chatData.plotOutline) {
    store.chatData.plotOutline = advanceOutlineStage(store.chatData.plotOutline as PlotOutline);
    store.forcePersist();
  }
}

// ═══════════════════════════════════════
// 物品记忆面板
// ═══════════════════════════════════════

const itemMemories = computed(() => (store.chatData.itemMemories || []) as ItemMemory[]);

/** 获取物品的最新来源事件（从历史记录取最后一条的 event） */
function getItemSource(item: ItemMemory): string {
  const latest = item.history?.[item.history.length - 1];
  return latest?.event || '';
}

function removeItem(idx: number) {
  store.chatData.itemMemories.splice(idx, 1);
  store.forcePersist();
}

// 物品编辑状态
const editingItemIdx = ref(-1);
const editItemName = ref('');
const editItemDesc = ref('');
const editItemOwner = ref('');
const editItemState = ref('');
const editItemSource = ref('');

function startEditItem(idx: number) {
  const item = store.chatData.itemMemories[idx];
  if (!item) return;
  editingItemIdx.value = idx;
  editItemName.value = item.itemName || '';
  editItemDesc.value = item.description || '';
  editItemOwner.value = item.currentOwner || '';
  editItemState.value = item.currentState || '';
  editItemSource.value = getItemSource(item);
}

function saveEditItem() {
  const idx = editingItemIdx.value;
  if (idx < 0) return;
  const items = store.chatData.itemMemories;
  if (!items[idx]) return;
  const item = items[idx];

  item.itemName = editItemName.value.trim();
  item.description = editItemDesc.value.trim();
  item.currentOwner = editItemOwner.value.trim();
  item.currentState = editItemState.value.trim() || '正常';

  // 更新来源事件（写入 history 最后一条）
  const source = editItemSource.value.trim();
  if (source) {
    if (item.history.length > 0) {
      item.history[item.history.length - 1].event = source;
    } else {
      item.history.push({ storyTime: '', event: source });
    }
  }

  item.lastUpdatedAt = new Date().toISOString();
  // 编辑后清空向量，下次大总结时重新生成
  invalidateItemEmbedding(item);
  store.chatData.itemMemories = [...items];
  store.forcePersist();
  editingItemIdx.value = -1;
}

function cancelEditItem() {
  editingItemIdx.value = -1;
}
</script>

<template>
  <div class="world-tab">
    <!-- 子面板导航 -->
    <div class="wt-nav">
      <button
        v-for="p in ([
          { key: 'small_summary', label: '小总结' },
          { key: 'world_progress', label: '世界推进' },
          { key: 'plot_director', label: '剧情导演' },
          { key: 'items', label: '物品库' },
        ] as const)"
        :key="p.key"
        class="wt-nav-btn"
        :class="{ active: activePanel === p.key }"
        @click="activePanel = p.key"
      >{{ p.label }}</button>
    </div>

    <!-- ═══ 小总结面板 ═══ -->
    <div v-if="activePanel === 'small_summary'" class="wt-panel">
      <div class="wt-panel-header">
        <span class="wt-panel-title">小总结记录</span>
        <span class="wt-count">{{ allSummaries.length }} 条</span>
        <button
          class="wt-btn-save"
          style="margin-left:auto"
          :disabled="floorZeroGenerating"
          @click="generateFloorZeroSummary"
        >{{ floorZeroGenerating ? '生成中...' : hasFloorZeroSummary ? '重新生成开场白' : '为开场白生成' }}</button>
      </div>

      <div v-if="allSummaries.length === 0" class="wt-placeholder">
        暂无小总结记录。AI 回复后将自动生成每轮摘要。
      </div>

      <template v-else>
        <div class="wt-pagination">
          <button class="wt-page-btn" :disabled="currentPage === 0" @click="prevPage">上一页</button>
          <span class="wt-page-info">{{ currentPage + 1 }} / {{ totalPages }}</span>
          <button class="wt-page-btn" :disabled="currentPage >= totalPages - 1" @click="nextPage">下一页</button>
        </div>

        <div class="wt-list">
          <div
            v-for="s in pagedSummaries"
            :key="s.id"
            class="wt-item"
            :class="['wt-status-' + s.status, { expanded: expandedId === s.id }]"
          >
            <div class="wt-item-header" @click="toggleExpand(s)">
              <span class="wt-item-floor">{{ floorRangeText(s) }}</span>
              <span class="wt-item-badge" :class="s.status">{{ statusLabel(s.status) }}</span>
              <span class="wt-item-event">{{ s.mainEvent || '—' }}</span>
              <span class="wt-item-chars">{{ (s.presentCharacters || []).join(', ') }}</span>
            </div>

            <div v-if="expandedId === s.id" class="wt-item-detail">
              <div class="wt-detail-row">
                <span class="wt-detail-label">时间:</span>
                <input v-model="editingTime" class="wt-input-inline" placeholder="未提及" />
              </div>
              <div class="wt-detail-row">
                <span class="wt-detail-label">地点:</span>
                <input v-model="editingLocation" class="wt-input-inline" placeholder="未提及" />
              </div>
              <div class="wt-detail-row">
                <span class="wt-detail-label">在场:</span>
                <input v-model="editingChars" class="wt-input-inline" placeholder="无" />
              </div>
              <div class="wt-edit-area">
                <label class="wt-detail-label">事件摘要:</label>
                <textarea v-model="editingText" class="wt-textarea" rows="3"></textarea>
                <div class="wt-edit-actions">
                  <button class="wt-btn-save" @click="saveEdit(s)">保存</button>
                  <button v-if="s.status === 'failed'" class="wt-btn-retry" @click="retrySmallSummary(s)">重试</button>
                </div>
              </div>
              <div v-if="s.error" class="wt-error">{{ s.error }}</div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- ═══ 世界推进面板 ═══ -->
    <div v-if="activePanel === 'world_progress'" class="wt-panel">
      <div class="wt-panel-header">
        <span class="wt-panel-title">世界推进记录</span>
        <span class="wt-count">{{ worldRecords.length }} 条</span>
      </div>

      <!-- 世界书选择 -->
      <div class="wt-plot-worldbook">
        <div class="wt-plot-worldbook-toggle" @click="showWPWorldBook ? closeWPWorldBook() : openWPWorldBook()">
          <span>世界书参考 ({{ wpSavedKeys.length }}/{{ worldBookEntries.length }})</span>
          <span class="wt-plot-worldbook-arrow">{{ showWPWorldBook ? '▲' : '▼' }}</span>
        </div>
        <div v-if="showWPWorldBook" class="wt-plot-worldbook-list">
          <div class="wt-wb-header">
            <input v-model="wpWorldBookSearch" class="wt-plot-worldbook-search" placeholder="搜索条目..." />
            <button class="wt-wb-save-btn" @click="saveWPWBKeys">保存</button>
          </div>
          <template v-if="filteredWPWorldBookEntries.length > 0">
            <label v-for="entry in filteredWPWorldBookEntries" :key="entry.key" class="wt-plot-worldbook-item">
              <input type="checkbox" :checked="draftWPWBKeys.has(entry.key)" @change="toggleWPWorldBookKey(entry.key)" />
              <span>{{ entry.key }}</span>
            </label>
          </template>
          <div v-else class="wt-placeholder">{{ wpWorldBookSearch ? '无匹配条目' : '暂无世界书条目' }}</div>
        </div>
      </div>

      <div v-if="!store.settings.worldProgressEnabled" class="wt-placeholder">
        世界推进功能未开启。请在「设置」中启用。
      </div>
      <div v-else-if="worldRecords.length === 0" class="wt-placeholder">
        暂无世界推进记录。每{{ store.settings.worldProgressInterval }}个AI楼层自动触发。
      </div>

      <template v-else>
        <div class="wt-list">
          <div
            v-for="r in worldRecords"
            :key="r.id"
            class="wt-item"
            :class="{ expanded: expandedWPId === r.id }"
          >
            <div class="wt-item-header" @click="toggleWPExpand(r)">
              <span class="wt-item-floor">#{{ r.basedOnFloorRange.start }}~{{ r.basedOnFloorRange.end }}</span>
              <span class="wt-item-badge" :class="r.status">{{ r.status === 'ready' ? '就绪' : r.status }}</span>
              <span class="wt-item-event">{{ r.mainTimeline.storyTime }} | {{ r.advancedCharacters.length }}角色推进</span>
            </div>

            <div v-if="expandedWPId === r.id" class="wt-item-detail">
              <div class="wt-detail-row">
                <span class="wt-detail-label">时间:</span>
                <span>{{ r.mainTimeline.storyTime }}</span>
              </div>
              <div class="wt-detail-row">
                <span class="wt-detail-label">地点:</span>
                <span>{{ r.mainTimeline.location }}</span>
              </div>
              <div class="wt-detail-row">
                <span class="wt-detail-label">正文事件:</span>
                <span>{{ r.mainTimeline.event }}</span>
              </div>
              <div class="wt-detail-row">
                <span class="wt-detail-label">在场角色:</span>
                <span>{{ r.presentCharacters.join(', ') || '无' }}</span>
              </div>

              <div v-if="r.advancedCharacters.length > 0" class="wt-wp-chars">
                <div class="wt-detail-label" style="margin-top:8px">不在场角色行动:</div>
                <div v-for="(c, i) in r.advancedCharacters" :key="i" class="wt-wp-char-card">
                  <div class="wt-wp-char-name">{{ c.characterName }}</div>
                  <div class="wt-wp-char-info">{{ c.location }} - {{ c.action }}</div>
                  <div v-if="c.reason" class="wt-wp-char-reason">原因: {{ c.reason }}</div>
                  <div v-if="c.possibleEncounter" class="wt-wp-char-encounter">相遇: {{ c.possibleEncounter }}</div>
                </div>
              </div>

              <div v-if="r.backgroundEvents.length > 0" class="wt-wp-bg">
                <div class="wt-detail-label" style="margin-top:8px">背景事件:</div>
                <div v-for="(evt, i) in r.backgroundEvents" :key="i" class="wt-wp-bg-item">{{ evt }}</div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- ═══ 剧情导演面板 ═══ -->
    <div v-if="activePanel === 'plot_director'" class="wt-panel">
      <div class="wt-panel-header">
        <span class="wt-panel-title">剧情导演</span>
        <span v-if="plotOutline" class="wt-badge" :class="plotOutline.status">{{ plotOutline.status }}</span>
        <label class="wt-spoiler-toggle" title="防剧透：隐藏AI规划内容">
          <input type="checkbox" v-model="spoilerMode" />
          <span class="wt-spoiler-label">防剧透</span>
        </label>
      </div>

      <div v-if="!store.settings.plotDirectorEnabled" class="wt-placeholder">
        剧情导演功能未开启。请在「设置」中启用。
      </div>

      <!-- 无大纲：创建入口 -->
      <template v-else-if="!plotOutline || plotOutline.status === 'abandoned' || plotOutline.status === 'completed'">
        <div class="wt-plot-create">
          <div class="wt-detail-label">创建剧情大纲</div>
          <div class="wt-plot-type-row">
            <button
              v-for="t in (['short', 'medium', 'long'] as const)"
              :key="t"
              class="wt-plot-type-btn"
              :class="{ active: plotOutlineType === t }"
              @click="plotOutlineType = t"
            >{{ t === 'short' ? '短篇' : t === 'medium' ? '中篇' : '长篇' }}</button>
          </div>
          <button class="wt-btn-primary" @click="startNewOutline">开始创建</button>
          <div v-if="plotOutline?.status === 'completed'" class="wt-plot-complete-note">
            上一个大纲已完成 ({{ plotOutline.stages.length }} 阶段)
          </div>
        </div>
      </template>

      <!-- 草稿中：对话界面 -->
      <template v-else-if="plotOutline.status === 'drafting'">
        <div class="wt-plot-chat">
          <!-- 世界书条目选择 -->
          <div class="wt-plot-worldbook">
            <div class="wt-plot-worldbook-toggle" @click="showWorldBookSelector ? closePlotWorldBook() : openPlotWorldBook()">
              <span>世界书参考 ({{ selectedWorldBookKeys.length }}/{{ worldBookEntries.length }})</span>
              <span class="wt-plot-worldbook-arrow">{{ showWorldBookSelector ? '▲' : '▼' }}</span>
            </div>
            <div v-if="showWorldBookSelector" class="wt-plot-worldbook-list">
              <div class="wt-wb-header">
                <input
                  v-model="worldBookSearch"
                  class="wt-plot-worldbook-search"
                  placeholder="搜索条目..."
                />
                <button class="wt-wb-save-btn" @click="savePlotWBKeys">保存</button>
              </div>
              <template v-if="filteredWorldBookEntries.length > 0">
                <label v-for="entry in filteredWorldBookEntries" :key="entry.key" class="wt-plot-worldbook-item">
                  <input type="checkbox" :checked="draftPlotWBKeys.has(entry.key)" @change="toggleWorldBookKey(entry.key)" />
                  <span>{{ entry.key }}</span>
                </label>
              </template>
              <div v-else class="wt-placeholder">{{ worldBookSearch ? '无匹配条目' : '暂无世界书条目' }}</div>
            </div>
          </div>
          <!-- 大总结注入控制 -->
          <div class="wt-plot-summary-cfg">
            <div class="wt-summary-cfg-row">
              <span class="wt-summary-cfg-label">大总结轮数</span>
              <input
                type="number"
                class="wt-summary-cfg-num"
                :value="summaryCount"
                @input="summaryCount = $event.target ? Math.max(1, parseInt(($event.target as HTMLInputElement).value) || 1) : 1"
                min="1"
              />
              <span class="wt-summary-cfg-hint">/ {{ totalSummaryVersions }} 轮可用</span>
              <button
                v-if="summaryCount !== totalSummaryVersions && totalSummaryVersions > 0"
                class="wt-summary-cfg-all"
                @click="summaryCount = totalSummaryVersions"
              >全部</button>
            </div>
            <div class="wt-summary-cfg-row">
              <span class="wt-summary-cfg-label">注入模式</span>
              <label class="wt-summary-cfg-radio">
                <input type="radio" value="detail" v-model="summaryMode" />
                <span>详情</span>
              </label>
              <label class="wt-summary-cfg-radio">
                <input type="radio" value="overview" v-model="summaryMode" />
                <span>速览</span>
              </label>
            </div>
          </div>
          <div class="wt-plot-messages">
            <div
              v-for="(msg, i) in plotMessages"
              :key="i"
              class="wt-plot-msg"
              :class="msg.role"
            >
              <div v-if="msg.role === 'user'" class="wt-plot-msg-content">{{ msg.content }}</div>
              <div v-else-if="spoilerMode" class="wt-plot-msg-content">
                <template v-if="sanitizeSpoiler(msg.content)">
                  {{ sanitizeSpoiler(msg.content) }}
                </template>
                <span v-if="/<plot_outline>/i.test(msg.content)" class="wt-spoiler-inline">[大纲已隐藏]</span>
              </div>
              <div v-else class="wt-plot-msg-content">{{ msg.content }}</div>
            </div>
            <div v-if="plotMessages.length === 0" class="wt-placeholder" style="padding:12px">
              告诉AI你想玩什么类型的剧情、哪些角色参与、大致结局方向。AI会帮你产出大纲。
            </div>
          </div>
          <div class="wt-plot-input-row">
            <input
              v-model="plotUserInput"
              class="wt-plot-input"
              placeholder="描述你想要的剧情方向..."
              :disabled="plotConversing"
              @keyup.enter="sendPlotMessage"
            />
            <button class="wt-btn-primary" :disabled="plotConversing || !plotUserInput.trim()" @click="sendPlotMessage">
              {{ plotConversing ? '...' : '发送' }}
            </button>
          </div>
          <div class="wt-plot-actions">
            <button v-if="plotOutline.stages.length > 0" class="wt-btn-save" @click="doActivateOutline">激活大纲</button>
            <button class="wt-btn-danger" @click="doAbandonOutline">放弃</button>
          </div>
        </div>
      </template>

      <!-- 活跃中：进度展示 -->
      <template v-else-if="plotOutline.status === 'active'">
        <div class="wt-plot-active">
          <div class="wt-plot-progress">
            <div class="wt-detail-label">阶段进度: {{ plotOutline.currentStageIndex + 1 }} / {{ plotOutline.stages.length }}</div>
            <div class="wt-plot-progress-bar">
              <div class="wt-plot-progress-fill" :style="{ width: ((plotOutline.currentStageIndex + 1) / plotOutline.stages.length * 100) + '%' }"></div>
            </div>
          </div>

          <!-- 防剧透模式：隐藏结局、阶段详情、校对结果 -->
          <template v-if="spoilerMode">
            <div class="wt-spoiler-notice">🔒 大纲运行中（防剧透模式）</div>
          </template>
          <template v-else>
            <div class="wt-plot-ending">结局方向: {{ plotOutline.targetEnding }}</div>

            <div class="wt-plot-stages">
              <div
                v-for="(stage, i) in plotOutline.stages"
                :key="i"
                class="wt-plot-stage"
                :class="{ current: i === plotOutline.currentStageIndex, done: stage.completed }"
              >
                <span class="wt-plot-stage-idx">{{ i + 1 }}</span>
                <span class="wt-plot-stage-desc">{{ stage.description }}</span>
                <span v-if="stage.keyCharacters.length > 0" class="wt-plot-stage-chars">{{ stage.keyCharacters.join(', ') }}</span>
              </div>
            </div>

            <!-- 最新校对结果 -->
            <div v-if="store.chatData.lastPlotCheckResult" class="wt-plot-check">
              <div class="wt-detail-label">最新校对:</div>
              <div class="wt-plot-check-status" :class="store.chatData.lastPlotCheckResult.stageProgress">
                {{ store.chatData.lastPlotCheckResult.stageProgress === 'on_track' ? '正轨' :
                   store.chatData.lastPlotCheckResult.stageProgress === 'ahead' ? '超前' :
                   store.chatData.lastPlotCheckResult.stageProgress === 'behind' ? '落后' : '偏离' }}
              </div>
              <div v-if="store.chatData.lastPlotCheckResult.suggestedGuidance" class="wt-plot-check-guidance">
                {{ store.chatData.lastPlotCheckResult.suggestedGuidance }}
              </div>
            </div>
          </template>

          <div class="wt-plot-actions">
            <button class="wt-btn-save" @click="doAdvanceStage">推进阶段</button>
            <button class="wt-btn-danger" @click="doAbandonOutline">放弃大纲</button>
          </div>
        </div>
      </template>
    </div>

    <!-- ═══ 物品记忆面板 ═══ -->
    <div v-if="activePanel === 'items'" class="wt-panel">
      <div class="wt-panel-header">
        <span class="wt-panel-title">物品记忆库</span>
        <span class="wt-count">{{ itemMemories.length }} 件</span>
      </div>

      <div v-if="itemMemories.length === 0" class="wt-placeholder">
        暂无物品记录。大总结时自动从时间线事件中提取。
      </div>

      <div v-else class="wt-list">
        <div v-for="(item, idx) in itemMemories" :key="idx" class="wt-item">
          <!-- 查看模式 -->
          <div v-if="editingItemIdx !== idx" class="wt-item-header">
            <span class="wt-item-name">{{ item.itemName }}</span>
            <span class="wt-item-desc">{{ item.description || '-' }}</span>
            <span class="wt-item-owner">{{ item.currentOwner || '-' }}</span>
            <span class="wt-item-state">{{ item.currentState || '正常' }}</span>
            <span class="wt-item-source">{{ getItemSource(item) || '-' }}</span>
            <button class="wt-btn-xs" @click="startEditItem(idx)">编辑</button>
            <button class="wt-btn-xs-danger" @click="removeItem(idx)">删除</button>
          </div>
          <!-- 编辑模式 -->
          <div v-else class="wt-item-edit">
            <div class="wt-edit-row">
              <span class="wt-edit-label">名称</span>
              <input v-model="editItemName" class="wt-edit-input" />
            </div>
            <div class="wt-edit-row">
              <span class="wt-edit-label">描述</span>
              <input v-model="editItemDesc" class="wt-edit-input" />
            </div>
            <div class="wt-edit-row">
              <span class="wt-edit-label">持有者</span>
              <input v-model="editItemOwner" class="wt-edit-input" />
            </div>
            <div class="wt-edit-row">
              <span class="wt-edit-label">状态</span>
              <input v-model="editItemState" class="wt-edit-input" />
            </div>
            <div class="wt-edit-row">
              <span class="wt-edit-label">来源</span>
              <input v-model="editItemSource" class="wt-edit-input" />
            </div>
            <div class="wt-edit-actions">
              <button class="wt-btn-xs-save" @click="saveEditItem">保存</button>
              <button class="wt-btn-xs" @click="cancelEditItem">取消</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.world-tab {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 子面板导航 */
.wt-nav {
  display: flex;
  gap: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}
.wt-nav-btn {
  flex: 1;
  padding: 6px 0;
  font-size: 11px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.4);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
}
.wt-nav-btn:hover { color: rgba(255, 255, 255, 0.7); }
.wt-nav-btn.active {
  color: var(--zn-primary, #a78bfa);
  border-bottom-color: var(--zn-primary, #a78bfa);
  background: rgba(167, 139, 250, 0.06);
}

/* 通用面板 */
.wt-panel {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.wt-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.wt-panel-title {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
}
.wt-count {
  font-size: 11px;
  color: rgba(167, 139, 250, 0.7);
}
.wt-placeholder {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.35);
  line-height: 1.6;
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  border: 1px dashed rgba(255, 255, 255, 0.08);
}

/* 翻页 */
.wt-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 4px 0;
  flex-shrink: 0;
}
.wt-page-btn {
  padding: 3px 10px;
  font-size: 11px;
  border-radius: 4px;
  border: 1px solid rgba(167, 139, 250, 0.2);
  background: rgba(167, 139, 250, 0.06);
  color: rgba(167, 139, 250, 0.8);
  cursor: pointer;
}
.wt-page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.wt-page-info { font-size: 11px; color: rgba(255, 255, 255, 0.4); }

/* 列表 */
.wt-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.wt-item {
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.15);
  transition: border-color 0.15s;
}
.wt-item.expanded { border-color: rgba(167, 139, 250, 0.2); }
.wt-item.wt-status-failed { border-left: 2px solid rgba(248, 113, 113, 0.5); }
.wt-item.wt-status-ready { border-left: 2px solid rgba(74, 222, 128, 0.3); }

.wt-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  cursor: pointer;
  font-size: 12px;
}
.wt-item-header:hover { background: rgba(255, 255, 255, 0.02); }
.wt-item-floor {
  flex-shrink: 0;
  color: rgba(167, 139, 250, 0.9);
  font-weight: 600;
  font-size: 11px;
  min-width: 52px;
}
.wt-item-badge {
  flex-shrink: 0;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.5);
}
.wt-item-badge.ready { color: rgba(74, 222, 128, 0.8); background: rgba(74, 222, 128, 0.08); }
.wt-item-badge.failed { color: rgba(248, 113, 113, 0.8); background: rgba(248, 113, 113, 0.08); }
.wt-item-badge.pending { color: rgba(251, 191, 36, 0.8); background: rgba(251, 191, 36, 0.08); }
.wt-item-event {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(255, 255, 255, 0.7);
}
.wt-item-chars {
  flex-shrink: 0;
  font-size: 10px;
  color: rgba(167, 139, 250, 0.5);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 物品库专用样式（固定列宽对齐） */
.wt-item-name {
  width: 110px;
  flex-shrink: 0;
  color: rgba(167, 139, 250, 0.9);
  font-weight: 600;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wt-item-desc {
  width: 190px;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
}
.wt-item-owner {
  width: 72px;
  flex-shrink: 0;
  color: rgba(74, 222, 128, 0.7);
  font-size: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wt-item-state {
  width: 48px;
  flex-shrink: 0;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
}
.wt-item-source {
  flex: 1;
  min-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(255, 255, 255, 0.35);
  font-size: 10px;
}
/* 物品编辑模式 */
.wt-item-edit {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
}
.wt-edit-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.wt-edit-label {
  flex-shrink: 0;
  width: 42px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.35);
}
.wt-edit-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 11px;
  padding: 3px 6px;
  outline: none;
}
.wt-edit-input:focus {
  border-color: rgba(167, 139, 250, 0.4);
}
.wt-edit-actions {
  display: flex;
  gap: 6px;
  margin-top: 2px;
}

/* 详情 */
.wt-item-detail {
  padding: 8px 10px 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  font-size: 12px;
}
.wt-detail-row {
  display: flex;
  gap: 4px;
  margin-bottom: 3px;
  color: rgba(255, 255, 255, 0.65);
}
.wt-detail-label {
  color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
  font-size: 11px;
}

.wt-edit-area { margin-top: 8px; }
.wt-textarea {
  width: 100%;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  resize: vertical;
  outline: none;
  margin-top: 4px;
}
.wt-textarea:focus { border-color: rgba(167, 139, 250, 0.4); }

.wt-input-inline {
  flex: 1;
  padding: 3px 6px;
  font-size: 12px;
  border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(0,0,0,0.2);
  color: #e0e0e0;
}
.wt-input-inline:focus { border-color: rgba(167, 139, 250, 0.4); outline: none; }

.wt-edit-actions { display: flex; gap: 8px; margin-top: 6px; }
.wt-btn-save {
  padding: 3px 12px;
  font-size: 11px;
  border-radius: 4px;
  border: 1px solid rgba(74, 222, 128, 0.3);
  background: rgba(74, 222, 128, 0.08);
  color: rgba(74, 222, 128, 0.9);
  cursor: pointer;
}
.wt-btn-retry {
  padding: 3px 12px;
  font-size: 11px;
  border-radius: 4px;
  border: 1px solid rgba(251, 191, 36, 0.3);
  background: rgba(251, 191, 36, 0.08);
  color: rgba(251, 191, 36, 0.9);
  cursor: pointer;
}
.wt-btn-primary {
  padding: 5px 14px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
  border: 1px solid rgba(167, 139, 250, 0.3);
  background: rgba(167, 139, 250, 0.12);
  color: rgba(167, 139, 250, 0.9);
  cursor: pointer;
  transition: all 0.15s;
}
.wt-btn-primary:hover:not(:disabled) { background: rgba(167, 139, 250, 0.22); }
.wt-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
.wt-btn-danger {
  padding: 3px 12px;
  font-size: 11px;
  border-radius: 4px;
  border: 1px solid rgba(248, 113, 113, 0.3);
  background: rgba(248, 113, 113, 0.08);
  color: rgba(248, 113, 113, 0.8);
  cursor: pointer;
}
.wt-btn-xs {
  padding: 2px 6px;
  font-size: 10px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
}
.wt-btn-xs:hover { color: rgba(255, 255, 255, 0.7); }
.wt-btn-xs-save {
  padding: 2px 6px;
  font-size: 10px;
  border-radius: 3px;
  border: 1px solid rgba(74, 222, 128, 0.2);
  background: rgba(74, 222, 128, 0.08);
  color: rgba(74, 222, 128, 0.8);
  cursor: pointer;
}
.wt-btn-xs-save:hover { background: rgba(74, 222, 128, 0.15); }
.wt-btn-xs-danger {
  padding: 2px 6px;
  font-size: 10px;
  border-radius: 3px;
  border: 1px solid rgba(248, 113, 113, 0.2);
  background: transparent;
  color: rgba(248, 113, 113, 0.7);
  cursor: pointer;
}

.wt-error {
  margin-top: 6px;
  padding: 4px 8px;
  font-size: 11px;
  color: rgba(248, 113, 113, 0.8);
  background: rgba(248, 113, 113, 0.06);
  border-radius: 4px;
  border: 1px solid rgba(248, 113, 113, 0.15);
}

/* 世界推进角色卡 */
.wt-wp-chars { margin-top: 6px; }
.wt-wp-char-card {
  padding: 6px 8px;
  margin-top: 4px;
  background: rgba(167, 139, 250, 0.04);
  border-left: 2px solid rgba(167, 139, 250, 0.25);
  border-radius: 0 4px 4px 0;
}
.wt-wp-char-name { font-size: 11px; font-weight: 600; color: rgba(167, 139, 250, 0.85); }
.wt-wp-char-info { font-size: 11px; color: rgba(255, 255, 255, 0.65); margin-top: 2px; }
.wt-wp-char-reason { font-size: 10px; color: rgba(255, 255, 255, 0.4); margin-top: 2px; }
.wt-wp-char-encounter { font-size: 10px; color: rgba(251, 191, 36, 0.6); margin-top: 2px; }
.wt-wp-bg { margin-top: 6px; }
.wt-wp-bg-item { font-size: 11px; color: rgba(255, 255, 255, 0.5); padding-left: 8px; }

/* 剧情导演 */
.wt-badge {
  font-size: 10px;
  padding: 1px 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.5);
}
.wt-badge.active { color: rgba(74, 222, 128, 0.8); background: rgba(74, 222, 128, 0.08); }
.wt-badge.drafting { color: rgba(251, 191, 36, 0.8); background: rgba(251, 191, 36, 0.08); }
.wt-badge.completed { color: rgba(148, 163, 184, 0.6); }

.wt-plot-create { display: flex; flex-direction: column; gap: 10px; }
.wt-plot-type-row { display: flex; gap: 6px; }
.wt-plot-type-btn {
  padding: 4px 12px;
  font-size: 11px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
}
.wt-plot-type-btn.active {
  border-color: rgba(167, 139, 250, 0.4);
  background: rgba(167, 139, 250, 0.12);
  color: rgba(167, 139, 250, 0.9);
}
.wt-plot-complete-note { font-size: 10px; color: rgba(255, 255, 255, 0.3); }

.wt-plot-chat { display: flex; flex-direction: column; flex: 1; min-height: 0; gap: 8px; }
.wt-plot-messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.04);
}
.wt-plot-msg { max-width: 85%; }
.wt-plot-msg.user { align-self: flex-end; }
.wt-plot-msg.assistant { align-self: flex-start; }
.wt-plot-msg-content {
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.wt-plot-msg.user .wt-plot-msg-content {
  background: rgba(167, 139, 250, 0.15);
  color: rgba(255, 255, 255, 0.85);
}
.wt-plot-msg.assistant .wt-plot-msg-content {
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.75);
}

.wt-plot-input-row { display: flex; gap: 6px; flex-shrink: 0; }
.wt-plot-input {
  flex: 1;
  height: 32px;
  padding: 0 10px;
  font-size: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.25);
  color: rgba(255, 255, 255, 0.85);
  outline: none;
}
.wt-plot-input:focus { border-color: rgba(167, 139, 250, 0.4); }
.wt-plot-input::placeholder { color: rgba(255, 255, 255, 0.25); }

.wt-plot-actions { display: flex; gap: 8px; flex-shrink: 0; }

/* 世界书选择 */
.wt-plot-worldbook {
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  margin-bottom: 6px;
  padding-bottom: 6px;
}
.wt-plot-worldbook-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  user-select: none;
}
.wt-plot-worldbook-toggle:hover { color: rgba(255, 255, 255, 0.65); }
.wt-plot-worldbook-arrow { font-size: 9px; }
.wt-plot-worldbook-list {
  padding: 0 10px 6px;
  max-height: 200px;
  overflow-y: auto;
}
.wt-wb-header {
  display: flex;
  gap: 4px;
  margin-bottom: 4px;
}
.wt-plot-worldbook-search {
  flex: 1;
  height: 26px;
  padding: 0 8px;
  font-size: 11px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.25);
  color: rgba(255, 255, 255, 0.75);
  outline: none;
  box-sizing: border-box;
}
.wt-plot-worldbook-search:focus { border-color: rgba(167, 139, 250, 0.35); }
.wt-plot-worldbook-search::placeholder { color: rgba(255, 255, 255, 0.2); }
.wt-plot-worldbook-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
}
.wt-plot-worldbook-item input[type="checkbox"] { accent-color: rgba(167, 139, 250, 0.8); }
.wt-wb-save-btn {
  flex-shrink: 0;
  height: 26px;
  padding: 0 10px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 4px;
  border: 1px solid rgba(74, 222, 128, 0.3);
  background: rgba(74, 222, 128, 0.08);
  color: rgba(74, 222, 128, 0.85);
  cursor: pointer;
  transition: all 0.15s;
}
.wt-wb-save-btn:hover { background: rgba(74, 222, 128, 0.18); }

/* 大总结注入控制 */
.wt-plot-summary-cfg {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.wt-summary-cfg-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.wt-summary-cfg-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.35);
  flex-shrink: 0;
  width: 52px;
}
.wt-summary-cfg-num {
  width: 44px;
  height: 22px;
  padding: 0 4px;
  font-size: 11px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.25);
  color: rgba(255, 255, 255, 0.75);
  outline: none;
  text-align: center;
}
.wt-summary-cfg-num:focus { border-color: rgba(167, 139, 250, 0.35); }
.wt-summary-cfg-hint {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.2);
}
.wt-summary-cfg-all {
  padding: 1px 6px;
  font-size: 10px;
  border-radius: 3px;
  border: 1px solid rgba(167, 139, 250, 0.25);
  background: rgba(167, 139, 250, 0.08);
  color: rgba(167, 139, 250, 0.7);
  cursor: pointer;
}
.wt-summary-cfg-all:hover { background: rgba(167, 139, 250, 0.15); }
.wt-summary-cfg-radio {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
}
.wt-summary-cfg-radio input[type="radio"] { accent-color: rgba(167, 139, 250, 0.8); }

/* 防剧透 */
.wt-spoiler-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: rgba(248, 113, 113, 0.6);
  cursor: pointer;
  margin-left: auto;
}
.wt-spoiler-toggle input[type="checkbox"] { accent-color: rgba(248, 113, 113, 0.8); }
.wt-spoiler-label { user-select: none; }
.wt-spoiler-inline {
  font-size: 10px;
  color: rgba(248, 113, 113, 0.5);
  font-style: italic;
}
.wt-spoiler-notice {
  text-align: center;
  font-size: 11px;
  color: rgba(248, 113, 113, 0.5);
  padding: 8px;
  margin: 4px 0;
  background: rgba(248, 113, 113, 0.04);
  border: 1px dashed rgba(248, 113, 113, 0.15);
  border-radius: 6px;
}

/* 活跃大纲 */
.wt-plot-active { display: flex; flex-direction: column; gap: 10px; }
.wt-plot-progress-bar {
  height: 4px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 2px;
  overflow: hidden;
  margin-top: 4px;
}
.wt-plot-progress-fill {
  height: 100%;
  background: rgba(167, 139, 250, 0.6);
  border-radius: 2px;
  transition: width 0.3s;
}
.wt-plot-ending { font-size: 11px; color: rgba(255, 255, 255, 0.5); }
.wt-plot-stages { display: flex; flex-direction: column; gap: 4px; }
.wt-plot-stage {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
}
.wt-plot-stage.current {
  border-color: rgba(167, 139, 250, 0.25);
  background: rgba(167, 139, 250, 0.06);
}
.wt-plot-stage.done { opacity: 0.5; }
.wt-plot-stage-idx {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(167, 139, 250, 0.15);
  color: rgba(167, 139, 250, 0.8);
  font-size: 10px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.wt-plot-stage.done .wt-plot-stage-idx { background: rgba(74, 222, 128, 0.15); color: rgba(74, 222, 128, 0.8); }
.wt-plot-stage-desc { font-size: 11px; color: rgba(255, 255, 255, 0.7); line-height: 1.4; flex: 1; }
.wt-plot-stage-chars { font-size: 10px; color: rgba(167, 139, 250, 0.5); flex-shrink: 0; }

.wt-plot-check { margin-top: 6px; padding: 8px; background: rgba(0, 0, 0, 0.2); border-radius: 6px; }
.wt-plot-check-status {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 8px;
  font-size: 10px;
  margin-top: 4px;
}
.wt-plot-check-status.on_track { color: rgba(74, 222, 128, 0.8); background: rgba(74, 222, 128, 0.08); }
.wt-plot-check-status.ahead { color: rgba(96, 165, 250, 0.8); background: rgba(96, 165, 250, 0.08); }
.wt-plot-check-status.behind { color: rgba(251, 191, 36, 0.8); background: rgba(251, 191, 36, 0.08); }
.wt-plot-check-status.deviated { color: rgba(248, 113, 113, 0.8); background: rgba(248, 113, 113, 0.08); }
.wt-plot-check-guidance { font-size: 11px; color: rgba(255, 255, 255, 0.5); margin-top: 4px; line-height: 1.4; }
</style>
