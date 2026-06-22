import { AttributeKey, Character, CharacterClassId, CharacterRaceId, CombatUnit, DynamicBoardItem, PlayerState } from '../types';
import { ELDRED_CHAT_BEAUTIFY_RULES, ELDRED_COMBAT_INTERNAL_CHECKLIST, ELDRED_WORLD_ENGINE_PATCH } from './aiIntegration';
import { buildEldredFrontendEventPayload, EldredFrontendEventInput } from './eldredEvents';
import {
  ATTRIBUTE_LABELS,
  ATTRIBUTE_KEYS,
  calculateDerivedStats,
  getClassById,
  getEquipmentById,
  getRaceById,
  getSkillById,
  getTalentById,
} from './rules';
import {
  EldredMemorySummaryBatch,
  EldredNarrationEntry,
  EldredNarrationKind,
  EldredNarrationVariant,
  EldredRuntimeMessage,
  EldredRuntimeSave,
  extractEldredStatData,
  loadEldredRuntimeSave,
  mergePlayerWithCachedOpening,
  persistEldredRuntimeCache,
  runtimeFromStatData,
} from './eldredSave';
import { formatEldredLocation } from './locationFormat';
import { eldredFixedNpcRegistry, generateNpcAttributes } from './eldredNpcRegistry';
import { eldredCanonicalCluePhases, findCanonicalClueSlot, resolveCanonicalPhaseName } from './mainClues';
import { ELDRED_NOTICE_TAGS, NarrativeTagLine, parseNarrativeTags } from './narrativeTags';

type AnyRecord = Record<string, any>;
type StoryPrompt = { role: 'system' | 'assistant' | 'user'; content: string };

const nowIso = () => new Date().toISOString();

