import { Character, CombatUnit, PlayerState } from '../types';
import { ELDRED_CHAT_BEAUTIFY_RULES, ELDRED_COMBAT_INTERNAL_CHECKLIST, ELDRED_WORLD_ENGINE_PATCH } from './aiIntegration';
import { buildEldredFrontendEventPayload, EldredFrontendEventInput } from './eldredEvents';
import {
  ATTRIBUTE_LABELS,
  getClassById,
  getEquipmentById,
  getRaceById,
  getSkillById,
  getTalentById,
} from './rules';
import {
  EldredNarrationEntry,
  EldredNarrationKind,
  EldredRuntimeMessage,
  EldredRuntimeSave,
  extractEldredStatData,
  loadEldredRuntimeSave,
  persistEldredRuntimeCache,
  runtimeFromStatData,
} from './eldredSave';
import { formatEldredLocation } from './locationFormat';
import { eldredNPCs } from '../data';

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
      console.warn('[艾尔德雷德] 标签变量写回 MVU 失败，尝试消息变量写回。', error);
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

const textValue = (value: unknown, fallback = '') => String(value ?? fallback).trim();

const splitTagPayload = (body: string) =>
  String(body || '')
    .split(/[｜|]/)
    .map(part => part.trim())
    .filter(Boolean);

