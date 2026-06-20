<script setup lang="ts">
import { useMainStore, type CapturedContent, type GrandSummary, type TimelineEvent } from '../stores/mainStore';
import { getContentsSinceLast, buildMemorySectionText } from '../core/summary';
import { executeDreamtalkAnalysis } from '../core/dreamtalk';
import { executeGrandSummaryV2 } from '../core/grandSummaryV2';
import { executeCharacterMemoryUpdate } from '../core/characterMemoryUpdate';

import { archiveItemsFromEvents, embedItems, removeItemHistoryByVersion } from '../core/itemMemory';
import { embedTimelineEvents, embedCharacterMemories } from '../core/embedding';
import {
  getCapturedContentMessageIds,
  hideSummaryFloors,
  parseFloorRange,
  setFloorsHidden,
} from '../core/floorVisibility';
import { enqueueAnalysis, getQueueState, clearSchedulerQueue, pause as pauseQueue, resume as resumeQueue } from '../core/backgroundQueue';
import { syncSmallSummaryStatus } from '../core/contextReplacement';

const store = useMainStore();

// 大总结引导弹窗（直接调用 store 方法，store.requestSummaryGuidance）

const isLoadingHistory = ref(false);
const historyLoadResult = ref('');
const selectedSummaryRange = ref('');
const selectedSummaryResult = ref('');
const manualHideRange = ref('');
const hiddenFloorActionResult = ref('');
const hiddenFloorRefreshKey = ref(0);

// 状态计算
const currentFloor = computed(() => {
  try { return getLastMessageId(); } catch { return 0; }
});

const pendingCount = computed(() => {
  // 与 shouldTriggerSummary 对齐：排除 preserveRecentFloors
  const newContents = getContentsSinceLast(store.capturedContents, store.lastSummaryAtMessageId, store.settings.preserveRecentFloors);
  return newContents.length;
});

const summarizableCount = computed(() => pendingCount.value);

const nextSummaryIn = computed(() =>
  Math.max(0, store.settings.summaryInterval - pendingCount.value),
);

const activeCharacters = computed(() => store.getAllCharacterNames());

const dreamtalkStatus = computed(() => {
  if (!store.dreamtalk) return '未分析';
  return `v${store.dreamtalk.version} (${store.dreamtalk.characterInteractions.length} 角色)`;
});

const summaryCount = computed(() => store.summaries.length);
const summaryBusy = computed(() => store.summaryInProgress);

const hiddenFloors = computed(() => {
  void hiddenFloorRefreshKey.value;
  return store.getHiddenFloors();
});

const manualHideCount = computed(() => getParsedFloorIds(manualHideRange.value).length);
const selectedSummaryCount = computed(() => getSelectedCapturedContents().length);

// 大总结编辑 → 已迁移到时光轴
const latestSummary = computed(() => store.getLatestSummary());

function refreshHiddenFloors() {
  hiddenFloorRefreshKey.value++;
}

function getParsedFloorIds(input: string): number[] {
  try {
    return parseFloorRange(input);
  } catch {
    return [];
  }
}

function getSelectedCapturedContents(input = selectedSummaryRange.value) {
  const selectedIds = new Set(getParsedFloorIds(input));
  return store.capturedContents
    .filter(content => selectedIds.has(content.messageId))
    .slice()
    .sort((a, b) => a.messageId - b.messageId);
}

function getRoleLabel(role: string): string {
  if (role === 'assistant') return 'AI';
  if (role === 'user') return '用户';
  if (role === 'system') return '系统';
  return role;
}

