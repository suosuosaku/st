/* eslint-disable import-x/no-cycle */
import { klona } from 'klona';
import type { DreamtalkData } from '../core/dreamtalk';
import type { EcosystemState } from '../core/ecosystem';
import type { DynamicProfileV2 } from '../core/dynamicProfileV2';
import type { ItemMemory } from '../core/itemMemory';
import { removeItemHistoryByVersion } from '../core/itemMemory';
import type { WorldProgressRecord } from '../core/worldProgress';
import type { PlotOutline, PlotCheckResult } from '../core/plotDirector';
import type {
  CangxuanWorldbookEnableBackup,
  CangxuanWorldbookInjectionReport,
  CangxuanWorldbookScan,
} from '../core/cangxuanWorldbookScheduler';
import { CANGXUAN_DEFAULT_ALWAYS_NAMES, CANGXUAN_DEFAULT_SCHEDULED_NAMES } from '../core/cangxuanWorldbookScheduler';
import { charBigramSimilarity, cosineSimilarity } from '../core/embedding';

import { getCapturedContentMessageIds, getHiddenFloorsFromChat, type HiddenFloor } from '../core/floorVisibility';
import type { NsfwCharacterMemory, NsfwDreamtalkData, NsfwDynamicProfile } from '../core/nsfwIsolation';

import { buildMemorySectionText, parseSummaryOutput, type ParsedSummary } from '../core/summary';
import { extractContentFromMessage } from '../utils/messageParser';

// ========== 数据类型定义 ==========

export interface UserPersona {
  id: string;
  name: string;
  rawInput: string;
  analyzedProfile: string;
  lastAnalyzedAt: string;
}

export interface CapturedContent {
  messageId: number;
  content: string;
  capturedAt: string;
  swipeCount: number;
}

/** 单条核心记忆（支持语义向量） */
export interface CoreMemoryItem {
  text: string;
  embedding?: number[];
  /** 剧情时间（从 AI 输出的 [日期] 前缀提取） */
  time?: string;
}

export interface CharacterMemory {
  characterName: string;
  aliases: string[];
  attitude: 'like' | 'dislike' | 'neutral';
  coreMemories: CoreMemoryItem[]; // 核心记忆（远期语义召回，近期完整注入）
  recentMemories: string[]; // 近期记忆（本轮新生成的，每次总结替换）
  keywords: string[];
  /** 每角色语义召回上限（默认取全局 memoryRecallLimit） */
  recallLimit?: number;
  /** 每角色召回开关（false=关闭语义召回，远期核心完整注入。重要角色可设为false） */
  recallEnabled?: boolean;
  /** AI 原始编号顺序（展示用，非持久），如 [{text:"...", isCore:true, time:"..."}, ...] */
  orderedNewMemories?: Array<{ text: string; isCore: boolean; time?: string }>;
}

export interface TimelineEventTrigger {
  characters: string[]; // 触发角色名
  keywords: string[]; // 触发关键词（地名/物品/事件名/话题）
}

export interface TimelineEvent {
  time: string;
  event: string; // 速览（常驻注入用）
  detail?: string; // 完整详情
  triggers?: TimelineEventTrigger; // AI 生成的激活条件
  summaryVersion?: number; // 来源大总结版本号
  importance?: number; // AI 标注的事件重要性 1-5
  embedding?: number[]; // 语义向量（大总结后批量生成，用于语义召回兜底）
}

export interface CharacterEntry {
  name: string;
  aliases: string[];
  identity: string;
  relationship: string;
  status: string;
}

export interface DynamicProfile {
  characterName: string;
  dynamicContent: string;
  lastUpdatedAt: string;
  basedOnSummaryVersion: number;
}

export interface GrandSummary {
  version: number;
  generatedAt: string;
  upToMessageId?: number;
  coveredMessageIds?: number[];
  characterMemories: CharacterMemory[];
  timeline: TimelineEvent[];
  characterTable: CharacterEntry[];
  rawText: string;
}

export interface RelationshipProfile {
  id: string;
  from: string;
  to: string;
  fromName: string;
  toName: string;
  kind: 'user-character' | 'character-character';
  relationType: string;
  origin: string;
  currentState: string;
  tension: string;
  futureTrigger: string;
  evidence: string[];
  memoryBias: string[];
  misreadWarnings: string[];
  confidence: '高' | '中' | '低' | string;
  worldbook: {
    fromFound: boolean;
    toFound: boolean;
    entryNames: string[];
  };
  basedOnSummaryVersion: number;
  lastAnalyzedAt: string;
  rawText?: string;
}

export interface SmallSummaryRecord {
  id: string;
  floorRange: { start: number; end: number };
  status: 'pending' | 'ready' | 'failed' | 'hidden-active' | 'absorbed' | 'ignored';
  generatedAt?: string;
  modelUsed?: string;
  storyTime?: string;
  location?: string;
  mainEvent?: string;
  facts: string[];
  presentCharacters: string[];
  rawJson?: string;
  error?: string;
}

export interface UserInputRecord {
  messageId: number;
  userInput: string;
  aiResponse: string;
  rolledResponses: string[];
}

// ========== 存储拆分：聊天变量（每个聊天独立） ==========

export interface ChatData {
  chatId: string;
  capturedContents: CapturedContent[];
  userInputRecords: UserInputRecord[];
  summaries: GrandSummary[];
  summaryHistory: GrandSummary[];
  dynamicProfiles: DynamicProfile[];
  dreamtalk: DreamtalkData | null;
  dreamtalkHistory: DreamtalkData[];
  dreamtalkUndoHistory: DreamtalkData[];
  lastSummaryAtMessageId: number;
  // NSFW隔离层
  nsfwMemories: NsfwCharacterMemory[];
  nsfwDreamtalk: NsfwDreamtalkData | null;
  nsfwDynamicProfiles: NsfwDynamicProfile[];
  // 倒果为因（已废弃，保留字段兼容旧数据）
  plotFate: any;

  // 后台行动推演
  ecosystemState: EcosystemState | null;
  ecosystemManualChars: string; // 手动指定推演角色，逗号分隔（跟随聊天保存）
  // 关系档案（手动分析生成，不修改记忆）
  relationshipProfiles: RelationshipProfile[];
  // 剧情日期格式记忆（首次总结时从AI输出中提取，后续总结传给AI参考）
  storyDateFormat: string;
  // 已忽略角色（用户手动删除的路人NPC，后续总结不再生成）
  ignoredCharacters: string[];
  // 忽略角色的数据备份（恢复时还原，避免角色消失）
  _ignoredBackup: Array<{
    name: string;
    memories: CharacterMemory[];
    profile: DynamicProfile | null;
  }>;
  // 小总结记录
  smallSummaries: SmallSummaryRecord[];
  // 物品记忆库
  itemMemories: ItemMemory[];
  // 动态人设V2
  dynamicProfilesV2: DynamicProfileV2[];
  // 动态人设V2独立触发追踪
  lastDynamicProfileFloor: number;
  pendingDynamicProfile: boolean;
  // 世界推进记录
  worldProgressRecords: WorldProgressRecord[];
  lastWorldProgressFloor: number;
  // 剧情导演
  plotOutline: PlotOutline | null;
  lastPlotCheckFloor: number;
  lastPlotCheckResult: PlotCheckResult | null;
  // 是否已迁移为增量存储（false=旧格式全量快照，true=增量delta）
  _summaryDeltaFormat: boolean;
  // 时间线手动编辑覆盖（key = `${time}|${event.slice(0,30)}`）
  timelineOverrides: Record<string, TimelineEvent & { _deleted?: boolean }>;
  // 世界书条目（供剧情导演等模块引用）
  worldBookEntries: Array<{ key: string; content: string; insertionOrder: number }>;
  // 剧情导演勾选的世界书条目key列表
  selectedWorldBookKeys: string[];
  // 世界推进勾选的世界书条目key列表（独立于剧情导演）
  worldProgressWorldBookKeys: string[];
  // 苍玄界专属世界书调度
  cangxuanWorldbookScan: CangxuanWorldbookScan | null;
  cangxuanWorldbookLastInjection: CangxuanWorldbookInjectionReport | null;
  cangxuanWorldbookEnableBackups: CangxuanWorldbookEnableBackup[];
}

// ========== 存储拆分：脚本变量（全局共享） ==========

export interface ScriptSettings {
  personas: UserPersona[];
  activePersonaId: string;
  settings: {
    personaEnabled: boolean;
    dynamicProfileEnabled: boolean;
    captureEnabled: boolean;
    memoryActivationEnabled: boolean;
    dreamtalkEnabled: boolean;
    summaryInjectionEnabled: boolean;
    itemRecallEnabled: boolean;
    summaryInterval: number;
    eventRecallRecent: number; // 自动注入最近 N 轮总结的已完成事件
    eventRecallLimit: number; // 远期事件召回上限（条数）
    preserveRecentFloors: number;
    memoryMinPerChar: number;
    memoryMaxPerChar: number;
    recentMemoryVersions: number;
    memoryRecallLimit: number; // 每角色语义召回上限（条数，默认10）
    // 后台行动推演
    ecosystemEnabled: boolean;
    ecosystemInterval: number;
    // 世界推进（替代旧 ecosystem 的注入模式）
    worldProgressEnabled: boolean;
    worldProgressInterval: number;
    // 剧情导演
    plotDirectorEnabled: boolean;
    plotCheckInterval: number;
    plotDirectorSummaryCount: number; // 大纲对话时注入最近N轮大总结
    plotDirectorSummaryMode: string; // 'detail' | 'overview'
    plotDirectorSpoilerMode: boolean; // 防剧透模式
    // 事实信息强调
    factEmphasisEnabled: boolean;
    // 大总结引导弹窗
    summaryGuidanceEnabled: boolean;
    // 梦呓
    preferredPlayStyle: string; // ''=自动判定, '不抢话'|'抢话'|'混合'
    // 界面
    fontSize: number;
    // 自定义API
    apiMode: string;
    customApiUrl: string;
    customApiKey: string;
    customApiModel: string;
    // API 监听器（调试用，默认关闭）
    apiMonitorEnabled: boolean;
    // 关系档案注入（手动分析后自动注入，默认开启）
    relationshipInjectionEnabled: boolean;
    // 语义向量召回
    embeddingEnabled: boolean;
    embeddingApiUrl: string;
    embeddingApiKey: string;
    embeddingModel: string;
    embeddingDimensions: number;
    embeddingSimilarityThreshold: number;
    /** 混合检索权重（0-1，语义 vs 词汇匹配，默认0.7=偏语义） */
    hybridWeight: number;
    // 时间衰减
    timeDecayEnabled: boolean;
    timeDecayRate: number;
    timeDecayBoost: number;
    // 两阶段重排
    rerankEnabled: boolean;
    rerankModel: string;
    rerankCandidateMultiplier: number;
    // 苍玄界专属世界书调度
    cangxuanWorldbookSchedulerEnabled: boolean;
    cangxuanWorldbookAutoInjectEnabled: boolean;
    cangxuanWorldbookAlwaysNames: string;
    cangxuanWorldbookScheduledNames: string;
    cangxuanWorldbookKeepEnabledNames: string;
    cangxuanWorldbookMaxEntries: number;
    cangxuanWorldbookMaxChars: number;
  };
}

// ========== Zod Schema ==========

