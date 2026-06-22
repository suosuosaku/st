import {
  AttributeKey,
  Character,
  CharacterClassId,
  CharacterRaceId,
  CluePhase,
  CombatUnit,
  DynamicBoardItem,
  DynamicBoardItemType,
  EldredFortuneState,
  EquipmentLoadout,
  EquipmentSlot,
  FortuneEncounterEffect,
  FortuneLog,
  ImmersiveNotice,
  ImmersiveNoticeType,
  OriginLocation,
  PlayerState,
  Quest,
  RelationshipRecord,
  ReputationRecord,
} from '../types';
import {
  ATTRIBUTE_KEYS,
  allSkills,
  calculateDerivedStats,
  characterClasses,
  characterRaces,
  createLoadoutFromEquipment,
  equipmentPool,
  equippedIdsFromLoadout,
  experienceForNextLevel,
  getClassById,
  getEquipmentById,
  getRaceById,
  getSkillById,
  originLocations,
} from './rules';
import { findEldredFixedNpc } from './eldredNpcRegistry';
import { fixedNpcImageNames, resolveCharacterImage } from '../data';
import {
  clueRecordFromCanonical,
  eldredCanonicalCluePhases,
  findCanonicalClueSlot,
  resolveCanonicalPhaseName,
} from './mainClues';

type AnyRecord = Record<string, any>;

export const ELDRED_SAVE_KEY = 'eldred_save_v1';
export const ELDRED_SAVE_SCHEMA_VERSION = 1;
const ELDRED_LOCAL_SAVE_KEY_PREFIX = `${ELDRED_SAVE_KEY}:`;

export type EldredRuntimeSource = 'mvu' | 'cache' | 'empty';

export type EldredNarrationKind = 'opening' | 'free' | 'event' | 'combat';

export type EldredNarrationEntry = {
  id: string;
  kind: EldredNarrationKind;
  title: string;
  userInput: string;
  text: string;
  createdAt: string;
  sourceEventType?: string;
  characterTags?: string[];
  rawStatDataBefore?: AnyRecord;
  rawStatDataAfter?: AnyRecord;
};

export type EldredRuntimeMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  createdAt: string;
};

export type EldredNarrationState = {
  entries: EldredNarrationEntry[];
  lastGeneratedAt?: string;
  lastError?: string;
};

export type EldredRuntimeSave = {
  schemaVersion: number;
  source: EldredRuntimeSource;
  player: PlayerState | null;
  npcs: Character[];
  quests: Quest[];
  cluePhases: CluePhase[];
  combat: {
    turn: number;
    enemyUnits: CombatUnit[];
    logs: string[];
  };
  world: {
    currentTime: string;
    currentLocation: string;
    region: string;
    subRegion: string;
    landmark: string;
    weather: string;
    risk: string;
    travelState: string;
    presentCharacters: string[];
    dynamicBoard: DynamicBoardItem[];
  };
  rawStatData?: AnyRecord;
  fortune: EldredFortuneState;
  narration: EldredNarrationState;
  messages: EldredRuntimeMessage[];
  updatedAt: string;
  contextKey?: string;
};

type VariableOption = { type: string; [key: string]: unknown };

const emptyWorld = (): EldredRuntimeSave['world'] => ({
  currentTime: '',
  currentLocation: '',
  region: '',
  subRegion: '',
  landmark: '',
  weather: '',
  risk: '',
  travelState: '',
  presentCharacters: [],
  dynamicBoard: [],
});

export const createEmptyFortuneState = (): EldredFortuneState => ({
  flipCount: 0,
  dailyKey: '',
  logs: [],
  activeEncounters: [],
});

export const createEmptyNarrationState = (): EldredNarrationState => ({
  entries: [],
});

export const createEmptyEldredRuntimeSave = (): EldredRuntimeSave => ({
  schemaVersion: ELDRED_SAVE_SCHEMA_VERSION,
  source: 'empty',
  player: null,
  npcs: [],
  quests: [],
  cluePhases: [],
  combat: {
    turn: 1,
    enemyUnits: [],
    logs: [],
  },
  world: emptyWorld(),
  fortune: createEmptyFortuneState(),
  narration: createEmptyNarrationState(),
  messages: [],
  updatedAt: new Date().toISOString(),
});

const asRecord = (value: unknown): AnyRecord => (value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {});
const asArray = (value: unknown): any[] => Array.isArray(value) ? value : [];

const mergeRecords = (...values: unknown[]): AnyRecord => {
  const merged: AnyRecord = {};
  values.forEach(value => {
    Object.assign(merged, asRecord(value));
  });
  return merged;
};

const getPath = (source: unknown, path: string): unknown => {
  const keys = path.split('.');
  let current: any = source;
  for (const key of keys) {
    if (!current || typeof current !== 'object') return undefined;
    current = current[key];
  }
  return current;
};

const firstDefined = (...values: unknown[]) => values.find(value => value !== undefined && value !== null);

const safeScope = (scopeFactory: () => unknown): AnyRecord | null => {
  try {
    const scope = scopeFactory();
    return scope && typeof scope === 'object' ? scope as AnyRecord : null;
  } catch {
    return null;
  }
};

const hostScopes = (): AnyRecord[] => {
  const scopes = [
    safeScope(() => globalThis),
    safeScope(() => window),
    safeScope(() => window.parent),
    safeScope(() => window.top),
    safeScope(() => window.opener),
  ].filter((scope): scope is AnyRecord => Boolean(scope));
  return Array.from(new Set(scopes));
};

const hostFunction = <T extends (...args: any[]) => any>(name: string): T | null => {
  for (const scope of hostScopes()) {
    try {
      if (typeof scope[name] === 'function') return scope[name] as T;
      const eldredBridge = scope.__eldredWelcomeBridge;
      if (eldredBridge && typeof eldredBridge[name] === 'function') return eldredBridge[name] as T;
    } catch {
      // Cross-origin windows can throw.
    }
  }
  return null;
};

const hasTavernVariableBridge = () => Boolean(hostFunction('getVariables'));

const hostContextValue = (scope: AnyRecord, key: string): string => {
  try {
    const value = scope[key];
    if (typeof value === 'function') return textOf(value.call(scope));
    return textOf(value);
  } catch {
    return '';
  }
};

const readCurrentCharacterData = () => {
  for (const scope of hostScopes()) {
    try {
      const rawCharacter = scope.RawCharacter;
      if (rawCharacter && typeof rawCharacter.find === 'function') {
        const data = rawCharacter.find({ name: 'current', allowAvatar: true });
        if (data && typeof data === 'object') return data as AnyRecord;
      }
      if (typeof scope.getCharData === 'function') {
        const data = scope.getCharData('current');
        if (data && typeof data === 'object') return data as AnyRecord;
      }
    } catch {
      // ignored
    }
  }
  return null;
};

const currentRuntimeContextKey = () => {
  const character = readCurrentCharacterData();
  const cardData = asRecord(character?.data);
  const extensions = asRecord(cardData.extensions ?? character?.extensions);
  const characterName = textOf(cardData.name ?? character?.name);
  const avatar = textOf(character?.avatar ?? character?.avatar_url ?? cardData.avatar);
  const createDate = textOf(cardData.create_date ?? character?.create_date ?? extensions.create_date);
  const updateDate = textOf(cardData.character_version ?? character?.version ?? extensions.character_version);
  const worldName = textOf(character?.world ?? cardData.world ?? extensions.world);
  const scopeParts = hostScopes().flatMap(scope => {
    const tavern = asRecord(scope.SillyTavern);
    return [
      hostContextValue(scope, 'this_chid'),
      hostContextValue(scope, 'name2'),
      typeof tavern.getCurrentChatId === 'function' ? textOf(tavern.getCurrentChatId()) : '',
      typeof scope.getCurrentChatId === 'function' ? textOf(scope.getCurrentChatId()) : '',
    ];
  }).filter(Boolean);
  const parts = [
    'eldred',
    ...scopeParts,
    characterName,
    avatar,
    createDate,
    updateDate,
    worldName,
  ].filter(Boolean);
  return parts.length > 1 ? parts.join('|') : 'eldred-standalone';
};

const localStorageKey = () => `${ELDRED_LOCAL_SAVE_KEY_PREFIX}${encodeURIComponent(currentRuntimeContextKey())}`;

const cacheMatchesCurrentContext = (runtime: EldredRuntimeSave) => {
  const currentContext = currentRuntimeContextKey();
  if (!hasTavernVariableBridge()) return !runtime.contextKey || runtime.contextKey === currentContext || runtime.contextKey === 'eldred-standalone';
  return Boolean(runtime.contextKey && runtime.contextKey === currentContext);
};

const textOf = (value: unknown, fallback = ''): string => {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text && text !== '待开局' && text !== '待定' && text !== '未记录' ? text : fallback;
};

const numberOf = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const match = String(value ?? '').match(/-?\d+/);
  return match ? Number(match[0]) : fallback;
};

const splitTextList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(item => textOf(item)).filter(Boolean);
  if (value && typeof value === 'object') return Object.keys(value as AnyRecord);
  return textOf(value)
    .split(/[、,，;\n；]+/)
    .map(item => item.trim())
    .filter(Boolean);
};

const valueListFrom = (raw: unknown): unknown[] => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    return raw
      .split(/[、,，;；\n]+/)
      .map(item => item.trim())
      .filter(Boolean);
  }
  if (raw && typeof raw === 'object') return Object.values(asRecord(raw));
  return raw === undefined || raw === null ? [] : [raw];
};

