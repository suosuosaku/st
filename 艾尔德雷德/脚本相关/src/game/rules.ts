import {
  AttributeKey,
  CharacterClass,
  CharacterClassId,
  CharacterRace,
  CharacterRaceId,
  CharacterStats,
  ClassTalent,
  CombatUnit,
  Equipment,
  EquipmentLoadout,
  OriginLocation,
  PlayerState,
  Skill,
  SkillRank,
} from '../types';
import { fixedNpcSkillRegistry } from './eldredNpcRegistry';

export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  str: '力量',
  dex: '敏捷',
  vit: '体质',
  int: '智力',
  spr: '精神',
};

export const ATTRIBUTE_KEYS: AttributeKey[] = ['str', 'dex', 'vit', 'int', 'spr'];
export const OPENING_ATTRIBUTE_POINTS = 15;
export const ACTIVE_SKILL_LIMIT = 4;

export const EXPERIENCE_TOTAL_BY_LEVEL: Record<number, number> = {
  1: 0,
  2: 120,
  3: 300,
  4: 560,
  5: 920,
  6: 1400,
  7: 2020,
  8: 2800,
  9: 3760,
  10: 4920,
  11: 6320,
  12: 8000,
  13: 10000,
  14: 12360,
  15: 15120,
  16: 18320,
  17: 22020,
  18: 26280,
  19: 31160,
  20: 36720,
};

export const EXPERIENCE_TO_NEXT_BY_LEVEL: Record<number, number> = {
  1: 120,
  2: 180,
  3: 260,
  4: 360,
  5: 480,
  6: 620,
  7: 780,
  8: 960,
  9: 1160,
  10: 1400,
  11: 1680,
  12: 2000,
  13: 2360,
  14: 2760,
  15: 3200,
  16: 3700,
  17: 4260,
  18: 4880,
  19: 5560,
  20: 0,
};

export const SKILL_RANK_RULES: Record<SkillRank, { label: string; levelMin: number; levelMax: number; damage: string; 法力: string; 目标值: string }> = {
  S1: { label: '基础战斗技巧', levelMin: 1, levelMax: 3, damage: '1d4~1d8', 法力: '0~3', 目标值: '11~13' },
  S2: { label: '稳定冒险技巧', levelMin: 4, levelMax: 6, damage: '1d6~1d10', 法力: '3~5', 目标值: '13~15' },
  S3: { label: '地标专家技巧', levelMin: 7, levelMax: 10, damage: '1d8~2d6', 法力: '5~7', 目标值: '15~18' },
  S4: { label: '高阶技巧', levelMin: 11, levelMax: 15, damage: '2d6~3d6', 法力: '7~10', 目标值: '18~21' },
  S5: { label: '神话/神器/终局技巧', levelMin: 16, levelMax: 20, damage: '3d6以上', 法力: '10以上', 目标值: '21~25' },
};

export const characterRaces: CharacterRace[] = [
  {
    id: 'human',
    name: '人类',
    summary: '文书、行会、军役与商路覆盖最广，属性稳定。',
    attributeBonus: { vit: 1 },
    auraName: '通行熟面',
    auraEffect: '登记、行会流程、普通城镇交涉检定+1。',
  },
  {
    id: 'elf',
    name: '精灵',
    summary: '月鹿森林与古歌传统出身，敏捷和精神表现更高。',
    attributeBonus: { dex: 1, spr: 1, str: -1 },
    auraName: '月根感知',
    auraEffect: '药草、兽群、自然地脉观察检定+1。',
  },
  {
    id: 'half-elf',
    name: '半精灵',
    summary: '边界调停者，适应人类文书与精灵礼仪。',
    attributeBonus: { dex: 1, int: 1, vit: -1 },
    auraName: '双界口音',
    auraEffect: '翻译、礼仪、跨族交涉检定+1。',
  },
  {
    id: 'dwarf',
    name: '矮人',
    summary: '灰炉、矿轨和锻造系统中常见，体质与力量稳定。',
    attributeBonus: { str: 1, vit: 1, dex: -1 },
    auraName: '炉印手感',
    auraEffect: '锻造、矿石、装备耐久检查检定+1。',
  },
  {
    id: 'halfling',
    name: '半身人',
    summary: '市集、铃扣商队与小路交通中灵活可靠。',
    attributeBonus: { dex: 1, spr: 1, str: -1 },
    auraName: '小路熟客',
    auraEffect: '潜入、躲藏、市集询价检定+1。',
  },
  {
    id: 'gnome',
    name: '侏儒',
    summary: '铜壳机关街与学院工坊常见，智力和敏捷突出。',
    attributeBonus: { int: 1, dex: 1, vit: -1 },
    auraName: '机关直觉',
    auraEffect: '机关、锁机、魔导器校准检定+1。',
  },
  {
    id: 'mirrorborn',
    name: '镜裔',
    summary: '镜塔与记录灵相关族群，精神与智力敏锐。',
    attributeBonus: { int: 1, spr: 1, str: -1 },
    auraName: '镜面回声',
    auraEffect: '记录灵、旧影像、幻象辨识检定+1。',
  },
  {
    id: 'tideborn',
    name: '潮裔',
    summary: '白帆群岛、潮裂珊瑚埠和灯塔水路常见。',
    attributeBonus: { vit: 1, dex: 1, int: -1 },
    auraName: '潮汐呼吸',
    auraEffect: '游泳、潮汐、水路和海雾行动检定+1。',
  },
];

export const classTalents: ClassTalent[] = [
  { id: 'talent-paladin-register', name: '誓约登记', rank: 'S0', classId: 'paladin', effect: '守护、护送、城门秩序检定+1。' },
  { id: 'talent-paladin-frontline', name: '盾线本能', rank: 'S0', classId: 'paladin', effect: '战斗开始时保护目标判定优先级提高。' },
  { id: 'talent-sage-record', name: '旧页索引', rank: 'S0', classId: 'sage', effect: '文书、碑文、档案复核检定+1。' },
  { id: 'talent-sage-formula', name: '公式速记', rank: 'S0', classId: 'sage', effect: '魔法公式、观测读数、学院器具检定+1。' },
  { id: 'talent-ranger-route', name: '旧路眼', rank: 'S0', classId: 'ranger', effect: '路线、脚印、天气变路检定+1。' },
  { id: 'talent-ranger-camp', name: '野营手', rank: 'S0', classId: 'ranger', effect: '扎营、补给、低压包扎检定+1。' },
  { id: 'talent-master-stance', name: '站位压迫', rank: 'S0', classId: 'battle-master', effect: '近身冲突、推拉、保护队友检定+1。' },
  { id: 'talent-master-drill', name: '训练口令', rank: 'S0', classId: 'battle-master', effect: '队伍整列和非致命冲突优先级提高。' },
  { id: 'talent-alchemist-batch', name: '批次嗅辨', rank: 'S0', classId: 'alchemist', effect: '药剂、毒素、瘴气残留辨识检定+1。' },
  { id: 'talent-alchemist-field', name: '瓶塞习惯', rank: 'S0', classId: 'alchemist', effect: '临时处理药剂事故或材料泄漏检定+1。' },
  { id: 'talent-artificer-tool', name: '工具列序', rank: 'S0', classId: 'artificer', effect: '修理、拆解、校准装备检定+1。' },
  { id: 'talent-artificer-structure', name: '结构读法', rank: 'S0', classId: 'artificer', effect: '机关、矿轨、灯塔构件检定+1。' },
  { id: 'talent-priest-case', name: '病历问序', rank: 'S0', classId: 'priest', effect: '问诊、安抚、救济登记检定+1。' },
  { id: 'talent-priest-ritual', name: '净化手势', rank: 'S0', classId: 'priest', effect: '轻微污染、恐慌、精神豁免支援检定+1。' },
  { id: 'talent-summoner-contract', name: '契约察看', rank: 'S0', classId: 'summoner', effect: '召唤圈、契约痕迹、使魔状态检定+1。' },
  { id: 'talent-summoner-tether', name: '牵绳反应', rank: 'S0', classId: 'summoner', effect: '控制低阶召唤物和搬运杂务优先级提高。' },
];