async function runGrandSummaryAndHide(
  contents: CapturedContent[],
  logPrefix: string,
  userGuidance?: string,
) {
  const previousSummary = store.getLatestSummary();
  const existingMemories = previousSummary?.characterMemories || [];

  // V2: 步骤1 — 白描事实时间线
  const v2Result = await executeGrandSummaryV2(
    store.chatData.smallSummaries || [],
    contents,
    previousSummary?.rawText,
    store.getUserName(),
  );

  // V2: 步骤2 — 角色记忆+NSFW（调色盘分析）
  const memResult = await executeCharacterMemoryUpdate(
    contents,
    existingMemories,
    store.settings.memoryMinPerChar,
    store.settings.memoryMaxPerChar,
    store.getUserName(),
  );

  // === 组装 GrandSummary ===
  const summarizedMessageIds = getCapturedContentMessageIds(contents);
  const summarizedUpTo = Math.max(
    store.lastSummaryAtMessageId,
    summarizedMessageIds[summarizedMessageIds.length - 1] ?? store.lastSummaryAtMessageId,
  );
  const summaryVersion = (previousSummary?.version || 0) + 1;

  // V2 事件 → TimelineEvent[]（summary=速览用于召回，detail=完整经过用于注入）
  const timeline: TimelineEvent[] = v2Result.events.map(e => ({
    time: e.time,
    event: e.summary || e.event.slice(0, 50),
    detail: e.event,
    importance: e.importance,
    triggers: {
      characters: e.presentCharacters,
      keywords: e.keywords,
    },
  }));

  // 事件编号
  let eventNum = 0;
  const s1Lines: string[] = [];
  for (const e of timeline) {
    eventNum++;
    s1Lines.push(`[#${eventNum}] [${e.time}] ${e.event}`);
    s1Lines.push(`重要性: ${e.importance || 3}`);
    if (e.detail) s1Lines.push(e.detail);
    if (e.triggers?.characters?.length) s1Lines.push(`[角色: ${e.triggers.characters.join(', ')}]`);
    if (e.triggers?.keywords?.length) s1Lines.push(`[关键词: ${e.triggers.keywords.join(', ')}]`);
    s1Lines.push('');
  }

  // Section 2: 角色记忆
  const section2 = buildMemorySectionText(memResult.characterMemories);

  // Section 3: NSFW
  let section3 = '[NSFW记录]\n无NSFW内容';
  if (memResult.nsfwMemories.length > 0) {
    const nsfwParts: string[] = [];
    for (const n of memResult.nsfwMemories) {
      nsfwParts.push(`### ${n.characterName}`);
      nsfwParts.push(`敏感点: ${n.sensitivePoints.join(', ')}`);
      nsfwParts.push(`偏好: ${n.preferences.join(', ')}`);
      nsfwParts.push(`行为模式: ${n.behaviors.join(', ')}`);
      nsfwParts.push('记忆:');
      for (const m of n.memories) nsfwParts.push(`- ${m}`);
    }
    section3 = nsfwParts.join('\n');
  }

  const rawText = [
    s1Lines.join('\n').trim() || '[剧情摘要]',
    '---SECTION---',
    section2.trim() || '[角色记忆]',
    '---SECTION---',
    section3,
  ].join('\n');

  const summary: GrandSummary = {
    version: summaryVersion,
    generatedAt: new Date().toISOString(),
    characterMemories: memResult.characterMemories,
    timeline,
    characterTable: memResult.characterMemories.map(m => ({
      name: m.characterName,
      aliases: m.keywords.slice(0, 3),
      identity: '',
      relationship: m.attitude === 'like' ? '好感' : m.attitude === 'dislike' ? '厌恶' : '中立',
      status: '活跃',
    })),
    rawText,
  };

  const nsfwMemories = memResult.nsfwMemories;

  store.addSummary(summary, summarizedUpTo, summarizedMessageIds);

  // ★ 物品归档：从大总结V2事件中提取物品到物品记忆库
  const archivedItems = archiveItemsFromEvents(
    v2Result.events,
    store.chatData.itemMemories || [],
    summaryVersion,
  );
  store.chatData.itemMemories = archivedItems;
  if (archivedItems.length > 0) {
    console.info(`[智脑-物品] 物品库已更新: ${archivedItems.length} 件`);
  }

  // 存储 NSFW 记忆
  if (nsfwMemories.length > 0) {
    store.updateNsfwMemories(nsfwMemories);
    store.forcePersist();
    console.info(`[智脑] NSFW记忆已更新 (${nsfwMemories.length} 角色)`);
  }

  // === 后台生成向量（不阻塞主流程） ===
  if (store.settings.embeddingEnabled && store.settings.embeddingApiKey) {
    // 时间线事件向量
    if (summary.timeline.length > 0) {
      embedTimelineEvents(
        summary.timeline,
        store.settings.embeddingApiUrl,
        store.settings.embeddingApiKey,
        store.settings.embeddingModel,
        store.settings.embeddingDimensions,
      ).then(() => store.forcePersist()).catch(() => {});
    }

    // 核心记忆向量
    const totalCores = memResult.characterMemories.reduce(
      (s, m) => s + (m.coreMemories?.length || 0),
      0,
    );
    if (totalCores > 0) {
      embedCharacterMemories(
        memResult.characterMemories,
        store.settings.embeddingApiUrl,
        store.settings.embeddingApiKey,
        store.settings.embeddingModel,
        store.settings.embeddingDimensions,
      ).then(() => store.forcePersist()).catch(() => {});
    }

    // 物品向量
    const activeItems = store.chatData.itemMemories.filter(
      (i: any) => i.status === 'active' && (!i.embedding || i.embedding.length === 0),
    );
    if (activeItems.length > 0) {
      embedItems(store.chatData.itemMemories, {
        enabled: true,
        apiUrl: store.settings.embeddingApiUrl,
        apiKey: store.settings.embeddingApiKey,
        model: store.settings.embeddingModel,
        dimensions: store.settings.embeddingDimensions,
        similarityThreshold: store.settings.embeddingSimilarityThreshold,
      }).then(() => store.forcePersist()).catch(() => {});
    }
  }

  const hiddenIds = await hideSummaryFloors(summarizedUpTo, 0, 'affected');
  refreshHiddenFloors();
  // ★ 立刻同步小总结状态（隐藏的 → hidden-active），不等下次发消息
  syncSmallSummaryStatus(store.chatData.smallSummaries, new Set(hiddenIds));
  console.info(`[智脑] ${logPrefix}大总结 v${summary.version} 完成，已隐藏 ${hiddenIds.length} 个已总结楼层`);
  return { summary, hiddenIds };
}

