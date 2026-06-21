import {
  AttributeKey,
  Character,
  CombatUnit,
  EquipmentLoadout,
  ImmersiveNotice,
  PlayerState,
} from '../types';
import {
  ATTRIBUTE_KEYS,
  ATTRIBUTE_LABELS,
  calculateDerivedStats,
  equippedIdsFromLoadout,
  gainExperience,
  getClassById,
  getEquipmentById,
  getSkillById,
  playerToCombatUnit,
  proficiencyBonus,
  resolveSkillUse,
  rollDice,
  attributeModifier,
} from './rules';
import {
  EldredRuntimeSave,
  persistEldredRuntimeCache,
} from './eldredSave';
import { EldredFrontendEventInput } from './eldredEvents';
import { EldredD20CheckResult, parseD20CheckIntent, resolveD20Check } from './eldredDice';

export type EldredCombatCommandKind = 'attack' | 'guard' | 'escape' | 'skill';

export type EldredCombatCommand = {
  kind: EldredCombatCommandKind;
  actorId: string;
  targetId?: string;
  skillId?: string;
  targetIsAlly?: boolean;
};
export type EldredActionResult = {
  runtime: EldredRuntimeSave;
  event?: Omit<EldredFrontendEventInput, 'player' | 'party' | 'enemies'>;
  notice: string;
};

export type EldredD20ActionResult = EldredActionResult & {
  check?: EldredD20CheckResult;
};

const nowIso = () => new Date().toISOString();

const createNotice = (notice: Omit<ImmersiveNotice, 'id'>): ImmersiveNotice => ({
  ...notice,
  id: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
});

const withPlayerNotice = (player: PlayerState, notice: ImmersiveNotice): PlayerState => ({
  ...player,
  notices: [notice, ...player.notices].slice(0, 24),
});

const commitRuntime = (runtime: EldredRuntimeSave): EldredRuntimeSave =>
  persistEldredRuntimeCache({
    ...runtime,
    source: 'cache',
    updatedAt: nowIso(),
  });

export const persistRuntimePlayer = (runtime: EldredRuntimeSave, player: PlayerState): EldredRuntimeSave =>
  commitRuntime({ ...runtime, player });

export const persistRuntimeNpcs = (runtime: EldredRuntimeSave, npcs: Character[]): EldredRuntimeSave =>
  commitRuntime({ ...runtime, npcs });

export const dispatchEldredD20Check = (
  runtime: EldredRuntimeSave,
  rawText: string,
): EldredD20ActionResult | null => {
  if (!runtime.player) return null;
  const intent = parseD20CheckIntent(rawText, runtime.player);
  if (!intent) return null;

  const actor = playerToCombatUnit(runtime.player);
  const check = resolveD20Check(actor, intent);
  const player = withPlayerNotice(
    runtime.player,
    createNotice({
      type: 'event',
      title: `行动判定：${check.success ? '成功' : '失败'}`,
      body: check.summary,
      meta: `目标值${check.dc} / ${ATTRIBUTE_LABELS[check.attribute]} / ${check.mode === 'advantage' ? '优势' : check.mode === 'disadvantage' ? '劣势' : '普通'}${check.sourceNotes.length ? ` / ${check.sourceNotes.join('、')}` : ''}`,
    }),
  );
  const nextRuntime = commitRuntime({ ...runtime, player });
  const facts = [
    `判定类型：D20行动判定`,
    `行动者：${check.actorName}`,
    `行动：${check.action}`,
    check.target ? `目标：${check.target}` : '',
    `属性：${ATTRIBUTE_LABELS[check.attribute]}`,
    `骰面：${check.rolls.join('/')}`,
    `采用骰面：${check.chosenRoll}`,
    `属性加值：${check.attributeBonus}`,
    `熟练加值：${check.proficiency}`,
    `额外修正：${check.bonus}`,
    `来源修正：${check.contextualBonus}`,
    check.sourceNotes.length ? `修正来源：${check.sourceNotes.join('、')}` : '',
    `总值：${check.total}`,
    check.requestedDc !== check.dc ? `原始目标值：${check.requestedDc}` : '',
    check.dcAdjustment ? `目标值修正：${check.dcAdjustment >= 0 ? '+' : ''}${check.dcAdjustment}` : '',
    `目标值：${check.dc}`,
    `结果：${check.success ? '成功' : '失败'}`,
    `差值：${check.margin >= 0 ? '+' : ''}${check.margin}`,
  ].filter(Boolean);
  return {
    runtime: nextRuntime,
    check,
    event: {
      eventType: 'action_check',
      title: `行动判定：${check.action}`,
      playerIntent: rawText,
      actor: check.actorId,
      target: check.target,
      authoritativeResult: check.summary,
      extraFacts: facts,
    },
    notice: check.summary,
  };
};

