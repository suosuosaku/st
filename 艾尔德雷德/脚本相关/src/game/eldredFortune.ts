import {
  EldredFortuneState,
  FortuneEncounterEffect,
  FortuneLog,
  FortuneRarity,
  FortuneRewardKind,
  ImmersiveNotice,
  PlayerState,
} from '../types';
import {
  EldredRuntimeSave,
  createEmptyFortuneState,
  persistEldredRuntimeCache,
} from './eldredSave';
import { EldredFrontendEventInput } from './eldredEvents';
import { gainExperience, getSkillById } from './rules';
import { writeEldredStatDataToHost } from './eldredNarration';

type AnyRecord = Record<string, any>;

type RewardDefinition = {
  id: string;
  title: string;
  kind: FortuneRewardKind;
  rarity: FortuneRarity;
  weight: number;
  detail: string;
  minLevel?: number;
  item?: {
    name: string;
    category: string;
    quantity: number;
    description: string;
  };
  experience?: number;
  attributePoints?: number;
  skillId?: string;
  reputation?: {
    region: string;
    value: number;
    stage: string;
  };
  favor?: {
    name: string;
    value: number;
    stage: string;
  };
  effect?: {
    source: string;
    duration?: string;
  };
  eventPrompt?: string;
};

export type EldredFortuneResult = {
  runtime: EldredRuntimeSave;
  log: FortuneLog;
  reward: RewardDefinition;
  message: string;
  event?: Omit<EldredFrontendEventInput, 'player' | 'party' | 'enemies'>;
};