export const characterClasses: CharacterClass[] = [
  {
    id: 'paladin',
    name: '圣骑士',
    summary: '守护、誓言、护送和公共秩序。',
    classAuraName: '守护职责',
    classAuraEffect: '保护目标存在时，首次守护或护送判定+1。',
    hpBase: 12,
    hpPerLevel: 7,
    mpBase: 4,
    mpPerLevel: 2,
    primaryAttributes: ['str', 'vit', 'spr'],
    presetStats: { str: 5, dex: 2, vit: 4, int: 1, spr: 3 },
    companionTalentIds: ['talent-paladin-register', 'talent-paladin-frontline'],
    startingCombatSkillIds: ['paladin-oath-cut', 'paladin-guard-step', 'paladin-bell-aid', 'paladin-shield-line'],
    startingEquipmentIds: ['worn-long-sword', 'patched-round-shield', 'travel-mail'],
  },
  {
    id: 'sage',
    name: '贤者',
    summary: '记录、辨识、旧文翻读和魔法公式。',
    classAuraName: '复核笔记',
    classAuraEffect: '文书或魔法读数失败后，可保留一条可复核线索。',
    hpBase: 8,
    hpPerLevel: 4,
    mpBase: 10,
    mpPerLevel: 5,
    primaryAttributes: ['int', 'spr', 'dex'],
    presetStats: { str: 1, dex: 3, vit: 2, int: 5, spr: 4 },
    companionTalentIds: ['talent-sage-record', 'talent-sage-formula'],
    startingCombatSkillIds: ['sage-spark-formula', 'sage-page-reading', 'sage-soft-mend', 'sage-short-ward'],
    startingEquipmentIds: ['chalk-oak-staff', 'student-robe', 'note-string'],
  },
  {
    id: 'ranger',
    name: '游侠',
    summary: '路线、追踪、野营、陷阱和远程轻武器。',
    classAuraName: '路线预判',
    classAuraEffect: '进入新路段时，首次发现陷阱或绕路入口检定+1。',
    hpBase: 10,
    hpPerLevel: 6,
    mpBase: 3,
    mpPerLevel: 2,
    primaryAttributes: ['dex', 'vit', 'spr'],
    presetStats: { str: 2, dex: 5, vit: 3, int: 2, spr: 3 },
    companionTalentIds: ['talent-ranger-route', 'talent-ranger-camp'],
    startingCombatSkillIds: ['ranger-old-road', 'ranger-quick-shot', 'ranger-trap-thread', 'ranger-camp-bind'],
    startingEquipmentIds: ['short-bow', 'waterproof-boots', 'route-knife'],
  },
  {
    id: 'battle-master',
    name: '战斗大师',
    summary: '近身冲突、训练、前排保护和非致命压制。',
    classAuraName: '前排压力',
    classAuraEffect: '近身敌人第一次试图越过你时，其行动目标值+1。',
    hpBase: 14,
    hpPerLevel: 8,
    mpBase: 0,
    mpPerLevel: 0,
    primaryAttributes: ['str', 'vit', 'dex'],
    presetStats: { str: 5, dex: 3, vit: 5, int: 1, spr: 1 },
    companionTalentIds: ['talent-master-stance', 'talent-master-drill'],
    startingCombatSkillIds: ['master-steady-blow', 'master-body-guard', 'master-taunt-stance', 'master-table-cover'],
    startingEquipmentIds: ['iron-knuckle', 'training-vest', 'plain-belt'],
  },
  {
    id: 'alchemist',
    name: '炼金术士',
    summary: '药剂、烟雾、爆响瓶、材料和瘴气处理。',
    classAuraName: '临场配比',
    classAuraEffect: '药剂、毒素或瘴气现场第一次辨识检定+1。',
    hpBase: 9,
    hpPerLevel: 5,
    mpBase: 7,
    mpPerLevel: 4,
    primaryAttributes: ['int', 'vit', 'dex'],
    presetStats: { str: 1, dex: 3, vit: 4, int: 5, spr: 2 },
    companionTalentIds: ['talent-alchemist-batch', 'talent-alchemist-field'],
    startingCombatSkillIds: ['alchemist-pop-vial', 'alchemist-stable-dose', 'alchemist-smoke-powder', 'alchemist-smell-test'],
    startingEquipmentIds: ['corked-vial-kit', 'leather-apron', 'herb-satchel'],
  },
  {
    id: 'artificer',
    name: '魔导工匠',
    summary: '装备、机关、矿轨、灯塔和小型魔导器维护。',
    classAuraName: '校准习惯',
    classAuraEffect: '装备或机关耐久检查时，可提前发现一次失效风险。',
    hpBase: 10,
    hpPerLevel: 5,
    mpBase: 6,
    mpPerLevel: 3,
    primaryAttributes: ['int', 'str', 'vit'],
    presetStats: { str: 4, dex: 2, vit: 3, int: 5, spr: 1 },
    companionTalentIds: ['talent-artificer-tool', 'talent-artificer-structure'],
    startingCombatSkillIds: ['artificer-quick-rune', 'artificer-wrench-hit', 'artificer-lamp-calibrate', 'artificer-lock-machine'],
    startingEquipmentIds: ['copper-wrench', 'tool-vest', 'calibration-lamp'],
  },
  {
    id: 'priest',
    name: '祭司',
    summary: '祝祷、安抚、病房登记、净化和治疗。',
    classAuraName: '晨曦安抚',
    classAuraEffect: '恐慌、轻微污染或病房社交判定+1。',
    hpBase: 9,
    hpPerLevel: 5,
    mpBase: 10,
    mpPerLevel: 5,
    primaryAttributes: ['spr', 'int', 'vit'],
    presetStats: { str: 1, dex: 2, vit: 3, int: 4, spr: 5 },
    companionTalentIds: ['talent-priest-case', 'talent-priest-ritual'],
    startingCombatSkillIds: ['priest-calm-prayer', 'priest-clean-light', 'priest-case-note', 'priest-bell-charm'],
    startingEquipmentIds: ['plain-holy-bell', 'field-robe', 'casebook'],
  },
  {
    id: 'summoner',
    name: '召唤师',
    summary: '短时召唤、契约检查、使魔控制、标记和牵制。',
    classAuraName: '契约边线',
    classAuraEffect: '使魔、召唤圈或契约事故首次稳定检定+1。',
    hpBase: 8,
    hpPerLevel: 4,
    mpBase: 12,
    mpPerLevel: 5,
    primaryAttributes: ['spr', 'int', 'dex'],
    presetStats: { str: 1, dex: 3, vit: 2, int: 4, spr: 5 },
    companionTalentIds: ['talent-summoner-contract', 'talent-summoner-tether'],
    startingCombatSkillIds: ['summoner-small-familiar', 'summoner-circle-fix', 'summoner-contract-mark', 'summoner-slime-tether'],
    startingEquipmentIds: ['chalk-contract-ring', 'student-robe', 'summon-string'],
  },
];

export const originLocations: OriginLocation[] = [
  { id: 'broken-sword', name: '折断的剑酒馆', regionId: 'seven-banners', landmarkName: '折断的剑酒馆', summary: '行会短工、旧账本和城邦传闻密集。', weather: '清晨有风，酒馆招牌绳结作响。', trouble: '旧账本夹层露出同日短账纸。', firstNpc: '妮娅 / 玛洛' },
  { id: 'white-crown-gate', name: '白冠王都西门', regionId: 'white-crown', landmarkName: '白冠西门', summary: '入城名册、骑士报告和档案权限压在第一幕。', weather: '细雨压着白石路，入城队伍排到雨棚外。', trouble: '灾民日期栏被错抄，泥脚印板需要复核。', firstNpc: '贝尔娜' },
  { id: 'gray-mist-camp', name: '灰雾边境营地', regionId: 'gray-mist', landmarkName: '边境病棚', summary: '瘴气、药草、撤回线和补给压力从第一幕开始。', weather: '雾灯偏紫，洗靴棚外的水盆发苦。', trouble: '稳定剂被错送到洗靴棚。', firstNpc: '萨菈' },
  { id: 'star-sand-tower', name: '星砂学院观星塔', regionId: 'star-sand', landmarkName: '观星塔', summary: '观测、图书馆和召唤试验把异动写成证据。', weather: '夜班刚散，校准平台还留着冷星砂。', trouble: '断线光谱与灯塔暗光日期对不上。', firstNpc: '露西' },
  { id: 'white-sail-board', name: '白帆港海事布告板', regionId: 'white-sail', landmarkName: '海事布告板', summary: '船票、灯塔、沉船和星灯旧光同时可见。', weather: '潮声压过市场叫卖，湿纸乱飞。', trouble: '船票重号，港务档和灯塔日志指向同一艘夜航船。', firstNpc: '诺拉线索 / 港口登记员' },
  { id: 'random-origin', name: '随机出生点', regionId: 'seven-banners', landmarkName: '未定地标', summary: '从已开放出生点中随机落定。', weather: '天气随落点确定。', trouble: '第一幕麻烦随落点确定。', firstNpc: '待定' },
];