const npcToCombatUnit = (npc: Character): CombatUnit => ({
  id: npc.id,
  name: `${npc.name}（${getClassById(npc.classId).name}）`,
  isEnemy: false,
  level: npc.stats.level || 1,
  hp: npc.stats.hp,
  maxHp: npc.stats.maxHp,
  mp: npc.stats.mp,
  maxMp: npc.stats.maxMp,
  ac: npc.stats.ac,
  stats: {
    str: npc.stats.str,
    dex: npc.stats.dex,
    vit: npc.stats.vit,
    int: npc.stats.int,
    spr: npc.stats.spr,
  },
  skillIds: npc.activeSkillIds,
  equipmentIds: equippedIdsFromLoadout(npc.equipmentLoadout),
  ap: 1,
  maxAp: 1,
  shield: 0,
  statusLogs: [`等级${npc.stats.level || 1}`, npc.profession],
});

const getPartyNpcs = (runtime: EldredRuntimeSave) => {
  const player = runtime.player;
  if (!player) return [];
  return runtime.npcs.filter(npc => player.partyMemberIds.includes(npc.id) || player.partyMemberIds.includes(npc.name));
};

const buildCombatUnits = (runtime: EldredRuntimeSave): CombatUnit[] => {
  if (!runtime.player) return runtime.combat.enemyUnits;
  return [
    playerToCombatUnit(runtime.player),
    ...getPartyNpcs(runtime).map(npcToCombatUnit),
    ...runtime.combat.enemyUnits,
  ];
};

const setUnit = (units: CombatUnit[], unit: CombatUnit) =>
  units.map(item => (item.id === unit.id ? unit : item));

const livingParty = (units: CombatUnit[]) => units.filter(unit => !unit.isEnemy && unit.hp > 0);
const livingEnemies = (units: CombatUnit[]) => units.filter(unit => unit.isEnemy && unit.hp > 0);

const equipmentIdsFromUnit = (unit: CombatUnit) => unit.equipmentIds || [];

const chooseAttackAttribute = (unit: CombatUnit): AttributeKey => {
  const tags = equipmentIdsFromUnit(unit).flatMap(id => getEquipmentById(id)?.tags || []);
  if (tags.some(tag => ['弓', '远程', '短刀'].includes(tag))) return 'dex';
  if (tags.some(tag => ['法杖', '导魔', '圣铃', '召唤'].includes(tag))) return unit.stats.int >= unit.stats.spr ? 'int' : 'spr';
  return 'str';
};

const equipmentHitBonus = (unit: CombatUnit) =>
  equipmentIdsFromUnit(unit).reduce((sum, id) => sum + (getEquipmentById(id)?.hitBonus || 0), 0);

const equipmentDamageBonus = (unit: CombatUnit) =>
  equipmentIdsFromUnit(unit).reduce((sum, id) => sum + (getEquipmentById(id)?.damageBonus || 0), 0);

const dealDamage = (target: CombatUnit, rawDamage: number) => {
  const absorbed = Math.min(target.shield || 0, rawDamage);
  const damage = Math.max(0, rawDamage - absorbed);
  return {
    target: {
      ...target,
      hp: Math.max(0, target.hp - damage),
      shield: Math.max(0, (target.shield || 0) - absorbed),
      statusLogs: target.hp - damage <= 0
        ? [...target.statusLogs.filter(item => item !== '无法战斗'), '无法战斗']
        : target.statusLogs,
    },
    absorbed,
    damage,
  };
};