const readVariables = (option: VariableOption): AnyRecord | null => {
  const getVariables = hostFunction<(option: VariableOption) => unknown>('getVariables');
  if (!getVariables) return null;
  try {
    return asRecord(getVariables(option));
  } catch {
    return null;
  }
};

const writeChatVariables = (variables: AnyRecord) => {
  const replaceVariables = hostFunction<(variables: AnyRecord, option: VariableOption) => unknown>('replaceVariables');
  if (!replaceVariables) return false;
  try {
    replaceVariables(variables, { type: 'chat' });
    return true;
  } catch {
    return false;
  }
};

const currentMessageIds = () => {
  const ids: Array<number | 'latest'> = ['latest', -1, -2];
  const getCurrentMessageId = hostFunction<() => number>('getCurrentMessageId');
  if (getCurrentMessageId) {
    try {
      const id = Number(getCurrentMessageId());
      if (Number.isFinite(id)) ids.push(id);
    } catch {
      // ignored
    }
  }
  const getLastMessageId = hostFunction<() => number>('getLastMessageId');
  if (getLastMessageId) {
    try {
      const id = Number(getLastMessageId());
      if (Number.isFinite(id)) {
        ids.push(id);
        if (id > 0) ids.push(id - 1);
        if (id > 1) ids.push(id - 2);
      }
    } catch {
      // ignored
    }
  }
  return [...new Set(ids)];
};

const extractStatData = (value: unknown): AnyRecord | null => {
  const direct = asRecord(value);
  if (['世界', '主角', '主线', '关系', '系统'].some(key => direct[key] !== undefined)) {
    return direct;
  }
  const statData = asRecord(
    direct.stat_data ??
    getPath(direct, 'data.stat_data') ??
    getPath(direct, 'variables.stat_data') ??
    getPath(direct, 'message.variables.stat_data')
  );
  return Object.keys(statData).length > 0 ? statData : null;
};

export const extractEldredStatData = extractStatData;

const readMvuData = (): AnyRecord | null => {
  for (const api of hostScopes()) {
    try {
      if (api.Mvu && typeof api.Mvu.getMvuData === 'function') {
        for (const messageId of currentMessageIds()) {
          try {
            const statData = extractStatData(api.Mvu.getMvuData({ type: 'message', message_id: messageId }));
            if (statData) return statData;
          } catch {
            // Try the next message id shape.
          }
        }
      }
      if (api.TavernHelper?.Mvu && typeof api.TavernHelper.Mvu.getMvuData === 'function') {
        for (const messageId of currentMessageIds()) {
          try {
            const statData = extractStatData(api.TavernHelper.Mvu.getMvuData({ type: 'message', message_id: messageId }));
            if (statData) return statData;
          } catch {
            // Try the next message id shape.
          }
        }
      }
      if (api.__eldredWelcomeBridge?.Mvu && typeof api.__eldredWelcomeBridge.Mvu.getMvuData === 'function') {
        for (const messageId of currentMessageIds()) {
          try {
            const statData = extractStatData(api.__eldredWelcomeBridge.Mvu.getMvuData({ type: 'message', message_id: messageId }));
            if (statData) return statData;
          } catch {
            // Try the next message id shape.
          }
        }
      }
    } catch {
      // ignored: the UI must also work as a standalone html file.
    }
  }

  const currentMessageStatData = extractStatData(readVariables({ type: 'message' }));
  if (currentMessageStatData) return currentMessageStatData;

  for (const messageId of currentMessageIds()) {
    const statData = extractStatData(readVariables({ type: 'message', message_id: messageId }));
    if (statData) return statData;
  }

  const chatVariables = readVariables({ type: 'chat' });
  const chatStatData = extractStatData(chatVariables);
  if (chatStatData) return chatStatData;

  return null;
};

const readCachedRuntime = (): EldredRuntimeSave | null => {
  const chatVariables = readVariables({ type: 'chat' });
  const stored = chatVariables?.[ELDRED_SAVE_KEY];
  if (stored && typeof stored === 'object') {
    const runtime = normalizeRuntime(stored as EldredRuntimeSave, 'cache');
    return cacheMatchesCurrentContext(runtime) ? runtime : null;
  }
  if (typeof stored === 'string') {
    try {
      const runtime = normalizeRuntime(JSON.parse(stored), 'cache');
      return cacheMatchesCurrentContext(runtime) ? runtime : null;
    } catch {
      // ignored
    }
  }

  if (hasTavernVariableBridge()) return null;

  try {
    const local = localStorage.getItem(localStorageKey()) || localStorage.getItem(ELDRED_SAVE_KEY);
    if (local) {
      const runtime = normalizeRuntime(JSON.parse(local), 'cache');
      return cacheMatchesCurrentContext(runtime) ? runtime : null;
    }
  } catch {
    // ignored
  }

  return null;
};

export const persistEldredRuntimeCache = (runtime: EldredRuntimeSave) => {
  const cached = {
    ...runtime,
    source: 'cache' as const,
    updatedAt: new Date().toISOString(),
    contextKey: currentRuntimeContextKey(),
  };

  try {
    localStorage.setItem(localStorageKey(), JSON.stringify(cached));
  } catch {
    // ignored
  }

  const variables = readVariables({ type: 'chat' });
  if (variables) {
    variables[ELDRED_SAVE_KEY] = cached;
    writeChatVariables(variables);
  }

  return cached;
};

const classAliases: Record<string, CharacterClassId> = {
  圣骑士: 'paladin',
  贤者: 'sage',
  游侠: 'ranger',
  战斗大师: 'battle-master',
  炼金术士: 'alchemist',
  魔导工匠: 'artificer',
  祭司: 'priest',
  召唤师: 'summoner',
};

const raceAliases: Record<string, CharacterRaceId> = {
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
  构装灵: 'record-spirit',
};

const resolveClassId = (value: unknown): CharacterClassId => {
  const raw = textOf(value);
  return characterClasses.find(item => item.id === raw || item.name === raw)?.id || classAliases[raw] || 'ranger';
};

const resolveRaceId = (value: unknown): CharacterRaceId => {
  const raw = textOf(value);
  return characterRaces.find(item => item.id === raw || item.name === raw)?.id || raceAliases[raw] || 'human';
};

const attributeKeyByChinese: Record<string, AttributeKey> = {
  力量: 'str',
  敏捷: 'dex',
  体质: 'vit',
  智力: 'int',
  精神: 'spr',
  str: 'str',
  dex: 'dex',
  vit: 'vit',
  int: 'int',
  spr: 'spr',
};

const attributesFrom = (raw: unknown, fallback: Record<AttributeKey, number>): Record<AttributeKey, number> => {
  const source = asRecord(raw);
  const sourceText = String(raw ?? '');
  return ATTRIBUTE_KEYS.reduce((acc, key) => {
    const chineseKey = Object.entries(attributeKeyByChinese).find(([, mapped]) => mapped === key)?.[0] || key;
    const textMatch = sourceText.match(new RegExp(`${chineseKey}\\s*[:：]?\\s*(-?\\d+)`));
    acc[key] = numberOf(source[key] ?? source[chineseKey] ?? textMatch?.[1], fallback[key]);
    return acc;
  }, {} as Record<AttributeKey, number>);
};

const mechanicsFromText = (raw: unknown): AnyRecord => {
  const text = textOf(raw);
  if (!text) return {};
  const record: AnyRecord = {};
  const hp = text.match(/(?:生命|HP)\s*[:：]?\s*(\d+\s*\/\s*\d+)/i)?.[1];
  const mp = text.match(/(?:法力|MP)\s*[:：]?\s*(\d+\s*\/\s*\d+)/i)?.[1];
  const level = text.match(/等级\s*[:：]?\s*(?:等级)?\s*(\d+)/)?.[1];
  const ac = text.match(/护甲\s*[:：]?\s*(\d+)/)?.[1];
  const speed = text.match(/速度\s*[:：]?\s*(\d+)/)?.[1];
  const initiative = text.match(/先攻\s*[:：]?\s*([+-]?\d+)/)?.[1];
  const proficiency = text.match(/熟练(?:加值)?\s*[:：]?\s*([+-]?\d+)/)?.[1];
  const attrs = attributesFrom(text, { str: 0, dex: 0, vit: 0, int: 0, spr: 0 });
  if (hp) record.生命 = hp.replace(/\s+/g, '');
  if (mp) record.法力 = mp.replace(/\s+/g, '');
  if (level) record.等级 = Number(level);
  if (ac) record.护甲 = Number(ac);
  if (speed) record.速度 = Number(speed);
  if (initiative) record.先攻 = Number(initiative);
  if (proficiency) record.熟练加值 = Number(proficiency);
  if (ATTRIBUTE_KEYS.some(key => attrs[key] !== 0)) record.五维 = attrs;
  return record;
};

const parseVitals = (value: unknown, fallbackCurrent: number, fallbackMax: number) => {
  if (typeof value === 'number') return { current: value, max: fallbackMax };
  const source = String(value ?? '');
  const [left, right] = source.match(/\d+/g)?.map(Number) || [];
  return {
    current: left ?? fallbackCurrent,
    max: right ?? left ?? fallbackMax,
  };
};

const slotAliases: Record<string, EquipmentSlot> = {
  武器: 'weapon',
  上身: 'upper',
  上装: 'upper',
  下身: 'lower',
  下装: 'lower',
  手部: 'hands',
  手套: 'hands',
  戒指: 'ring',
  靴子: 'boots',
  工具: 'tool',
  盾牌: 'shield',
  weapon: 'weapon',
  upper: 'upper',
  lower: 'lower',
  hands: 'hands',
  ring: 'ring',
  boots: 'boots',
  tool: 'tool',
  shield: 'shield',
};

