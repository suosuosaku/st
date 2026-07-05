export type CangxuanWorldbookCategory =
  | 'always'
  | 'scheduled'
  | 'suggested_always'
  | 'suggested_scheduled'
  | 'unused_candidate';

export interface CangxuanWorldbookSchedulerConfig {
  alwaysNames: string[];
  scheduledNames: string[];
  keepEnabledNames: string[];
  maxEntries: number;
  maxChars: number;
}

export interface CangxuanWorldbookBindingReport {
  global: string[];
  characterPrimary: string | null;
  characterAdditional: string[];
  chat: string | null;
  loaded: string[];
  scanned: string[];
}

export interface CangxuanWorldbookEntryRef {
  id: string;
  worldbookName: string;
  uid: number;
  name: string;
  displayName: string;
  aliases: string[];
  isNpc: boolean;
  enabled: boolean;
  strategyType: string;
  keys: string[];
  secondaryKeys: string[];
  sectionPath: string[];
  positionType: string;
  depth: number | null;
  order: number;
  role: string;
  content: string;
  contentLength: number;
  category: CangxuanWorldbookCategory;
  reasons: string[];
}

export interface CangxuanWorldbookDuplicate {
  name: string;
  entries: Array<{ worldbookName: string; uid: number; enabled: boolean }>;
}

export interface CangxuanWorldbookScan {
  scannedAt: string;
  bindings: CangxuanWorldbookBindingReport;
  entries: CangxuanWorldbookEntryRef[];
  duplicates: CangxuanWorldbookDuplicate[];
  missingAlwaysNames: string[];
  missingScheduledNames: string[];
  counts: {
    books: number;
    entries: number;
    enabled: number;
    always: number;
    scheduled: number;
    suggestedAlways: number;
    suggestedScheduled: number;
    unusedCandidate: number;
  };
}

export interface CangxuanWorldbookInjectionReport {
  injectedAt: string;
  entryIds: string[];
  entryNames: string[];
  reasonById: Record<string, string>;
  totalChars: number;
  estimatedTokens: number;
  sceneSignals: {
    locations: string[];
    characters: string[];
    actionTypes: string[];
  };
  warnings: string[];
}

export interface CangxuanWorldbookEnableBackup {
  id: string;
  createdAt: string;
  entries: Array<{
    worldbookName: string;
    uid: number;
    name: string;
    enabled: boolean;
  }>;
}

const CANGXUAN_CHARACTER_NAMES = [
  '江念',
  '沈慕微',
  '欧阳诚',
  '谢忘生',
  '萧天衍',
  '药芷若',
  '叶段英',
  '慕海棠',
  '颂长风',
  '印唯心',
  '妖九烟',
  '阎冥',
  '冷小凝',
  '姜昭昭',
  '姜澄鸢',
  '苏酒儿',
  '潮听澜',
  '小索',
  '雪照宁',
  '云鹤',
  '祝雨晴',
  '归尘',
  '玉斫璜',
  '贰叁捌',
  '金不换',
  '地狱火',
  '铁娇娇',
  '范达克',
  '线头',
  '毛绒绒',
  '骨小宝',
  '花怜',
  '苗小青',
  '王阿牛',
  '幽魂子',
  '杜子成',
  '贾道学',
  '苟活',
  '太白',
  '常笑',
  '挽歌',
  '张铁柱',
  '丹心火',
  '拂袖',
  '花非花',
  '剑不语',
  '蓝甜药',
  '林雪鹿',
  '沙知返',
  '乌滴墨',
  '休别离',
  '依依兮',
  '袁分罡',
  '运蔚',
  '沧无涯',
  '贝三娘',
  '陆潮生',
  '慕泽',
  '裴不归',
  '师长夷',
  '银摇枝',
  '凌长霜',
  '白炉生',
  '宋听雪',
  '红',
];