// 手动触发大总结（排除最新 N 条不总结的 AI 回复）
function triggerManualSummary() {
  const pending = getContentsSinceLast(store.capturedContents, store.lastSummaryAtMessageId, store.settings.preserveRecentFloors);
  if (pending.length === 0) {
    console.info('[智脑] 排除最新楼层后没有待总结的正文日志');
    return;
  }

  enqueueAnalysis('summary_chain', async () => {
    store.setSummaryInProgress(true);
    console.info('[智脑] 手动触发大总结...');

    try {
      // 大总结引导弹窗（容错：弹窗异常时跳过，直接执行总结）
      let guidance = '';
      try {
        guidance = await store.requestSummaryGuidance(pending.length);
      } catch (e) {
        console.warn('[智脑] 引导弹窗异常，跳过', e);
      }
      if (guidance === null) {
        console.info('[智脑] 用户取消大总结');
        return;
      }

      const { summary } = await runGrandSummaryAndHide(pending, '手动', guidance ?? '');
      console.info(`[智脑] 大总结 v${summary.version} 完成 (${summary.characterMemories.length} 角色)`);
    } catch (error: any) {
      console.error('[智脑] 大总结失败:', error);
      clearSchedulerQueue();
      const version = (latestSummary.value?.version ?? 0) + 1;
      const summarizedMessageIds = getCapturedContentMessageIds(pending);
      const failedSummary: GrandSummary = {
        version,
        generatedAt: new Date().toISOString(),
        upToMessageId: summarizedMessageIds[summarizedMessageIds.length - 1],
        coveredMessageIds: summarizedMessageIds,
        characterMemories: [],
        timeline: [],
        characterTable: [],
        rawText: '总结失败，请重新总结',
      };
      store.addSummary(failedSummary, failedSummary.upToMessageId, summarizedMessageIds);
      const msg = error?.message || String(error);
      try { window.toastr?.error(msg, '❌ 大总结失败：请重新总结', { timeOut: 8000, extendedTimeOut: 3000 }); } catch(_) {}
    } finally {
      store.setSummaryInProgress(false);
    }
  });
}