const s = (skill: Skill) => skill;
export const skills: Skill[] = [
  s({ id: 'paladin-oath-cut', name: '誓言斩', rank: 'S1', sourceClasses: ['paladin'], source: '圣骑士基础训练', actionType: 'attack', attribute: 'str', hitType: 'vsAC', target: '单体敌人', range: '近身', mpCost: 2, cooldown: 0, damageDice: '1d8', effects: ['命中后自身获得守护1轮'], desc: '命中：1d8+力量加值伤害；命中后自身获得守护1轮。' }),
  s({ id: 'paladin-guard-step', name: '护送步伐', rank: 'S1', sourceClasses: ['paladin'], source: '城门护送课', actionType: 'support', attribute: 'vit', hitType: 'auto', target: '友方或保护物', range: '近身', mpCost: 1, cooldown: 1, effects: ['目标护甲+1至下回合', '可替目标承受一次近身攻击'], desc: '消耗1法力；目标护甲+1至下回合；可替目标承受一次近身攻击。' }),
  s({ id: 'paladin-bell-aid', name: '圣铃急救', rank: 'S1', sourceClasses: ['paladin'], source: '晨曦救护课', actionType: 'heal', attribute: 'spr', hitType: 'auto', target: '单体友方', range: '近身', mpCost: 3, cooldown: 1, healingDice: '1d6', effects: ['移除轻微流血或惊慌'], desc: '恢复1d6+精神加值生命；移除轻微流血或惊慌。' }),
  s({ id: 'paladin-shield-line', name: '盾线压前', rank: 'S1', sourceClasses: ['paladin'], source: '骑士团队列', actionType: 'control', attribute: 'str', hitType: 'vsDC', target: '近身敌人', range: '近身', mpCost: 2, cooldown: 1, dc: 11, effects: ['失败则目标速度-1至下回合'], desc: '力量对抗目标值11；失败则目标速度-1至下回合。' }),

  s({ id: 'sage-spark-formula', name: '星砂短焰', rank: 'S1', sourceClasses: ['sage'], source: '学院公式', actionType: 'attack', attribute: 'int', hitType: 'vsAC', target: '单体敌人', range: '中距', mpCost: 3, cooldown: 0, damageDice: '1d6', effects: ['发光目标额外+1伤害'], desc: '命中：1d6+智力加值伤害；发光目标额外+1伤害。' }),
  s({ id: 'sage-page-reading', name: '旧页辨识', rank: 'S1', sourceClasses: ['sage'], source: '贤者抄本训练', actionType: 'utility', attribute: 'int', hitType: 'auto', target: '文书/碑文/账页', range: '近身', mpCost: 1, cooldown: 0, effects: ['调查文书目标值-1'], desc: '消耗1法力；本次文书、碑文或账页调查目标值-1。' }),
  s({ id: 'sage-soft-mend', name: '缓和术', rank: 'S1', sourceClasses: ['sage'], source: '旅行贤者急救', actionType: 'heal', attribute: 'spr', hitType: 'auto', target: '单体友方', range: '近身', mpCost: 3, cooldown: 1, healingDice: '1d6', effects: ['移除轻微疲劳'], desc: '恢复1d6+精神加值生命；移除轻微疲劳。' }),
  s({ id: 'sage-short-ward', name: '短咒护幕', rank: 'S1', sourceClasses: ['sage'], source: '学院护身术', actionType: 'support', attribute: 'int', hitType: 'auto', target: '自己或友方', range: '中距', mpCost: 2, cooldown: 1, effects: ['目标护甲+1至下回合'], desc: '消耗2法力；目标护甲+1至下回合。' }),

  s({ id: 'ranger-old-road', name: '旧路侦察', rank: 'S1', sourceClasses: ['ranger'], source: '岚之领旧路', actionType: 'utility', attribute: 'dex', hitType: 'auto', target: '当前路线', range: '视野', mpCost: 0, cooldown: 0, effects: ['旅行或潜入目标值-1'], desc: '本次旅行、潜入或陷阱入口发现目标值-1。' }),
  s({ id: 'ranger-quick-shot', name: '快步射击', rank: 'S1', sourceClasses: ['ranger'], source: '行会靶场', actionType: 'attack', attribute: 'dex', hitType: 'vsAC', target: '单体敌人', range: '远距', mpCost: 1, cooldown: 0, damageDice: '1d6', effects: ['本回合移动过则命中+1'], desc: '命中：1d6+敏捷加值伤害；本回合移动过则命中+1。' }),
  s({ id: 'ranger-trap-thread', name: '陷阱拆线', rank: 'S1', sourceClasses: ['ranger'], source: '遗迹探查训练', actionType: 'utility', attribute: 'dex', hitType: 'vsDC', target: '机关/绊线', range: '近身', mpCost: 0, cooldown: 0, dc: 11, effects: ['成功解除低阶机关'], desc: '敏捷对抗目标值11；成功解除低阶机关；失败触发小代价。' }),
  s({ id: 'ranger-camp-bind', name: '野营包扎', rank: 'S1', sourceClasses: ['ranger'], source: '边路野营', actionType: 'heal', attribute: 'vit', hitType: 'auto', target: '单体友方', range: '近身', mpCost: 0, cooldown: 1, healingDice: '1d4', effects: ['需要绷带或干净布条'], desc: '恢复1d4+体质加值生命；需要绷带或干净布条。' }),

  s({ id: 'master-steady-blow', name: '稳步重击', rank: 'S1', sourceClasses: ['battle-master'], source: '佣兵基础训练', actionType: 'attack', attribute: 'str', hitType: 'vsAC', target: '单体敌人', range: '近身', mpCost: 0, cooldown: 0, damageDice: '1d8', effects: ['目标被嘲讽时伤害+1'], desc: '命中：1d8+力量加值伤害；目标被嘲讽时伤害+1。' }),
  s({ id: 'master-body-guard', name: '护身挡拆', rank: 'S1', sourceClasses: ['battle-master'], source: '前排训练', actionType: 'reaction', attribute: 'vit', hitType: 'auto', target: '邻近友方', range: '近身', mpCost: 0, cooldown: 1, effects: ['友方受击时伤害-2'], desc: '反应；邻近友方受击时伤害-2。' }),
  s({ id: 'master-taunt-stance', name: '挑衅站位', rank: 'S1', sourceClasses: ['battle-master'], source: '斗技场训练', actionType: 'control', attribute: 'str', hitType: 'vsDC', target: '单体敌人', range: '近身', mpCost: 0, cooldown: 1, dc: 11, effects: ['失败则目标下次优先攻击你'], desc: '力量对抗目标值11；失败则目标下次优先攻击你。' }),
  s({ id: 'master-table-cover', name: '掀桌掩护', rank: 'S1', sourceClasses: ['battle-master'], source: '酒馆实战经验', actionType: 'support', attribute: 'str', hitType: 'auto', target: '一处地形', range: '近身', mpCost: 0, cooldown: 2, effects: ['制造掩体1轮', '远程命中-1'], desc: '制造掩体1轮；穿过该掩体的远程攻击命中-1。' }),

  s({ id: 'alchemist-pop-vial', name: '爆响瓶', rank: 'S1', sourceClasses: ['alchemist'], source: '炼金基础课', actionType: 'attack', attribute: 'int', hitType: 'vsAC', target: '单体或小范围', range: '中距', mpCost: 2, cooldown: 1, damageDice: '1d6', effects: ['目标下次先攻-1'], desc: '命中：1d6+智力加值伤害；目标下次先攻-1。' }),
  s({ id: 'alchemist-stable-dose', name: '稳定药剂', rank: 'S1', sourceClasses: ['alchemist'], source: '药草批次记录', actionType: 'heal', attribute: 'int', hitType: 'auto', target: '单体友方', range: '近身', mpCost: 2, cooldown: 1, healingDice: '1d6', effects: ['压制轻微中毒或瘴气不适'], desc: '恢复1d6+智力加值生命；压制轻微中毒或瘴气不适。' }),
  s({ id: 'alchemist-smoke-powder', name: '烟雾粉', rank: 'S1', sourceClasses: ['alchemist'], source: '事故现场处理', actionType: 'control', attribute: 'dex', hitType: 'auto', target: '小范围', range: '中距', mpCost: 2, cooldown: 2, effects: ['制造遮蔽1轮', '远程命中-1'], desc: '制造遮蔽1轮；远程命中-1。' }),
  s({ id: 'alchemist-smell-test', name: '气味辨析', rank: 'S1', sourceClasses: ['alchemist'], source: '药剂工坊', actionType: 'utility', attribute: 'int', hitType: 'auto', target: '药剂/水源/残留物', range: '近身', mpCost: 0, cooldown: 0, effects: ['辨识低阶毒素、瘴气或药草批次'], desc: '辨识低阶毒素、瘴气或药草批次；相关目标值-1。' }),

  s({ id: 'artificer-quick-rune', name: '临修铭文', rank: 'S1', sourceClasses: ['artificer'], source: '灰炉工坊', actionType: 'support', attribute: 'int', hitType: 'auto', target: '装备或机关', range: '近身', mpCost: 2, cooldown: 1, effects: ['装备命中或护甲+1至下回合', '耐久-1'], desc: '消耗2法力；装备命中或护甲+1至下回合；目标装备耐久-1。' }),
  s({ id: 'artificer-wrench-hit', name: '扳手敲击', rank: 'S1', sourceClasses: ['artificer'], source: '矿轨维修', actionType: 'attack', attribute: 'str', hitType: 'vsAC', target: '单体敌人或机关', range: '近身', mpCost: 0, cooldown: 0, damageDice: '1d6', effects: ['对构装体或机关伤害+1'], desc: '命中：1d6+力量加值伤害；对构装体或机关伤害+1。' }),
  s({ id: 'artificer-lamp-calibrate', name: '校准光灯', rank: 'S1', sourceClasses: ['artificer'], source: '灯塔与矿灯校准', actionType: 'utility', attribute: 'int', hitType: 'auto', target: '光源/路线', range: '近身', mpCost: 1, cooldown: 0, effects: ['黑暗、雾气或地脉偏色目标值-1'], desc: '消耗1法力；黑暗、雾气或地脉偏色造成的本次目标值-1。' }),
  s({ id: 'artificer-lock-machine', name: '锁机停摆', rank: 'S1', sourceClasses: ['artificer'], source: '铜壳机关街', actionType: 'control', attribute: 'int', hitType: 'vsDC', target: '构装体或机关', range: '中距', mpCost: 2, cooldown: 1, dc: 11, effects: ['失败则目标速度-1或机关暂停1轮'], desc: '智力对抗目标值11；失败则目标速度-1或机关暂停1轮。' }),

  s({ id: 'priest-calm-prayer', name: '安抚祷词', rank: 'S1', sourceClasses: ['priest'], source: '病房与救济厅', actionType: 'support', attribute: 'spr', hitType: 'auto', target: '单体友方或平民', range: '近身', mpCost: 2, cooldown: 1, effects: ['移除惊慌', '社交冲突目标值-1'], desc: '消耗2法力；移除惊慌；本次社交冲突目标值-1。' }),
  s({ id: 'priest-clean-light', name: '净化微光', rank: 'S1', sourceClasses: ['priest'], source: '圣辉仪式', actionType: 'control', attribute: 'spr', hitType: 'vsDC', target: '轻微污染/瘴气残留', range: '近身', mpCost: 3, cooldown: 1, dc: 11, effects: ['压制轻微瘴气或污染1轮'], desc: '精神对抗目标值11；压制轻微瘴气或污染1轮。' }),
  s({ id: 'priest-case-note', name: '病历问诊', rank: 'S1', sourceClasses: ['priest'], source: '晨曦病房', actionType: 'utility', attribute: 'int', hitType: 'auto', target: '伤者/病历', range: '近身', mpCost: 0, cooldown: 0, effects: ['治疗或病历调查目标值-1'], desc: '治疗或病历调查目标值-1。' }),
  s({ id: 'priest-bell-charm', name: '圣铃护符', rank: 'S1', sourceClasses: ['priest'], source: '修道院护符课', actionType: 'support', attribute: 'spr', hitType: 'auto', target: '单体友方', range: '中距', mpCost: 2, cooldown: 1, effects: ['目标精神豁免+1至下回合'], desc: '消耗2法力；目标精神豁免+1至下回合。' }),

  s({ id: 'summoner-small-familiar', name: '临时使魔', rank: 'S1', sourceClasses: ['summoner'], source: '召唤试验场', actionType: 'support', attribute: 'spr', hitType: 'auto', target: '一格战术位置', range: '中距', mpCost: 3, cooldown: 2, effects: ['生成小使魔提供掩护或搬运1轮'], desc: '消耗3法力；生成小使魔提供掩护或搬运1轮。' }),
  s({ id: 'summoner-circle-fix', name: '召唤圈修补', rank: 'S1', sourceClasses: ['summoner'], source: '契约桌训练', actionType: 'utility', attribute: 'int', hitType: 'auto', target: '召唤圈/契约', range: '近身', mpCost: 1, cooldown: 0, effects: ['召唤或契约事故目标值-1'], desc: '消耗1法力；召唤或契约事故目标值-1。' }),
  s({ id: 'summoner-contract-mark', name: '契约标记', rank: 'S1', sourceClasses: ['summoner'], source: '学院契约检查', actionType: 'control', attribute: 'spr', hitType: 'vsDC', target: '单体敌人或使魔', range: '中距', mpCost: 2, cooldown: 1, dc: 11, effects: ['失败则目标被标记，友方对其命中+1'], desc: '精神对抗目标值11；失败则标记目标，友方对其命中+1至下回合。' }),
  s({ id: 'summoner-slime-tether', name: '软泥牵制', rank: 'S1', sourceClasses: ['summoner'], source: '清理棚事故记录', actionType: 'control', attribute: 'spr', hitType: 'vsDC', target: '单体敌人', range: '中距', mpCost: 3, cooldown: 1, dc: 11, effects: ['失败则速度-1', '对史莱姆类额外持续1轮'], desc: '精神对抗目标值11；失败则速度-1；史莱姆类额外持续1轮。' }),

  s({ id: 'nia-risk-stamp', name: '风险印章', rank: 'S2', sourceClasses: ['sage'], source: '风铃行会柜台', actionType: 'control', attribute: 'int', hitType: 'vsDC', target: '单体敌人或争执者', range: '中距', mpCost: 4, cooldown: 2, dc: 13, effects: ['目标速度-1', '委托现场秩序+1'], requirements: { level: 4, int: 8 }, desc: '智力对抗目标值13；目标速度-1；委托现场秩序+1。' }),
  s({ id: 'berna-whistle-call', name: '哨笛呼援', rank: 'S2', sourceClasses: ['paladin'], source: '白冠西门登记亭', actionType: 'support', attribute: 'spr', hitType: 'auto', target: '当前地标', range: '视野', mpCost: 3, cooldown: 3, effects: ['召来护卫', '非致命冲突目标值-2'], requirements: { level: 4, spr: 6 }, desc: '消耗3法力；召来护卫；非致命冲突目标值-2。' }),
  s({ id: 'patchi-page-reset', name: '空页复位', rank: 'S2', sourceClasses: ['sage', 'artificer'], source: '七旗议会记录席', actionType: 'utility', attribute: 'int', hitType: 'auto', target: '文书记录', range: '近身', mpCost: 3, cooldown: 1, effects: ['旧账或日期调查目标值-2'], requirements: { level: 4, int: 8 }, desc: '消耗3法力；旧账或日期调查目标值-2。' }),
  s({ id: 'sara-burn-triage', name: '灼伤分型', rank: 'S3', sourceClasses: ['priest', 'alchemist'], source: '灰雾边境病棚', actionType: 'utility', attribute: 'int', hitType: 'auto', target: '伤者或残留物', range: '近身', mpCost: 5, cooldown: 1, effects: ['龙脉灼伤识别', '治疗或撤离判定目标值-2'], requirements: { level: 7, int: 10 }, desc: '消耗5法力；识别龙脉灼伤等级；治疗或撤离判定目标值-2。' }),
  s({ id: 'lucy-spectrum-shift', name: '光谱错位', rank: 'S3', sourceClasses: ['sage', 'summoner'], source: '观星塔夜班记录', actionType: 'control', attribute: 'int', hitType: 'vsDC', target: '单体敌人或仪器', range: '中距', mpCost: 6, cooldown: 2, dc: 16, effects: ['失败则命中-1或读数偏移1轮'], requirements: { level: 7, int: 12 }, desc: '智力对抗目标值16；失败则命中-1或读数偏移1轮。' }),
  s({ id: 'fiora-guardian-oath', name: '守护誓言', rank: 'S4', sourceClasses: ['paladin'], source: '圣骑士团团长', actionType: 'support', attribute: 'spr', hitType: 'auto', target: '单体友方', range: '中距', mpCost: 8, cooldown: 2, effects: ['友方护甲+2至下回合', '压制恐惧'], requirements: { level: 11, spr: 8 }, desc: '消耗8法力；友方护甲+2至下回合；压制恐惧。' }),
  s({ id: 'kohara-primal-spring', name: '原初清泉', rank: 'S5', sourceClasses: ['sage', 'priest'], source: '水蓝贤者小原', actionType: 'heal', attribute: 'int', hitType: 'auto', target: '单体友方', range: '中距', mpCost: 12, cooldown: 3, healingDice: '4d6', effects: ['清理中度异常'], requirements: { level: 16, int: 18, spr: 16 }, desc: '恢复4d6+智力加值生命；清理中度异常。' }),
];

