n<script setup lang="ts">
import { useMainStore } from '../stores/mainStore';
import { analyzePersona } from '../core/persona';
import { fetchAvailableModels } from '../utils/apiCaller';

const store = useMainStore();

// 多人设管理
const editingPersona = ref('');
const isAnalyzing = ref(false);
const newPersonaName = ref('');
const isAddingPersona = ref(false);
const renamingId = ref('');
const renamingName = ref('');

// 同步当前激活人设到编辑框
watch(() => store.persona, (p) => {
  editingPersona.value = p.rawInput;
}, { immediate: true });


// API 监听器
const showApiMonitor = ref(false);
const monitorSelectedIndex = ref(0);

function formatMonitorTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  catch { return iso.slice(11, 19); }
}

function monitorInputText(entry: typeof store.apiMonitorLogs[number]) {
  return entry.messages.map(m => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n---\n\n');
}

// 导入导出
const fileInput = ref<HTMLInputElement>();

// 当前模型（仅自定义API）
const currentModel = computed(() => {
  return store.settings.customApiModel || '未设置';
});
const isClaudeModel = computed(() => {
  const model = currentModel.value;
  return /claude/i.test(model);
});

// 模型列表获取
const modelList = ref<string[]>([]);
const modelListLoading = ref(false);
const modelListError = ref('');

// 小总结模型列表
const smallModelList = ref<string[]>([]);
const smallModelListLoading = ref(false);
const smallModelListError = ref('');

async function loadModelList() {
  const url = store.settings.customApiUrl?.trim();
  const key = store.settings.customApiKey?.trim();
  if (!url || !key) {
    modelListError.value = '请先填写API地址和Key';
    return;
  }
  modelListLoading.value = true;
  modelListError.value = '';
  try {
    modelList.value = await fetchAvailableModels(url, key);
  } catch (e: any) {
    modelListError.value = e?.message || '获取失败';
  } finally {
    modelListLoading.value = false;
  }
}

async function loadSmallModelList() {
  const url = (store.settings as any).smallSummaryApiUrl?.trim();
  const key = (store.settings as any).smallSummaryApiKey?.trim();
  if (!url || !key) {
    smallModelListError.value = '请先填写API地址和Key';
    return;
  }
  smallModelListLoading.value = true;
  smallModelListError.value = '';
  try {
    smallModelList.value = await fetchAvailableModels(url, key);
  } catch (e: any) {
    smallModelListError.value = e?.message || '获取失败';
  } finally {
    smallModelListLoading.value = false;
  }
}

// 新建人设
function addPersona() {
  const name = newPersonaName.value.trim();
  if (!name) return;
  const id = store.addPersona(name);
  store.setActivePersona(id);
  newPersonaName.value = '';
  isAddingPersona.value = false;
  console.info(`[智脑] 新建人设: ${name}`);
}

// 删除人设
function removePersona(id: string) {
  store.removePersona(id);
  console.info('[智脑] 人设已删除');
}

// 切换激活人设
function switchPersona(id: string) {
  store.setActivePersona(id);
}

// 开始重命名
function startRename(id: string, currentName: string) {
  renamingId.value = id;
  renamingName.value = currentName;
}

function confirmRename() {
  if (renamingId.value && renamingName.value.trim()) {
    store.renamePersona(renamingId.value, renamingName.value.trim());
  }
  renamingId.value = '';
}

// 保存人格
async function saveAndAnalyzePersona() {
  store.updatePersonaRaw(editingPersona.value);
  if (!editingPersona.value.trim()) {
    console.info('[智脑] 请先填写用户人设');
    return;
  }

  isAnalyzing.value = true;
  console.info('[智脑] 正在分析用户人格...');

  try {
    const profile = await analyzePersona(editingPersona.value, store.getUserName());
    store.updatePersonaProfile(profile);
    console.info('[智脑] 人格分析完成');
  } catch (error) {
    console.error('[智脑] 人格分析失败:', error);
  } finally {
    isAnalyzing.value = false;
  }
}

function savePersonaOnly() {
  store.updatePersonaRaw(editingPersona.value);
  console.info('[智脑] 人设已保存');
}


// 数据管理
function exportData() {
  const data = store.exportAllData();
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `zhino_data_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  console.info('[智脑] 数据已导出');
}

// 文件选择导入
function handleFileImport(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target?.result as string;
    if (!content) return;
    try {
      store.importAllData(content);
      console.info('[智脑] 数据导入成功');
      try { window.toastr?.success('数据导入成功', '✅ 导入成功', { timeOut: 3000 }); } catch(_) {
        // Toastr is optional in some script contexts.
      }
    } catch (err: any) {
      console.error('[智脑] 导入失败:', err);
      const msg = err?.message || String(err);
      try { window.toastr?.error(msg, '❌ 导入失败', { timeOut: 8000, extendedTimeOut: 3000 }); } catch(_) {
        // Toastr is optional in some script contexts.
      }
    }
  };
  reader.readAsText(file);
  input.value = '';
}

function restoreCharacter(name: string) {
  store.unignoreCharacter(name);
  store.forcePersist();
}

// ─── 选择性删除数据 ───
const showDeletePanel = ref(false);
const showDeleteConfirm = ref(false);
const deleteSelection = reactive({
  world: false,
  grandSummary: false,
  relationships: false,
  dreamtalk: false,
  smallSummary: false,
});
const deleteResultMsg = ref('');

const deleteBlocks = [
  {
    key: 'world' as const,
    label: '世界',
    desc: '生态推演 · 世界进展 · 剧情导演 · 物品记忆',
    count(): number {
      const cd = store.chatData;
      const eco = cd.ecosystemState ? 1 : 0;
      const wr = (cd.worldProgressRecords || []).length;
      const plot = cd.plotOutline ? 1 : 0;
      const items = (cd.itemMemories || []).length;
      return eco + wr + plot + items;
    },
  },
  {
    key: 'grandSummary' as const,
    label: '大总结',
    desc: '时间线 · 角色记忆 · 正文捕获 · 动态人设 · NSFW · 已忽略角色',
    count(): number {
      const cd = store.chatData;
      const summaries = (cd.summaries || []).length + (cd.summaryHistory || []).length;
      const caps = (cd.capturedContents || []).length;
      const dp2 = (cd.dynamicProfilesV2 || []).length;
      const dp1 = (cd.dynamicProfiles || []).length;
      const nsfw = (cd.nsfwMemories || []).length;
      const ignored = (cd.ignoredCharacters || []).length;
      return summaries + caps + dp2 + dp1 + nsfw + ignored;
    },
  },
  {
    key: 'relationships' as const,
    label: '关系网',
    desc: '关系档案',
    count(): number { return (store.chatData.relationshipProfiles || []).length; },
  },
  {
    key: 'dreamtalk' as const,
    label: '梦呓',
    desc: '梦境碎语',
    count(): number {
      const cd = store.chatData;
      const main = cd.dreamtalk ? 1 : 0;
      const hist = (cd.dreamtalkHistory || []).length;
      const undo = (cd.dreamtalkUndoHistory || []).length;
      return main + hist + undo;
    },
  },
  {
    key: 'smallSummary' as const,
    label: '小总结',
    desc: '每轮楼层小总结',
    count(): number { return (store.chatData.smallSummaries || []).length; },
  },
];

function toggleSelectAll() {
  const allSelected = deleteBlocks.every(b => deleteSelection[b.key]);
  for (const b of deleteBlocks) deleteSelection[b.key] = !allSelected;
}

function resetDeletePanel() {
  for (const b of deleteBlocks) deleteSelection[b.key] = false;
  showDeleteConfirm.value = false;
  deleteResultMsg.value = '';
}

function requestDelete() {
  const selected = deleteBlocks.filter(b => deleteSelection[b.key]);
  if (selected.length === 0) {
    deleteResultMsg.value = '❌ 未选择任何模块';
    return;
  }
  showDeleteConfirm.value = true;
}

function executeSelectiveDelete() {
  const selected = deleteBlocks.filter(b => deleteSelection[b.key]);
  if (selected.length === 0) return;

  try {
    const cd = store.chatData;

    for (const b of selected) {
      switch (b.key) {
        case 'world':
          cd.ecosystemState = null;
          cd.worldProgressRecords = [];
          cd.lastWorldProgressFloor = 0;
          cd.plotOutline = null;
          cd.lastPlotCheckFloor = 0;
          cd.lastPlotCheckResult = null;
          cd.itemMemories = [];
          break;
        case 'grandSummary':
          cd.summaries = [];
          cd.summaryHistory = [];
          cd.lastSummaryAtMessageId = 0;
          cd.capturedContents = [];
          cd.userInputRecords = [];
          cd.storyDateFormat = '';
          cd.dynamicProfiles = [];
          cd.dynamicProfilesV2 = [];
          cd.lastDynamicProfileFloor = 0;
          cd.pendingDynamicProfile = false;
          cd.nsfwMemories = [];
          cd.nsfwDreamtalk = null;
          cd.nsfwDynamicProfiles = [];
          cd.ignoredCharacters = [];
          (cd as any)._ignoredBackup = [];
          break;
        case 'relationships':
          cd.relationshipProfiles = [];
          break;
        case 'dreamtalk':
          cd.dreamtalk = null;
          cd.dreamtalkHistory = [];
          cd.dreamtalkUndoHistory = [];
          break;
        case 'smallSummary':
          cd.smallSummaries = [];
          break;
      }
    }
    store.forcePersist();

    const names = selected.map(b => b.label).join('、');
    deleteResultMsg.value = `✅ 已删除：${names}`;
    console.info(`[智脑] 选择性删除完成: ${names}`);
    resetDeletePanel();
    showDeletePanel.value = false;
  } catch (err: any) {
    deleteResultMsg.value = `❌ 删除失败: ${err?.message || err}`;
  }
}
</script>

<template>
  <div class="zhino-settings">
    <!-- 功能开关 -->
    <div class="zhino-section">
      <div class="zhino-section-title">功能开关</div>

      <label class="zhino-toggle-row">
        <span class="zhino-toggle-label">用户人格注入</span>
        <input type="checkbox" :checked="store.settings.personaEnabled"
          @change="store.updateSettings({ personaEnabled: ($event.target as HTMLInputElement).checked })" />
      </label>

      <label class="zhino-toggle-row">
        <span class="zhino-toggle-label">动态人设</span>
        <input type="checkbox" :checked="store.settings.dynamicProfileEnabled"
          @change="store.updateSettings({ dynamicProfileEnabled: ($event.target as HTMLInputElement).checked })" />
      </label>

      <label class="zhino-toggle-row">
        <span class="zhino-toggle-label">正文捕获</span>
        <input type="checkbox" :checked="store.settings.captureEnabled"
          @change="store.updateSettings({ captureEnabled: ($event.target as HTMLInputElement).checked })" />
      </label>

      <label class="zhino-toggle-row">
        <span class="zhino-toggle-label">记忆激活</span>
        <input type="checkbox" :checked="store.settings.memoryActivationEnabled"
          @change="store.updateSettings({ memoryActivationEnabled: ($event.target as HTMLInputElement).checked })" />
      </label>

      <label class="zhino-toggle-row">
        <span class="zhino-toggle-label">关系档案注入</span>
        <input type="checkbox" :checked="store.settings.relationshipInjectionEnabled"
          @change="store.updateSettings({ relationshipInjectionEnabled: ($event.target as HTMLInputElement).checked })" />
      </label>

      <label class="zhino-toggle-row">
        <span class="zhino-toggle-label">梦呓注入</span>
        <input type="checkbox" :checked="store.settings.dreamtalkEnabled"
          @change="store.updateSettings({ dreamtalkEnabled: ($event.target as HTMLInputElement).checked })" />
      </label>

      <label class="zhino-toggle-row">
        <span class="zhino-toggle-label">剧情摘要注入</span>
        <input type="checkbox" :checked="store.settings.summaryInjectionEnabled"
          @change="store.updateSettings({ summaryInjectionEnabled: ($event.target as HTMLInputElement).checked })" />
      </label>

      <label class="zhino-toggle-row">
        <span class="zhino-toggle-label">物品语义召回</span>
        <input type="checkbox" :checked="store.settings.itemRecallEnabled"
          @change="store.updateSettings({ itemRecallEnabled: ($event.target as HTMLInputElement).checked })" />
      </label>


    </div>

    <!-- 高级功能 -->
    <div class="zhino-section">
      <div class="zhino-section-title">高级功能</div>

      <label class="zhino-toggle-row">
        <div class="zhino-toggle-info">
          <span class="zhino-toggle-label">大总结引导弹窗</span>
          <span class="zhino-toggle-desc">总结前弹窗让你填写记忆要点</span>
        </div>
        <input type="checkbox" :checked="store.settings.summaryGuidanceEnabled"
          @change="store.updateSettings({ summaryGuidanceEnabled: ($event.target as HTMLInputElement).checked })" />
      </label>

      <label class="zhino-toggle-row">
        <div class="zhino-toggle-info">
          <span class="zhino-toggle-label">事实信息强调</span>
          <span class="zhino-toggle-desc">每轮自动注入时间/地点/物品等客观事实，防止AI犯错</span>
        </div>
        <input type="checkbox" :checked="store.settings.factEmphasisEnabled"
          @change="store.updateSettings({ factEmphasisEnabled: ($event.target as HTMLInputElement).checked })" />
      </label>

      <label class="zhino-toggle-row">
        <div class="zhino-toggle-info">
          <span class="zhino-toggle-label">后台角色行动推演</span>
          <span class="zhino-toggle-desc">不在场角色自动推演后台行动（每N楼调用一次AI）</span>
        </div>
        <input type="checkbox" :checked="store.settings.ecosystemEnabled"
          @change="store.updateSettings({ ecosystemEnabled: ($event.target as HTMLInputElement).checked })" />
      </label>

      <div v-if="store.settings.ecosystemEnabled" class="zhino-inline-setting" style="margin-top:6px;padding-left:4px">
        <span class="zhino-setting-desc">推演间隔：每隔</span>
        <input
          type="number"
          class="zhino-input-num"
          :value="store.settings.ecosystemInterval"
          min="2"
          max="10"
          @change="store.updateSettings({ ecosystemInterval: Number(($event.target as HTMLInputElement).value) })"
        />
        <span class="zhino-setting-desc">楼触发</span>
      </div>

      <div v-if="store.settings.ecosystemEnabled" class="zhino-manual-chars">
        <div class="zhino-setting-label">手动指定推演角色</div>
        <div class="zhino-setting-hint">输入角色名，逗号分隔，最多5个。留空则自动选择不在场角色。<br/>此设置跟随聊天保存，不同聊天可设不同角色。</div>
        <input
          type="text"
          :value="store.ecosystemManualChars"
          placeholder="例：疏影,赤练仙子"
          @input="store.updateEcosystemManualChars(($event.target as HTMLInputElement).value)"
        />
      </div>

      <label class="zhino-toggle-row">
        <div class="zhino-toggle-info">
          <span class="zhino-toggle-label">世界推进</span>
          <span class="zhino-toggle-desc">按时间切片推演不在场角色行动（替代后台推演的叙事模式）</span>
        </div>
        <input type="checkbox" :checked="store.settings.worldProgressEnabled"
          @change="store.updateSettings({ worldProgressEnabled: ($event.target as HTMLInputElement).checked })" />
      </label>

      <div v-if="store.settings.worldProgressEnabled" class="zhino-inline-setting" style="margin-top:6px;padding-left:4px">
        <span class="zhino-setting-desc">世界推进间隔：每隔</span>
        <input
          type="number"
          class="zhino-input-num"
          :value="store.settings.worldProgressInterval"
          min="1"
          max="10"
          @change="store.updateSettings({ worldProgressInterval: Number(($event.target as HTMLInputElement).value) })"
        />
        <span class="zhino-setting-desc">AI楼触发</span>
      </div>

      <label class="zhino-toggle-row">
        <div class="zhino-toggle-info">
          <span class="zhino-toggle-label">剧情导演</span>
          <span class="zhino-toggle-desc">设定剧情大纲后自动引导剧情方向，定期校对偏离度</span>
        </div>
        <input type="checkbox" :checked="store.settings.plotDirectorEnabled"
          @change="store.updateSettings({ plotDirectorEnabled: ($event.target as HTMLInputElement).checked })" />
      </label>

      <div v-if="store.settings.plotDirectorEnabled" class="zhino-inline-setting" style="margin-top:6px;padding-left:4px">
        <span class="zhino-setting-desc">校对间隔：每隔</span>
        <input
          type="number"
          class="zhino-input-num"
          :value="store.settings.plotCheckInterval"
          min="3"
          max="20"
          @change="store.updateSettings({ plotCheckInterval: Number(($event.target as HTMLInputElement).value) })"
        />
        <span class="zhino-setting-desc">AI楼校对一次</span>
      </div>
    </div>

    <!-- 间隔设置 -->
    <div class="zhino-section">
      <div class="zhino-section-title">间隔设置</div>
      <div class="zhino-inline-setting">
        <span class="zhino-setting-desc">大总结：每隔</span>
        <input
          type="number"
          class="zhino-input-num"
          :value="store.settings.summaryInterval"
          min="5"
          max="50"
          @change="store.updateSettings({ summaryInterval: Number(($event.target as HTMLInputElement).value) })"
        />
        <span class="zhino-setting-desc">AI楼触发</span>
      </div>

      <div class="zhino-inline-setting" style="margin-top:6px">
        <span class="zhino-setting-desc">保留最新的</span>
        <input
          type="number"
          class="zhino-input-num"
          :value="store.settings.preserveRecentFloors"
          min="1"
          max="20"
          @change="store.updateSettings({ preserveRecentFloors: Number(($event.target as HTMLInputElement).value) })"
        />
        <span class="zhino-setting-desc">条AI回复不总结</span>
      </div>

      <div class="zhino-inline-setting" style="margin-top:6px">
        <span class="zhino-setting-desc">动态人设：每隔</span>
        <input
          type="number"
          class="zhino-input-num"
          :value="store.settings.dynamicProfileInterval"
          min="3"
          max="20"
          @change="store.updateSettings({ dynamicProfileInterval: Number(($event.target as HTMLInputElement).value) })"
        />
        <span class="zhino-setting-desc">轮对话分析</span>
      </div>
    </div>

    <!-- 界面大小 -->
    <div class="zhino-section">
      <div class="zhino-section-title">界面大小</div>
      <div class="zhino-inline-setting">
        <span class="zhino-setting-desc">界面大小：</span>
        <div class="zhino-size-btns">
          <button
            v-for="level in [1, 2, 3]"
            :key="level"
            class="zhino-size-btn"
            :class="{ active: store.settings.fontSize === level }"
            @click="store.updateSettings({ fontSize: level })"
          >{{ level }}</button>
        </div>
      </div>
      <div class="zhino-inline-setting" style="margin-top:8px">
        <span class="zhino-setting-desc">切色：</span>
        <div class="zhino-size-btns">
          <button
            class="zhino-size-btn"
            :class="{ active: (store.settings as any).colorTheme !== 'warm' }"
            @click="store.updateSettings({ colorTheme: 'cool' } as any)"
          >冷色</button>
          <button
            class="zhino-size-btn zhino-warm-btn"
            :class="{ active: (store.settings as any).colorTheme === 'warm' }"
            @click="store.updateSettings({ colorTheme: 'warm' } as any)"
          >暖色</button>
        </div>
      </div>
    </div>

    <!-- 自定义API -->
    <div class="zhino-section">
      <div class="zhino-section-title">通用后台API（聊天补全）</div>

      <div class="zhino-api-field">
          <div class="zhino-detail-label">API地址</div>
          <input
            class="zhino-input"
            :value="store.settings.customApiUrl"
            @change="store.updateSettings({ customApiUrl: ($event.target as HTMLInputElement).value })"
            placeholder="https://api.openai.com/v1"
          />
        </div>
        <div class="zhino-api-field">
          <div class="zhino-detail-label">API Key</div>
          <input
            class="zhino-input"
            type="password"
            :value="store.settings.customApiKey"
            @change="store.updateSettings({ customApiKey: ($event.target as HTMLInputElement).value })"
            placeholder="sk-..."
          />
        </div>
        <div class="zhino-api-field">
          <div class="zhino-detail-label">模型</div>
          <div class="zhino-model-row">
            <select
              class="zhino-input zhino-model-select"
              :value="store.settings.customApiModel"
              @change="store.updateSettings({ customApiModel: ($event.target as HTMLSelectElement).value })"
            >
              <option value="" disabled>选择模型</option>
              <option v-for="m in modelList" :key="m" :value="m">{{ m }}</option>
              <option v-if="store.settings.customApiModel && !modelList.includes(store.settings.customApiModel)" :value="store.settings.customApiModel">{{ store.settings.customApiModel }}</option>
            </select>
            <button class="zhino-btn-sm" :disabled="modelListLoading" @click="loadModelList">
              {{ modelListLoading ? '...' : '获取' }}
            </button>
          </div>
          <div v-if="modelListError" class="zhino-api-warn">{{ modelListError }}</div>
        </div>
        <div class="zhino-api-warn">
          禁止使用gemini-3-fast等低智模型
        </div>
    </div>

    <!-- 小总结独立API -->
    <div class="zhino-section">
      <div class="zhino-section-title">小总结API（廉价模型）</div>
      <div class="zhino-setting-hint" style="margin-bottom:8px">
        小总结可使用廉价模型（如 DeepSeek）独立运行。不填则跟随通用API。
      </div>

      <label class="zhino-toggle-row">
        <span class="zhino-toggle-label">使用独立API</span>
        <input type="checkbox"
          :checked="(store.settings as any).smallSummaryApiEnabled"
          @change="store.updateSettings({ smallSummaryApiEnabled: ($event.target as HTMLInputElement).checked } as any)" />
      </label>

      <template v-if="(store.settings as any).smallSummaryApiEnabled">
        <div class="zhino-api-field">
          <div class="zhino-detail-label">API地址</div>
          <input
            class="zhino-input"
            :value="(store.settings as any).smallSummaryApiUrl"
            @change="store.updateSettings({ smallSummaryApiUrl: ($event.target as HTMLInputElement).value } as any)"
            placeholder="https://api.deepseek.com/v1"
          />
        </div>
        <div class="zhino-api-field">
          <div class="zhino-detail-label">API Key</div>
          <input
            class="zhino-input"
            type="password"
            :value="(store.settings as any).smallSummaryApiKey"
            @change="store.updateSettings({ smallSummaryApiKey: ($event.target as HTMLInputElement).value } as any)"
            placeholder="sk-..."
          />
        </div>
        <div class="zhino-api-field">
          <div class="zhino-detail-label">模型</div>
          <div class="zhino-model-row">
            <select
              class="zhino-input zhino-model-select"
              :value="(store.settings as any).smallSummaryApiModel"
              @change="store.updateSettings({ smallSummaryApiModel: ($event.target as HTMLSelectElement).value } as any)"
            >
              <option value="" disabled>选择模型</option>
              <option v-for="m in smallModelList" :key="m" :value="m">{{ m }}</option>
              <option v-if="(store.settings as any).smallSummaryApiModel && !smallModelList.includes((store.settings as any).smallSummaryApiModel)" :value="(store.settings as any).smallSummaryApiModel">{{ (store.settings as any).smallSummaryApiModel }}</option>
            </select>
            <button class="zhino-btn-sm" :disabled="smallModelListLoading" @click="loadSmallModelList">
              {{ smallModelListLoading ? '...' : '获取' }}
            </button>
          </div>
          <div v-if="smallModelListError" class="zhino-api-warn">{{ smallModelListError }}</div>
        </div>
      </template>
    </div>

    <!-- API 监听器 -->
    <div class="zhino-section">
      <div class="zhino-section-title">API 监听器</div>
      <div class="zhino-toggle-row">
        <span class="zhino-toggle-label">开启后台API调用监听</span>
        <input type="checkbox"
          :checked="store.settings.apiMonitorEnabled"
          @change="store.updateSettings({ apiMonitorEnabled: ($event.target as HTMLInputElement).checked })"
        />
      </div>
      <div class="zhino-api-monitor-desc">
        开启后记录最近 5 次后台分析的输入和输出，方便调试自定义API
      </div>
      <button
        v-if="store.settings.apiMonitorEnabled && store.apiMonitorLogs.length > 0"
        class="zhino-btn-sm zhino-btn-save"
        style="margin-top:8px"
        @click="showApiMonitor = true"
      >
        查看日志 ({{ store.apiMonitorLogs.length }})
      </button>
      <div v-else-if="store.settings.apiMonitorEnabled && store.apiMonitorLogs.length === 0" class="zhino-empty-hint">
        暂无日志，等待后台分析触发...
      </div>
    </div>

    <!-- 用户人设（多配置） -->
    <div class="zhino-section">
      <div class="zhino-section-header">
        <div class="zhino-section-title">用户人设</div>
        <button class="zhino-btn-sm" @click="isAddingPersona = !isAddingPersona">
          {{ isAddingPersona ? '取消' : '+ 新建' }}
        </button>
      </div>

      <!-- 新建人设输入 -->
      <div v-if="isAddingPersona" class="zhino-add-persona">
        <input
          v-model="newPersonaName"
          class="zhino-input"
          placeholder="人设名称（如：日常角色、战斗角色）"
          @keyup.enter="addPersona"
        />
        <button class="zhino-btn-sm zhino-btn-save" @click="addPersona">创建</button>
      </div>

      <!-- 人设列表 -->
      <div v-if="store.personas.length === 0" class="zhino-empty-hint">
        暂无人设，点击"+ 新建"创建第一个
      </div>
      <div v-else class="zhino-persona-list">
        <div
          v-for="p in store.personas"
          :key="p.id"
          class="zhino-persona-item"
          :class="{ active: store.activePersonaId === p.id }"
          @click="switchPersona(p.id)"
        >
          <div class="zhino-persona-item-left">
            <span v-if="renamingId !== p.id" class="zhino-persona-name">{{ p.name || '未命名' }}</span>
            <input
              v-else
              v-model="renamingName"
              class="zhino-input zhino-input-inline"
              @keyup.enter="confirmRename"
              @blur="confirmRename"
              @click.stop
            />
            <span v-if="store.activePersonaId === p.id" class="zhino-persona-badge">激活</span>
          </div>
          <div class="zhino-persona-item-right" @click.stop>
            <button class="zhino-btn-xs" @click="startRename(p.id, p.name)">改名</button>
            <button class="zhino-btn-xs zhino-btn-danger" @click="removePersona(p.id)">删除</button>
          </div>
        </div>
      </div>

      <!-- 当前激活人设编辑 -->
      <template v-if="store.persona.id">
        <div class="zhino-persona-edit-header">
          编辑: {{ store.persona.name || '未命名' }}
        </div>
        <textarea
          v-model="editingPersona"
          class="zhino-textarea"
          rows="5"
          placeholder="填写你的角色人设（性格、行为模式、说话风格等）"
        />
        <div class="zhino-btn-row">
          <button class="zhino-btn-sm" @click="savePersonaOnly">仅保存</button>
          <button
            class="zhino-btn-sm zhino-btn-save"
            :disabled="isAnalyzing || !editingPersona.trim()"
            @click="saveAndAnalyzePersona"
          >
            {{ isAnalyzing ? '分析中...' : '保存并分析' }}
          </button>
        </div>
        <div v-if="store.persona.analyzedProfile" class="zhino-profile-preview">
          <div class="zhino-detail-label">分析结果（可直接编辑）：</div>
          <textarea
            class="zhino-textarea"
            rows="6"
            :value="store.persona.analyzedProfile"
            @change="store.updatePersonaProfile(($event.target as HTMLTextAreaElement).value)"
          />
        </div>
      </template>
    </div>

    <!-- 模型检测 -->
    <div class="zhino-section">
      <div class="zhino-section-title">模型检测</div>
      <div class="zhino-info-row">
        <span class="zhino-info-label">自定义模型：</span>
        <span class="zhino-info-value">{{ currentModel || '未设置' }}</span>
        <span class="zhino-api-badge">自定义API</span>
      </div>
      <div v-if="isClaudeModel" class="zhino-warning">
        检测到 Claude 模型，已自动调整 prefill 策略（最后一条 assistant prefill → system）
      </div>
    </div>


    <!-- 数据管理 -->
    <div class="zhino-section">
      <div class="zhino-section-title">数据管理</div>
      <div class="zhino-btn-row">
        <button class="zhino-btn-sm" @click="exportData">导出数据</button>
        <input
          ref="fileInput"
          type="file"
          accept=".json"
          style="display:none"
          @change="handleFileImport"
        />
        <button class="zhino-btn-sm" @click="fileInput?.click()">导入数据</button>
        <button class="zhino-btn-sm zhino-btn-danger" @click="showDeletePanel = !showDeletePanel; resetDeletePanel()">数据删除</button>
      </div>

      <!-- 选择性删除面板 -->
      <div v-if="showDeletePanel" class="zhino-delete-panel">
        <div class="zhino-delete-header">
          <span class="zhino-delete-title">选择要删除的数据块</span>
          <label class="zhino-delete-select-all">
            <input type="checkbox" :checked="deleteBlocks.every(b => deleteSelection[b.key])" @change="toggleSelectAll" />
            <span>全选</span>
          </label>
        </div>
        <div v-for="block in deleteBlocks" :key="block.key" class="zhino-delete-row">
          <label class="zhino-delete-label">
            <input type="checkbox" v-model="deleteSelection[block.key]" />
            <span class="zhino-delete-block-name">{{ block.label }}</span>
            <span class="zhino-delete-block-desc">{{ block.desc }}</span>
            <span class="zhino-delete-block-count">({{ block.count() }})</span>
          </label>
        </div>
        <div class="zhino-delete-confirm">
          <template v-if="!showDeleteConfirm">
            <button class="zhino-btn-sm zhino-btn-danger" @click="requestDelete">确认删除</button>
            <button class="zhino-btn-sm" @click="showDeletePanel = false; resetDeletePanel()">取消</button>
          </template>
          <template v-else>
            <span class="zhino-delete-confirm-text">确认删除所选数据？此操作不可撤销。</span>
            <button class="zhino-btn-sm zhino-btn-danger" @click="executeSelectiveDelete">确认</button>
            <button class="zhino-btn-sm" @click="showDeleteConfirm = false">取消</button>
          </template>
        </div>
        <div v-if="deleteResultMsg" class="zhino-delete-msg" :class="{ ok: deleteResultMsg.startsWith('✅'), fail: deleteResultMsg.startsWith('❌') }">
          {{ deleteResultMsg }}
        </div>
      </div>
    </div>

    <!-- 已忽略角色 -->
    <div class="zhino-section" v-if="store.chatData.ignoredCharacters.length > 0">
      <div class="zhino-section-title">已忽略角色 ({{ store.chatData.ignoredCharacters.length }})</div>
      <div class="zhino-ignored-list">
        <span v-for="name in store.chatData.ignoredCharacters" :key="name" class="zhino-ignored-tag">
          {{ name }}
          <button class="zhino-ignored-restore" title="恢复此角色" @click="restoreCharacter(name)">↩</button>
        </span>
      </div>
      <div class="zhino-ignored-hint">恢复后下次大总结将重新分析该角色</div>
    </div>
  </div>

  <!-- API 监听器日志弹窗 -->
  <div v-if="showApiMonitor" class="zhino-monitor-overlay" @click.self="showApiMonitor = false">
    <div class="zhino-monitor-modal">
      <div class="zhino-monitor-header">
        <span class="zhino-monitor-title">API 监听日志</span>
        <button class="zhino-monitor-close" @click="showApiMonitor = false">✕</button>
      </div>
      <div class="zhino-monitor-tabs">
        <button
          v-for="(entry, i) in store.apiMonitorLogs"
          :key="i"
          class="zhino-monitor-tab"
          :class="{ active: monitorSelectedIndex === i }"
          @click="monitorSelectedIndex = i"
        >
          {{ formatMonitorTime(entry.timestamp) }}
          <span class="zhino-monitor-tab-sub">{{ entry.analysisName }}</span>
        </button>
      </div>
      <template v-if="store.apiMonitorLogs.length > 0">
        <div class="zhino-monitor-body">
          <div class="zhino-monitor-meta">
            <span>模型: {{ store.apiMonitorLogs[monitorSelectedIndex]?.model }}</span>
            <span>耗时: {{ store.apiMonitorLogs[monitorSelectedIndex]?.durationMs }}ms</span>
          </div>
          <div class="zhino-monitor-section">
            <div class="zhino-monitor-label">输入 (发送给 AI 的消息)</div>
            <pre class="zhino-monitor-pre">{{
              monitorInputText(store.apiMonitorLogs[monitorSelectedIndex])
            }}</pre>
          </div>
          <div class="zhino-monitor-section">
            <div class="zhino-monitor-label">输出 (AI 返回)</div>
            <pre class="zhino-monitor-pre">{{
              store.apiMonitorLogs[monitorSelectedIndex]?.response || '(空)'
            }}</pre>
          </div>
        </div>
        <div class="zhino-monitor-footer">
          <button class="zhino-btn-sm zhino-btn-save" @click="store.clearApiMonitorLogs()">清空日志</button>
        </div>
      </template>
      <div v-else class="zhino-empty-hint" style="padding:40px">暂无日志</div>
    </div>
  </div>
</template>

<style scoped>
.zhino-settings {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
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

.zhino-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 0;
  cursor: pointer;
}
.zhino-toggle-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}
.zhino-toggle-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.zhino-toggle-desc {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.35);
  line-height: 1.3;
}
.zhino-toggle-row input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #a78bfa;
}

.zhino-inline-setting {
  display: flex;
  align-items: center;
  gap: 6px;
}
.zhino-setting-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}
.zhino-input-num {
  width: 50px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 3px 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  text-align: center;
  outline: none;
}
.zhino-input-num:focus {
  border-color: rgba(167, 139, 250, 0.4);
}

.zhino-manual-chars {
  margin-top: 10px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
}
.zhino-setting-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 4px;
}
.zhino-setting-hint {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
  margin-bottom: 8px;
  line-height: 1.4;
}
.zhino-manual-chars input {
  width: 100%;
  box-sizing: border-box;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 6px 10px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  outline: none;
}
.zhino-manual-chars input::placeholder {
  color: rgba(255, 255, 255, 0.2);
}
.zhino-manual-chars input:focus {
  border-color: rgba(167, 139, 250, 0.4);
}

.zhino-slider {
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.1);
  outline: none;
}
.zhino-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgba(167, 139, 250, 0.9);
  border: 2px solid #1e1e2e;
  cursor: pointer;
}
.zhino-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgba(167, 139, 250, 0.9);
  border: 2px solid #1e1e2e;
  cursor: pointer;
}

.zhino-size-btns {
  display: flex;
  gap: 4px;
}
.zhino-size-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  padding: 0;
}
.zhino-size-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.8);
}
.zhino-size-btn.active {
  border-color: rgba(167, 139, 250, 0.4);
  background: rgba(167, 139, 250, 0.15);
  color: rgba(167, 139, 250, 0.9);
}
.zhino-warm-btn.active {
  border-color: rgba(245, 166, 35, 0.4);
  background: rgba(245, 166, 35, 0.15);
  color: rgba(245, 166, 35, 0.9);
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
  font-family: inherit;
  margin-bottom: 6px;
}
.zhino-textarea:focus {
  border-color: rgba(167, 139, 250, 0.4);
}

.zhino-input {
  width: 100%;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  outline: none;
}
.zhino-input:focus {
  border-color: rgba(167, 139, 250, 0.4);
}

.zhino-btn-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 6px;
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
.zhino-btn-danger {
  border-color: rgba(248, 113, 113, 0.3);
  color: rgba(248, 113, 113, 0.8);
}
.zhino-btn-danger:hover {
  background: rgba(248, 113, 113, 0.12);
}

.zhino-profile-preview {
  margin-top: 8px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
}
.zhino-profile-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  white-space: pre-wrap;
  line-height: 1.5;
  max-height: 120px;
  overflow-y: auto;
}
.zhino-detail-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 4px;
}

.zhino-info-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.zhino-info-label {
  color: rgba(255, 255, 255, 0.4);
}
.zhino-info-value {
  color: rgba(255, 255, 255, 0.8);
  font-family: monospace;
  font-size: 11px;
}

.zhino-warning {
  margin-top: 6px;
  padding: 6px 8px;
  background: rgba(251, 191, 36, 0.08);
  border: 1px solid rgba(251, 191, 36, 0.2);
  border-radius: 4px;
  font-size: 11px;
  color: rgba(251, 191, 36, 0.9);
}


.zhino-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.zhino-empty-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);
}

.zhino-add-persona {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

.zhino-persona-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}
.zhino-persona-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
  cursor: pointer;
  transition: all 0.15s;
}
.zhino-persona-item:hover {
  background: rgba(167, 139, 250, 0.06);
  border-color: rgba(167, 139, 250, 0.15);
}
.zhino-persona-item.active {
  background: rgba(167, 139, 250, 0.12);
  border-color: rgba(167, 139, 250, 0.3);
}
.zhino-persona-item-left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.zhino-persona-name {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.zhino-persona-badge {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 8px;
  background: rgba(167, 139, 250, 0.2);
  color: rgba(167, 139, 250, 0.9);
  flex-shrink: 0;
}
.zhino-persona-item-right {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.zhino-persona-edit-header {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.zhino-btn-xs {
  padding: 2px 6px;
  font-size: 10px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all 0.15s;
}
.zhino-btn-xs:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.8);
}
.zhino-btn-xs.zhino-btn-danger {
  border-color: rgba(248, 113, 113, 0.2);
  color: rgba(248, 113, 113, 0.7);
}
.zhino-btn-xs.zhino-btn-danger:hover {
  background: rgba(248, 113, 113, 0.1);
}

.zhino-input-inline {
  width: auto;
  max-width: 120px;
  padding: 2px 6px;
  font-size: 11px;
}

.zhino-api-field {
  margin-top: 6px;
}
.zhino-model-row {
  display: flex;
  gap: 6px;
  align-items: center;
}
.zhino-model-select {
  flex: 1;
  min-width: 0;
}
.zhino-api-result {
  margin-top: 6px;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 1.5;
}
.zhino-api-result.ok {
  background: rgba(52, 211, 153, 0.08);
  border: 1px solid rgba(52, 211, 153, 0.2);
  color: rgba(52, 211, 153, 0.9);
}
.zhino-api-result.fail {
  background: rgba(248, 113, 113, 0.08);
  border: 1px solid rgba(248, 113, 113, 0.2);
  color: rgba(248, 113, 113, 0.9);
}

.zhino-api-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(167, 139, 250, 0.15);
  color: rgba(167, 139, 250, 0.85);
  flex-shrink: 0;
}

.zhino-api-warn {
  margin-top: 6px;
  padding: 6px 8px;
  background: rgba(251, 191, 36, 0.08);
  border: 1px solid rgba(251, 191, 36, 0.2);
  border-radius: 4px;
  font-size: 11px;
  color: rgba(251, 191, 36, 0.85);
  line-height: 1.5;
}

.zhino-ignored-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
}
.zhino-ignored-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 4px;
  background: rgba(248, 113, 113, 0.08);
  border: 1px solid rgba(248, 113, 113, 0.15);
  color: rgba(255, 255, 255, 0.55);
  font-size: 11px;
}
.zhino-ignored-restore {
  background: none;
  border: none;
  color: rgba(52, 211, 153, 0.6);
  cursor: pointer;
  font-size: 11px;
  padding: 0 2px;
  transition: color 0.15s;
}
.zhino-ignored-restore:hover {
  color: rgba(52, 211, 153, 0.9);
}
.zhino-ignored-hint {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.25);
}

/* ===== API 监听器 ===== */
.zhino-api-monitor-desc {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
  margin-top: 4px;
}
.zhino-monitor-overlay {
  position: absolute;
  inset: 0;
  z-index: 20000;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
}
.zhino-monitor-modal {
  width: 90%;
  max-width: 700px;
  max-height: 85%;
  background: #080812;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.zhino-monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}
.zhino-monitor-title {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}
.zhino-monitor-close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  font-size: 18px;
  cursor: pointer;
  padding: 2px 6px;
}
.zhino-monitor-close:hover { color: rgba(255, 255, 255, 0.8); }
.zhino-monitor-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
  overflow-x: auto;
}
.zhino-monitor-tab {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  padding: 6px 12px;
  font-size: 11px;
  text-align: center;
  white-space: nowrap;
  transition: all 0.15s;
}
.zhino-monitor-tab:hover { color: rgba(255, 255, 255, 0.7); }
.zhino-monitor-tab.active {
  background: rgba(52, 211, 153, 0.12);
  border-color: rgba(52, 211, 153, 0.3);
  color: rgba(52, 211, 153, 0.9);
}
.zhino-monitor-tab-sub {
  display: block;
  font-size: 9px;
  opacity: 0.6;
  margin-top: 2px;
}
.zhino-monitor-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.zhino-monitor-meta {
  display: flex;
  gap: 20px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
}
.zhino-monitor-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.zhino-monitor-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 500;
}
.zhino-monitor-pre {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  padding: 10px;
  font-size: 11px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.7);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 300px;
  overflow-y: auto;
  margin: 0;
  font-family: inherit;
}
.zhino-monitor-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding: 10px 16px;
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

/* ─── 选择性删除面板 ─── */
.zhino-delete-panel {
  margin-top: 10px;
  padding: 10px 12px;
  background: rgba(255, 80, 60, 0.04);
  border: 1px solid rgba(255, 80, 60, 0.15);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.zhino-delete-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px;
}

.zhino-delete-title {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
}

.zhino-delete-select-all {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.zhino-delete-select-all input {
  accent-color: #f5a623;
}

.zhino-delete-row {
  padding: 4px 0;
}

.zhino-delete-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 12px;
}

.zhino-delete-label input {
  accent-color: #f5a623;
  flex-shrink: 0;
}

.zhino-delete-block-name {
  color: rgba(255, 255, 255, 0.85);
  font-weight: 600;
  min-width: 48px;
}

.zhino-delete-block-desc {
  color: rgba(255, 255, 255, 0.35);
  font-size: 10.5px;
}

.zhino-delete-block-count {
  color: rgba(255, 255, 255, 0.4);
  font-size: 10.5px;
  margin-left: auto;
}

.zhino-delete-confirm {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 6px;
}

.zhino-delete-confirm-text {
  font-size: 11px;
  color: rgba(255, 150, 120, 0.7);
}

.zhino-delete-msg {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
}

.zhino-delete-msg.ok {
  color: rgba(100, 220, 150, 0.8);
  background: rgba(100, 220, 150, 0.06);
}

.zhino-delete-msg.fail {
  color: rgba(255, 150, 120, 0.8);
  background: rgba(255, 150, 120, 0.06);
}
</style>