function triggerRedoSummary() {
  if (!latestSummary.value || summaryBusy.value) return;

  enqueueAnalysis('summary_chain', async () => {
    // 保存旧总结的 upToMessageId，失败时用于恢复
    const oldUpToMessageId = store.lastSummaryAtMessageId;

    // 引导弹窗（预填上次提交的指引内容）
    const guidance = await store.requestSummaryGuidance(
      latestSummary.value!.coveredMessageIds?.length ?? 0,
      store.lastSubmittedGuidance || undefined,
    );
    if (guidance === null) {
      console.info('[智脑] 用户取消重新总结');
      return;
    }

    store.setSummaryInProgress(true);
    console.info('[智脑] 正在回退并重新生成最新大总结...');

    let removedSummary: ReturnType<typeof store.rollbackSummary> = undefined;

    try {
      removedSummary = store.rollbackSummary(true, false);
      if (!removedSummary) return;

      const coveredIds = new Set(removedSummary.coveredMessageIds ?? []);
      const contents = coveredIds.size > 0
        ? store.capturedContents.filter(content => coveredIds.has(content.messageId)).sort((a, b) => a.messageId - b.messageId)
        : getContentsSinceLast(store.capturedContents, store.lastSummaryAtMessageId, store.settings.preserveRecentFloors);

      if (contents.length === 0) {
        console.info('[智脑] 回退后没有可重新总结的正文日志，恢复旧总结');
        store.chatData.summaries.push(removedSummary);
        store.chatData.lastSummaryAtMessageId = oldUpToMessageId;
        return;
      }

      // 清理被回退版本的物品历史，防止重复
      store.chatData.itemMemories = removeItemHistoryByVersion(
        store.chatData.itemMemories || [],
        removedSummary.version,
      );

      const { summary } = await runGrandSummaryAndHide(contents, '重新', guidance || undefined);

      // 清除基于旧 V4 产生的后续总结（version > 被替换版本的全部失效）
      store.chatData.summaryHistory = store.chatData.summaryHistory.filter(
        s => s.version < removedSummary.version,
      );

      console.info(`[智脑] 已重新生成大总结 v${summary.version}`);
    } catch (error: any) {
      console.error('[智脑] 重新总结失败:', error);
      clearSchedulerQueue();
      if (removedSummary) {
        store.chatData.summaries.push(removedSummary);
        store.chatData.lastSummaryAtMessageId = oldUpToMessageId;
        console.info('[智脑] 已恢复旧版大总结');
      }
      const msg = error?.message || String(error);
      try { window.toastr?.error(msg, '❌ 重新总结失败：请重新总结', { timeOut: 8000, extendedTimeOut: 3000 }); } catch(_) {}
    } finally {
      store.setSummaryInProgress(false);
    }
  });
}

function triggerSelectedSummary() {
  const selectedContents = getSelectedCapturedContents();
  if (selectedContents.length === 0) {
    selectedSummaryResult.value = '没有匹配到已捕获正文的 AI 楼层';
    console.info('[智脑] 选定楼层总结未匹配到正文日志');
    return;
  }

  enqueueAnalysis('summary_chain', async () => {
    store.setSummaryInProgress(true);
    selectedSummaryResult.value = '';
    console.info(`[智脑] 选定楼层总结：${selectedContents.map(content => `#${content.messageId}`).join(', ')}`);

    try {
      let guidance = '';
      try {
        guidance = await store.requestSummaryGuidance(selectedContents.length);
      } catch (e) {
        console.warn('[智脑] 引导弹窗异常，跳过', e);
      }
      if (guidance === null) {
        console.info('[智脑] 用户取消大总结');
        return;
      }

      const { summary, hiddenIds } = await runGrandSummaryAndHide(selectedContents, '选定楼层', guidance ?? '');
      selectedSummaryResult.value = `已生成 v${summary.version}，隐藏 ${hiddenIds.length} 个楼层`;
    } catch (error: any) {
      selectedSummaryResult.value = '选定楼层总结失败：请重新总结';
      console.error('[智脑] 选定楼层总结失败:', error);
      clearSchedulerQueue();
      const version = (latestSummary.value?.version ?? 0) + 1;
      const summarizedMessageIds = getCapturedContentMessageIds(selectedContents);
      const failedSummary: GrandSummary = {
        version,
        generatedAt: new Date().toISOString(),
        upToMessageId: summarizedMessageIds[summarizedMessageIds.length - 1],
        coveredMessageIds: summarizedMessageIds,
        characterMemories: [],
        timeline: [],
        characterTable: [],
        rawText: '总结失败，请重新总结',
      };
      store.addSummary(failedSummary, failedSummary.upToMessageId, summarizedMessageIds);
      const msg = error?.message || String(error);
      try { window.toastr?.error(msg, '❌ 选定楼层总结失败：请重新总结', { timeOut: 8000, extendedTimeOut: 3000 }); } catch(_) {}
    } finally {
      store.setSummaryInProgress(false);
    }
  });
}

async function triggerManualHideFloors() {
  const ids = getParsedFloorIds(manualHideRange.value);
  if (ids.length === 0) {
    hiddenFloorActionResult.value = '请输入有效楼层号或范围';
    return;
  }

  try {
    const hiddenIds = await setFloorsHidden(ids, true, 'affected');
    hiddenFloorActionResult.value = `已隐藏 ${hiddenIds.length} 个楼层`;
    refreshHiddenFloors();
  } catch (error) {
    hiddenFloorActionResult.value = '隐藏失败';
    console.error('[智脑] 手动隐藏楼层失败:', error);
  }
}

async function unhideFloor(messageId: number) {
  try {
    await setFloorsHidden([messageId], false, 'affected');
    hiddenFloorActionResult.value = `已取消隐藏 #${messageId}`;
    refreshHiddenFloors();
  } catch (error) {
    hiddenFloorActionResult.value = `取消隐藏 #${messageId} 失败`;
    console.error('[智脑] 取消隐藏楼层失败:', error);
  }
}

// 读取历史楼层
async function triggerLoadHistory() {
  isLoadingHistory.value = true;
  historyLoadResult.value = '';
  try {
    const count = await store.loadHistoryFloors();
    historyLoadResult.value = `补录 ${count} 条`;
    console.info(`[智脑] 历史楼层读取完成，补录 ${count} 条`);
  } catch (error) {
    historyLoadResult.value = '读取失败';
    console.error('[智脑] 读取历史楼层失败:', error);
  } finally {
    isLoadingHistory.value = false;
  }
}

// 手动触发梦呓分析
async function triggerManualDreamtalk() {
  if (store.userInputRecords.length === 0) {
    console.info('[智脑] 没有可用的用户输入记录');
    return;
  }

  store.setDreamtalkInProgress(true);
  console.info('[智脑] 手动触发梦呓分析...');

  try {
    const { dreamtalk: result, nsfwDreamtalk } = await executeDreamtalkAnalysis(store.userInputRecords, store.persona.rawInput, store.dreamtalk, undefined, store.getUserName());
    store.updateDreamtalk(result);
    if (nsfwDreamtalk) {
      store.updateNsfwDreamtalk(nsfwDreamtalk);
    }
    console.info(`[智脑] 梦呓分析完成 (${result.characterInteractions.length} 角色交互模式)`);
  } catch (error: any) {
    console.error('[智脑] 梦呓分析失败:', error);
    const msg = error?.message || String(error);
    try { window.toastr?.error(msg, '❌ 梦呓分析失败', { timeOut: 8000, extendedTimeOut: 3000 }); } catch(_) {}
  } finally {
    store.setDreamtalkInProgress(false);
  }
}
// 后台队列状态（响应式轮询）
const queueState = ref(getQueueState());
let queueTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  queueTimer = setInterval(() => {
    queueState.value = getQueueState();
  }, 1000);
});

