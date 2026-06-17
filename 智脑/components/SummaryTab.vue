<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useMainStore, type TimelineEvent, type TimelineEventTrigger } from '../stores/mainStore';
import { executeBatchSummary, type BatchProgress } from '../core/batchSummary';
import { embedTimelineEvents, embedCharacterMemories, getEmbedding } from '../core/embedding';
import { embedItems } from '../core/itemMemory';

const store = useMainStore();

// ─── 批量总结（状态在 store 中，切 tab 不丢失）───
const {
  showBatchPanel, batchRunning, batchAbortRequested, batchStart, batchEnd, batchSize, batchProgress,
} = storeToRefs(store);

function onBatchProgress(p: BatchProgress) {
  Object.assign(batchProgress.value, p);
  if (p.status === 'done' || p.status === 'cancelled') batchRunning.value = false;
  if (p.status === 'paused') batchRunning.value = false;
}

async function runBatch(fromFloor: number) {
  if (batchRunning.value) return;
  batchRunning.value = true;
  batchAbortRequested.value = false;
  if (fromFloor === batchStart.value) {
    store.resetBatchProgress();
    Object.assign(batchProgress.value, {
      startFloor: batchStart.value,
      endFloor: batchEnd.value,
      batchSize: batchSize.value,
    });
  }
  await executeBatchSummary(
    fromFloor,
    batchEnd.value,
    batchSize.value,
    capturedContents.value,
    store,
    onBatchProgress,
    batchAbortRequested,
  );
  batchRunning.value = false;
}

async function startBatch() {
  await runBatch(batchStart.value);
}

function resumeBatch() {
  // 计算失败批次的首层：startFloor + (failedBatch - 1) * batchSize
  const failedErr = batchProgress.value.errors.find(e => e.retries > 3);
  const resumeFloor = failedErr
    ? batchProgress.value.startFloor + (failedErr.batch - 1) * batchProgress.value.batchSize
    : batchProgress.value.currentBatchFloorStart || batchProgress.value.startFloor;
  runBatch(resumeFloor);
}

function stopBatch() {
  if (batchRunning.value) {
    batchAbortRequested.value = true;
  } else {
    batchProgress.value.status = 'cancelled';
    batchRunning.value = false;
  }
}

// ─── 召回设置 ───
const showRecallSettings = ref(false);

// ─── 语义向量 ───
const embeddingStats = reactive({ total: 0, withEmb: 0, without: 0 });
const itemEmbStats = reactive({ total: 0, withEmb: 0, without: 0 });
const summaryEmbStats = reactive<Array<{ version: number; total: number; withEmb: number }>>([]);
const charEmbStats = reactive<Array<{ name: string; total: number; withEmb: number }>>([]);
const isGeneratingEmbeddings = ref(false);
const embeddingGenMsg = ref('');
const embTestResult = ref<{ ok: boolean; message: string } | null>(null);
const rerankTestResult = ref<{ ok: boolean; message: string } | null>(null);
const showReembedConfirm = ref(false);
const isReembedding = ref(false);

/** 模型 → 最大维度映射 */
const MODEL_MAX_DIMS: Record<string, number> = {
  'BAAI/bge-m3': 1024,
  'BAAI/bge-large-zh-v1.5': 1024,
  'BAAI/bge-base-zh-v1.5': 768,
  'BAAI/bge-small-zh-v1.5': 512,
  'Qwen/Qwen3-Embedding-0.6B': 1024,
  'Qwen/Qwen3-Embedding-4B': 2560,
  'Qwen/Qwen3-Embedding-8B': 4096,
  'Pro/BAAI/bge-m3': 1024,
};
const QWEN_DIM_OPTIONS = [64, 128, 256, 512, 768, 1024, 2048, 2560, 4096].map(d => ({ value: d, label: String(d) }));

/** 根据当前嵌入模型返回可用的维度选项 */
function embeddingDimOptions(): { value: number; label: string }[] {
  const model = store.settings.embeddingModel;
  const max = MODEL_MAX_DIMS[model];
  if (max !== undefined) {
    if (model.startsWith('Qwen/')) return QWEN_DIM_OPTIONS.filter(o => o.value <= max);
    return [{ value: max, label: `${max}（固定）` }];
  }
  const cur = store.settings.embeddingDimensions;
  const set = new Set([64, 128, 256, 512, 768, 1024, 2048, 2560, 4096, cur]);
  return [...set].sort((a, b) => a - b).map(d => ({ value: d, label: String(d) }));
}

/** 切换嵌入模型时自动设为该模型最大维度 */
function onModelChange(newModel: string) {
  const max = MODEL_MAX_DIMS[newModel];
  const patch: Record<string, unknown> = { embeddingModel: newModel };
  if (max !== undefined) patch.embeddingDimensions = max;
  store.updateSettings(patch as any);
}

async function testEmbeddingConnection() {
  const key = store.settings.embeddingApiKey?.trim();
  if (!key) {
    embTestResult.value = { ok: false, message: '请先填写 API Key' };
    return;
  }
  embTestResult.value = null;
  try {
    const t0 = Date.now();
    await getEmbedding('测试连接', {
      enabled: true,
      apiUrl: store.settings.embeddingApiUrl,
      apiKey: key,
      model: store.settings.embeddingModel,
      dimensions: store.settings.embeddingDimensions,
      similarityThreshold: 0,
    });
    const ms = Date.now() - t0;
    embTestResult.value = { ok: true, message: `✅ 连接成功 (${ms}ms)` };
  } catch (err: any) {
    embTestResult.value = { ok: false, message: `❌ 失败: ${err?.message || err}` };
  }
}

async function testRerankConnection() {
  const key = store.settings.embeddingApiKey?.trim();
  if (!key) {
    rerankTestResult.value = { ok: false, message: '请先填写 API Key' };
    return;
  }
  rerankTestResult.value = null;
  try {
    const t0 = Date.now();
    const apiUrl = store.settings.embeddingApiUrl || 'https://api.siliconflow.cn/v1/embeddings';
    const rerankUrl = apiUrl.replace(/\/embeddings\/?$/, '/rerank');
    const resp = await fetch(rerankUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: store.settings.rerankModel || 'BAAI/bge-reranker-v2-m3',
        query: '测试',
        documents: ['这是一条测试文档', '这是另一条测试'],
        top_n: 1,
      }),
    });
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      throw new Error(`${resp.status} ${errBody}`);
    }
    const ms = Date.now() - t0;
    rerankTestResult.value = { ok: true, message: `✅ 连接成功 (${ms}ms)` };
  } catch (err: any) {
    rerankTestResult.value = { ok: false, message: `❌ 失败: ${err?.message || err}` };
  }
}