const findEquipmentId = (value: unknown): string | undefined => {
  const source = asRecord(value);
  const raw = textOf(source.id ?? source.ID ?? source.名称 ?? source.名字 ?? source.装备 ?? value);
  if (!raw || raw === '空置' || raw === '无') return undefined;
  return equipmentPool.find(item => item.id === raw || item.name === raw || raw.includes(item.name))?.id;
};

const findSkillId = (value: unknown): string | undefined => {
  const source = asRecord(value);
  const raw = textOf(source.id ?? source.ID ?? source.名称 ?? source.名字 ?? source.技能 ?? value);
  if (!raw || raw === '空置' || raw === '无') return undefined;
  return allSkills().find(item => item.id === raw || item.name === raw || raw.includes(item.name))?.id;
};

const loadoutFrom = (raw: unknown): EquipmentLoadout => {
  if (Array.isArray(raw) || typeof raw === 'string') {
    return createLoadoutFromEquipment(equipmentIdsFrom(raw));
  }
  const source = asRecord(raw);
  const loadout: EquipmentLoadout = {};
  for (const [slotName, itemValue] of Object.entries(source)) {
    const slot = slotAliases[slotName];
    const id = findEquipmentId(itemValue);
    if (slot && id) loadout[slot] = id;
  }
  return loadout;
};

const equipmentIdsFrom = (raw: unknown): string[] => {
  const ids = valueListFrom(raw).map(findEquipmentId).filter((id): id is string => Boolean(id));
  return [...new Set(ids)];
};

const skillIdsFrom = (raw: unknown): string[] => {
  return [...new Set(valueListFrom(raw).map(findSkillId).filter((id): id is string => Boolean(id)))];
};

const findOrigin = (world: AnyRecord, playerRecord?: AnyRecord): OriginLocation => {
  const currentLocation = textOf(world.当前地点 ?? world.地点 ?? world.位置 ?? world.具体地标 ?? playerRecord?.出生点);
  const landmark = textOf(world.具体地标 ?? world.地标 ?? world.当前地标 ?? playerRecord?.出生点);
  const region = textOf(world.大区域 ?? world.区域 ?? world.地区 ?? world.子区域);
  const matched = originLocations.find(origin =>
    [origin.name, origin.landmarkName, origin.regionId].some(value => value && (currentLocation.includes(value) || landmark.includes(value) || region.includes(value))),
  );
  if (matched) return matched;
  return {
    id: 'runtime-location',
    name: currentLocation || landmark || '当前位置未落定',
    regionId: 'runtime',
    landmarkName: landmark || currentLocation || '当前地标未落定',
    summary: region || '正文已记录的位置',
    weather: textOf(world.当前天气 ?? world.天气),
    trouble: textOf(world.风险等级 ?? world.风险),
    firstNpc: splitTextList(world.在场角色 ?? world.在场人物 ?? world.当前接触人物).join('、'),
  };
};

const relationshipRecordsFrom = (raw: unknown): RelationshipRecord[] =>
  Object.entries(asRecord(raw)).map(([name, value]) => {
    const source = asRecord(value);
    return {
      characterId: name,
      name,
      favorability: numberOf(source.数值 ?? value, 0),
      stage: textOf(source.阶段, '陌生'),
      lastChange: textOf(source.最近变化 ?? source.原因),
    };
  });

const reputationRecordsFrom = (raw: unknown): ReputationRecord[] =>
  Object.entries(asRecord(raw)).map(([name, value]) => {
    const source = asRecord(value);
    return {
      regionId: name,
      label: name,
      value: numberOf(source.数值 ?? value, 0),
      tier: textOf(source.阶段, '未登记'),
    };
  });

const noticeTypeFromTitle = (title: string): ImmersiveNoticeType => {
  if (/NPC|角色/.test(title)) return 'npc';
  if (/线索/.test(title)) return 'clue';
  if (/物品|购买|背包/.test(title)) return 'item';
  if (/技能/.test(title)) return 'skill';
  if (/委托|任务/.test(title)) return 'quest';
  if (/地点|地图|路径/.test(title)) return 'location';
  if (/升级|等级/.test(title)) return 'level';
  if (/好感/.test(title)) return 'favor';
  if (/声望/.test(title)) return 'reputation';
  if (/装备/.test(title)) return 'equipment';
  return 'event';
};

const noticesFrom = (raw: unknown): ImmersiveNotice[] => {
  const values = Array.isArray(raw) ? raw : Object.values(asRecord(raw));
  return values.slice(-12).map((value, index) => {
    const source = asRecord(value);
    const title = textOf(source.标题 ?? source.title ?? source.类型, '事件进展');
    return {
      id: textOf(source.id, `notice-${index}`),
      type: noticeTypeFromTitle(title),
      title,
      body: textOf(source.内容 ?? source.body ?? value),
      meta: textOf(source.来源 ?? source.meta),
    };
  });
};

const dynamicBoardTypes: DynamicBoardItemType[] = ['新闻', '见闻', '委托', '市场', '传讯', '路径行动'];

const primitiveBoardItemsFrom = (raw: unknown, type: DynamicBoardItemType): DynamicBoardItem[] =>
  textOf(raw)
    .split(/\n+/)
    .map(item => item.trim())
    .filter(Boolean)
    .map((line, index) => ({
      id: `${type}-${index}`,
      type,
      title: line.split(/[｜|:：]/)[0] || type,
      detail: line,
      source: '',
      status: '记录中',
      location: '',
    }));

const boardRecordKeys = new Set([
  'id',
  'ID',
  '标题',
  '名称',
  'title',
  '内容',
  '正文',
  '说明',
  '事项',
  '目标',
  '详情',
  '详情描述',
  '新闻正文',
  '见闻正文',
  '任务详情',
  '来源',
  '发布者',
  '委托人',
  'source',
  '状态',
  '进展',
  'status',
  '地点',
  '位置',
  '地标',
  'location',
  '时间',
  '更新',
  'updatedAt',
  '报酬',
  '奖励',
  '风险',
  '危险等级',
  '建议等级',
  '等级',
  '时限',
  '截止',
  '分类',
]);

const numericPrimitiveBoardRecordFrom = (
  entries: readonly (readonly [string, unknown])[],
  type: DynamicBoardItemType,
): DynamicBoardItem[] | null => {
  if (entries.length < 2 || entries.some(([, value]) => value && typeof value === 'object')) return null;
  const fields = entries.map(([, value]) => textOf(value)).filter(Boolean);
  const named: AnyRecord = {};
  fields.forEach(field => {
    const match = field.match(/^([^：:]{1,12})[：:]\s*(.+)$/);
    if (match) named[match[1].trim()] = match[2].trim();
  });
  const namedKeyCount = Object.keys(named).filter(key => boardRecordKeys.has(key)).length;
  if (namedKeyCount < 2) return null;
  const item = boardRecordFrom(
    textOf(named.标题 ?? named.名称 ?? named.委托 ?? type),
    {
      ...named,
      内容: named.内容 ?? named.正文 ?? named.详情 ?? fields.filter(field => !/^([^：:]{1,12})[：:]/.test(field)).join('｜'),
    },
    type,
    0,
  );
  return item ? [item] : [];
};

const looksLikeBoardRecord = (value: unknown) => {
  const source = asRecord(value);
  const keys = Object.keys(source);
  if (!keys.length) return false;
  if (dynamicBoardTypes.some(type => source[type] !== undefined)) return false;
  const directRecordKeyCount = keys.filter(key => boardRecordKeys.has(key)).length;
  const nestedValues = Object.values(source).filter(value => value && typeof value === 'object' && !Array.isArray(value));
  const nestedRecordCount = nestedValues.filter(value => Object.keys(asRecord(value)).some(key => boardRecordKeys.has(key))).length;
  if (nestedRecordCount > 0 && nestedRecordCount >= Math.max(1, Math.ceil(nestedValues.length * 0.6))) return false;
  return directRecordKeyCount > 0;
};

const normalizeRisk = (value: unknown): Quest['risk'] | string => {
  const raw = textOf(value);
  if (!raw) return '';
  const matched = ['极高', '高', '中', '低'].find(level => raw.includes(level));
  return matched || raw;
};

const boardRecordFrom = (
  key: string,
  value: unknown,
  type: DynamicBoardItemType,
  index: number,
): DynamicBoardItem | null => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object') {
    const line = textOf(value);
    if (!line && !key) return null;
    return {
      id: `${type}-${key || index}`,
      type,
      title: key && !/^\d+$/.test(key) ? key : line.split(/[｜|:：]/)[0] || type,
      detail: line,
      source: '',
      status: '记录中',
      location: '',
    };
  }

  const source = asRecord(value);
  const detail = textOf(
    source.详情描述 ??
    source.任务详情 ??
    source.内容 ??
    source.说明 ??
    source.事项 ??
    source.目标 ??
    source.详情 ??
    source.body
  );
  const title = textOf(source.标题 ?? source.名称 ?? source.title, /^\d+$/.test(key) ? type : key || type);
  const risk = normalizeRisk(source.风险 ?? source.危险等级);
  return {
    id: textOf(source.id ?? source.ID, `${type}-${key || index}`),
    type,
    title,
    detail: detail || textOf(source.摘要 ?? source.新闻正文 ?? source.见闻正文 ?? source.描述),
    source: textOf(source.来源 ?? source.发布者 ?? source.委托人 ?? source.source),
    status: textOf(source.状态 ?? source.进展 ?? source.status, '记录中'),
    location: textOf(source.地点 ?? source.位置 ?? source.地标 ?? source.location),
    risk: risk || undefined,
    reward: textOf(source.报酬 ?? source.奖励 ?? source.reward) || undefined,
    recLevel: source.建议等级 !== undefined || source.等级 !== undefined ? numberOf(source.建议等级 ?? source.等级, 1) : undefined,
    timeLimit: textOf(source.时限 ?? source.截止 ?? source.timeLimit) || undefined,
    updatedAt: textOf(source.时间 ?? source.更新 ?? source.updatedAt),
  };
};