onUnmounted(() => {
  if (queueTimer) clearInterval(queueTimer);
});

const queueDisplayName = computed(() => {
  const current = queueState.value.current;
  if (!current) {
    if (queueState.value.isGenerating) return '正文生成中（队列暂停）';
    if (queueState.value.isPaused) return '已暂停';
    return '空闲';
  }
  return current.label + '...';
});

// 兼容旧模板引用
const schedulerStatus = computed(() => ({
  isProcessing: queueState.value.isProcessing,
  queueLength: queueState.value.queued.length,
  queueNames: queueState.value.queued.map((t: any) => t.label),
}));
</script>

<template>
  <div class="zhino-overview">
    <!-- 调度队列状态 -->
    <div class="zhino-section zhino-scheduler-section">
      <div class="zhino-section-title">调度队列</div>
      <div class="zhino-scheduler-status">
        <div class="zhino-scheduler-current">
          <span class="zhino-scheduler-dot" :class="{ active: schedulerStatus.isProcessing }"></span>
          <span class="zhino-scheduler-text">{{ queueDisplayName }}</span>
        </div>
        <div v-if="schedulerStatus.queueLength > 0" class="zhino-scheduler-queue">
          等待中：{{ schedulerStatus.queueLength }} 个任务
          <span class="zhino-scheduler-names">({{ schedulerStatus.queueNames.join(', ') }})</span>
        </div>
      </div>
    </div>

    <!-- 后台推演状态 -->
    <div v-if="store.settings.ecosystemEnabled" class="zhino-section">
      <div class="zhino-section-title">后台推演</div>
      <div v-if="!store.ecosystemState" class="zhino-empty-hint">尚未执行过推演</div>
      <template v-else>
        <div class="zhino-info-row">
          <span class="zhino-info-label">上次推演：</span>
          <span class="zhino-info-value">{{ store.ecosystemState.lastAnalyzedAt?.slice(0, 16) || '未知' }}</span>
        </div>
        <div class="zhino-info-row">
          <span class="zhino-info-label">逻辑树数量：</span>
          <span class="zhino-info-value">{{ store.ecosystemState.behaviorTrees?.length || 0 }}</span>
        </div>
        <div v-if="store.ecosystemState.actors && store.ecosystemState.actors.length > 0" class="zhino-ecosystem-actors">
          <div class="zhino-detail-label">角色活动概览：</div>
          <div
            v-for="actor in store.ecosystemState.actors"
            :key="actor.characterName"
            class="zhino-ecosystem-actor-item"
          >
            <span class="zhino-ecosystem-actor-name">{{ actor.characterName }}</span>
            <span class="zhino-ecosystem-actor-loc">@ {{ actor.location }}</span>
            <span class="zhino-ecosystem-actor-act">{{ actor.activity }}</span>
          </div>
        </div>
      </template>
    </div>

    <!-- 状态仪表盘 -->
    <div class="zhino-stats-grid">
      <div class="zhino-stat-card">
        <div class="zhino-stat-value">{{ currentFloor }}</div>
        <div class="zhino-stat-label">当前楼层</div>
      </div>
      <div class="zhino-stat-card">
        <div class="zhino-stat-value">{{ nextSummaryIn }}</div>
        <div class="zhino-stat-label">距下次总结</div>
      </div>
      <div class="zhino-stat-card">
        <div class="zhino-stat-value">{{ summaryCount }}</div>
        <div class="zhino-stat-label">总结次数</div>
      </div>
      <div class="zhino-stat-card">
        <div class="zhino-stat-value">{{ store.capturedContents.length }}</div>
        <div class="zhino-stat-label">捕获记录</div>
      </div>
      <div class="zhino-stat-card">
        <div class="zhino-stat-value">{{ store.chatData.worldProgressRecords?.length || 0 }}</div>
        <div class="zhino-stat-label">世界推进</div>
      </div>
      <div class="zhino-stat-card">
        <div class="zhino-stat-value">{{ store.chatData.plotOutline?.status === 'active' ? '活跃' : store.chatData.plotOutline?.status || '无' }}</div>
        <div class="zhino-stat-label">剧情导演</div>
      </div>
      <div class="zhino-stat-card">
        <div class="zhino-stat-value">{{ store.chatData.dynamicProfilesV2?.length || 0 }}</div>
        <div class="zhino-stat-label">人设V2</div>
      </div>
      <div class="zhino-stat-card">
        <div class="zhino-stat-value">{{ store.chatData.itemMemories?.length || 0 }}</div>
        <div class="zhino-stat-label">物品库</div>
      </div>
    </div>

    <!-- 已激活角色 -->
    <div class="zhino-section">
      <div class="zhino-section-title">已激活角色</div>
      <div v-if="activeCharacters.length === 0" class="zhino-empty-hint">暂无（完成首次大总结后显示）</div>
      <div v-else class="zhino-tag-list">
        <span v-for="name in activeCharacters" :key="name" class="zhino-tag">{{ name }}</span>
      </div>
    </div>

    <!-- 梦呓状态 -->
    <div class="zhino-section">
      <div class="zhino-section-title">梦呓状态</div>
      <div class="zhino-info-row">
        <span class="zhino-info-label">分析状态：</span>
        <span class="zhino-info-value">{{ dreamtalkStatus }}</span>
      </div>
      <div v-if="store.dreamtalk" class="zhino-info-row">
        <span class="zhino-info-label">游玩类型：</span>
        <span class="zhino-info-value">{{ store.dreamtalk.playStyle }}</span>
      </div>
    </div>

    <!-- 大总结状态 -->
    <div v-if="latestSummary" class="zhino-section">
      <div class="zhino-section-header">
        <div class="zhino-section-title">大总结 v{{ latestSummary.version }}{{ store.getCoveredFloorsDisplay() }}</div>
        <div class="zhino-section-actions">
          <button
            class="zhino-btn-sm"
            style="color:#ff6b6b;border:1px solid rgba(255,100,100,0.3)"
            @click="store.rollbackSummary()"
          >撤回</button>
          <button
            class="zhino-btn-sm"
            style="color:#4caf50;border:1px solid rgba(76,175,80,0.3)"
            @click="store.restoreLastSummary()"
          >恢复</button>
          <button
            class="zhino-btn-sm zhino-btn-warn"
            :disabled="summaryBusy"
            @click="triggerRedoSummary"
          >
            {{ summaryBusy ? '重做中...' : '重新总结' }}
          </button>
        </div>
      </div>
      <div class="zhino-info-row">
        <span class="zhino-info-label">生成时间:</span>
        <span class="zhino-info-value">{{ latestSummary.generatedAt?.slice(0, 16) }}</span>
      </div>
      <div class="zhino-info-row">
        <span class="zhino-info-label">角色数:</span>
        <span class="zhino-info-value">{{ latestSummary.characterMemories?.length || 0 }}</span>
        <span class="zhino-info-label" style="margin-left:12px">事件数:</span>
        <span class="zhino-info-value">{{ latestSummary.timeline?.length || 0 }}</span>
      </div>
    </div>

    <!-- 手动触发按钮 -->
    <div class="zhino-section">
      <div class="zhino-section-title">手动触发</div>
      <div class="zhino-btn-row">
        <button
          class="zhino-btn"
          :disabled="summaryBusy || summarizableCount === 0"
          @click="triggerManualSummary"
        >
          {{ summaryBusy ? '总结中...' : `大总结 (${summarizableCount} 条可总结)` }}
        </button>
        <button
          class="zhino-btn"
          :disabled="store.dreamtalkInProgress || store.userInputRecords.length === 0"
          @click="triggerManualDreamtalk"
        >
          {{ store.dreamtalkInProgress ? '分析中...' : '梦呓分析' }}
        </button>
        <button
          class="zhino-btn"
          :disabled="isLoadingHistory"
          @click="triggerLoadHistory"
        >
          {{ isLoadingHistory ? '读取中...' : '读取历史楼层' }}
        </button>
      </div>
      <div v-if="historyLoadResult" class="zhino-load-result">{{ historyLoadResult }}</div>

      <div class="zhino-sub-control">
        <div class="zhino-sub-title">选定楼层总结</div>
        <div class="zhino-input-row">
          <input
            v-model="selectedSummaryRange"
            class="zhino-input"
            placeholder="如 2-16 或 1,3,5,7-10"
          >
          <button
            class="zhino-btn"
            :disabled="summaryBusy || selectedSummaryCount === 0"
            @click="triggerSelectedSummary"
          >
            {{ summaryBusy ? '总结中...' : `总结 (${selectedSummaryCount})` }}
          </button>
        </div>
        <div v-if="selectedSummaryResult" class="zhino-load-result">{{ selectedSummaryResult }}</div>
      </div>
    </div>

    <details class="zhino-section zhino-hidden-section">
      <summary class="zhino-hidden-summary">
        <span>已隐藏楼层</span>
        <span class="zhino-hidden-count">{{ hiddenFloors.length }}</span>
      </summary>

      <div class="zhino-sub-control zhino-sub-control-compact">
        <div class="zhino-input-row">
          <input
            v-model="manualHideRange"
            class="zhino-input"
            placeholder="输入楼层号或范围"
          >
          <button
            class="zhino-btn"
            :disabled="manualHideCount === 0"
            @click="triggerManualHideFloors"
          >
            隐藏 ({{ manualHideCount }})
          </button>
        </div>
        <div v-if="hiddenFloorActionResult" class="zhino-load-result">{{ hiddenFloorActionResult }}</div>
      </div>

      <div v-if="hiddenFloors.length === 0" class="zhino-empty-hint">暂无隐藏楼层</div>
      <div v-else class="zhino-hidden-list">
        <div
          v-for="floor in hiddenFloors"
          :key="floor.messageId"
          class="zhino-hidden-item"
        >
          <div class="zhino-hidden-main">
            <span class="zhino-hidden-id">#{{ floor.messageId }}</span>
            <span class="zhino-hidden-role">{{ getRoleLabel(floor.role) }}</span>
            <span class="zhino-hidden-text">{{ floor.summary }}</span>
          </div>
          <button class="zhino-btn-sm" @click="unhideFloor(floor.messageId)">取消隐藏</button>
        </div>
      </div>
    </details>
  </div>