function scanEmbeddingStats() {
  let total = 0, totalMem = 0, withEmb = 0, withMemEmb = 0;
  const perSummary: typeof summaryEmbStats = [];
  for (const s of store.summaries) {
    let st = 0, se = 0;
    for (const e of s.timeline) {
      if (!e.event) continue;
      st++;
      if (e.embedding) se++;
    }
    // 核心记忆统计
    let mt = 0, me = 0;
    for (const m of s.characterMemories) {
      for (const c of m.coreMemories || []) {
        if (!(c as any).text && !(typeof c === 'string')) continue;
        mt++;
        if ((c as any).embedding) me++;
      }
    }
    total += st;
    withEmb += se;
    totalMem += mt;
    withMemEmb += me;
    perSummary.push({ version: s.version, total: st + mt, withEmb: se + me });
  }
  // 物品记忆向量统计
  let itemTotal = 0, itemWithEmb = 0;
  const activeItems = (store.chatData.itemMemories || []).filter(i => i.status === 'active');
  for (const item of activeItems) {
    itemTotal++;
    if (item.embedding && item.embedding.length > 0) itemWithEmb++;
  }
  itemEmbStats.total = itemTotal;
  itemEmbStats.withEmb = itemWithEmb;
  itemEmbStats.without = itemTotal - itemWithEmb;

  embeddingStats.total = total + totalMem + itemTotal;
  embeddingStats.withEmb = withEmb + withMemEmb + itemWithEmb;
  embeddingStats.without = embeddingStats.total - embeddingStats.withEmb;
  summaryEmbStats.length = 0;
  summaryEmbStats.push(...perSummary);

  // 每角色核心记忆向量统计（遍历所有版本，按角色名聚合）
  const charMap = new Map<string, { total: number; withEmb: number }>();
  for (const s of store.summaries) {
    for (const m of s.characterMemories) {
      const entry = charMap.get(m.characterName) || { total: 0, withEmb: 0 };
      for (const c of (m.coreMemories || []) as any[]) {
        const t = typeof c === 'string' ? c : (c?.text || '');
        if (!t) continue;
        entry.total++;
        if (c?.embedding) entry.withEmb++;
      }
      charMap.set(m.characterName, entry);
    }
  }
  charEmbStats.length = 0;
  for (const [name, stats] of charMap) {
    if (stats.total > 0) charEmbStats.push({ name, ...stats });
  }
  charEmbStats.sort((a, b) => b.total - a.total);
}

async function generateAllEmbeddings() {
  if (isGeneratingEmbeddings.value) return;
  scanEmbeddingStats();
  if (embeddingStats.without === 0) {
    embeddingGenMsg.value = '✅ 全部事件、核心记忆和物品已有向量，无需生成';
    return;
  }
  isGeneratingEmbeddings.value = true;
  embeddingGenMsg.value = '';
  try {
    let totalGenerated = 0;
    for (const s of store.summaries) {
      // 事件向量
      const needEmb = s.timeline.filter(e => e.event && !e.embedding);
      if (needEmb.length > 0) {
        embeddingGenMsg.value = `事件… ${totalGenerated}/${embeddingStats.without}`;
        const n = await embedTimelineEvents(
          s.timeline,
          store.settings.embeddingApiUrl,
          store.settings.embeddingApiKey,
          store.settings.embeddingModel,
          store.settings.embeddingDimensions,
        );
        totalGenerated += n;
      }
      // 核心记忆向量
      if (s.characterMemories.length > 0) {
        embeddingGenMsg.value = `记忆… ${totalGenerated}/${embeddingStats.without}`;
        const n = await embedCharacterMemories(
          s.characterMemories,
          store.settings.embeddingApiUrl,
          store.settings.embeddingApiKey,
          store.settings.embeddingModel,
          store.settings.embeddingDimensions,
        );
        totalGenerated += n;
      }
    }
    // 物品向量
    if (itemEmbStats.without > 0) {
      embeddingGenMsg.value = `物品… ${totalGenerated}/${embeddingStats.without}`;
      const n = await embedItems(store.chatData.itemMemories || [], {
        enabled: store.settings.embeddingEnabled,
        apiUrl: store.settings.embeddingApiUrl,
        apiKey: store.settings.embeddingApiKey,
        model: store.settings.embeddingModel,
        dimensions: store.settings.embeddingDimensions,
        similarityThreshold: store.settings.embeddingSimilarityThreshold,
      });
      totalGenerated += n;
    }
    store.forcePersist();
    scanEmbeddingStats();
    embeddingGenMsg.value = `✅ 完成！新生成 ${totalGenerated} 条向量，剩余 ${embeddingStats.without} 条无向量`;
  } catch (err: any) {
    embeddingGenMsg.value = `❌ 失败: ${err?.message || err}`;
  } finally {
    isGeneratingEmbeddings.value = false;
  }
}

/** 清空所有向量并重新生成（换模型后使用） */
async function reembedAll() {
  if (isReembedding.value) return;
  showReembedConfirm.value = false;
  isReembedding.value = true;
  embeddingGenMsg.value = '';
  try {
    for (const s of store.summaries) {
      for (const e of s.timeline) delete (e as any).embedding;
      for (const m of s.characterMemories) {
        for (const c of (m.coreMemories || []) as any[]) delete c.embedding;
      }
    }
    // 清空物品向量
    for (const item of (store.chatData.itemMemories || [])) {
      delete item.embedding;
    }
    store.forcePersist();
    embeddingGenMsg.value = '✅ 旧向量已清空，开始重新生成…';
    scanEmbeddingStats();
    let totalGenerated = 0;
    for (const s of store.summaries) {
      const needEmb = s.timeline.filter(e => e.event && !e.embedding);
      if (needEmb.length > 0) {
        embeddingGenMsg.value = `事件… ${totalGenerated}/${embeddingStats.without}`;
        totalGenerated += await embedTimelineEvents(s.timeline, store.settings.embeddingApiUrl, store.settings.embeddingApiKey, store.settings.embeddingModel, store.settings.embeddingDimensions);
      }
      if (s.characterMemories.length > 0) {
        embeddingGenMsg.value = `记忆… ${totalGenerated}/${embeddingStats.without}`;
        totalGenerated += await embedCharacterMemories(s.characterMemories, store.settings.embeddingApiUrl, store.settings.embeddingApiKey, store.settings.embeddingModel, store.settings.embeddingDimensions);
      }
    }
    // 物品向量
    if (itemEmbStats.without > 0) {
      embeddingGenMsg.value = `物品… ${totalGenerated}/${embeddingStats.without}`;
      totalGenerated += await embedItems(store.chatData.itemMemories || [], {
        enabled: true,
        apiUrl: store.settings.embeddingApiUrl,
        apiKey: store.settings.embeddingApiKey,
        model: store.settings.embeddingModel,
        dimensions: store.settings.embeddingDimensions,
        similarityThreshold: store.settings.embeddingSimilarityThreshold,
      });
    }
    store.forcePersist();
    scanEmbeddingStats();
    embeddingGenMsg.value = `✅ 重新向量化完成！共生成 ${totalGenerated} 条向量`;
  } catch (err: any) {
    embeddingGenMsg.value = `❌ 重新向量化失败: ${err?.message || err}`;
  } finally {
    isReembedding.value = false;
  }
}

// ─── 展开状态 ───
const expandedDetails = ref<Set<string>>(new Set());

// ─── 编辑状态 ───
const editingKey = ref<string | null>(null);
const deleteConfirmKey = ref<string | null>(null); // 删除二次确认
const editDraft = reactive({
  time: '',
  event: '',
  detail: '',
  importance: 3 as number,
  triggers: { characters: '', keywords: '' },
});

// ─── 数据 ───
const summary = computed(() => store.getLatestSummary());
const allEvents = computed(() => summary.value?.timeline || []);
const capturedContents = computed(() => store.capturedContents || []);

// ─── 搜索 ───
const searchQuery = ref('');
const sortOrder = ref<'asc' | 'desc'>('asc');

const filteredEvents = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return allEvents.value;
  return allEvents.value.filter(evt => {
    const fields = [
      evt.time,
      evt.event,
      evt.detail,
      ...(evt.triggers?.characters || []),
      ...(evt.triggers?.keywords || []),
    ];
    return fields.some(f => f?.toLowerCase().includes(q));
  });
});

const sortedEvents = computed(() => {
  const events = filteredEvents.value;
  return sortOrder.value === 'desc' ? [...events].reverse() : events;
});

// ─── 工具 ───
function getEventKey(evt: TimelineEvent): string {
  return `${evt.time}|${evt.event.slice(0, 30)}`;
}