const CANGXUAN_ALL_ENTRY_NAMES = [
  '====核心规则====_开始',
  '世界观总览',
  '世界引擎',
  '故事基调',
  '对话格式硬性规则',
  '====核心规则====_结束',
  '====角色设定====_开始',
  '江念',
  '沈慕微',
  '欧阳诚',
  '谢忘生',
  '萧天衍',
  '药芷若',
  '叶段英',
  '慕海棠',
  '颂长风',
  '印唯心',
  '妖九烟',
  '阎冥',
  '冷小凝',
  '姜昭昭',
  '姜澄鸢',
  '苏酒儿',
  '红',
  '潮听澜',
  '小索',
  '雪照宁',
  'USER档案',
  '====角色设定====_结束',
  '====世界观====_开始 [mvu_plot]',
  '====世界基础规则====_开始 [mvu_plot]',
  '苍玄界全域地图与距离',
  '传送阵开销与购买力',
  '战力体系规则',
  '剑临城',
  '天剑宗',
  '小寒山·月微居',
  '后山试验药田',
  '清平镇',
  '玄清宗',
  '云鹤',
  '祝雨晴',
  '归尘',
  '经济体系规则',
  '落星坊市',
  '太虚观',
  '玉斫璜',
  '百草城',
  '丹霞谷',
  '贰叁捌',
  '金不换',
  '地狱火',
  '铁骨城',
  '铁娇娇',
  '万器山',
  '潮音港',
  '东海海域',
  '范达克',
  '归墟潮眼',
  '鲛珠礁市',
  '迷阵海市',
  '线头',
  '阵道阁',
  '百兽镇',
  '毛绒绒',
  '御兽宗',
  '万兽堂',
  '育兽塔',
  '百兽斗场',
  '化妖池',
  '====世界基础规则====_结束 [mvu_plot]',
  '骨小宝',
  '花怜',
  '枯骨集市',
  '苗小青',
  '魔道六门',
  '血煞门',
  '合欢宗',
  '炼尸宗',
  '万魂谷',
  '五毒教',
  '极乐阁',
  '王阿牛',
  '幽魂子',
  '====地标势力与常驻人物====_开始 [mvu_plot]',
  '杜子成',
  '贾道学',
  '散修联盟',
  '边界走私营地',
  '苟活',
  '太白',
  '妖族',
  '万妖王庭',
  '化形雷池',
  '先祖祭坛',
  '万兽集市',
  '半阴客栈',
  '常笑',
  '承安皇朝',
  '鬼域',
  '听风楼',
  '挽歌',
  '张铁柱',
  '丹心火',
  '拂袖',
  '花非花',
  '剑不语',
  '蓝甜药',
  '林雪鹿',
  '沙知返',
  '乌滴墨',
  '休别离',
  '依依兮',
  '袁分罡',
  '运蔚',
  '桃李书院',
  '修真界节日',
  '祖师祠堂',
  '沧溟海阙',
  '沧无涯',
  '贝三娘',
  '陆潮生',
  '星罗阵市',
  '慕泽',
  '====世界观====_结束 [mvu_plot]',
  '裴不归',
  '师长夷',
  '赤铃沙海',
  '百蛊绿洲',
  '银摇枝',
  '鸣沙驿',
  '赤沙禁域',
  '====特殊规则设定====_开始 [mvu_plot]',
  '交互事件美化输出规则',
  '秘境生成规则',
  'NPC交互规则',
  '====特殊规则设定====_结束 [mvu_plot]',
  '冰原雪域',
  '凌长霜',
  '玄霜宫',
  '白炉生',
  '风雪堂',
  '寒渊冰市',
  '宋听雪',
  '白夜裂谷',
  '====地标势力与常驻人物====_结束 [mvu_plot]',
  '====节日系统====_开始 [mvu_plot]',
  '====节日系统====_结束 [mvu_plot]',
  '====CG系统====_开始 [mvu_plot]',
  '[mvu_plot]插画强调',
  '[mvu_plot]沈慕微CG触发',
  '[mvu_plot]江念CG触发',
  '[mvu_plot]冷小凝CG触发',
  '[mvu_plot]姜昭昭CG触发',
  '[mvu_plot]姜澄鸢CG触发',
  '[mvu_plot]苏酒儿CG触发',
  '[mvu_plot]妖九烟CG触发',
  '[mvu_plot]慕海棠CG触发',
  '[mvu_plot]印唯心CG触发',
  '[mvu_plot]药芷若CG触发',
  '[mvu_plot]红CG触发',
  '[mvu_plot]潮听澜CG触发',
  '[mvu_plot]雪照宁CG触发',
  '====CG系统====_结束 [mvu_plot]',
  '====变量设定====_开始',
  '[mvu_update]变量更新规则',
  '[mvu_update]变量输出格式',
  '变量列表',
  '好感度驱动法则',
  '====变量设定====_结束',
];

const CANGXUAN_ALWAYS_NAME_LIST = [
  '====核心规则====_开始',
  '世界观总览',
  '世界引擎',
  '故事基调',
  '对话格式硬性规则',
  '====核心规则====_结束',
  '====角色设定====_开始',
  '====角色设定====_结束',
  '====世界观====_开始 [mvu_plot]',
  '====世界基础规则====_开始 [mvu_plot]',
  '苍玄界全域地图与距离',
  '传送阵开销与购买力',
  '战力体系规则',
  '经济体系规则',
  '====世界基础规则====_结束 [mvu_plot]',
  '====地标势力与常驻人物====_开始 [mvu_plot]',
  '====世界观====_结束 [mvu_plot]',
  '====特殊规则设定====_开始 [mvu_plot]',
  '交互事件美化输出规则',
  '====特殊规则设定====_结束 [mvu_plot]',
  '====地标势力与常驻人物====_结束 [mvu_plot]',
  '====节日系统====_开始 [mvu_plot]',
  '====节日系统====_结束 [mvu_plot]',
  '秘境生成规则',
  'NPC交互规则',
  '====CG系统====_开始 [mvu_plot]',
  '[mvu_plot]插画强调',
  '====CG系统====_结束 [mvu_plot]',
  '====变量设定====_开始',
  '[mvu_update]变量更新规则',
  '[mvu_update]变量输出格式',
  '变量列表',
  '好感度驱动法则',
  '====变量设定====_结束',
];

export const CANGXUAN_DEFAULT_ALWAYS_NAMES = CANGXUAN_ALWAYS_NAME_LIST.join('\n');

export const CANGXUAN_DEFAULT_SCHEDULED_NAMES = CANGXUAN_ALL_ENTRY_NAMES
  .filter(name => !CANGXUAN_ALWAYS_NAME_LIST.includes(name))
  .join('\n');

const ALWAYS_HINTS = [
  '苍玄界',
  '世界观',
  '世界引擎',
  '故事基调',
  '对话格式',
  '战力体系',
  '经济体系',
  '变量',
  'MVU',
  '状态栏',
  '输出格式',
  '好感度',
  '秘境生成',
  '交互事件',
  '插画',
  'CG',
];

const SCHEDULE_HINTS = [
  '宗',
  '观',
  '谷',
  '山',
  '城',
  '镇',
  '坊市',
  '海',
  '沙海',
  '雪域',
  '鬼域',
  '妖族',
  '书院',
  '皇朝',
  '联盟',
  '客栈',
  '集市',
  '秘境',
  '道友',
  'NPC',
  'CG',
];

const BLOCKED_ENTRY_NAME_PATTERNS = [
  /\[initvar\]/i,
  /变量初始化勿开/,
];

const CODE_LIKE_TEXT_PATTERNS = [
  /\b(?:string|number|boolean|unknown|any)\)\s*:\s*\{/i,
  /\b(?:string|number|boolean|unknown|any)\]\s*:\s*\{/i,
  /\[[^\]\n]{1,80}:\s*(?:string|number|boolean|unknown|any)\]/i,
  /^\s*[A-Za-z_$][\w$]*\s*:\s*(?:string|number|boolean|unknown|any|Record|Array)\b/,
  /\b(?:interface|type|function|const|let|var)\s+[A-Za-z_$]/,
  /=>/,
  /[{};]/,
];