const CARD_REWARD_POOL: RewardDefinition[] = [
  {
    id: 'ration-wrapped-bun',
    title: '热包纸袋',
    kind: 'item',
    rarity: 'common',
    weight: 16,
    detail: '恢复用消耗品，适合短休或狼狈战斗后使用。',
    item: { name: '热包纸袋', category: '消耗品', quantity: 1, description: '热气没有完全跑光的行会便食。使用后交由正文判定恢复与场景反应。' },
  },
  {
    id: 'minor-mana-syrup',
    title: '微光糖浆',
    kind: 'item',
    rarity: 'common',
    weight: 14,
    detail: '低阶法力补给，味道像被星砂照过的糖水。',
    item: { name: '微光糖浆', category: '消耗品', quantity: 1, description: '低阶法力补给。使用时进入正文，由当前状态判定恢复量。' },
  },
  {
    id: 'clean-bandage-roll',
    title: '干净绷带卷',
    kind: 'item',
    rarity: 'common',
    weight: 14,
    detail: '野营、急救与低阶治疗技能的常用材料。',
    item: { name: '干净绷带卷', category: '消耗品', quantity: 2, description: '野营或急救用材料，可支撑低阶包扎与止血。' },
  },
  {
    id: 'guild-copper-coupon',
    title: '行会铜券',
    kind: 'item',
    rarity: 'common',
    weight: 12,
    detail: '可在行会窗口抵扣低额杂费。',
    item: { name: '行会铜券', category: '任务物品', quantity: 1, description: '行会发行的小额抵扣券，适合登记、问询或低价补给。' },
  },
  {
    id: 'exp-small-errand',
    title: '跑腿经验',
    kind: 'experience',
    rarity: 'common',
    weight: 13,
    detail: '从一段不起眼的小麻烦里攒下的冒险经验。',
    experience: 35,
  },
  {
    id: 'exp-field-note',
    title: '现场笔记',
    kind: 'experience',
    rarity: 'uncommon',
    weight: 8,
    detail: '一次有效观察带来的经验。',
    experience: 60,
  },
  {
    id: 'skill-old-page-reading',
    title: '技能页：旧页辨识',
    kind: 'skill',
    rarity: 'uncommon',
    weight: 5,
    detail: '技能进入技能库，不自动装配。',
    skillId: 'sage-page-reading',
  },
  {
    id: 'skill-trap-thread',
    title: '技能页：陷阱拆线',
    kind: 'skill',
    rarity: 'uncommon',
    weight: 5,
    detail: '技能进入技能库，不自动装配。',
    skillId: 'ranger-trap-thread',
  },
  {
    id: 'skill-pop-vial',
    title: '技能页：爆响瓶',
    kind: 'skill',
    rarity: 'uncommon',
    weight: 5,
    detail: '技能进入技能库，不自动装配。',
    skillId: 'alchemist-pop-vial',
  },
  {
    id: 'reputation-seven-banners',
    title: '七旗城熟面',
    kind: 'reputation',
    rarity: 'uncommon',
    weight: 7,
    detail: '地区声望小幅上升。',
    reputation: { region: '七旗城', value: 1, stage: '听闻' },
  },
  {
    id: 'favor-tavern-staff',
    title: '酒馆熟脸',
    kind: 'favor',
    rarity: 'uncommon',
    weight: 6,
    detail: '折断的剑酒馆相关NPC对你更眼熟。',
    favor: { name: '折断的剑酒馆', value: 1, stage: '眼熟' },
  },
  {
    id: 'attribute-point-one',
    title: '自由加点光点',
    kind: 'attribute',
    rarity: 'rare',
    weight: 3,
    detail: '获得1点可分配五维点数。',
    attributePoints: 1,
  },
  {
    id: 'encounter-lost-courier',
    title: '错路邮差',
    kind: 'encounter',
    rarity: 'rare',
    weight: 4,
    detail: '一名邮差敲错了门，带来一封目的地不对的信。',
    eventPrompt: '翻牌触发奇遇：错路邮差。当前地点出现一名送错信的邮差，信件目的地与当前地标不符，请生成一段可选择是否介入的轻喜剧奇遇正文，并按实际结果写变量。',
  },
  {
    id: 'encounter-table-mixup',
    title: '错桌委托',
    kind: 'encounter',
    rarity: 'rare',
    weight: 4,
    detail: '别人的委托单被端到了你面前。',
    eventPrompt: '翻牌触发奇遇：错桌委托。当前地标出现一张被送错桌的低阶委托单，请生成一段可拒绝、可询问、可接触发布者的轻喜剧奇遇正文，并按实际结果写变量。',
  },
  {
    id: 'effect-cheap-lodging',
    title: '便宜旅店情报',
    kind: 'effect',
    rarity: 'uncommon',
    weight: 6,
    detail: '下一次住宿、问路或市井传闻检定获得+1情境修正。',
    effect: { source: '翻牌', duration: '下次住宿、问路或市井传闻检定后移除' },
  },
  {
    id: 'effect-map-corner',
    title: '地图角落标注',
    kind: 'effect',
    rarity: 'uncommon',
    weight: 6,
    detail: '下一次路线、找路或地标入口检定获得+1情境修正。',
    effect: { source: '翻牌', duration: '下次路线或地标入口检定后移除' },
  },
  {
    id: 'effect-lucky-copper',
    title: '幸运铜扣',
    kind: 'effect',
    rarity: 'epic',
    weight: 1,
    detail: '下一次D20行动判定失败时，可把差值1以内的失败改为部分成功。',
    effect: { source: '翻牌', duration: '触发一次后移除' },
  },
];

const DAILY_ENCOUNTER_POOL: RewardDefinition[] = [
  {
    id: 'daily-market-whisper',
    title: '今日见闻：市集绕价',
    kind: 'effect',
    rarity: 'common',
    weight: 10,
    detail: '今日第一次交易、询价或打听货源检定+1。',
    effect: { source: '每日奇遇', duration: '今日结束或触发一次后移除' },
  },
  {
    id: 'daily-road-bell',
    title: '今日见闻：路铃顺风',
    kind: 'effect',
    rarity: 'common',
    weight: 10,
    detail: '今日第一次旅行、换区或问路检定+1。',
    effect: { source: '每日奇遇', duration: '今日结束或触发一次后移除' },
  },
  {
    id: 'daily-notice-misprint',
    title: '今日见闻：告示错字',
    kind: 'encounter',
    rarity: 'uncommon',
    weight: 5,
    detail: '城镇告示出现错字，可能牵出一个小麻烦。',
    eventPrompt: '每日奇遇触发：告示错字。当前地标的一张公告出现离谱错字，请生成一段轻喜剧调查入口，不强制玩家接取，并按实际结果写变量。',
  },
  {
    id: 'daily-hot-soup',
    title: '今日见闻：热汤折扣',
    kind: 'item',
    rarity: 'common',
    weight: 8,
    detail: '获得一份可在休整时使用的热汤券。',
    item: { name: '热汤折扣券', category: '消耗品', quantity: 1, description: '便宜旅店或酒馆可用。使用时进入正文，由当前地点判定效果。' },
  },
];