const createId = (prefix: string) => {
  const randomId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${randomId}`;
};

const quote = (value: unknown) => String(value ?? '').replaceAll('"', "'");

const ELDRED_D20_AUTHORITY_RULE = [
  'D20权威判定:',
  '- event_type 为 action_check 时，脚本控制台已经完成二十面骰、属性加值、熟练加值、额外修正、种族/职业/伴生技能/装备来源修正、目标值修正和成功/失败结算。',
  '- 正文必须承认 authoritativeResult 与 related_facts 中的骰面、公式、修正来源、最终目标值和结果，不得重新掷骰、不得改判成功失败。',
  '- 若结果成功，只演绎合理收益、发现、推进或优势；若结果失败，只演绎受阻、代价、信息缺口、风险变化或替代入口。',
  '- 若判定造成变量变化，<UpdateVariable> 必须与脚本权威结果一致。',
].join('\n');

const safeScope = (scopeFactory: () => unknown): AnyRecord | null => {
  try {
    const scope = scopeFactory();
    return scope && typeof scope === 'object' ? scope as AnyRecord : null;
  } catch {
    return null;
  }
};

const getHostScopes = (): AnyRecord[] => {
  const scopes = [
    safeScope(() => globalThis),
    safeScope(() => window),
    safeScope(() => window.parent),
    safeScope(() => window.top),
    safeScope(() => window.opener),
  ].filter((scope): scope is AnyRecord => Boolean(scope));
  return Array.from(new Set(scopes));
};

const getHostFunction = <T extends (...args: any[]) => any>(name: string): T | null => {
  for (const scope of getHostScopes()) {
    try {
      if (typeof scope[name] === 'function') return scope[name] as T;
      if (scope.TavernHelper && typeof scope.TavernHelper[name] === 'function') return scope.TavernHelper[name] as T;
      const eldredBridge = scope.__eldredWelcomeBridge;
      if (eldredBridge && typeof eldredBridge[name] === 'function') return eldredBridge[name] as T;
    } catch {
      // Cross-origin frames can throw.
    }
  }
  return null;
};

type MvuBridge = {
  getMvuData?: (option: AnyRecord) => unknown;
  parseMessage?: (message: string, oldData: unknown) => Promise<unknown> | unknown;
  replaceMvuData?: (data: unknown, option: AnyRecord) => Promise<unknown> | unknown;
};

const getMvuBridge = (): MvuBridge | null => {
  for (const scope of getHostScopes()) {
    try {
      if (scope.Mvu && typeof scope.Mvu === 'object') return scope.Mvu as MvuBridge;
      if (scope.TavernHelper?.Mvu && typeof scope.TavernHelper.Mvu === 'object') return scope.TavernHelper.Mvu as MvuBridge;
      if (scope.__eldredWelcomeBridge?.Mvu && typeof scope.__eldredWelcomeBridge.Mvu === 'object') {
        return scope.__eldredWelcomeBridge.Mvu as MvuBridge;
      }
    } catch {
      // Cross-origin frames can throw.
    }
  }
  return null;
};

const currentMessageContexts = () => {
  const contexts: AnyRecord[] = [
    { type: 'message', message_id: 'latest' },
    { type: 'message', message_id: -1 },
  ];
  const getCurrentMessageId = getHostFunction<() => number>('getCurrentMessageId');
  if (getCurrentMessageId) {
    try {
      const id = Number(getCurrentMessageId());
      if (Number.isFinite(id)) contexts.push({ type: 'message', message_id: id });
    } catch {
      // ignored
    }
  }
  const getLastMessageId = getHostFunction<() => number>('getLastMessageId');
  if (getLastMessageId) {
    try {
      const id = Number(getLastMessageId());
      if (Number.isFinite(id)) {
        contexts.push({ type: 'message', message_id: id });
        if (id > 0) contexts.push({ type: 'message', message_id: id - 1 });
      }
    } catch {
      // ignored
    }
  }
  const seen = new Set<string>();
  return contexts.filter(context => {
    const key = JSON.stringify(context);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const readMessageVariables = (option: AnyRecord) => {
  const getVariables = getHostFunction<(option: AnyRecord) => unknown>('getVariables');
  if (!getVariables) return null;
  try {
    return getVariables(option);
  } catch {
    return null;
  }
};

const resolveMvuWriteContext = (mvu: MvuBridge) => {
  const contexts = currentMessageContexts();
  for (const option of contexts) {
    try {
      const data = mvu.getMvuData?.(option);
      if (data && typeof data === 'object') return { option, oldData: data };
    } catch {
      // Try the next message context.
    }
  }
  const fallbackOption = contexts[0] || { type: 'message', message_id: 'latest' };
  return {
    option: fallbackOption,
    oldData: readMessageVariables(fallbackOption) || {},
  };
};

const wrapStatDataForMvu = (oldData: unknown, statData: AnyRecord) => {
  const oldRecord = cloneRecord(oldData);
  const oldStatData = extractEldredStatData(oldData);
  if (oldStatData === oldData) return statData;
  const payload = Object.keys(oldRecord).length ? oldRecord : {};
  payload.stat_data = statData;
  if (isRecord(payload.data)) payload.data.stat_data = statData;
  if (isRecord(payload.variables)) payload.variables.stat_data = statData;
  if (isRecord(payload.message?.variables)) payload.message.variables.stat_data = statData;
  return payload;
};

const writeStatDataToHost = async (
  statData: AnyRecord,
  knownContext?: { option: AnyRecord; oldData: unknown },
) => {
  const mvu = getMvuBridge();
  if (mvu?.replaceMvuData) {
    try {
      const context = knownContext || resolveMvuWriteContext(mvu);
      await mvu.replaceMvuData(wrapStatDataForMvu(context.oldData || {}, statData), context.option);
      notifyRuntimeChanged();
      return true;
    } catch (error) {
      console.warn('[艾尔德雷德] 标签变量写回 MVU 失败，改用消息变量写回。', error);
    }
  }

  const replaceVariables = getHostFunction<(variables: AnyRecord, option: AnyRecord) => unknown>('replaceVariables');
  if (!replaceVariables) return false;
  for (const option of currentMessageContexts()) {
    const oldVariables = readMessageVariables(option);
    if (!oldVariables) continue;
    try {
      replaceVariables(wrapStatDataForMvu(oldVariables, statData), option);
      notifyRuntimeChanged();
      return true;
    } catch {
      // Try the next message context.
    }
  }
  return false;
};

const notifyRuntimeChanged = () => {
  try {
    window.dispatchEvent(new CustomEvent('eldred-runtime-event'));
  } catch {
    // ignored
  }
  try {
    window.parent?.postMessage({
      source: 'EldredWelcomeLoader',
      type: 'runtime-event',
      name: 'mvu-variable-update-ended',
      args: ['manual-parse'],
      at: Date.now(),
    }, '*');
  } catch {
    // ignored
  }
};

type JsonPatchOperation = {
  op: 'add' | 'replace' | 'remove' | 'delta' | 'insert';
  path: string;
  value?: unknown;
};

const isRecord = (value: unknown): value is AnyRecord =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const cloneRecord = (value: unknown): AnyRecord => {
  if (!isRecord(value)) return {};
  try {
    if (typeof structuredClone === 'function') return structuredClone(value);
  } catch {
    // Fall back to JSON cloning below.
  }
  try {
    return JSON.parse(JSON.stringify(value)) as AnyRecord;
  } catch {
    return { ...value };
  }
};

const normalizeJsonPatchPayload = (payload: unknown): JsonPatchOperation[] => {
  const operations = Array.isArray(payload)
    ? payload
    : isRecord(payload)
      ? payload.JSONPatch ?? payload.jsonPatch ?? payload.patch ?? payload.patches ?? payload.operations ?? payload.ops
      : [];
  if (!Array.isArray(operations)) return [];
  return operations.filter((item): item is JsonPatchOperation => {
    if (!isRecord(item)) return false;
    return ['add', 'replace', 'remove', 'delta', 'insert'].includes(String(item.op)) && typeof item.path === 'string' && item.path.length > 0;
  });
};

const parseJsonPatchText = (text: string): JsonPatchOperation[] => {
  const cleaned = text
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();
  if (!cleaned) return [];
  try {
    return normalizeJsonPatchPayload(JSON.parse(cleaned));
  } catch {
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!arrayMatch) return [];
    try {
      return normalizeJsonPatchPayload(JSON.parse(arrayMatch[0]));
    } catch {
      return [];
    }
  }
};

const extractJsonPatchOperations = (rawText: string): JsonPatchOperation[] => {
  const source = String(rawText || '');
  const blocks = Array.from(source.matchAll(/<JSONPatch\b[^>]*>([\s\S]*?)(?:<\/JSONPatch>|<\/UpdateVariable(?:variable)?>|$)/gi))
    .map(match => match[1] || '')
    .filter(Boolean);
  if (blocks.length) return blocks.flatMap(parseJsonPatchText);

  const updateBlocks = Array.from(source.matchAll(/<UpdateVariable(?:variable)?\b[^>]*>([\s\S]*?)(?:<\/UpdateVariable(?:variable)?>|$)/gi))
    .map(match => match[1] || '')
    .filter(Boolean);
  return updateBlocks.flatMap(parseJsonPatchText);
};

const pointerSegments = (path: string) => {
  const rawSegments = path.startsWith('/')
    ? path.split('/').slice(1)
    : path.split(/[./]/);
  return rawSegments
    .map(segment => segment.replace(/~1/g, '/').replace(/~0/g, '~').trim())
    .filter(Boolean);
};

const applyJsonPatchOperations = (baseStatData: unknown, operations: JsonPatchOperation[]) => {
  if (!operations.length) return null;
  const nextStatData = cloneRecord(baseStatData);
  let applied = false;

  for (const operation of operations) {
    const segments = pointerSegments(operation.path);
    if (!segments.length) continue;
    let cursor: AnyRecord = nextStatData;
    for (const segment of segments.slice(0, -1)) {
      const nextValue = cursor[segment];
      if (!isRecord(nextValue)) cursor[segment] = {};
      cursor = cursor[segment] as AnyRecord;
    }
    const leaf = segments[segments.length - 1];
    if (operation.op === 'remove') {
      if (Object.prototype.hasOwnProperty.call(cursor, leaf)) {
        delete cursor[leaf];
        applied = true;
      }
      continue;
    }
    if (operation.op === 'delta') {
      const current = Number(cursor[leaf]) || 0;
      const delta = Number(operation.value) || 0;
      cursor[leaf] = current + delta;
      applied = true;
      continue;
    }
    cursor[leaf] = operation.value;
    applied = true;
  }

  return applied ? nextStatData : null;
};

const ensureRecordAt = (root: AnyRecord, path: string[]) => {
  let cursor = root;
  for (const segment of path) {
    if (!isRecord(cursor[segment])) cursor[segment] = {};
    cursor = cursor[segment] as AnyRecord;
  }
  return cursor;
};

const appendFrontendNotice = (statData: AnyRecord, title: string, body: string) => {
  const system = ensureRecordAt(statData, ['系统']);
  const current = system.前端提示;
  const notices = Array.isArray(current)
    ? current
    : current && typeof current === 'object'
      ? Object.values(current)
      : [];
  notices.push({
    id: `tag-${Date.now()}-${notices.length}`,
    标题: title,
    类型: title,
    内容: body,
  });
  system.前端提示 = notices.slice(-16);
};

const cleanText = (value: unknown) => String(value ?? '').trim();

const numberFromText = (value: unknown, fallback = 0) => {
  const match = cleanText(value).match(/-?\d+/);
  return match ? Number(match[0]) : fallback;
};

const extractNarrativeTagLines = (rawText: string): NarrativeTagLine[] => parseNarrativeTags(rawText);

const tagValue = (tag: NarrativeTagLine, keys: string[]) => {
  for (const key of keys) {
    const direct = tag.named[key];
    if (direct) return direct;
    const compactKey = key.replace(/\s+/g, '');
    const field = tag.fields.find(item => item.replace(/\s+/g, '').startsWith(compactKey));
    if (!field) continue;
    const stripped = field
      .replace(new RegExp(`^${key}\\s*[：:]?\\s*`), '')
      .trim();
    if (stripped && stripped !== field) return stripped;
  }
  return '';
};

const tagPrimary = (tag: NarrativeTagLine, index: number, fallback = '') =>
  cleanText(tag.fields[index] ?? fallback);

const normalizeRiskText = (value: unknown) => {
  const raw = cleanText(value);
  return ['极高', '高', '中', '低'].find(level => raw.includes(level)) || raw;
};

const recordInsertNewest = (
  container: AnyRecord,
  key: string,
  value: AnyRecord,
  limit: number,
) => {
  const normalizedKey = cleanText(key) || cleanText(value.标题 ?? value.名称) || `条目${Date.now()}`;
  const rest = Object.entries(asRecord(container))
    .filter(([itemKey]) => itemKey !== normalizedKey);
  return Object.fromEntries([[normalizedKey, value], ...rest].slice(0, limit));
};

const asRecord = (value: unknown): AnyRecord =>
  isRecord(value) ? value : {};

const updateBoardRecord = (
  statData: AnyRecord,
  type: '新闻' | '见闻' | '委托',
  key: string,
  value: AnyRecord,
) => {
  const board = ensureRecordAt(statData, ['世界', '动态看板']);
  board[type] = recordInsertNewest(asRecord(board[type]), key, value, 4);
};

const removeBoardRecord = (statData: AnyRecord, type: '新闻' | '见闻' | '委托', key: string) => {
  const board = ensureRecordAt(statData, ['世界', '动态看板']);
  const group = asRecord(board[type]);
  delete group[key];
  board[type] = group;
};

const boardNewsFromTag = (tag: NarrativeTagLine, type: '新闻' | '见闻') => {
  const location = tagValue(tag, ['地点', '地区']) || tagPrimary(tag, 0);
  const source = tagValue(tag, ['来源', '发布者']) || location;
  const title = tagValue(tag, ['标题', '名称'])
    || (tag.fields.length >= 3 ? tagPrimary(tag, 1) : tagPrimary(tag, 0, type));
  const detail = tagValue(tag, ['内容', '详情', '说明'])
    || (tag.fields.length >= 3 ? tag.fields.slice(2).join('｜') : tagPrimary(tag, 1, tag.body));
  const fullDetail = detail.length >= 50 ? detail : [detail, tag.body].filter(Boolean).join('。');
  return {
    标题: title,
    内容: fullDetail || tag.body,
    来源: source,
    地点: location,
    状态: tagValue(tag, ['状态']) || '记录中',
    时间: tagValue(tag, ['时间', '更新']),
  };
};

const parseQuestTag = (tag: NarrativeTagLine, status: string) => {
  const title = tagValue(tag, ['标题', '名称', '委托']) || tagPrimary(tag, 0, '未命名委托');
  const source = tagValue(tag, ['来源', '发布者', '委托人']) || tagPrimary(tag, 1);
  const risk = normalizeRiskText(tagValue(tag, ['风险', '危险等级']) || tag.fields.find(field => /^风险/.test(field)));
  const recLevelText = tagValue(tag, ['建议等级', '等级']) || tag.fields.find(field => /建议等级|等级/.test(field));
  const reward = tagValue(tag, ['奖励', '报酬']);
  const timeLimit = tagValue(tag, ['时限', '截止']);
  const task = tagValue(tag, ['任务详情', '内容', '目标', '说明', '事项'])
    || tag.fields.filter((field, index) => index > 0 && !/[：:]|建议等级|等级|风险|奖励|报酬|时限|截止/.test(field)).join('｜');
  return {
    标题: title,
    名称: title,
    来源: source,
    任务详情: task,
    建议等级: recLevelText ? numberFromText(recLevelText, 1) : undefined,
    风险: risk || undefined,
    奖励: reward,
    时限: timeLimit,
    状态: status,
  };
};

const usefulQuestValue = (value: unknown) => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'number') return Number.isFinite(value);
  const text = cleanText(value);
  return Boolean(text && !/^(未登记|未记录|待登记|待补充|无)$/.test(text));
};

const mergeQuestRecords = (...records: AnyRecord[]) =>
  records.reduce<AnyRecord>((result, record) => {
    Object.entries(asRecord(record)).forEach(([key, value]) => {
      if (usefulQuestValue(value)) result[key] = value;
    });
    return result;
  }, {});

const boardQuestRecordFor = (statData: AnyRecord, title: string) => {
  const boardQuests = asRecord(asRecord(asRecord(statData.世界).动态看板).委托);
  if (boardQuests[title]) return asRecord(boardQuests[title]);
  const normalizedTitle = title.replace(/\s+/g, '');
  const matched = Object.entries(boardQuests).find(([key, value]) => {
    const record = asRecord(value);
    return [key, record.标题, record.名称, record.委托].map(cleanText).some(candidate => candidate.replace(/\s+/g, '') === normalizedTitle);
  });
  return matched ? asRecord(matched[1]) : {};
};

const syncQuestTag = (statData: AnyRecord, tag: NarrativeTagLine) => {
  const status = tag.title === '委托接取' ? '进行中' : tagValue(tag, ['状态']) || '可接取';
  const quest = parseQuestTag(tag, status);
  const title = cleanText(quest.标题);
  const questList = ensureRecordAt(statData, ['主角', '任务列表']);
  const existingQuest = asRecord(questList[title]);
  const boardQuest = boardQuestRecordFor(statData, title);
  const mergedQuest = mergeQuestRecords(boardQuest, existingQuest, quest);
  const normalizedStatus = cleanText(status);

  if (/已结算|结算完成|奖励已结算|已领取|已发放/.test(normalizedStatus)) {
    delete questList[title];
    removeBoardRecord(statData, '委托', title);
    return;
  }

  if (/已完成|完成|待结算/.test(normalizedStatus)) {
    removeBoardRecord(statData, '委托', title);
    questList[title] = { ...mergedQuest, 状态: normalizedStatus.includes('待结算') ? '待结算' : '已完成' };
    return;
  }

  if (tag.title === '委托生成') {
    delete questList[title];
    updateBoardRecord(statData, '委托', title, { ...quest, 状态: '可接取' });
    return;
  }

  const hasExistingQuest = Object.keys(existingQuest).length > 0;
  if (tag.title === '委托接取' || hasExistingQuest) {
    removeBoardRecord(statData, '委托', title);
    questList[title] = {
      ...mergedQuest,
      状态: tag.title === '委托接取' ? '进行中' : normalizedStatus || cleanText(existingQuest.状态) || '进行中',
    };
    return;
  }
  updateBoardRecord(statData, '委托', title, { ...quest, 状态: '可接取' });
};

const completeQuestTag = (statData: AnyRecord, tag: NarrativeTagLine) => {
  const title = tagValue(tag, ['标题', '名称', '委托']) || tagPrimary(tag, 0);
  if (!title) return;
  removeBoardRecord(statData, '委托', title);
  const questList = ensureRecordAt(statData, ['主角', '任务列表']);
  const existing = asRecord(questList[title]);
  const quest = parseQuestTag(tag, '已完成');
  questList[title] = {
    ...existing,
    ...quest,
    状态: tagValue(tag, ['状态']) || '已完成',
    完成时间: tagValue(tag, ['时间', '完成时间']) || existing.完成时间,
  };
};

const settleQuestTag = (statData: AnyRecord, tag: NarrativeTagLine) => {
  const title = tagValue(tag, ['标题', '名称', '委托']) || tagPrimary(tag, 0);
  if (!title) return;
  delete ensureRecordAt(statData, ['主角', '任务列表'])[title];
  removeBoardRecord(statData, '委托', title);
};

const fixedNpcVariableRecord = (name: string) => {
  const fixed = eldredFixedNpcRegistry.find(npc => npc.name === name || npc.fullName === name);
  if (!fixed) return {};
  return {
    id: fixed.id,
    全名: fixed.fullName,
    种族: fixed.race,
    raceId: fixed.raceId,
    性别: fixed.gender,
    年龄: fixed.age,
    所属: fixed.affiliation,
    身份: fixed.identity,
    职业: fixed.profession,
    classId: fixed.classId,
    头像: fixed.avatarUrl,
    立绘: fixed.portraitUrl,
    等级: fixed.stats.level,
    生命: `${fixed.stats.hp}/${fixed.stats.maxHp}`,
    法力: `${fixed.stats.mp}/${fixed.stats.maxMp}`,
    护甲: fixed.stats.ac,
    五维: {
      力量: fixed.stats.str,
      敏捷: fixed.stats.dex,
      体质: fixed.stats.vit,
      智力: fixed.stats.int,
      精神: fixed.stats.spr,
    },
    经验: fixed.experience,
    下级经验: fixed.nextLevelExperience,
    可分配点数: fixed.availableAttributePoints,
    好感: fixed.favorability,
    关系阶段: fixed.relationshipStage,
    装备: fixed.equipmentIds,
    装备栏: fixed.equipmentLoadout,
    已知技能: fixed.knownSkillIds,
    激活技能: fixed.activeSkillIds,
    特质: fixed.attributes,
  };
};

const classAliasMap: Record<string, CharacterClassId> = {
  圣骑士: 'paladin',
  贤者: 'sage',
  游侠: 'ranger',
  战斗大师: 'battle-master',
  炼金术士: 'alchemist',
  魔导工匠: 'artificer',
  祭司: 'priest',
  召唤师: 'summoner',
};

const raceAliasMap: Record<string, CharacterRaceId> = {
  人类: 'human',
  精灵: 'elf',
  半精灵: 'half-elf',
  矮人: 'dwarf',
  半身人: 'halfling',
  侏儒: 'gnome',
  镜裔: 'mirrorborn',
  潮裔: 'tideborn',
  妖精: 'fae',
  妖精混血: 'fae-blood',
  半妖精: 'fae-blood',
  兽裔: 'beastkin',
  兽人: 'orc',
  地精: 'goblin',
  龙裔: 'dragonborn',
  魔裔: 'tiefling',
  提夫林: 'tiefling',
  天裔: 'aasimar',
  神裔: 'aasimar',
  树裔: 'treeborn',
  羽裔: 'wingborn',
  雪裔: 'frostborn',
  记录灵: 'record-spirit',
  构装体: 'record-spirit',
};

const resolveNpcClassId = (value: unknown, roleText: string): CharacterClassId => {
  const raw = cleanText(value);
  if (raw) {
    const byName = Object.entries(classAliasMap).find(([name, id]) => raw === name || raw === id || raw.includes(name));
    if (byName) return byName[1];
  }
  if (/骑士|卫兵|守门|护卫|巡逻|盾|秩序/.test(roleText)) return 'paladin';
  if (/老板|掌柜|佣兵|教头|打手|矿工|搬运|前排/.test(roleText)) return 'battle-master';
  if (/医|祭|教会|祈|病棚|救济|修道/.test(roleText)) return 'priest';
  if (/药|炼金|毒|草药|药剂|瓶/.test(roleText)) return 'alchemist';
  if (/工匠|修理|机关|铆|锻|矿轨|魔导/.test(roleText)) return 'artificer';
  if (/记录|学徒|书记|档案|账本|观星|教师|贤者/.test(roleText)) return 'sage';
  if (/契约|召唤|使魔|圆阵/.test(roleText)) return 'summoner';
  return 'ranger';
};

const resolveNpcRaceId = (value: unknown, name: string): CharacterRaceId => {
  const raw = cleanText(value);
  if (raw) {
    const byName = Object.entries(raceAliasMap).find(([raceName, id]) => raw === raceName || raw === id || raw.includes(raceName));
    if (byName) return byName[1];
  }
  const pool: CharacterRaceId[] = ['human', 'half-elf', 'halfling', 'dwarf', 'elf', 'beastkin', 'gnome', 'fae-blood'];
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  return pool[hash % pool.length];
};

const attributeRecordFromBase = (attrs: Record<AttributeKey, number>) => ({
  力量: attrs.str,
  敏捷: attrs.dex,
  体质: attrs.vit,
  智力: attrs.int,
  精神: attrs.spr,
});

const syncNpcTag = (statData: AnyRecord, tag: NarrativeTagLine) => {
  const name = tagValue(tag, ['姓名', '名称', '角色']) || tagPrimary(tag, 0);
  if (!name) return;
  const kindText = tag.fields.join('｜');
  const fixedBase = fixedNpcVariableRecord(name);
  const groupName = /主要|主线|固定/.test(kindText) || Object.keys(fixedBase).length ? '主要NPC' : '其他NPC';
  const group = ensureRecordAt(statData, ['主角', '角色收集', groupName]);
  const existing = asRecord(group[name]);
  const base: AnyRecord = { ...asRecord(fixedBase), ...existing };
  const roleText = [
    name,
    tagValue(tag, ['身份', '职责']) || tagPrimary(tag, 1),
    tagValue(tag, ['职业']),
    tagValue(tag, ['所属', '所属地区', '所属地标', '势力']),
    tag.body,
  ].filter(Boolean).join('｜');
  const gender = tagValue(tag, ['性别']) || base.性别 || (/姐|娘|女|姨|婆|娜|娅|莉|妮|莎|薇|拉|雅|琳|菈|姬/.test(name) ? '女' : /哥|叔|伯|爷|男|骑士|矿工|卫兵|队长|老板/.test(name) ? '男' : '中性');
  const raceId = resolveNpcRaceId(tagValue(tag, ['种族']) || base.种族, name);
  const race = getRaceById(raceId);
  const classId = resolveNpcClassId(tagValue(tag, ['职业']) || base.职业, roleText);
  const cls = getClassById(classId);
  const level = numberFromText(tagValue(tag, ['等级', 'Lv', 'LV']) || tag.fields.find(field => /^等级|^Lv|^LV/.test(field)), numberFromText(base.等级, 1));
  const generatedAttrs = generateNpcAttributes(level, classId, raceId, roleText);
  const attrs = {
    力量: numberFromText(tagValue(tag, ['力量']), numberFromText(base.五维?.力量, generatedAttrs.str)),
    敏捷: numberFromText(tagValue(tag, ['敏捷']), numberFromText(base.五维?.敏捷, generatedAttrs.dex)),
    体质: numberFromText(tagValue(tag, ['体质']), numberFromText(base.五维?.体质, generatedAttrs.vit)),
    智力: numberFromText(tagValue(tag, ['智力']), numberFromText(base.五维?.智力, generatedAttrs.int)),
    精神: numberFromText(tagValue(tag, ['精神']), numberFromText(base.五维?.精神, generatedAttrs.spr)),
  };
  const baseAttrs = {
    str: attrs.力量,
    dex: attrs.敏捷,
    vit: attrs.体质,
    int: attrs.智力,
    spr: attrs.精神,
  };
  const derived = calculateDerivedStats(level, classId, baseAttrs, [], raceId);
  const equipmentText = tagValue(tag, ['装备', '装备栏']) || base.装备 || base.装备栏 || `${cls.name}随身装备`;
  const skillText = tagValue(tag, ['已知技能', '激活技能', '技能']) || base.已知技能 || base.技能 || `${cls.name}S1战斗技能×2`;
  group[name] = {
    ...base,
    姓名: name,
    性别: gender,
    年龄: tagValue(tag, ['年龄']) || base.年龄 || (['elf', 'fae', 'treeborn', 'aasimar', 'tiefling', 'record-spirit'].includes(raceId) ? '外貌成年，实际年龄较高' : '成年'),
    种族: tagValue(tag, ['种族']) || base.种族 || race.name,
    所属: tagValue(tag, ['所属', '所属地区', '所属地标', '势力']) || base.所属 || base.所属地区 || '当前地标临时登记',
    身份: tagValue(tag, ['身份', '职责']) || tagPrimary(tag, 1, base.身份),
    职业: tagValue(tag, ['职业']) || base.职业 || cls.name,
    等级: level,
    生命: tagValue(tag, ['HP', '生命', '生命值']) || base.生命 || `${derived.hp}/${derived.maxHp}`,
    法力: tagValue(tag, ['MP', '法力', '法力值']) || base.法力 || `${derived.mp}/${derived.maxMp}`,
    护甲: numberFromText(tagValue(tag, ['AC', '护甲', '护甲等级']), numberFromText(base.护甲, derived.ac)),
    熟练: derived.proficiency,
    五维: attrs,
    属性: attributeRecordFromBase(baseAttrs),
    装备: equipmentText,
    装备栏: base.装备栏 || equipmentText,
    已知技能: skillText,
    激活技能: tagValue(tag, ['激活技能']) || base.激活技能 || skillText,
    特质: tagValue(tag, ['特质']) || base.特质 || `${race.name}；${cls.name}；${tagPrimary(tag, 1, '可回访人物')}`,
  };
};

const syncClueTag = (statData: AnyRecord, tag: NarrativeTagLine) => {
  const phaseText = tagPrimary(tag, 0, tagValue(tag, ['阶段']) || '阶段一');
  const phase = resolveCanonicalPhaseName(phaseText);
  const phaseDef = eldredCanonicalCluePhases.find(item => item.phase === phase);
  if (!phaseDef) return;
  const phaseIndex = eldredCanonicalCluePhases.findIndex(item => item.phase === phaseDef.phase);
  const currentUnlockedPhaseIndex = eldredCanonicalCluePhases.findIndex(item => {
    const row = asRecord(asRecord(asRecord(statData.主线).阶段钥匙册)[item.phase]);
    const clues = asRecord(row.线索);
    const count = item.clues.filter((clue, index) => {
      const record = asRecord(clues[`线索${index + 1}`] ?? clues[clue.id]);
      return cleanText(record.状态 ?? record.status) && cleanText(record.状态 ?? record.status) !== '未解锁';
    }).length;
    return count < 3;
  });
  const allowedPhaseIndex = currentUnlockedPhaseIndex < 0 ? eldredCanonicalCluePhases.length - 1 : currentUnlockedPhaseIndex;
  if (phaseIndex > allowedPhaseIndex) {
    appendFrontendNotice(statData, '线索未成立', `${phaseDef.phase}尚未解锁，已忽略越阶段线索收录。`);
    return;
  }
  const explicitSlotText = tagValue(tag, ['线索位', '槽位']);
  const explicitClueName = tagValue(tag, ['线索', '名称', '标题']);
  const detail = tagValue(tag, ['指向', '详情', '内容']);
  const row = ensureRecordAt(statData, ['主线', '阶段钥匙册', phase]);
  const clues = ensureRecordAt(row, ['线索']);
  let unlockedAny = false;

  const unlockCanonical = (slot: number, overrideDetail = '') => {
    const clue = phaseDef.clues[slot];
    if (!clue) return;
    unlockedAny = true;
    clues[`线索${slot + 1}`] = {
      id: clue.id,
      名称: clue.display,
      显示: clue.display,
      状态: '已解锁',
      指向: overrideDetail || clue.detail,
      详情: overrideDetail || clue.detail,
      发现地点: tagValue(tag, ['地点']) || clue.location,
      载体: clue.carrier,
    };
  };

  if (explicitSlotText) {
    const matched = findCanonicalClueSlot(phase, explicitSlotText);
    if (matched) unlockCanonical(matched.slot, detail || explicitClueName);
  }
  if (explicitClueName) {
    const matched = findCanonicalClueSlot(phase, explicitClueName);
    if (matched) unlockCanonical(matched.slot, detail);
  }
  tag.fields.slice(1).forEach(field => {
    if (/事件|完成|阶段/.test(field)) return;
    const matched = findCanonicalClueSlot(phase, field);
    if (matched) unlockCanonical(matched.slot, detail);
  });

  if (!unlockedAny) {
    appendFrontendNotice(statData, '线索未成立', '本轮线索未匹配固定主线线索表，已作为普通事件处理。');
    return;
  }
  row.状态 = '记录中';
  row.完成度 = `${Math.min(3, Object.keys(clues).length)}/3`;
  if (!row.阶段完成显示) row.阶段完成显示 = phaseDef.eventName;
};

const clampVitalPair = (current: string, max: string) => {
  const safeMax = Math.max(0, Number(max) || 0);
  const safeCurrent = Math.max(0, Math.min(safeMax, Number(current) || 0));
  return `${safeCurrent}/${safeMax}`;
};

const parseCombatUnitField = (field: string) => {
  const hp = field.match(/(-?\d+)\s*\/\s*(-?\d+)\s*HP/i);
  const mp = field.match(/(-?\d+)\s*\/\s*(-?\d+)\s*MP/i);
  const ac = field.match(/AC\s*(\d+)/i);
  if (!hp && !mp && !ac) return null;
  const name = field
    .replace(/-?\d+\s*\/\s*-?\d+\s*HP/ig, '')
    .replace(/-?\d+\s*\/\s*-?\d+\s*MP/ig, '')
    .replace(/AC\s*\d+/ig, '')
    .trim();
  if (!name) return null;
  return {
    name,
    data: {
      生命: hp ? clampVitalPair(hp[1], hp[2]) : undefined,
      法力: mp ? clampVitalPair(mp[1], mp[2]) : undefined,
      护甲: ac ? Number(ac[1]) : undefined,
    },
  };
};

const numericChangeValue = (current: unknown, change: unknown) => {
  const changeText = cleanText(change);
  const base = numberFromText(current, 0);
  if (/^[+-]/.test(changeText)) return base + numberFromText(changeText, 0);
  return numberFromText(changeText, base);
};

const syncCombatTag = (statData: AnyRecord, tag: NarrativeTagLine) => {
  const cache = ensureRecordAt(statData, ['系统', '战斗缓存']);
  const turnField = tag.fields.find(field => /^回合/.test(field));
  if (turnField) cache.回合 = numberFromText(turnField, numberFromText(cache.回合, 1));
  const logs = Array.isArray(cache.日志) ? cache.日志 : Object.values(asRecord(cache.日志));
  cache.日志 = [tag.body, ...logs.map(cleanText).filter(Boolean)].slice(0, 20);
  if (tag.title === '战斗结算' || /结束|结算|胜利|失败|撤离|投降|击退|脱战/.test(tag.body)) {
    cache.状态 = '已结束';
    cache.阶段 = '战斗结束';
    cache.结果 = tag.body;
    cache.敌方 = {};
    cache.行动顺序 = [];
    return;
  }
  const participants = ensureRecordAt(cache, ['参战名单']);
  const enemies = ensureRecordAt(cache, ['敌方']);
  const main = asRecord(statData.主角);
  const identity = asRecord(main.身份 ?? main.角色 ?? main.基本信息);
  const playerAliases = [
    '{{user}}',
    '<user>',
    '主角',
    '玩家',
    cleanText(identity.姓名),
    cleanText(main.姓名),
    cleanText(asRecord(main.战斗).姓名),
  ].filter(Boolean);
  const partyAliases = Object.keys(asRecord(main.当前队伍)).map(cleanText).filter(Boolean);
  const allyAliases = new Set([...playerAliases, ...partyAliases].map(name => name.replace(/[（）()].*?[）)]/g, '').replace(/\s+/g, '').toLowerCase()));
  const isAllyName = (name: string) => {
    const normalized = cleanText(name).replace(/[（）()].*?[）)]/g, '').replace(/\s+/g, '').toLowerCase();
    return Boolean(normalized && (allyAliases.has(normalized) || /\{\{user\}\}|<user>|主角|玩家/i.test(name)));
  };
  tag.fields
    .map(parseCombatUnitField)
    .filter((unit): unit is NonNullable<ReturnType<typeof parseCombatUnitField>> => Boolean(unit))
    .forEach(unit => {
      if (isAllyName(unit.name)) {
        participants[unit.name] = { ...asRecord(participants[unit.name]), ...unit.data, 阵营: '友方', 类型: '角色' };
        delete enemies[unit.name];
      } else {
        enemies[unit.name] = { ...asRecord(enemies[unit.name]), ...unit.data, 阵营: '敌方', 类型: '敌人' };
      }
    });
};

const syncItemTag = (statData: AnyRecord, tag: NarrativeTagLine) => {
  const name = tagValue(tag, ['名称', '物品']) || tagPrimary(tag, 0);
  if (!name) return;
  const bag = ensureRecordAt(statData, ['主角', '背包']);
  const field1 = tagPrimary(tag, 1);
  const field2 = tagPrimary(tag, 2);
  const field1LooksCategory = /装备|消耗|药剂|药水|线索|证据|材料|素材|任务|委托|钥匙|道具|物品|金币|卷轴|符咒/.test(field1);
  const description = tagValue(tag, ['用途', '说明', '描述', '效果', '详情', '内容'])
    || (!/^数量/.test(field2) ? field2 : '')
    || (!field1LooksCategory && !/^来源/.test(field1) ? field1 : '');
  bag[name] = {
    ...asRecord(bag[name]),
    名称: name,
    分类: tagValue(tag, ['分类', '类型']) || (field1LooksCategory ? field1 : asRecord(bag[name]).分类) || '物品',
    数量: numberFromText(tagValue(tag, ['数量']) || tag.fields.find(field => /^数量/.test(field)), 1),
    来源: tagValue(tag, ['来源']) || (!field1LooksCategory ? field1 : asRecord(bag[name]).来源),
    用途: description || asRecord(bag[name]).用途,
    说明: description || asRecord(bag[name]).说明,
  };
};

const syncFavorOrReputation = (statData: AnyRecord, tag: NarrativeTagLine) => {
  if (tag.title === '好感变化') {
    const name = tagPrimary(tag, 0);
    if (!name) return;
    const favor = ensureRecordAt(statData, ['关系', '好感']);
    favor[name] = {
      数值: numericChangeValue(asRecord(favor[name]).数值, tagPrimary(tag, 1)),
      阶段: tagPrimary(tag, 2, asRecord(favor[name]).阶段),
    };
    return;
  }
  const region = tagPrimary(tag, 0);
  if (!region) return;
  const reputation = ensureRecordAt(statData, ['关系', '地区声望']);
  reputation[region] = {
    数值: numericChangeValue(asRecord(reputation[region]).数值, tagPrimary(tag, 1)),
    阶段: tagPrimary(tag, 2, asRecord(reputation[region]).阶段),
  };
};

const syncFortuneFlipTag = (statData: AnyRecord, baseCount?: number) => {
  const fortune = ensureRecordAt(statData, ['系统', '翻牌']);
  const amount = 1;
  fortune.次数 = Math.max(0, (baseCount ?? numberFromText(fortune.次数, 0)) + amount);
  fortune.最近获得 = {
    类型: '翻牌次数',
    数量: amount,
    时间: new Date().toISOString(),
  };
};

const flipCountFromStatData = (statData: unknown) => {
  const system = asRecord(asRecord(statData).系统);
  const fortune = asRecord(system.翻牌 ?? system.抽卡 ?? system.翻牌系统);
  return numberFromText(fortune.次数 ?? fortune.翻牌次数 ?? fortune.count, 0);
};

const syncNarrativeTagsToStatData = (rawText: string, previousStatData: unknown, referenceStatData?: unknown) => {
  const tags = extractNarrativeTagLines(rawText);
  if (!tags.length) return null;
  const nextStatData = cloneRecord(previousStatData);
  const flipBaseCount = flipCountFromStatData(referenceStatData ?? previousStatData);
  let fortuneFlipGranted = false;
  tags.forEach(tag => {
    appendFrontendNotice(nextStatData, tag.title, tag.body);
    if (tag.title === '新闻' || tag.title === '新闻更新') updateBoardRecord(nextStatData, '新闻', boardNewsFromTag(tag, '新闻').标题, boardNewsFromTag(tag, '新闻'));
    if (tag.title === '见闻' || tag.title === '见闻更新') updateBoardRecord(nextStatData, '见闻', boardNewsFromTag(tag, '见闻').标题, boardNewsFromTag(tag, '见闻'));
    if (tag.title === '委托接取' || tag.title === '委托生成' || tag.title === '委托更新') syncQuestTag(nextStatData, tag);
    if (tag.title === '委托完成') completeQuestTag(nextStatData, tag);
    if (tag.title === '委托结算' || tag.title === '奖励结算') settleQuestTag(nextStatData, tag);
    if (tag.title === 'NPC收录') syncNpcTag(nextStatData, tag);
    if (tag.title === '线索收录' || tag.title === '线索更新' || tag.title === '线索进展') syncClueTag(nextStatData, tag);
    if (tag.title === '战斗实况' || tag.title === '战斗回合' || tag.title === '战斗行动' || tag.title === '战斗开始' || tag.title === '战斗结算') syncCombatTag(nextStatData, tag);
    if (tag.title === '获得物品') syncItemTag(nextStatData, tag);
    if (tag.title === '获得一次翻牌次数' && !fortuneFlipGranted) {
      syncFortuneFlipTag(nextStatData, flipBaseCount);
      fortuneFlipGranted = true;
    }
    if (tag.title === '好感变化' || tag.title === '声望变化') syncFavorOrReputation(nextStatData, tag);
  });
  return nextStatData;
};

export const syncEldredNarrativeTagsToStatData = syncNarrativeTagsToStatData;
export const writeEldredStatDataToHost = writeStatDataToHost;
export const extractEldredJsonPatchOperations = extractJsonPatchOperations;
export const applyEldredJsonPatchOperations = applyJsonPatchOperations;
export const getEldredHostFunction = getHostFunction;

const deriveFrontendNoticesFromNarrativeTags = syncNarrativeTagsToStatData;

const openingQuestBoardRecordFrom = (key: string, value: unknown): AnyRecord | null => {
  const source = asRecord(value);
  const title = cleanText(source.标题 ?? source.名称 ?? source.委托 ?? key);
  if (!title) return null;
  return {
    标题: title,
    名称: title,
    来源: cleanText(source.来源 ?? source.发布者 ?? source.委托人),
    任务详情: cleanText(source.任务详情 ?? source.内容 ?? source.目标 ?? source.说明 ?? source.详情),
    建议等级: source.建议等级 ?? source.等级 ?? 1,
    风险: normalizeRiskText(source.风险 ?? source.危险等级) || '中',
    奖励: cleanText(source.奖励 ?? source.报酬),
    时限: cleanText(source.时限 ?? source.截止),
    地点: cleanText(source.地点 ?? source.位置 ?? source.地标),
    状态: '可接取',
    时间: cleanText(source.时间 ?? source.更新),
  };
};

const moveOpeningQuestListToBoard = (statData?: AnyRecord | null) => {
  if (!statData || !Object.keys(statData).length) return null;
  const nextStatData = cloneRecord(statData);
  const questList = asRecord(asRecord(nextStatData.主角).任务列表);
  const entries = Object.entries(questList);
  if (!entries.length) return null;
  const board = ensureRecordAt(nextStatData, ['世界', '动态看板']);
  let changed = false;
  entries.forEach(([key, value]) => {
    const quest = openingQuestBoardRecordFrom(key, value);
    if (!quest) return;
    const title = cleanText(quest.标题);
    board.委托 = recordInsertNewest(asRecord(board.委托), title, quest, 4);
    delete questList[key];
    changed = true;
  });
  if (!changed) return null;
  return nextStatData;
};

const syncGeneratedMvuVariables = async (rawText: string, previous: EldredRuntimeSave) => {
  if (!/<UpdateVariable(?:variable)?\b|<JSONPatch\b/i.test(rawText)) {
    const noticeOnly = deriveFrontendNoticesFromNarrativeTags(rawText, previous.rawStatData || {});
    if (noticeOnly) await writeStatDataToHost(noticeOnly);
    return noticeOnly;
  }
  const mvu = getMvuBridge();
  if (!mvu?.getMvuData || !mvu.parseMessage || !mvu.replaceMvuData) {
    console.warn('[艾尔德雷德] 未检测到完整 MVU 接口，无法解析本次 <UpdateVariable>。');
  } else {
    try {
      const { option, oldData } = resolveMvuWriteContext(mvu);
      const parsed = await mvu.parseMessage(rawText, oldData || {});
      if (!parsed || typeof parsed !== 'object') {
        console.warn('[艾尔德雷德] MVU parseMessage 未返回变量对象。');
      } else {
        await mvu.replaceMvuData(parsed, option);
        const parsedStatData = extractEldredStatData(parsed);
        if (parsedStatData) {
          const noticeOnly = deriveFrontendNoticesFromNarrativeTags(rawText, parsedStatData, extractEldredStatData(oldData) || previous.rawStatData || {});
          if (noticeOnly) await writeStatDataToHost(noticeOnly, { option, oldData: parsed });
          else notifyRuntimeChanged();
          return noticeOnly || parsedStatData;
        }
        notifyRuntimeChanged();
      }
    } catch (error) {
      console.warn('[艾尔德雷德] MVU 同步失败，改用本地 JSONPatch 合并。', error);
    }
  }

  const patchedStatData = applyJsonPatchOperations(previous.rawStatData || {}, extractJsonPatchOperations(rawText));
  if (patchedStatData) {
    const noticeOnly = deriveFrontendNoticesFromNarrativeTags(rawText, patchedStatData);
    await writeStatDataToHost(noticeOnly || patchedStatData);
    return noticeOnly || patchedStatData;
  }
  const noticeOnly = deriveFrontendNoticesFromNarrativeTags(rawText, previous.rawStatData || {});
  if (noticeOnly) {
    await writeStatDataToHost(noticeOnly);
    return noticeOnly;
  }
  return null;
};

const mergeSyncedRuntime = (previous: EldredRuntimeSave, statData?: AnyRecord | null) => {
  const synced = statData ? runtimeFromStatData(statData) : loadEldredRuntimeSave();
  if (synced.source !== 'mvu') return previous;
  const system = asRecord(statData?.系统);
  const hasCombatCache = Object.prototype.hasOwnProperty.call(system, '战斗缓存');
  return {
    ...synced,
    player: mergePlayerWithCachedOpening(synced.player, previous.player),
    npcs: synced.npcs.length ? synced.npcs : previous.npcs,
    quests: synced.quests.length ? synced.quests : previous.quests,
    cluePhases: synced.cluePhases.some(phase => phase.clues.length) ? synced.cluePhases : previous.cluePhases,
    combat: hasCombatCache || synced.combat.enemyUnits.length || synced.combat.logs.length ? synced.combat : previous.combat,
    world: {
      currentTime: synced.world.currentTime || previous.world.currentTime,
      currentLocation: synced.world.currentLocation || previous.world.currentLocation,
      region: synced.world.region || previous.world.region,
      subRegion: synced.world.subRegion || previous.world.subRegion,
      landmark: synced.world.landmark || previous.world.landmark,
      weather: synced.world.weather || previous.world.weather,
      risk: synced.world.risk || previous.world.risk,
      travelState: synced.world.travelState || previous.world.travelState,
      presentCharacters: synced.world.presentCharacters.length ? synced.world.presentCharacters : previous.world.presentCharacters,
      dynamicBoard: synced.world.dynamicBoard.length ? synced.world.dynamicBoard : previous.world.dynamicBoard,
    },
    memory: previous.memory,
    narration: previous.narration,
    messages: previous.messages,
  };
};

const removeBoardItemFromGroup = (group: unknown, item: DynamicBoardItem) => {
  const record = asRecord(group);
  const itemTitle = cleanText(item.title);
  const itemId = cleanText(item.id);
  for (const [key, value] of Object.entries(record)) {
    const source = asRecord(value);
    const title = cleanText(source.标题 ?? source.名称 ?? source.title ?? key);
    const id = cleanText(source.id ?? source.ID ?? key);
    if (key === itemTitle || key === itemId || title === itemTitle || id === itemId) {
      delete record[key];
    }
  }
  return record;
};

export const dismissEldredBoardItem = async (runtime: EldredRuntimeSave, item: DynamicBoardItem) => {
  const statData = cloneRecord(runtime.rawStatData || {});
  if (Object.keys(statData).length) {
    const world = ensureRecordAt(statData, ['世界']);
    const system = ensureRecordAt(statData, ['系统']);
    const board = ensureRecordAt(world, ['动态看板']);
    board[item.type] = removeBoardItemFromGroup(board[item.type], item);
    world[item.type] = removeBoardItemFromGroup(world[item.type], item);
    system[item.type] = removeBoardItemFromGroup(system[item.type], item);
    system[`${item.type}板`] = removeBoardItemFromGroup(system[`${item.type}板`], item);
    if (item.type === '见闻') system.传闻板 = removeBoardItemFromGroup(system.传闻板, item);
    await writeStatDataToHost(statData);
  }

  return persistEldredRuntimeCache({
    ...runtime,
    rawStatData: Object.keys(statData).length ? statData : runtime.rawStatData,
    world: {
      ...runtime.world,
      dynamicBoard: runtime.world.dynamicBoard.filter(boardItem => boardItem.id !== item.id && boardItem.title !== item.title),
    },
    updatedAt: nowIso(),
  });
};

const normalizedInventoryIdentity = (value: unknown) =>
  cleanText(value)
    .replace(/[【】「」《》“”"'`]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();

