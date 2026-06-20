<script setup lang="ts">
import { useMainStore } from '../stores/mainStore';
import {
  ELDRED_DEFAULT_ALWAYS_NAMES,
  ELDRED_DEFAULT_SCHEDULED_NAMES,
  applyEldredWorldbookEnablePlan,
  buildEldredSchedulerConfig,
  restoreEldredWorldbookEnableBackup,
  scanEldredWorldbooks,
  type EldredWorldbookEntryRef,
  type EldredWorldbookScan,
} from '../core/eldredWorldbookScheduler';

const store = useMainStore();

const scanning = ref(false);
const applying = ref(false);
const restoring = ref(false);
const search = ref('');
const statusText = ref('');

const scan = computed(() => store.chatData.eldredWorldbookScan as EldredWorldbookScan | null);
const lastInjection = computed(() => store.chatData.eldredWorldbookLastInjection);
const backups = computed(() => store.chatData.eldredWorldbookEnableBackups || []);
const latestBackup = computed(() => backups.value[backups.value.length - 1] || null);

const schedulerEnabled = computed({
  get: () => store.settings.eldredWorldbookSchedulerEnabled,
  set: value => store.updateSettings({ eldredWorldbookSchedulerEnabled: value }),
});
const autoInjectEnabled = computed({
  get: () => store.settings.eldredWorldbookAutoInjectEnabled,
  set: value => store.updateSettings({ eldredWorldbookAutoInjectEnabled: value }),
});
const keepEnabledNames = computed({
  get: () => store.settings.eldredWorldbookKeepEnabledNames,
  set: value => store.updateSettings({ eldredWorldbookKeepEnabledNames: value }),
});
const maxEntries = computed({
  get: () => store.settings.eldredWorldbookMaxEntries,
  set: value => store.updateSettings({ eldredWorldbookMaxEntries: Number(value) }),
});
const maxChars = computed({
  get: () => store.settings.eldredWorldbookMaxChars,
  set: value => store.updateSettings({ eldredWorldbookMaxChars: Number(value) }),
});
const effectiveConfig = computed(() => buildEldredSchedulerConfig(store.settings));
const alwaysPreview = computed(() => effectiveConfig.value.alwaysNames.join('\n'));
const scheduledPreview = computed(() => effectiveConfig.value.scheduledNames.join('\n'));

const filteredEntries = computed(() => {
  const q = search.value.trim().toLowerCase();
  const entries = scan.value?.entries || [];
  if (!q) return entries.slice(0, 160);
  return entries
    .filter(entry =>
      entry.name.toLowerCase().includes(q)
      || entry.worldbookName.toLowerCase().includes(q)
      || entry.keys.join(' ').toLowerCase().includes(q)
      || entry.content.toLowerCase().includes(q),
    )
    .slice(0, 160);
});

async function runScan() {
  scanning.value = true;
  statusText.value = '';
  try {
    const result = await scanEldredWorldbooks(buildEldredSchedulerConfig(store.settings));
    store.chatData.eldredWorldbookScan = result;
    store.forcePersist();
    statusText.value = `扫描完成：${result.counts.books} 本世界书，${result.counts.entries} 个条目`;
  } catch (error) {
    statusText.value = `扫描失败：${(error as Error).message}`;
  } finally {
    scanning.value = false;
  }
}

function resetSchedulerDefaults() {
  store.updateSettings({
    eldredWorldbookAlwaysNames: ELDRED_DEFAULT_ALWAYS_NAMES,
    eldredWorldbookScheduledNames: ELDRED_DEFAULT_SCHEDULED_NAMES,
    eldredWorldbookKeepEnabledNames: '',
  });
  statusText.value = '已重置为艾尔德雷德推荐调度底座。';
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
    const result = await applyEldredWorldbookEnablePlan(buildEldredSchedulerConfig(store.settings));
    store.chatData.eldredWorldbookEnableBackups.push(result.backup);
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
    const count = await restoreEldredWorldbookEnableBackup(latestBackup.value);
    statusText.value = `已恢复 ${count} 个条目的启用状态`;
    await runScan();
  } catch (error) {
    statusText.value = `恢复失败：${(error as Error).message}`;
  } finally {
    restoring.value = false;
  }
}

function categoryLabel(category: EldredWorldbookEntryRef['category']): string {
  const map: Record<EldredWorldbookEntryRef['category'], string> = {
    always: '常驻',
    scheduled: '调度',
    suggested_always: '常驻候选',
    suggested_scheduled: '调度候选',
    unused_candidate: '关闭候选',
  };
  return map[category] || category;
}
</script>