const ChatDataSchema = z
  .object({
    chatId: z.string().prefault(''),
    capturedContents: z.array(z.any()).prefault([]),
    userInputRecords: z.array(z.any()).prefault([]),
    summaries: z.array(z.any()).prefault([]),
    summaryHistory: z.array(z.any()).prefault([]),
    dynamicProfiles: z.array(z.any()).prefault([]),
    dreamtalk: z.any().prefault(null),
    dreamtalkHistory: z.array(z.any()).prefault([]),
    dreamtalkUndoHistory: z.array(z.any()).prefault([]),
    lastSummaryAtMessageId: z.coerce.number().prefault(-1),
    // NSFW隔离层
    nsfwMemories: z.array(z.any()).prefault([]),
    nsfwDreamtalk: z.any().prefault(null),
    nsfwDynamicProfiles: z.array(z.any()).prefault([]),
    // 倒果为因
    plotFate: z.any().prefault(null),

    // 后台行动推演
    ecosystemState: z.any().prefault(null),
    ecosystemManualChars: z.string().prefault(''),
    // 关系档案
    relationshipProfiles: z.array(z.any()).prefault([]),
    // 剧情日期格式
    storyDateFormat: z.string().prefault(''),
    // 已忽略角色
    ignoredCharacters: z.array(z.string()).prefault([]),
    // 忽略角色数据备份
    _ignoredBackup: z
      .array(
        z.object({
          name: z.string(),
          memories: z.array(z.any()),
          profile: z.any().nullable(),
        }),
      )
      .prefault([]),
    // 小总结记录
    smallSummaries: z.array(z.any()).prefault([]),
    // 物品记忆库
    itemMemories: z.array(z.any()).prefault([]),
    // 动态人设V2
    dynamicProfilesV2: z.array(z.any()).prefault([]),
    lastDynamicProfileFloor: z.coerce.number().prefault(0),
    pendingDynamicProfile: z.boolean().prefault(false),
    // 世界推进记录
    worldProgressRecords: z.array(z.any()).prefault([]),
    lastWorldProgressFloor: z.coerce.number().prefault(-1),
    // 剧情导演
    plotOutline: z.any().prefault(null),
    lastPlotCheckFloor: z.coerce.number().prefault(-1),
    lastPlotCheckResult: z.any().prefault(null),
    // 增量存储标记
    _summaryDeltaFormat: z.boolean().prefault(false),
    // 时间线手动编辑覆盖
    timelineOverrides: z.record(z.any()).prefault({}),
    // 世界书条目 + 选择
    worldBookEntries: z.array(z.object({ key: z.string(), content: z.string(), insertionOrder: z.number().optional().default(0) })).prefault([]),
    selectedWorldBookKeys: z.array(z.string()).prefault([]),
    worldProgressWorldBookKeys: z.array(z.string()).prefault([]),
    cangxuanWorldbookScan: z.any().prefault(null),
    cangxuanWorldbookLastInjection: z.any().prefault(null),
    cangxuanWorldbookEnableBackups: z.array(z.any()).prefault([]),
  })
  .prefault({});

const ScriptSettingsSchema = z
  .object({
    personas: z
      .array(
        z.object({
          id: z.string().prefault(''),
          name: z.string().prefault(''),
          rawInput: z.string().prefault(''),
          analyzedProfile: z.string().prefault(''),
          lastAnalyzedAt: z.string().prefault(''),
        }),
      )
      .prefault([]),
    activePersonaId: z.string().prefault(''),
    settings: z
      .object({
        personaEnabled: z.boolean().prefault(true),
        dynamicProfileEnabled: z.boolean().prefault(true),
        dynamicProfileInterval: z.coerce.number().prefault(2),
        captureEnabled: z.boolean().prefault(true),
        memoryActivationEnabled: z.boolean().prefault(true),
        dreamtalkEnabled: z.boolean().prefault(true),
        summaryInjectionEnabled: z.boolean().prefault(true),
        itemRecallEnabled: z.boolean().prefault(true),
        summaryInterval: z.coerce.number().prefault(10),
        eventRecallRecent: z.coerce.number().prefault(2),
        eventRecallLimit: z.coerce.number().prefault(15),
        preserveRecentFloors: z.coerce.number().prefault(4),
        memoryMinPerChar: z.coerce.number().prefault(4),
        memoryMaxPerChar: z.coerce.number().prefault(8),
        recentMemoryVersions: z.coerce.number().prefault(3),
        memoryRecallLimit: z.coerce.number().prefault(10),
        // 后台行动推演
        ecosystemEnabled: z.boolean().prefault(false),
        ecosystemInterval: z.coerce.number().prefault(3),
        // 世界推进
        worldProgressEnabled: z.boolean().prefault(false),
        worldProgressInterval: z.coerce.number().prefault(2),
        // 剧情导演
        plotDirectorEnabled: z.boolean().prefault(false),
        plotCheckInterval: z.coerce.number().prefault(5),
        plotDirectorSummaryCount: z.coerce.number().prefault(1),
        plotDirectorSummaryMode: z.string().prefault('overview'),
        plotDirectorSpoilerMode: z.boolean().prefault(false),
        // 事实信息强调
        factEmphasisEnabled: z.boolean().prefault(false),
        // 大总结引导弹窗
        summaryGuidanceEnabled: z.boolean().prefault(true),
        // 梦呓
        preferredPlayStyle: z.string().prefault(''),
        // 界面
        fontSize: z.coerce.number().prefault(1),
        colorTheme: z.string().prefault('cool'), // 'cool'=冷色调(默认), 'warm'=暖色调
        // 自定义API
        apiMode: z.string().prefault('custom'),
        customApiUrl: z.string().prefault(''),
        customApiKey: z.string().prefault(''),
        customApiModel: z.string().prefault(''),
        apiMonitorEnabled: z.boolean().prefault(false),
        relationshipInjectionEnabled: z.boolean().prefault(true),
        // 语义向量召回
        embeddingEnabled: z.boolean().prefault(false),
        embeddingApiUrl: z.string().prefault('https://api.siliconflow.cn/v1/embeddings'),
        embeddingApiKey: z.string().prefault(''),
        embeddingModel: z.string().prefault('BAAI/bge-m3'),
        embeddingDimensions: z.coerce.number().prefault(768),
        embeddingSimilarityThreshold: z.coerce.number().prefault(0.55),
        hybridWeight: z.coerce.number().prefault(0.7),
        // 时间衰减
        timeDecayEnabled: z.boolean().prefault(true),
        timeDecayRate: z.coerce.number().prefault(0.05),
        timeDecayBoost: z.coerce.number().prefault(0.3),
        // 两阶段重排
        rerankEnabled: z.boolean().prefault(false),
        rerankModel: z.string().prefault('BAAI/bge-reranker-v2-m3'),
        rerankCandidateMultiplier: z.coerce.number().prefault(3),
        // 苍玄界专属世界书调度
        cangxuanWorldbookSchedulerEnabled: z.boolean().prefault(true),
        cangxuanWorldbookAutoInjectEnabled: z.boolean().prefault(true),
        cangxuanWorldbookAlwaysNames: z.string().prefault(CANGXUAN_DEFAULT_ALWAYS_NAMES),
        cangxuanWorldbookScheduledNames: z.string().prefault(CANGXUAN_DEFAULT_SCHEDULED_NAMES),
        cangxuanWorldbookKeepEnabledNames: z.string().prefault(''),
        cangxuanWorldbookMaxEntries: z.coerce.number().prefault(12),
        cangxuanWorldbookMaxChars: z.coerce.number().prefault(16000),
        // 小总结独立API（廉价模型，如DS）
        smallSummaryApiEnabled: z.boolean().prefault(false),
        smallSummaryApiUrl: z.string().prefault(''),
        smallSummaryApiKey: z.string().prefault(''),
        smallSummaryApiModel: z.string().prefault(''),
        smallSummaryApiFormat: z.string().prefault('openai'), // 'openai' | 'deepseek'
      })
      .prefault({}),
  })
  .prefault({});

// ========== Store ==========

/**
 * 旧格式迁移：旧版直接存储扁平 ChatData 对象（无 chatId 字段），
 * 返回 ChatData 对象供调用方以当前 chatId 为 key 存入 Record。
 */
function migrateOldFormatToChatData(oldData: Record<string, unknown>): ChatData {
  console.info('[智脑] 检测到旧格式聊天数据，正在迁移...');
  return ChatDataSchema.parse(oldData);
}

const CHAT_DATA_KEY = 'cxzn_chat_data';
const SETTINGS_KEY = 'cxzn_settings';
/** 跨版本恢复用的稳定ID，不依赖 getScriptId() */
const STABLE_ID = 'cxzn-script-data';
/** localStorage key for global settings */
const SETTINGS_LOCAL_KEY = 'cxzn_global_settings';