const ACTION_RULE_ENTRY_NAMES: Record<string, string[]> = {
  '修炼/突破': ['战力体系规则'],
  '战斗/切磋': ['战力体系规则', '交互事件美化输出规则'],
  '交易/拍卖': ['经济体系规则', '传送阵开销与购买力'],
  '秘境/探索': ['秘境生成规则', '苍玄界全域地图与距离'],
  '道友/好感': ['NPC交互规则', '好感度驱动法则'],
  '飞剑传书': ['交互事件美化输出规则'],
  'CG/插图': ['[mvu_plot]插画强调'],
  '悬赏/任务': ['交互事件美化输出规则'],
  '地图/移动': ['苍玄界全域地图与距离', '传送阵开销与购买力'],
  '宗门/势力': [],
};

const ACTION_TYPE_RULES: Array<{ label: string; patterns: RegExp[] }> = [
  { label: '修炼/突破', patterns: [/修炼|突破|境界|筑基|金丹|元婴|化神|渡劫|灵气|功法|瓶颈|闭关|指点/] },
  { label: '战斗/切磋', patterns: [/战斗|切磋|斗法|出手|剑招|法术|攻击|防御|受伤|妖兽|魔修|追杀|伏击/] },
  { label: '交易/拍卖', patterns: [/交易|购买|出售|灵石|拍卖|坊市|摊位|买下|卖掉|报价|传送阵|开销/] },
  { label: '秘境/探索', patterns: [/秘境|遗迹|禁地|探索|寻宝|机缘|洞府|试炼|入境|阵眼|封印/] },
  { label: '道友/好感', patterns: [/道友|收录|好感|关系|结识|交谈|问候|同行|约定|承诺|误会|亲近/] },
  { label: '飞剑传书', patterns: [/飞剑|传书|回信|书信|来信|寄信|传讯|讯息/] },
  { label: 'CG/插图', patterns: [/插图|CG|立绘|画面|相册|触发|特写/] },
  { label: '悬赏/任务', patterns: [/悬赏|赏令|委托|任务|接取|完成|交付|报酬|榜单/] },
  { label: '地图/移动', patterns: [/地点|地图|前往|赶路|传送|路线|距离|山门|城门|港口|驿站|边界/] },
  { label: '宗门/势力', patterns: [/宗门|势力|长老|弟子|掌门|皇朝|书院|联盟|妖族|鬼域|魔道/] },
];

const WEAK_CONTEXT_KEYS = new Set([
  '丹炉',
  '炼丹',
  '炼药',
  '药材',
  '丹药',
  '修炼',
  '修为',
  '境界',
  '灵石',
  '钱包',
  '地点',
  '地图',
  '位置',
  '路线',
  '距离',
  '传送',
  '交易',
  '拍卖',
  '任务',
  '悬赏',
  '道友',
  '好感',
  '关系',
]);

const NPC_CONTEXTUAL_KEY_ALIASES: Record<string, string[]> = {
  贰叁捌: ['试药'],
};

function uniq(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => !!value && value.trim().length > 0).map(value => value.trim()))];
}

export function splitConfiguredNames(textOrList: string | string[] | undefined | null): string[] {
  if (Array.isArray(textOrList)) return uniq(textOrList);
  if (!textOrList) return [];
  return uniq(String(textOrList).split(/[\n,，、]+/));
}

const CANGXUAN_FORCED_ALWAYS_NAME_SET = new Set(splitConfiguredNames(CANGXUAN_DEFAULT_ALWAYS_NAMES));
const CANGXUAN_FORCED_ALWAYS_NAME_PATTERNS = [
  /^====[^=\n]+====_(?:开始|结束)(?:\s+\[mvu_plot\])?$/,
  /^\[mvu_update\]/,
  /^世界观总览$/,
  /^世界引擎$/,
  /^故事基调$/,
  /^对话格式硬性规则$/,
  /^苍玄界全域地图与距离$/,
  /^传送阵开销与购买力$/,
  /^战力体系规则$/,
  /^经济体系规则$/,
  /^交互事件美化输出规则$/,
  /^秘境生成规则$/,
  /^NPC交互规则$/,
  /^变量列表$/,
  /^好感度驱动法则$/,
  /^\[mvu_plot\]插画强调$/,
];

function isBlockedEntryName(name: string): boolean {
  return BLOCKED_ENTRY_NAME_PATTERNS.some(pattern => pattern.test(name)) || looksLikeCodeText(name);
}

function isStructuralBoundaryEntryName(name: string): boolean {
  return /^====[^=\n]+====_(?:开始|结束)(?:\s+\[mvu_plot\])?$/.test(name.trim());
}

function looksLikeCodeText(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  if (/^(?:string|number|boolean|unknown|any|object|array|record)$/i.test(text)) return true;
  if (text.length > 80 && /^[A-Za-z0-9_$:[\]{}()<>,.\s|&?;=-]+$/.test(text)) return true;
  return CODE_LIKE_TEXT_PATTERNS.some(pattern => pattern.test(text));
}

function isUsableTriggerText(value: string): boolean {
  const text = value.trim();
  if (!text || text.length > 64 || /[\r\n]/.test(text)) return false;
  return !looksLikeCodeText(text);
}

function cleanEntryNameCandidate(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim();
  if (!isUsableTriggerText(text)) return null;
  return text;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(num)));
}

function removeBlockedConfiguredNames(names: string[]): string[] {
  return names.filter(name => !isBlockedEntryName(name));
}

function isForcedAlwaysName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (CANGXUAN_FORCED_ALWAYS_NAME_SET.has(trimmed)) return true;
  return CANGXUAN_FORCED_ALWAYS_NAME_PATTERNS.some(pattern => pattern.test(trimmed));
}