function toggleDetail(key: string) {
  const s = new Set(expandedDetails.value);
  if (s.has(key)) s.delete(key);
  else s.add(key);
  expandedDetails.value = s;
}

// ─── 编辑操作 ───
function startEdit(evt: TimelineEvent) {
  const key = getEventKey(evt);
  editingKey.value = key;
  editDraft.time = evt.time;
  editDraft.event = evt.event;
  editDraft.detail = evt.detail || '';
  editDraft.importance = evt.importance || 3;
  editDraft.triggers.characters = evt.triggers?.characters?.join('、') || '';
  editDraft.triggers.keywords = evt.triggers?.keywords?.join('、') || '';
}

function cancelEdit() {
  editingKey.value = null;
}

function saveEdit(originalEvent: TimelineEvent) {
  // 用 editingKey 作为 oldKey，因为 startEdit 时已经算过一次
  const oldKey = editingKey.value || getEventKey(originalEvent);
  if (!oldKey || oldKey.startsWith('__new__')) {
    console.warn('[智脑] saveEdit: 无效的 oldKey，跳过', oldKey);
    editingKey.value = null;
    return;
  }
  const chars = editDraft.triggers.characters
    .split(/[,，、]/)
    .map(s => s.trim())
    .filter(Boolean);
  const keywords = editDraft.triggers.keywords
    .split(/[,，、]/)
    .map(s => s.trim())
    .filter(Boolean);

  const triggers: TimelineEventTrigger | undefined =
    chars.length > 0 || keywords.length > 0
      ? { characters: chars, keywords }
      : undefined;

  const newEvent: TimelineEvent = {
    time: editDraft.time,
    event: editDraft.event,
    detail: editDraft.detail || undefined,
    importance: editDraft.importance,
    summaryVersion: originalEvent.summaryVersion,
    triggers,
    // 不携带 embedding（内容已变，旧向量作废，稍后异步重新生成）
  };

  // 优先直接在 delta 中修改（和角色记忆编辑一样），保证事件留在原位
  const summaries = store.chatData.summaries;
  let foundInDelta = false;

  // 从最后一条 delta 往前找：先在最新 delta 中匹配 oldKey
  for (let i = summaries.length - 1; i >= 0; i--) {
    const delta = summaries[i];
    if (!delta.timeline) continue;
    const idx = delta.timeline.findIndex(
      (e: TimelineEvent) => `${e.time}|${e.event.slice(0, 30)}` === oldKey,
    );
    if (idx >= 0) {
      // 直接修改 delta 中的事件
      delta.timeline[idx] = newEvent;
      // 替换对象引用触发 Vue 响应式（和角色记忆编辑同模式）
      store.chatData.summaries[i] = { ...delta };
      foundInDelta = true;
      break;
    }
  }

  if (foundInDelta) {
    // 清理旧版本代码留下的相关 override（_deleted 标记、旧key覆盖、新key残留）
    const overrides = store.chatData.timelineOverrides;
    if (overrides && Object.keys(overrides).length > 0) {
      const newEventKey = `${newEvent.time}|${newEvent.event.slice(0, 30)}`;
      const newOverrides: Record<string, any> = {};
      let cleaned = false;
      for (const [k, v] of Object.entries(overrides)) {
        const vKey = v._deleted ? null : `${(v.time || '')}|${(v.event || '').slice(0, 30)}`;
        if (k !== oldKey && vKey !== oldKey && k !== newEventKey) {
          newOverrides[k] = v;
        } else {
          cleaned = true;
        }
      }
      if (cleaned) {
        store.chatData.timelineOverrides = newOverrides;
      }
    }
  } else {
    // 没在 delta 中直接找到 — 可能是旧代码留下的 override 对（_deleted + newKey）
    const overrides = store.chatData.timelineOverrides || {} as Record<string, any>;
    // 找 _deleted 标记的原始 delta key，和匹配 oldKey 的覆盖
    for (const [delKey, delVal] of Object.entries(overrides)) {
      if (!delVal._deleted) continue; // 只关心 _deleted 条目
      // 检查是否有另一个 override 的内容 key 匹配 oldKey
      for (const [ovKey, ovVal] of Object.entries(overrides)) {
        if (ovVal._deleted || ovKey === delKey) continue;
        const ovContentKey = `${(ovVal.time || '')}|${(ovVal.event || '').slice(0, 30)}`;
        if (ovContentKey !== oldKey) continue;
        // 找到了！delKey 是原始 delta key，ovKey 是旧代码的编辑覆盖
        // 直接修改 delta 中 delKey 的事件，清理所有相关 override
        for (let i = summaries.length - 1; i >= 0; i--) {
          const delta = summaries[i];
          if (!delta.timeline) continue;
          const idx = delta.timeline.findIndex(
            (e: TimelineEvent) => `${e.time}|${e.event.slice(0, 30)}` === delKey,
          );
          if (idx >= 0) {
            delta.timeline[idx] = newEvent;
            store.chatData.summaries[i] = { ...delta };
            foundInDelta = true;
            // 清理相关 override（delKey _deleted + ovKey 覆盖 + oldKey 残留）
            const cleaned: Record<string, any> = {};
            for (const [k, v] of Object.entries(overrides)) {
              if (k !== delKey && k !== ovKey && k !== oldKey) cleaned[k] = v;
            }
            store.chatData.timelineOverrides = cleaned;
            break;
          }
        }
        break;
      }
      if (foundInDelta) break;
    }
    if (!foundInDelta) {
      store.replaceTimelineOverride(oldKey, newEvent);
    }
  }

  // delta 直接修改后需要 forcePersist（override 路径的 replaceTimelineOverride 内部已有 doPersist）
  if (foundInDelta) store.forcePersist();
  editingKey.value = null;

  // 异步重新生成该事件的向量（内容已修改，旧向量已清空）
  if (store.settings.embeddingEnabled && store.settings.embeddingApiKey) {
    const curDelta = store.getLatestDelta();
    if (curDelta?.timeline) {
      setTimeout(() => {
        embedTimelineEvents(
          curDelta.timeline,
          store.settings.embeddingApiUrl,
          store.settings.embeddingApiKey,
          store.settings.embeddingModel,
          store.settings.embeddingDimensions,
        ).then(() => {
          const li = store.chatData.summaries.length - 1;
          store.chatData.summaries[li] = { ...store.chatData.summaries[li] };
          store.forcePersist();
          console.info('[智脑] 编辑后自动向量化完成: 时间线事件');
        }).catch(err => {
          console.warn('[智脑] 编辑后自动向量化失败（非致命）:', err);
        });
      }, 100);
    }
  }
}

function deleteEvent(evt: TimelineEvent) {
  const key = getEventKey(evt);
  // 二次确认
  if (deleteConfirmKey.value !== key) {
    deleteConfirmKey.value = key;
    return;
  }
  // 确认删除
  store.removeTimelineOverride(key);
  if (editingKey.value === key) editingKey.value = null;
  deleteConfirmKey.value = null;
}
function cancelDelete() { deleteConfirmKey.value = null; }

function startAdd() {
  const newKey = `__new__${Date.now()}`;
  editingKey.value = newKey;
  editDraft.time = '';
  editDraft.event = '';
  editDraft.detail = '';
  editDraft.importance = 3;
  editDraft.triggers.characters = '';
  editDraft.triggers.keywords = '';
}