const nowIso = () => new Date().toISOString();

const todayKey = () => new Date().toISOString().slice(0, 10);

const isRecord = (value: unknown): value is AnyRecord =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const cloneRecord = (value: unknown): AnyRecord => {
  if (!isRecord(value)) return {};
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return { ...value };
  }
};

const ensureRecordAt = (root: AnyRecord, path: string[]) => {
  let cursor = root;
  for (const segment of path) {
    if (!isRecord(cursor[segment])) cursor[segment] = {};
    cursor = cursor[segment] as AnyRecord;
  }
  return cursor;
};

const asArray = (value: unknown) => Array.isArray(value) ? value : [];

const appendLimited = <T,>(items: T[], item: T, limit: number) => [item, ...items].slice(0, limit);

const weightedPick = (pool: RewardDefinition[], playerLevel: number) => {
  const candidates = pool.filter(item => !item.minLevel || playerLevel >= item.minLevel);
  const total = candidates.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  let cursor = Math.random() * Math.max(1, total);
  for (const item of candidates) {
    cursor -= Math.max(0, item.weight);
    if (cursor <= 0) return item;
  }
  return candidates[0] || pool[0];
};

const createNotice = (reward: RewardDefinition): ImmersiveNotice => ({
  id: `fortune-notice-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  type: reward.kind === 'item' ? 'item' : reward.kind === 'skill' ? 'skill' : reward.kind === 'reputation' ? 'reputation' : reward.kind === 'favor' ? 'favor' : 'event',
  title: `翻牌结果：${reward.title}`,
  body: reward.detail,
  meta: reward.rarity,
});

const mergeNotice = (player: PlayerState, reward: RewardDefinition): PlayerState => ({
  ...player,
  notices: [createNotice(reward), ...player.notices].slice(0, 24),
});

const createLog = (reward: RewardDefinition, slot?: number, synced = false): FortuneLog => ({
  id: `fortune-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: reward.title,
  detail: reward.detail,
  rarity: reward.rarity,
  kind: reward.kind,
  createdAt: nowIso(),
  slot,
  synced,
  narrativeQueued: reward.kind === 'encounter',
});

const logToStatRecord = (log: FortuneLog) => ({
  id: log.id,
  标题: log.title,
  内容: log.detail,
  稀有度: log.rarity,
  类型: log.kind,
  时间: log.createdAt,
  卡位: log.slot,
  已同步: Boolean(log.synced),
  已发送正文: Boolean(log.narrativeQueued),
});

const effectToStatRecord = (effect: FortuneEncounterEffect) => ({
  id: effect.id,
  标题: effect.title,
  内容: effect.detail,
  来源: effect.source,
  时间: effect.createdAt,
  到期: effect.expiresAt,
});

const updatePlayerBattleStat = (statData: AnyRecord, player: PlayerState) => {
  const battle = ensureRecordAt(statData, ['主角', '战斗']);
  battle.等级 = player.level;
  battle.经验 = player.experience;
  battle.下级经验 = player.nextLevelExperience;
  battle.可分配点数 = player.availableAttributePoints;
  battle.生命 = `${player.stats.hp}/${player.stats.maxHp}`;
  battle.法力 = `${player.stats.mp}/${player.stats.maxMp}`;
  battle.护甲 = player.stats.ac;
  battle.熟练 = player.stats.proficiency;
  battle.五维 = {
    力量: player.baseAttributes.str,
    敏捷: player.baseAttributes.dex,
    体质: player.baseAttributes.vit,
    智力: player.baseAttributes.int,
    精神: player.baseAttributes.spr,
  };
};

const appendFrontendNotice = (statData: AnyRecord, title: string, body: string) => {
  const system = ensureRecordAt(statData, ['系统']);
  const notices = asArray(system.前端提示);
  system.前端提示 = [
    ...notices,
    {
      id: `fortune-tag-${Date.now()}-${notices.length}`,
      标题: title,
      类型: title,
      内容: body,
    },
  ].slice(-16);
};

const incrementRecordValue = (record: AnyRecord, key: string, delta: number) => {
  const current = Number(record[key]);
  record[key] = (Number.isFinite(current) ? current : 0) + delta;
};

