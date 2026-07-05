<script setup lang="ts">
import { useMainStore } from '../stores/mainStore';
import {
  CANGXUAN_DEFAULT_ALWAYS_NAMES,
  CANGXUAN_DEFAULT_SCHEDULED_NAMES,
  applyCangxuanWorldbookEnablePlan,
  buildCangxuanSchedulerConfig,
  restoreCangxuanWorldbookEnableBackup,
  scanCangxuanWorldbooks,
  type CangxuanWorldbookEntryRef,
  type CangxuanWorldbookScan,
} from '../core/cangxuanWorldbookScheduler';
import { readLatestCangxuanMvuSnapshot } from '../core/cangxuanMvuBridge';

const store = useMainStore();

const scanning = ref(false);
const applying = ref(false);
const restoring = ref(false);
const checkingMvu = ref(false);
const search = ref('');
const statusText = ref('');
const mvuSummary = ref('');

const scan = computed(() => store.chatData.cangxuanWorldbookScan as CangxuanWorldbookScan | null);
const lastInjection = computed(() => store.chatData.cangxuanWorldbookLastInjection);
const backups = computed(() => store.chatData.cangxuanWorldbookEnableBackups || []);
const latestBackup = computed(() => backups.value[backups.value.length - 1] || null);

const schedulerEnabled = computed({
  get: () => store.settings.cangxuanWorldbookSchedulerEnabled,
  set: value => store.updateSettings({ cangxuanWorldbookSchedulerEnabled: value }),
});
const autoInjectEnabled = computed({
  get: () => store.settings.cangxuanWorldbookAutoInjectEnabled,
  set: value => store.updateSettings({ cangxuanWorldbookAutoInjectEnabled: value }),
});
const keepEnabledNames = computed({
  get: () => store.settings.cangxuanWorldbookKeepEnabledNames,
  set: value => store.updateSettings({ cangxuanWorldbookKeepEnabledNames: value }),
});
const maxEntries = computed({
  get: () => store.settings.cangxuanWorldbookMaxEntries,
  set: value => store.updateSettings({ cangxuanWorldbookMaxEntries: Number(value) }),
});
const maxChars = computed({
  get: () => store.settings.cangxuanWorldbookMaxChars,
  set: value => store.updateSettings({ cangxuanWorldbookMaxChars: Number(value) }),
});
const effectiveConfig = computed(() => buildCangxuanSchedulerConfig(store.settings));
const alwaysPreview = computed(() => effectiveConfig.value.alwaysNames.join('\n'));
const scheduledPreview = computed(() => effectiveConfig.value.scheduledNames.join('\n'));

const filteredEntries = computed(() => {
  const q = search.value.trim().toLowerCase();
  const entries = scan.value?.entries || [];
  if (!q) return entries.slice(0, 180);
  return entries
    .filter(entry =>
      entry.name.toLowerCase().includes(q)
      || entry.worldbookName.toLowerCase().includes(q)
      || entry.displayName.toLowerCase().includes(q)
      || entry.keys.join(' ').toLowerCase().includes(q)
      || entry.content.toLowerCase().includes(q),
    )
    .slice(0, 180);
});

async function runScan() {
  scanning.value = true;
  statusText.value = '';
  try {
    const result = await scanCangxuanWorldbooks(buildCangxuanSchedulerConfig(store.settings));
    store.chatData.cangxuanWorldbookScan = result;
    store.forcePersist();
    statusText.value = `扫描完成：${result.counts.books} 本世界书，${result.counts.entries} 个条目。`;
  } catch (error) {
    statusText.value = `扫描失败：${(error as Error).message}`;
  } finally {
    scanning.value = false;
  }
}

async function refreshMvuSummary() {
  checkingMvu.value = true;
  try {
    const snapshot = await readLatestCangxuanMvuSnapshot();
    mvuSummary.value = snapshot.summaryText;
  } finally {
    checkingMvu.value = false;
  }
}

function resetSchedulerDefaults() {
  store.updateSettings({
    cangxuanWorldbookAlwaysNames: CANGXUAN_DEFAULT_ALWAYS_NAMES,
    cangxuanWorldbookScheduledNames: CANGXUAN_DEFAULT_SCHEDULED_NAMES,
    cangxuanWorldbookKeepEnabledNames: '',
  });
  statusText.value = '已重置为苍玄界推荐调度底座。';
  void runScan();
}

