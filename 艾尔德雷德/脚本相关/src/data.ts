import { Character, CombatUnit, Quest } from './types';
import { skills } from './game/rules';
import { eldredFixedNpcNames, eldredFixedNpcRegistry } from './game/eldredNpcRegistry';

const CHARACTER_IMAGE_BASE = 'https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/';
export const characterImage = (name: string, type: '头像' | '立绘') =>
  `${CHARACTER_IMAGE_BASE}${encodeURIComponent(`${name}${type}.png`)}`;

export const fixedNpcImageNames = new Set<string>(eldredFixedNpcNames);

export const genericNpcImages = {
  male: {
    头像: characterImage('托比', '头像'),
    立绘: characterImage('托比', '立绘'),
  },
  female: {
    头像: characterImage('玛洛', '头像'),
    立绘: characterImage('玛洛', '立绘'),
  },
  neutral: {
    头像: characterImage('帕琪', '头像'),
    立绘: characterImage('帕琪', '立绘'),
  },
} as const;

const genericNpcFileNames = new Map<string, string>([
  ['路人男头像', genericNpcImages.male.头像],
  ['路人男立绘', genericNpcImages.male.立绘],
  ['路人男性头像', genericNpcImages.male.头像],
  ['路人男性立绘', genericNpcImages.male.立绘],
  ['路人女头像', genericNpcImages.female.头像],
  ['路人女立绘', genericNpcImages.female.立绘],
  ['路人女性头像', genericNpcImages.female.头像],
  ['路人女性立绘', genericNpcImages.female.立绘],
  ['路人中性头像', genericNpcImages.neutral.头像],
  ['路人中性立绘', genericNpcImages.neutral.立绘],
  ['路人头像', genericNpcImages.neutral.头像],
  ['路人立绘', genericNpcImages.neutral.立绘],
]);

const genericImageFor = (type: '头像' | '立绘', gender?: unknown) => {
  const text = String(gender ?? '').trim();
  if (/男/.test(text) && !/女/.test(text)) return genericNpcImages.male[type];
  if (/女/.test(text)) return genericNpcImages.female[type];
  return genericNpcImages.neutral[type];
};

export const resolveCharacterImage = (
  name: string,
  type: '头像' | '立绘',
  options: { fixed?: boolean; raw?: unknown; gender?: unknown; generic?: boolean } = {},
) => {
  const raw = String(options.raw ?? '').trim();
  if (/^(https?:|data:|blob:|\/)/i.test(raw)) return raw;
  if (raw) {
    const baseName = raw.replace(/\.(png|jpg|jpeg|webp)$/i, '').replace(/头像$|立绘$/g, '') || name;
    const genericByRaw = genericNpcFileNames.get(raw.replace(/\.(png|jpg|jpeg|webp)$/i, ''));
    if (genericByRaw) return genericByRaw;
    if (fixedNpcImageNames.has(baseName)) return characterImage(baseName, type);
    if (options.fixed || fixedNpcImageNames.has(name)) return characterImage(baseName, type);
    return options.generic ? genericImageFor(type, options.gender) : '';
  }
  if (options.fixed || fixedNpcImageNames.has(name)) return characterImage(name, type);
  return options.generic ? genericImageFor(type, options.gender) : '';
};

export const eldredNPCs: Character[] = eldredFixedNpcRegistry;

export const eldredQuests: Quest[] = [
  { id: 'q1', title: '折断的剑旧账本日期', source: '七旗城风铃行会街', task: '到折断的剑酒馆核对旧账本夹层、欠款墙和七旗短账纸，把同日风声写成可结算记录。', recLevel: 3, risk: '低', reward: '两日食宿，行会登记章，七旗城声望+5', timeLimit: '2日', reputationRegionId: 'seven-banners', reputationReward: 5 },
  { id: 'q2', title: '白冠西门名册复核', source: '白冠西门登记员', task: '协助贝尔娜核验一条入城名册、泥脚印板和通行火漆，确认灾民日期栏是否被错抄。', recLevel: 5, risk: '中', reward: '入城担保便笺，基础治疗券，白冠王都声望+4', timeLimit: '当日', reputationRegionId: 'white-crown', reputationReward: 4 },
  { id: 'q3', title: '灰雾病棚药草批次', source: '灰雾边境营地医师', task: '替萨菈追回一批被错送到洗靴棚的药草，并记录龙脉灼伤样本的来源地点。', recLevel: 8, risk: '高', reward: '防瘴药两份，向导折扣，边境声望+8', timeLimit: '3日', reputationRegionId: 'gray-mist', reputationReward: 8 },
  { id: 'q4', title: '观星塔断线光谱', source: '星砂学院观星塔', task: '帮助露西整理夜班观测册，把观星塔断线光谱与灯塔暗光、极光色带残抄做第一次日期对照。', recLevel: 10, risk: '中', reward: '学院旁听许可，光谱纸副本，星砂学院邦声望+6', timeLimit: '5日', reputationRegionId: 'star-sand', reputationReward: 6 },
];

export const eldredCombatUnits: CombatUnit[] = [
  {
    id: 'npc-nia-support',
    name: '妮娅的柜台支援',
    isEnemy: false,
    level: 6,
    hp: 32,
    maxHp: 32,
    mp: 20,
    maxMp: 20,
    ac: 12,
    stats: { str: 1, dex: 5, vit: 4, int: 10, spr: 6 },
    skillIds: ['nia-risk-stamp'],
    equipmentIds: ['note-string'],
    ap: 1,
    maxAp: 1,
    shield: 0,
    statusLogs: ['风险印章', '委托复核'],
  },
  {
    id: 'slime-door',
    name: '堵门史莱姆',
    isEnemy: true,
    level: 2,
    hp: 18,
    maxHp: 18,
    mp: 0,
    maxMp: 0,
    ac: 10,
    stats: { str: 3, dex: 2, vit: 4, int: 0, spr: 1 },
    skillIds: [],
    equipmentIds: [],
    ap: 1,
    maxAp: 1,
    shield: 0,
    statusLogs: ['黏液堵门', '吞纸'],
  },
];

export { skills };