const applyRewardToState = (
  runtime: EldredRuntimeSave,
  reward: RewardDefinition,
  statData: AnyRecord,
) => {
  let player = runtime.player ? mergeNotice(runtime.player, reward) : runtime.player;
  const activeEncounters = [...runtime.fortune.activeEncounters];

  if (reward.item) {
    const bag = ensureRecordAt(statData, ['主角', '背包']);
    const existing = isRecord(bag[reward.item.name]) ? bag[reward.item.name] : {};
    bag[reward.item.name] = {
      ...existing,
      名称: reward.item.name,
      分类: reward.item.category,
      数量: (Number(existing.数量) || 0) + reward.item.quantity,
      来源: '翻牌',
      说明: reward.item.description,
    };
    if (player && !player.inventory.includes(reward.item.name)) {
      player = { ...player, inventory: [...player.inventory, reward.item.name] };
    }
  }

  if (reward.experience && player) {
    player = gainExperience(player, reward.experience);
    updatePlayerBattleStat(statData, player);
  }

  if (reward.attributePoints && player) {
    player = {
      ...player,
      availableAttributePoints: player.availableAttributePoints + reward.attributePoints,
    };
    updatePlayerBattleStat(statData, player);
  }

  if (reward.skillId && player) {
    const skill = getSkillById(reward.skillId);
    if (skill) {
      const knownSkillIds = player.knownSkillIds.includes(skill.id)
        ? player.knownSkillIds
        : [...player.knownSkillIds, skill.id];
      player = { ...player, knownSkillIds };
      const skills = ensureRecordAt(statData, ['主角', '战斗', '已知技能']);
      skills[skill.name] = {
        名称: skill.name,
        阶位: skill.rank,
        类型: skill.actionType,
        消耗: skill.mpCost,
        来源: '翻牌',
        效果: skill.desc,
        状态: '技能库',
      };
    }
  }

  if (reward.reputation) {
    const reputation = ensureRecordAt(statData, ['关系', '地区声望']);
    const current = isRecord(reputation[reward.reputation.region]) ? reputation[reward.reputation.region] : {};
    reputation[reward.reputation.region] = {
      ...current,
      数值: (Number(current.数值) || 0) + reward.reputation.value,
      阶段: reward.reputation.stage || current.阶段,
    };
  }

  if (reward.favor) {
    const favor = ensureRecordAt(statData, ['关系', '好感']);
    const current = isRecord(favor[reward.favor.name]) ? favor[reward.favor.name] : {};
    favor[reward.favor.name] = {
      ...current,
      数值: (Number(current.数值) || 0) + reward.favor.value,
      阶段: reward.favor.stage || current.阶段,
    };
  }

  if (reward.effect) {
    const effect: FortuneEncounterEffect = {
      id: `effect-${reward.id}-${Date.now()}`,
      title: reward.title,
      detail: reward.detail,
      source: reward.effect.source,
      createdAt: nowIso(),
      expiresAt: reward.effect.duration,
    };
    activeEncounters.unshift(effect);
    const encounter = ensureRecordAt(statData, ['系统', '奇遇']);
    const effectRecords = asArray(encounter.常驻效果);
    encounter.常驻效果 = [effectToStatRecord(effect), ...effectRecords].slice(0, 12);
  }

  return {
    player,
    activeEncounters: activeEncounters.slice(0, 12),
  };
};

const persistFortuneRuntime = async (
  runtime: EldredRuntimeSave,
  reward: RewardDefinition,
  log: FortuneLog,
  fortune: EldredFortuneState,
  statData: AnyRecord,
) => {
  const applied = applyRewardToState(runtime, reward, statData);
  const fortuneRecord = ensureRecordAt(statData, ['系统', '翻牌']);
  const currentLogs = asArray(fortuneRecord.日志);
  const hostLog = { ...log, synced: true };
  fortuneRecord.次数 = fortune.flipCount;
  fortuneRecord.日志 = [logToStatRecord(hostLog), ...currentLogs].slice(0, 30);
  fortuneRecord.最近结果 = logToStatRecord(hostLog);
  appendFrontendNotice(statData, reward.kind === 'encounter' ? '奇遇事件' : '翻牌结果', `${reward.title}｜${reward.detail}`);
  const synced = await writeEldredStatDataToHost(statData);
  const syncedLog = { ...log, synced };
  const nextRuntime = persistEldredRuntimeCache({
    ...runtime,
    player: applied.player,
    rawStatData: statData,
    fortune: {
      ...fortune,
      logs: appendLimited(fortune.logs, syncedLog, 30),
      activeEncounters: applied.activeEncounters,
    },
  });
  return {
    runtime: nextRuntime,
    log: syncedLog,
    message: synced ? '翻牌结果已写入变量' : '翻牌结果已写入本地缓存，等待酒馆变量桥同步',
  };
};