function loadSettingsFromLocal(): any | null {
  try {
    // 优先访问父页面（SillyTavern）的 localStorage；同域直接可用，跨域时抛 SecurityError
    const storage = (window.parent || window).localStorage;
    const raw = storage.getItem(SETTINGS_LOCAL_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('[智脑] 加载全局设置 (localStorage) 失败:', e);
  }
  return null;
}

function saveSettingsToLocal(data: any): void {
  try {
    const storage = (window.parent || window).localStorage;
    storage.setItem(SETTINGS_LOCAL_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[智脑] 保存全局设置 (localStorage) 失败:', e);
  }
}

function tryReadData(currentScriptId: string): { chatData: any; settings: any; migrated: boolean } {
  const primaryChat = getVariables({ type: 'chat' });
  const primaryScript = getVariables({ type: 'script', script_id: currentScriptId }) ?? {};

  // settings 加载优先级：localStorage > script变量 > 空
  let settings: any = null;
  const localSettings = loadSettingsFromLocal();
  if (localSettings) {
    settings = localSettings;
    console.info('[智脑] 从 localStorage 加载全局设置');
  } else if (primaryScript && Object.keys(primaryScript).length > 0) {
    settings = primaryScript;
  }

  if (!settings) {
    settings = {};
  }

  const hasChat = primaryChat && Object.keys(primaryChat).length > 0;
  const hasScriptSettings = settings && Object.keys(settings).length > 0;

  if (hasChat) {
    console.info(`[智脑] 从主存储加载聊天数据 (${Object.keys(primaryChat).length} 个聊天)`);
    return { chatData: primaryChat, settings, migrated: !hasScriptSettings };
  }

  // ⭐ type:'chat' 为空 → 优先尝试跨版本备份（STABLE_ID）
  // 修复 m3 遗留问题：之前当 hasScriptSettings=true 时直接返回 {}，跳过备份导致数据丢失
  const stable = getVariables({ type: 'script', script_id: STABLE_ID }) ?? {};
  if (stable[CHAT_DATA_KEY]) {
    console.info('[智脑] 主存储为空，从跨版本备份恢复聊天数据');
    const restoredChatData = stable[CHAT_DATA_KEY];
    const chatCount = typeof restoredChatData === 'object' ? Object.keys(restoredChatData).length : 0;
    console.info(`[智脑] 备份恢复完成 (${chatCount} 个聊天)`);
    return {
      chatData: restoredChatData,
      settings: hasScriptSettings ? settings : (stable[SETTINGS_KEY] ?? {}),
      migrated: true,
    };
  }

  if (hasScriptSettings) {
    console.info('[智脑] 主存储和备份均为空，使用空聊天数据');
    return { chatData: {}, settings, migrated: false };
  }

  // 兜底：即使用旧格式（有 personas 无 CHAT_DATA_KEY）也尝试恢复
  if (stable.personas && stable.personas.length > 0) {
    console.info('[智脑] 从旧格式跨版本备份恢复数据...');
    return {
      chatData: stable[CHAT_DATA_KEY] ?? {},
      settings: stable[SETTINGS_KEY] ?? stable,
      migrated: true,
    };
  }

  return { chatData: {}, settings: {}, migrated: false };
}

export const useMainStore = defineStore('main', () => {
  const currentScriptId = getScriptId();
  const currentChatId = SillyTavern.getCurrentChatId();

  // ========== 数据加载（主存储 → 跨版本备份回退） ==========
  const { chatData: rawChatData, settings: rawSettings, migrated: migratedFromOld } = tryReadData(currentScriptId);

  // 旧格式迁移：旧版直接存扁平 ChatData，新版存 Record<chatId, ChatData>
  const needsMigration =
    rawChatData && (rawChatData.summaries !== undefined || rawChatData.capturedContents !== undefined);

  const allChatsData = ref<Record<string, ChatData>>(
    needsMigration ? { [currentChatId]: migrateOldFormatToChatData(rawChatData) } : (rawChatData ?? {}),
  );

  const scriptData = ref<ScriptSettings>(ScriptSettingsSchema.parse(rawSettings ?? {}));

  // 迁移后立即写回，并同步到跨版本备份
  if (migratedFromOld || needsMigration) {
    replaceVariables(klona(allChatsData.value), { type: 'chat' });
    saveSettingsToLocal(scriptData.value);
    replaceVariables(klona(scriptData.value), { type: 'script', script_id: currentScriptId });
    // 同步备份
    const backup = {
      [CHAT_DATA_KEY]: klona(allChatsData.value),
      [SETTINGS_KEY]: klona(scriptData.value),
    };
    replaceVariables(backup, { type: 'script', script_id: STABLE_ID });
    console.info('[智脑] 数据已写回并同步跨版本备份');
  }

  // 从 allChatsData 中提取当前聊天的数据（不存在则初始化）
  const parsedChat = allChatsData.value[currentChatId]
    ? ChatDataSchema.parse(allChatsData.value[currentChatId])
    : ChatDataSchema.parse({});
  const chatData = ref<ChatData>(parsedChat);

  // ⭐ 二级安全网：当前聊天在主存储中缺失，从跨版本备份恢复
  if (!allChatsData.value[currentChatId]) {
    const stableRecovery = getVariables({ type: 'script', script_id: STABLE_ID }) ?? {};
    const backupChatData = stableRecovery[CHAT_DATA_KEY]?.[currentChatId];
    if (backupChatData) {
      console.info('[智脑] 当前聊天在主存储中缺失，从跨版本备份恢复');
      const parsed = ChatDataSchema.parse(backupChatData);
      chatData.value = parsed;
      allChatsData.value[currentChatId] = parsed;
      // 回写到主存储，下次加载时不需要再次恢复
      replaceVariables(klona(allChatsData.value), { type: 'chat' });
    }
  }

  // 首次初始化时记录当前聊天ID
  if (!chatData.value.chatId) {
    chatData.value.chatId = currentChatId;
  }

  // 梦呓 v1 → v2 迁移：检测旧格式（有 generalBehaviors 字段），自动丢弃
  if (chatData.value.dreamtalk && (chatData.value.dreamtalk as any).generalBehaviors !== undefined) {
    console.info('[智脑] 检测到梦呓 v1 旧格式，已自动迁移为 v2（下次大总结时重新分析）');
    chatData.value.dreamtalk = null;
  }

  // 梦呓 v2 补字段：旧 v2 数据不含 userInfo/personality，补默认值
  if (chatData.value.dreamtalk && !chatData.value.dreamtalk.userInfo) {
    (chatData.value.dreamtalk as any).userInfo = { basic: '', appearance: '', background: '', relationship: '' };
    (chatData.value.dreamtalk as any).personality = null;
  }

  // 梦呓 v2.1 → v2 条目格式迁移：旧格式 patterns/prevent → 新格式 entries
  if (chatData.value.dreamtalk) {
    let migrated = false;
    const dt = chatData.value.dreamtalk as any;

    // bodyContact: { patterns, prevent } → { entries }
    if (dt.bodyContact && Array.isArray(dt.bodyContact.patterns) && !dt.bodyContact.entries) {
      const prevent = dt.bodyContact.prevent || '';
      dt.bodyContact = { entries: dt.bodyContact.patterns.map((t: string) => ({ text: t, prevent })) };
      migrated = true;
    }
    // speechStyle: { patterns, prevent } → { entries }
    if (dt.speechStyle && Array.isArray(dt.speechStyle.patterns) && !dt.speechStyle.entries) {
      const prevent = dt.speechStyle.prevent || '';
      dt.speechStyle = { entries: dt.speechStyle.patterns.map((t: string) => ({ text: t, prevent })) };
      migrated = true;
    }
    // characterInteractions: { behaviors, prevent } → { entries }
    if (Array.isArray(dt.characterInteractions)) {
      for (let i = 0; i < dt.characterInteractions.length; i++) {
        const ci = dt.characterInteractions[i];
        if (Array.isArray(ci.behaviors) && !ci.entries) {
          const prevent = ci.prevent || '';
          ci.entries = ci.behaviors.map((t: string) => ({ text: t, prevent }));
          delete ci.behaviors;
          delete ci.prevent;
          migrated = true;
        }
      }
    }

    if (migrated) {
      console.info('[智脑] 梦呓 v2 旧条目格式已迁移为 v2.1 entries 格式');
    }
  }

  // ========== 运行状态（不持久化，脚本重载后重置） ==========

  const summaryInProgress = ref(false);
  const dreamtalkInProgress = ref(false);
  const _isRealChatMessage = ref(false); // MESSAGE_SENT 触发才为 true，generateRaw 分析请求不会触发
  const _isBackgroundCall = ref(false); // generateRaw 调用期间为 true，阻止 CHAT_COMPLETION_SETTINGS_READY 误注入
  // native generateRaw 的单次消费标记：调用前+1，处理器消费时-1。带超时自动清除防 stuck。
  let _bgNativeCallPending = false;
  let _bgNativeCallTimer: ReturnType<typeof setTimeout> | null = null;
  function markBgNativeCall(): void {
    _bgNativeCallPending = true;
    if (_bgNativeCallTimer) clearTimeout(_bgNativeCallTimer);
    _bgNativeCallTimer = setTimeout(() => {
      _bgNativeCallPending = false;
      _bgNativeCallTimer = null;
      console.warn('[智脑-注入守护] ⚠️ native标记超时自动清除（generateRaw可能失败未触发事件）');
    }, 15000);
  }
  function consumeBgNativeCall(): boolean {
    if (!_bgNativeCallPending) return false;
    _bgNativeCallPending = false;
    if (_bgNativeCallTimer) {
      clearTimeout(_bgNativeCallTimer);
      _bgNativeCallTimer = null;
    }
    return true;
  }

  // API 监听器日志（运行时，不持久化，最多5条）
  interface ApiMonitorEntry {
    timestamp: string;
    analysisName: string;
    model: string;
    messages: Array<{ role: string; content: string }>;
    response: string;
    durationMs: number;
  }
  const apiMonitorLogs = ref<ApiMonitorEntry[]>([]);
  function pushApiMonitorLog(entry: ApiMonitorEntry) {
    const logs = apiMonitorLogs.value;
    logs.unshift(entry);
    if (logs.length > 5) logs.pop();
    // 触发响应式更新
    apiMonitorLogs.value = [...logs];
  }
  function clearApiMonitorLogs() {
    apiMonitorLogs.value = [];
  }

  // 关系档案分析状态（运行时，不持久化，切tab不丢失）
  const relAnalyzing = ref(false);
  const relStatus = ref('');
  const relError = ref('');
  const relSelectedNodeId = ref<string>('__zhino_user__');
  const relSelectedEdgeId = ref<string>('');

  function setSummaryInProgress(v: boolean) {
    summaryInProgress.value = v;
  }
  function setDreamtalkInProgress(v: boolean) {
    dreamtalkInProgress.value = v;
  }

  // 自动保存（同步落盘，即时持久化）
  // - 聊天数据 → type:'chat'（持久化可靠，per-chat）
  // - 全局设置 → localStorage（持久化可靠，全局共享）
  // - script 变量仅作辅助副本（刷新后丢失）
  function doPersist() {
    allChatsData.value[currentChatId] = klona(chatData.value);
    replaceVariables(klona(allChatsData.value), { type: 'chat' });
    saveSettingsToLocal(scriptData.value);
    replaceVariables(klona(scriptData.value), { type: 'script', script_id: currentScriptId });
    const backup = {
      [CHAT_DATA_KEY]: klona(allChatsData.value),
      [SETTINGS_KEY]: klona(scriptData.value),
    };
    replaceVariables(backup, { type: 'script', script_id: STABLE_ID });
  }

  // ========== 便捷访问器 ==========

  const personas = computed(() => scriptData.value.personas);
  const activePersonaId = computed(() => scriptData.value.activePersonaId);
  const persona = computed(() => {
    const active = scriptData.value.personas.find(p => p.id === scriptData.value.activePersonaId);
    return active ?? { id: '', name: '', rawInput: '', analyzedProfile: '', lastAnalyzedAt: '' };
  });
  const settings = computed(() => scriptData.value.settings);
  const capturedContents = computed(() => chatData.value.capturedContents);
  const summaries = computed(() => chatData.value.summaries);
  const dynamicProfiles = computed(() => chatData.value.dynamicProfiles);
  const dreamtalk = computed(() => chatData.value.dreamtalk);
  const userInputRecords = computed(() => chatData.value.userInputRecords);
  const lastSummaryAtMessageId = computed(() => chatData.value.lastSummaryAtMessageId);
  const storyDateFormat = computed({
    get: () => chatData.value.storyDateFormat,
    set: (val: string) => {
      chatData.value.storyDateFormat = val;
    },
  });

  // ========== 用户人格相关 ==========

  function addPersona(name: string): string {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    scriptData.value.personas.push({ id, name, rawInput: '', analyzedProfile: '', lastAnalyzedAt: '' });
    if (!scriptData.value.activePersonaId) {
      scriptData.value.activePersonaId = id;
    }
    return id;
  }

  function removePersona(id: string) {
    scriptData.value.personas = scriptData.value.personas.filter(p => p.id !== id);
    if (scriptData.value.activePersonaId === id) {
      scriptData.value.activePersonaId = scriptData.value.personas[0]?.id ?? '';
    }
  }

  function setActivePersona(id: string) {
    scriptData.value.activePersonaId = id;
  }

  function updatePersonaRaw(rawInput: string) {
    const idx = scriptData.value.personas.findIndex(x => x.id === scriptData.value.activePersonaId);
    if (idx !== -1) {
      scriptData.value.personas[idx] = { ...scriptData.value.personas[idx], rawInput };
      doPersist();
    }
  }

  function updatePersonaProfile(analyzedProfile: string) {
    const idx = scriptData.value.personas.findIndex(x => x.id === scriptData.value.activePersonaId);
    if (idx !== -1) {
      scriptData.value.personas[idx] = {
        ...scriptData.value.personas[idx],
        analyzedProfile,
        lastAnalyzedAt: new Date().toISOString(),
      };
      doPersist();
    }
  }

  function renamePersona(id: string, name: string) {
    const idx = scriptData.value.personas.findIndex(x => x.id === id);
    if (idx !== -1) {
      scriptData.value.personas[idx] = { ...scriptData.value.personas[idx], name };
      doPersist();
    }
  }

  // ========== 设置相关 ==========

  function updateSettings(partial: Partial<ScriptSettings['settings']>) {
    Object.assign(scriptData.value.settings, partial);
    // 设置变更直接落盘
    saveSettingsToLocal(scriptData.value);
  }

  // ========== 正文捕获相关 ==========

  function captureContent(messageId: number, content: string) {
    const existing = chatData.value.capturedContents.find(c => c.messageId === messageId);
    if (existing) {
      existing.content = content;
      existing.capturedAt = new Date().toISOString();
      existing.swipeCount++;
    } else {
      chatData.value.capturedContents.push({
        messageId,
        content,
        capturedAt: new Date().toISOString(),
        swipeCount: 0,
      });
    }
  }

  // 捕获第0层开场白（不会触发 MESSAGE_RECEIVED 事件）
  function captureFloorZero() {
    const existing = chatData.value.capturedContents.find(c => c.messageId === 0);
    if (existing) return; // 已捕获过
    try {
      const aiMessages = getChatMessages(0, { role: 'assistant' });
      if (!aiMessages || aiMessages.length === 0) return;
      const content = extractContentFromMessage(aiMessages[0].message || '');
      if (content) {
        chatData.value.capturedContents.push({
          messageId: 0,
          content,
          capturedAt: new Date().toISOString(),
          swipeCount: 0,
        });
        console.info('[智脑] 已捕获开场白（第0层）');
      }
    } catch (e) {
      // getChatMessages 可能在某些环境下不可用，静默忽略
    }
  }

  // ========== 用户输入记录 ==========

  function recordUserInput(messageId: number, userInput: string, aiResponse: string) {
    const existing = chatData.value.userInputRecords.find(r => r.messageId === messageId);
    if (existing) {
      if (existing.aiResponse !== aiResponse && existing.aiResponse) {
        existing.rolledResponses.push(existing.aiResponse);
      }
      existing.aiResponse = aiResponse;
    } else {
      chatData.value.userInputRecords.push({
        messageId,
        userInput,
        aiResponse,
        rolledResponses: [],
      });
    }
  }

  // ========== 大总结相关 ==========

  /**
   * 增量存储：每条 summary 只存本轮新增内容，不再存合并后的全集。
   * 旧格式（_summaryDeltaFormat=false）首次调用时自动迁移。
   */
  function addSummary(summary: GrandSummary, upToMessageId?: number, coveredMessageIds?: number[]) {
    // ── 旧格式迁移：旧版每条 summary 都是全量快照，只保留最后一条作为基础 delta ──
    if (!(chatData.value as any)._summaryDeltaFormat) {
      const oldCount = chatData.value.summaries.length;
      if (oldCount > 0) {
        // 只保留最后一条（已包含所有合并信息），其余丢弃（都是重复数据）
        chatData.value.summaries = [chatData.value.summaries[oldCount - 1]];
        console.info(`[智脑] 大总结存储已迁移为增量格式 (旧版 ${oldCount} 条 → 1 条基础delta)`);
      }
      (chatData.value as any)._summaryDeltaFormat = true;
    }

    // 过滤已忽略角色
    const ignored = new Set(chatData.value.ignoredCharacters);
    summary.characterMemories = summary.characterMemories.filter(m => !ignored.has(m.characterName));
    // 过滤用户自身（AI偶尔误生成user的记忆条目）
    const userName = getUserName();
    summary.characterMemories = summary.characterMemories.filter(m => {
      const isUser = m.characterName === userName || m.characterName === '{{user}}' || m.characterName === 'user';
      if (isUser) {
        console.warn(`[智脑-addSummary] ⚠️ 已过滤user记忆条目: "${m.characterName}"`);
      }
      return !isUser;
    });

    // ⭐ 增量模式：不合并旧核心，直接存储本轮 AI 输出的 delta
    // 核心记忆的累积合并在 assembledSummary 中读取时完成
    for (const mem of summary.characterMemories) {
      mem.recentMemories = (mem.recentMemories || []).slice(0, 8);
    }

    const normalizedCoveredIds = coveredMessageIds ?? getCapturedContentMessageIds(chatData.value.capturedContents);
    summary.coveredMessageIds = normalizedCoveredIds;
    summary.upToMessageId =
      upToMessageId ?? normalizedCoveredIds[normalizedCoveredIds.length - 1] ?? chatData.value.lastSummaryAtMessageId;

    const oldLastId = chatData.value.lastSummaryAtMessageId;
    chatData.value.summaries.push(summary);
    chatData.value.lastSummaryAtMessageId = Math.max(oldLastId, summary.upToMessageId ?? 0);
    console.info(
      `[智脑-addSummary] v${summary.version} (delta) ` +
        `upToMessageId=${summary.upToMessageId} ` +
        `chars=${summary.characterMemories.length}`,
    );

    // 立即持久化
    allChatsData.value[currentChatId] = klona(chatData.value);
    replaceVariables(klona(allChatsData.value), { type: 'chat' });
    // 同步备份
    const backup = {
      [CHAT_DATA_KEY]: klona(allChatsData.value),
      [SETTINGS_KEY]: klona(scriptData.value),
    };
    replaceVariables(backup, { type: 'script', script_id: STABLE_ID });
  }

  /** 获取最新的原始 delta（写操作用） */
  function getLatestDelta(): GrandSummary | undefined {
    return chatData.value.summaries[chatData.value.summaries.length - 1];
  }

  /** 组装增量 delta 为完整大总结视图 */
  const assembledSummary = computed<GrandSummary | undefined>(() => {
    const deltas = chatData.value.summaries;
    if (deltas.length === 0) return undefined;

    // 旧格式（尚未迁移）：直接返回最后一条
    if (!(chatData.value as any)._summaryDeltaFormat) {
      return deltas[deltas.length - 1];
    }

    const last = deltas[deltas.length - 1];

    // ═══ 组装叙事文本 (Section 1)：拼接所有 delta 的 Section 1 ═══
    const sections1: string[] = [];
    for (const d of deltas) {
      const parts = d.rawText.split(/---SECTION---/i);
      const s1 = (parts[0] || '').trim();
      if (s1) sections1.push(s1);
    }

    // ═══ 组装角色记忆 (Section 2)：累积合并所有 delta 的记忆 ═══
    // 手动编辑过的角色：跳过旧 delta 合并，直接使用最新 delta 的数据
    const manuallyEdited = new Set<string>();
    for (const mem of last.characterMemories) {
      if ((mem as any)._manuallyEdited) manuallyEdited.add(mem.characterName);
    }

    // 辅助：从 coreMemories（兼容旧 string[] 格式）提取 text
    function coreText(c: any): string {
      return typeof c === 'string' ? c : c?.text || '';
    }
    function existingCoreTexts(mem: CharacterMemory): Set<string> {
      return new Set((mem.coreMemories || []).map(c => coreText(c)).filter(Boolean));
    }

    const memMap = new Map<string, CharacterMemory>();
    for (const d of deltas) {
      for (const mem of d.characterMemories) {
        // 手动编辑过的角色：只在最新 delta 中处理一次，跳过旧 delta
        if (manuallyEdited.has(mem.characterName) && d !== last) continue;
        const existing = memMap.get(mem.characterName);
        if (existing && !manuallyEdited.has(mem.characterName)) {
          // 核心去重追加，近期替换
          const existTexts = existingCoreTexts(existing);
          const newCores = ((mem.coreMemories || []) as any[]).filter(
            c => !existTexts.has(coreText(c)),
          ) as CoreMemoryItem[];
          existing.coreMemories = [...existing.coreMemories, ...newCores];
          existing.recentMemories = mem.recentMemories;
          if (mem.keywords?.length) existing.keywords = mem.keywords;
          if (mem.aliases?.length) existing.aliases = mem.aliases;
          if (mem.attitude) existing.attitude = mem.attitude;
        } else {
          memMap.set(mem.characterName, {
            ...mem,
            coreMemories: [...(mem.coreMemories || [])],
            recentMemories: [...mem.recentMemories],
          });
        }
      }
    }
    const allCharMems = [...memMap.values()];
    const section2 = buildMemorySectionText(allCharMems);

    // ═══ NSFW (Section 3)：只用最后一条 delta 的 ═══
    const lastParts = last.rawText.split(/---SECTION---/i);
    const section3 = (lastParts[2] || '').trim() || '[NSFW记录]\n无NSFW内容';

    // ═══ 时间线：拼接所有 delta（新版覆盖旧版同key事件） ═══
    const allTimeline: TimelineEvent[] = [];
    const eventIndex = new Map<string, number>(); // key → index in allTimeline

    for (const d of deltas) {
      for (const evt of d.timeline) {
        const key = `${evt.time}|${evt.event.slice(0, 30)}`;
        const existingIdx = eventIndex.get(key);

        if (existingIdx !== undefined) {
          // 同名事件：新版数据覆盖（可能 ongoing→completed 状态变化）
          allTimeline[existingIdx] = { ...evt, summaryVersion: d.version };
        } else {
          allTimeline.push({ ...evt, summaryVersion: d.version });
          eventIndex.set(key, allTimeline.length - 1);
        }
      }
    }

    // ═══ 手动编辑覆盖：应用用户对时间线的修改 ═══
    const overrides = chatData.value.timelineOverrides || {};
    for (const [key, ov] of Object.entries(overrides)) {
      if (ov._deleted) {
        // 删除事件
        const delIdx = allTimeline.findIndex(e => `${e.time}|${e.event.slice(0, 30)}` === key);
        if (delIdx >= 0) allTimeline.splice(delIdx, 1);
        continue;
      }
      const existIdx = allTimeline.findIndex(e => `${e.time}|${e.event.slice(0, 30)}` === key);
      if (existIdx >= 0) {
        // 更新已有事件
        allTimeline[existIdx] = { ...allTimeline[existIdx], ...ov };
      } else {
        // 用户新增的事件
        const { _deleted, ...newEvt } = ov as any;
        allTimeline.push(newEvt as TimelineEvent);
      }
    }

    // ═══ 角色表格：取最后一条 ═══
    const charTable =
      last.characterTable.length > 0
        ? last.characterTable
        : allCharMems.map(m => ({
            name: m.characterName,
            aliases: m.aliases,
            identity: '',
            relationship: '',
            status: '',
          }));

    const lastSection1 = (last.rawText.split(/---SECTION---/i)[0] || '').trim() || '[剧情摘要]';

    const fullRawText = [
      lastSection1,
      '---SECTION---',
      section2 || '[角色记忆]',
      '---SECTION---',
      section3,
    ].join('\n');

    return {
      version: last.version,
      generatedAt: last.generatedAt,
      upToMessageId: last.upToMessageId,
      coveredMessageIds: last.coveredMessageIds,
      rawText: fullRawText,
      characterMemories: allCharMems,
      timeline: allTimeline,
      characterTable: charTable,
    };
  });

  /** 获取最新的完整大总结视图（读操作用，自动组装 delta） */
  function getLatestSummary(): GrandSummary | undefined {
    return assembledSummary.value;
  }

  function getCoveredFloorsDisplay(): string {
    const summary = getLatestSummary();
    if (!summary?.coveredMessageIds?.length) return '';
    const ids = [...summary.coveredMessageIds].sort((a, b) => a - b);
    return ` (#${ids[0]}${ids.length > 1 ? `-#${ids[ids.length - 1]}` : ''}, ${ids.length}层)`;
  }

  function rollbackSummary(force = false, saveToHistory = true): GrandSummary | undefined {
    if (!force && chatData.value.summaries.length <= 1) {
      console.info('[智脑] 无法撤回，至少保留一条总结');
      return undefined;
    }
    const removed = chatData.value.summaries.pop();
    if (removed && saveToHistory) {
      chatData.value.summaryHistory.push(removed);
    }
    const previousSummary = getLatestSummary();
    chatData.value.lastSummaryAtMessageId = previousSummary?.upToMessageId ?? 0;

    if (removed) {
      chatData.value.dynamicProfiles = chatData.value.dynamicProfiles.filter(
        profile => profile.basedOnSummaryVersion !== removed.version,
      );
      // 撤回物品记忆
      if (chatData.value.itemMemories?.length) {
        chatData.value.itemMemories = removeItemHistoryByVersion(chatData.value.itemMemories, removed.version);
      }
      console.info(`[智脑] 已回退大总结 v${removed.version}`);
    }

    doPersist();
    return removed;
  }

  function restoreLastSummary(): GrandSummary | undefined {
    if (chatData.value.summaryHistory.length === 0) {
      console.info('[智脑] 没有可恢复的大总结');
      return undefined;
    }
    const restored = chatData.value.summaryHistory.pop()!;
    chatData.value.summaries.push(restored);
    chatData.value.lastSummaryAtMessageId = Math.max(
      chatData.value.lastSummaryAtMessageId,
      restored.upToMessageId ?? 0,
    );
    doPersist();
    console.info(`[智脑] 已恢复大总结 v${restored.version}`);
    return restored;
  }

  function getHiddenFloors(): HiddenFloor[] {
    return getHiddenFloorsFromChat();
  }

  function updateSummaryRawText(version: number, newRawText: string): boolean {
    const idx = chatData.value.summaries.findIndex(s => s.version === version);
    if (idx === -1 || !newRawText.trim()) return false;
    const summary = chatData.value.summaries[idx];

    try {
      const parsed: ParsedSummary = parseSummaryOutput(newRawText, version);

      // 校验：如果解析后角色记忆为空但原本有数据，保留旧角色记忆（用户可能只编辑了剧情摘要）
      const memsEmpty = parsed.characterMemories.length === 0 && summary.characterMemories.length > 0;
      if (memsEmpty) {
        console.warn('[智脑] 角色记忆解析为空，保留旧角色记忆（可能只编辑了剧情摘要部分）');
      }

      summary.rawText = newRawText;
      summary.timeline = parsed.timeline;
      if (!memsEmpty) {
        // 过滤掉已忽略角色
        const ignored = new Set(chatData.value.ignoredCharacters);
        summary.characterMemories = parsed.characterMemories.filter(m => !ignored.has(m.characterName));
        summary.characterTable = parsed.characterTable;
      }

      // 同步 nsfwMemories（增量合并，不覆盖已有数据）
      if (parsed.nsfwMemories && parsed.nsfwMemories.length > 0) {
        const mergeSet = (target: string[], source: string[]) => {
          const exist = new Set(target);
          for (const s of source) { if (!exist.has(s)) target.push(s); }
        };
        for (const mem of parsed.nsfwMemories) {
          const existing = chatData.value.nsfwMemories.find(m => m.characterName === mem.characterName);
          if (existing) {
            mergeSet(existing.sensitivePoints, mem.sensitivePoints);
            mergeSet(existing.preferences, mem.preferences);
            mergeSet(existing.behaviors, mem.behaviors);
            mergeSet(existing.memories, mem.memories);
            existing.lastUpdatedAt = new Date().toISOString();
          } else {
            chatData.value.nsfwMemories.push(mem);
          }
        }
      }

      console.info(`[智脑] 大总结delta v${version} 手动编辑后已重新解析并同步`);
      // 强制替换 summary 对象引用触发 Vue 响应式
      chatData.value.summaries[idx] = { ...summary };
      // 强制持久化
      allChatsData.value[currentChatId] = klona(chatData.value);
      replaceVariables(klona(allChatsData.value), { type: 'chat' });
      return true;
    } catch (error) {
      console.error('[智脑] 重新解析失败，保留原结构', error);
      return false;
    }
  }

  // ========== 时间线手动编辑 ==========

  /** 获取事件的唯一 key */
  function getTimelineEventKey(evt: TimelineEvent): string {
    return `${evt.time}|${evt.event.slice(0, 30)}`;
  }

  /** 更新/新增时间线事件的手动覆盖 */
  function updateTimelineOverride(key: string, event: TimelineEvent & { _deleted?: boolean }) {
    chatData.value.timelineOverrides = {
      ...chatData.value.timelineOverrides,
      [key]: event,
    };
    doPersist();
  }

  /** 删除时间线事件的手动覆盖 */
  function removeTimelineOverride(key: string) {
    const newOverrides = { ...chatData.value.timelineOverrides };
    // 如果该事件来自 AI 生成的 delta，标记为删除；如果纯手动新增，直接移除
    const deltas = chatData.value.summaries;
    const existsInDelta = deltas.some(d => d.timeline.some(e => `${e.time}|${e.event.slice(0, 30)}` === key));
    if (existsInDelta) {
      newOverrides[key] = { _deleted: true } as any;
    } else {
      delete newOverrides[key];
    }
    chatData.value.timelineOverrides = newOverrides;
    doPersist();
  }

  /** 替换时间线事件：始终存在 oldKey（或解析出的 storageKey）上，装配时匹配 delta 原始位置 */
  function replaceTimelineOverride(oldKey: string, event: TimelineEvent) {
    const overrides = { ...chatData.value.timelineOverrides };
    const newKey = getTimelineEventKey(event);

    // 解析实际的存储 key：oldKey 可能不直接是 override key（如之前编辑过改了时间）
    let storageKey = oldKey;
    if (!overrides[oldKey] || overrides[oldKey]?._deleted) {
      for (const [k, v] of Object.entries(overrides)) {
        if (!v._deleted && getTimelineEventKey(v as TimelineEvent) === oldKey) {
          storageKey = k;
          break;
        }
      }
    }

    // 始终存在 storageKey 上，装配时能匹配到 delta 原始位置（不会跑到末尾）
    overrides[storageKey] = event;
    // 清理可能残留的旧 key 条目
    if (oldKey !== storageKey) delete overrides[oldKey];
    if (newKey !== storageKey && newKey !== oldKey) delete overrides[newKey];

    chatData.value.timelineOverrides = overrides;
    doPersist();
  }

  /** 新增时间线事件（用户手动添加） */
  function addTimelineEvent(event: TimelineEvent) {
    const key = getTimelineEventKey(event);
    chatData.value.timelineOverrides = {
      ...chatData.value.timelineOverrides,
      [key]: event,
    };
    doPersist();
  }

  // ========== 动态人设相关 ==========

  function updateDynamicProfile(profile: DynamicProfile) {
    // 拦截污染数据：内容为角色记忆格式的拒绝写入
    if (/^(别名[:：]|态度[:：]|关键词[:：]|- \[)/m.test(profile.dynamicContent?.trim() || '')) {
      console.warn(`[智脑] 拒绝写入污染的动态人设: ${profile.characterName}（内容为角色记忆格式）`);
      return;
    }
    // 无新变化 / 无实质内容 → 不覆盖已有记录
    const trimmed = profile.dynamicContent?.trim() || '';
    if (/^(无新变化|行为模式与原人设一致|无明显变化|暂无变化|无变化|无)\s*$/i.test(trimmed)) {
      console.log(`[智脑] 动态人设无新变化，保留旧记录: ${profile.characterName}`);
      return;
    }
    const existingIdx = chatData.value.dynamicProfiles.findIndex(p => p.characterName === profile.characterName);
    if (existingIdx >= 0) {
      const existing = chatData.value.dynamicProfiles[existingIdx];
      const oldVersion = existing.basedOnSummaryVersion;
      chatData.value.dynamicProfiles[existingIdx] = {
        ...existing,
        dynamicContent: profile.dynamicContent,
        lastUpdatedAt: new Date().toISOString(),
        basedOnSummaryVersion: oldVersion, // 保留首次创建的版本号
      };
    } else {
      chatData.value.dynamicProfiles.push(profile);
    }
  }

  function removeDynamicProfile(characterName: string) {
    chatData.value.dynamicProfiles = chatData.value.dynamicProfiles.filter(
      p => p.characterName !== characterName,
    );
  }

  // ========== 记忆库相关 ==========

  /**
   * 融合记忆：运行时遍历所有版本，输出完整的融合列表
   * - 近期窗口（最近 N 版本）：核心+近期全部注入
   * - 远期窗口：核心记忆语义召回（有queryEmb时）或全量注入（无queryEmb时）
   * @param characterName 角色名
   * @param recentVersions 最近几个版本窗口（默认用 settings 中的值）
   * @param queryEmb 查询向量（提供时对远期核心做语义召回）
   * @param recallLimit 召回上限（默认用角色设置或全局 memoryRecallLimit）
   */
  function getFusedMemories(
    characterName: string,
    recentVersions?: number,
    queryEmb?: number[],
    recallLimit?: number,
    queryText?: string,
  ): Array<{ text: string; isCore: boolean; time?: string }> {
    const versions = recentVersions ?? scriptData.value.settings.recentMemoryVersions ?? 1;
    const summaries = chatData.value.summaries;
    // versions=0 → 仅远期核心，跳过近期窗口（供 reranker 拆分使用）
    const recentStart = versions === 0 ? summaries.length : Math.max(0, summaries.length - Math.max(1, versions));

    // 查找角色时归一化名称匹配（Qingyue (清月) ↔ Qingyue）
    const normName = characterName.replace(/\s*\(.+?\)$/g, '');
    function findMem(summary: any) {
      return summary.characterMemories.find((m: any) => {
        const mn = (m.characterName || '').replace(/\s*\(.+?\)$/g, '');
        return mn === normName;
      });
    }

    // ⭐ 手动编辑过的角色：只用最新版本的 orderedNewMemories，完全跳过所有旧版本
    const latestMem = findMem(summaries[summaries.length - 1]);
    if (latestMem && (latestMem as any)._manuallyEdited === true) {
      const ordered = (latestMem as any).orderedNewMemories as
        | Array<{ text: string; isCore: boolean; time?: string }>
        | undefined;
      return (ordered || []).map(item => ({ text: item.text, isCore: item.isCore, time: item.time }));
    }

    // 获取角色召回上限
    const limit = recallLimit ?? (latestMem as any)?.recallLimit ?? scriptData.value.settings.memoryRecallLimit ?? 10;

    // 1. 收集旧窗口的核心（去重，保持首次出现顺序，同时收集 embedding + 版本号）
    type OldCore = { text: string; embedding?: number[]; time?: string; versionIndex: number };
    const oldCores: OldCore[] = [];
    const oldCoreSet = new Set<string>();
    for (let i = 0; i < recentStart; i++) {
      const mem = findMem(summaries[i]);
      if (!mem) continue;
      const ordered = (mem as any).orderedNewMemories as
        | Array<{ text: string; isCore: boolean; time?: string }>
        | undefined;
      if (!ordered) continue;
      // 构建 coreMemories 的 text→embedding/时间 映射
      const embMap = new Map<string, number[]>();
      const timeMap = new Map<string, string>();
      const coreItems: any[] = mem.coreMemories || [];
      for (const ci of coreItems) {
        const t = typeof ci === 'string' ? ci : ci?.text || '';
        if (t && ci?.embedding) embMap.set(t, ci.embedding);
        if (t && ci?.time) timeMap.set(t, ci.time);
      }
      for (const item of ordered) {
        if (item.isCore && !oldCoreSet.has(item.text)) {
          oldCoreSet.add(item.text);
          oldCores.push({
            text: item.text,
            embedding: embMap.get(item.text),
            time: item.time || timeMap.get(item.text),
            versionIndex: i, // 记录记忆所属的总结版本号
          });
        }
      }
    }

    // 2. 远期核心：语义召回 or 全量
    // 检查角色是否关闭召回（recallEnabled=false → 全量注入）
    const recallOn = (latestMem as any)?.recallEnabled !== false;
    let oldCoreResult: Array<{ text: string; isCore: boolean; time?: string }>;
    if (queryEmb && recallOn && oldCores.some(c => c.embedding)) {
      // ═══ 混合检索路径（语义 + 词汇匹配 + 时间衰减） ═══
      const hybridW = scriptData.value.settings.hybridWeight ?? 0.7;
      const timeDecayOn = scriptData.value.settings.timeDecayEnabled !== false;
      const decayRate = scriptData.value.settings.timeDecayRate ?? 0.05;
      const decayBoost = scriptData.value.settings.timeDecayBoost ?? 0.3;
      const totalVersions = summaries.length;

      // 候选放大（供重排阶段筛选）
      const candidateMult = scriptData.value.settings.rerankEnabled
        ? (scriptData.value.settings.rerankCandidateMultiplier ?? 3)
        : 1;
      const candidateLimit = Math.max(limit, Math.min(oldCores.length, limit * candidateMult));

      const scored = oldCores.map(c => {
        let denseSim = 0;
        if (c.embedding && queryEmb) {
          denseSim = cosineSimilarity(c.embedding, queryEmb);
        }
        // 词汇匹配分量（字符二元组 Jaccard）
        const lexSim = queryText ? charBigramSimilarity(queryText, c.text) : 0;
        // 混合分数：有 embedding 的用加权混合，无 embedding 的纯词汇
        let hybridSim = c.embedding ? hybridW * denseSim + (1 - hybridW) * lexSim : lexSim;
        // 时间衰减：越旧的记忆分数越低，但语义匹配度高的仍能胜出
        if (timeDecayOn) {
          const versionAge = totalVersions - 1 - c.versionIndex;
          const timeDecay = Math.exp(-decayRate * versionAge);
          const timeWeight = 1 + decayBoost * timeDecay;
          hybridSim *= timeWeight;
        }
        return { ...c, sim: hybridSim, denseSim, lexSim };
      });
      // 有 embedding 的按混合分排前，无 embedding 的放后面
      scored.sort((a, b) => {
        const aHas = a.embedding ? 1 : 0;
        const bHas = b.embedding ? 1 : 0;
        if (aHas !== bHas) return bHas - aHas;
        return b.sim - a.sim;
      });

      // 第一轮粗筛：取候选池
      const candidates = scored.slice(0, candidateLimit);

      // 第一轮粗筛结果（重排在注入层异步完成，此处只取候选池）
      const topN = candidates.slice(0, Math.max(1, limit));

      oldCoreResult = topN.map(c => ({ text: c.text, isCore: true, time: c.time }));
      const withoutEmb = oldCores.length - oldCores.filter(c => c.embedding).length;
      const timeDecayInfo = timeDecayOn ? ` 时间衰减:开(率${decayRate},增强${decayBoost})` : '';
      console.info(
        `[智脑-记忆召回] ${characterName}: 远期核心 ${oldCores.length} 条 → 召回 ${oldCoreResult.length} 条 ` +
          `(混合权重=${(hybridW * 100).toFixed(0)}%语义/${((1 - hybridW) * 100).toFixed(0)}%词汇 有向量:${oldCores.length - withoutEmb} 无向量:${withoutEmb}${timeDecayInfo})`,
      );
    } else {
      // ═══ 全量路径（无 queryEmb / 无 embedding 数据 / 角色关闭召回） ═══
      if (!recallOn) {
        console.info(`[智脑-记忆召回] ${characterName}: 角色已关闭语义召回，远期核心 ${oldCores.length} 条完整注入`);
      }
      oldCoreResult = oldCores.map(c => ({ text: c.text, isCore: true, time: c.time }));
    }

    // 3. 输出：远期核心 + 近期窗口各版本按 AI 原序追加
    const result: Array<{ text: string; isCore: boolean; time?: string }> = [...oldCoreResult];

    for (let i = recentStart; i < summaries.length; i++) {
      const mem = findMem(summaries[i]);
      if (!mem) continue;
      const ordered = (mem as any).orderedNewMemories as
        | Array<{ text: string; isCore: boolean; time?: string }>
        | undefined;
      if (!ordered) continue;
      // 近期窗口内用 resultSet 去重（旧核心已占的条目跳过）
      const resultSet = new Set(result.map(r => r.text));
      for (const item of ordered) {
        if (resultSet.has(item.text)) continue; // 旧核心已有，跳过
        resultSet.add(item.text);
        result.push({
          text: item.text,
          isCore: item.isCore && !oldCoreSet.has(item.text),
          time: item.time,
        });
      }
    }

    return result;
  }

  /**
   * 异步重排增强召回：在 getFusedMemories 粗筛基础上，调用 reranker API 精排。
   * 仅用于注入路径（index.ts），同步调用方不受影响。
   */
  async function rerankEnhancedRecall(
    characterNames: string[],
    queryText: string,
  ): Promise<Map<string, Array<{ text: string; isCore: boolean; time?: string }>>> {
    const result = new Map<string, Array<{ text: string; isCore: boolean; time?: string }>>();
    if (!scriptData.value.settings.rerankEnabled) return result;
    if (!queryText || characterNames.length === 0) return result;

    const candidateMult = scriptData.value.settings.rerankCandidateMultiplier ?? 3;
    const limit = scriptData.value.settings.memoryRecallLimit ?? 10;

    // ★ 拆分两路：
    //   - 远期核心：走 reranker 语义排序，受 recallLimit 约束
    //   - 近期窗口：全部保留，不受任何上限约束，不参与重排
    const recentMap = new Map<string, Array<{ text: string; isCore: boolean; time?: string }>>();
    const candidateMap = new Map<string, Array<{ text: string; isCore: boolean; time?: string }>>();

    for (const name of characterNames) {
      // 远期核心（recentVersions=0 → 仅旧核心，无近期窗口）
      const oldCores = getFusedMemories(name, 0, undefined, limit * candidateMult, queryText);
      // 完整集（远期核心 + 近期窗口）
      const full = getFusedMemories(name, undefined, undefined, limit * candidateMult, queryText);

      // 提取近期窗口（完整集中去掉远期核心已有的部分）
      const oldSet = new Set(oldCores.map(r => r.text));
      const recentOnly = full.filter(r => !oldSet.has(r.text));

      recentMap.set(name, recentOnly);

      if (oldCores.length > limit) {
        candidateMap.set(name, oldCores);
      } else {
        // 候选不足，直接合并远期+近期
        result.set(name, [...oldCores, ...recentOnly]);
      }

      if (oldOnly.length > limit) {
        candidateMap.set(name, oldOnly);
      } else {
        // 远期候选不足或不需要重排 → 直接合并
        result.set(name, [...oldOnly, ...recent]);
      }
    }

    if (candidateMap.size === 0) return result;

    // 一次性收集所有候选文本并调用 reranker
    const allCandidates: { char: string; idx: number; text: string }[] = [];
    const charTexts: string[] = [];
    for (const [name, candidates] of candidateMap) {
      for (let i = 0; i < candidates.length; i++) {
        const text = `${name}: ${candidates[i].text}`;
        allCandidates.push({ char: name, idx: i, text });
        charTexts.push(text);
      }
    }

    try {
      const { rerankCandidates } = await import('../core/embedding');
      const reranked = await rerankCandidates(
        queryText,
        charTexts,
        charTexts.length,
        scriptData.value.settings.embeddingApiUrl,
        scriptData.value.settings.embeddingApiKey,
        scriptData.value.settings.rerankModel,
      );
      if (!reranked?.length) return result;

      // 按角色分组，每组取 top-N
      const scoredByChar = new Map<string, Array<{ idx: number; score: number; text: string }>>();
      for (const r of reranked) {
        const c = allCandidates.find(x => x.text === r.text);
        if (!c) continue;
        const arr = scoredByChar.get(c.char) || [];
        arr.push({ idx: c.idx, score: r.score ?? 0, text: r.text });
        scoredByChar.set(c.char, arr);
      }

      for (const [name, candidates] of candidateMap) {
        const scored = scoredByChar.get(name);
        const recent = recentMap.get(name) || [];
        if (scored && scored.length > 0) {
          scored.sort((a, b) => b.score - a.score);
          const top = scored.slice(0, limit).map(s => candidates[s.idx]);
          // ★ 远期重排 top-N + 近期全保留
          result.set(name, [...top, ...recent]);
        } else {
          result.set(name, [...candidates.slice(0, limit), ...recent]);
        }
      }
      console.info(`[智脑-Rerank] 批量重排完成: ${candidateMap.size}角色, ${charTexts.length}候选 + 近期全保留`);
    } catch (e) {
      console.warn(`[智脑-Rerank] 批量重排失败，回退粗筛: ${(e as Error).message}`);
      for (const [name, candidates] of candidateMap) {
        const recent = recentMap.get(name) || [];
        result.set(name, [...candidates.slice(0, limit), ...recent]);
      }
    }

    return result;
  }

  function getCharacterMemoryArchive(characterName: string): Array<{
    version: number;
    generatedAt: string;
    memories: Array<{ text: string; isCore: boolean; time?: string }>;
  }> {
    const normName = characterName.replace(/\s*\(.+?\)$/g, '');
    return JSON.parse(
      JSON.stringify(
        chatData.value.summaries.map(summary => {
          const mem = summary.characterMemories.find(m => {
            const mn = (m.characterName || '').replace(/\s*\(.+?\)$/g, '');
            return mn === normName;
          });
          const ordered = (mem as any)?.orderedNewMemories as
            | Array<{ text: string; isCore: boolean; time?: string }>
            | undefined;
          return {
            version: summary.version,
            generatedAt: summary.generatedAt,
            memories: (ordered || []).map(o => ({ text: o.text, isCore: o.isCore, time: o.time })),
          };
        }),
      ),
    ); // 保持旧→新顺序（v1 在上，v2 在下）
  }

  function getCharacterMemories(
    characterName: string,
  ):
    | (CharacterMemory & { memories: string[]; _orderedItems?: { text: string; isCore: boolean; time?: string }[] })
    | undefined {
    const latest = getLatestSummary();
    if (!latest) return undefined;
    const mem = latest.characterMemories.find(m => m.characterName === characterName);
    if (mem) {
      // ⭐ 手动编辑过的角色：直接使用 orderedNewMemories，跳过融合避免旧数据复活
      if ((mem as any)._manuallyEdited) {
        const ordered = (mem as any).orderedNewMemories as
          | Array<{ text: string; isCore: boolean; time?: string }>
          | undefined;
        if (ordered && ordered.length > 0) {
          (mem as any)._orderedItems = ordered;
          (mem as any).memories = ordered.map(m => `[${m.isCore ? '核心' : '近期'}]${m.text}`);
          return mem as any;
        }
      }
      // 运行时融合：旧核心 → 最近N版近期
      const fused = getFusedMemories(characterName);
      if (fused.length > 0) {
        (mem as any)._orderedItems = fused;
        (mem as any).memories = fused.map(m => `[${m.isCore ? '核心' : '近期'}]${m.text}`);
      } else {
        // 兜底：核心在前、近期在后（兼容旧 string[] 和新 CoreMemoryItem[] 格式）
        const items: { text: string; isCore: boolean; time?: string }[] = [
          ...(mem.coreMemories || []).map((t: any) => ({
            text: typeof t === 'string' ? t : t?.text || '',
            isCore: true,
            time: t?.time,
          })),
          ...(mem.recentMemories || []).map(t => ({ text: t, isCore: false })),
        ];
        (mem as any)._orderedItems = items;
        (mem as any).memories = items.map(m => `[${m.isCore ? '核心' : '近期'}]${m.text}`);
      }
    }
    return mem as any;
  }

  function getAllCharacterNames(): string[] {
    const latest = getLatestSummary();
    if (!latest) return [];
    return latest.characterMemories.map(m => m.characterName);
  }

  // ========== 角色合并 ==========

  /**
   * 将副角色（source）的所有数据合并到主角色（target）中。
   * 在每个 delta 内部就地合并，不跨 delta 移动数据，确保时间位置不错位。
   */
  function mergeCharacters(targetName: string, sourceName: string): boolean {
    if (!targetName || !sourceName || targetName === sourceName) return false;

    // 合并前先做一次持久化（备份）
    doPersist();
    console.info(`[智脑-合并] 开始合并: "${sourceName}" → "${targetName}"`);

    // 1. 遍历所有 delta，在每个 delta 内合并角色记忆
    for (const delta of chatData.value.summaries) {
      const targetIdx = delta.characterMemories.findIndex(m => m.characterName === targetName);
      const sourceIdx = delta.characterMemories.findIndex(m => m.characterName === sourceName);

      if (sourceIdx === -1) continue; // 该 delta 中无副角色，跳过

      const sourceMem = delta.characterMemories[sourceIdx];

      if (targetIdx === -1) {
        // 该 delta 中只有副角色没有主角色 → 直接重命名
        sourceMem.characterName = targetName;
        // 把副角色原名加入 aliases
        if (!sourceMem.aliases.includes(sourceName)) {
          sourceMem.aliases.push(sourceName);
        }
      } else {
        // 该 delta 中两者都有 → 合并记忆到主角色
        const targetMem = delta.characterMemories[targetIdx];

        // 合并 aliases
        const allAliases = new Set([...(targetMem.aliases || []), ...(sourceMem.aliases || []), sourceName]);
        allAliases.delete(targetName); // 不把自己名字加入别名
        targetMem.aliases = [...allAliases];

        // 合并 keywords（去重）
        const allKeywords = new Set([...(targetMem.keywords || []), ...(sourceMem.keywords || [])]);
        targetMem.keywords = [...allKeywords];

        // 合并 coreMemories（去重追加）
        const existingCoreTexts = new Set(
          (targetMem.coreMemories || []).map((c: any) => typeof c === 'string' ? c : (c?.text || '')),
        );
        for (const core of (sourceMem.coreMemories || [])) {
          const text = typeof core === 'string' ? core : ((core as any)?.text || '');
          if (text && !existingCoreTexts.has(text)) {
            targetMem.coreMemories.push(core);
            existingCoreTexts.add(text);
          }
        }

        // 合并 recentMemories（去重追加）
        const existingRecent = new Set(targetMem.recentMemories || []);
        for (const r of (sourceMem.recentMemories || [])) {
          if (r && !existingRecent.has(r)) {
            targetMem.recentMemories.push(r);
            existingRecent.add(r);
          }
        }

        // 合并 orderedNewMemories（去重追加到末尾）
        const targetOrdered = (targetMem as any).orderedNewMemories as Array<{ text: string; isCore: boolean; time?: string }> | undefined;
        const sourceOrdered = (sourceMem as any).orderedNewMemories as Array<{ text: string; isCore: boolean; time?: string }> | undefined;
        if (sourceOrdered && sourceOrdered.length > 0) {
          const existing = targetOrdered || [];
          const existingTexts = new Set(existing.map(o => o.text));
          const merged = [...existing];
          for (const item of sourceOrdered) {
            if (item.text && !existingTexts.has(item.text)) {
              merged.push(item);
              existingTexts.add(item.text);
            }
          }
          (targetMem as any).orderedNewMemories = merged;
        }

        // 标记手动编辑
        (targetMem as any)._manuallyEdited = true;

        // 删除副角色条目
        delta.characterMemories.splice(sourceIdx, 1);
      }
    }

    // 2. 动态人设：保留主角色的，删除副角色的
    chatData.value.dynamicProfiles = chatData.value.dynamicProfiles.filter(
      p => p.characterName !== sourceName,
    );

    // 3. NSFW 记忆：合并
    const targetNsfw = chatData.value.nsfwMemories.find(m => m.characterName === targetName);
    const sourceNsfw = chatData.value.nsfwMemories.find(m => m.characterName === sourceName);
    if (sourceNsfw) {
      if (targetNsfw) {
        // 合并去重
        const mergeArr = (a: string[], b: string[]) => [...new Set([...a, ...b])];
        targetNsfw.sensitivePoints = mergeArr(targetNsfw.sensitivePoints, sourceNsfw.sensitivePoints);
        targetNsfw.preferences = mergeArr(targetNsfw.preferences, sourceNsfw.preferences);
        targetNsfw.behaviors = mergeArr(targetNsfw.behaviors, sourceNsfw.behaviors);
        targetNsfw.memories = mergeArr(targetNsfw.memories, sourceNsfw.memories);
      } else {
        // 副角色有但主角色没有 → 重命名
        sourceNsfw.characterName = targetName;
      }
      // 删除副角色的 NSFW（如果已合并到主角色）
      if (targetNsfw) {
        chatData.value.nsfwMemories = chatData.value.nsfwMemories.filter(
          m => m.characterName !== sourceName,
        );
      }
    }

    // 4. 关系档案：更新引用
    for (const rel of chatData.value.relationshipProfiles) {
      if (rel.from === sourceName || rel.fromName === sourceName) {
        rel.from = targetName;
        rel.fromName = targetName;
      }
      if (rel.to === sourceName || rel.toName === sourceName) {
        rel.to = targetName;
        rel.toName = targetName;
      }
    }

    // 5. 后台行动推演：删除副角色的行为树
    if (chatData.value.ecosystemState?.behaviorTrees) {
      chatData.value.ecosystemState.behaviorTrees = chatData.value.ecosystemState.behaviorTrees.filter(
        (t: any) => t.characterName !== sourceName,
      );
    }

    // 6. 角色表格（最新 delta）
    const latestDelta = chatData.value.summaries[chatData.value.summaries.length - 1];
    if (latestDelta?.characterTable) {
      latestDelta.characterTable = latestDelta.characterTable.filter(
        (c: any) => c.name !== sourceName,
      );
    }

    // 强制触发 Vue 响应式更新
    const lastIdx = chatData.value.summaries.length - 1;
    if (lastIdx >= 0) {
      chatData.value.summaries[lastIdx] = { ...chatData.value.summaries[lastIdx] };
    }

    // 持久化
    doPersist();
    console.info(`[智脑-合并] 合并完成: "${sourceName}" → "${targetName}"`);
    return true;
  }

  // ========== 角色忽略管理 ==========

  function ignoreCharacter(name: string) {
    if (!chatData.value.ignoredCharacters.includes(name)) {
      chatData.value.ignoredCharacters.push(name);
    }
    // 备份角色数据（从组装视图备份完整信息），恢复时还原
    const assembled = getLatestSummary();
    const memBackup = assembled ? assembled.characterMemories.filter(m => m.characterName === name) : [];
    const profileBackup = chatData.value.dynamicProfiles.find(p => p.characterName === name) || null;
    chatData.value._ignoredBackup.push({
      name,
      memories: JSON.parse(JSON.stringify(memBackup)),
      profile: profileBackup ? JSON.parse(JSON.stringify(profileBackup)) : null,
    });
    // 从最新 delta 中移除（下次组装时该角色不会再出现）
    const latestDelta = getLatestDelta();
    if (latestDelta) {
      latestDelta.characterMemories = latestDelta.characterMemories.filter(m => m.characterName !== name);
    }
    // 清空对应的动态人设
    chatData.value.dynamicProfiles = chatData.value.dynamicProfiles.filter(p => p.characterName !== name);
    console.info(`[智脑] 已忽略角色: ${name}（数据已备份）`);
  }

  function unignoreCharacter(name: string) {
    chatData.value.ignoredCharacters = chatData.value.ignoredCharacters.filter(n => n !== name);
    // 还原备份的角色数据
    const backup = chatData.value._ignoredBackup.find(b => b.name === name);
    if (backup) {
      const latestDelta = getLatestDelta();
      if (latestDelta && backup.memories.length > 0) {
        // 还原时放在末尾
        latestDelta.characterMemories.push(...backup.memories);
      }
      if (backup.profile) {
        chatData.value.dynamicProfiles.push(backup.profile);
      }
      // 清理备份
      chatData.value._ignoredBackup = chatData.value._ignoredBackup.filter(b => b.name !== name);
      console.info(`[智脑] 已取消忽略角色: ${name}（数据已还原）`);
    } else {
      console.info(`[智脑] 已取消忽略角色: ${name}（无备份数据，需下次总结时重新生成）`);
    }
  }

  // ========== 梦呓相关 ==========

  function updateDreamtalk(data: DreamtalkData) {
    if (chatData.value.dreamtalk) {
      chatData.value.dreamtalkHistory.push(JSON.parse(JSON.stringify(chatData.value.dreamtalk)));
      if (chatData.value.dreamtalkHistory.length > 5) {
        chatData.value.dreamtalkHistory.shift();
      }
    }
    chatData.value.dreamtalk = data;
    doPersist(); // 立即落盘
  }

  function rollbackDreamtalk(): DreamtalkData | null {
    if (!chatData.value.dreamtalk || chatData.value.dreamtalkHistory.length === 0) {
      console.info('[智脑] 没有可撤回的梦呓');
      return null;
    }
    chatData.value.dreamtalkUndoHistory.push(JSON.parse(JSON.stringify(chatData.value.dreamtalk)));
    if (chatData.value.dreamtalkUndoHistory.length > 5) {
      chatData.value.dreamtalkUndoHistory.shift();
    }
    const restored = chatData.value.dreamtalkHistory.pop()!;
    chatData.value.dreamtalk = restored;
    console.info('[智脑] 梦呓已撤回');
    return restored;
  }

  function restoreDreamtalk(): DreamtalkData | null {
    if (!chatData.value.dreamtalk || chatData.value.dreamtalkUndoHistory.length === 0) {
      console.info('[智脑] 没有可恢复的梦呓');
      return null;
    }
    chatData.value.dreamtalkHistory.push(JSON.parse(JSON.stringify(chatData.value.dreamtalk)));
    if (chatData.value.dreamtalkHistory.length > 5) {
      chatData.value.dreamtalkHistory.shift();
    }
    const restored = chatData.value.dreamtalkUndoHistory.pop()!;
    chatData.value.dreamtalk = restored;
    console.info('[智脑] 梦呓已恢复');
    return restored;
  }

  function getDreamtalkCharacterNames(): string[] {
    if (!chatData.value.dreamtalk) return [];
    return chatData.value.dreamtalk.characterInteractions.map(i => i.characterName);
  }

  // ========== NSFW隔离层相关 ==========

  const nsfwMemories = computed(() => chatData.value.nsfwMemories);
  const nsfwDreamtalk = computed(() => chatData.value.nsfwDreamtalk);
  const nsfwDynamicProfiles = computed(() => chatData.value.nsfwDynamicProfiles);

  function updateNsfwMemories(memories: NsfwCharacterMemory[]) {
    const mergeSet = (target: string[], source: string[]) => {
      const exist = new Set(target);
      for (const s of source) { if (!exist.has(s)) target.push(s); }
    };
    for (const mem of memories) {
      const existing = chatData.value.nsfwMemories.find(m => m.characterName === mem.characterName);
      if (existing) {
        mergeSet(existing.sensitivePoints, mem.sensitivePoints);
        mergeSet(existing.preferences, mem.preferences);
        mergeSet(existing.behaviors, mem.behaviors);
        mergeSet(existing.memories, mem.memories);
        existing.lastUpdatedAt = new Date().toISOString();
      } else {
        chatData.value.nsfwMemories.push(mem);
      }
    }
  }

  function updateNsfwDreamtalk(data: NsfwDreamtalkData) {
    chatData.value.nsfwDreamtalk = data;
    doPersist();
  }

  function updateNsfwDynamicProfile(profile: NsfwDynamicProfile) {
    const existing = chatData.value.nsfwDynamicProfiles.find(p => p.characterName === profile.characterName);
    if (existing) {
      Object.assign(existing, profile);
    } else {
      chatData.value.nsfwDynamicProfiles.push(profile);
    }
  }

  // ========== 倒果为因相关 ==========

  const plotFate = computed(() => chatData.value.plotFate);

  function updatePlotFate(state: any) {
    chatData.value.plotFate = state;
    doPersist();
  }

  // ========== 后台行动推演相关 ==========

  const ecosystemState = computed(() => chatData.value.ecosystemState);

  const ecosystemManualChars = computed(() => chatData.value.ecosystemManualChars);

  function updateEcosystemState(state: EcosystemState) {
    chatData.value.ecosystemState = state;
    doPersist();
  }

  function updateEcosystemManualChars(val: string) {
    chatData.value.ecosystemManualChars = val;
    doPersist();
  }

  // ========== 关系档案相关 ==========

  const relationshipProfiles = computed(() => chatData.value.relationshipProfiles);

  function updateRelationshipProfiles(profiles: RelationshipProfile[]) {
    const byId = new Map(chatData.value.relationshipProfiles.map(profile => [profile.id, profile]));
    for (const profile of profiles) {
      byId.set(profile.id, profile);
    }
    chatData.value.relationshipProfiles = [...byId.values()];
    doPersist();
  }

  function removeRelationshipProfile(id: string) {
    chatData.value.relationshipProfiles = chatData.value.relationshipProfiles.filter(profile => profile.id !== id);
    doPersist();
  }

  function clearRelationshipProfiles() {
    chatData.value.relationshipProfiles = [];
    doPersist();
  }

  /**
   * 获取当前用户名
   * 优先智脑自定义角色名 → SillyTavern.name1 → '{{user}}'
   */
  function getUserName(): string {
    const personaName = scriptData.value.personas.find(p => p.id === scriptData.value.activePersonaId)?.name;
    if (personaName) {
      console.info(`[智脑-getUserName] 来源=人设, 值="${personaName}"`);
      return personaName;
    }
    if (typeof SillyTavern !== 'undefined' && SillyTavern.name1) {
      console.info(`[智脑-getUserName] 来源=SillyTavern.name1, 值="${SillyTavern.name1}"`);
      return SillyTavern.name1 as string;
    }
    console.warn('[智脑-getUserName] ⚠️ 未找到用户名，使用默认 {{user}}');
    return '{{user}}';
  }

  // ========== 批量总结状态（持久化在 store 中，避免切 tab 丢失） ==========

  const showBatchPanel = ref(false);
  const batchRunning = ref(false);
  const batchAbortRequested = ref(false);
  const batchStart = ref(0);
  const batchEnd = ref(0);
  const batchSize = ref(20);
  const batchProgress = reactive({
    status: 'idle' as 'idle' | 'running' | 'done' | 'cancelled' | 'paused',
    currentBatch: 0,
    totalBatches: 0,
    totalMessages: 0,
    startFloor: 0,
    endFloor: 0,
    batchSize: 20,
    currentBatchFloorStart: undefined as number | undefined,
    currentBatchFloorEnd: undefined as number | undefined,
    currentBatchCount: undefined as number | undefined,
    errors: [] as Array<{ batch: number; message: string; retries: number }>,
  });

  function resetBatchProgress() {
    Object.assign(batchProgress, {
      status: 'idle',
      currentBatch: 0,
      totalBatches: 0,
      totalMessages: 0,
      startFloor: 0,
      endFloor: 0,
      batchSize: 20,
      currentBatchFloorStart: undefined,
      currentBatchFloorEnd: undefined,
      currentBatchCount: undefined,
      errors: [],
    });
  }

  // ========== 大总结引导弹窗 ==========

  const showSummaryGuidance = ref(false);
  const summaryPendingFloors = ref(0);
  const lastSubmittedGuidance = ref('');
  let summaryGuidanceResolve: ((guidance: string | null) => void) | null = null;

  function requestSummaryGuidance(pendingFloors: number, initialGuidance?: string): Promise<string | null> {
    // settings 是 computed ref，setup 内必须用 .value 取真实值
    if ((settings.value as any)?.summaryGuidanceEnabled === false) {
      return Promise.resolve('');
    }
    // initialGuidance 传入 → 预填（重新总结）；未传入 → 清空（新总结）
    lastSubmittedGuidance.value = initialGuidance ?? '';
    summaryPendingFloors.value = pendingFloors;
    showSummaryGuidance.value = true;
    return new Promise(resolve => {
      summaryGuidanceResolve = resolve;
    });
  }

  function resolveSummaryGuidance(guidance: string) {
    showSummaryGuidance.value = false;
    lastSubmittedGuidance.value = guidance;
    summaryGuidanceResolve?.(guidance);
    summaryGuidanceResolve = null;
  }

  function skipSummaryGuidance() {
    showSummaryGuidance.value = false;
    lastSubmittedGuidance.value = '';
    summaryGuidanceResolve?.('');
    summaryGuidanceResolve = null;
  }

  function cancelSummaryGuidance() {
    showSummaryGuidance.value = false;
    // 取消时不清理 guidance，下次弹窗还能看到
    summaryGuidanceResolve?.(null);
    summaryGuidanceResolve = null;
  }

  // ========== 读取历史楼层 ==========

  async function loadHistoryFloors(): Promise<number> {
    const lastId = getLastMessageId();
    if (lastId < 0) {
      console.info('[智脑] 当前没有聊天楼层');
      return 0;
    }

    const aiMessages = getChatMessages(`0-${lastId}`, { role: 'assistant' });
    const userMessages = getChatMessages(`0-${lastId}`, { role: 'user' });

    // O(1) 索引：避免循环内 O(n) 查找
    const capturedIds = new Set(chatData.value.capturedContents.map(c => c.messageId));
    const recordIds = new Set(chatData.value.userInputRecords.map(r => r.messageId));
    const userMsgMap = new Map<number, (typeof userMessages)[0]>();
    for (const u of userMessages) userMsgMap.set(u.message_id, u);

    // 先收集到临时数组，循环结束后一次性 push，避免每次 push 触发同步存储写入
    const newContents: CapturedContent[] = [];
    const newRecords: UserInputRecord[] = [];

    for (const msg of aiMessages) {
      if (capturedIds.has(msg.message_id)) continue;

      const extractedContent = extractContentFromMessage(msg.message);
      if (!extractedContent) continue;

      newContents.push({
        messageId: msg.message_id,
        content: extractedContent,
        capturedAt: new Date().toISOString(),
        swipeCount: 0,
      });

      // 查找对应的用户输入（AI楼层的前一楼通常是用户输入）
      const userMsg = userMsgMap.get(msg.message_id - 1);
      if (userMsg && !recordIds.has(msg.message_id)) {
        newRecords.push({
          messageId: msg.message_id,
          userInput: userMsg.message,
          aiResponse: extractedContent,
          rolledResponses: [],
        });
        recordIds.add(msg.message_id); // 防止同一条被重复添加
      }
    }

    // 一次性批量写入（只触发一次响应式更新 + 一次存储写入）
    if (newContents.length > 0) {
      chatData.value.capturedContents.push(...newContents);
    }
    if (newRecords.length > 0) {
      chatData.value.userInputRecords.push(...newRecords);
    }

    console.info(`[智脑] 读取历史楼层完成，共补录 ${newContents.length} 条`);
    return newContents.length;
  }

  // ========== 数据管理 ==========

  function exportAllData(): string {
    return JSON.stringify({ scriptData: klona(scriptData.value), chatData: klona(chatData.value) }, null, 2);
  }

  function importAllData(jsonStr: string) {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.scriptData) {
        scriptData.value = ScriptSettingsSchema.parse(parsed.scriptData);
      }
      if (parsed.chatData) {
        chatData.value = ChatDataSchema.parse(parsed.chatData);
        // 旧版备份没有 chatId，补填当前聊天ID
        if (!chatData.value.chatId) {
          chatData.value.chatId = currentChatId;
        }
        console.info(
          `[智脑] 数据导入成功 (总结: ${chatData.value.summaries.length}, 梦呓: ${chatData.value.dreamtalk ? '有' : '无'}, 捕获: ${chatData.value.capturedContents.length})`,
        );
        return;
      }
      console.info('[智脑] 数据导入成功');
    } catch (e) {
      console.error('[智脑] 数据导入失败:', e);
      throw e;
    }
  }

  function clearChatData() {
    chatData.value = ChatDataSchema.parse({});
    doPersist();
    console.info('[智脑] 聊天数据已清空');
  }

  function clearAllData() {
    scriptData.value = ScriptSettingsSchema.parse({});
    chatData.value = ChatDataSchema.parse({});
    doPersist();
    console.info('[智脑] 所有数据已清空');
  }

  // ========== Claude 模型检测 ==========

  function getCurrentModel(): string {
    try {
      return SillyTavern.getChatCompletionModel();
    } catch {
      return '';
    }
  }

  function isClaudeModel(): boolean {
    const model = getCurrentModel();
    return /claude/i.test(model);
  }

  return {
    // 原始数据
    scriptData,
    chatData,
    // 便捷访问器
    personas,
    activePersonaId,
    persona,
    settings,
    capturedContents,
    summaries,
    dynamicProfiles,
    dreamtalk,
    userInputRecords,
    lastSummaryAtMessageId,
    storyDateFormat,
    // 用户人格
    addPersona,
    removePersona,
    setActivePersona,
    updatePersonaRaw,
    updatePersonaProfile,
    renamePersona,
    // 设置
    updateSettings,
    // 正文捕获
    captureContent,
    captureFloorZero,
    recordUserInput,
    // 大总结
    addSummary,
    getLatestSummary,
    timelineOverrides: computed(() => chatData.value.timelineOverrides),
    updateTimelineOverride,
    removeTimelineOverride,
    replaceTimelineOverride,
    addTimelineEvent,
    getTimelineEventKey,
    getLatestDelta,
    getCoveredFloorsDisplay,
    rollbackSummary,
    // 强制持久化（用于直接编辑角色库/梦呓数据后）
    forcePersist() {
      doPersist();
    },
    restoreLastSummary,
    updateSummaryRawText,
    getHiddenFloors,
    // 动态人设
    updateDynamicProfile,
    removeDynamicProfile,
    // 记忆库
    getFusedMemories,
    rerankEnhancedRecall,
    getCharacterMemoryArchive,
    getCharacterMemories,
    getAllCharacterNames,
    // 角色合并
    mergeCharacters,
    // 角色忽略管理
    ignoreCharacter,
    unignoreCharacter,
    // 梦呓
    updateDreamtalk,
    rollbackDreamtalk,
    restoreDreamtalk,
    getDreamtalkCharacterNames,
    // NSFW隔离层
    nsfwMemories,
    nsfwDreamtalk,
    nsfwDynamicProfiles,
    updateNsfwMemories,
    updateNsfwDreamtalk,
    updateNsfwDynamicProfile,
    // 倒果为因
    plotFate,
    updatePlotFate,
    // 后台行动推演
    ecosystemState,
    updateEcosystemState,
    ecosystemManualChars,
    updateEcosystemManualChars,
    // 关系档案
    relationshipProfiles,
    updateRelationshipProfiles,
    removeRelationshipProfile,
    clearRelationshipProfiles,
    getUserName,
    // 批量总结
    showBatchPanel,
    batchRunning,
    batchAbortRequested,
    batchStart,
    batchEnd,
    batchSize,
    batchProgress,
    resetBatchProgress,
    // 大总结引导弹窗
    showSummaryGuidance,
    summaryPendingFloors,
    requestSummaryGuidance,
    resolveSummaryGuidance,
    skipSummaryGuidance,
    cancelSummaryGuidance,
    // 数据管理
    exportAllData,
    importAllData,
    clearChatData,
    clearAllData,
    // 历史楼层
    loadHistoryFloors,
    // 模型检测
    getCurrentModel,
    isClaudeModel,
    // 运行状态
    summaryInProgress,
    dreamtalkInProgress,
    _isRealChatMessage, // MESSAGE_SENT 触发为 true，仅正常聊天注入梦呓
    _isBackgroundCall, // generateRaw 期间为 true，CHAT_COMPLETION_SETTINGS_READY 入口跳过注入
    markBgNativeCall, // native generateRaw 前调用
    consumeBgNativeCall, // CHAT_COMPLETION_SETTINGS_READY 中消费标记
    setSummaryInProgress,
    setDreamtalkInProgress,
    // API 监听器
    apiMonitorLogs,
    pushApiMonitorLog,
    clearApiMonitorLogs,
    // 关系档案分析状态
    relAnalyzing,
    relStatus,
    relError,
    relSelectedNodeId,
    relSelectedEdgeId,
  };
});