const parseSignedNumber = (value: unknown) => {
  const match = textValue(value).match(/[+-]?\d+/);
  return match ? Number(match[0]) : 0;
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

const knownNpc = (name: string) =>
  eldredNPCs.find(npc => npc.name === name || npc.fullName.includes(name));

const npcStatRecord = (name: string, identity: string) => {
  const known = knownNpc(name);
  if (known) {
    return {
      身份: identity || known.identity,
      职责: identity || known.identity,
      职业: known.profession,
      种族: known.race,
      性别: known.gender,
      年龄: known.age,
      所属: known.affiliation,
      等级: known.stats.level || 1,
      HP: `${known.stats.hp}/${known.stats.maxHp}`,
      MP: `${known.stats.mp}/${known.stats.maxMp}`,
      AC: known.stats.ac,
      属性: {
        力量: known.stats.str,
        敏捷: known.stats.dex,
        体质: known.stats.vit,
        智力: known.stats.int,
        精神: known.stats.spr,
      },
      装备: known.equipmentIds,
      已知技能: known.knownSkillIds,
      激活技能: known.activeSkillIds,
      经验: known.experience,
      下级经验: known.nextLevelExperience,
      可分配点数: known.availableAttributePoints,
      战斗: {
        等级: known.stats.level || 1,
        生命: `${known.stats.hp}/${known.stats.maxHp}`,
        法力: `${known.stats.mp}/${known.stats.maxMp}`,
        护甲: known.stats.ac,
        五维: {
          力量: known.stats.str,
          敏捷: known.stats.dex,
          体质: known.stats.vit,
          智力: known.stats.int,
          精神: known.stats.spr,
        },
        已知技能: known.knownSkillIds,
        激活技能: known.activeSkillIds,
      },
      好感: known.favorability,
      关系阶段: known.relationshipStage,
    };
  }
  return {
    身份: identity || '路人',
    职责: identity || '路人',
    职业: '学徒',
    种族: '人类',
    性别: '未记录',
    年龄: '未记录',
    等级: 1,
    HP: '12/12',
    MP: '4/4',
    AC: 10,
    属性: { 力量: 1, 敏捷: 2, 体质: 2, 智力: 2, 精神: 2 },
    装备: {},
    已知技能: {},
    激活技能: {},
    经验: 0,
    下级经验: 100,
    可分配点数: 0,
    战斗: {
      等级: 1,
      生命: '12/12',
      法力: '4/4',
      护甲: 10,
      五维: { 力量: 1, 敏捷: 2, 体质: 2, 智力: 2, 精神: 2 },
      已知技能: [],
      激活技能: [],
    },
    好感: 0,
    关系阶段: '陌生',
  };
};

const parseFieldFromParts = (parts: string[], label: string) => {
  const item = parts.find(part => part.startsWith(`${label}:`) || part.startsWith(`${label}：`));
  return item ? item.replace(new RegExp(`^${label}[:：]\\s*`), '').trim() : '';
};

const extractNarrativeTagLines = (rawText: string) =>
  String(rawText || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .map(line => line.match(/^【([^】]{1,32})】[：:]\s*(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match && ELDRED_NOTICE_TAGS.includes(match[1])))
    .map(match => ({ title: match[1], body: match[2].trim() }));

const deriveStatDataFromNarrativeTags = (rawText: string, previousStatData: unknown) => {
  const tags = extractNarrativeTagLines(rawText);
  if (!tags.length) return null;
  const nextStatData = cloneRecord(previousStatData);
  const world = ensureRecordAt(nextStatData, ['世界']);
  const main = ensureRecordAt(nextStatData, ['主角']);
  const relation = ensureRecordAt(nextStatData, ['关系']);
  const system = ensureRecordAt(nextStatData, ['系统']);
  let changed = false;

  for (const tag of tags) {
    const parts = splitTagPayload(tag.body);
    appendFrontendNotice(nextStatData, tag.title, tag.body);
    changed = true;

    if (tag.title === '地点解锁' || tag.title === '地图加载' || tag.title === '路径行动') {
      const [region, subRegion, landmark] = parts;
      if (region) world.大区域 = region;
      if (subRegion) world.子区域 = subRegion;
      if (landmark) world.具体地标 = landmark;
      if (region || subRegion) world.当前地点 = [region, subRegion].filter(Boolean).join('·');
      continue;
    }

    if (tag.title === '获得物品') {
      const [name, category, amountText] = parts;
      if (!name) continue;
      const backpack = ensureRecordAt(main, ['背包']);
      backpack[name] = {
        名称: name,
        分类: category || '物品',
        数量: Math.max(1, parseSignedNumber(amountText || 1)),
        状态: '已获得',
      };
      continue;
    }

    if (/^委托/.test(tag.title)) {
      const [questName, ...rest] = parts;
      if (!questName) continue;
      const source = parseFieldFromParts(rest, '来源') || textValue((main.任务列表?.[questName] || {}).来源, '');
      const recLevel = parseSignedNumber(parseFieldFromParts(rest, '建议等级') || 1) || 1;
      const risk = parseFieldFromParts(rest, '风险') || textValue((main.任务列表?.[questName] || {}).风险, '低');
      const reward = parseFieldFromParts(rest, '奖励') || textValue((main.任务列表?.[questName] || {}).奖励, '');
      const quests = ensureRecordAt(main, ['任务列表']);
      quests[questName] = {
        ...(isRecord(quests[questName]) ? quests[questName] : {}),
        标题: questName,
        来源: source,
        建议等级: recLevel,
        风险: risk,
        奖励: reward,
        状态: tag.title === '委托完成' ? '已完成' : '已接取',
      };
      const boardQuests = ensureRecordAt(world, ['动态看板', '委托']);
      boardQuests[questName] = {
        标题: questName,
        任务详情: tag.body,
        来源: source,
        地点: textValue(world.当前地点),
        风险: risk,
        奖励: reward,
        报酬: reward,
        建议等级: recLevel,
        状态: tag.title === '委托完成' ? '已完成' : '可接取',
      };
      continue;
    }

    if (['新闻', '新闻更新', '见闻', '见闻更新', '看板更新'].includes(tag.title)) {
      const boardType = tag.title.includes('见闻') ? '见闻' : '新闻';
      const [title, ...rest] = parts;
      const itemTitle = title || tag.body;
      const board = ensureRecordAt(world, ['动态看板', boardType]);
      board[itemTitle] = {
        标题: itemTitle,
        详情描述: rest.join('｜') || tag.body,
        来源: parseFieldFromParts(rest, '来源'),
        地点: textValue(world.当前地点),
        状态: parseFieldFromParts(rest, '状态') || '记录中',
      };
      continue;
    }

    if (tag.title === 'NPC收录') {
      const [name, identity, npcType] = parts;
      if (!name) continue;
      const collectionType = /主要/.test(npcType || '') ? '主要NPC' : '其他NPC';
      const collection = ensureRecordAt(main, ['角色收集', collectionType]);
      collection[name] = {
        ...(isRecord(collection[name]) ? collection[name] : {}),
        ...npcStatRecord(name, identity || ''),
        类型: npcType || collectionType,
      };
      continue;
    }

    if (tag.title === '好感变化') {
      const [name, deltaText, stage] = parts;
      if (!name) continue;
      const favor = ensureRecordAt(relation, ['好感']);
      const current = isRecord(favor[name]) ? parseSignedNumber(favor[name].数值) : parseSignedNumber(favor[name]);
      favor[name] = {
        数值: current + parseSignedNumber(deltaText),
        阶段: stage || textValue(isRecord(favor[name]) ? favor[name].阶段 : '', '陌生'),
        最近变化: tag.body,
      };
      continue;
    }

    if (tag.title === '声望变化') {
      const [region, deltaText, tier] = parts;
      if (!region) continue;
      const reputations = ensureRecordAt(relation, ['地区声望']);
      const current = isRecord(reputations[region]) ? parseSignedNumber(reputations[region].数值) : parseSignedNumber(reputations[region]);
      reputations[region] = {
        数值: current + parseSignedNumber(deltaText),
        阶段: tier || textValue(isRecord(reputations[region]) ? reputations[region].阶段 : '', '听闻'),
        最近变化: tag.body,
      };
      continue;
    }

    if (/^线索/.test(tag.title)) {
      const stageName = parts.find(part => /^阶段[一二三四五六七1-7]/.test(part)) || '风声汇账';
      const clueName = parts.find(part => part !== stageName) || tag.body;
      const stageBook = ensureRecordAt(nextStatData, ['主线', '阶段钥匙册', stageName]);
      const clues = ensureRecordAt(stageBook, ['线索']);
      clues[clueName] = {
        显示: clueName,
        状态: '已发现',
        发现地点: textValue(world.当前地点),
        展开详情: tag.body,
      };
      stageBook.完成度 = `${Math.min(3, Object.keys(clues).length)}/3`;
      stageBook.状态 = '记录中';
      continue;
    }

    if (tag.title === '战斗实况') {
      const roundMatch = tag.body.match(/回合\s*(\d+)/);
      system.战斗缓存 = {
        ...(isRecord(system.战斗缓存) ? system.战斗缓存 : {}),
        回合: roundMatch ? Number(roundMatch[1]) : 1,
        回合变化: [tag.body],
      };
    }
  }

  return changed ? nextStatData : null;
};

const overlayNarrativeTags = (rawText: string, baseStatData: unknown) =>
  deriveStatDataFromNarrativeTags(rawText, baseStatData) || (isRecord(baseStatData) ? baseStatData : null);

const syncGeneratedMvuVariables = async (rawText: string, previous: EldredRuntimeSave) => {
  if (!/<UpdateVariable(?:variable)?\b|<JSONPatch\b/i.test(rawText)) {
    const derived = deriveStatDataFromNarrativeTags(rawText, previous.rawStatData || {});
    if (derived) await writeStatDataToHost(derived);
    return derived;
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
          const overlaid = overlayNarrativeTags(rawText, parsedStatData);
          if (overlaid) await writeStatDataToHost(overlaid, { option, oldData: parsed });
          else notifyRuntimeChanged();
          return overlaid;
        }
        notifyRuntimeChanged();
      }
    } catch (error) {
      console.warn('[艾尔德雷德] MVU 同步失败，改用本地 JSONPatch 合并。', error);
    }
  }

  const patchedStatData = applyJsonPatchOperations(previous.rawStatData || {}, extractJsonPatchOperations(rawText));
  if (patchedStatData) {
    const overlaid = overlayNarrativeTags(rawText, patchedStatData);
    if (overlaid) await writeStatDataToHost(overlaid);
    return overlaid;
  }
  const derived = deriveStatDataFromNarrativeTags(rawText, previous.rawStatData || {});
  if (derived) {
    await writeStatDataToHost(derived);
    return derived;
  }
  return null;
};