export const equipmentPool: Equipment[] = [
  { id: 'worn-long-sword', name: '磨旧长剑', grade: '冒险级', slot: 'weapon', tags: ['长剑', '近战'], sourcePool: '圣骑士团退役武备', requirements: { str: 2 }, durability: 7, hitBonus: 1, damageBonus: 1, traits: ['近战伤害+1'], repairRule: '铁匠可修理。' },
  { id: 'patched-round-shield', name: '补钉圆盾', grade: '冒险级', slot: 'shield', tags: ['盾牌'], sourcePool: '城门护送队', requirements: { str: 2 }, durability: 8, acBonus: 1, traits: ['护甲+1'], repairRule: '铁匠或护具匠可修理。' },
  { id: 'travel-mail', name: '旅行锁甲', grade: '冒险级', slot: 'upper', tags: ['轻甲'], sourcePool: '圣骑士团退役甲片', requirements: { str: 3 }, durability: 8, acBonus: 2, traits: ['护甲+2'], repairRule: '战斗损伤需铁匠修理。' },
  { id: 'chalk-oak-staff', name: '粉笔橡木杖', grade: '冒险级', slot: 'weapon', tags: ['法杖', '导魔'], sourcePool: '星砂学院旧器材柜', requirements: { int: 3 }, durability: 6, hitBonus: 1, traits: ['法术命中+1'], repairRule: '学院或魔导工匠可校准。' },
  { id: 'student-robe', name: '防墨学生袍', grade: '生活级', slot: 'upper', tags: ['布甲', '学院'], sourcePool: '学院自治街', durability: 5, acBonus: 1, traits: ['护甲+1'], repairRule: '裁缝可修补。' },
  { id: 'note-string', name: '绳页细绳', grade: '生活级', slot: 'tool', tags: ['文书', '工具'], sourcePool: '图书馆抄本柜', durability: 4, traits: ['文书整理目标值-1'], repairRule: '可替换。' },
  { id: 'short-bow', name: '短猎弓', grade: '冒险级', slot: 'weapon', tags: ['弓', '远程'], sourcePool: '岚之领行会靶场', requirements: { dex: 3 }, durability: 7, hitBonus: 1, traits: ['远程命中+1'], repairRule: '弓匠或游侠营地可修。' },
  { id: 'waterproof-boots', name: '防水短靴', grade: '生活级', slot: 'boots', tags: ['旅行'], sourcePool: '白帆商队', durability: 6, traits: ['涉水路段目标值-1'], repairRule: '鞋匠修补。' },
  { id: 'route-knife', name: '路标短刀', grade: '冒险级', slot: 'weapon', tags: ['短刀', '工具'], sourcePool: '边路向导', requirements: { dex: 2 }, durability: 6, traits: ['工具判定目标值-1'], repairRule: '铁匠可磨刃。' },
  { id: 'iron-knuckle', name: '训练铁拳套', grade: '冒险级', slot: 'hands', tags: ['拳套', '近战'], sourcePool: '斗技训练场', requirements: { str: 3 }, durability: 8, hitBonus: 1, traits: ['近战命中+1'], repairRule: '铁匠修理。' },
  { id: 'training-vest', name: '厚革训练背心', grade: '冒险级', slot: 'upper', tags: ['轻甲'], sourcePool: '佣兵训练场', durability: 7, acBonus: 2, traits: ['护甲+2'], repairRule: '皮匠修补。' },
  { id: 'plain-belt', name: '结实腰带', grade: '生活级', slot: 'tool', tags: ['负重'], sourcePool: '行会杂货箱', durability: 5, traits: ['搬运小物件目标值-1'], repairRule: '皮匠修补。' },
  { id: 'corked-vial-kit', name: '软木塞药剂组', grade: '冒险级', slot: 'tool', tags: ['炼金', '药剂'], sourcePool: '炼金工坊', requirements: { int: 3 }, durability: 5, traits: ['炼金技能可用'], repairRule: '补充瓶塞和空瓶。' },
  { id: 'leather-apron', name: '防溅皮围裙', grade: '生活级', slot: 'upper', tags: ['工坊'], sourcePool: '炼金工坊', durability: 5, acBonus: 1, traits: ['护甲+1'], repairRule: '皮匠或工坊修补。' },
  { id: 'herb-satchel', name: '分格药草包', grade: '生活级', slot: 'tool', tags: ['药草'], sourcePool: '药草登记所', durability: 5, traits: ['药草辨识目标值-1'], repairRule: '换标签、晾干。' },
  { id: 'copper-wrench', name: '铜壳扳手', grade: '冒险级', slot: 'weapon', tags: ['工具', '机关'], sourcePool: '铜壳机关街', requirements: { int: 2, str: 2 }, durability: 8, hitBonus: 1, traits: ['机关拆解可用'], repairRule: '工坊校准。' },
  { id: 'tool-vest', name: '多袋工具背心', grade: '生活级', slot: 'upper', tags: ['工具'], sourcePool: '灰炉工坊', durability: 6, acBonus: 1, traits: ['小工具不易丢'], repairRule: '裁缝和工匠都能修。' },
  { id: 'calibration-lamp', name: '校准小灯', grade: '冒险级', slot: 'tool', tags: ['魔导灯', '校准'], sourcePool: '灯塔与矿轨维修箱', requirements: { int: 3 }, durability: 6, traits: ['雾气或暗处调查目标值-1'], repairRule: '魔导工匠补灯芯。' },
  { id: 'plain-holy-bell', name: '素面圣铃', grade: '冒险级', slot: 'tool', tags: ['圣铃', '祭司'], sourcePool: '晨曦大教堂侧厅', requirements: { spr: 3 }, durability: 6, traits: ['安抚与净化可用'], repairRule: '修道院重新校音。' },
  { id: 'field-robe', name: '病房外勤袍', grade: '生活级', slot: 'upper', tags: ['医护'], sourcePool: '教会病房', durability: 5, acBonus: 1, traits: ['问诊信任+1'], repairRule: '清洗和缝补。' },
  { id: 'casebook', name: '空白病历本', grade: '生活级', slot: 'tool', tags: ['文书', '医护'], sourcePool: '晨曦病房', durability: 4, traits: ['伤病记录可用'], repairRule: '补页。' },
  { id: 'chalk-contract-ring', name: '粉环契约器', grade: '冒险级', slot: 'ring', tags: ['召唤', '契约'], sourcePool: '召唤试验场', requirements: { spr: 3 }, durability: 6, traits: ['召唤技能可用'], repairRule: '契约桌校准。' },
  { id: 'summon-string', name: '防跑召唤绳', grade: '生活级', slot: 'tool', tags: ['召唤', '绳索'], sourcePool: '清理棚', durability: 5, traits: ['低阶使魔控制目标值-1'], repairRule: '换绳结。' },
  { id: 'npc-oath-saber', name: '誓约制式剑', grade: '精制级', slot: 'weapon', tags: ['长剑', '近战', '圣骑士'], sourcePool: '固定NPC制式装备', requirements: { str: 5 }, durability: 10, hitBonus: 2, damageBonus: 2, traits: ['近战命中+2', '近战伤害+2'], repairRule: '骑士团武备匠维护。' },
  { id: 'npc-oath-shield', name: '誓约纹章盾', grade: '精制级', slot: 'shield', tags: ['盾牌', '守护'], sourcePool: '固定NPC制式装备', requirements: { vit: 5 }, durability: 10, acBonus: 2, traits: ['护甲+2', '守护动作目标值-1'], repairRule: '护具匠维护盾面纹章。' },
  { id: 'npc-mail-coat', name: '巡防锁环外甲', grade: '精制级', slot: 'upper', tags: ['轻甲', '巡防'], sourcePool: '固定NPC制式装备', requirements: { vit: 5 }, durability: 10, acBonus: 2, traits: ['护甲+2'], repairRule: '铁匠与裁缝联合修补。' },
  { id: 'npc-archive-staff', name: '档案导魔杖', grade: '精制级', slot: 'weapon', tags: ['法杖', '导魔', '文书'], sourcePool: '固定NPC制式装备', requirements: { int: 6 }, durability: 8, hitBonus: 2, damageBonus: 1, traits: ['法术命中+2', '法术伤害+1'], repairRule: '学院工坊校准导魔纹。' },
  { id: 'npc-ward-robe', name: '防咒长袍', grade: '精制级', slot: 'upper', tags: ['布甲', '防咒'], sourcePool: '固定NPC制式装备', requirements: { int: 5 }, durability: 8, acBonus: 1, traits: ['护甲+1', '智力检定+1'], repairRule: '重新描线并补缝。' },
  { id: 'npc-ledger-satchel', name: '封签文书挎包', grade: '冒险级', slot: 'tool', tags: ['文书', '封签'], sourcePool: '固定NPC制式装备', durability: 7, traits: ['文书复核目标值-1'], repairRule: '换锁扣和封签。' },
  { id: 'npc-field-bow', name: '巡路短弓', grade: '精制级', slot: 'weapon', tags: ['弓', '远程', '巡路'], sourcePool: '固定NPC制式装备', requirements: { dex: 5 }, durability: 9, hitBonus: 2, damageBonus: 1, traits: ['远程命中+2', '远程伤害+1'], repairRule: '弓匠换弦。' },
  { id: 'npc-route-boots', name: '防滑巡路靴', grade: '冒险级', slot: 'boots', tags: ['旅行', '机动'], sourcePool: '固定NPC制式装备', requirements: { dex: 3 }, durability: 8, traits: ['移动与追踪目标值-1'], repairRule: '鞋匠换底。' },
  { id: 'npc-route-knife', name: '折标短刀', grade: '冒险级', slot: 'tool', tags: ['短刀', '工具'], sourcePool: '固定NPC制式装备', requirements: { dex: 3 }, durability: 7, traits: ['陷阱处理目标值-1'], repairRule: '铁匠磨刃。' },
  { id: 'npc-guard-saber', name: '压阵弯刀', grade: '精制级', slot: 'weapon', tags: ['弯刀', '近战', '压制'], sourcePool: '固定NPC制式装备', requirements: { str: 5 }, durability: 10, hitBonus: 2, damageBonus: 2, traits: ['近战命中+2', '压制伤害+2'], repairRule: '铁匠修刃。' },
  { id: 'npc-guard-mail', name: '厚革护胸', grade: '精制级', slot: 'upper', tags: ['轻甲', '护胸'], sourcePool: '固定NPC制式装备', requirements: { vit: 5 }, durability: 10, acBonus: 2, traits: ['护甲+2'], repairRule: '皮匠补强铆钉。' },
  { id: 'npc-guard-gauntlet', name: '挡拆护手', grade: '冒险级', slot: 'hands', tags: ['护手', '格挡'], sourcePool: '固定NPC制式装备', requirements: { str: 3 }, durability: 8, traits: ['反应格挡减伤+1'], repairRule: '换绑带。' },
  { id: 'npc-reagent-dart', name: '试剂短镖', grade: '精制级', slot: 'weapon', tags: ['短镖', '炼金'], sourcePool: '固定NPC制式装备', requirements: { int: 5 }, durability: 7, hitBonus: 2, damageBonus: 1, traits: ['炼金攻击命中+2', '炼金伤害+1'], repairRule: '补充镖头与试剂槽。' },
  { id: 'npc-reagent-apron', name: '防蚀炼金围裙', grade: '精制级', slot: 'upper', tags: ['工坊', '防蚀'], sourcePool: '固定NPC制式装备', requirements: { vit: 4 }, durability: 8, acBonus: 1, traits: ['护甲+1', '毒素豁免+1'], repairRule: '清洗防蚀层。' },
  { id: 'npc-reagent-kit', name: '随身试剂箱', grade: '精制级', slot: 'tool', tags: ['炼金', '药剂'], sourcePool: '固定NPC制式装备', requirements: { int: 5 }, durability: 8, traits: ['炼金技能可用', '药剂处理目标值-1'], repairRule: '补瓶、补塞、补标签。' },
  { id: 'npc-rivet-hammer', name: '铆钉战锤', grade: '精制级', slot: 'weapon', tags: ['锤', '机关', '近战'], sourcePool: '固定NPC制式装备', requirements: { str: 5, int: 3 }, durability: 10, hitBonus: 2, damageBonus: 2, traits: ['近战命中+2', '构装目标伤害+2'], repairRule: '工坊重校锤头。' },
  { id: 'npc-work-coat', name: '耐磨工匠外套', grade: '精制级', slot: 'upper', tags: ['工坊', '护具'], sourcePool: '固定NPC制式装备', requirements: { vit: 4 }, durability: 9, acBonus: 1, traits: ['护甲+1', '机关事故减伤+1'], repairRule: '补皮面和铜扣。' },
  { id: 'npc-rivet-kit', name: '铆钉工具盒', grade: '冒险级', slot: 'tool', tags: ['机关', '维修'], sourcePool: '固定NPC制式装备', requirements: { int: 4 }, durability: 8, traits: ['机关维修目标值-1'], repairRule: '补齐缺件。' },
  { id: 'npc-prayer-rod', name: '祈光短杖', grade: '精制级', slot: 'weapon', tags: ['圣铃', '治疗', '导魔'], sourcePool: '固定NPC制式装备', requirements: { spr: 5 }, durability: 8, hitBonus: 2, damageBonus: 1, traits: ['祈祷命中+2', '治疗量+1'], repairRule: '修道院重新校音。' },
  { id: 'npc-prayer-robe', name: '净纹外勤袍', grade: '精制级', slot: 'upper', tags: ['医护', '净化'], sourcePool: '固定NPC制式装备', requirements: { spr: 4 }, durability: 8, acBonus: 1, traits: ['护甲+1', '净化检定+1'], repairRule: '清洗并重绣净纹。' },
  { id: 'npc-reliquary', name: '小圣匣', grade: '冒险级', slot: 'tool', tags: ['治疗', '净化'], sourcePool: '固定NPC制式装备', requirements: { spr: 4 }, durability: 7, traits: ['治疗与净化可用'], repairRule: '补香料和封蜡。' },
  { id: 'npc-contract-rod', name: '契约短杖', grade: '精制级', slot: 'weapon', tags: ['召唤', '契约', '导魔'], sourcePool: '固定NPC制式装备', requirements: { spr: 5 }, durability: 8, hitBonus: 2, damageBonus: 1, traits: ['召唤命中+2', '契约伤害+1'], repairRule: '契约桌校准。' },
  { id: 'npc-contract-ring', name: '稳相契约环', grade: '精制级', slot: 'ring', tags: ['召唤', '契约'], sourcePool: '固定NPC制式装备', requirements: { spr: 5 }, durability: 8, traits: ['召唤控制目标值-1'], repairRule: '重新描契约线。' },
  { id: 'npc-circle-chalk', name: '防断线粉笔盒', grade: '冒险级', slot: 'tool', tags: ['召唤', '工具'], sourcePool: '固定NPC制式装备', durability: 7, traits: ['召唤圈处理目标值-1'], repairRule: '补粉笔和盒扣。' },
  { id: 'dawn-shield-fragment', name: '拂晓盾纹残片', grade: '圣遗级', slot: 'shield', tags: ['神器线索', '盾牌'], sourcePool: '拂晓之盾旧誓页', requirements: { spr: 12, vit: 8 }, durability: 3, acBonus: 2, traits: ['短时护甲+2'], repairRule: '需要誓约校验和维护页。' },
  { id: 'storm-key-splinter', name: '风暴钥齿', grade: '圣遗级', slot: 'tool', tags: ['神器线索', '机关'], sourcePool: '风暴之钥残页', requirements: { dex: 12, int: 8 }, durability: 3, traits: ['旧门检定+2'], repairRule: '需要铜桥铭文互证。' },
  { id: 'star-cup-echo', name: '星灯杯影', grade: '神器级', slot: 'tool', tags: ['神器载体', '治疗', '星灯'], sourcePool: '星灯之杯旧光', requirements: { level: 16, int: 16, spr: 14 }, durability: 2, traits: ['S5治疗载体'], repairRule: '需要观测记录、病历和主线许可。' },
];