function saveAdd() {
  const chars = editDraft.triggers.characters
    .split(/[,，、]/)
    .map(s => s.trim())
    .filter(Boolean);
  const keywords = editDraft.triggers.keywords
    .split(/[,，、]/)
    .map(s => s.trim())
    .filter(Boolean);

  const triggers: TimelineEventTrigger | undefined =
    chars.length > 0 || keywords.length > 0
      ? { characters: chars, keywords }
      : undefined;

  const newEvent: TimelineEvent = {
    time: editDraft.time || '未指定时间',
    event: editDraft.event || '(空事件)',
    detail: editDraft.detail || undefined,
    importance: editDraft.importance,
    triggers,
  };

  store.addTimelineEvent(newEvent);
  editingKey.value = null;
}

function isEditing(evt: TimelineEvent): boolean {
  return editingKey.value === getEventKey(evt);
}
</script>

<template>
  <div class="zhino-summary-scroll">
    <!-- 工具栏（始终可见） -->
    <div class="zhino-toolbar">
      <div class="zhino-toolbar-title">时光轴</div>
      <div class="zhino-toolbar-search">
        <input
          v-model="searchQuery"
          class="zhino-search-input"
          placeholder="搜索事件…"
        />
      </div>
      <div class="zhino-meta-btns">
        <button class="zhino-recall-settings-btn" @click="showBatchPanel = !showBatchPanel">
          批量总结
        </button>
        <button class="zhino-recall-settings-btn" @click="showRecallSettings = !showRecallSettings">
          召回设置
        </button>
      </div>
    </div>

    <!-- 批量总结面板 -->
    <div v-if="showBatchPanel" class="zhino-batch-panel">
      <div class="zhino-batch-row">
        <span class="zhino-batch-label">楼层范围</span>
        <input v-model.number="batchStart" type="number" class="zhino-batch-input" min="0" :disabled="batchRunning" />
        <span class="zhino-batch-dash">—</span>
        <input v-model.number="batchEnd" type="number" class="zhino-batch-input" min="0" :disabled="batchRunning" />
      </div>
      <div class="zhino-batch-row">
        <span class="zhino-batch-label">每批</span>
        <input v-model.number="batchSize" type="number" class="zhino-batch-input small" min="5" max="100" :disabled="batchRunning" />
        <span class="zhino-batch-label">层</span>
      </div>
      <div class="zhino-batch-actions">
        <button
          v-if="batchProgress.status !== 'paused'"
          class="zhino-batch-start-btn"
          :disabled="batchRunning || !batchEnd"
          @click="startBatch()"
        >{{ batchRunning ? '运行中…' : '开始批量总结' }}</button>
        <button
          v-if="batchProgress.status === 'paused'"
          class="zhino-batch-start-btn"
          @click="resumeBatch()"
        >▶ 继续总结</button>
        <button
          v-if="batchProgress.status === 'paused'"
          class="zhino-batch-stop-btn"
          @click="stopBatch()"
        >⏹ 停止总结</button>
        <button
          v-if="batchRunning"
          class="zhino-batch-stop-btn"
          @click="stopBatch()"
        >⏹ 停止</button>
      </div>
      <!-- 进度 -->
      <div v-if="batchProgress.status !== 'idle'" class="zhino-batch-progress">
        <div v-if="batchProgress.totalMessages > 0" class="zhino-batch-info">
          {{ batchProgress.startFloor }}-{{ batchProgress.endFloor }} 层 · 共 {{ batchProgress.totalMessages }} 条捕获 · {{ batchProgress.totalBatches }} 批
        </div>
        <div v-if="batchProgress.currentBatch > 0 && batchProgress.status === 'running'" class="zhino-batch-progress-bar">
          <div class="zhino-batch-progress-fill" :style="{ width: (batchProgress.currentBatch / batchProgress.totalBatches * 100) + '%' }"></div>
        </div>
        <div class="zhino-batch-status">
          <template v-if="batchProgress.status === 'running'">
            第 {{ batchProgress.currentBatch }}/{{ batchProgress.totalBatches }} 批 ({{ batchProgress.currentBatchFloorStart }}-{{ batchProgress.currentBatchFloorEnd }}层{{ batchProgress.currentBatchCount !== undefined ? ', ' + batchProgress.currentBatchCount + '条' : '' }})
          </template>
          <template v-else-if="batchProgress.status === 'paused'">
            ⚠ 第 {{ batchProgress.currentBatch }}/{{ batchProgress.totalBatches }} 批重试耗尽，已暂停
          </template>
          <template v-else-if="batchProgress.status === 'cancelled'">
            ⏹ 已停止 ({{ batchProgress.currentBatch - 1 }}/{{ batchProgress.totalBatches }} 批)
          </template>
          <template v-else>
            已完成 {{ batchProgress.currentBatch }}/{{ batchProgress.totalBatches }} 批
          </template>
        </div>
        <!-- 错误列表 -->
        <div v-if="batchProgress.errors.length > 0" class="zhino-batch-errors">
          <div v-for="(err, i) in batchProgress.errors" :key="i" class="zhino-batch-error-item">
            第{{ err.batch }}批: {{ err.message.slice(0, 80) }}
            <span v-if="err.retries <= 3">（已重试{{ err.retries }}次）</span>
            <span v-else class="zhino-batch-error-final">（重试耗尽）</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 召回设置面板 -->
    <div v-if="showRecallSettings" class="zhino-recall-panel">
      <div class="zhino-recall-row">
        <span class="zhino-recall-label">最近</span>
        <input
          type="number"
          class="zhino-recall-input"
          :value="store.settings.eventRecallRecent"
          min="0"
          max="20"
          @change="store.updateSettings({ eventRecallRecent: Number(($event.target as HTMLInputElement).value) })"
        />
        <span class="zhino-recall-label">轮总结全注入</span>
      </div>
      <div class="zhino-recall-row">
        <span class="zhino-recall-label">远期召回上限</span>
        <input
          type="number"
          class="zhino-recall-input"
          :value="store.settings.eventRecallLimit"
          min="1"
          max="30"
          @change="store.updateSettings({ eventRecallLimit: Number(($event.target as HTMLInputElement).value) })"
        />
        <span class="zhino-recall-label">条</span>
      </div>
      <div class="zhino-recall-hint">
        近期事件直接注入，远期事件触发匹配后多维打分排序（匹配质量/时间近度/词密度/角色重叠），取上限条数
      </div>

      <!-- 语义向量召回 -->
      <div class="zhino-recall-sep"></div>
      <div class="zhino-recall-section-title">智能语义召回</div>
      <div class="zhino-recall-hint">
        大总结后自动生成事件+核心记忆语义向量，注入时混合检索（语义相似度+词汇匹配）进行远期召回。
        <br/>生成向量时自动添加角色上下文注释，提高跨场景语义命中率。
        <br/>默认使用 SiliconFlow <code>BAAI/bge-m3</code>（1024维）。<br/>也可自定义节点地址，接入其他兼容 OpenAI Embedding API 的服务。
      </div>
      <label class="zhino-toggle-row">
        <span class="zhino-toggle-label">开启语义召回</span>
        <input type="checkbox"
          :checked="store.settings.embeddingEnabled"
          @change="store.updateSettings({ embeddingEnabled: ($event.target as HTMLInputElement).checked })"
        />
      </label>
      <template v-if="store.settings.embeddingEnabled">
        <div class="zhino-recall-row">
          <span class="zhino-recall-label">节点地址</span>
          <input
            class="zhino-recall-input url"
            :value="store.settings.embeddingApiUrl"
            @change="store.updateSettings({ embeddingApiUrl: ($event.target as HTMLInputElement).value })"
            placeholder="https://api.siliconflow.cn/v1/embeddings"
          />
        </div>
        <div class="zhino-recall-row">
          <span class="zhino-recall-label">API Key</span>
          <input
            type="password"
            class="zhino-recall-input key"
            :value="store.settings.embeddingApiKey"
            @change="store.updateSettings({ embeddingApiKey: ($event.target as HTMLInputElement).value })"
            placeholder="sk-..."
          />
        </div>
        <div class="zhino-recall-row">
          <span class="zhino-recall-label">模型</span>
          <input
            class="zhino-recall-input model-name"
            :value="store.settings.embeddingModel"
            @input="onModelChange(($event.target as HTMLInputElement).value)"
            placeholder="BAAI/bge-m3"
          />
        </div>
        <div class="zhino-recall-row">
          <span class="zhino-recall-label">维度</span>
          <select
            class="zhino-recall-input"
            :value="store.settings.embeddingDimensions"
            @change="store.updateSettings({ embeddingDimensions: Number(($event.target as HTMLSelectElement).value) })"
          >
            <option
              v-for="opt in embeddingDimOptions()"
              :key="opt.value"
              :value="opt.value"
            >{{ opt.label }}</option>
          </select>
        </div>
        <div class="zhino-recall-row">
          <span class="zhino-recall-label">相似度阈值</span>
          <input
            type="range" min="30" max="80" step="5"
            :value="Math.round(store.settings.embeddingSimilarityThreshold * 100)"
            @input="store.updateSettings({ embeddingSimilarityThreshold: Number(($event.target as HTMLInputElement).value) / 100 })"
            style="width:100px;vertical-align:middle;"
          />
          <span class="zhino-recall-label" style="margin-left:8px">{{ (store.settings.embeddingSimilarityThreshold * 100).toFixed(0) }}%</span>
        </div>
        <div class="zhino-recall-hint">
          阈值越低召回越多（可能噪音），越高越精准（可能漏掉）。推荐 50-60%。
        </div>
        <div class="zhino-recall-row">
          <span class="zhino-recall-label">混合检索权重</span>
          <input
            type="range" min="0" max="100" step="5"
            :value="Math.round(store.settings.hybridWeight * 100)"
            @input="store.updateSettings({ hybridWeight: Number(($event.target as HTMLInputElement).value) / 100 })"
            style="width:100px;vertical-align:middle;"
          />
          <span class="zhino-recall-label" style="margin-left:8px">{{ (store.settings.hybridWeight * 100).toFixed(0) }}%语义 / {{ ((1 - store.settings.hybridWeight) * 100).toFixed(0) }}%词汇</span>
        </div>
        <div class="zhino-recall-hint">
          语义（dense）擅长理解含义，词汇（sparse）擅长匹配专有名词。<br/>推荐 70%语义+30%词汇，纯语义=100%，纯词汇=0%。
        </div>
        <label class="zhino-toggle-row" style="margin-top:8px">
          <div class="zhino-toggle-info">
            <span class="zhino-toggle-label">增强重排 (Reranker)</span>
            <span class="zhino-toggle-desc">粗筛后调用 Reranker 精排，提升精准度。复用上方 API Key</span>
          </div>
          <input type="checkbox"
            :checked="store.settings.rerankEnabled"
            @change="store.updateSettings({ rerankEnabled: ($event.target as HTMLInputElement).checked })"
          />
        </label>
        <div v-if="store.settings.rerankEnabled" class="zhino-recall-row">
          <span class="zhino-recall-label">模型</span>
          <input
            class="zhino-recall-input model-name"
            :value="store.settings.rerankModel"
            @input="store.updateSettings({ rerankModel: ($event.target as HTMLInputElement).value })"
            placeholder="BAAI/bge-reranker-v2-m3"
          />
          <button class="zhino-recall-action-btn" style="margin-left:4px;padding:1px 6px;font-size:9px" @click="testRerankConnection">测试</button>
        </div>
        <div v-if="rerankTestResult" class="zhino-recall-msg" :class="{ ok: rerankTestResult.ok, fail: !rerankTestResult.ok }">
          {{ rerankTestResult.message }}
        </div>
        <div class="zhino-recall-actions">
          <button class="zhino-recall-action-btn" :disabled="isGeneratingEmbeddings || isReembedding" @click="generateAllEmbeddings">
            {{ isGeneratingEmbeddings ? '生成中…' : '为旧数据生成向量' }}
          </button>
          <button class="zhino-recall-action-btn" :disabled="isReembedding" @click="showReembedConfirm = true">
            {{ isReembedding ? '重新向量化中…' : '重新向量化' }}
          </button>
          <button class="zhino-recall-action-btn" @click="scanEmbeddingStats">统计</button>
          <button class="zhino-recall-action-btn" @click="testEmbeddingConnection">测试连接</button>
        </div>
        <div v-if="showReembedConfirm" class="zhino-reembed-confirm">
          <span class="zhino-reembed-warn">⚠️ 将清空所有语义向量并重新生成，适用于换了模型。当前设置：</span>
          <span class="zhino-reembed-model">{{ store.settings.embeddingModel }}（{{ store.settings.embeddingDimensions }}维）</span>
          <div class="zhino-reembed-actions">
            <button class="zhino-action-btn confirm" @click="reembedAll()">确认重新向量化</button>
            <button class="zhino-action-btn cancel" @click="showReembedConfirm = false">取消</button>
          </div>
        </div>
        <div v-if="embTestResult" class="zhino-recall-msg" :class="{ ok: embTestResult.ok, fail: !embTestResult.ok }">
          {{ embTestResult.message }}
        </div>
        <div v-if="embeddingGenMsg" class="zhino-recall-msg" :class="{ ok: embeddingGenMsg.startsWith('✅'), fail: embeddingGenMsg.startsWith('❌') }">
          {{ embeddingGenMsg }}
        </div>
        <div v-if="embeddingStats.total > 0" class="zhino-recall-hint" style="margin-top:4px">
          共 {{ embeddingStats.total }} 条（事件+核心记忆+物品），{{ embeddingStats.withEmb }} 已有向量，{{ embeddingStats.without }} 待生成
        </div>
        <div v-if="itemEmbStats.total > 0" class="zhino-recall-hint">
          物品记忆：{{ itemEmbStats.total }} 件，{{ itemEmbStats.withEmb }} 已有向量，{{ itemEmbStats.without }} 待生成
        </div>
        <!-- 各轮总结向量进度 -->
        <div v-if="summaryEmbStats.length > 0" class="zhino-emb-progress-list">
          <div
            v-for="s in summaryEmbStats"
            :key="s.version"
            class="zhino-emb-progress-row"
            :class="{ done: s.withEmb === s.total, partial: s.withEmb > 0 && s.withEmb < s.total }"
          >
            <span class="zhino-emb-progress-label">v{{ s.version }}</span>
            <div class="zhino-emb-progress-bar-wrap">
              <div
                class="zhino-emb-progress-bar"
                :style="{ width: s.total > 0 ? (s.withEmb / s.total * 100) + '%' : '0%' }"
              ></div>
            </div>
            <span class="zhino-emb-progress-num">{{ s.withEmb }}/{{ s.total }}</span>
          </div>
        </div>
        <!-- 每角色核心记忆向量进度 -->
        <div v-if="charEmbStats.length > 0" class="zhino-emb-char-title">角色核心记忆向量：</div>
        <div v-if="charEmbStats.length > 0" class="zhino-emb-progress-list">
          <div
            v-for="c in charEmbStats"
            :key="c.name"
            class="zhino-emb-progress-row"
            :class="{ done: c.withEmb === c.total, partial: c.withEmb > 0 && c.withEmb < c.total }"
          >
            <span class="zhino-emb-progress-label" :title="c.name">{{ c.name.length > 6 ? c.name.slice(0, 6) + '…' : c.name }}</span>
            <div class="zhino-emb-progress-bar-wrap">
              <div
                class="zhino-emb-progress-bar"
                :style="{ width: c.total > 0 ? (c.withEmb / c.total * 100) + '%' : '0%' }"
              ></div>
            </div>
            <span class="zhino-emb-progress-num">{{ c.withEmb }}/{{ c.total }}</span>
          </div>
        </div>
        <!-- 物品向量进度 -->
        <div v-if="itemEmbStats.total > 0" class="zhino-emb-char-title">物品向量：</div>
        <div v-if="itemEmbStats.total > 0" class="zhino-emb-progress-list">
          <div
            class="zhino-emb-progress-row"
            :class="{ done: itemEmbStats.withEmb === itemEmbStats.total, partial: itemEmbStats.withEmb > 0 && itemEmbStats.withEmb < itemEmbStats.total }"
          >
            <span class="zhino-emb-progress-label">物品</span>
            <div class="zhino-emb-progress-bar-wrap">
              <div
                class="zhino-emb-progress-bar"
                :style="{ width: itemEmbStats.total > 0 ? (itemEmbStats.withEmb / itemEmbStats.total * 100) + '%' : '0%' }"
              ></div>
            </div>
            <span class="zhino-emb-progress-num">{{ itemEmbStats.withEmb }}/{{ itemEmbStats.total }}</span>
          </div>
        </div>
      </template>
    </div>

    <!-- 总结概览（有总结时显示） -->
    <div v-if="summary" class="zhino-summary-meta">
      <div class="zhino-meta-left">
        <span class="zhino-meta-label">#{{ summary.version }}</span>
        <span class="zhino-meta-sep">·</span>
        <span class="zhino-meta-label">{{ summary.generatedAt?.slice(0, 16) || '未知' }}</span>
        <span class="zhino-meta-sep">·</span>
        <span class="zhino-meta-label">{{ summary.coveredMessageIds?.length || 0 }} 层</span>
        <span class="zhino-meta-sep">·</span>
        <span class="zhino-meta-label">
          {{ summary.timeline?.length || 0 }} 事件
          <button class="zhino-sort-btn" @click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'" :title="sortOrder === 'asc' ? '正序（旧→新）' : '倒序（新→旧）'">
            {{ sortOrder === 'asc' ? '↓' : '↑' }}
          </button>
        </span>
      </div>
    </div>

    <!-- 事件列表 -->
    <template v-if="summary">
      <div v-if="sortedEvents.length === 0 && editingKey?.startsWith('__new__') !== true" class="zhino-empty-hint" style="margin-top:12px">
        {{ searchQuery ? '无匹配事件' : '暂无事件' }}
      </div>

      <!-- 现有事件 -->
      <div
        v-for="(evt, idx) in sortedEvents"
        :key="getEventKey(evt)"
        class="zhino-timeline-card"
        :class="'imp-' + (evt.importance || 3)"
      >
        <!-- 显示模式 -->
        <template v-if="!isEditing(evt)">
          <div class="zhino-event-header">
            <div class="zhino-header-left">
              <span class="zhino-timeline-time">{{ evt.time }}</span>
              <span v-if="evt.summaryVersion" class="zhino-version-badge">v{{ evt.summaryVersion }}</span>
              <span v-if="evt.importance" class="zhino-imp-badge" :class="'imp-' + evt.importance">
                {{ ['','☆','★★','★★★','★★★★','★★★★★'][evt.importance] }}
              </span>
            </div>
            <div class="zhino-event-actions">
              <template v-if="deleteConfirmKey === getEventKey(evt)">
                <button class="zhino-action-btn confirm" @click="deleteEvent(evt)">确认删除</button>
                <button class="zhino-action-btn cancel" @click="cancelDelete()">取消</button>
              </template>
              <template v-else>
                <button class="zhino-action-btn" @click="startEdit(evt)">✎ 编辑</button>
                <button class="zhino-action-btn del" @click="deleteEvent(evt)">✕ 删除</button>
              </template>
            </div>
          </div>
          <div class="zhino-timeline-event">{{ evt.event }}</div>
          <!-- 触发器 -->
          <div v-if="evt.triggers" class="zhino-trigger-row">
            <span v-if="evt.triggers.characters?.length" class="zhino-trigger-tag chars">
              {{ evt.triggers.characters.join(' · ') }}
            </span>
            <span v-if="evt.triggers.keywords?.length" class="zhino-trigger-tag keys">
              {{ evt.triggers.keywords.join(' · ') }}
            </span>
          </div>
          <!-- 详情展开 -->
          <div
            v-if="evt.detail"
            class="zhino-detail-toggle"
            @click="toggleDetail(getEventKey(evt))"
          >
            {{ expandedDetails.has(getEventKey(evt)) ? '收起 ▾' : '展开详情 ▸' }}
          </div>
          <div v-if="expandedDetails.has(getEventKey(evt))" class="zhino-timeline-detail">
            {{ evt.detail }}
          </div>
        </template>

        <!-- 编辑模式 -->
        <template v-else>
          <div class="zhino-edit-row">
            <label class="zhino-edit-label">时间</label>
            <input v-model="editDraft.time" class="zhino-edit-input" placeholder="剧情日期" />
          </div>
          <div class="zhino-edit-row">
            <label class="zhino-edit-label">事件</label>
            <textarea v-model="editDraft.event" class="zhino-edit-textarea" rows="2" placeholder="事件内容" />
          </div>
          <div class="zhino-edit-row">
            <label class="zhino-edit-label">重要度</label>
            <div class="zhino-imp-selector">
              <button v-for="n in 5" :key="n"
                class="zhino-imp-star" :class="{ active: editDraft.importance >= n }"
                @click="editDraft.importance = n"
              >★</button>
              <span class="zhino-imp-label">{{ ['','☆','★★','★★★','★★★★','★★★★★'][editDraft.importance] }}</span>
            </div>
          </div>
          <div class="zhino-edit-row">
            <label class="zhino-edit-label">激活角色</label>
            <input v-model="editDraft.triggers.characters" class="zhino-edit-input" placeholder="逗号分隔" />
          </div>
          <div class="zhino-edit-row">
            <label class="zhino-edit-label">激活关键词</label>
            <input v-model="editDraft.triggers.keywords" class="zhino-edit-input" placeholder="逗号分隔" />
          </div>
          <div class="zhino-edit-row">
            <label class="zhino-edit-label">完整详情</label>
            <textarea v-model="editDraft.detail" class="zhino-edit-textarea" rows="3" placeholder="事件详细过程" />
          </div>
          <div class="zhino-edit-actions">
            <button class="zhino-edit-save" @click="saveEdit(evt)">保存</button>
            <button class="zhino-edit-cancel" @click="cancelEdit()">取消</button>
          </div>
        </template>
      </div>

      <!-- 添加中的新事件 -->
      <div v-if="editingKey?.startsWith('__new__')" class="zhino-timeline-card">
        <div class="zhino-edit-row">
          <label class="zhino-edit-label">时间</label>
          <input v-model="editDraft.time" class="zhino-edit-input" placeholder="剧情日期" />
        </div>
        <div class="zhino-edit-row">
          <label class="zhino-edit-label">事件</label>
          <textarea v-model="editDraft.event" class="zhino-edit-textarea" rows="2" placeholder="事件内容" />
        </div>
        <div class="zhino-edit-row">
          <label class="zhino-edit-label">重要度</label>
          <div class="zhino-imp-selector">
            <button v-for="n in 5" :key="n"
              class="zhino-imp-star" :class="{ active: editDraft.importance >= n }"
              @click="editDraft.importance = n"
            >★</button>
            <span class="zhino-imp-label">{{ ['','☆','★★','★★★','★★★★','★★★★★'][editDraft.importance] }}</span>
          </div>
        </div>
        <div class="zhino-edit-row">
          <label class="zhino-edit-label">激活角色</label>
          <input v-model="editDraft.triggers.characters" class="zhino-edit-input" placeholder="逗号分隔" />
        </div>
        <div class="zhino-edit-row">
          <label class="zhino-edit-label">激活关键词</label>
          <input v-model="editDraft.triggers.keywords" class="zhino-edit-input" placeholder="逗号分隔" />
        </div>
        <div class="zhino-edit-row">
          <label class="zhino-edit-label">完整详情</label>
          <textarea v-model="editDraft.detail" class="zhino-edit-textarea" rows="3" placeholder="事件详细过程" />
        </div>
        <div class="zhino-edit-actions">
          <button class="zhino-edit-save" @click="saveAdd()">添加</button>
          <button class="zhino-edit-cancel" @click="cancelEdit()">取消</button>
        </div>
      </div>

      <!-- 添加按钮 -->
      <button
        v-if="!editingKey?.startsWith('__new__')"
        class="zhino-add-event-btn"
        @click="startAdd()"
      >+ 添加事件</button>
    </template>
  </div>
