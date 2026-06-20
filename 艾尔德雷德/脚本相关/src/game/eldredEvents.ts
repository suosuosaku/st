import { Character, CombatUnit, PlayerState, Quest } from '../types';
import { getEquipmentById, getSkillById } from './rules';
import { submitPayloadToSillyTavernInput } from './sillyTavernBridge';

export type EldredFrontendEventType =
  | 'opening_setup'
  | 'quest_accept'
  | 'map_focus'
  | 'party_update'
  | 'equipment_change'
  | 'skill_change'
  | 'attribute_allocate'
  | 'combat_command'
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
  extraFacts?: string[];
};

const quote = (value: unknown) => String(value ?? '').replaceAll('"', "'");

const yamlList = (values: string[] = []) => `[${values.map(value => `"${quote(value)}"`).join(', ')}]`;

const playerFacts = (player?: PlayerState | null) => {
  if (!player) return ['    player_ready: false'];
  return [
    '    player_ready: true',
    `    player_name: "${quote(player.name)}"`,
    `    level: ${player.level}`,
    `    hp: "${player.stats.hp}/${player.stats.maxHp}"`,
    `    mp: "${player.stats.mp}/${player.stats.maxMp}"`,
    `    ac: ${player.stats.ac}`,
    `    location: "${quote(`${player.location.name} / ${player.location.landmarkName}`)}"`,
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
    '  authoritative_state_before_event:',
    ...playerFacts(input.player),
    ...partyFacts(input.party),
    ...enemyFacts(input.enemies),
    '  related_facts:',
    ...facts.map(fact => `    - "${quote(fact)}"`),
    '```',
    '',
    '裁决请求：按当前正文、变量与世界书裁决此事件；前端事件只代表玩家操作意图，不代表结果已经发生。若事件成立，正文输出对应美化标签并在 <UpdateVariable> 写回变量。',
  ].join('\n');
};

export const submitEldredFrontendEvent = async (input: EldredFrontendEventInput) => {
  const payload = buildEldredFrontendEventPayload(input);
  return submitPayloadToSillyTavernInput(payload, '已复制事件载荷');
};