const mergeSyncedRuntime = (previous: EldredRuntimeSave, statData?: AnyRecord | null) => {
  const synced = statData ? runtimeFromStatData(statData) : loadEldredRuntimeSave();
  if (synced.source !== 'mvu') return previous;
  return {
    ...synced,
    player: synced.player || previous.player,
    npcs: synced.npcs.length ? synced.npcs : previous.npcs,
    quests: synced.quests.length ? synced.quests : previous.quests,
    cluePhases: synced.cluePhases.some(phase => phase.clues.length) ? synced.cluePhases : previous.cluePhases,
    combat: synced.combat.enemyUnits.length || synced.combat.logs.length ? synced.combat : previous.combat,
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
    narration: previous.narration,
    messages: previous.messages,
  };
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

const ELDRED_NOTICE_TAGS = [
  '获得物品',
  '获得技能',
  '技能入库',
  '装备变更',
  '购买结算',
  '新闻',
  '新闻更新',
  '见闻',
  '见闻更新',
  '看板更新',
  '委托更新',
  '委托接取',
  '委托生成',
  '委托完成',
  'NPC收录',
  '线索收录',
  '线索更新',
  '线索进展',
  '地点解锁',
  '地图加载',
  '路径行动',
  '事件推进',
  '事件进展',
  '奇遇事件',
  '翻牌结果',
  '主线进展',
  '好感变化',
  '声望变化',
  '角色升级',
  '升级提示',
  '队伍编成',
  '行动判定',
  '战斗开始',
  '先攻判定',
  '战斗行动',
  '战斗回合',
  '战斗结算',
  '战斗实况',
  '技能演出',
];

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
  const stats = (['str', 'dex', 'vit', 'int', 'spr'] as const)
    .map(key => `${ATTRIBUTE_LABELS[key]}${player.stats[key]}`)
    .join(' / ');
  const skillNames = player.activeSkillIds.map(id => getSkillById(id)?.name).filter(Boolean).join('、') || '无';
  const talentNames = player.talentIds.map(id => getTalentById(id)?.name).filter(Boolean).join('、') || '无';
  const equipment = player.equipmentIds.map(id => getEquipmentById(id)?.name).filter(Boolean).join('、') || '无';
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
    `五维：${stats}`,
    '等级：1',
    `战斗底值：生命${player.stats.maxHp}｜法力${player.stats.maxMp}｜护甲${player.stats.ac}｜熟练+${player.stats.proficiency}`,
    `已选开局技能：${skillNames}`,
    `初始装备：${equipment}`,
  ].join('\n');
};

