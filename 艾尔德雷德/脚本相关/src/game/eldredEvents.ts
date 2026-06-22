import { Character, CombatUnit, PlayerState, Quest } from '../types';
import { formatEldredLocation } from './locationFormat';
import { getEquipmentById, getSkillById } from './rules';

export type EldredFrontendEventType =
  | 'opening_setup'
  | 'quest_accept'
  | 'quest_abandon'
  | 'item_use'
  | 'map_focus'
  | 'party_update'
  | 'equipment_change'
  | 'skill_change'
  | 'attribute_allocate'
  | 'action_check'
  | 'combat_command'
  | 'fortune_encounter'
  | 'free_intent';

export type EldredFrontendEventInput = {
  eventType: EldredFrontendEventType;
  title: string;
  playerIntent: string;
  actor?: string;
  target?: string;
  skillId?: string;
  equipmentId?: string;
  quest?: Quest;
  player?: PlayerState | null;
  party?: Character[];
  enemies?: CombatUnit[];
  authoritativeResult?: string;
  extraFacts?: string[];
};

const quote = (value: unknown) => String(value ?? '').replaceAll('"', "'");

const yamlList = (values: string[] = []) => `[${values.map(value => `"${quote(value)}"`).join(', ')}]`;

const playerFacts = (player?: PlayerState | null) => {
  if (!player) return ['    player_ready: false'];
  const location = formatEldredLocation(undefined, player.location);
  return [
    '    player_ready: true',
    `    player_name: "${quote(player.name)}"`,
    `    level: ${player.level}`,
    `    hp: "${player.stats.hp}/${player.stats.maxHp}"`,
    `    mp: "${player.stats.mp}/${player.stats.maxMp}"`,
    `    ac: ${player.stats.ac}`,
    `    location: "${quote(location.fullName)}"`,
    `    active_skills: ${yamlList(player.activeSkillIds.map(id => getSkillById(id)?.name || id))}`,
    `    equipment: ${yamlList(Object.values(player.equipmentLoadout).filter(Boolean).map(id => getEquipmentById(id)?.name || id))}`,
  ];
};

const partyFacts = (party: Character[] = []) => {
  if (party.length === 0) return ['    party_members: []'];
  return [
    '    party_members:',
    ...party.map(member => `      - "${quote(member.name)} / Lv.${member.stats.level || 1} / ${member.profession}"`),
  ];
};

const enemyFacts = (enemies: CombatUnit[] = []) => {
  if (enemies.length === 0) return ['    enemies: []'];
  return [
    '    enemies:',
    ...enemies.map(enemy => `      - "${quote(enemy.name)} / Lv.${enemy.level} / HP ${enemy.hp}/${enemy.maxHp} / AC ${enemy.ac}"`),
  ];
};

export const buildEldredFrontendEventPayload = (input: EldredFrontendEventInput) => {
  const skill = input.skillId ? getSkillById(input.skillId) : undefined;
  const equipment = input.equipmentId ? getEquipmentById(input.equipmentId) : undefined;
  const facts = input.extraFacts?.length ? input.extraFacts : ['无'];
  const isCombatCommand = input.eventType === 'combat_command';
  const stateHeader = isCombatCommand ? '  current_state_snapshot:' : '  authoritative_state_after_event:';
  const syncRequest = isCombatCommand
    ? '同步请求：以上为脚本控制台提交的战斗行动意图与当前战斗快照。正文必须按当前变量、世界书、二十面骰、技能、装备、站位和敌方反应裁决命中、伤害、消耗、状态、经验与胜负，并在 <UpdateVariable> 写回系统.战斗缓存。'
    : '同步请求：以上为脚本控制台已经结算的前端权威事实。正文只演绎结果、补足场景反应，并在 <UpdateVariable> 写回同一结果；不得反转命中、伤害、消耗、装备槽位、经验、升级或队伍状态。';

  return [
    '【艾尔德雷德前端事件】',
    '```yaml',
    'eldred_frontend_event:',
    '  protocol: "eldred_frontend_event_v1"',
    `  event_type: "${input.eventType}"`,
    `  title: "${quote(input.title)}"`,
    `  player_intent: "${quote(input.playerIntent)}"`,
    '  authority:',
    `    actor: "${quote(input.actor)}"`,
    `    target: "${quote(input.target)}"`,
    `    skill_id: "${quote(input.skillId)}"`,
    `    skill_name: "${quote(skill?.name)}"`,
    `    equipment_id: "${quote(input.equipmentId)}"`,
    `    equipment_name: "${quote(equipment?.name)}"`,
    `    quest_id: "${quote(input.quest?.id)}"`,
    `    quest_title: "${quote(input.quest?.title)}"`,
    `    result: "${quote(isCombatCommand ? input.playerIntent : input.authoritativeResult || input.playerIntent)}"`,
    stateHeader,
    ...playerFacts(input.player),
    ...partyFacts(input.party),
    ...enemyFacts(input.enemies),
    '  related_facts:',
    ...facts.map(fact => `    - "${quote(fact)}"`),
    '```',
    '',
    syncRequest,
  ].join('\n');
};