const recordValueMatchesInventoryItem = (key: string, value: unknown, identifiers: Set<string>) => {
  if (identifiers.has(normalizedInventoryIdentity(key))) return true;
  if (typeof value === 'string' || typeof value === 'number') {
    return identifiers.has(normalizedInventoryIdentity(value));
  }
  const record = asRecord(value);
  return [
    record.id,
    record.ID,
    record.名称,
    record.名字,
    record.标题,
    record.name,
    record.itemId,
    record.equipmentId,
  ].some(candidate => identifiers.has(normalizedInventoryIdentity(candidate)));
};

const removeInventoryRecordMatches = (container: unknown, identifiers: Set<string>) => {
  const record = asRecord(container);
  let changed = false;
  Object.entries(record).forEach(([key, value]) => {
    if (recordValueMatchesInventoryItem(key, value, identifiers)) {
      delete record[key];
      changed = true;
    }
  });
  return changed;
};

const removeInventoryArrayMatches = (container: unknown, identifiers: Set<string>) => {
  if (!Array.isArray(container)) return { value: container, changed: false };
  const next = container.filter((value, index) => !recordValueMatchesInventoryItem(String(index), value, identifiers));
  return { value: next, changed: next.length !== container.length };
};

const removeEquipmentLoadoutMatches = (container: unknown, identifiers: Set<string>) => {
  const record = asRecord(container);
  let changed = false;
  Object.entries(record).forEach(([slot, value]) => {
    if (recordValueMatchesInventoryItem(slot, value, identifiers)) {
      delete record[slot];
      changed = true;
    }
  });
  return changed;
};