function mergeSchedulerNames(...groups: string[][]): string[] {
  return removeBlockedConfiguredNames(uniq(groups.flat()));
}

function removeForcedAlwaysNames(names: string[]): string[] {
  return names.filter(name => !isForcedAlwaysName(name));
}

export function buildCangxuanSchedulerConfig(settings: any): CangxuanWorldbookSchedulerConfig {
  const alwaysNames = removeBlockedConfiguredNames(splitConfiguredNames(settings?.cangxuanWorldbookAlwaysNames));
  const scheduledNames = removeBlockedConfiguredNames(splitConfiguredNames(settings?.cangxuanWorldbookScheduledNames));
  const keepEnabledNames = removeBlockedConfiguredNames(splitConfiguredNames(settings?.cangxuanWorldbookKeepEnabledNames));
  const shouldUseDefaults = alwaysNames.length === 0 && scheduledNames.length === 0 && keepEnabledNames.length === 0;
  const forcedAlwaysNames = removeBlockedConfiguredNames([...CANGXUAN_FORCED_ALWAYS_NAME_SET]);
  const configuredAlwaysNames = shouldUseDefaults
    ? removeBlockedConfiguredNames(splitConfiguredNames(CANGXUAN_DEFAULT_ALWAYS_NAMES))
    : alwaysNames;
  const configuredScheduledNames = shouldUseDefaults
    ? removeBlockedConfiguredNames(splitConfiguredNames(CANGXUAN_DEFAULT_SCHEDULED_NAMES))
    : scheduledNames;

  return {
    alwaysNames: mergeSchedulerNames(forcedAlwaysNames, configuredAlwaysNames),
    scheduledNames: removeBlockedConfiguredNames(removeForcedAlwaysNames(configuredScheduledNames)),
    keepEnabledNames: removeBlockedConfiguredNames(removeForcedAlwaysNames(keepEnabledNames)),
    maxEntries: clampNumber(settings?.cangxuanWorldbookMaxEntries, 18, 4, 30),
    maxChars: clampNumber(settings?.cangxuanWorldbookMaxChars, 14000, 3000, 24000),
  };
}

function entryName(entry: any): string {
  const rawKey = entry?.key ?? entry?.keys ?? entry?.strategy?.keys;
  const keys = normalizeKeys(rawKey);
  return cleanEntryNameCandidate(entry?.comment)
    || cleanEntryNameCandidate(entry?.name)
    || keys.map(cleanEntryNameCandidate).find((name): name is string => Boolean(name))
    || `未命名条目${entry?.uid ?? ''}`;
}

