import {
  AttributeKey,
  Character,
  CharacterClassId,
  CharacterRaceId,
  CombatUnit,
  EquipmentLoadout,
  EquipmentSlot,
  ImmersiveNotice,
  OriginLocation,
  PlayerState,
  Quest,
  RelationshipRecord,
  ReputationRecord,
} from '../types';
import {
  ATTRIBUTE_KEYS,
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
  skills,
} from './rules';
import { characterImage } from '../data';

type AnyRecord = Record<string, any>;

export const ELDRED_SAVE_KEY = 'eldred_save_v1';
export const ELDRED_SAVE_SCHEMA_VERSION = 1;

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
  };
  rawStatData?: AnyRecord;
  narration: EldredNarrationState;
  messages: EldredRuntimeMessage[];
  updatedAt: string;
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
  combat: {
    turn: 1,
    enemyUnits: [],
    logs: [],
  },
  world: emptyWorld(),
  narration: createEmptyNarrationState(),
  messages: [],
  updatedAt: new Date().toISOString(),
});

const asRecord = (value: unknown): AnyRecord => (value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {});
const asArray = (value: unknown): any[] => Array.isArray(value) ? value : [];

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

const textOf = (value: unknown, fallback = ''): string => {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text && text !== '待开局' && text !== '未记录' ? text : fallback;
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

const readMvuData = (): AnyRecord | null => {
  for (const api of hostScopes()) {
    try {
      if (api.Mvu && typeof api.Mvu.getMvuData === 'function') {
        const messageData = api.Mvu.getMvuData({ type: 'message', message_id: 'latest' });
        const statData = asRecord(messageData?.stat_data);
        if (Object.keys(statData).length > 0) return statData;
      }
      if (api.__eldredWelcomeBridge?.Mvu && typeof api.__eldredWelcomeBridge.Mvu.getMvuData === 'function') {
        const messageData = api.__eldredWelcomeBridge.Mvu.getMvuData({ type: 'message', message_id: 'latest' });
        const statData = asRecord(messageData?.stat_data);
        if (Object.keys(statData).length > 0) return statData;
      }
    } catch {
      // ignored: the UI must also work as a standalone html file.
    }
  }

  const messageVariables = readVariables({ type: 'message', message_id: 'latest' });
  const statData = asRecord(messageVariables?.stat_data);
  if (Object.keys(statData).length > 0) return statData;

  const chatVariables = readVariables({ type: 'chat' });
  const chatStatData = asRecord(chatVariables?.stat_data);
  if (Object.keys(chatStatData).length > 0) return chatStatData;

  return null;
};

const readCachedRuntime = (): EldredRuntimeSave | null => {
  const chatVariables = readVariables({ type: 'chat' });
  const stored = chatVariables?.[ELDRED_SAVE_KEY];
  if (stored && typeof stored === 'object') return normalizeRuntime(stored as EldredRuntimeSave, 'cache');
  if (typeof stored === 'string') {
    try {
      return normalizeRuntime(JSON.parse(stored), 'cache');
    } catch {
      // ignored
    }
  }

  if (hasTavernVariableBridge()) return null;

  try {
    const local = localStorage.getItem(ELDRED_SAVE_KEY);
    if (local) return normalizeRuntime(JSON.parse(local), 'cache');
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
  };

  try {
    localStorage.setItem(ELDRED_SAVE_KEY, JSON.stringify(cached));
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
  return ATTRIBUTE_KEYS.reduce((acc, key) => {
    const chineseKey = Object.entries(attributeKeyByChinese).find(([, mapped]) => mapped === key)?.[0] || key;
    acc[key] = numberOf(source[key] ?? source[chineseKey], fallback[key]);
    return acc;
  }, {} as Record<AttributeKey, number>);
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
  return skills.find(item => item.id === raw || item.name === raw || raw.includes(item.name))?.id;
};

const loadoutFrom = (raw: unknown): EquipmentLoadout => {
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
  if (Array.isArray(raw)) return [...new Set(raw.map(findEquipmentId).filter((id): id is string => Boolean(id)))];
  const source = asRecord(raw);
  const ids = Object.values(source).map(findEquipmentId).filter((id): id is string => Boolean(id));
  return [...new Set(ids)];
};

const skillIdsFrom = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return [...new Set(raw.map(findSkillId).filter((id): id is string => Boolean(id)))];
  const source = asRecord(raw);
  return [...new Set(Object.values(source).map(findSkillId).filter((id): id is string => Boolean(id)))];
};

const findOrigin = (world: AnyRecord, playerRecord?: AnyRecord): OriginLocation => {
  const currentLocation = textOf(world.当前地点 ?? world.具体地标 ?? playerRecord?.出生点);
  const landmark = textOf(world.具体地标 ?? playerRecord?.出生点);
  const region = textOf(world.大区域 ?? world.子区域);
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
    weather: textOf(world.当前天气),
    trouble: textOf(world.风险等级),
    firstNpc: splitTextList(world.在场角色).join('、'),
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

const noticesFrom = (raw: unknown): ImmersiveNotice[] => {
  const values = Array.isArray(raw) ? raw : Object.values(asRecord(raw));
  return values.slice(-12).map((value, index) => {
    const source = asRecord(value);
    return {
      id: textOf(source.id, `notice-${index}`),
      type: 'event',
      title: textOf(source.标题 ?? source.title ?? source.类型, '事件进展'),
      body: textOf(source.内容 ?? source.body ?? value),
      meta: textOf(source.来源 ?? source.meta),
    };
  });
};

const hasPlayerBattleData = (battle: AnyRecord) => {
  const hp = textOf(battle.生命);
  const attrs = asRecord(battle.五维);
  return Boolean(hp || Object.keys(attrs).length || textOf(battle.职业));
};

const playerFromStatData = (statData: AnyRecord): PlayerState | null => {
  const world = asRecord(statData.世界);
  const main = asRecord(statData.主角);
  const identityRecord = asRecord(main.身份 ?? main.角色 ?? main.基本信息);
  const battle = asRecord(main.战斗);
  if (!hasPlayerBattleData(battle) && Object.keys(identityRecord).length === 0) return null;

  const classId = resolveClassId(identityRecord.职业 ?? battle.职业 ?? main.职业);
  const raceId = resolveRaceId(identityRecord.种族 ?? battle.种族 ?? main.种族);
  const cls = getClassById(classId);
  const baseAttributes = attributesFrom(battle.五维 ?? identityRecord.五维, cls.presetStats);
  const location = findOrigin(world, identityRecord);
  const loadout = loadoutFrom(battle.装备栏 ?? main.装备栏);
  const equipmentIds = [...new Set([...equipmentIdsFrom(battle.装备栏), ...equippedIdsFromLoadout(loadout)])];
  const knownSkillIds = skillIdsFrom(battle.已知技能 ?? main.技能库);
  const activeSkillIds = skillIdsFrom(battle.激活技能).filter(id => knownSkillIds.length === 0 || knownSkillIds.includes(id)).slice(0, 4);
  const level = Math.max(1, numberOf(battle.等级 ?? identityRecord.等级, 1));
  const derived = calculateDerivedStats(level, classId, baseAttributes, equippedIdsFromLoadout(loadout), raceId);
  const hp = parseVitals(battle.生命, derived.hp, derived.maxHp);
  const mp = parseVitals(battle.法力, derived.mp, derived.maxMp);
  const stats = {
    ...derived,
    hp: hp.current,
    maxHp: hp.max,
    mp: mp.current,
    maxMp: mp.max,
    ac: numberOf(battle.护甲, derived.ac),
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
    partyMemberIds: Object.keys(asRecord(main.当前队伍)).filter(id => id !== name && id !== '{{user}}'),
    relationships: relationshipRecordsFrom(asRecord(statData.关系).好感),
    reputations: reputationRecordsFrom(asRecord(statData.关系).地区声望),
    notices: noticesFrom(asRecord(statData.系统).前端提示 ?? asRecord(statData.系统).事件记录),
  };
};

const characterFromVariable = (name: string, raw: unknown, type: Character['type']): Character => {
  const source = asRecord(raw);
  const battle = asRecord(source.战斗 ?? source.数值 ?? source);
  const classId = resolveClassId(source.职业 ?? battle.职业 ?? source.profession);
  const raceId = resolveRaceId(source.种族 ?? battle.种族);
  const cls = getClassById(classId);
  const baseAttributes = attributesFrom(battle.五维 ?? source.五维, cls.presetStats);
  const loadout = loadoutFrom(battle.装备栏 ?? source.装备 ?? source.装备栏);
  const equipmentIds = [...new Set([...equipmentIdsFrom(battle.装备栏 ?? source.装备), ...equippedIdsFromLoadout(loadout)])];
  const knownSkillIds = skillIdsFrom(battle.已知技能 ?? source.已知技能);
  const activeSkillIds = skillIdsFrom(battle.激活技能 ?? source.激活技能).filter(id => knownSkillIds.length === 0 || knownSkillIds.includes(id)).slice(0, 4);
  const level = Math.max(1, numberOf(battle.等级 ?? source.等级, 1));
  const derived = calculateDerivedStats(level, classId, baseAttributes, equippedIdsFromLoadout(loadout), raceId);
  const hp = parseVitals(battle.生命, derived.hp, derived.maxHp);
  const mp = parseVitals(battle.法力, derived.mp, derived.maxMp);

  return {
    id: textOf(source.id, name),
    name,
    fullName: textOf(source.全名 ?? source.fullName, name),
    type,
    race: getRaceById(raceId).name,
    raceId,
    gender: textOf(source.性别, '未记录'),
    age: textOf(source.年龄, '未记录'),
    affiliation: textOf(source.所属 ?? source.势力 ?? source.affiliation, '未登记'),
    identity: textOf(source.身份 ?? source.职责, '未登记'),
    classId,
    profession: textOf(source.职业 ?? source.职责, getClassById(classId).name),
    avatarUrl: characterImage(name, '头像'),
    portraitUrl: characterImage(name, '立绘'),
    stats: {
      ...derived,
      hp: hp.current,
      maxHp: hp.max,
      mp: mp.current,
      maxMp: mp.max,
      ac: numberOf(battle.护甲, derived.ac),
    },
    experience: numberOf(battle.经验 ?? source.经验, 0),
    nextLevelExperience: numberOf(battle.下级经验 ?? source.下级经验, experienceForNextLevel(level)),
    availableAttributePoints: numberOf(battle.可分配点数 ?? source.可分配点数, 0),
    favorability: numberOf(source.好感 ?? source.好感度, 0),
    relationshipStage: textOf(source.关系阶段 ?? source.阶段, '陌生'),
    equipmentIds,
    equipmentLoadout: loadout,
    activeSkillIds,
    knownSkillIds,
    attributes: splitTextList(source.特质 ?? source.属性 ?? source.标签),
    skills: activeSkillIds.map(id => getSkillById(id)).filter((skill): skill is NonNullable<typeof skill> => Boolean(skill)),
  };
};

const npcsFromStatData = (statData: AnyRecord): Character[] => {
  const collection = asRecord(asRecord(statData.主角).角色收集);
  const major = asRecord(collection.主要NPC);
  const other = asRecord(collection.其他NPC);
  return [
    ...Object.entries(major).map(([name, value]) => characterFromVariable(name, value, 'NPC登记')),
    ...Object.entries(other).map(([name, value]) => characterFromVariable(name, value, 'NPC登记')),
  ];
};

const questsFromStatData = (statData: AnyRecord): Quest[] =>
  Object.entries(asRecord(asRecord(statData.主角).任务列表)).map(([id, value], index) => {
    const source = asRecord(value);
    return {
      id,
      title: textOf(source.标题 ?? source.名称, id),
      source: textOf(source.来源 ?? source.发布者, '未登记'),
      task: textOf(source.目标 ?? source.说明 ?? source.任务, ''),
      recLevel: numberOf(source.建议等级 ?? source.等级, 1),
      risk: (['极高', '高', '中', '低'].includes(textOf(source.风险)) ? textOf(source.风险) : '中') as Quest['risk'],
      reward: textOf(source.奖励 ?? source.报酬, ''),
      timeLimit: textOf(source.时限 ?? source.截止, ''),
      reputationRegionId: textOf(source.声望地区, undefined as unknown as string),
      reputationReward: source.声望奖励 === undefined ? undefined : numberOf(source.声望奖励, 0),
    } satisfies Quest;
  }).filter((quest, index) => quest.title || index >= 0);

const combatUnitFrom = (name: string, raw: unknown, isEnemy: boolean): CombatUnit => {
  const source = asRecord(raw);
  const level = Math.max(1, numberOf(source.等级, 1));
  const classId = resolveClassId(source.职业);
  const attrs = attributesFrom(source.五维, getClassById(classId).presetStats);
  const loadout = loadoutFrom(source.装备 ?? source.装备栏);
  const derived = calculateDerivedStats(level, classId, attrs, equippedIdsFromLoadout(loadout));
  const hp = parseVitals(source.生命, derived.hp, derived.maxHp);
  const mp = parseVitals(source.法力, derived.mp, derived.maxMp);
  return {
    id: textOf(source.id, name),
    name,
    isEnemy,
    level,
    hp: hp.current,
    maxHp: hp.max,
    mp: mp.current,
    maxMp: mp.max,
    ac: numberOf(source.护甲, derived.ac),
    stats: attrs,
    skillIds: skillIdsFrom(source.激活技能 ?? source.技能),
    equipmentIds: equipmentIdsFrom(source.装备 ?? source.装备栏),
    ap: numberOf(source.行动点, 1),
    maxAp: numberOf(source.最大行动点, 1),
    shield: numberOf(source.护盾, 0),
    statusLogs: splitTextList(source.状态),
  };
};

const combatFromStatData = (statData: AnyRecord): EldredRuntimeSave['combat'] => {
  const cache = asRecord(asRecord(statData.系统).战斗缓存);
  const participants = asRecord(cache.参战名单);
  const enemyUnits = Object.entries(participants)
    .filter(([, value]) => /敌|魔物|怪物|enemy/i.test(textOf(asRecord(value).阵营 ?? asRecord(value).类型)))
    .map(([name, value]) => combatUnitFrom(name, value, true));
  const directEnemies = Object.entries(asRecord(cache.敌方)).map(([name, value]) => combatUnitFrom(name, value, true));
  return {
    turn: Math.max(1, numberOf(cache.回合, 1)),
    enemyUnits: [...enemyUnits, ...directEnemies],
    logs: splitTextList(cache.回合变化 ?? cache.日志),
  };
};

const worldFromStatData = (statData: AnyRecord): EldredRuntimeSave['world'] => {
  const world = asRecord(statData.世界);
  return {
    currentTime: textOf(world.当前时间),
    currentLocation: textOf(world.当前地点),
    region: textOf(world.大区域),
    subRegion: textOf(world.子区域),
    landmark: textOf(world.具体地标),
    weather: textOf(world.当前天气),
    risk: textOf(world.风险等级),
    travelState: textOf(world.旅行状态),
    presentCharacters: splitTextList(world.在场角色),
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
    combat: raw.combat || { turn: 1, enemyUnits: [], logs: [] },
    world: raw.world || emptyWorld(),
    rawStatData: raw.rawStatData,
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
  };
};

export const runtimeFromStatData = (statData: AnyRecord): EldredRuntimeSave => ({
  schemaVersion: ELDRED_SAVE_SCHEMA_VERSION,
  source: 'mvu',
  player: playerFromStatData(statData),
  npcs: npcsFromStatData(statData),
  quests: questsFromStatData(statData),
  combat: combatFromStatData(statData),
  world: worldFromStatData(statData),
  rawStatData: statData,
  narration: createEmptyNarrationState(),
  messages: [],
  updatedAt: new Date().toISOString(),
});

export const loadEldredRuntimeSave = (): EldredRuntimeSave => {
  const cachedRuntime = readCachedRuntime();
  const statData = readMvuData();
  if (statData) {
    const runtime = runtimeFromStatData(statData);
    if (runtime.player || runtime.npcs.length || runtime.quests.length || runtime.combat.enemyUnits.length) {
      const cachedWorld = cachedRuntime?.world;
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
      };
      return {
        ...runtime,
        player: runtime.player || cachedRuntime?.player || null,
        npcs: runtime.npcs.length ? runtime.npcs : cachedRuntime?.npcs || [],
        quests: runtime.quests.length ? runtime.quests : cachedRuntime?.quests || [],
        combat: runtime.combat.enemyUnits.length || runtime.combat.logs.length
          ? runtime.combat
          : cachedRuntime?.combat || runtime.combat,
        world,
        narration: cachedRuntime?.narration || runtime.narration,
        messages: cachedRuntime?.messages || runtime.messages,
      };
    }
  }

  return cachedRuntime || createEmptyEldredRuntimeSave();
};

export const runtimeFromCreatedPlayer = (player: PlayerState): EldredRuntimeSave => ({
  ...createEmptyEldredRuntimeSave(),
  source: 'cache',
  player,
  world: {
    ...emptyWorld(),
    currentLocation: player.location.name,
    region: player.location.regionId,
    landmark: player.location.landmarkName,
    weather: player.location.weather,
    risk: player.location.trouble,
  },
});