const boardItemsFrom = (raw: unknown, type: DynamicBoardItemType): DynamicBoardItem[] => {
  if (raw === undefined || raw === null) return [];
  if (typeof raw !== 'object') return primitiveBoardItemsFrom(raw, type);
  if (looksLikeBoardRecord(raw)) {
    const item = boardRecordFrom('', raw, type, 0);
    return item ? [item] : [];
  }
  const entries = Array.isArray(raw)
    ? raw.map((value, index) => [String(index + 1), value] as const)
    : Object.entries(asRecord(raw));
  const compactPrimitiveRecord = numericPrimitiveBoardRecordFrom(entries, type);
  if (compactPrimitiveRecord) return compactPrimitiveRecord;
  return entries
    .map(([key, value], index) => boardRecordFrom(key, value, type, index))
    .filter((item): item is DynamicBoardItem => Boolean(item && (item.title || item.detail)));
};

const normalizeBoardIdentityText = (value: unknown) =>
  textOf(value)
    .replace(/[【】「」《》“”"'`]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();

const boardItemCompletenessScore = (item: DynamicBoardItem) =>
  [
    item.detail,
    item.source,
    item.location,
    item.status,
    item.risk,
    item.reward,
    item.recLevel,
    item.timeLimit,
    item.updatedAt,
  ].filter(value => textOf(value)).length;

const mergeBoardItem = (left: DynamicBoardItem, right: DynamicBoardItem): DynamicBoardItem => {
  const preferRight = boardItemCompletenessScore(right) > boardItemCompletenessScore(left);
  const primary = preferRight ? right : left;
  const secondary = preferRight ? left : right;
  return {
    ...primary,
    detail: primary.detail || secondary.detail,
    source: primary.source || secondary.source,
    status: primary.status || secondary.status,
    location: primary.location || secondary.location,
    risk: primary.risk || secondary.risk,
    reward: primary.reward || secondary.reward,
    recLevel: primary.recLevel || secondary.recLevel,
    timeLimit: primary.timeLimit || secondary.timeLimit,
    updatedAt: primary.updatedAt || secondary.updatedAt,
  };
};

const dynamicBoardFromStatData = (statData: AnyRecord): DynamicBoardItem[] => {
  const world = asRecord(statData.世界);
  const system = asRecord(statData.系统);
  const board = asRecord(world.动态看板 ?? system.动态看板 ?? system.新闻见闻);
  const items: DynamicBoardItem[] = [];

  dynamicBoardTypes.forEach(type => {
    items.push(...boardItemsFrom(board[type], type));
  });

  const legacyNewsRumors = system.新闻见闻;
  const legacyNewsRumorsRecord = asRecord(legacyNewsRumors);
  const legacyNewsRumorsHasTypedGroups = dynamicBoardTypes.some(type => legacyNewsRumorsRecord[type] !== undefined);
  items.push(...boardItemsFrom(world.新闻 ?? system.新闻, '新闻'));
  items.push(...boardItemsFrom(system.新闻板, '新闻'));
  items.push(...boardItemsFrom(world.见闻 ?? system.见闻 ?? system.传闻板 ?? (legacyNewsRumorsHasTypedGroups ? undefined : legacyNewsRumors), '见闻'));
  items.push(...boardItemsFrom(world.市场 ?? system.市场 ?? system.市场看板, '市场'));
  items.push(...boardItemsFrom(world.传讯 ?? system.传讯 ?? system.最新传讯 ?? system.消息板, '传讯'));
  items.push(...boardItemsFrom(world.路径行动 ?? system.路径行动, '路径行动'));
  items.push(...boardItemsFrom(world.委托 ?? system.委托 ?? system.委托板, '委托'));

  const merged = new Map<string, DynamicBoardItem>();
  items.forEach(item => {
    const normalizedTitle = normalizeBoardIdentityText(item.title || item.id);
    const normalizedSource = normalizeBoardIdentityText(item.source);
    const normalizedLocation = normalizeBoardIdentityText(item.location);
    const key = item.type === '委托'
      ? `${item.type}:${normalizedTitle || normalizeBoardIdentityText(item.id)}`
      : `${item.type}:${normalizedTitle || normalizeBoardIdentityText(item.id)}:${normalizedSource}:${normalizedLocation}`;
    const existing = merged.get(key);
    merged.set(key, existing ? mergeBoardItem(existing, item) : item);
  });

  const typeCounts = new Map<DynamicBoardItemType, number>();
  return Array.from(merged.values())
    .filter(item => {
      const count = typeCounts.get(item.type) || 0;
      if (count >= 4) return false;
      typeCounts.set(item.type, count + 1);
      return true;
    })
    .slice(0, 24);
};

const hasPlayerBattleData = (battle: AnyRecord, main: AnyRecord, identityRecord: AnyRecord) => {
  const hp = textOf(firstDefined(battle.生命, battle.HP, battle.生命值));
  const mp = textOf(firstDefined(battle.法力, battle.MP, battle.法力值));
  const attrs = asRecord(firstDefined(battle.五维, battle.属性, main.五维, main.属性, identityRecord.五维));
  const skills = skillIdsFrom(firstDefined(
    battle.已知技能,
    battle.技能库,
    battle.技能,
    battle.开局技能,
    battle.已选开局技能,
    main.技能库,
    main.已知技能,
    main.开局技能,
    main.已选开局技能,
    identityRecord.已选开局技能,
  ));
  const equipment = equipmentIdsFrom(firstDefined(battle.装备栏, battle.装备位, battle.装备, main.装备栏, main.装备位, main.装备));
  const identityName = textOf(identityRecord.姓名 ?? main.姓名 ?? battle.姓名);
  const className = textOf(identityRecord.职业 ?? battle.职业 ?? main.职业);
  return Boolean(
    hp ||
    mp ||
    Object.keys(attrs).length ||
    skills.length ||
    equipment.length ||
    identityName ||
    className
  );
};

const playerFromStatData = (statData: AnyRecord): PlayerState | null => {
  const world = asRecord(statData.世界);
  const main = asRecord(statData.主角);
  const identityRecord = mergeRecords(
    main.基本信息,
    main.角色,
    main.入局设定,
    main.开局设定,
    main.登记,
    main.自定义,
    main.身份,
  );
  const battle = mergeRecords(main.机制数值, main.战斗数据, main.战斗);
  const legacyAttributes = asRecord(main.属性);
  if (!hasPlayerBattleData(battle, main, identityRecord) && Object.keys(identityRecord).length === 0 && Object.keys(legacyAttributes).length === 0) return null;

  const classId = resolveClassId(identityRecord.职业 ?? battle.职业 ?? main.职业);
  const raceId = resolveRaceId(identityRecord.种族 ?? battle.种族 ?? main.种族);
  const cls = getClassById(classId);
  const baseAttributes = attributesFrom(firstDefined(battle.五维, battle.属性, main.五维, main.属性, identityRecord.五维), cls.presetStats);
  const location = findOrigin(world, identityRecord);
  const loadout = loadoutFrom(firstDefined(battle.装备栏, battle.装备位, battle.装备, main.装备栏, main.装备位, main.装备));
  const equipmentIds = [...new Set([
    ...equipmentIdsFrom(firstDefined(battle.装备栏, battle.装备位, battle.装备, main.装备栏, main.装备位, main.装备)),
    ...equippedIdsFromLoadout(loadout),
  ])];
  const knownSkillIds = skillIdsFrom(firstDefined(
    battle.已知技能,
    battle.技能库,
    battle.技能,
    battle.开局技能,
    battle.已选开局技能,
    main.技能库,
    main.已知技能,
    main.开局技能,
    main.已选开局技能,
    identityRecord.已选开局技能,
  ));
  const activeSkillIds = skillIdsFrom(firstDefined(
    battle.激活技能,
    battle.已激活技能,
    battle.当前技能,
    battle.已选开局技能,
    main.激活技能,
    main.当前技能,
    main.已选开局技能,
    identityRecord.已选开局技能,
  ))
    .filter(id => knownSkillIds.length === 0 || knownSkillIds.includes(id))
    .slice(0, 4);
  const level = Math.max(1, numberOf(battle.等级 ?? identityRecord.等级 ?? main.等级, 1));
  const derived = calculateDerivedStats(level, classId, baseAttributes, equippedIdsFromLoadout(loadout), raceId);
  const hp = parseVitals(
    firstDefined(battle.生命, battle.HP, battle.生命值 !== undefined || battle.生命值上限 !== undefined ? `${battle.生命值 ?? derived.hp}/${battle.生命值上限 ?? derived.maxHp}` : undefined),
    derived.hp,
    derived.maxHp,
  );
  const mp = parseVitals(
    firstDefined(battle.法力, battle.MP, battle.法力值 !== undefined || battle.法力值上限 !== undefined ? `${battle.法力值 ?? derived.mp}/${battle.法力值上限 ?? derived.maxMp}` : undefined),
    derived.mp,
    derived.maxMp,
  );
  const stats = {
    ...derived,
    hp: hp.current,
    maxHp: hp.max,
    mp: mp.current,
    maxMp: mp.max,
    ac: numberOf(firstDefined(battle.护甲, battle.护甲等级, battle.AC), derived.ac),
  };
  const name = textOf(identityRecord.姓名 ?? main.姓名 ?? battle.姓名, '{{user}}');
  return {
    identity: {
      name,
      gender: textOf(identityRecord.性别, '未记录'),
      age: textOf(identityRecord.年龄, '未记录'),
      background: textOf(identityRecord.经历, ''),
    },
    name,
    raceId,
    level,
    experience: numberOf(battle.经验, 0),
    nextLevelExperience: numberOf(battle.下级经验, experienceForNextLevel(level)),
    availableAttributePoints: numberOf(battle.可分配点数, 0),
    classId,
    originId: location.id,
    location,
    stats,
    baseAttributes,
    activeSkillIds,
    knownSkillIds,
    talentIds: cls.companionTalentIds,
    equipmentIds,
    equipmentLoadout: loadout,
    inventory: Object.keys(asRecord(main.背包)),
    partyMemberIds: Object.keys(asRecord(main.当前队伍)).filter(id => id !== name && id !== '{{user}}' && id !== '主角'),
    relationships: relationshipRecordsFrom(asRecord(statData.关系).好感),
    reputations: reputationRecordsFrom(asRecord(statData.关系).地区声望),
    notices: noticesFrom(asRecord(statData.系统).前端提示 ?? asRecord(statData.系统).事件记录),
  };
};

const playerStatDataFromState = (player: PlayerState): AnyRecord => {
  const cls = getClassById(player.classId);
  const race = getRaceById(player.raceId);
  const skillRecord = Object.fromEntries(player.knownSkillIds.map(id => [getSkillById(id)?.name || id, { id, 名称: getSkillById(id)?.name || id }]));
  const activeSkillRecord = Object.fromEntries(player.activeSkillIds.map(id => [getSkillById(id)?.name || id, { id, 名称: getSkillById(id)?.name || id }]));
  const equipmentRecord = Object.fromEntries(player.equipmentIds.map(id => [getEquipmentById(id)?.name || id, { id, 名称: getEquipmentById(id)?.name || id }]));
  const loadoutRecord = Object.fromEntries(Object.entries(player.equipmentLoadout).map(([slot, id]) => [
    slot,
    { id, 名称: getEquipmentById(id || '')?.name || id },
  ]));
  return {
    世界: {
      当前地点: player.location.name,
      大区域: player.location.regionId,
      子区域: player.location.regionId,
      具体地标: player.location.landmarkName,
      当前天气: player.location.weather,
      风险等级: player.location.trouble,
      旅行状态: '未移动',
      在场角色: [player.name],
    },
    主角: {
      姓名: player.name,
      身份: {
        姓名: player.name,
        性别: player.identity.gender,
        年龄: player.identity.age,
        经历: player.identity.background,
        种族: race.name,
        职业: cls.name,
        出生点: player.location.name,
        等级: player.level,
        五维: {
          力量: player.baseAttributes.str,
          敏捷: player.baseAttributes.dex,
          体质: player.baseAttributes.vit,
          智力: player.baseAttributes.int,
          精神: player.baseAttributes.spr,
        },
      },
      战斗: {
        姓名: player.name,
        种族: race.name,
        职业: cls.name,
        等级: player.level,
        经验: player.experience,
        下级经验: player.nextLevelExperience,
        可分配点数: player.availableAttributePoints,
        生命: `${player.stats.hp}/${player.stats.maxHp}`,
        法力: `${player.stats.mp}/${player.stats.maxMp}`,
        护甲: player.stats.ac,
        熟练: player.stats.proficiency,
        五维: {
          力量: player.baseAttributes.str,
          敏捷: player.baseAttributes.dex,
          体质: player.baseAttributes.vit,
          智力: player.baseAttributes.int,
          精神: player.baseAttributes.spr,
        },
        已知技能: skillRecord,
        激活技能: activeSkillRecord,
        装备: equipmentRecord,
        装备栏: loadoutRecord,
      },
      背包: {},
      任务列表: {},
      角色收集: {
        主要NPC: {},
        其他NPC: {},
      },
      当前队伍: {},
    },
    主线: {
      阶段钥匙册: {},
      线索矩阵: {},
    },
    关系: {
      好感: {},
      地区声望: {},
    },
    系统: {
      战斗缓存: {
        回合: 1,
        参战名单: {},
        敌方: {},
        日志: [],
      },
      前端提示: [],
    },
  };
};

const isPlaceholderPlayerName = (value: unknown) =>
  /^(?:\{\{user\}\}|<user>|主角|玩家)$/i.test(textOf(value).replace(/\s+/g, ''));

export const mergePlayerWithCachedOpening = (synced?: PlayerState | null, cached?: PlayerState | null) => {
  if (!synced) return cached || null;
  if (!cached) return synced;
  const syncedNameIsPlaceholder = isPlaceholderPlayerName(synced.name) || isPlaceholderPlayerName(synced.identity.name);
  const keepCachedSkills = synced.knownSkillIds.length === 0 && cached.knownSkillIds.length > 0;
  const keepCachedEquipment = synced.equipmentIds.length === 0 && cached.equipmentIds.length > 0;
  return {
    ...synced,
    name: syncedNameIsPlaceholder ? cached.name : synced.name,
    identity: {
      ...cached.identity,
      ...synced.identity,
      name: syncedNameIsPlaceholder ? cached.identity.name : synced.identity.name,
      gender: synced.identity.gender || cached.identity.gender,
      age: synced.identity.age || cached.identity.age,
      background: synced.identity.background || cached.identity.background,
    },
    raceId: synced.raceId || cached.raceId,
    classId: synced.classId || cached.classId,
    originId: synced.originId === 'runtime-location' && cached.originId ? cached.originId : synced.originId,
    location: synced.location.id === 'runtime-location' && cached.location ? cached.location : synced.location,
    baseAttributes: synced.baseAttributes || cached.baseAttributes,
    activeSkillIds: synced.activeSkillIds.length ? synced.activeSkillIds : cached.activeSkillIds,
    knownSkillIds: keepCachedSkills ? cached.knownSkillIds : synced.knownSkillIds,
    talentIds: synced.talentIds.length ? synced.talentIds : cached.talentIds,
    equipmentIds: keepCachedEquipment ? cached.equipmentIds : synced.equipmentIds,
    equipmentLoadout: Object.keys(synced.equipmentLoadout).length ? synced.equipmentLoadout : cached.equipmentLoadout,
  } satisfies PlayerState;
};

const characterFromVariable = (name: string, raw: unknown, type: Character['type'], fixed = false): Character => {
  const source = asRecord(raw);
  const fixedNpc = findEldredFixedNpc(name);
  const fixedStats = fixedNpc?.stats;
  const fixedAttributes = fixedStats
    ? {
      str: fixedStats.str,
      dex: fixedStats.dex,
      vit: fixedStats.vit,
      int: fixedStats.int,
      spr: fixedStats.spr,
    }
    : undefined;
  const mechanicText = [
    typeof raw === 'string' ? raw : '',
    source.机制数值,
    source.数值,
    source.战斗,
  ].map(value => typeof value === 'string' ? value : '').filter(Boolean).join('；');
  const battle = {
    ...mechanicsFromText(mechanicText),
    ...asRecord(source.战斗 ?? source.数值 ?? source.机制数值 ?? source),
  };
  const directStats = asRecord(source.stats);
  const classId = resolveClassId(source.classId ?? source.职业 ?? battle.职业 ?? source.profession ?? fixedNpc?.classId);
  const raceId = resolveRaceId(source.raceId ?? source.种族 ?? battle.种族 ?? source.race ?? fixedNpc?.raceId);
  const cls = getClassById(classId);
  const baseAttributes = attributesFrom(firstDefined(battle.五维, battle.属性, source.五维, source.属性, directStats), fixedAttributes || cls.presetStats);
  const equipmentSource = firstDefined(battle.装备栏, battle.装备位, source.装备, source.装备栏, source.装备位);
  const parsedLoadout = loadoutFrom(equipmentSource);
  const parsedEquipmentIds = [...new Set([...equipmentIdsFrom(equipmentSource), ...equippedIdsFromLoadout(parsedLoadout)])];
  const loadout = parsedEquipmentIds.length
    ? Object.keys(parsedLoadout).length ? parsedLoadout : createLoadoutFromEquipment(parsedEquipmentIds)
    : fixedNpc?.equipmentLoadout || parsedLoadout;
  const equipmentIds = parsedEquipmentIds.length ? parsedEquipmentIds : fixedNpc?.equipmentIds || [];
  const parsedKnownSkillIds = skillIdsFrom(firstDefined(battle.已知技能, battle.技能库, battle.技能, source.已知技能, source.技能库, source.技能, source.knownSkillIds));
  const knownSkillIds = parsedKnownSkillIds.length ? parsedKnownSkillIds : fixedNpc?.knownSkillIds || [];
  const parsedActiveSkillIds = skillIdsFrom(firstDefined(battle.激活技能, battle.已激活技能, source.激活技能, source.当前技能, source.activeSkillIds))
    .filter(id => knownSkillIds.length === 0 || knownSkillIds.includes(id))
    .slice(0, 4);
  const activeSkillIds = parsedActiveSkillIds.length ? parsedActiveSkillIds : fixedNpc?.activeSkillIds || [];
  const directSkills = Array.isArray(source.skills) ? source.skills : [];
  const level = Math.max(1, numberOf(battle.等级 ?? source.等级 ?? directStats.level ?? source.level, fixedStats?.level || 1));
  const derived = calculateDerivedStats(level, classId, baseAttributes, equippedIdsFromLoadout(loadout), raceId);
  const hp = parseVitals(
    firstDefined(
      battle.生命,
      battle.HP,
      battle.hp,
      source.生命,
      source.HP,
      directStats.hp !== undefined || directStats.maxHp !== undefined ? `${directStats.hp ?? derived.hp}/${directStats.maxHp ?? derived.maxHp}` : undefined,
      battle.生命值 !== undefined || battle.生命值上限 !== undefined ? `${battle.生命值 ?? derived.hp}/${battle.生命值上限 ?? derived.maxHp}` : undefined,
      source.生命值 !== undefined || source.生命值上限 !== undefined ? `${source.生命值 ?? derived.hp}/${source.生命值上限 ?? derived.maxHp}` : undefined,
    ),
    fixedStats?.hp ?? derived.hp,
    fixedStats?.maxHp ?? derived.maxHp,
  );
  const mp = parseVitals(
    firstDefined(
      battle.法力,
      battle.MP,
      battle.mp,
      source.法力,
      source.MP,
      directStats.mp !== undefined || directStats.maxMp !== undefined ? `${directStats.mp ?? derived.mp}/${directStats.maxMp ?? derived.maxMp}` : undefined,
      battle.法力值 !== undefined || battle.法力值上限 !== undefined ? `${battle.法力值 ?? derived.mp}/${battle.法力值上限 ?? derived.maxMp}` : undefined,
      source.法力值 !== undefined || source.法力值上限 !== undefined ? `${source.法力值 ?? derived.mp}/${source.法力值上限 ?? derived.maxMp}` : undefined,
    ),
    fixedStats?.mp ?? derived.mp,
    fixedStats?.maxMp ?? derived.maxMp,
  );

  return {
    id: textOf(source.id, fixedNpc?.id || name),
    name,
    fullName: textOf(source.全名 ?? source.fullName, fixedNpc?.fullName || name),
    type,
    race: textOf(source.race ?? source.种族, fixedNpc?.race || getRaceById(raceId).name),
    raceId,
    gender: textOf(source.性别 ?? source.gender, fixedNpc?.gender || '未记录'),
    age: textOf(source.年龄 ?? source.age, fixedNpc?.age === undefined ? '未记录' : String(fixedNpc.age)),
    affiliation: textOf(source.所属 ?? source.所属地区 ?? source.所属地标 ?? source.势力 ?? source.affiliation, fixedNpc?.affiliation || '未登记'),
    identity: textOf(source.身份 ?? source.职责 ?? source.identity, fixedNpc?.identity || '未登记'),
    classId,
    profession: textOf(source.职业 ?? source.职责 ?? source.profession, fixedNpc?.profession || getClassById(classId).name),
    avatarUrl: resolveCharacterImage(name, '头像', {
      fixed: fixed || Boolean(fixedNpc),
      raw: source.头像 ?? source.avatarUrl ?? source.avatar ?? fixedNpc?.avatarUrl,
    }),
    portraitUrl: resolveCharacterImage(name, '立绘', {
      fixed: fixed || Boolean(fixedNpc),
      raw: source.立绘 ?? source.portraitUrl ?? source.portrait ?? fixedNpc?.portraitUrl,
    }),
    stats: {
      ...derived,
      hp: hp.current,
      maxHp: hp.max,
      mp: mp.current,
      maxMp: mp.max,
      ac: numberOf(firstDefined(battle.护甲, battle.护甲等级, battle.AC, battle.ac, source.护甲, source.AC, directStats.ac), fixedStats?.ac ?? derived.ac),
    },
    experience: numberOf(battle.经验 ?? source.经验 ?? source.experience, fixedNpc?.experience || 0),
    nextLevelExperience: numberOf(battle.下级经验 ?? source.下级经验 ?? source.nextLevelExperience, fixedNpc?.nextLevelExperience || experienceForNextLevel(level)),
    availableAttributePoints: numberOf(battle.可分配点数 ?? source.可分配点数 ?? source.availableAttributePoints, 0),
    favorability: numberOf(source.好感 ?? source.好感度 ?? source.favorability, fixedNpc?.favorability || 0),
    relationshipStage: textOf(source.关系阶段 ?? source.阶段 ?? source.relationshipStage, fixedNpc?.relationshipStage || '陌生'),
    equipmentIds,
    equipmentLoadout: loadout,
    activeSkillIds,
    knownSkillIds,
    attributes: splitTextList(source.特质 ?? source.属性 ?? source.标签 ?? source.attributes).length
      ? splitTextList(source.特质 ?? source.属性 ?? source.标签 ?? source.attributes)
      : fixedNpc?.attributes || [],
    skills: directSkills.length
      ? directSkills
      : activeSkillIds.map(id => getSkillById(id)).filter((skill): skill is NonNullable<typeof skill> => Boolean(skill)).length
        ? activeSkillIds.map(id => getSkillById(id)).filter((skill): skill is NonNullable<typeof skill> => Boolean(skill))
        : fixedNpc?.skills || [],
  };
};

const npcsFromStatData = (statData: AnyRecord): Character[] => {
  const mainRecord = asRecord(statData.主角);
  const collection = asRecord(mainRecord.角色收集);
  const major = asRecord(collection.主要NPC);
  const other = asRecord(collection.其他NPC);
  const legacy = asRecord(mainRecord.NPC名册);
  const existingNames = new Set([...Object.keys(major), ...Object.keys(other)]);
  const relationships = relationshipRecordsFrom(asRecord(statData.关系).好感);
  const relationshipByName = new Map<string, RelationshipRecord>();
  relationships.forEach(record => {
    [record.characterId, record.name].filter(Boolean).forEach(key => {
      relationshipByName.set(normalizeCombatName(key), record);
    });
  });
  const mergeRelationship = (npc: Character) => {
    const record = [
      npc.id,
      npc.name,
      npc.fullName,
    ].map(normalizeCombatName).map(key => relationshipByName.get(key)).find(Boolean);
    return record ? {
      ...npc,
      favorability: record.favorability,
      relationshipStage: record.stage || npc.relationshipStage,
    } : npc;
  };
  return [
    ...Object.entries(major).map(([name, value]) => characterFromVariable(name, value, 'NPC登记', true)),
    ...Object.entries(other).map(([name, value]) => characterFromVariable(name, value, 'NPC登记', fixedNpcImageNames.has(name))),
    ...Object.entries(legacy)
      .filter(([name]) => name && name !== '无' && !existingNames.has(name))
      .map(([name, value]) => characterFromVariable(name, value, 'NPC登记', fixedNpcImageNames.has(name))),
  ].map(mergeRelationship);
};

const questsFromStatData = (statData: AnyRecord): Quest[] =>
  Object.entries(asRecord(asRecord(statData.主角).任务列表)).map(([id, value], index) => {
    const source = asRecord(value);
    const risk = normalizeRisk(source.风险 ?? source.危险等级);
    return {
      id,
      title: textOf(source.标题 ?? source.名称, id),
      source: textOf(source.来源 ?? source.发布者 ?? source.委托人, '未登记'),
      task: textOf(source.任务详情 ?? source.事项 ?? source.目标 ?? source.说明 ?? source.任务 ?? source.内容, ''),
      recLevel: numberOf(source.建议等级 ?? source.等级, 1),
      risk: (['极高', '高', '中', '低'].includes(risk) ? risk : '中') as Quest['risk'],
      reward: textOf(source.奖励 ?? source.报酬, ''),
      timeLimit: textOf(source.时限 ?? source.截止, ''),
      status: textOf(source.状态 ?? source.进展, '进行中'),
      reputationRegionId: textOf(source.声望地区, undefined as unknown as string),
      reputationReward: source.声望奖励 === undefined ? undefined : numberOf(source.声望奖励, 0),
    } satisfies Quest;
  }).filter((quest, index) => quest.title || index >= 0);

const combatUnitFrom = (name: string, raw: unknown, isEnemy: boolean): CombatUnit => {
  const source = asRecord(raw);
  const level = Math.max(1, numberOf(source.等级, 1));
  const classId = resolveClassId(source.职业);
  const attrs = attributesFrom(firstDefined(source.五维, source.属性), getClassById(classId).presetStats);
  const loadout = loadoutFrom(firstDefined(source.装备, source.装备栏, source.装备位));
  const derived = calculateDerivedStats(level, classId, attrs, equippedIdsFromLoadout(loadout));
  const hp = parseVitals(firstDefined(source.生命, source.HP), derived.hp, derived.maxHp);
  const mp = parseVitals(firstDefined(source.法力, source.MP), derived.mp, derived.maxMp);
  return {
    id: textOf(source.id, name),
    name,
    isEnemy,
    level,
    hp: hp.current,
    maxHp: hp.max,
    mp: mp.current,
    maxMp: mp.max,
    ac: numberOf(firstDefined(source.护甲, source.护甲等级, source.AC), derived.ac),
    stats: attrs,
    skillIds: skillIdsFrom(source.激活技能 ?? source.技能),
    equipmentIds: equipmentIdsFrom(firstDefined(source.装备, source.装备栏, source.装备位)),
    ap: numberOf(source.行动点, 1),
    maxAp: numberOf(source.最大行动点, 1),
    shield: numberOf(source.护盾, 0),
    statusLogs: splitTextList(source.状态),
  };
};

const normalizeCombatName = (name: unknown) =>
  textOf(name)
    .replace(/[（）()].*?[）)]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();

const allyCombatAliasesFrom = (statData: AnyRecord) => {
  const main = asRecord(statData.主角);
  const identity = asRecord(main.身份 ?? main.角色 ?? main.基本信息);
  const battle = asRecord(main.战斗);
  return new Set([
    '{{user}}',
    '<user>',
    '主角',
    '玩家',
    identity.姓名,
    main.姓名,
    battle.姓名,
    ...Object.keys(asRecord(main.当前队伍)),
  ].map(normalizeCombatName).filter(Boolean));
};

const isAllyCombatName = (name: string, aliases: Set<string>) => {
  const normalized = normalizeCombatName(name);
  return Boolean(normalized && (aliases.has(normalized) || /\{\{user\}\}|<user>|主角|玩家/i.test(name)));
};

const combatFromStatData = (statData: AnyRecord): EldredRuntimeSave['combat'] => {
  const cache = asRecord(asRecord(statData.系统).战斗缓存);
  const participants = asRecord(cache.参战名单);
  const allyAliases = allyCombatAliasesFrom(statData);
  const enemyUnits = Object.entries(participants)
    .filter(([name, value]) => !isAllyCombatName(name, allyAliases) && /敌|魔物|怪物|enemy/i.test(textOf(asRecord(value).阵营 ?? asRecord(value).类型)))
    .map(([name, value]) => combatUnitFrom(name, value, true));
  const directEnemies = Object.entries(asRecord(cache.敌方))
    .filter(([name]) => !isAllyCombatName(name, allyAliases))
    .map(([name, value]) => combatUnitFrom(name, value, true));
  return {
    turn: Math.max(1, numberOf(cache.回合, 1)),
    enemyUnits: [...enemyUnits, ...directEnemies],
    logs: splitTextList(cache.回合变化 ?? cache.日志),
  };
};

const clueRecordFrom = (id: string, raw: unknown): CluePhase['clues'][number] => {
  const source = asRecord(raw);
  return {
    id,
    label: id,
    status: textOf(source.状态, '未解锁'),
    display: textOf(source.显示 ?? source.内容 ?? source.名称, id),
    location: textOf(source.发现地点 ?? source.地点 ?? source.大地标提示),
    carrier: textOf(source.载体),
    detail: textOf(source.展开详情 ?? source.指向 ?? source.详情),
  };
};

const unlockedClueStatus = (raw: unknown) => {
  const status = textOf(asRecord(raw).状态 ?? raw);
  if (!status) return '未解锁';
  return /已解锁|已收录|已验证|完成|获得|记录中/.test(status) ? status : '未解锁';
};

const clueOverrideFromVariable = (
  phaseName: string,
  slot: number,
  clueId: string,
  rowClues: AnyRecord,
  matrixClues: AnyRecord,
) => {
  const directKeys = [clueId, `线索${slot + 1}`];
  const direct = directKeys.map(key => rowClues[key] ?? matrixClues[key]).find(value => value !== undefined);
  if (direct !== undefined) return asRecord(direct);
  const phase = eldredCanonicalCluePhases.find(item => item.phase === phaseName);
  const canonical = phase?.clues[slot];
  if (!canonical) return {};
  return Object.values({ ...matrixClues, ...rowClues })
    .map(value => asRecord(value))
    .find(value => {
      const candidate = textOf(value.显示 ?? value.名称 ?? value.内容 ?? value.标题 ?? value.详情 ?? value.指向);
      return Boolean(findCanonicalClueSlot(phaseName, candidate)?.clue.id === canonical.id);
    }) || {};
};

const cluePhasesFromStatData = (statData: AnyRecord): CluePhase[] => {
  const mainline = asRecord(statData.主线);
  const book = asRecord(mainline.阶段钥匙册);
  const matrix = asRecord(mainline.线索矩阵);
  const matrixByCanonicalPhase = Object.entries(matrix).reduce((acc, [id, value]) => {
    const record = clueRecordFrom(id, value);
    const phase = resolveCanonicalPhaseName(asRecord(value).阶段 ?? asRecord(value).所属阶段 ?? asRecord(value).phase ?? '');
    if (!acc[phase]) acc[phase] = {};
    acc[phase][id] = record;
    return acc;
  }, {} as Record<string, AnyRecord>);

  return eldredCanonicalCluePhases.map((phaseDef, index) => {
    const aliasRow = phaseDef.aliases
      .map(alias => asRecord(book[alias]))
      .find(rowValue => Object.keys(rowValue).length > 0);
    const row = asRecord(Object.keys(asRecord(book[phaseDef.phase])).length ? book[phaseDef.phase] : aliasRow);
    const rowClues = asRecord(row.线索);
    const matrixClues = asRecord(matrixByCanonicalPhase[phaseDef.phase]);
    const clues = phaseDef.clues.map((clue, slot) => {
      const override = clueOverrideFromVariable(phaseDef.phase, slot, clue.id, rowClues, matrixClues);
      const status = unlockedClueStatus(override.状态);
      const unlocked = status !== '未解锁';
      return clueRecordFromCanonical(clue, slot, {
        status,
        location: unlocked ? textOf(override.发现地点 ?? override.地点, clue.location) : '',
        carrier: unlocked ? textOf(override.载体, clue.carrier) : '',
        detail: unlocked ? textOf(override.展开详情 ?? override.指向 ?? override.详情 ?? override.内容, clue.detail) : '',
      });
    });
    const fallbackProgress = `${Math.min(3, clues.filter(clue => clue.status !== '未解锁').length)}/3`;
    return {
      id: phaseDef.id || `phase-${index + 1}`,
      phase: phaseDef.phase,
      eventName: textOf(row.阶段完成显示 ?? row.阶段按钮文本, phaseDef.eventName).replace(/[【】]/g, ''),
      status: textOf(row.状态, clues.some(clue => clue.status !== '未解锁') ? '记录中' : '锁定'),
      progress: textOf(row.完成度, fallbackProgress),
      buttonText: textOf(row.阶段按钮文本, phaseDef.eventDetail),
      clues,
    };
  });
};

const worldFromStatData = (statData: AnyRecord): EldredRuntimeSave['world'] => {
  const world = asRecord(statData.世界);
  const system = asRecord(statData.系统);
  return {
    currentTime: textOf(world.当前时间 ?? world.时间 ?? world.当前时刻 ?? world.日期时间 ?? world.当前日期 ?? world.日期 ?? world.日历 ?? system.当前时间),
    currentLocation: textOf(world.当前地点 ?? world.地点 ?? world.位置 ?? world.所在地点 ?? world.位置名称 ?? world.当前坐标),
    region: textOf(world.大区域 ?? world.区域 ?? world.地区 ?? world.当前大区域),
    subRegion: textOf(world.子区域 ?? world.分区 ?? world.区位 ?? world.当前子区域),
    landmark: textOf(world.具体地标 ?? world.地标 ?? world.当前地标 ?? world.小地标 ?? world.当前小地标),
    weather: textOf(world.当前天气 ?? world.天气 ?? world.气候 ?? system.当前天气),
    risk: textOf(world.风险等级 ?? world.风险 ?? world.危险等级 ?? world.当前风险),
    travelState: textOf(world.旅行状态 ?? world.移动状态 ?? world.旅行动作 ?? world.行动状态),
    presentCharacters: splitTextList(world.在场角色 ?? world.在场人物 ?? world.当前在场 ?? world.当前接触人物 ?? world.接触人物 ?? world.同场角色 ?? system.在场角色),
    dynamicBoard: dynamicBoardFromStatData(statData),
  };
};

const logFromFortuneEntry = (value: unknown, index: number): FortuneLog | null => {
  const source = asRecord(value);
  const title = textOf(source.标题 ?? source.title ?? source.名称 ?? source.name);
  if (!title) return null;
  const slot = numberOf(source.卡位 ?? source.slot, 0);
  return {
    id: textOf(source.id ?? source.ID, `fortune-log-${index}`),
    title,
    detail: textOf(source.内容 ?? source.detail ?? source.说明 ?? source.body),
    rarity: (['common', 'uncommon', 'rare', 'epic'].includes(textOf(source.稀有度 ?? source.rarity))
      ? textOf(source.稀有度 ?? source.rarity)
      : 'common') as FortuneLog['rarity'],
    kind: (['item', 'experience', 'attribute', 'skill', 'reputation', 'favor', 'effect', 'encounter'].includes(textOf(source.类型 ?? source.kind))
      ? textOf(source.类型 ?? source.kind)
      : 'item') as FortuneLog['kind'],
    createdAt: textOf(source.时间 ?? source.createdAt, new Date().toISOString()),
    slot: slot > 0 ? slot : undefined,
    synced: source.已同步 === true || source.synced === true,
    narrativeQueued: source.已发送正文 === true || source.narrativeQueued === true,
  };
};

const effectFromFortuneEntry = (value: unknown, index: number): FortuneEncounterEffect | null => {
  const source = asRecord(value);
  const title = textOf(source.标题 ?? source.title ?? source.名称 ?? source.name);
  if (!title) return null;
  return {
    id: textOf(source.id ?? source.ID, `fortune-effect-${index}`),
    title,
    detail: textOf(source.内容 ?? source.detail ?? source.效果 ?? source.body),
    source: textOf(source.来源 ?? source.source, '奇遇'),
    createdAt: textOf(source.时间 ?? source.createdAt, new Date().toISOString()),
    expiresAt: textOf(source.到期 ?? source.expiresAt),
  };
};

const arrayOrObjectValues = (value: unknown) =>
  Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.values(value as AnyRecord)
      : [];

const fortuneFromStatData = (statData: AnyRecord): EldredFortuneState => {
  const system = asRecord(statData.系统);
  const fortune = asRecord(system.翻牌 ?? system.抽卡 ?? system.翻牌系统);
  const encounter = asRecord(system.奇遇 ?? system.奇遇系统);
  const logs = arrayOrObjectValues(fortune.日志 ?? fortune.logs)
    .map(logFromFortuneEntry)
    .filter((entry): entry is FortuneLog => Boolean(entry))
    .slice(-30)
    .reverse();
  const activeEncounters = arrayOrObjectValues(encounter.常驻效果 ?? encounter.效果 ?? encounter.activeEncounters)
    .map(effectFromFortuneEntry)
    .filter((entry): entry is FortuneEncounterEffect => Boolean(entry))
    .slice(-12)
    .reverse();
  return {
    flipCount: Math.max(0, numberOf(fortune.次数 ?? fortune.翻牌次数 ?? fortune.count, 0)),
    dailyKey: textOf(encounter.今日标识 ?? encounter.dailyKey),
    logs,
    activeEncounters,
  };
};

const normalizeRuntime = (raw: Partial<EldredRuntimeSave>, source: EldredRuntimeSource): EldredRuntimeSave => {
  const entries = Array.isArray(raw.narration?.entries) ? raw.narration.entries : [];
  const messages = Array.isArray(raw.messages) ? raw.messages : [];
  return {
    schemaVersion: ELDRED_SAVE_SCHEMA_VERSION,
    source,
    player: raw.player || null,
    npcs: raw.npcs || [],
    quests: raw.quests || [],
    cluePhases: raw.cluePhases || [],
    combat: raw.combat || { turn: 1, enemyUnits: [], logs: [] },
    world: {
      ...emptyWorld(),
      ...raw.world,
      presentCharacters: raw.world?.presentCharacters || [],
      dynamicBoard: raw.world?.dynamicBoard || [],
    },
    rawStatData: raw.rawStatData,
    fortune: {
      ...createEmptyFortuneState(),
      ...raw.fortune,
      logs: Array.isArray(raw.fortune?.logs) ? raw.fortune.logs.slice(0, 30) : [],
      activeEncounters: Array.isArray(raw.fortune?.activeEncounters) ? raw.fortune.activeEncounters.slice(0, 12) : [],
    },
    narration: {
      entries: entries
        .filter(entry => entry && typeof entry === 'object')
        .map(entry => ({
          id: textOf(entry.id, `nar-${Date.now()}`),
          kind: (['opening', 'free', 'event', 'combat'].includes(textOf(entry.kind)) ? entry.kind : 'event') as EldredNarrationKind,
          title: textOf(entry.title, '正文'),
          userInput: textOf(entry.userInput),
          text: textOf(entry.text),
          createdAt: textOf(entry.createdAt, new Date().toISOString()),
          sourceEventType: textOf(entry.sourceEventType),
          characterTags: splitTextList(entry.characterTags),
          rawStatDataBefore: asRecord(entry.rawStatDataBefore),
          rawStatDataAfter: asRecord(entry.rawStatDataAfter),
        })),
      lastGeneratedAt: textOf(raw.narration?.lastGeneratedAt),
      lastError: textOf(raw.narration?.lastError),
    },
    messages: messages
      .filter(message => message && typeof message === 'object')
      .map(message => ({
        id: textOf(message.id, `msg-${Date.now()}`),
        role: (['user', 'assistant', 'system'].includes(textOf(message.role)) ? message.role : 'user') as EldredRuntimeMessage['role'],
        text: textOf(message.text),
        createdAt: textOf(message.createdAt, new Date().toISOString()),
      })),
    updatedAt: raw.updatedAt || new Date().toISOString(),
    contextKey: textOf(raw.contextKey),
  };
};

export const runtimeFromStatData = (statData: AnyRecord): EldredRuntimeSave => ({
  schemaVersion: ELDRED_SAVE_SCHEMA_VERSION,
  source: 'mvu',
  player: playerFromStatData(statData),
  npcs: npcsFromStatData(statData),
  quests: questsFromStatData(statData),
  cluePhases: cluePhasesFromStatData(statData),
  combat: combatFromStatData(statData),
  world: worldFromStatData(statData),
  rawStatData: statData,
  fortune: fortuneFromStatData(statData),
  narration: createEmptyNarrationState(),
  messages: [],
  updatedAt: new Date().toISOString(),
  contextKey: currentRuntimeContextKey(),
});

const sameRuntimeIdentity = (left?: EldredRuntimeSave | null, right?: EldredRuntimeSave | null) => {
  if (!left || !right) return false;
  if (left.contextKey && right.contextKey) return left.contextKey === right.contextKey;
  const leftPlayer = left.player;
  const rightPlayer = right.player;
  if (!leftPlayer || !rightPlayer) return false;
  return leftPlayer.name === rightPlayer.name
    && leftPlayer.classId === rightPlayer.classId
    && leftPlayer.raceId === rightPlayer.raceId
    && leftPlayer.originId === rightPlayer.originId;
};

const playerNeedsCachedOpening = (synced?: PlayerState | null, cached?: PlayerState | null) => {
  if (!synced || !cached) return false;
  const syncedNameIsPlaceholder = isPlaceholderPlayerName(synced.name) || isPlaceholderPlayerName(synced.identity.name);
  const missingOpeningSkills = synced.knownSkillIds.length === 0 && cached.knownSkillIds.length > 0;
  const missingOpeningEquipment = synced.equipmentIds.length === 0 && cached.equipmentIds.length > 0;
  const syncedClassLooksDefault = synced.classId === 'ranger' && cached.classId !== 'ranger' && missingOpeningSkills;
  return syncedNameIsPlaceholder || missingOpeningSkills || missingOpeningEquipment || syncedClassLooksDefault;
};

export const loadEldredRuntimeSave = (): EldredRuntimeSave => {
  const cachedRuntime = readCachedRuntime();
  const statData = readMvuData();
  if (statData) {
    const runtime = runtimeFromStatData(statData);
    if (Object.keys(statData).length > 0) {
      const canUseCachedRuntime = sameRuntimeIdentity(cachedRuntime, runtime);
      const canMergeCachedOpening = canUseCachedRuntime || playerNeedsCachedOpening(runtime.player, cachedRuntime?.player);
      const cachedWorld = canUseCachedRuntime ? cachedRuntime?.world : undefined;
      const cachedFortune = canUseCachedRuntime ? cachedRuntime?.fortune : undefined;
      const world = {
        ...runtime.world,
        currentTime: runtime.world.currentTime || cachedWorld?.currentTime || '',
        currentLocation: runtime.world.currentLocation || cachedWorld?.currentLocation || '',
        region: runtime.world.region || cachedWorld?.region || '',
        subRegion: runtime.world.subRegion || cachedWorld?.subRegion || '',
        landmark: runtime.world.landmark || cachedWorld?.landmark || '',
        weather: runtime.world.weather || cachedWorld?.weather || '',
        risk: runtime.world.risk || cachedWorld?.risk || '',
        travelState: runtime.world.travelState || cachedWorld?.travelState || '',
        presentCharacters: runtime.world.presentCharacters.length ? runtime.world.presentCharacters : cachedWorld?.presentCharacters || [],
        dynamicBoard: runtime.world.dynamicBoard.length ? runtime.world.dynamicBoard : cachedWorld?.dynamicBoard || [],
      };
      return {
        ...runtime,
        player: mergePlayerWithCachedOpening(runtime.player, canMergeCachedOpening ? cachedRuntime?.player : null),
        npcs: runtime.npcs.length ? runtime.npcs : canUseCachedRuntime ? cachedRuntime?.npcs || [] : [],
        quests: runtime.quests.length ? runtime.quests : canUseCachedRuntime ? cachedRuntime?.quests || [] : [],
        cluePhases: runtime.cluePhases.some(phase => phase.clues.length)
          ? runtime.cluePhases
          : canUseCachedRuntime ? cachedRuntime?.cluePhases || runtime.cluePhases : runtime.cluePhases,
        combat: runtime.combat.enemyUnits.length || runtime.combat.logs.length
          ? runtime.combat
          : canUseCachedRuntime ? cachedRuntime?.combat || runtime.combat : runtime.combat,
        world,
        narration: canUseCachedRuntime ? cachedRuntime?.narration || runtime.narration : runtime.narration,
        messages: canUseCachedRuntime ? cachedRuntime?.messages || runtime.messages : runtime.messages,
        fortune: runtime.fortune.flipCount || runtime.fortune.logs.length || runtime.fortune.activeEncounters.length || runtime.fortune.dailyKey
          ? runtime.fortune
          : cachedFortune || runtime.fortune,
      };
    }
  }

  return cachedRuntime || createEmptyEldredRuntimeSave();
};

export const runtimeFromCreatedPlayer = (player: PlayerState): EldredRuntimeSave => ({
  ...createEmptyEldredRuntimeSave(),
  source: 'cache',
  player,
  rawStatData: playerStatDataFromState(player),
  contextKey: currentRuntimeContextKey(),
  world: {
    ...emptyWorld(),
    currentLocation: player.location.name,
    region: player.location.regionId,
    landmark: player.location.landmarkName,
    weather: player.location.weather,
    risk: player.location.trouble,
  },
});