export const getClassById = (classId: CharacterClassId) => characterClasses.find(item => item.id === classId) || characterClasses[0];
export const getRaceById = (raceId: CharacterRaceId) => characterRaces.find(item => item.id === raceId) || characterRaces[0];
export const allSkills = () => [...skills, ...fixedNpcSkillRegistry];
export const getSkillById = (skillId: string) =>
  allSkills().find(item => item.id === skillId || item.name === skillId);
export const getTalentById = (talentId: string) => classTalents.find(item => item.id === talentId);
export const getEquipmentById = (equipmentId: string) => equipmentPool.find(item => item.id === equipmentId);

export const getOpeningSkillsByClass = (classId: CharacterClassId) =>
  getClassById(classId).startingCombatSkillIds.map(id => getSkillById(id)).filter((skill): skill is Skill => Boolean(skill));

export const attributeModifier = (value: number) => {
  if (value >= 20) return 5;
  if (value >= 16) return 4;
  if (value >= 12) return 3;
  if (value >= 8) return 2;
  if (value >= 4) return 1;
  return 0;
};

export const proficiencyBonus = (level: number) => {
  if (level >= 17) return 5;
  if (level >= 13) return 4;
  if (level >= 9) return 3;
  if (level >= 5) return 2;
  return 1;
};