function normalizeKeys(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(item => normalizeKeys(item));
  if (value instanceof RegExp) return [value.source];
  return String(value)
    .split(/[,，、]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function normalizeEnabled(entry: any): boolean {
  if (typeof entry?.enabled === 'boolean') return entry.enabled;
  if (typeof entry?.disable === 'boolean') return !entry.disable;
  return true;
}

function comparableName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s"'“”‘’《》〈〉【】[\]()（）{}<>·・.。,:：;；,，、/\\|_\-—–]/g, '')
    .trim();
}

function inferNpcDisplayName(name: string, content: string, keys: string[]): { displayName: string; aliases: string[]; isNpc: boolean } {
  const contentName = content.match(/(?:姓名|角色名|道号|称呼)[:：]\s*([^\n，,。；;]{1,20})/)?.[1]?.trim();
  const usefulKeys = keys.filter(isUsableTriggerText);
  const keyName = usefulKeys.find(key => key.length >= 2 && key.length <= 16);
  const exactCharacter = CANGXUAN_CHARACTER_NAMES.includes(name) || CANGXUAN_CHARACTER_NAMES.includes(keyName || '');
  const looksLikeNpc = /身份|性格|修为|境界|口吻|台词|好感|道友|NPC|主要人物|立绘|头像/.test(content.slice(0, 1000));
  const isNpc = exactCharacter || Boolean(contentName) || (/^[\u4e00-\u9fff]{1,4}$/.test(name) && looksLikeNpc);
  const displayName = isNpc ? (contentName || keyName || name) : name;
  return {
    displayName,
    aliases: uniq([displayName, contentName, keyName, name, ...usefulKeys, ...nameFragments(name)]),
    isNpc,
  };
}

function nameFragments(name: string): string[] {
  return name
    .split(/[·•\-—_：:（）()[\]【】\s]+/)
    .map(item => item.trim())
    .filter(item => item.length >= 2 && /[\u4e00-\u9fff]/.test(item));
}

function entryMatchesConfiguredName(name: string, entry: Pick<CangxuanWorldbookEntryRef, 'name' | 'displayName' | 'aliases' | 'isNpc'>): boolean {
  const rawName = name.trim();
  if (!rawName) return false;
  const normalizedName = comparableName(rawName);
  if (!normalizedName) return false;
  const identityNames = uniq([entry.name, entry.displayName]);
  if (identityNames.some(identity => identity === rawName || comparableName(identity) === normalizedName)) return true;
  if (entry.aliases.some(alias => comparableName(alias) === normalizedName)) return true;
  const normalizedDisplayName = comparableName(entry.displayName || entry.name);
  return entry.isNpc && normalizedDisplayName.length >= 2 && normalizedName.includes(normalizedDisplayName);
}

function entryHasConfiguredAlias(name: string, entry: Pick<CangxuanWorldbookEntryRef, 'aliases'>): boolean {
  const rawName = name.trim();
  if (!rawName) return false;
  if (entry.aliases.some(alias => alias === rawName)) return true;
  const normalizedName = comparableName(rawName);
  if (!normalizedName) return false;
  return entry.aliases.some(alias => comparableName(alias) === normalizedName);
}

function configuredNameIndex(names: string[], entry: Pick<CangxuanWorldbookEntryRef, 'name' | 'displayName' | 'aliases' | 'isNpc'>): number {
  return names.findIndex(name => entryMatchesConfiguredName(name, entry));
}

function configuredNamesIncludeEntry(names: string[], entry: CangxuanWorldbookEntryRef): boolean {
  return configuredNameIndex(names, entry) !== -1;
}

function normalizeEntry(raw: any, worldbookName: string, sectionPath: string[] = []): CangxuanWorldbookEntryRef {
  const name = entryName(raw);
  const strategy = raw?.strategy || {};
  const position = raw?.position || {};
  const keys = normalizeKeys(strategy.keys ?? raw?.key ?? raw?.keys).filter(isUsableTriggerText);
  const secondaryKeys = normalizeKeys(strategy.keys_secondary?.keys ?? raw?.keysecondary).filter(isUsableTriggerText);
  const content = typeof raw?.content === 'string' ? raw.content : String(raw?.content || '');
  const display = inferNpcDisplayName(name, content, keys);
  return {
    id: `${worldbookName}#${Number(raw?.uid ?? 0)}#${name}`,
    worldbookName,
    uid: Number(raw?.uid ?? 0),
    name,
    displayName: display.displayName,
    aliases: display.aliases,
    isNpc: display.isNpc,
    enabled: normalizeEnabled(raw),
    strategyType: String(strategy.type || (raw?.constant ? 'constant' : raw?.selective ? 'selective' : 'unknown')),
    keys,
    secondaryKeys,
    sectionPath,
    positionType: String(position.type || raw?.position || 'unknown'),
    depth: typeof position.depth === 'number' ? position.depth : typeof raw?.depth === 'number' ? raw.depth : null,
    order: Number(position.order ?? raw?.order ?? 0),
    role: String(position.role || raw?.role || 'system'),
    content,
    contentLength: content.length,
    category: 'unused_candidate',
    reasons: [],
  };
}

function getBoundaryMarker(name: string): { section: string; kind: '开始' | '结束' } | null {
  const match = name.trim().match(/^====([^=\n]+)====_(开始|结束)(?:\s+\[mvu_plot\])?$/);
  if (!match) return null;
  return { section: match[1], kind: match[2] as '开始' | '结束' };
}

function classifyEntry(entry: CangxuanWorldbookEntryRef, config: CangxuanWorldbookSchedulerConfig): CangxuanWorldbookEntryRef {
  if (isBlockedEntryName(entry.name)) {
    return { ...entry, category: 'unused_candidate', reasons: ['无效或变量初始化条目保持禁用'] };
  }

  const exactAlways = configuredNamesIncludeEntry(config.alwaysNames, entry);
  const exactScheduled = configuredNamesIncludeEntry(config.scheduledNames, entry);
  const exactKeep = configuredNamesIncludeEntry(config.keepEnabledNames, entry);
  const forcedAlways = isForcedAlwaysName(entry.name);
  const haystack = `${entry.name}\n${entry.displayName}\n${entry.aliases.join('\n')}\n${entry.keys.join('\n')}\n${entry.secondaryKeys.join('\n')}\n${entry.content.slice(0, 800)}`;
  const reasons: string[] = [];
  let category: CangxuanWorldbookCategory = 'unused_candidate';

  if (forcedAlways || exactAlways || exactKeep) {
    category = 'always';
    reasons.push(forcedAlways ? '苍玄界规则/结构条目强制常驻' : exactAlways ? '命中常驻条目名清单' : '命中保留启用清单');
  } else if (exactScheduled) {
    category = 'scheduled';
    reasons.push('命中苍玄界调度条目名清单');
  } else if (ALWAYS_HINTS.some(hint => haystack.includes(hint))) {
    category = 'suggested_always';
    reasons.push('名称/内容包含常驻底座候选词');
  } else if (SCHEDULE_HINTS.some(hint => haystack.includes(hint))) {
    category = 'suggested_scheduled';
    reasons.push('名称/内容包含地点、NPC、势力或事件候选词');
  } else {
    reasons.push('未命中苍玄界调度规则，建议保持关闭候选');
  }

  return { ...entry, category, reasons };
}

function findDuplicates(entries: CangxuanWorldbookEntryRef[]): CangxuanWorldbookDuplicate[] {
  const byName = new Map<string, CangxuanWorldbookEntryRef[]>();
  for (const entry of entries) {
    const list = byName.get(entry.name) || [];
    list.push(entry);
    byName.set(entry.name, list);
  }
  return [...byName.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([name, list]) => ({
      name,
      entries: list.map(entry => ({ worldbookName: entry.worldbookName, uid: entry.uid, enabled: entry.enabled })),
    }));
}

function countCategories(entries: CangxuanWorldbookEntryRef[], bindings: CangxuanWorldbookBindingReport): CangxuanWorldbookScan['counts'] {
  return {
    books: bindings.scanned.length,
    entries: entries.length,
    enabled: entries.filter(entry => entry.enabled).length,
    always: entries.filter(entry => entry.category === 'always').length,
    scheduled: entries.filter(entry => entry.category === 'scheduled').length,
    suggestedAlways: entries.filter(entry => entry.category === 'suggested_always').length,
    suggestedScheduled: entries.filter(entry => entry.category === 'suggested_scheduled').length,
    unusedCandidate: entries.filter(entry => entry.category === 'unused_candidate').length,
  };
}

async function getBoundWorldbookNames(): Promise<CangxuanWorldbookBindingReport> {
  const api = globalThis as any;
  const global = typeof api.getGlobalWorldbookNames === 'function' ? await Promise.resolve(api.getGlobalWorldbookNames() as string[]) : [];
  const char = typeof api.getCharWorldbookNames === 'function'
    ? await Promise.resolve(api.getCharWorldbookNames('current') as { primary?: string | null; additional?: string[] })
    : { primary: null, additional: [] };
  const chat = typeof api.getChatWorldbookName === 'function' ? await Promise.resolve(api.getChatWorldbookName('current') as string | null) : null;
  const loadedFallback = typeof api.getWorldbookNames === 'function' ? await Promise.resolve(api.getWorldbookNames() as string[]) : [];
  const bound = uniq([
    ...(global || []),
    char?.primary || null,
    ...(char?.additional || []),
    chat,
  ]);
  return {
    global: global || [],
    characterPrimary: char?.primary || null,
    characterAdditional: char?.additional || [],
    chat,
    loaded: loadedFallback || [],
    scanned: bound.length > 0 ? bound : (loadedFallback || []),
  };
}

export async function scanCangxuanWorldbooks(config: CangxuanWorldbookSchedulerConfig): Promise<CangxuanWorldbookScan> {
  const bindings = await getBoundWorldbookNames();
  const api = globalThis as any;
  const entries: CangxuanWorldbookEntryRef[] = [];
  if (typeof api.getWorldbook !== 'function') {
    throw new Error('当前环境没有 getWorldbook 接口，无法扫描世界书');
  }

  for (const worldbookName of bindings.scanned) {
    try {
      const worldbook = await Promise.resolve(api.getWorldbook(worldbookName) as any[]);
      const sectionStack: string[] = [];
      for (const rawEntry of worldbook || []) {
        const normalized = normalizeEntry(rawEntry, worldbookName, [...sectionStack]);
        entries.push(classifyEntry(normalized, config));
        const marker = getBoundaryMarker(normalized.name);
        if (marker?.kind === '开始') {
          sectionStack.push(marker.section);
        } else if (marker?.kind === '结束') {
          const index = sectionStack.lastIndexOf(marker.section);
          if (index !== -1) sectionStack.splice(index, 1);
        }
      }
    } catch (error) {
      console.warn(`[智脑-苍玄界] 扫描世界书失败: ${worldbookName}`, error);
    }
  }

  return {
    scannedAt: new Date().toISOString(),
    bindings,
    entries,
    duplicates: findDuplicates(entries),
    missingAlwaysNames: config.alwaysNames.filter(name => !entries.some(entry => entryMatchesConfiguredName(name, entry) || entryHasConfiguredAlias(name, entry))),
    missingScheduledNames: config.scheduledNames.filter(name => !entries.some(entry => entryMatchesConfiguredName(name, entry) || entryHasConfiguredAlias(name, entry))),
    counts: countCategories(entries, bindings),
  };
}

function lowerText(text: string): string {
  return text.toLowerCase();
}

function detectActionTypes(text: string): string[] {
  return ACTION_TYPE_RULES
    .filter(rule => rule.patterns.some(pattern => pattern.test(text)))
    .map(rule => rule.label);
}

function sceneContainsName(sceneText: string, name: string): boolean {
  const normalizedScene = comparableName(sceneText);
  const normalizedName = comparableName(name);
  if (!normalizedName || normalizedName.length < 2) return false;
  if (normalizedScene.includes(normalizedName)) return true;
  return nameFragments(name)
    .map(comparableName)
    .filter(fragment => fragment.length >= 2)
    .some(fragment => normalizedScene.includes(fragment));
}

function entrySceneHit(entry: CangxuanWorldbookEntryRef, sceneText: string): string | undefined {
  const keySet = new Set([...entry.keys, ...entry.secondaryKeys]);
  const contextualAliases = Object.entries(NPC_CONTEXTUAL_KEY_ALIASES)
    .filter(([name]) => entryMatchesConfiguredName(name, entry))
    .flatMap(([, aliases]) => aliases)
    .filter(alias => keySet.has(alias));
  const aliases = uniq([entry.name, entry.displayName, ...entry.aliases.filter(alias => !keySet.has(alias)), ...contextualAliases]);
  return aliases.find(alias => alias.length >= 2 && sceneContainsName(sceneText, alias));
}

function entryMatchesActionType(entry: CangxuanWorldbookEntryRef, actionType: string): boolean {
  const names = ACTION_RULE_ENTRY_NAMES[actionType] || [];
  if (names.length === 0) return false;
  return names.some(name => entryMatchesConfiguredName(name, entry));
}

function usefulKeyHit(entry: CangxuanWorldbookEntryRef, sceneText: string): string | undefined {
  const lower = lowerText(sceneText);
  return [...entry.keys, ...entry.secondaryKeys].find(key => {
    const normalizedKey = comparableName(key);
    if (normalizedKey.length < 2) return false;
    if (WEAK_CONTEXT_KEYS.has(key.trim()) || WEAK_CONTEXT_KEYS.has(normalizedKey)) return false;
    return lower.includes(key.toLowerCase()) || sceneContainsName(sceneText, key);
  });
}

function extractActionEvidence(sceneText: string): string {
  const userMatch = sceneText.match(/<user_input>([\s\S]*?)<\/user_input>/);
  if (userMatch) return userMatch[1];
  const mvuStart = sceneText.indexOf('<mvu_scene_signal>');
  const withoutMvu = mvuStart === -1 ? sceneText : sceneText.slice(0, mvuStart);
  return withoutMvu
    .split('\n')
    .filter(line => !/^summary\//.test(line.trim()))
    .join('\n');
}

function isCgEntry(entry: CangxuanWorldbookEntryRef): boolean {
  return /^\[mvu_plot\].*CG触发$/.test(entry.name) || /CG系统|CG触发|插画强调/.test(entry.name);
}

function sceneExplicitlyRequestsCg(sceneText: string): boolean {
  return /<插图>|<\/插图>|插图标签|输出插图|触发CG|CG触发|相册解锁/.test(sceneText);
}

function scoreEntry(entry: CangxuanWorldbookEntryRef, sceneText: string, config: CangxuanWorldbookSchedulerConfig): { score: number; reason: string } {
  if (isBlockedEntryName(entry.name)) return { score: 0, reason: '无效或变量初始化条目保持禁用' };
  if (isStructuralBoundaryEntryName(entry.name)) return { score: 0, reason: '结构分段条目不进入本轮注入' };
  if (isCgEntry(entry) && !sceneExplicitlyRequestsCg(sceneText)) {
    return { score: 0, reason: 'CG条目仅在明确插图/CG请求时调度' };
  }

  const scheduledIndex = configuredNameIndex(config.scheduledNames, entry);
  const inScheduledLibrary = scheduledIndex !== -1;
  const inAlwaysLibrary = configuredNamesIncludeEntry(config.alwaysNames, entry);
  const keepOnly = configuredNamesIncludeEntry(config.keepEnabledNames, entry) && !inScheduledLibrary;
  const actionText = extractActionEvidence(sceneText);
  const actionHit = detectActionTypes(actionText).find(actionType => entryMatchesActionType(entry, actionType));
  const aliasHit = entrySceneHit(entry, sceneText);
  const keyHit = usefulKeyHit(entry, sceneText);

  if (aliasHit) {
    const base = inScheduledLibrary ? 1200 : inAlwaysLibrary ? 760 : 820;
    const scheduledBonus = inScheduledLibrary ? Math.max(80, 220 - scheduledIndex * 4) : 0;
    const npcBonus = entry.isNpc ? 120 : 0;
    return { score: base + scheduledBonus + npcBonus, reason: `场景命中名称/别名: ${aliasHit}` };
  }

  if (entry.isNpc) {
    return { score: 0, reason: 'NPC条目必须由当前场景直接点名触发' };
  }

  if (keyHit) {
    const base = inScheduledLibrary ? 900 : inAlwaysLibrary ? 620 : 700;
    return { score: base, reason: `场景命中关键字: ${keyHit}` };
  }

  if (actionHit) {
    const base = inScheduledLibrary ? 760 : inAlwaysLibrary ? 680 : keepOnly ? 620 : 520;
    return { score: base, reason: `行动类型触发关联规则: ${actionHit}` };
  }

  if (inAlwaysLibrary) {
    return { score: 0, reason: '常驻底座未被本轮场景直接触发，跳过重复注入' };
  }
  if (config.scheduledNames.length > 0 && !inScheduledLibrary) {
    return { score: 0, reason: '不在苍玄界调度准入库' };
  }
  return { score: 0, reason: '未命中调度证据' };
}

function extractNameHits(entries: CangxuanWorldbookEntryRef[], text: string): string[] {
  return entries
    .filter(entry => Boolean(entrySceneHit(entry, text)))
    .map(entry => entry.displayName)
    .slice(0, 16);
}

export function buildCangxuanWorldbookInjection(
  scan: CangxuanWorldbookScan | null | undefined,
  sceneText: string,
  config: CangxuanWorldbookSchedulerConfig,
): { content: string; report: CangxuanWorldbookInjectionReport } | null {
  if (!scan || scan.entries.length === 0) return null;

  const scheduledOrder = (entry: CangxuanWorldbookEntryRef) => {
    const index = configuredNameIndex(config.scheduledNames, entry);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  const scored = scan.entries
    .map(entry => ({ entry, ...scoreEntry(entry, sceneText, config) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || scheduledOrder(a.entry) - scheduledOrder(b.entry) || b.entry.contentLength - a.entry.contentLength);

  const selected: typeof scored = [];
  const selectedDisplayNames = new Set<string>();
  let usedChars = 0;
  let usedNpcEntries = 0;
  const maxNpcEntries = Math.min(6, config.maxEntries);
  for (const item of scored) {
    if (selected.length >= config.maxEntries) break;
    if (item.entry.isNpc && usedNpcEntries >= maxNpcEntries) continue;
    const displayKey = comparableName(item.entry.displayName);
    if (displayKey && selectedDisplayNames.has(displayKey)) continue;
    const nextLen = Math.min(item.entry.contentLength, config.maxChars);
    if (usedChars > 0 && usedChars + nextLen > config.maxChars) continue;
    selected.push(item);
    if (displayKey) selectedDisplayNames.add(displayKey);
    if (item.entry.isNpc) usedNpcEntries += 1;
    usedChars += nextLen;
  }
  if (selected.length === 0) return null;

  const warnings: string[] = [];
  if (scan.duplicates.length > 0) warnings.push(`存在${scan.duplicates.length}组重名世界书条目`);
  if (scan.missingAlwaysNames.length > 0) warnings.push(`常驻清单缺失: ${scan.missingAlwaysNames.slice(0, 16).join('、')}`);
  if (scan.missingScheduledNames.length > 0) warnings.push(`调度清单缺失: ${scan.missingScheduledNames.slice(0, 16).join('、')}`);

  const parts: string[] = [];
  parts.push('<cangxuan_brain_context>');
  parts.push(`<调度时间>${new Date().toISOString()}</调度时间>`);
  parts.push(`<调度条目>${selected.map(item => item.entry.displayName).join('、')}</调度条目>`);
  parts.push('<strict_reminders>');
  parts.push('- 正文角色发言必须使用【角色名】：“台词”。');
  parts.push('- 道友收录必须来自首次正式同场互动，传闻和公告不能当作结识。');
  parts.push('- 境界、灵石、好感、道具、CG、赏令变化必须服从变量更新规则和世界书规则。');
  parts.push('- 未命中合法 CG 候选时不要输出插图标签。');
  parts.push('</strict_reminders>');
  parts.push('<worldbook_hits>');
  const grouped: Array<{ section: string; items: typeof selected }> = [];
  for (const item of selected) {
    const section = item.entry.sectionPath.join(' / ') || '未归组条目';
    let group = grouped.find(group => group.section === section);
    if (!group) {
      group = { section, items: [] };
      grouped.push(group);
    }
    group.items.push(item);
  }
  for (const group of grouped) {
    parts.push(`<worldbook_section path="${escapeXml(group.section)}">`);
    for (const item of group.items) {
      const entry = item.entry;
      const attrs = [
        `name="${escapeXml(entry.name)}"`,
        `display_name="${escapeXml(entry.displayName)}"`,
        `source="${escapeXml(entry.worldbookName)}"`,
        `uid="${entry.uid}"`,
        `reason="${escapeXml(item.reason)}"`,
      ];
      if (entry.isNpc) attrs.push(`aliases="${escapeXml(entry.aliases.join('、'))}"`);
      parts.push(`<worldbook_entry ${attrs.join(' ')}>`);
      if (entry.isNpc && entry.displayName !== entry.name) {
        parts.push(`角色显示名: ${entry.displayName}`);
        parts.push(`条目名: ${entry.name}`);
        parts.push(`写作约束: 正文发言使用【${entry.displayName}】：“台词”。`);
        parts.push('');
      }
      const remaining = Math.max(500, config.maxChars - parts.join('\n').length);
      parts.push(entry.content.slice(0, remaining));
      parts.push('</worldbook_entry>');
    }
    parts.push('</worldbook_section>');
  }
  parts.push('</worldbook_hits>');
  parts.push('</cangxuan_brain_context>');

  const content = parts.join('\n').trim();
  const report: CangxuanWorldbookInjectionReport = {
    injectedAt: new Date().toISOString(),
    entryIds: selected.map(item => item.entry.id),
    entryNames: selected.map(item => item.entry.displayName),
    reasonById: Object.fromEntries(selected.map(item => [item.entry.id, item.reason])),
    totalChars: content.length,
    estimatedTokens: Math.ceil(content.length / 1.7),
    sceneSignals: {
      locations: extractNameHits(scan.entries.filter(entry => /城|镇|宗|山|谷|海|域|市|集|港|洲|驿|宫|堂|塔|池|禁/.test(entry.name)), sceneText),
      characters: extractNameHits(scan.entries.filter(entry => entry.isNpc), sceneText),
      actionTypes: detectActionTypes(extractActionEvidence(sceneText)),
    },
    warnings,
  };

  return { content, report };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function applyCangxuanWorldbookEnablePlan(config: CangxuanWorldbookSchedulerConfig): Promise<{
  backup: CangxuanWorldbookEnableBackup;
  changed: Array<{ worldbookName: string; uid: number; name: string; from: boolean; to: boolean }>;
}> {
  const keepConfigNames = [...config.alwaysNames, ...config.keepEnabledNames];
  if (keepConfigNames.length === 0) {
    throw new Error('常驻/保留启用清单为空，拒绝执行关闭计划，避免误关全部世界书条目');
  }

  const scan = await scanCangxuanWorldbooks(config);
  const backup: CangxuanWorldbookEnableBackup = {
    id: `cangxuan-wb-backup-${Date.now()}`,
    createdAt: new Date().toISOString(),
    entries: scan.entries.map(entry => ({
      worldbookName: entry.worldbookName,
      uid: entry.uid,
      name: entry.name,
      enabled: entry.enabled,
    })),
  };
  const changed: Array<{ worldbookName: string; uid: number; name: string; from: boolean; to: boolean }> = [];
  const byBook = new Map<string, CangxuanWorldbookEntryRef[]>();
  for (const entry of scan.entries) {
    const list = byBook.get(entry.worldbookName) || [];
    list.push(entry);
    byBook.set(entry.worldbookName, list);
  }

  const api = globalThis as any;
  if (typeof api.updateWorldbookWith !== 'function') {
    throw new Error('当前环境没有 updateWorldbookWith 接口，无法应用世界书启用计划');
  }

  for (const worldbookName of byBook.keys()) {
    await api.updateWorldbookWith(worldbookName, (worldbook: any[]) => {
      return worldbook.map(rawEntry => {
        const name = entryName(rawEntry);
        const uid = Number(rawEntry?.uid ?? 0);
        const keys = normalizeKeys(rawEntry?.strategy?.keys ?? rawEntry?.key ?? rawEntry?.keys);
        const content = typeof rawEntry?.content === 'string' ? rawEntry.content : String(rawEntry?.content || '');
        const display = inferNpcDisplayName(name, content, keys);
        const entryRef = { name, displayName: display.displayName, aliases: display.aliases, isNpc: display.isNpc } as CangxuanWorldbookEntryRef;
        const from = normalizeEnabled(rawEntry);
        const to = isForcedAlwaysName(name) || configuredNamesIncludeEntry(keepConfigNames, entryRef);
        if (from !== to) changed.push({ worldbookName, uid, name, from, to });
        return { ...rawEntry, enabled: to };
      });
    }, { render: 'debounced' });
  }

  return { backup, changed };
}

export async function restoreCangxuanWorldbookEnableBackup(backup: CangxuanWorldbookEnableBackup): Promise<number> {
  const api = globalThis as any;
  if (!backup?.entries?.length) return 0;
  if (typeof api.updateWorldbookWith !== 'function') {
    throw new Error('当前环境没有 updateWorldbookWith 接口，无法恢复世界书启用状态');
  }

  const byBook = new Map<string, Map<number, boolean>>();
  for (const item of backup.entries) {
    if (!byBook.has(item.worldbookName)) byBook.set(item.worldbookName, new Map());
    byBook.get(item.worldbookName)!.set(item.uid, item.enabled);
  }

  let restored = 0;
  for (const [worldbookName, uidMap] of byBook.entries()) {
    await api.updateWorldbookWith(worldbookName, (worldbook: any[]) => {
      return worldbook.map(rawEntry => {
        const uid = Number(rawEntry?.uid ?? 0);
        if (!uidMap.has(uid)) return rawEntry;
        const enabled = uidMap.get(uid)!;
        if (normalizeEnabled(rawEntry) !== enabled) restored++;
        return { ...rawEntry, enabled };
      });
    }, { render: 'debounced' });
  }
  return restored;
}