async function applyPlan() {
  const confirmFn = window.parent?.confirm || window.confirm;
  const ok = confirmFn(
    '将按“常驻/保留启用清单”保留世界书条目开启，其余条目关闭原生触发。条目不会删除，当前启用状态会先备份。是否继续？',
  );
  if (!ok) return;

  applying.value = true;
  statusText.value = '';
  try {
    const result = await applyCangxuanWorldbookEnablePlan(buildCangxuanSchedulerConfig(store.settings));
    store.chatData.cangxuanWorldbookEnableBackups.push(result.backup);
    store.forcePersist();
    statusText.value = `已应用启用计划：变更 ${result.changed.length} 个条目，备份 ${result.backup.id}`;
    await runScan();
  } catch (error) {
    statusText.value = `应用失败：${(error as Error).message}`;
  } finally {
    applying.value = false;
  }
}

async function restoreLatestBackup() {
  if (!latestBackup.value) return;
  const confirmFn = window.parent?.confirm || window.confirm;
  const ok = confirmFn(`恢复备份 ${latestBackup.value.id} 的世界书启用状态？`);
  if (!ok) return;

  restoring.value = true;
  statusText.value = '';
  try {
    const count = await restoreCangxuanWorldbookEnableBackup(latestBackup.value);
    statusText.value = `已恢复 ${count} 个条目的启用状态。`;
    await runScan();
  } catch (error) {
    statusText.value = `恢复失败：${(error as Error).message}`;
  } finally {
    restoring.value = false;
  }
}

function categoryLabel(category: CangxuanWorldbookEntryRef['category']): string {
  const map: Record<CangxuanWorldbookEntryRef['category'], string> = {
    always: '常驻',
    scheduled: '调度',
    suggested_always: '常驻候选',
    suggested_scheduled: '调度候选',
    unused_candidate: '关闭候选',
  };
  return map[category] || category;
}

onMounted(() => {
  void refreshMvuSummary();
});
</script>