export const addEldredFortuneFlips = async (runtime: EldredRuntimeSave, amount = 1) => {
  const statData = cloneRecord(runtime.rawStatData);
  const fortune = {
    ...createEmptyFortuneState(),
    ...runtime.fortune,
    flipCount: Math.max(0, runtime.fortune.flipCount + amount),
  };
  const fortuneRecord = ensureRecordAt(statData, ['系统', '翻牌']);
  fortuneRecord.次数 = fortune.flipCount;
  appendFrontendNotice(statData, '获得一次翻牌次数', `次数+${amount}`);
  const synced = await writeEldredStatDataToHost(statData);
  return persistEldredRuntimeCache({
    ...runtime,
    rawStatData: statData,
    fortune,
  });
};

export const drawEldredFortuneCard = async (
  runtime: EldredRuntimeSave,
  slot = 1,
): Promise<EldredFortuneResult | null> => {
  if (!runtime.player || runtime.fortune.flipCount <= 0) return null;
  const reward = weightedPick(CARD_REWARD_POOL, runtime.player.level);
  const statData = cloneRecord(runtime.rawStatData);
  const fortune = {
    ...createEmptyFortuneState(),
    ...runtime.fortune,
    flipCount: Math.max(0, runtime.fortune.flipCount - 1),
  };
  const log = createLog(reward, slot);
  const result = await persistFortuneRuntime(runtime, reward, log, fortune, statData);
  const event = reward.eventPrompt
    ? {
      eventType: 'fortune_encounter' as const,
      title: `翻牌奇遇：${reward.title}`,
      playerIntent: reward.eventPrompt,
      target: reward.title,
      authoritativeResult: `翻牌抽中奇遇：${reward.title}`,
      extraFacts: [
        `翻牌结果：${reward.title}`,
        `稀有度：${reward.rarity}`,
        `当前地点：${runtime.world.currentLocation || runtime.player.location.name}`,
      ],
    }
    : undefined;
  return {
    ...result,
    reward,
    event,
  };
};

export const triggerEldredDailyEncounter = async (
  runtime: EldredRuntimeSave,
): Promise<EldredFortuneResult | null> => {
  if (!runtime.player) return null;
  const key = todayKey();
  if (runtime.fortune.dailyKey === key) return null;
  const reward = weightedPick(DAILY_ENCOUNTER_POOL, runtime.player.level);
  const statData = cloneRecord(runtime.rawStatData);
  const fortune = {
    ...createEmptyFortuneState(),
    ...runtime.fortune,
    dailyKey: key,
  };
  const encounter = ensureRecordAt(statData, ['系统', '奇遇']);
  encounter.今日标识 = key;
  const log = createLog(reward);
  const result = await persistFortuneRuntime(runtime, reward, log, fortune, statData);
  const event = reward.eventPrompt
    ? {
      eventType: 'fortune_encounter' as const,
      title: `每日奇遇：${reward.title}`,
      playerIntent: reward.eventPrompt,
      target: reward.title,
      authoritativeResult: `每日奇遇触发：${reward.title}`,
      extraFacts: [
        `奇遇结果：${reward.title}`,
        `稀有度：${reward.rarity}`,
        `当前地点：${runtime.world.currentLocation || runtime.player.location.name}`,
      ],
    }
    : undefined;
  return {
    ...result,
    reward,
    event,
  };
};

export const canTriggerDailyEncounter = (fortune: EldredFortuneState) => fortune.dailyKey !== todayKey();

export const rarityLabel = (rarity: FortuneRarity) => {
  if (rarity === 'epic') return '传说';
  if (rarity === 'rare') return '稀有';
  if (rarity === 'uncommon') return '进阶';
  return '普通';
};
