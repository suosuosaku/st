export type GameState = 'creation' | 'playing';

export type AttributeKey = 'str' | 'dex' | 'vit' | 'int' | 'spr';

export type CharacterStats = {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  ac: number;
  str: number;
  dex: number;
  vit: number;
  int: number;
  spr: number;
  level?: number;
  proficiency?: number;
  initiative?: number;
};

export type SkillRank = 'S1' | 'S2' | 'S3' | 'S4' | 'S5';
export type TalentRank = 'S0';
export type SkillActionType = 'attack' | 'support' | 'heal' | 'control' | 'utility' | 'reaction';
export type HitType = 'vsAC' | 'vsDC' | 'auto';

export type EquipmentGrade = '生活级' | '冒险级' | '精制级' | '圣遗级' | '神器级';
export type EquipmentSlot = 'weapon' | 'upper' | 'lower' | 'hands' | 'ring' | 'boots' | 'tool' | 'shield';

export type CharacterClassId =
  | 'paladin'
  | 'sage'
  | 'ranger'
  | 'battle-master'
  | 'alchemist'
  | 'artificer'
  | 'priest'
  | 'summoner';

export type CharacterRaceId =
  | 'human'
  | 'elf'
  | 'half-elf'
  | 'dwarf'
  | 'halfling'
  | 'gnome'
  | 'mirrorborn'
  | 'tideborn'
  | 'fae'
  | 'fae-blood'
  | 'beastkin'
  | 'orc'
  | 'goblin'
  | 'dragonborn'
  | 'tiefling'
  | 'aasimar'
  | 'treeborn'
  | 'wingborn'
  | 'frostborn'
  | 'record-spirit';

export type CharacterIdentity = {
  name: string;
  gender: string;
  age: string;
  background: string;
};

export type CharacterRace = {
  id: CharacterRaceId;
  name: string;
  summary: string;
  attributeBonus: Partial<Record<AttributeKey, number>>;
  auraName: string;
  auraEffect: string;
};

export type ClassTalent = {
  id: string;
  name: string;
  rank: TalentRank;
  classId: CharacterClassId;
  effect: string;
};

export type Skill = {
  id: string;
  name: string;
  rank: SkillRank;
  sourceClasses: CharacterClassId[];
  source: string;
  actionType: SkillActionType;
  attribute: AttributeKey;
  hitType: HitType;
  target: string;
  range: string;
  mpCost: number;
  cooldown: number;
  damageDice?: string;
  healingDice?: string;
  dc?: number;
  effects: string[];
  requirements?: Partial<Record<AttributeKey, number>> & { level?: number; equipmentTag?: string };
  desc: string;
};

export type Equipment = {
  id: string;
  name: string;
  grade: EquipmentGrade;
  slot: EquipmentSlot;
  tags: string[];
  sourcePool: string;
  requirements?: Partial<Record<AttributeKey, number>> & { level?: number };
  durability: number;
  acBonus?: number;
  hitBonus?: number;
  damageBonus?: number;
  traits: string[];
  repairRule: string;
};

export type CharacterClass = {
  id: CharacterClassId;
  name: string;
  summary: string;
  classAuraName: string;
  classAuraEffect: string;
  hpBase: number;
  hpPerLevel: number;
  mpBase: number;
  mpPerLevel: number;
  primaryAttributes: AttributeKey[];
  presetStats: Record<AttributeKey, number>;
  companionTalentIds: string[];
  startingCombatSkillIds: string[];
  startingEquipmentIds: string[];
};

export type OriginLocation = {
  id: string;
  name: string;
  regionId: string;
  landmarkName: string;
  summary: string;
  weather: string;
  trouble: string;
  firstNpc: string;
};

export type ReputationRecord = {
  regionId: string;
  label: string;
  value: number;
  tier: string;
};

export type RelationshipRecord = {
  characterId: string;
  name: string;
  favorability: number;
  stage: string;
  lastChange?: string;
};

export type EquipmentLoadout = Partial<Record<EquipmentSlot, string>>;

export type PlayerState = {
  identity: CharacterIdentity;
  name: string;
  raceId: CharacterRaceId;
  level: number;
  experience: number;
  nextLevelExperience: number;
  availableAttributePoints: number;
  classId: CharacterClassId;
  originId: string;
  location: OriginLocation;
  stats: CharacterStats;
  baseAttributes: Record<AttributeKey, number>;
  activeSkillIds: string[];
  knownSkillIds: string[];
  talentIds: string[];
  equipmentIds: string[];
  equipmentLoadout: EquipmentLoadout;
  inventory: string[];
  partyMemberIds: string[];
  relationships: RelationshipRecord[];
  reputations: ReputationRecord[];
  notices: ImmersiveNotice[];
};

export type ImmersiveNoticeType =
  | 'item'
  | 'quest'
  | 'event'
  | 'npc'
  | 'skill'
  | 'location'
  | 'clue'
  | 'level'
  | 'favor'
  | 'reputation'
  | 'equipment';

export type ImmersiveNotice = {
  id: string;
  type: ImmersiveNoticeType;
  title: string;
  body: string;
  meta?: string;
};

export type ClueRecord = {
  id: string;
  label: string;
  status: string;
  display: string;
  location: string;
  carrier: string;
  detail: string;
};

export type CluePhase = {
  id: string;
  phase: string;
  eventName: string;
  status: string;
  progress: string;
  buttonText: string;
  clues: ClueRecord[];
};

export type Character = {
  id: string;
  name: string;
  fullName: string;
  type: 'NPC登记' | '玩家' | '随从';
  race: string;
  raceId?: CharacterRaceId;
  gender: string;
  age: number | string;
  affiliation: string;
  identity: string;
  classId: CharacterClassId;
  profession: string;
  avatarUrl?: string;
  portraitUrl?: string;
  stats: CharacterStats;
  experience: number;
  nextLevelExperience: number;
  availableAttributePoints: number;
  favorability: number;
  relationshipStage: string;
  equipmentIds: string[];
  equipmentLoadout: EquipmentLoadout;
  activeSkillIds: string[];
  knownSkillIds: string[];
  attributes: string[];
  skills: Skill[];
};

export type Quest = {
  id: string;
  title: string;
  source: string;
  task: string;
  recLevel: number;
  risk: '极高' | '高' | '中' | '低';
  reward: string;
  timeLimit: string;
  status?: string;
  reputationRegionId?: string;
  reputationReward?: number;
};

export type DynamicBoardItemType = '新闻' | '见闻' | '委托' | '市场' | '传讯' | '路径行动';

export type DynamicBoardItem = {
  id: string;
  type: DynamicBoardItemType;
  title: string;
  detail: string;
  source: string;
  status: string;
  location: string;
  risk?: Quest['risk'] | string;
  reward?: string;
  recLevel?: number;
  timeLimit?: string;
  updatedAt?: string;
};

export type CombatUnit = {
  id: string;
  name: string;
  isEnemy: boolean;
  level: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  ac: number;
  stats: Record<AttributeKey, number>;
  skillIds: string[];
  equipmentIds?: string[];
  ap: number;
  maxAp: number;
  shield: number;
  statusLogs: string[];
  cooldowns?: Record<string, number>;
};

export type TabState = 'overview' | 'map' | 'party' | 'npc' | 'quests' | 'clues' | 'inventory' | 'combat' | 'system';