</template>

<style scoped>
.zhino-summary-scroll {
  padding: 10px 12px;
  height: 100%;
  overflow-y: auto;
}

/* ─── 工具栏 ─── */
.zhino-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.zhino-toolbar-title {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.25);
  letter-spacing: 1px;
  flex-shrink: 0;
}

.zhino-toolbar-search {
  flex: 1;
  min-width: 0;
}

.zhino-search-input {
  width: 100%;
  height: 28px;
  padding: 0 10px;
  font-size: 11px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.25);
  color: rgba(255, 255, 255, 0.8);
  outline: none;
  transition: border-color 0.15s;
}
.zhino-search-input:focus {
  border-color: rgba(167, 139, 250, 0.35);
}
.zhino-search-input::placeholder {
  color: rgba(255, 255, 255, 0.25);
}

/* ─── 概览 ─── */
.zhino-summary-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 2px 0;
  font-size: 10.5px;
  color: rgba(255, 255, 255, 0.3);
  margin-bottom: 12px;
}

.zhino-meta-left {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}

.zhino-meta-label {
  color: rgba(255, 255, 255, 0.3);
}

.zhino-meta-sep {
  margin: 0 5px;
  color: rgba(255, 255, 255, 0.12);
}

.zhino-sort-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-left: 4px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
  cursor: pointer;
  vertical-align: middle;
  line-height: 1;
}
.zhino-sort-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
}