export type EldredInventoryDiscardTarget = {
  id?: string;
  name: string;
  category?: string;
  equipmentId?: string;
};

export const discardEldredInventoryItem = async (
  runtime: EldredRuntimeSave,
  item: EldredInventoryDiscardTarget,
) => {
  const statData = cloneRecord(runtime.rawStatData || {});
  const identifiers = new Set(
    [item.id, item.name, item.equipmentId]
      .map(normalizedInventoryIdentity)
      .filter(Boolean),
  );
  if (!identifiers.size) return runtime;

  if (Object.keys(statData).length) {
    const main = ensureRecordAt(statData, ['主角']);
    removeInventoryRecordMatches(main.背包, identifiers);
    removeInventoryRecordMatches(main.物品栏, identifiers);
    const mainInventory = removeInventoryArrayMatches(main.inventory, identifiers);
    if (mainInventory.changed) main.inventory = mainInventory.value;

    const battle = ensureRecordAt(statData, ['主角', '战斗']);
    removeInventoryRecordMatches(battle.装备, identifiers);
    removeInventoryRecordMatches(main.装备, identifiers);
    removeEquipmentLoadoutMatches(battle.装备栏, identifiers);
    removeEquipmentLoadoutMatches(battle.装备位, identifiers);
    removeEquipmentLoadoutMatches(main.装备栏, identifiers);
    removeEquipmentLoadoutMatches(main.装备位, identifiers);
    await writeStatDataToHost(statData);
  }

  const nextPlayer = runtime.player
    ? {
      ...runtime.player,
      inventory: runtime.player.inventory.filter(value => !identifiers.has(normalizedInventoryIdentity(value))),
      equipmentIds: runtime.player.equipmentIds.filter(value => !identifiers.has(normalizedInventoryIdentity(value))),
      equipmentLoadout: Object.fromEntries(
        Object.entries(runtime.player.equipmentLoadout)
          .filter(([, value]) => !identifiers.has(normalizedInventoryIdentity(value))),
      ),
    }
    : runtime.player;

  return persistEldredRuntimeCache({
    ...runtime,
    player: nextPlayer,
    rawStatData: Object.keys(statData).length ? statData : runtime.rawStatData,
    updatedAt: nowIso(),
  });
};