const resolveBasicAttack = (actor: CombatUnit, target: CombatUnit) => {
  const attr = chooseAttackAttribute(actor);
  const d20 = Math.floor(Math.random() * 20) + 1;
  const attrBonus = attributeModifier(actor.stats[attr]);
  const prof = proficiencyBonus(actor.level);
  const equipmentHit = equipmentHitBonus(actor);
  const total = d20 + attrBonus + prof + equipmentHit;
  const hit = total >= target.ac;
  if (!hit) {
    return {
      actor,
      target,
      text: `${actor.name}普通攻击未命中${target.name}。`,
      detail: `命中检定：d20(${d20})+${ATTRIBUTE_LABELS[attr]}${attrBonus}+熟练${prof}+装备${equipmentHit}=${total}，目标护甲${target.ac}。`,
    };
  }
  const dice = rollDice(actor.level >= 11 ? '1d8' : '1d6');
  const rawDamage = Math.max(1, dice.total + attrBonus + equipmentDamageBonus(actor));
  const result = dealDamage(target, rawDamage);
  return {
    actor,
    target: result.target,
    text: `${actor.name}普通攻击命中${target.name}，造成${result.damage}点伤害。`,
    detail: `命中检定：d20(${d20})+${ATTRIBUTE_LABELS[attr]}${attrBonus}+熟练${prof}+装备${equipmentHit}=${total}；伤害${dice.rolls.join('+')}+属性${attrBonus}+装备${equipmentDamageBonus(actor)}，护盾吸收${result.absorbed}。`,
  };
};

const syncPlayerFromUnit = (player: PlayerState, unit: CombatUnit): PlayerState => ({
  ...player,
  stats: {
    ...player.stats,
    hp: Math.max(0, Math.min(unit.maxHp, unit.hp)),
    mp: Math.max(0, Math.min(unit.maxMp, unit.mp)),
    maxHp: unit.maxHp,
    maxMp: unit.maxMp,
  },
});

const syncNpcFromUnit = (npc: Character, unit: CombatUnit): Character => ({
  ...npc,
  stats: {
    ...npc.stats,
    hp: Math.max(0, Math.min(unit.maxHp, unit.hp)),
    mp: Math.max(0, Math.min(unit.maxMp, unit.mp)),
    maxHp: unit.maxHp,
    maxMp: unit.maxMp,
  },
});

const syncRuntimeFromUnits = (runtime: EldredRuntimeSave, units: CombatUnit[]): EldredRuntimeSave => {
  const playerUnit = units.find(unit => unit.id === 'player');
  const player = runtime.player && playerUnit ? syncPlayerFromUnit(runtime.player, playerUnit) : runtime.player;
  const npcs = runtime.npcs.map(npc => {
    const unit = units.find(item => item.id === npc.id);
    return unit ? syncNpcFromUnit(npc, unit) : npc;
  });
  return {
    ...runtime,
    player,
    npcs,
    combat: {
      ...runtime.combat,
      enemyUnits: units.filter(unit => unit.isEnemy),
    },
  };
};

const gainNpcExperience = (npc: Character, amount: number): Character => {
  let level = npc.stats.level || 1;
  let experience = npc.experience + amount;
  let nextLevelExperience = npc.nextLevelExperience;
  let gainedLevels = 0;
  while (level < 20 && experience >= nextLevelExperience) {
    experience -= nextLevelExperience;
    level += 1;
    gainedLevels += 1;
    nextLevelExperience = Math.max(100, level * 100);
  }
  if (gainedLevels === 0) return { ...npc, experience };
  const baseAttributes = ATTRIBUTE_KEYS.reduce((acc, key) => {
    acc[key] = npc.stats[key];
    return acc;
  }, {} as Record<AttributeKey, number>);
  const derived = calculateDerivedStats(level, npc.classId, baseAttributes, equippedIdsFromLoadout(npc.equipmentLoadout), npc.raceId || 'human');
  return {
    ...npc,
    experience,
    nextLevelExperience,
    availableAttributePoints: npc.availableAttributePoints + gainedLevels * 2,
    stats: {
      ...derived,
      hp: derived.maxHp,
      mp: derived.maxMp,
    },
  };
};