/* ─── 事件卡片 ─── */
.zhino-timeline-card {
  background: rgba(255, 255, 255, 0.015);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-left: 2px solid rgba(255, 255, 255, 0.08);
  border-radius: 0 5px 5px 0;
  padding: 10px 12px;
  margin-bottom: 8px;
  transition: background 0.2s;
}

.zhino-timeline-card:hover {
  background: rgba(255, 255, 255, 0.025);
}

.zhino-timeline-card.imp-5 { border-left-color: rgba(255, 180, 30, 0.5); }
.zhino-timeline-card.imp-4 { border-left-color: rgba(255, 150, 30, 0.35); }
.zhino-timeline-card.imp-3 { border-left-color: rgba(255, 255, 255, 0.1); }
.zhino-timeline-card.imp-2 { border-left-color: rgba(255, 255, 255, 0.06); }
.zhino-timeline-card.imp-1 { border-left-color: rgba(255, 255, 255, 0.03); }

/* ─── 事件头部 ─── */
.zhino-event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.zhino-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.zhino-timeline-time {
  font-size: 10.5px;
  color: rgba(255, 255, 255, 0.3);
}

.zhino-version-badge {
  font-size: 9px;
  color: rgba(120, 180, 255, 0.45);
  padding: 1px 5px;
  border: 1px solid rgba(120, 180, 255, 0.15);
  border-radius: 3px;
  background: rgba(120, 180, 255, 0.06);
  font-family: monospace;
}