const requestGenerateThroughLoader = (config: AnyRecord) => {
  const requestId = createId('eldred-bridge');
  const parentWindow = safeScope(() => window.parent) as (Window & AnyRecord) | null;
  if (!parentWindow || parentWindow === window) {
    return Promise.reject(Error('未检测到艾尔德雷德脚本桥接。请在 SillyTavern 脚本控制台内运行。'));
  }

  return new Promise<string>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', handleMessage);
      reject(Error('艾尔德雷德脚本生成超时。'));
    }, 600000);

    function handleMessage(event: MessageEvent) {
      const data = event.data || {};
      if (data.source !== 'EldredWelcomeLoader' || data.type !== 'generate-result' || data.requestId !== requestId) return;
      window.clearTimeout(timeout);
      window.removeEventListener('message', handleMessage);
      if (data.ok) resolve(String(data.text || ''));
      else reject(Error(String(data.error || '艾尔德雷德脚本生成失败。')));
    }

    window.addEventListener('message', handleMessage);
    parentWindow.postMessage({
      source: 'EldredWelcome',
      type: 'generate',
      requestId,
      config,
    }, '*');
  });
};

export const hasEldredGenerationBridge = () =>
  Boolean(getHostFunction('generate')) || Boolean(safeScope(() => window.parent) && window.parent !== window);