<template>
  <div class="eldred-tab">
    <div class="eldred-toolbar">
      <label class="eldred-toggle">
        <input v-model="schedulerEnabled" type="checkbox" />
        <span>启用艾尔德雷德世界书服务</span>
      </label>
      <label class="eldred-toggle">
        <input v-model="autoInjectEnabled" type="checkbox" />
        <span>生成前自动按名注入</span>
      </label>
      <button class="eldred-btn" :disabled="scanning" @click="runScan">
        {{ scanning ? '扫描中...' : '扫描世界书' }}
      </button>
    </div>

    <div v-if="statusText" class="eldred-status">{{ statusText }}</div>

    <div class="eldred-grid">
      <section class="eldred-section">
        <div class="eldred-section-title">调度清单</div>
        <div class="eldred-plan-summary">
          <span>常驻底座 {{ effectiveConfig.alwaysNames.length }}</span>
          <span>脚本调度库 {{ effectiveConfig.scheduledNames.length }}</span>
          <span>额外保留 {{ effectiveConfig.keepEnabledNames.length }}</span>
        </div>
        <div class="eldred-field">
          <label>常驻底座（自动）</label>
          <textarea :value="alwaysPreview" rows="5" readonly />
        </div>
        <div class="eldred-field">
          <label>脚本调度库（自动）</label>
          <textarea :value="scheduledPreview" rows="5" readonly />
        </div>
        <div class="eldred-field">
          <label>额外保留启用</label>
          <textarea v-model="keepEnabledNames" rows="3" placeholder="特殊情况必须保持原生开启的条目名。" />
        </div>
        <div class="eldred-limits">
          <label>每轮最多条目 <input v-model.number="maxEntries" type="number" min="1" max="30" /></label>
          <label>每轮最多字符 <input v-model.number="maxChars" type="number" min="1000" step="500" /></label>
        </div>
        <div class="eldred-actions">
          <button class="eldred-btn" :disabled="scanning" @click="resetSchedulerDefaults">
            重置推荐底座
          </button>
          <button class="eldred-danger" :disabled="applying" @click="applyPlan">
            {{ applying ? '应用中...' : '应用轻量启用计划' }}
          </button>
          <button class="eldred-btn" :disabled="restoring || !latestBackup" @click="restoreLatestBackup">
            {{ restoring ? '恢复中...' : '恢复上次备份' }}
          </button>
        </div>
      </section>

      <section class="eldred-section">
        <div class="eldred-section-title">扫描概览</div>
        <div v-if="!scan" class="eldred-empty">尚未扫描。先点击“扫描世界书”。</div>
        <template v-else>
          <div class="eldred-stats">
            <span>世界书 {{ scan.counts.books }}</span>
            <span>条目 {{ scan.counts.entries }}</span>
            <span>已启用 {{ scan.counts.enabled }}</span>
            <span>重名 {{ scan.duplicates.length }}</span>
          </div>
          <div class="eldred-bindings">
            <div>角色主世界书：{{ scan.bindings.characterPrimary || '无' }}</div>
            <div>角色附加：{{ scan.bindings.characterAdditional.join('、') || '无' }}</div>
            <div>全局：{{ scan.bindings.global.join('、') || '无' }}</div>
            <div>聊天：{{ scan.bindings.chat || '无' }}</div>
          </div>
          <div v-if="scan.duplicates.length" class="eldred-warning">
            重名条目：{{ scan.duplicates.slice(0, 8).map(item => item.name).join('、') }}
          </div>
          <div v-if="scan.missingAlwaysNames.length || scan.missingScheduledNames.length" class="eldred-warning">
            缺失条目：
            {{ [...scan.missingAlwaysNames, ...scan.missingScheduledNames].join('、') }}
          </div>
        </template>

        <div class="eldred-section-title">本轮注入</div>
        <div v-if="!lastInjection" class="eldred-empty">尚无注入记录。</div>
        <template v-else>
          <div class="eldred-stats">
            <span>{{ lastInjection.entryNames.length }} 条</span>
            <span>{{ lastInjection.estimatedTokens }} token估算</span>
          </div>
          <div class="eldred-injection-list">
            <span v-for="name in lastInjection.entryNames" :key="name">{{ name }}</span>
          </div>
          <div v-if="lastInjection.warnings?.length" class="eldred-warning">
            {{ lastInjection.warnings.join('；') }}
          </div>
        </template>
      </section>
    </div>

    <section class="eldred-section eldred-full">
      <div class="eldred-section-title">世界书条目索引</div>
      <input v-model="search" class="eldred-search" placeholder="搜索条目名、世界书名、关键字或内容" />
      <div v-if="filteredEntries.length === 0" class="eldred-empty">没有匹配条目。</div>
      <div v-else class="eldred-entry-list">
        <div v-for="entry in filteredEntries" :key="entry.id" class="eldred-entry">
          <div class="eldred-entry-main">
            <span class="eldred-entry-name">{{ entry.name }}</span>
            <span class="eldred-entry-badge" :class="entry.category">{{ categoryLabel(entry.category) }}</span>
            <span class="eldred-entry-state" :class="{ on: entry.enabled }">{{ entry.enabled ? 'ON' : 'off' }}</span>
          </div>
          <div class="eldred-entry-meta">
            {{ entry.worldbookName }} #{{ entry.uid }} · {{ entry.strategyType }} · {{ entry.contentLength }}字
          </div>
          <div class="eldred-entry-reason">{{ entry.reasons.join('；') }}</div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.eldred-tab {
  height: 100%;
  padding: 10px 12px;
  overflow: auto;
  color: rgba(255, 255, 255, 0.82);
  font-size: 12px;
}
.eldred-toolbar,
.eldred-actions,
.eldred-limits,
.eldred-stats,
.eldred-injection-list,
.eldred-plan-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.eldred-toggle {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: rgba(255, 255, 255, 0.68);
}
.eldred-btn,
.eldred-mini-btn,
.eldred-danger {
  border: 1px solid rgba(167, 139, 250, 0.24);
  border-radius: 5px;
  background: rgba(167, 139, 250, 0.08);
  color: rgba(255, 255, 255, 0.82);
  padding: 5px 10px;
  cursor: pointer;
}
.eldred-mini-btn {
  padding: 3px 8px;
  font-size: 11px;
}
.eldred-danger {
  border-color: rgba(248, 113, 113, 0.35);
  background: rgba(248, 113, 113, 0.08);
}
button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.eldred-status,
.eldred-warning,
.eldred-empty {
  margin-top: 8px;
  padding: 8px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.56);
}
.eldred-warning {
  color: rgba(251, 191, 36, 0.86);
  border-color: rgba(251, 191, 36, 0.18);
}
.eldred-grid {
  display: grid;
  grid-template-columns: minmax(320px, 0.95fr) minmax(320px, 1.05fr);
  gap: 10px;
  margin-top: 10px;
}
.eldred-section {
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.14);
  padding: 10px;
}
.eldred-full {
  margin-top: 10px;
}
.eldred-section-title {
  color: rgba(167, 139, 250, 0.9);
  font-weight: 600;
  margin: 2px 0 8px;
}
.eldred-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 8px;
}
.eldred-field label,
.eldred-limits label {
  color: rgba(255, 255, 255, 0.55);
}
.eldred-field textarea,
.eldred-search,
.eldred-limits input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 5px;
  background: rgba(0, 0, 0, 0.22);
  color: rgba(255, 255, 255, 0.82);
  padding: 6px 8px;
  resize: vertical;
}
.eldred-field textarea[readonly] {
  color: rgba(255, 255, 255, 0.62);
  background: rgba(167, 139, 250, 0.055);
  resize: none;
}
.eldred-limits input {
  width: 86px;
  margin-left: 6px;
}
.eldred-stats span,
.eldred-injection-list span,
.eldred-plan-summary span {
  border-radius: 999px;
  background: rgba(167, 139, 250, 0.09);
  color: rgba(216, 205, 255, 0.9);
  padding: 3px 8px;
}
.eldred-bindings {
  display: grid;
  gap: 4px;
  color: rgba(255, 255, 255, 0.56);
  margin-top: 8px;
  line-height: 1.45;
}
.eldred-entry-list {
  display: grid;
  gap: 6px;
  margin-top: 8px;
}
.eldred-entry {
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.16);
}
.eldred-entry-main {
  display: flex;
  gap: 8px;
  align-items: center;
}
.eldred-entry-name {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.86);
}
.eldred-entry-badge,
.eldred-entry-state {
  border-radius: 999px;
  padding: 1px 7px;
  font-size: 10px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.55);
}
.eldred-entry-badge.always,
.eldred-entry-badge.suggested_always {
  color: rgba(74, 222, 128, 0.86);
  background: rgba(74, 222, 128, 0.09);
}
.eldred-entry-badge.scheduled,
.eldred-entry-badge.suggested_scheduled {
  color: rgba(96, 165, 250, 0.9);
  background: rgba(96, 165, 250, 0.09);
}
.eldred-entry-state.on {
  color: rgba(74, 222, 128, 0.9);
}
.eldred-entry-meta,
.eldred-entry-reason {
  margin-top: 4px;
  color: rgba(255, 255, 255, 0.45);
}
@media (max-width: 900px) {
  .eldred-grid {
    grid-template-columns: 1fr;
  }
}
</style>