<template>
  <div class="cangxuan-tab">
    <div class="cangxuan-toolbar">
      <label class="cangxuan-toggle">
        <input v-model="schedulerEnabled" type="checkbox" />
        <span>启用苍玄界世界书调度</span>
      </label>
      <label class="cangxuan-toggle">
        <input v-model="autoInjectEnabled" type="checkbox" />
        <span>生成前自动注入</span>
      </label>
      <button class="cangxuan-btn" :disabled="scanning" @click="runScan">
        {{ scanning ? '扫描中...' : '扫描世界书' }}
      </button>
      <button class="cangxuan-btn" :disabled="checkingMvu" @click="refreshMvuSummary">
        {{ checkingMvu ? '读取中...' : '读取 MVU' }}
      </button>
    </div>

    <div v-if="statusText" class="cangxuan-status">{{ statusText }}</div>

    <div class="cangxuan-grid">
      <section class="cangxuan-section">
        <div class="cangxuan-section-title">调度清单</div>
        <div class="cangxuan-plan-summary">
          <span>常驻底座 {{ effectiveConfig.alwaysNames.length }}</span>
          <span>脚本调度库 {{ effectiveConfig.scheduledNames.length }}</span>
          <span>额外保留 {{ effectiveConfig.keepEnabledNames.length }}</span>
        </div>
        <div class="cangxuan-field">
          <label>常驻底座</label>
          <textarea :value="alwaysPreview" rows="5" readonly />
        </div>
        <div class="cangxuan-field">
          <label>脚本调度库</label>
          <textarea :value="scheduledPreview" rows="5" readonly />
        </div>
        <div class="cangxuan-field">
          <label>额外保留启用</label>
          <textarea v-model="keepEnabledNames" rows="3" placeholder="特殊情况下必须保持原生开启的条目名。" />
        </div>
        <div class="cangxuan-limits">
          <label>最多条目 <input v-model.number="maxEntries" type="number" min="4" max="18" /></label>
          <label>最多字符 <input v-model.number="maxChars" type="number" min="3000" max="14000" step="500" /></label>
        </div>
        <div class="cangxuan-actions">
          <button class="cangxuan-btn" :disabled="scanning" @click="resetSchedulerDefaults">重置推荐底座</button>
          <button class="cangxuan-danger" :disabled="applying" @click="applyPlan">
            {{ applying ? '应用中...' : '应用轻量启用计划' }}
          </button>
          <button class="cangxuan-btn" :disabled="restoring || !latestBackup" @click="restoreLatestBackup">
            {{ restoring ? '恢复中...' : '恢复上次备份' }}
          </button>
        </div>
      </section>

      <section class="cangxuan-section">
        <div class="cangxuan-section-title">扫描概览</div>
        <div v-if="!scan" class="cangxuan-empty">尚未扫描。先点击“扫描世界书”。</div>
        <template v-else>
          <div class="cangxuan-stats">
            <span>世界书 {{ scan.counts.books }}</span>
            <span>条目 {{ scan.counts.entries }}</span>
            <span>已启用 {{ scan.counts.enabled }}</span>
            <span>重名 {{ scan.duplicates.length }}</span>
          </div>
          <div class="cangxuan-bindings">
            <div>角色主世界书：{{ scan.bindings.characterPrimary || '无' }}</div>
            <div>角色附加：{{ scan.bindings.characterAdditional.join('、') || '无' }}</div>
            <div>全局：{{ scan.bindings.global.join('、') || '无' }}</div>
            <div>聊天：{{ scan.bindings.chat || '无' }}</div>
          </div>
          <div v-if="scan.duplicates.length" class="cangxuan-warning">
            重名条目：{{ scan.duplicates.slice(0, 8).map(item => item.name).join('、') }}
          </div>
          <div v-if="scan.missingAlwaysNames.length || scan.missingScheduledNames.length" class="cangxuan-warning">
            缺失条目：{{ [...scan.missingAlwaysNames, ...scan.missingScheduledNames].slice(0, 24).join('、') }}
          </div>
        </template>

        <div class="cangxuan-section-title spaced">本轮注入</div>
        <div v-if="!lastInjection" class="cangxuan-empty">尚无注入记录。</div>
        <template v-else>
          <div class="cangxuan-stats">
            <span>{{ lastInjection.entryNames.length }} 条</span>
            <span>{{ lastInjection.estimatedTokens }} token估算</span>
          </div>
          <div class="cangxuan-injection-list">
            <span v-for="name in lastInjection.entryNames" :key="name">{{ name }}</span>
          </div>
          <div v-if="lastInjection.sceneSignals?.actionTypes?.length" class="cangxuan-bindings">
            行动线索：{{ lastInjection.sceneSignals.actionTypes.join('、') }}
          </div>
          <div v-if="lastInjection.warnings?.length" class="cangxuan-warning">
            {{ lastInjection.warnings.join('；') }}
          </div>
        </template>

        <div class="cangxuan-section-title spaced">MVU 摘要</div>
        <pre class="cangxuan-mvu">{{ mvuSummary || '尚未读取。' }}</pre>
      </section>
    </div>

    <section class="cangxuan-section cangxuan-full">
      <div class="cangxuan-section-title">世界书条目索引</div>
      <input v-model="search" class="cangxuan-search" placeholder="搜索条目名、世界书名、关键字或内容" />
      <div v-if="filteredEntries.length === 0" class="cangxuan-empty">没有匹配条目。</div>
      <div v-else class="cangxuan-entry-list">
        <div v-for="entry in filteredEntries" :key="entry.id" class="cangxuan-entry">
          <div class="cangxuan-entry-main">
            <span class="cangxuan-entry-name">{{ entry.name }}</span>
            <span class="cangxuan-entry-badge" :class="entry.category">{{ categoryLabel(entry.category) }}</span>
            <span class="cangxuan-entry-state" :class="{ on: entry.enabled }">{{ entry.enabled ? 'ON' : 'off' }}</span>
          </div>
          <div class="cangxuan-entry-meta">
            {{ entry.worldbookName }} #{{ entry.uid }} · {{ entry.strategyType }} · {{ entry.contentLength }}字
          </div>
          <div class="cangxuan-entry-reason">{{ entry.reasons.join('；') }}</div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.cangxuan-tab {
  height: 100%;
  padding: 10px 12px;
  overflow: auto;
  color: rgba(255, 255, 255, 0.84);
  font-size: 12px;
}
.cangxuan-toolbar,
.cangxuan-actions,
.cangxuan-limits,
.cangxuan-stats,
.cangxuan-injection-list,
.cangxuan-plan-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.cangxuan-toggle {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: rgba(255, 255, 255, 0.68);
}
.cangxuan-btn,
.cangxuan-danger {
  border: 1px solid rgba(125, 211, 252, 0.28);
  border-radius: 5px;
  background: rgba(14, 165, 233, 0.08);
  color: rgba(240, 249, 255, 0.9);
  padding: 5px 10px;
  cursor: pointer;
}
.cangxuan-danger {
  border-color: rgba(248, 113, 113, 0.35);
  background: rgba(248, 113, 113, 0.08);
}
button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.cangxuan-status,
.cangxuan-warning,
.cangxuan-empty {
  margin-top: 8px;
  padding: 8px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.58);
}
.cangxuan-warning {
  color: rgba(251, 191, 36, 0.88);
  border-color: rgba(251, 191, 36, 0.2);
}
.cangxuan-grid {
  display: grid;
  grid-template-columns: minmax(320px, 0.95fr) minmax(320px, 1.05fr);
  gap: 10px;
  margin-top: 10px;
}
.cangxuan-section {
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.16);
  padding: 10px;
}
.cangxuan-full {
  margin-top: 10px;
}
.cangxuan-section-title {
  color: rgba(125, 211, 252, 0.95);
  font-weight: 700;
  margin: 2px 0 8px;
}
.cangxuan-section-title.spaced {
  margin-top: 14px;
}
.cangxuan-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 8px;
}
.cangxuan-field label,
.cangxuan-limits label {
  color: rgba(255, 255, 255, 0.58);
}
.cangxuan-field textarea,
.cangxuan-search,
.cangxuan-limits input,
.cangxuan-mvu {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 5px;
  background: rgba(0, 0, 0, 0.24);
  color: rgba(255, 255, 255, 0.84);
  padding: 6px 8px;
  resize: vertical;
}
.cangxuan-field textarea[readonly] {
  color: rgba(255, 255, 255, 0.64);
  background: rgba(14, 165, 233, 0.055);
  resize: none;
}
.cangxuan-limits input {
  width: 86px;
  margin-left: 6px;
}
.cangxuan-stats span,
.cangxuan-injection-list span,
.cangxuan-plan-summary span {
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.1);
  color: rgba(186, 230, 253, 0.95);
  padding: 3px 8px;
}
.cangxuan-bindings {
  display: grid;
  gap: 4px;
  color: rgba(255, 255, 255, 0.58);
  margin-top: 8px;
  line-height: 1.45;
}
.cangxuan-mvu {
  min-height: 84px;
  white-space: pre-wrap;
  line-height: 1.5;
  color: rgba(225, 245, 254, 0.78);
  resize: none;
}
.cangxuan-entry-list {
  display: grid;
  gap: 6px;
  margin-top: 8px;
}
.cangxuan-entry {
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.17);
}
.cangxuan-entry-main {
  display: flex;
  gap: 8px;
  align-items: center;
}
.cangxuan-entry-name {
  font-weight: 700;
  color: rgba(255, 255, 255, 0.88);
}
.cangxuan-entry-badge,
.cangxuan-entry-state {
  border-radius: 999px;
  padding: 1px 7px;
  font-size: 10px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.58);
}
.cangxuan-entry-badge.always,
.cangxuan-entry-badge.suggested_always {
  color: rgba(74, 222, 128, 0.9);
  background: rgba(74, 222, 128, 0.1);
}
.cangxuan-entry-badge.scheduled,
.cangxuan-entry-badge.suggested_scheduled {
  color: rgba(96, 165, 250, 0.94);
  background: rgba(96, 165, 250, 0.1);
}
.cangxuan-entry-state.on {
  color: rgba(74, 222, 128, 0.94);
}
.cangxuan-entry-meta,
.cangxuan-entry-reason {
  margin-top: 4px;
  color: rgba(255, 255, 255, 0.46);
}
@media (max-width: 900px) {
  .cangxuan-grid {
    grid-template-columns: 1fr;
  }
}
</style>