const noticeTagPattern = new RegExp(`<(${ELDRED_NOTICE_TAGS.join('|')})[^>]*>([\\s\\S]*?)(?:<\\/\\1>|$)`, 'g');

const normalizeNoticeAngleTags = (text: string) =>
  text.replace(noticeTagPattern, (_, tag: string, body: string) => `\n【${tag}】：${String(body || '').trim()}\n`);

const stripControlBlocks = (text: string) =>
  text
    .replace(/<UpdateVariable(?:variable)?\b[^>]*>[\s\S]*?(?:<\/UpdateVariable(?:variable)?>|$)/gi, '')
    .replace(/<Analysis\b[^>]*>[\s\S]*?(?:<\/Analysis>|$)/gi, '')
    .replace(/<JSONPatch\b[^>]*>[\s\S]*?(?:<\/JSONPatch>|<\/UpdateVariable(?:variable)?>|$)/gi, '')
    .replace(/<thinking\b[^>]*>[\s\S]*?(?:<\/thinking>|$)/gi, '')
    .replace(/<time\b[^>]*>[\s\S]*?(?:<\/time>|$)/gi, '')
    .replace(/<recap\b[^>]*>[\s\S]*?(?:<\/recap>|$)/gi, '')
    .replace(/<safe\b[^>]*>[\s\S]*?(?:<\/safe>|$)/gi, '')
    .replace(/<\/?(?:UpdateVariable(?:variable)?|Analysis|JSONPatch|content|thinking|time|recap|safe)\b[^>]*>/gi, '');

const isMetacognitionLine = (line: string) =>
  /^\s*(?:\[|【)?\s*METACOGNITION\s*(?:\]|】)?\s*$/i.test(line)
  || /^\s*(?:[-*]\s*)?(确认语言|确认视角|剧情回顾|玩家输入|用户输入|测试目标|输出目标|变量计划|变量上下文|标签审查|审查段|轨则终审|安全|生成计划|构思草稿|落笔|禁止项|当前测试目标|回复末尾|这只是测试|检查|是否|列出|包含|输出|更新|不推进|不发放|回复)\b/.test(line)
  || /^\s*\d+[.、]\s*(正文|包含|回复|变量|检查|输出|测试|不要|这只是测试)/.test(line);

const stripLeakedMetacognition = (text: string) => {
  const lines = text.split(/\r?\n/);
  const result: string[] = [];
  let dropping = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\s*(?:\[|【)?\s*METACOGNITION\s*(?:\]|】)?\s*$/i.test(trimmed)) {
      dropping = true;
      continue;
    }
    if (dropping) {
      if (!trimmed || isMetacognitionLine(line) || /^[-*]\s+/.test(trimmed) || /^\d+[.、]\s*/.test(trimmed)) continue;
      if (!/^【[^】]{1,32}】[：:]/.test(trimmed) && !/^第?[一二三四五六七八九十\d]+[幕章回]/.test(trimmed)) continue;
      dropping = false;
    }
    if (isMetacognitionLine(line)) continue;
    result.push(line);
  }

  return result.join('\n');
};