const applyVictoryRewards = (runtime: EldredRuntimeSave, defeatedEnemies: CombatUnit[], logs: string[]) => {
  if (!runtime.player || defeatedEnemies.length === 0) return runtime;
  const experience = Math.max(20, defeatedEnemies.reduce((sum, enemy) => sum + enemy.level * 20, 0));
  const playerBefore = runtime.player;
  const playerAfter = gainExperience(playerBefore, experience);
  const gainedLevel = playerAfter.level > playerBefore.level;
  const partyIds = new Set(playerAfter.partyMemberIds);
  const npcs = runtime.npcs.map(npc => (partyIds.has(npc.id) || partyIds.has(npc.name) ? gainNpcExperience(npc, experience) : npc));
  logs.push(`战斗胜利：全队获得${experience}经验。`);
  return {
    ...runtime,
    player: withPlayerNotice(
      playerAfter,
      createNotice({
        type: gainedLevel ? 'level' : 'event',
        title: gainedLevel ? `角色升级：${playerAfter.name}` : '战斗结算',
        body: gainedLevel
          ? `${playerAfter.name}提升至等级${playerAfter.level}，可分配点数${playerAfter.availableAttributePoints}。`
          : `获得${experience}经验。`,
        meta: defeatedEnemies.map(enemy => enemy.name).join('、'),
      }),
    ),
    npcs,
    combat: {
      ...runtime.combat,
      enemyUnits: [],
    },
  };
};

const appendCombatLogs = (runtime: EldredRuntimeSave, logs: string[]) => ({
  ...runtime,
  combat: {
    ...runtime.combat,
    turn: runtime.combat.turn + 1,
    logs: [...logs, ...runtime.combat.logs].slice(0, 80),
  },
});

const makeCombatEvent = (
  runtime: EldredRuntimeSave,
  command: EldredCombatCommand,
  logs: string[],
): Omit<EldredFrontendEventInput, 'player' | 'party' | 'enemies'> => {
  const actor = command.actorId === 'player'
    ? runtime.player?.name || '玩家'
    : runtime.npcs.find(npc => npc.id === command.actorId)?.name || command.actorId;
  const skill = command.skillId ? getSkillById(command.skillId) : undefined;
  return {
    eventType: 'combat_command',
    title: `战斗回合${runtime.combat.turn}`,
    playerIntent: logs.join('\n'),
    actor: command.actorId,
    target: command.targetId,
    skillId: command.skillId,
    extraFacts: [
      `行动者：${actor}`,
      `行动类型：${command.kind === 'skill' ? `技能 ${skill?.name || command.skillId}` : command.kind}`,
      ...logs,
    ],
  };
};

export const dispatchEldredCombatCommand = (
  runtime: EldredRuntimeSave,
  command: EldredCombatCommand,
): EldredActionResult => {
  if (!runtime.player) {
    return { runtime, notice: '尚未创建角色。' };
  }

  const units = buildCombatUnits(runtime);
  const actor = units.find(unit => unit.id === command.actorId);
  const target = command.targetId ? units.find(unit => unit.id === command.targetId) : undefined;
  const logs: string[] = [];

  if (!actor || actor.hp <= 0) {
    return { runtime, notice: '行动者不存在或无法行动。' };
  }

  if (command.kind !== 'guard' && command.kind !== 'escape' && !target) {
    return { runtime, notice: '缺少有效目标。' };
  }

  if (command.kind === 'skill') {
    const skill = command.skillId ? getSkillById(command.skillId) : undefined;
    if (!skill) {
      return { runtime, notice: '技能不存在。' };
    }
    if (!actor.skillIds.includes(skill.id)) {
      return { runtime, notice: '行动者未装配该技能。' };
    }
    if (actor.mp < skill.mpCost) {
      return { runtime, notice: `${actor.name}法力不足。` };
    }
    logs.push(`${actor.name}准备使用${skill.name}。`, `行动意图：技能；目标：${target?.name || '待正文裁决'}；消耗与效果由正文裁决。`);
  }

  if (command.kind === 'attack') {
    logs.push(`${actor.name}准备普通攻击。`, `行动意图：普通攻击；目标：${target?.name || '待正文裁决'}；命中、伤害与反击由正文裁决。`);
  }

  if (command.kind === 'guard') {
    logs.push(`${actor.name}准备防御或护送。`, '行动意图：防御；护甲、减伤、保护目标和持续时间由正文裁决。');
  }

  if (command.kind === 'escape') {
    logs.push(`${actor.name}准备撤离。`, '行动意图：撤离；撤离检定、追击和代价由正文裁决。');
  }

  let nextRuntime = runtime;
  nextRuntime = appendCombatLogs(nextRuntime, logs);
  nextRuntime = commitRuntime(nextRuntime);
  return {
    runtime: nextRuntime,
    event: makeCombatEvent(nextRuntime, command, logs),
    notice: logs[0] || '战斗行动已提交正文裁决。',
  };
};