export type ExperienceRewardInput = {
  recommendedLevel: number;
  actorLevel: number;
  weight: 'minor' | 'standard' | 'combat' | 'quest' | 'main' | 'secret';
  quality: 'failed' | 'partial' | 'complete' | 'extra' | 'perfect';
  participation: 'actual' | 'support' | 'present' | 'absent';
};

const experienceWeights: Record<ExperienceRewardInput['weight'], number> = {
  minor: 0.5,
  standard: 1,
  combat: 1.5,
  quest: 2,
  main: 3,
  secret: 4,
};

const experienceQuality: Record<ExperienceRewardInput['quality'], number> = {
  failed: 0.3,
  partial: 0.5,
  complete: 1,
  extra: 1.2,
  perfect: 1.4,
};

const experienceParticipation: Record<ExperienceRewardInput['participation'], number> = {
  actual: 1,
  support: 0.6,
  present: 0.25,
  absent: 0,
};

const difficultyMultiplier = (recommendedLevel: number, actorLevel: number) => {
  const diff = recommendedLevel - actorLevel;
  if (diff <= -4) return 0.1;
  if (diff === -3) return 0.4;
  if (diff === -2) return 0.6;
  if (diff === -1) return 0.85;
  if (diff === 0) return 1;
  if (diff === 1) return 1.15;
  if (diff === 2) return 1.3;
  if (diff === 3) return 1.45;
  return 1.6;
};