</template>

<style scoped>
.zhino-overview {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.zhino-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
.zhino-stat-card {
  background: rgba(167, 139, 250, 0.06);
  border: 1px solid rgba(167, 139, 250, 0.12);
  border-radius: 8px;
  padding: 8px 6px;
  text-align: center;
}
.zhino-stat-value {
  font-size: 16px;
  font-weight: 700;
  color: rgba(167, 139, 250, 0.9);
}
.zhino-stat-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 2px;
}

.zhino-section {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 10px 12px;
}
.zhino-section-title {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 8px;
}

.zhino-empty-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);
}

.zhino-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.zhino-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(167, 139, 250, 0.12);
  color: rgba(167, 139, 250, 0.8);
  border: 1px solid rgba(167, 139, 250, 0.2);
}

.zhino-info-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  margin-bottom: 4px;
}
.zhino-info-label {
  color: rgba(255, 255, 255, 0.4);
}
.zhino-info-value {
  color: rgba(255, 255, 255, 0.8);
}

.zhino-btn-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.zhino-btn {
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 6px;
  border: 1px solid rgba(167, 139, 250, 0.25);
  background: rgba(167, 139, 250, 0.08);
  color: rgba(167, 139, 250, 0.9);
  cursor: pointer;
  transition: all 0.15s;
}
.zhino-btn:hover:not(:disabled) {
  background: rgba(167, 139, 250, 0.18);
  border-color: rgba(167, 139, 250, 0.4);
}
.zhino-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.zhino-load-result {
  margin-top: 6px;
  font-size: 11px;
  color: rgba(167, 139, 250, 0.7);
}