export const extractEldredContentBlock = (rawText: string) => {
  const source = String(rawText || '');
  const matches = Array.from(source.matchAll(/<content\b[^>]*>([\s\S]*?)(?:<\/content>|$)/gi))
    .map(match => (match[1] || '').trim())
    .filter(Boolean);
  const content = matches.length ? matches.join('\n\n') : source;
  return stripLeakedMetacognition(stripControlBlocks(normalizeNoticeAngleTags(content)))
    .replace(/<\/?[\u4e00-\u9fa5A-Za-z0-9_-]+[^>]*>/g, '')
    .replace(/\s*\[TIME:[^\]]+\]\s*$/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const formatPlayerFacts = (player: PlayerState | null) => {
  if (!player) return '主角：未登记';
  const cls = getClassById(player.classId);
  const race = getRaceById(player.raceId);
  const stats = (['str', 'dex', 'vit', 'int', 'spr'] as const)
    .map(key => `${ATTRIBUTE_LABELS[key]}${player.stats[key]}`)
    .join(' / ');
  const skills = player.activeSkillIds.map(id => getSkillById(id)?.name || id).join('、') || '无';
  const talents = player.talentIds.map(id => getTalentById(id)?.name || id).join('、') || '无';
  const equipment = Object.values(player.equipmentLoadout)
    .filter(Boolean)
    .map(id => getEquipmentById(id!)?.name || id)
    .join('、') || '无';
  const location = formatEldredLocation(undefined, player.location);
  return [
    `主角：${player.name}`,
    `身份：${player.identity.gender || '未记录'} / ${player.identity.age || '未记录'} / ${player.identity.background || '未记录'}`,
    `种族：${race.name} / ${race.auraName} / ${race.auraEffect}`,
    `职业：${cls.name} / ${cls.classAuraName} / ${cls.classAuraEffect}`,
    `等级：${player.level}，经验：${player.experience}/${player.nextLevelExperience}，可分配点数：${player.availableAttributePoints}`,
    `生命：${player.stats.hp}/${player.stats.maxHp}，法力：${player.stats.mp}/${player.stats.maxMp}，护甲：${player.stats.ac}，熟练：+${player.stats.proficiency || 0}`,
    `五维：${stats}`,
    `伴生天赋：${talents}`,
    `激活技能：${skills}`,
    `装备：${equipment}`,
    `当前位置：${location.fullName} / ${player.location.summary}`,
  ].join('\n');
};

const formatPartyFacts = (party: Character[] = []) => {
  if (!party.length) return '队伍：无同行角色';
  return [
    '队伍：',
    ...party.map(member => {
      const skills = member.activeSkillIds.map(id => getSkillById(id)?.name || id).join('、') || '无';
      return `- ${member.name} / Lv.${member.stats.level || 1} / ${member.profession} / HP ${member.stats.hp}/${member.stats.maxHp} / MP ${member.stats.mp}/${member.stats.maxMp} / 技能 ${skills}`;
    }),
  ].join('\n');
};

const formatEnemyFacts = (enemies: CombatUnit[] = []) => {
  const hostile = enemies.filter(enemy => enemy.isEnemy);
  if (!hostile.length) return '敌方：无登记敌方单位';
  return [
    '敌方：',
    ...hostile.map(enemy => {
      const skills = enemy.skillIds.map(id => getSkillById(id)?.name || id).join('、') || '无';
      return `- ${enemy.name} / Lv.${enemy.level} / HP ${enemy.hp}/${enemy.maxHp} / MP ${enemy.mp}/${enemy.maxMp} / 护甲 ${enemy.ac} / 技能 ${skills} / 状态 ${enemy.statusLogs.join('、') || '无'}`;
    }),
  ].join('\n');
};

export const buildEldredOpeningFacts = (player: PlayerState) => {
  const cls = getClassById(player.classId);
  const race = getRaceById(player.raceId);
  const baseStats = ATTRIBUTE_KEYS
    .map(key => `${ATTRIBUTE_LABELS[key]}${player.baseAttributes[key]}`)
    .join(' / ');
  const raceBonus = ATTRIBUTE_KEYS
    .map(key => `${ATTRIBUTE_LABELS[key]}${(race.attributeBonus[key] || 0) >= 0 ? '+' : ''}${race.attributeBonus[key] || 0}`)
    .join(' / ');
  const finalStats = ATTRIBUTE_KEYS
    .map(key => `${ATTRIBUTE_LABELS[key]}${player.stats[key]}`)
    .join(' / ');
  const skillNames = player.activeSkillIds.map(id => getSkillById(id)?.name).filter(Boolean).join('、') || '无';
  const skillIds = player.activeSkillIds.join('、') || '无';
  const talentNames = player.talentIds.map(id => getTalentById(id)?.name).filter(Boolean).join('、') || '无';
  const equipment = player.equipmentIds.map(id => getEquipmentById(id)?.name).filter(Boolean).join('、') || '无';
  const equipmentSlots = Object.entries(player.equipmentLoadout)
    .map(([slot, id]) => `${slot}:${getEquipmentById(id || '')?.name || id}`)
    .join('、') || '无';
  const location = formatEldredLocation(undefined, player.location);
  return [
    '【艾尔德雷德入局设定】',
    `姓名：${player.name}`,
    `性别：${player.identity.gender || '未记录'}`,
    `年龄：${player.identity.age || '未记录'}`,
    `经历：${player.identity.background || '未记录'}`,
    `种族：${race.name}｜${race.auraName}｜${race.auraEffect}`,
    `职业：${cls.name}｜${cls.classAuraName}｜${cls.classAuraEffect}`,
    `伴生天赋：${talentNames}`,
    `出生点：${location.fullName}`,
    `五维基础点：${baseStats}`,
    `种族修正：${raceBonus}`,
    `五维最终值：${finalStats}`,
    '等级：1',
    `战斗底值：生命${player.stats.maxHp}｜法力${player.stats.maxMp}｜护甲${player.stats.ac}｜熟练+${player.stats.proficiency}`,
    `已选开局技能：${skillNames}`,
    `已选开局技能ID：${skillIds}`,
    `初始装备：${equipment}`,
    `初始装备槽位：${equipmentSlots}`,
    `变量主角路径：主角.身份.姓名=${player.name}｜主角.身份.职业=${cls.name}｜主角.战斗.已知技能=${skillNames}｜主角.战斗.激活技能=${skillNames}`,
  ].join('\n');
};

const ELDRED_MEMORY_BATCH_SIZE = 8;

export const getUnsummarizedEldredEntries = (runtime: EldredRuntimeSave): EldredNarrationEntry[] =>
  [...(runtime.narration.entries || [])]
    .reverse()
    .filter(entry => Boolean(entry.text?.trim()) && !entry.summaryBatchId);

const summarizeEntryLine = (entry: EldredNarrationEntry, index: number) => {
  const text = entry.text.replace(/\s+/g, ' ').trim();
  return `${index + 1}. ${entry.title}｜玩家行动：${entry.userInput || '无'}｜正文：${text.slice(0, 220)}`;
};

const summarizeKnownNpcs = (runtime: EldredRuntimeSave) =>
  runtime.npcs
    .slice(0, 8)
    .map(npc => `${npc.name}（${npc.profession || npc.identity}，${npc.affiliation || '未知地点'}，${npc.stats.hp}/${npc.stats.maxHp}HP）`)
    .join('；') || '暂无关键 NPC 记录';

const summarizeKnownQuests = (runtime: EldredRuntimeSave) =>
  runtime.quests
    .slice(0, 8)
    .map(quest => `${quest.title}（${quest.status}，Lv.${quest.recLevel}，${quest.risk}风险）`)
    .join('；') || '暂无已接/看板委托记录';

const summarizeKnownClues = (runtime: EldredRuntimeSave) =>
  runtime.cluePhases
    .flatMap(phase => phase.clues.filter(clue => clue.status === '已收录').map(clue => `${phase.phase}:${clue.display}`))
    .slice(0, 12)
    .join('；') || '暂无已解锁主线线索';

export const generateEldredStorySummary = (runtime: EldredRuntimeSave): EldredMemorySummaryBatch | null => {
  const pendingEntries = getUnsummarizedEldredEntries(runtime).slice(0, 12);
  if (!pendingEntries.length) return null;
  const world = runtime.world;
  const location = formatEldredLocation(world, runtime.player?.location);
  const createdAtIso = nowIso();
  const summary = [
    `当前地点/时间：${location.fullName}｜${world.currentTime || '未登记'}｜天气${world.weather || '未登记'}｜风险${world.risk || '未登记'}`,
    `已发生事件：\n${pendingEntries.map(summarizeEntryLine).join('\n')}`,
    `已知 NPC 状态和关系：${summarizeKnownNpcs(runtime)}`,
    `已接/已完成委托：${summarizeKnownQuests(runtime)}`,
    `已解锁线索：${summarizeKnownClues(runtime)}`,
    `未解决伏笔：${pendingEntries.map(entry => entry.characterTags?.join('、')).filter(Boolean).slice(-4).join('；') || '等待后续正文确认'}`,
  ].join('\n');
  return {
    id: createId('summary'),
    entryIds: pendingEntries.map(entry => entry.id),
    summary,
    createdAtIso,
  };
};

export const persistEldredMemory = (
  runtime: EldredRuntimeSave,
  batch: EldredMemorySummaryBatch | null,
): EldredRuntimeSave => {
  if (!batch) return runtime;
  const summarizedIds = new Set(batch.entryIds);
  const timestamp = batch.createdAtIso || nowIso();
  const batches = [...(runtime.memory.summary.batches || []), batch].slice(-24);
  const current = batches
    .slice(-3)
    .map((item, index) => `## 内置小结 ${batches.length - Math.min(3, batches.length) + index + 1}\n${item.summary}`)
    .join('\n\n');
  return {
    ...runtime,
    narration: {
      ...runtime.narration,
      entries: runtime.narration.entries.map(entry =>
        summarizedIds.has(entry.id)
          ? { ...entry, summaryBatchId: batch.id, summarizedAtIso: timestamp }
          : entry,
      ),
    },
    memory: {
      summary: {
        current,
        batches,
        lastGeneratedAtIso: timestamp,
        lastError: undefined,
      },
      records: [
        {
          type: 'story_summary',
          id: batch.id,
          entryIds: batch.entryIds,
          summary: batch.summary,
          createdAtIso: timestamp,
        },
        ...(runtime.memory.records || []),
      ].slice(0, 80),
    },
    updatedAt: timestamp,
  };
};

const autoPersistEldredMemory = (runtime: EldredRuntimeSave): EldredRuntimeSave => {
  if (getUnsummarizedEldredEntries(runtime).length < ELDRED_MEMORY_BATCH_SIZE) return runtime;
  return persistEldredMemory(runtime, generateEldredStorySummary(runtime));
};

const buildRuntimeSummary = (runtime: EldredRuntimeSave, party: Character[] = [], enemies: CombatUnit[] = []) => {
  const world = runtime.world;
  const location = formatEldredLocation(world, runtime.player?.location);
  const memorySummary = runtime.memory.summary.current.trim();
  const recent = runtime.narration.entries
    .slice(0, 4)
    .reverse()
    .map(entry => `${entry.title}：${entry.text.slice(0, 160).replace(/\s+/g, ' ')}`)
    .join('\n') || '无';
  return [
    '【艾尔德雷德当前局势】',
    `数据来源：${runtime.source}`,
    `时间：${world.currentTime || '未登记'}`,
    `地点：${location.fullName}`,
    `天气：${world.weather || '未登记'}，风险：${world.risk || '未登记'}，旅行状态：${world.travelState || '未登记'}`,
    `在场角色：${world.presentCharacters.join('、') || '未登记'}`,
    formatPlayerFacts(runtime.player),
    formatPartyFacts(party),
    formatEnemyFacts(enemies),
    memorySummary ? `内置剧情总结：\n${memorySummary}` : '内置剧情总结：暂无',
    `近期正文：\n${recent}`,
  ].join('\n');
};

const buildWorldbookScanText = (runtime: EldredRuntimeSave, input: string, eventType?: string) => [
  '[艾尔德雷德:worldbook-scan]',
  '[艾尔德雷德:运行时]',
  runtime.player ? `[艾尔德雷德:职业:${getClassById(runtime.player.classId).name}]` : '',
  runtime.player ? `[艾尔德雷德:种族:${getRaceById(runtime.player.raceId).name}]` : '',
  runtime.player?.location.name || '',
  runtime.player?.location.landmarkName || '',
  runtime.world.currentLocation || '',
  runtime.world.region || '',
  runtime.world.landmark || '',
  eventType ? `[艾尔德雷德:事件:${eventType}]` : '',
  input,
].filter(Boolean).join('\n');

const buildHistoryPrompts = (runtime: EldredRuntimeSave): StoryPrompt[] => {
  const prompts: StoryPrompt[] = [];
  const memorySummary = runtime.memory.summary.current.trim();
  if (memorySummary) {
    prompts.push({
      role: 'system',
      content: `<additional_settings>\n【艾尔德雷德内置剧情总结】\n${memorySummary}\n</additional_settings>`,
    });
  }
  runtime.messages.slice(-12).forEach(message => prompts.push({
    role: message.role === 'system' ? 'system' : message.role === 'assistant' ? 'assistant' : 'user',
    content: message.role === 'assistant' ? `<content>\n${message.text}\n</content>` : message.text,
  }));
  return prompts;
};

const buildBaseSystemPrompt = (runtime: EldredRuntimeSave, userInput: string, kind: EldredNarrationKind, party: Character[] = [], enemies: CombatUnit[] = []) => [
  '艾尔德雷德脚本控制台事实输入。',
  '脚本控制台负责状态展示、按钮交互、装备槽位、技能装配和存档；战斗命中、伤害、状态变化、经验与升级由正文按规则裁决后写入变量。',
  ELDRED_D20_AUTHORITY_RULE,
  ELDRED_WORLD_ENGINE_PATCH,
  ELDRED_CHAT_BEAUTIFY_RULES,
  kind === 'combat' ? ELDRED_COMBAT_INTERNAL_CHECKLIST : '',
  buildRuntimeSummary(runtime, party, enemies),
  '',
  '本轮输入：',
  userInput,
].filter(Boolean).join('\n\n');

const generateWithEldredPreset = async ({
  runtime,
  userInput,
  systemPrompt,
  worldbookScanText,
}: {
  runtime: EldredRuntimeSave;
  userInput: string;
  systemPrompt: string;
  worldbookScanText: string;
}) => {
  const generate = getHostFunction<(config: AnyRecord) => Promise<string>>('generate') || requestGenerateThroughLoader;
  if (!generate) {
    throw Error('未检测到 Tavern Helper generate()。请在 SillyTavern 脚本控制台内运行。');
  }

  return String(await generate({
    generation_id: createId('eldred-gen'),
    user_input: userInput,
    should_stream: false,
    should_silence: false,
    max_chat_history: 0,
    injects: [
      { role: 'system', content: systemPrompt, position: 'in_chat', depth: 0, should_scan: false },
      { role: 'system', content: worldbookScanText, position: 'none', depth: 0, should_scan: true },
    ],
    overrides: {
      chat_history: {
        with_depth_entries: true,
        prompts: buildHistoryPrompts(runtime),
      },
    },
  }));
};

const extractCharacterTags = (text: string) =>
  Array.from(new Set(Array.from(text.matchAll(/【([^】]{1,32})】[：:]/g)).map(match => match[1]))).slice(0, 12);

type GeneratedEntryDraft = Omit<EldredNarrationEntry, 'id' | 'createdAt' | 'variants' | 'activeVariantIndex'> & {
  rawText?: string;
};

const createNarrationVariant = (
  text: string,
  rawText: string | undefined,
  rawStatDataAfter: AnyRecord | undefined,
  sourceEventType: string | undefined,
  createdAtIso: string,
): EldredNarrationVariant => ({
  id: createId('nar-var'),
  text,
  rawText,
  rawStatDataAfter: cloneRecord(rawStatDataAfter || {}),
  createdAtIso,
  sourceEventType,
});

const variantsForEntry = (entry: EldredNarrationEntry): EldredNarrationVariant[] =>
  entry.variants?.length
    ? entry.variants
    : [{
      id: `${entry.id || createId('nar')}-var-0`,
      text: entry.text,
      rawText: '',
      rawStatDataAfter: cloneRecord(entry.rawStatDataAfter || {}),
      createdAtIso: entry.createdAt,
      sourceEventType: entry.sourceEventType,
    }];

const appendNarrationMessagePair = (
  messages: EldredRuntimeMessage[],
  userInput: string,
  assistantText: string,
  timestamp: string,
) => {
  const nextUserMessage: EldredRuntimeMessage = {
    id: createId('msg'),
    role: 'user',
    text: userInput,
    createdAt: timestamp,
  };
  const nextAssistantMessage: EldredRuntimeMessage = {
    id: createId('msg'),
    role: 'assistant',
    text: assistantText,
    createdAt: timestamp,
  };
  return [...messages, nextUserMessage, nextAssistantMessage].slice(-40);
};

const appendGeneratedEntry = (
  runtime: EldredRuntimeSave,
  entry: GeneratedEntryDraft,
) => {
  const timestamp = nowIso();
  const { rawText, ...entryData } = entry;
  const nextId = createId('nar');
  const variant = createNarrationVariant(
    entry.text,
    rawText,
    entry.rawStatDataAfter,
    entry.sourceEventType,
    timestamp,
  );
  const nextEntry: EldredNarrationEntry = {
    ...entryData,
    id: nextId,
    createdAt: timestamp,
    variants: [variant],
    activeVariantIndex: 0,
  };
  return persistEldredRuntimeCache(autoPersistEldredMemory({
    ...runtime,
    narration: {
      entries: [
        nextEntry,
        ...runtime.narration.entries,
      ].slice(0, 80),
      lastGeneratedAt: timestamp,
      lastError: undefined,
    },
    messages: appendNarrationMessagePair(runtime.messages, entry.userInput, entry.text, timestamp),
    updatedAt: timestamp,
  }));
};

const stripNarrationMessagePair = (
  messages: EldredRuntimeMessage[],
  latest: EldredNarrationEntry,
) => {
  for (let index = messages.length - 2; index >= 0; index -= 1) {
    const userMessage = messages[index];
    const assistantMessage = messages[index + 1];
    if (
      userMessage?.role === 'user'
      && assistantMessage?.role === 'assistant'
      && userMessage.text === latest.userInput
      && assistantMessage.text === latest.text
    ) {
      return [
        ...messages.slice(0, index),
        ...messages.slice(index + 2),
      ];
    }
  }
  return messages;
};

const persistGenerationError = (runtime: EldredRuntimeSave, error: unknown) => {
  const text = error instanceof Error ? error.message : String(error);
  return persistEldredRuntimeCache({
    ...runtime,
    narration: {
      ...runtime.narration,
      lastError: text,
    },
    updatedAt: nowIso(),
  });
};

export const generateEldredNarrationFromInput = async (
  runtime: EldredRuntimeSave,
  userInput: string,
  kind: EldredNarrationKind = 'free',
) => {
  const trimmedInput = userInput.trim();
  if (!trimmedInput) return runtime;
  try {
    const rawStatDataBefore = cloneRecord(runtime.rawStatData || {});
    const rawText = await generateWithEldredPreset({
      runtime,
      userInput: trimmedInput,
      systemPrompt: buildBaseSystemPrompt(runtime, trimmedInput, kind),
      worldbookScanText: buildWorldbookScanText(runtime, trimmedInput, kind),
    });
    const statData = await syncGeneratedMvuVariables(rawText, runtime);
    const syncedRuntime = mergeSyncedRuntime(runtime, statData);
    const content = extractEldredContentBlock(rawText);
    return appendGeneratedEntry(syncedRuntime, {
      kind,
      title: kind === 'combat' ? '战斗回合' : '玩家行动',
      userInput: trimmedInput,
      text: content,
      rawText,
      characterTags: extractCharacterTags(content),
      rawStatDataBefore,
      rawStatDataAfter: cloneRecord(statData || syncedRuntime.rawStatData || rawStatDataBefore),
    });
  } catch (error) {
    return persistGenerationError(runtime, error);
  }
};

export const generateEldredNarrationFromOpening = async (runtime: EldredRuntimeSave, player: PlayerState) => {
  const openingFacts = buildEldredOpeningFacts(player);
  const userInput = '进入艾尔德雷德。';
  const systemPrompt = [
    buildBaseSystemPrompt(runtime, openingFacts, 'opening'),
    '生成第一幕正文。只按入局设定初始化变量；未选择技能、默认剧情、默认队友、默认背包、默认好感、默认声望不得写入。必须把姓名、性别、年龄、经历、种族、职业、五维、战斗底值、已选开局技能、初始装备写入主角变量。需要基于出生点和第一幕事实生成4条本地新闻/见闻与4条可接委托，并写入变量；每条新闻/见闻的内容字段不少于50个汉字，必须有标题、内容、地点、来源、状态、时间。需要输出 <content> 与 <UpdateVariable>。',
    '变量写入必须使用主角.身份.姓名、主角.身份.性别、主角.身份.年龄、主角.身份.经历、主角.身份.种族、主角.身份.职业、主角.战斗.已知技能、主角.战斗.激活技能、世界.当前时间、世界.当前地点、世界.在场角色。新闻/见闻必须写入世界.动态看板.新闻或世界.动态看板.见闻；第一幕生成的委托必须写入世界.动态看板.委托且状态=可接取，不得写入主角.任务列表，不得标记进行中。',
  ].join('\n\n');
  try {
    const rawStatDataBefore = cloneRecord(runtime.rawStatData || {});
    const rawText = await generateWithEldredPreset({
      runtime,
      userInput,
      systemPrompt,
      worldbookScanText: buildWorldbookScanText(runtime, openingFacts, 'opening_setup'),
    });
    const statData = await syncGeneratedMvuVariables(rawText, runtime);
    const openingStatData = moveOpeningQuestListToBoard(statData) || statData;
    if (openingStatData && openingStatData !== statData) await writeStatDataToHost(openingStatData);
    const syncedRuntime = mergeSyncedRuntime(runtime, openingStatData);
    const content = extractEldredContentBlock(rawText);
    return appendGeneratedEntry(syncedRuntime, {
      kind: 'opening',
      title: '第一幕',
      userInput: openingFacts,
      text: content,
      rawText,
      sourceEventType: 'opening_setup',
      characterTags: extractCharacterTags(content),
      rawStatDataBefore,
      rawStatDataAfter: cloneRecord(openingStatData || syncedRuntime.rawStatData || rawStatDataBefore),
    });
  } catch (error) {
    return persistGenerationError(runtime, error);
  }
};

export const generateEldredNarrationFromEvent = async (
  runtime: EldredRuntimeSave,
  input: EldredFrontendEventInput,
) => {
  const eventPayload = buildEldredFrontendEventPayload(input);
  const kind: EldredNarrationKind = input.eventType === 'combat_command' ? 'combat' : 'event';
  const party = input.party || [];
  const enemies = input.enemies || [];
  const userInput = input.playerIntent || input.title || '前端事件';
  const eventRule = input.eventType === 'combat_command'
    ? '按当前变量、世界书和战斗指令生成下一段正文；combat_command 是玩家战斗意图，不是已结算结果。需要裁决命中、伤害、消耗、状态、经验和胜负，并输出 <content> 与 <UpdateVariable> 写回系统.战斗缓存。'
    : '按当前变量、世界书和前端权威事件生成下一段正文；事件中的 result 与 authoritative_state_after_event 已经发生。需要输出 <content> 与 <UpdateVariable>，变量写回必须与前端结果一致。';
  const systemPrompt = [
    buildBaseSystemPrompt(runtime, eventPayload, kind, party, enemies),
    eventRule,
  ].join('\n\n');
  try {
    const rawStatDataBefore = cloneRecord(runtime.rawStatData || {});
    const rawText = await generateWithEldredPreset({
      runtime,
      userInput,
      systemPrompt,
      worldbookScanText: buildWorldbookScanText(runtime, `${eventPayload}\n${userInput}`, input.eventType),
    });
    const statData = await syncGeneratedMvuVariables(rawText, runtime);
    const syncedRuntime = mergeSyncedRuntime(runtime, statData);
    const content = extractEldredContentBlock(rawText);
    return appendGeneratedEntry(syncedRuntime, {
      kind,
      title: input.title || '事件推进',
      userInput,
      text: content,
      rawText,
      sourceEventType: input.eventType,
      characterTags: extractCharacterTags(content),
      rawStatDataBefore,
      rawStatDataAfter: cloneRecord(statData || syncedRuntime.rawStatData || rawStatDataBefore),
    });
  } catch (error) {
    return persistGenerationError(runtime, error);
  }
};

export const rerollLatestEldredNarration = async (runtime: EldredRuntimeSave) => {
  const latest = runtime.narration.entries[0];
  if (!latest) return runtime;
  const restoredStatData = cloneRecord(latest.rawStatDataBefore || {});
  if (Object.keys(restoredStatData).length) await writeStatDataToHost(restoredStatData);
  const sourceRuntimeBase: EldredRuntimeSave = {
    ...runtime,
    rawStatData: Object.keys(restoredStatData).length ? restoredStatData : runtime.rawStatData,
    narration: {
      ...runtime.narration,
      entries: runtime.narration.entries.filter(entry => entry.id !== latest.id),
      lastError: undefined,
    },
    messages: stripNarrationMessagePair(runtime.messages, latest),
    updatedAt: nowIso(),
  };
  const sourceRuntime = Object.keys(restoredStatData).length
    ? mergeSyncedRuntime({ ...sourceRuntimeBase, rawStatData: restoredStatData }, restoredStatData)
    : sourceRuntimeBase;
  const rerollPrompt = [
    buildBaseSystemPrompt(sourceRuntime, latest.userInput, latest.kind),
    '重新生成当前轮正文。保留本轮输入事实，替换上一版正文。需要输出 <content> 与 <UpdateVariable>。',
  ].join('\n\n');
  try {
    const rawStatDataBefore = cloneRecord(sourceRuntime.rawStatData || restoredStatData);
    const rawText = await generateWithEldredPreset({
      runtime: sourceRuntime,
      userInput: latest.userInput,
      systemPrompt: rerollPrompt,
      worldbookScanText: buildWorldbookScanText(sourceRuntime, latest.userInput, latest.sourceEventType || latest.kind),
    });
    const statData = await syncGeneratedMvuVariables(rawText, sourceRuntime);
    const syncedRuntime = mergeSyncedRuntime(runtime, statData);
    const content = extractEldredContentBlock(rawText);
    const timestamp = nowIso();
    const rawStatDataAfter = cloneRecord(statData || syncedRuntime.rawStatData || rawStatDataBefore);
    const variants = variantsForEntry(latest);
    const nextVariant = createNarrationVariant(content, rawText, rawStatDataAfter, latest.sourceEventType, timestamp);
    const nextEntry: EldredNarrationEntry = {
      ...latest,
      text: content,
      characterTags: extractCharacterTags(content),
      rawStatDataAfter,
      variants: [...variants, nextVariant],
      activeVariantIndex: variants.length,
    };
    return persistEldredRuntimeCache(autoPersistEldredMemory({
      ...syncedRuntime,
      narration: {
        ...syncedRuntime.narration,
        entries: syncedRuntime.narration.entries.map(entry => (entry.id === latest.id ? nextEntry : entry)),
        lastGeneratedAt: timestamp,
        lastError: undefined,
      },
      messages: appendNarrationMessagePair(stripNarrationMessagePair(runtime.messages, latest), latest.userInput, content, timestamp),
      updatedAt: timestamp,
    }));
  } catch (error) {
    return persistGenerationError(runtime, error);
  }
};

export const selectEldredNarrationVariant = async (
  runtime: EldredRuntimeSave,
  entryId: string,
  variantIndex: number,
) => {
  const target = runtime.narration.entries.find(entry => entry.id === entryId);
  if (!target) return runtime;
  const variants = variantsForEntry(target);
  const normalizedIndex = Math.min(Math.max(0, variantIndex), variants.length - 1);
  const selected = variants[normalizedIndex];
  if (!selected) return runtime;

  const restoredStatData = cloneRecord(selected.rawStatDataAfter || target.rawStatDataAfter || {});
  if (Object.keys(restoredStatData).length) await writeStatDataToHost(restoredStatData);
  const syncedRuntime = Object.keys(restoredStatData).length
    ? mergeSyncedRuntime({ ...runtime, rawStatData: restoredStatData }, restoredStatData)
    : runtime;
  const updatedEntry: EldredNarrationEntry = {
    ...target,
    text: selected.text,
    rawStatDataAfter: restoredStatData,
    activeVariantIndex: normalizedIndex,
    variants,
    sourceEventType: selected.sourceEventType || target.sourceEventType,
  };
  const timestamp = nowIso();
  return persistEldredRuntimeCache({
    ...syncedRuntime,
    narration: {
      ...syncedRuntime.narration,
      entries: syncedRuntime.narration.entries.map(entry => (entry.id === entryId ? updatedEntry : entry)),
      lastError: undefined,
    },
    messages: appendNarrationMessagePair(stripNarrationMessagePair(runtime.messages, target), target.userInput, selected.text, timestamp),
    updatedAt: timestamp,
  });
};