export const totalExperienceForLevel = (level: number) =>
  EXPERIENCE_TOTAL_BY_LEVEL[Math.max(1, Math.min(20, Math.floor(level)))] ?? EXPERIENCE_TOTAL_BY_LEVEL[20];

export const experienceForNextLevel = (level: number) =>
  EXPERIENCE_TO_NEXT_BY_LEVEL[Math.max(1, Math.min(20, Math.floor(level)))] ?? 0;

export const calculateExperienceReward = (input: ExperienceRewardInput) => {
  const recommendedLevel = Math.max(1, Math.min(20, Math.floor(input.recommendedLevel || 1)));
  const actorLevel = Math.max(1, Math.min(20, Math.floor(input.actorLevel || 1)));
  const base = 25 + recommendedLevel * 7;
  return Math.round(
    base
    * experienceWeights[input.weight]
    * experienceQuality[input.quality]
    * difficultyMultiplier(recommendedLevel, actorLevel)
    * experienceParticipation[input.participation],
  );
};

export const effectiveAttributes = (attributes: Record<AttributeKey, number>, raceId: CharacterRaceId) => {
  const race = getRaceById(raceId);
  return ATTRIBUTE_KEYS.reduce((acc, key) => {
    acc[key] = Math.max(0, Math.min(20, attributes[key] + (race.attributeBonus[key] || 0)));
    return acc;
  }, {} as Record<AttributeKey, number>);
};

export const createLoadoutFromEquipment = (equipmentIds: string[]): EquipmentLoadout =>
  equipmentIds.reduce((loadout, id) => {
    const item = getEquipmentById(id);
    if (item && loadout[item.slot] === undefined) loadout[item.slot] = id;
    return loadout;
  }, {} as EquipmentLoadout);

export const equippedIdsFromLoadout = (loadout: EquipmentLoadout) =>
  Object.values(loadout).filter((id): id is string => Boolean(id));

export const skillRankAvailableAtLevel = (rank: SkillRank, level: number) => level >= SKILL_RANK_RULES[rank].levelMin;

export const canUseSkill = (skill: Skill, unit: PlayerState | CombatUnit) => {
  const level = unit.level || 1;
  const stats = unit.stats;
  if (!skillRankAvailableAtLevel(skill.rank, level)) return false;
  if ('mp' in unit && unit.mp < skill.mpCost) return false;
  if (!skill.requirements) return true;
  if (skill.requirements.level && level < skill.requirements.level) return false;
  if (skill.requirements.equipmentTag) {
    const equipmentIds = 'equipmentLoadout' in unit ? equippedIdsFromLoadout(unit.equipmentLoadout) : unit.equipmentIds || [];
    const hasTag = equipmentIds.map(id => getEquipmentById(id)).some(item => item?.tags.includes(skill.requirements!.equipmentTag!));
    if (!hasTag) return false;
  }
  return ATTRIBUTE_KEYS.every(key => {
    const required = skill.requirements?.[key];
    return required === undefined || stats[key] >= required;
  });
};

export const canEquipEquipment = (equipment: Equipment, player: PlayerState) => {
  const requirements = equipment.requirements;
  if (!requirements) return true;
  if (requirements.level && player.level < requirements.level) return false;
  return ATTRIBUTE_KEYS.every(key => {
    const required = requirements[key];
    return required === undefined || player.stats[key] >= required;
  });
};

export const calculateDerivedStats = (
  level: number,
  classId: CharacterClassId,
  attributes: Record<AttributeKey, number>,
  equipmentIds: string[] = [],
  raceId: CharacterRaceId = 'human',
): CharacterStats => {
  const cls = getClassById(classId);
  const effective = effectiveAttributes(attributes, raceId);
  const prof = proficiencyBonus(level);
  const strMod = attributeModifier(effective.str);
  const dexMod = attributeModifier(effective.dex);
  const vitMod = attributeModifier(effective.vit);
  const intMod = attributeModifier(effective.int);
  const sprMod = attributeModifier(effective.spr);
  const frontLineBoost = ['paladin', 'battle-master', 'ranger'].includes(classId) ? Math.max(0, strMod) : 0;
  const casterBoost = cls.mpPerLevel > 0 ? Math.max(0, intMod + sprMod) : 0;
  const maxHp = Math.max(1, cls.hpBase + cls.hpPerLevel * (level - 1) + effective.vit * 2 + vitMod * level + frontLineBoost);
  const maxMp = Math.max(0, cls.mpBase + cls.mpPerLevel * (level - 1) + casterBoost + Math.max(0, effective.int + effective.spr - 6));
  const equipmentAc = equipmentIds.reduce((sum, id) => sum + (getEquipmentById(id)?.acBonus || 0), 0);
  const ac = 8 + dexMod + equipmentAc;
  return {
    level,
    proficiency: prof,
    hp: maxHp,
    maxHp,
    mp: maxMp,
    maxMp,
    ac,
    initiative: dexMod + prof,
    ...effective,
  };
};

type BuildPlayerInput = {
  identity?: Partial<PlayerState['identity']>;
  raceId?: CharacterRaceId;
  classId: CharacterClassId;
  originId: string;
  attributes?: Record<AttributeKey, number>;
  activeSkillIds?: string[];
};

export function buildPlayerState(input: BuildPlayerInput): PlayerState;
export function buildPlayerState(classId: CharacterClassId, originId: string, attributes?: Record<AttributeKey, number>, activeSkillIds?: string[]): PlayerState;
export function buildPlayerState(
  inputOrClassId: BuildPlayerInput | CharacterClassId,
  originIdArg?: string,
  attributesArg?: Record<AttributeKey, number>,
  activeSkillIdsArg?: string[],
): PlayerState {
  const input: BuildPlayerInput = typeof inputOrClassId === 'string'
    ? { classId: inputOrClassId, originId: originIdArg || originLocations[0].id, attributes: attributesArg, activeSkillIds: activeSkillIdsArg }
    : inputOrClassId;
  const cls = getClassById(input.classId);
  const raceId = input.raceId || 'human';
  const location = originLocations.find(origin => origin.id === input.originId && origin.id !== 'random-origin') || originLocations[0];
  const baseAttributes = input.attributes || cls.presetStats;
  const loadout = createLoadoutFromEquipment(cls.startingEquipmentIds);
  const stats = calculateDerivedStats(1, input.classId, baseAttributes, equippedIdsFromLoadout(loadout), raceId);
  const openingSkills = getOpeningSkillsByClass(input.classId);
  const chosenSkills = (input.activeSkillIds && input.activeSkillIds.length > 0 ? input.activeSkillIds : openingSkills.slice(0, 2).map(skill => skill.id)).slice(0, 2);
  const identity = {
    name: input.identity?.name?.trim() || '未落名旅人',
    gender: input.identity?.gender?.trim() || '未记录',
    age: input.identity?.age?.trim() || '未记录',
    background: input.identity?.background?.trim() || '无登记经历',
  };
  return {
    identity,
    name: identity.name,
    raceId,
    level: 1,
    experience: 0,
    nextLevelExperience: experienceForNextLevel(1),
    availableAttributePoints: 0,
    classId: input.classId,
    originId: location.id,
    location,
    stats,
    baseAttributes,
    activeSkillIds: chosenSkills,
    knownSkillIds: [...new Set(chosenSkills)],
    talentIds: cls.companionTalentIds,
    equipmentIds: cls.startingEquipmentIds,
    equipmentLoadout: loadout,
    inventory: [],
    partyMemberIds: [],
    relationships: [],
    reputations: [],
    notices: [],
  };
}