.zhino-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  gap: 8px;
}

.zhino-section-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.zhino-btn-sm {
  padding: 4px 10px;
  font-size: 11px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.15s;
}
.zhino-btn-sm:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.9);
}
.zhino-btn-sm:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.zhino-btn-save {
  border-color: rgba(167, 139, 250, 0.3);
  color: rgba(167, 139, 250, 0.9);
}
.zhino-btn-save:hover {
  background: rgba(167, 139, 250, 0.15);
}
.zhino-btn-warn {
  border-color: rgba(245, 158, 11, 0.28);
  color: rgba(251, 191, 36, 0.9);
}
.zhino-btn-warn:hover:not(:disabled) {
  background: rgba(245, 158, 11, 0.12);
}

.zhino-sub-control {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
.zhino-sub-control-compact {
  margin-top: 8px;
  padding-top: 0;
  border-top: 0;
}
.zhino-sub-title {
  margin-bottom: 6px;
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.45);
}
.zhino-input-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.zhino-input {
  min-width: 0;
  flex: 1;
  height: 30px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.25);
  color: rgba(255, 255, 255, 0.86);
  outline: none;
  padding: 0 9px;
  font-size: 12px;
}
.zhino-input:focus {
  border-color: rgba(167, 139, 250, 0.4);
}
.zhino-input::placeholder {
  color: rgba(255, 255, 255, 0.28);
}