.zhino-imp-badge {
  font-size: 9px;
  letter-spacing: 1px;
}

.zhino-imp-badge.imp-5 { color: rgba(255, 180, 30, 0.75); }
.zhino-imp-badge.imp-4 { color: rgba(255, 150, 30, 0.6); }
.zhino-imp-badge.imp-3 { color: rgba(255, 255, 255, 0.3); }
.zhino-imp-badge.imp-2 { color: rgba(255, 255, 255, 0.2); }
.zhino-imp-badge.imp-1 { color: rgba(255, 255, 255, 0.12); }

.zhino-event-actions {
  display: flex;
  flex-direction: column;
  gap: 3px;
  opacity: 0;
  transition: opacity 0.15s;
}

.zhino-timeline-card:hover .zhino-event-actions {
  opacity: 1;
}

.zhino-action-btn {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.35);
  cursor: pointer;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.15s;
  white-space: nowrap;
}

.zhino-action-btn:hover {
  color: rgba(255, 255, 255, 0.65);
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
}

.zhino-action-btn.del:hover {
  color: rgba(255, 90, 90, 0.8);
  border-color: rgba(255, 90, 90, 0.3);
}

.zhino-action-btn.confirm {
  color: rgba(255, 90, 90, 0.8);
  border-color: rgba(255, 90, 90, 0.3);
}
.zhino-action-btn.confirm:hover {
  color: #fff;
  background: rgba(255, 90, 90, 0.2);
}

.zhino-action-btn.cancel {
  color: rgba(255, 255, 255, 0.35);
}
.zhino-action-btn.cancel:hover {
  color: rgba(255, 255, 255, 0.6);
}

/* ─── 事件内容 ─── */
.zhino-timeline-event {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.55;
}

/* ─── 触发器 ─── */
.zhino-trigger-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.zhino-trigger-tag {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.03);
  line-height: 1.4;
}

.zhino-trigger-tag.chars {
  color: rgba(130, 170, 255, 0.5);
}

.zhino-trigger-tag.keys {
  color: rgba(190, 150, 255, 0.45);
}

/* ─── 详情展开 ─── */
.zhino-detail-toggle {
  font-size: 10.5px;
  color: rgba(255, 255, 255, 0.2);
  cursor: pointer;
  margin-top: 6px;
  user-select: none;
  transition: color 0.15s;
}

.zhino-detail-toggle:hover {
  color: rgba(255, 255, 255, 0.4);
}

.zhino-timeline-detail {
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.6;
  margin-top: 6px;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 4px;
  white-space: pre-wrap;
}

/* ─── 编辑表单 ─── */
.zhino-edit-row {
  margin-bottom: 6px;
}

.zhino-edit-label {
  display: block;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.25);
  margin-bottom: 2px;
}

.zhino-edit-input,
.zhino-edit-select {
  width: 100%;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  padding: 4px 6px;
  outline: none;
  font-family: inherit;
}

.zhino-edit-select option {
  background: #111;
  color: #ddd;
}

.zhino-edit-textarea {
  width: 100%;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  padding: 4px 6px;
  outline: none;
  resize: vertical;
  font-family: inherit;
}

.zhino-imp-selector {
  display: flex;
  align-items: center;
  gap: 4px;
}
.zhino-imp-star {
  all: unset;
  font-size: 18px;
  cursor: pointer;
  color: #3a3a5c;
  transition: color 0.15s;
}
.zhino-imp-star.active {
  color: #f0c060;
}
.zhino-imp-label {
  font-size: 12px;
  color: #888;
  margin-left: 8px;
  min-width: 50px;
}