const buildRuntimeSummary = (runtime: EldredRuntimeSave, party: Character[] = [], enemies: CombatUnit[] = []) => {
  const world = runtime.world;
  const location = formatEldredLocation(world, runtime.player?.location);
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

const buildHistoryPrompts = (runtime: EldredRuntimeSave): StoryPrompt[] =>
  runtime.messages.slice(-12).map(message => ({
    role: message.role === 'system' ? 'system' : message.role === 'assistant' ? 'assistant' : 'user',
    content: message.role === 'assistant' ? `<content>\n${message.text}\n</content>` : message.text,
  }));

const buildBaseSystemPrompt = (runtime: EldredRuntimeSave, userInput: string, kind: EldredNarrationKind, party: Character[] = [], enemies: CombatUnit[] = []) => [
  '艾尔德雷德脚本控制台事实输入。',
  '脚本控制台负责权威状态、按钮交互、战斗数值、装备槽位、技能装配和存档；正文负责演绎、场景反应、变量同步和沉浸提示。',
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

const appendGeneratedEntry = (
  runtime: EldredRuntimeSave,
  entry: Omit<EldredNarrationEntry, 'id' | 'createdAt'>,
) => {
  const timestamp = nowIso();
  const nextUserMessage: EldredRuntimeMessage = {
    id: createId('msg'),
    role: 'user',
    text: entry.userInput,
    createdAt: timestamp,
  };
  const nextAssistantMessage: EldredRuntimeMessage = {
    id: createId('msg'),
    role: 'assistant',
    text: entry.text,
    createdAt: timestamp,
  };
  return persistEldredRuntimeCache({
    ...runtime,
    narration: {
      entries: [
        {
          ...entry,
          id: createId('nar'),
          createdAt: timestamp,
        },
        ...runtime.narration.entries,
      ].slice(0, 80),
      lastGeneratedAt: timestamp,
      lastError: undefined,
    },
    messages: [...runtime.messages, nextUserMessage, nextAssistantMessage].slice(-40),
    updatedAt: timestamp,
  });
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

const runtimeWithoutLatestNarration = (runtime: EldredRuntimeSave, latest: EldredNarrationEntry): EldredRuntimeSave => ({
  ...runtime,
  narration: {
    ...runtime.narration,
    entries: runtime.narration.entries.filter(entry => entry.id !== latest.id),
    lastError: undefined,
  },
  messages: stripNarrationMessagePair(runtime.messages, latest),
  updatedAt: nowIso(),
});

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
      characterTags: extractCharacterTags(content),
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
    '生成第一幕正文。只按入局设定初始化变量；未选择技能、默认剧情、默认队友、默认背包、默认好感、默认声望不得写入。需要基于出生点和第一幕事实生成4条本地新闻/见闻与4条可接委托，并写入变量。需要输出 <content> 与 <UpdateVariable>。',
  ].join('\n\n');
  try {
    const rawText = await generateWithEldredPreset({
      runtime,
      userInput,
      systemPrompt,
      worldbookScanText: buildWorldbookScanText(runtime, openingFacts, 'opening_setup'),
    });
    const statData = await syncGeneratedMvuVariables(rawText, runtime);
    const syncedRuntime = mergeSyncedRuntime(runtime, statData);
    const content = extractEldredContentBlock(rawText);
    return appendGeneratedEntry(syncedRuntime, {
      kind: 'opening',
      title: '第一幕',
      userInput: openingFacts,
      text: content,
      sourceEventType: 'opening_setup',
      characterTags: extractCharacterTags(content),
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
  const systemPrompt = [
    buildBaseSystemPrompt(runtime, eventPayload, kind, party, enemies),
    '按当前变量、世界书和前端权威事件生成下一段正文；事件中的 result 与 authoritative_state_after_event 已经发生。需要输出 <content> 与 <UpdateVariable>，变量写回必须与前端结果一致。',
  ].join('\n\n');
  try {
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
      sourceEventType: input.eventType,
      characterTags: extractCharacterTags(content),
    });
  } catch (error) {
    return persistGenerationError(runtime, error);
  }
};

export const rerollLatestEldredNarration = async (runtime: EldredRuntimeSave) => {
  const latest = runtime.narration.entries[0];
  if (!latest) return runtime;
  const sourceRuntime = runtimeWithoutLatestNarration(runtime, latest);
  const rerollPrompt = [
    buildBaseSystemPrompt(sourceRuntime, latest.userInput, latest.kind),
    '重新生成当前轮正文。保留本轮输入事实，替换上一版正文。需要输出 <content> 与 <UpdateVariable>。',
  ].join('\n\n');
  try {
    const rawText = await generateWithEldredPreset({
      runtime: sourceRuntime,
      userInput: latest.userInput,
      systemPrompt: rerollPrompt,
      worldbookScanText: buildWorldbookScanText(sourceRuntime, latest.userInput, latest.sourceEventType || latest.kind),
    });
    const statData = await syncGeneratedMvuVariables(rawText, sourceRuntime);
    const syncedRuntime = mergeSyncedRuntime(sourceRuntime, statData);
    const content = extractEldredContentBlock(rawText);
    return appendGeneratedEntry(syncedRuntime, {
      kind: latest.kind,
      title: latest.title,
      userInput: latest.userInput,
      text: content,
      sourceEventType: latest.sourceEventType,
      characterTags: extractCharacterTags(content),
    });
  } catch (error) {
    return persistGenerationError(runtime, error);
  }
};