export const allocateAttributePoint = (player: PlayerState, key: AttributeKey): PlayerState => {
  if (player.availableAttributePoints <= 0 || player.baseAttributes[key] >= 20) return player;
  const baseAttributes = { ...player.baseAttributes, [key]: player.baseAttributes[key] + 1 };
  const stats = calculateDerivedStats(player.level, player.classId, baseAttributes, equippedIdsFromLoadout(player.equipmentLoadout), player.raceId);
  return { ...player, baseAttributes, stats, availableAttributePoints: player.availableAttributePoints - 1 };
};

export const gainExperience = (player: PlayerState, amount: number): PlayerState => {
  let level = player.level;
  let experience = player.experience + amount;
  let nextLevelExperience = player.nextLevelExperience;
  let gainedLevels = 0;
  while (level < 20 && experience >= nextLevelExperience) {
    experience -= nextLevelExperience;
    level += 1;
    gainedLevels += 1;
    nextLevelExperience = experienceForNextLevel(level);
  }
  if (gainedLevels === 0) return { ...player, experience };
  const availableAttributePoints = player.availableAttributePoints + gainedLevels * 2;
  const previousStats = player.stats;
  const stats = calculateDerivedStats(level, player.classId, player.baseAttributes, equippedIdsFromLoadout(player.equipmentLoadout), player.raceId);
  const hpDelta = Math.max(0, stats.maxHp - previousStats.maxHp);
  const mpDelta = Math.max(0, stats.maxMp - previousStats.maxMp);
  return {
    ...player,
    level,
    experience,
    nextLevelExperience,
    availableAttributePoints,
    stats: {
      ...stats,
      hp: Math.min(stats.maxHp, previousStats.hp + hpDelta),
      mp: Math.min(stats.maxMp, previousStats.mp + mpDelta),
    },
    notices: [
      { id: `level-${Date.now()}`, type: 'level', title: `升级提示：${player.name}`, body: `等级提升至${level}，可分配点数+${gainedLevels * 2}`, meta: '五维加点待定' },
      ...player.notices,
    ],
  };
};

export const rollDice = (dice: string) => {
  const match = dice.match(/^(\d+)d(\d+)$/);
  if (!match) return { total: 0, rolls: [] as number[] };
  const count = Number(match[1]);
  const sides = Number(match[2]);
  const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
  return { total: rolls.reduce((sum, value) => sum + value, 0), rolls };
};

export const makeAttackRoll = (unit: CombatUnit, skill: Skill) => {
  const d20 = Math.floor(Math.random() * 20) + 1;
  const attr = attributeModifier(unit.stats[skill.attribute]);
  const prof = proficiencyBonus(unit.level);
  const equipmentHit = (unit.equipmentIds || []).reduce((sum, id) => sum + (getEquipmentById(id)?.hitBonus || 0), 0);
  return { d20, attr, prof, equipmentHit, total: d20 + attr + prof + equipmentHit };
};

export const resolveSkillUse = (actor: CombatUnit, target: CombatUnit, skill: Skill) => {
  const actorAfter = { ...actor, mp: Math.max(0, actor.mp - skill.mpCost) };
  if (skill.hitType === 'auto') {
    if (skill.healingDice) {
      const healing = rollDice(skill.healingDice);
      const amount = Math.max(1, healing.total + attributeModifier(actor.stats[skill.attribute]));
      return {
        actor: actorAfter,
        target: { ...target, hp: Math.min(target.maxHp, target.hp + amount) },
        text: `${actor.name}使用【${skill.name}】，恢复${amount}点生命。`,
        detail: `消耗${skill.mpCost}法力；治疗骰${skill.healingDice}=${healing.rolls.join('+') || 0}。`,
      };
    }
    return {
      actor: actorAfter,
      target,
      text: `${actor.name}使用【${skill.name}】，${skill.effects.join('；')}。`,
      detail: `消耗${skill.mpCost}法力；自动生效。`,
    };
  }

  const roll = makeAttackRoll(actor, skill);
  const threshold = skill.hitType === 'vsAC' ? target.ac : (skill.dc || 11);
  const hit = roll.total >= threshold;
  if (!hit) {
    return {
      actor: actorAfter,
      target,
      text: `${actor.name}使用【${skill.name}】未命中。`,
      detail: `二十面骰${roll.d20}+属性${roll.attr}+熟练${roll.prof}+装备${roll.equipmentHit}=${roll.total}，目标值${threshold}；消耗${skill.mpCost}法力。`,
    };
  }
  const damage = skill.damageDice ? rollDice(skill.damageDice) : { total: 0, rolls: [] as number[] };
  const equipmentDamage = (actor.equipmentIds || []).reduce((sum, id) => sum + (getEquipmentById(id)?.damageBonus || 0), 0);
  const amount = Math.max(1, damage.total + attributeModifier(actor.stats[skill.attribute]) + equipmentDamage);
  return {
    actor: actorAfter,
    target: { ...target, hp: Math.max(0, target.hp - amount) },
    text: `${actor.name}使用【${skill.name}】命中，造成${amount}点伤害。`,
    detail: `二十面骰${roll.d20}+属性${roll.attr}+熟练${roll.prof}+装备${roll.equipmentHit}=${roll.total}，目标值${threshold}；伤害${skill.damageDice || '效果'}=${damage.rolls.join('+') || 0}+属性+装备${equipmentDamage}。`,
  };
};

export const playerToCombatUnit = (player: PlayerState): CombatUnit => ({
  id: 'player',
  name: `${player.name}（${getClassById(player.classId).name}）`,
  isEnemy: false,
  level: player.level,
  hp: player.stats.hp,
  maxHp: player.stats.maxHp,
  mp: player.stats.mp,
  maxMp: player.stats.maxMp,
  ac: player.stats.ac,
  stats: {
    str: player.stats.str,
    dex: player.stats.dex,
    vit: player.stats.vit,
    int: player.stats.int,
    spr: player.stats.spr,
  },
  skillIds: player.activeSkillIds,
  equipmentIds: equippedIdsFromLoadout(player.equipmentLoadout),
  ap: 1,
  maxAp: 1,
  shield: 0,
  statusLogs: [`等级${player.level}`, getClassById(player.classId).name],
});

export const formatRequirements = (requirements?: Skill['requirements'] | Equipment['requirements']) => {
  if (!requirements) return '无';
  const parts = ATTRIBUTE_KEYS
    .map(key => {
      const value = requirements[key];
      return value === undefined ? '' : `${ATTRIBUTE_LABELS[key]}${value}`;
    })
    .filter(Boolean);
  if ('level' in requirements && requirements.level) parts.unshift(`等级${requirements.level}`);
  if ('equipmentTag' in requirements && requirements.equipmentTag) parts.push(`需要${requirements.equipmentTag}`);
  return parts.join(' / ') || '无';
};

export const generateEquipmentName = (seed = 0) => {
  const pools = {
    regions: ['白冠', '灰炉', '七旗', '白帆', '星砂', '月鹿', '黑松', '灰雾', '亚雷亚'],
    materials: ['王钢', '风铃铁', '潮盐革', '星砂玻璃', '月根丝', '炉心铜', '黑松骨木', '防瘴布', '龙脉灰'],
    crafts: ['校准', '封签', '缝补', '誓约', '避雾', '旧账', '灯塔', '矿轨', '病历', '铃扣'],
    forms: ['长剑', '短弓', '盾', '外袍', '手套', '短靴', '戒指', '药剂袋', '校准灯', '契约器', '维修钳'],
  };
  const pick = <T,>(values: T[], offset: number) => values[Math.abs(seed + offset) % values.length];
  return `${pick(pools.regions, 1)}${pick(pools.materials, 3)}${pick(pools.crafts, 5)}${pick(pools.forms, 7)}`;
};