.zhino-edit-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.zhino-edit-save {
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(80, 200, 120, 0.15);
  color: rgba(80, 200, 120, 0.8);
  border: 1px solid rgba(80, 200, 120, 0.2);
  border-radius: 4px;
  cursor: pointer;
}

.zhino-edit-save:hover {
  background: rgba(80, 200, 120, 0.25);
}

.zhino-edit-cancel {
  padding: 3px 10px;
  font-size: 11px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  cursor: pointer;
}

.zhino-edit-cancel:hover {
  color: rgba(255, 255, 255, 0.5);
}

/* ─── 添加按钮 ─── */
.zhino-add-event-btn {
  width: 100%;
  padding: 6px 0;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.02);
  border: 1px dashed rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  cursor: pointer;
  margin-top: 4px;
  transition: all 0.15s;
}

.zhino-add-event-btn:hover {
  color: rgba(255, 255, 255, 0.45);
  border-color: rgba(255, 255, 255, 0.15);
}

/* ─── 召回设置 ─── */
.zhino-recall-settings-btn {
  font-size: 10px;
  padding: 2px 8px;
  color: rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.zhino-recall-settings-btn:hover {
  color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.12);
}

.zhino-recall-panel {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 12px;
}

.zhino-recall-row {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 4px;
}

.zhino-recall-row:last-of-type {
  margin-bottom: 6px;
}

.zhino-recall-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.32);
  white-space: nowrap;
}

.zhino-recall-input {
  width: 48px;
  padding: 1px 4px;
  font-size: 10px;
  text-align: center;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  color: rgba(255, 255, 255, 0.7);
  outline: none;
  font-family: inherit;
}

.zhino-recall-hint {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.15);
  line-height: 1.4;
}

/* ─── 召回面板内嵌样式 ─── */
.zhino-recall-sep {
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 8px 0;
}

.zhino-recall-section-title {
  font-size: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.45);
  margin-bottom: 3px;
}

.zhino-recall-panel :deep(.zhino-toggle-row) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 0;
  cursor: pointer;
}

.zhino-recall-panel :deep(.zhino-toggle-label) {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
}

.zhino-recall-panel :deep(.zhino-toggle-desc) {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.2);
}

.zhino-recall-panel :deep(.zhino-toggle-row input[type="checkbox"]) {
  width: 14px;
  height: 14px;
  accent-color: #a78bfa;
}

.zhino-recall-input.url {
  width: 280px;
  text-align: left;
}
.zhino-recall-input.key {
  width: 180px;
}

.zhino-recall-input.model-name {
  width: 200px;
}

/* ─── 向量进度列表 ─── */
.zhino-emb-progress-list {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.zhino-emb-progress-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
}

.zhino-emb-progress-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.25);
  min-width: 20px;
}

.zhino-emb-progress-row.done .zhino-emb-progress-label {
  color: rgba(80, 200, 120, 0.5);
}

.zhino-emb-progress-row.partial .zhino-emb-progress-label {
  color: rgba(240, 192, 96, 0.5);
}

.zhino-emb-progress-bar-wrap {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 2px;
  overflow: hidden;
}

.zhino-emb-progress-bar {
  height: 100%;
  background: rgba(167, 139, 250, 0.4);
  border-radius: 2px;
  transition: width 0.3s;
  min-width: 2px;
}

.zhino-emb-progress-row.done .zhino-emb-progress-bar {
  background: rgba(80, 200, 120, 0.4);
}

.zhino-emb-progress-row.partial .zhino-emb-progress-bar {
  background: rgba(240, 192, 96, 0.4);
}

.zhino-emb-progress-num {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.2);
  min-width: 28px;
  text-align: right;
}

.zhino-emb-progress-row.done .zhino-emb-progress-num {
  color: rgba(80, 200, 120, 0.5);
}

.zhino-emb-progress-row.partial .zhino-emb-progress-num {
  color: rgba(240, 192, 96, 0.5);
}

.zhino-emb-char-title {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
  margin-top: 8px;
  margin-bottom: 2px;
}

.zhino-recall-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.zhino-recall-action-btn {
  padding: 3px 10px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.zhino-recall-action-btn:hover:not(:disabled) {
  color: rgba(255, 255, 255, 0.7);
  border-color: rgba(255, 255, 255, 0.2);
}

.zhino-recall-action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.zhino-recall-msg {
  font-size: 11px;
  margin-top: 6px;
  color: rgba(255, 255, 255, 0.3);
}

.zhino-recall-msg.ok {
  color: rgba(80, 200, 120, 0.8);
}

.zhino-recall-msg.fail {
  color: rgba(255, 80, 80, 0.8);
}

/* ─── 重新向量化确认 ─── */
.zhino-reembed-confirm {
  margin-top: 8px;
  padding: 8px 10px;
  background: rgba(255, 180, 30, 0.06);
  border: 1px solid rgba(255, 180, 30, 0.15);
  border-radius: 5px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.zhino-reembed-warn {
  font-size: 10.5px;
  color: rgba(255, 200, 80, 0.7);
  line-height: 1.4;
}

.zhino-reembed-model {
  font-size: 10.5px;
  color: rgba(255, 255, 255, 0.4);
  font-family: monospace;
}

.zhino-reembed-actions {
  display: flex;
  gap: 6px;
}

/* ─── 元信息按钮组 ─── */
.zhino-meta-btns {
  display: flex;
  gap: 6px;
}

/* ─── 批量总结面板 ─── */
.zhino-batch-panel {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 12px;
}

.zhino-batch-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 11px;
}

.zhino-batch-label {
  color: rgba(255, 255, 255, 0.3);
  white-space: nowrap;
}

.zhino-batch-dash {
  color: rgba(255, 255, 255, 0.15);
}

.zhino-batch-input {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 11px;
  padding: 4px 6px;
  width: 80px;
  outline: none;
  font-family: inherit;
  text-align: center;
}

.zhino-batch-input.small {
  width: 50px;
}

.zhino-batch-input:disabled {
  opacity: 0.4;
}

.zhino-batch-actions {
  margin-bottom: 8px;
}

.zhino-batch-start-btn {
  padding: 5px 16px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(80, 150, 255, 0.15);
  color: rgba(80, 150, 255, 0.8);
  border: 1px solid rgba(80, 150, 255, 0.2);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.zhino-batch-start-btn:hover:not(:disabled) {
  background: rgba(80, 150, 255, 0.25);
}

.zhino-batch-start-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.zhino-batch-stop-btn {
  padding: 5px 16px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(255, 80, 80, 0.12);
  color: rgba(255, 100, 100, 0.75);
  border: 1px solid rgba(255, 80, 80, 0.18);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
  margin-left: 6px;
}
.zhino-batch-stop-btn:hover {
  background: rgba(255, 80, 80, 0.22);
}

/* ─── 批量进度 ─── */
.zhino-batch-info {
  font-size: 10.5px;
  color: rgba(255, 255, 255, 0.35);
  margin-bottom: 6px;
}

.zhino-batch-progress-bar {
  height: 3px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 2px;
  margin-bottom: 6px;
  overflow: hidden;
}

.zhino-batch-progress-fill {
  height: 100%;
  background: rgba(80, 150, 255, 0.5);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.zhino-batch-status {
  font-size: 10.5px;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 4px;
}

.zhino-batch-errors {
  margin-top: 8px;
  max-height: 120px;
  overflow-y: auto;
}

.zhino-batch-error-item {
  font-size: 10px;
  color: rgba(255, 140, 100, 0.55);
  padding: 3px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.zhino-batch-error-final {
  color: rgba(255, 80, 80, 0.7);
  font-weight: 600;
}
</style>