.zhino-hidden-section {
  padding-top: 0;
}
.zhino-hidden-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 10px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.62);
  list-style: none;
}
.zhino-hidden-summary::-webkit-details-marker {
  display: none;
}
.zhino-hidden-count {
  min-width: 24px;
  border-radius: 999px;
  background: rgba(167, 139, 250, 0.12);
  color: rgba(167, 139, 250, 0.9);
  text-align: center;
  font-size: 11px;
  line-height: 20px;
}
.zhino-hidden-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}
.zhino-hidden-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}
.zhino-hidden-main {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
}
.zhino-hidden-id {
  flex: 0 0 auto;
  color: rgba(167, 139, 250, 0.9);
  font-weight: 600;
}
.zhino-hidden-role {
  flex: 0 0 auto;
  color: rgba(255, 255, 255, 0.42);
}
.zhino-hidden-text {
  min-width: 0;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.72);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.zhino-textarea {
  width: 100%;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  resize: vertical;
  outline: none;
  font-family: monospace;
  margin-top: 6px;
  margin-bottom: 6px;
}
.zhino-textarea:focus {
  border-color: rgba(167, 139, 250, 0.4);
}
.zhino-textarea-lg {
  min-height: 200px;
}

/* 调度队列 */
.zhino-scheduler-section {
  border-color: rgba(167, 139, 250, 0.15);
}
.zhino-scheduler-status {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.zhino-scheduler-current {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.75);
}
.zhino-scheduler-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  flex-shrink: 0;
}
.zhino-scheduler-dot.active {
  background: rgba(74, 222, 128, 0.8);
  box-shadow: 0 0 6px rgba(74, 222, 128, 0.4);
  animation: pulse-dot 1.2s infinite;
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.zhino-scheduler-text {
  font-weight: 500;
}
.zhino-scheduler-queue {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  padding-left: 14px;
}
.zhino-scheduler-names {
  color: rgba(167, 139, 250, 0.6);
}

/* 后台推演 */
.zhino-detail-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 4px;
  margin-top: 6px;
}
.zhino-ecosystem-actors {
  margin-top: 6px;
}
.zhino-ecosystem-actor-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 11px;
  padding: 4px 6px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
  margin-bottom: 3px;
  border-left: 2px solid rgba(167, 139, 250, 0.25);
}
.zhino-ecosystem-actor-name {
  color: rgba(167, 139, 250, 0.85);
  font-weight: 500;
  flex-shrink: 0;
  line-height: 1.5;
}
.zhino-ecosystem-actor-loc {
  color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
  line-height: 1.5;
}
.zhino-ecosystem-actor-act {
  color: rgba(255, 255, 255, 0.65);
  line-height: 1.5;
  word-break: break-word;
  min-width: 0;
}
.zhino-ecosystem-raw {
  margin-top: 8px;
}
.zhino-ecosystem-raw-text {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  padding: 8px 10px;
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.55);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 300px;
  overflow-y: auto;
}
</style>
