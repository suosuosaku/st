export type EldredWorldbookCategory =
  | 'always'
  | 'scheduled'
  | 'suggested_always'
  | 'suggested_scheduled'
  | 'unused_candidate';

export interface EldredWorldbookSchedulerConfig {
  alwaysNames: string[];
  scheduledNames: string[];
  keepEnabledNames: string[];
  maxEntries: number;
  maxChars: number;
}

export interface EldredWorldbookBindingReport {
  global: string[];
  characterPrimary: string | null;
  characterAdditional: string[];
  chat: string | null;
  loaded: string[];
  scanned: string[];
}

export interface EldredWorldbookEntryRef {
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
  positionType: string;
  depth: number | null;
  order: number;
  role: string;
  content: string;
  contentLength: number;
  category: EldredWorldbookCategory;
  reasons: string[];
}

export interface EldredWorldbookDuplicate {
  name: string;
  entries: Array<{ worldbookName: string; uid: number; enabled: boolean }>;
}

export interface EldredWorldbookScan {
  scannedAt: string;
  bindings: EldredWorldbookBindingReport;
  entries: EldredWorldbookEntryRef[];
  duplicates: EldredWorldbookDuplicate[];
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

export interface EldredWorldbookInjectionReport {
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

export interface EldredWorldbookEnableBackup {
  id: string;
  createdAt: string;
  entries: Array<{
    worldbookName: string;
    uid: number;
    name: string;
    enabled: boolean;
  }>;
}

const ALWAYS_HINTS = [
  '艾尔德雷德',
  '世界核心',
  '核心规则',
  '世界引擎',
  '战斗裁决',
  '战斗规则',
  '技能等级',
  '装备修理',
  '正文沉浸美化',
  '变量',
  'schema',
  'Schema',
  '状态栏',
  '标签格式',
  '标签模板',
  '主线钥匙',
  '主线阶段',
  '输出格式',
  '初始化',
];

export const ELDRED_DEFAULT_ALWAYS_NAMES = [
  "====核心规则====_开始",
  "世界引擎",
  "====核心规则====_结束",
  "====角色设定====_开始",
  "====角色设定====_结束",
  "世界观总览",
  "魔法与职业",
  "====世界观====_开始 [mvu_plot]",
  "====世界基础规则====_开始 [mvu_plot]",
  "等级制度与数值判定规则",
  "战斗与职业规则",
  "技能等级与效果区间规则",
  "装备与修理",
  "区域声望",
  "气候与地脉多样性规则",
  "====世界基础规则====_结束 [mvu_plot]",
  "====地标势力与常驻人物====_开始 [mvu_plot]",
  "====地标势力与常驻人物====_结束 [mvu_plot]",
  "====主线与暗线====_开始 [mvu_plot]",
  "主线阶段触发 [mvu_plot]",
  "====主线与暗线====_结束 [mvu_plot]",
  "====特殊规则设定====_开始 [mvu_plot]",
  "敌人生成与威胁等级表",
  "装备生成与战利品规则",
  "地区委托生成规则",
  "NPC生成池与审美规则",
  "副本与秘境生成规则",
  "动态看板生成边界",
  "标签格式模板",
  "奇遇与翻牌系统规则",
  "自由探索与路径行动规则",
  "====特殊规则设定====_结束 [mvu_plot]",
  "====变量设定====_开始",
  "变量列表",
  "[mvu_update]变量更新规则",
  "[mvu_update]变量输出格式",
  "====变量设定====_结束",
  "固定NPC检索索引",
  "开局地点索引",
  "正文沉浸美化规则",
].join('\n');

export const ELDRED_DEFAULT_SCHEDULED_NAMES = [
  "绯欧菈",
  "玛洛",
  "艾米",
  "妮娅",
  "帕琪",
  "玛蒂",
  "蕾文",
  "贝琳",
  "布兰妲",
  "托兰娜",
  "萨菈",
  "奥薇",
  "茜尔七号",
  "莱恩",
  "约娜",
  "贝尔娜",
  "托比",
  "莉亚",
  "维芙",
  "露西",
  "露",
  "葛蕾娜",
  "诺拉",
  "伊薇",
  "巴丝",
  "埃利安",
  "梅莉莎",
  "罗薇",
  "佩拉",
  "小原",
  "五英雄历史",
  "龙脉",
  "行会布告板",
  "委托等级与报酬",
  "交通方式与耗时",
  "旅费与补给",
  "城门与通行文书",
  "野营与休整",
  "安全路段",
  "边境路线",
  "禁忌之地探索线",
  "海路与浮空航线",
  "食宿价格",
  "药草与治疗",
  "行会抽成与担保",
  "暗市与灰色买卖",
  "王国税费与港税",
  "各国特色货品",
  "魔物分类",
  "魔物潮阶段",
  "伤病与恢复",
  "非致命冲突",
  "首领级遭遇",
  "战斗环境互动",
  "支线收束规则",
  "节庆与日历",
  "灾厄新闻",
  "神圣王国艾琳西亚",
  "白冠王都",
  "圣骑士团总部",
  "晨曦大教堂",
  "王立档案馆",
  "白石下城区",
  "黎明城墙",
  "艾登海姆旧庭",
  "岚之领七城邦",
  "风车港城",
  "铜桥城",
  "雾药城",
  "盐鸢城",
  "蓝账城",
  "灯礁城",
  "七旗城",
  "小丘铃市",
  "折断的剑酒馆",
  "禁忌之地",
  "灰雾边缘",
  "灰雾边境营地",
  "龙鳞避誓塔",
  "瘴气洗靴棚",
  "月光苔湿地",
  "旧药师石屋",
  "断碑环",
  "五英雄旧封印地",
  "无名同行者墓地",
  "龙骨深渊外缘",
  "浮空圣都亚雷亚",
  "星环广场",
  "祈星水道",
  "白鸽廊桥",
  "沉默钟楼",
  "低层生活区",
  "记录灵小厅",
  "光辉封印塔外层",
  "霜冠王国维尔诺斯",
  "银霜王城",
  "极光修道院",
  "白狼要塞",
  "雪温泉镇",
  "冰晶矿场",
  "月鹿森林埃里林",
  "月鹿圣林",
  "唱树大厅",
  "妖精邮局",
  "星苔溪谷",
  "鹿角桥",
  "银叶边界门",
  "灰炉矮人诸城",
  "灰炉王城",
  "矿轨大站",
  "锤火工坊街",
  "熄火旧矿",
  "炉壁档案厅",
  "白帆群岛",
  "白帆港",
  "潮裔珊瑚埠",
  "断桅自由港",
  "蓝鹭灯塔",
  "沉船圣坛",
  "潮汐议事棚",
  "星砂学院邦",
  "星砂学院",
  "观星塔",
  "图书馆城",
  "学生自治街",
  "铜壳机关街",
  "召唤试验场",
  "镜塔自由市",
  "万镜塔",
  "回声市集",
  "隐私法庭",
  "镜面旅店",
  "破镜巷",
  "琉璃海诸邦",
  "琉璃港",
  "星盘灯塔",
  "香料阶梯街",
  "玻璃王庭",
  "船帆档案馆",
  "红椒佣兵王国瓦尔塔",
  "红椒斗技场",
  "佣兵大会场",
  "辣锅街",
  "赤岩哨堡",
  "力量神龛",
  "翡翠公国米拉温",
  "翡翠温室",
  "绿溪病院",
  "甜露药市",
  "花园公馆",
  "曼德拉草棚",
  "兽铃草原诸部",
  "风铃营地",
  "角羊赛道",
  "旧铃墓地",
  "星草坡",
  "长风帐",
  "黑松边寨群",
  "霜牙猎寨",
  "黑松寨门",
  "烟火哨塔",
  "边寨饭棚",
  "木栅训练场",
  "旧雪路",
  "封印衰弱主线",
  "风声阶段",
  "异象阶段",
  "接缝阶段",
  "登空阶段",
  "重稳阶段",
  "五神器调查链",
  "神器共鸣规则",
  "拂晓之盾",
  "风暴之钥",
  "星灯之杯",
  "炉心之锤",
  "月根之弦",
  "龙脉异动调查链",
  "龙脉异动等级",
  "教会净化派冲突",
  "净化令",
  "病历删改",
  "灾民安置争议",
  "暗影龙真相碎片",
  "魂侧碎片",
  "躯侧碎片",
  "五英雄空白",
  "沉默钟楼断响",
  "月光苔提前开花",
  "折断的剑旧账本",
  "炉壁维修训话",
  "草原饭前歌",
  "蓝鹭灯塔暗光",
  "净化令空白编号",
  "无名墓牌旧徽",
  "终局前整备阶段",
  "灾厄之龙觉醒阶段",
  "地图静态数据_节点_七旗城",
  "地图静态数据_节点_白冠王都",
  "地图静态数据_节点_灰雾边境营地",
  "地图静态数据_节点_亚雷亚空港",
  "地图静态数据_节点_灰炉诸城",
  "地图静态数据_节点_白帆群岛",
  "地图静态数据_节点_黑松边寨",
  "地图静态数据_节点_小丘铃市",
  "地图静态数据_节点_银叶边界门",
  "地图静态数据_节点_潮裔珊瑚埠",
  "地图静态数据_节点_铜壳机关街",
  "地图静态数据_节点_霜牙猎寨",
  "地图静态数据_节点_龙鳞避誓塔",
  "地图静态数据_路线_七旗城_白冠王都",
  "地图静态数据_路线_七旗城_灰雾边境营地",
  "地图静态数据_路线_白冠王都_亚雷亚空港",
  "地图静态数据_路线_灰炉诸城_白帆群岛",
  "地图静态数据_路线_黑松边寨_霜冠王国",
  "地图静态数据_路线_禁忌地撤回线",
  "地图静态数据_路线_七旗城_小丘铃市",
  "地图静态数据_路线_月鹿森林_银叶边界门",
  "地图静态数据_路线_白帆港_潮裔珊瑚埠",
  "地图静态数据_路线_星砂学院邦_铜壳机关街",
  "地图静态数据_路线_黑松边寨_霜牙猎寨",
  "地图静态数据_路线_灰雾边境营地_龙鳞避誓塔",
  "地区生成池_七旗城与岚之领",
  "地区生成池_白冠王都与艾琳西亚",
  "地区生成池_灰雾边境与禁忌之地",
  "地区生成池_浮空圣都亚雷亚",
  "地区生成池_灰炉诸城",
  "地区生成池_白帆群岛与蓝鹭灯塔",
  "地区生成池_星砂学院邦",
  "地区生成池_月鹿森林与湿地",
  "地区生成池_霜冠与黑松边线",
  "种族与血脉生成规则_总原则",
  "种族与血脉生成规则_人类",
  "种族与血脉生成规则_精灵",
  "种族与血脉生成规则_半精灵",
  "种族与血脉生成规则_矮人",
  "种族与血脉生成规则_妖精",
  "种族与血脉生成规则_半身人",
  "种族与血脉生成规则_兽裔",
  "种族与血脉生成规则_潮裔",
  "种族与血脉生成规则_侏儒",
  "种族与血脉生成规则_龙裔",
  "种族与血脉生成规则_记录灵与构装体",
  "种族与血脉生成规则_镜裔",
].join('\n');

const SCHEDULE_HINTS = [
  '王国',
  '城',
  '城墙',
  '地标',
  '圣骑士',
  '骑士团',
  '公会',
  '教会',
  'NPC',
  '人物',
  '绯欧菈',
  '委托',
  '新闻',
  '传闻',
  '势力',
  '商队',
  '路线',
  '地区',
];

const BLOCKED_ENTRY_NAME_PATTERNS = [
  /\[initvar\]/i,
  /变量初始化勿开/,
];

const ACTION_TYPE_RULES: Array<{ label: string; patterns: RegExp[] }> = [
  { label: '入城/盘查', patterns: [/入城|城门|盘查|通行|文书|路引|担保|登记/] },
  { label: '交涉', patterns: [/交涉|询问|谈判|说服|解释|回答|问话|身份|来意/] },
  { label: '调查', patterns: [/调查|搜索|查看|线索|痕迹|询问|查验|核对/] },
  { label: '旅行', patterns: [/赶路|旅行|路线|路费|营地|马车|商队|地图/] },
  { label: '委托', patterns: [/委托|任务|报酬|接取|完成|看板|行会/] },
  { label: '战斗', patterns: [/战斗|攻击|防御|命中|伤害|魔物|逃跑|潜入/] },
  { label: '技能/升级', patterns: [/技能|升级|经验|加点|等级|训练|导师|法力|阶位/] },
  { label: '装备/声望/好感', patterns: [/装备|穿戴|拆卸|修理|耐久|声望|好感|关系|委托结算/] },
];

function uniq(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((v): v is string => !!v && v.trim().length > 0).map(v => v.trim()))];
}

export function splitConfiguredNames(textOrList: string | string[] | undefined | null): string[] {
  if (Array.isArray(textOrList)) return uniq(textOrList);
  if (!textOrList) return [];
  return uniq(String(textOrList).split(/[\n,，、]+/));
}

function isBlockedEntryName(name: string): boolean {
  return BLOCKED_ENTRY_NAME_PATTERNS.some(pattern => pattern.test(name));
}

function removeBlockedConfiguredNames(names: string[]): string[] {
  return names.filter(name => !isBlockedEntryName(name));
}

export function buildEldredSchedulerConfig(settings: any): EldredWorldbookSchedulerConfig {
  const alwaysNames = removeBlockedConfiguredNames(splitConfiguredNames(settings?.eldredWorldbookAlwaysNames));
  const scheduledNames = removeBlockedConfiguredNames(splitConfiguredNames(settings?.eldredWorldbookScheduledNames));
  const keepEnabledNames = removeBlockedConfiguredNames(splitConfiguredNames(settings?.eldredWorldbookKeepEnabledNames));
  const shouldUseDefaults = alwaysNames.length === 0 && scheduledNames.length === 0 && keepEnabledNames.length === 0;
  return {
    alwaysNames: shouldUseDefaults ? removeBlockedConfiguredNames(splitConfiguredNames(ELDRED_DEFAULT_ALWAYS_NAMES)) : alwaysNames,
    scheduledNames: shouldUseDefaults ? removeBlockedConfiguredNames(splitConfiguredNames(ELDRED_DEFAULT_SCHEDULED_NAMES)) : scheduledNames,
    keepEnabledNames,
    maxEntries: Math.max(1, Number(settings?.eldredWorldbookMaxEntries ?? 12)),
    maxChars: Math.max(1000, Number(settings?.eldredWorldbookMaxChars ?? 16000)),
  };
}

function entryName(entry: any): string {
  const rawKey = entry?.key ?? entry?.keys ?? entry?.strategy?.keys;
  const keys = normalizeKeys(rawKey);
  return String(entry?.name || entry?.comment || keys[0] || `未命名条目${entry?.uid ?? ''}`).trim();
}

function normalizeKeys(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap(item => normalizeKeys(item));
  }
  if (value instanceof RegExp) return [value.source];
  return String(value)
    .split(/[,，]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function normalizeEnabled(entry: any): boolean {
  if (typeof entry?.enabled === 'boolean') return entry.enabled;
  if (typeof entry?.disable === 'boolean') return !entry.disable;
  return true;
}

function inferNpcDisplayName(name: string, content: string, keys: string[]): { displayName: string; aliases: string[]; isNpc: boolean } {
  const contentName = content.match(/<npc_[^>]*>\s*([^\n:：]{1,40})[:：]/i)?.[1]?.trim();
  const keyName = keys.find(key => key.length >= 2 && key.length <= 16);
  const isNpc = /<npc_/i.test(content) || Boolean(contentName);
  const displayName = isNpc ? (keyName || contentName || name) : name;
  return {
    displayName,
    aliases: uniq([displayName, contentName, keyName, name, ...keys]),
    isNpc,
  };
}

function comparableName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s"'“”‘’《》〈〉【】[\]()（）{}<>·・.。,:：;；,，、/\\|_\-—–]/g, '')
    .trim();
}

function entryMatchesConfiguredName(name: string, entry: Pick<EldredWorldbookEntryRef, 'name' | 'displayName' | 'aliases' | 'isNpc'>): boolean {
  const rawName = name.trim();
  if (!rawName) return false;

  const normalizedName = comparableName(rawName);
  if (!normalizedName) return false;

  const identityNames = uniq([entry.name, entry.displayName]);
  if (identityNames.some(identity => identity === rawName || comparableName(identity) === normalizedName)) return true;

  const normalizedDisplayName = comparableName(entry.displayName || entry.name);
  if (entry.isNpc && normalizedDisplayName.length >= 2 && normalizedName.includes(normalizedDisplayName)) {
    return true;
  }

  return false;
}

function entryHasConfiguredAlias(name: string, entry: Pick<EldredWorldbookEntryRef, 'aliases'>): boolean {
  const rawName = name.trim();
  if (!rawName) return false;
  if (entry.aliases.some(alias => alias === rawName)) return true;

  const normalizedName = comparableName(rawName);
  if (!normalizedName) return false;
  return entry.aliases.some(alias => comparableName(alias) === normalizedName);
}

function configuredNameIndex(names: string[], entry: Pick<EldredWorldbookEntryRef, 'name' | 'displayName' | 'aliases' | 'isNpc'>): number {
  return names.findIndex(name => entryMatchesConfiguredName(name, entry));
}

function normalizeEntry(raw: any, worldbookName: string): EldredWorldbookEntryRef {
  const name = entryName(raw);
  const strategy = raw?.strategy || {};
  const position = raw?.position || {};
  const keys = normalizeKeys(strategy.keys ?? raw?.key ?? raw?.keys);
  const secondaryKeys = normalizeKeys(strategy.keys_secondary?.keys ?? raw?.keysecondary);
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

function configuredNamesIncludeEntry(names: string[], entry: EldredWorldbookEntryRef): boolean {
  return configuredNameIndex(names, entry) !== -1;
}

function classifyEntry(entry: EldredWorldbookEntryRef, config: EldredWorldbookSchedulerConfig): EldredWorldbookEntryRef {
  if (isBlockedEntryName(entry.name)) {
    return { ...entry, category: 'unused_candidate', reasons: ['变量初始化条目保持禁用，不进入常驻或调度'] };
  }

  const exactAlways = configuredNamesIncludeEntry(config.alwaysNames, entry);
  const exactScheduled = configuredNamesIncludeEntry(config.scheduledNames, entry);
  const exactKeep = configuredNamesIncludeEntry(config.keepEnabledNames, entry);
  const haystack = `${entry.name}\n${entry.displayName}\n${entry.aliases.join('\n')}\n${entry.keys.join('\n')}\n${entry.secondaryKeys.join('\n')}\n${entry.content.slice(0, 600)}`;
  const reasons: string[] = [];
  let category: EldredWorldbookCategory = 'unused_candidate';

  if (exactAlways || exactKeep) {
    category = 'always';
    reasons.push(exactAlways ? '命中常驻条目名清单' : '命中保留启用清单');
  } else if (exactScheduled) {
    category = 'scheduled';
    reasons.push('命中脚本调度条目名清单');
  } else if (ALWAYS_HINTS.some(hint => haystack.includes(hint))) {
    category = 'suggested_always';
    reasons.push('名称/内容包含常驻底座候选词');
  } else if (SCHEDULE_HINTS.some(hint => haystack.includes(hint))) {
    category = 'suggested_scheduled';
    reasons.push('名称/内容包含地点、NPC、势力或事件候选词');
  } else {
    reasons.push('未命中艾尔德雷德调度规则，建议保持关闭候选');
  }

  return { ...entry, category, reasons };
}

function findDuplicates(entries: EldredWorldbookEntryRef[]): EldredWorldbookDuplicate[] {
  const byName = new Map<string, EldredWorldbookEntryRef[]>();
  for (const entry of entries) {
    const list = byName.get(entry.name) || [];
    list.push(entry);
    byName.set(entry.name, list);
  }
  return [...byName.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([name, list]) => ({
      name,
      entries: list.map(entry => ({
        worldbookName: entry.worldbookName,
        uid: entry.uid,
        enabled: entry.enabled,
      })),
    }));
}

function countCategories(entries: EldredWorldbookEntryRef[], bindings: EldredWorldbookBindingReport): EldredWorldbookScan['counts'] {
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

async function getBoundWorldbookNames(): Promise<EldredWorldbookBindingReport> {
  const api = globalThis as any;
  const global = typeof api.getGlobalWorldbookNames === 'function' ? api.getGlobalWorldbookNames() as string[] : [];
  const char = typeof api.getCharWorldbookNames === 'function'
    ? api.getCharWorldbookNames('current') as { primary?: string | null; additional?: string[] }
    : { primary: null, additional: [] };
  const chat = typeof api.getChatWorldbookName === 'function' ? api.getChatWorldbookName('current') as string | null : null;
  const loadedFallback = typeof api.getWorldbookNames === 'function' ? api.getWorldbookNames() as string[] : [];
  const bound = uniq([
    ...global,
    char.primary || null,
    ...(char.additional || []),
    chat,
  ]);
  return {
    global,
    characterPrimary: char.primary || null,
    characterAdditional: char.additional || [],
    chat,
    loaded: loadedFallback,
    scanned: bound.length > 0 ? bound : loadedFallback,
  };
}

export async function scanEldredWorldbooks(config: EldredWorldbookSchedulerConfig): Promise<EldredWorldbookScan> {
  const bindings = await getBoundWorldbookNames();
  const api = globalThis as any;
  const entries: EldredWorldbookEntryRef[] = [];
  if (typeof api.getWorldbook !== 'function') {
    throw new Error('当前环境没有 getWorldbook 接口，无法扫描世界书');
  }

  for (const worldbookName of bindings.scanned) {
    try {
      const worldbook = await api.getWorldbook(worldbookName) as any[];
      for (const rawEntry of worldbook || []) {
        entries.push(classifyEntry(normalizeEntry(rawEntry, worldbookName), config));
      }
    } catch (error) {
      console.warn(`[智脑-艾尔德雷德] 扫描世界书失败: ${worldbookName}`, error);
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

function extractNameHits(entries: EldredWorldbookEntryRef[], text: string): string[] {
  const lower = lowerText(text);
  return entries
    .filter(entry => entry.aliases.some(alias => alias.length >= 2 && lower.includes(alias.toLowerCase())))
    .map(entry => entry.displayName)
    .slice(0, 12);
}

function sceneContainsName(sceneText: string, name: string): boolean {
  const normalizedScene = comparableName(sceneText);
  const normalizedName = comparableName(name);
  if (!normalizedName || normalizedName.length < 2) return false;
  if (normalizedScene.includes(normalizedName)) return true;

  const fragments = uniq([
    name.replace(/^(神圣王国|霜冠王国|白冠王都|王国|公国|帝国)/, ''),
    ...name.split(/[与和]/),
  ]).map(comparableName).filter(fragment => fragment.length >= 4);
  return fragments.some(fragment => normalizedScene.includes(fragment));
}

function sceneContainsConfiguredName(sceneText: string, entry: EldredWorldbookEntryRef, configuredNames: string[]): boolean {
  const matchingNames = configuredNames.filter(name => entryMatchesConfiguredName(name, entry));
  if (matchingNames.some(name => sceneContainsName(sceneText, name))) return true;
  if (entry.isNpc && sceneContainsName(sceneText, entry.displayName)) {
    return matchingNames.some(name => comparableName(name).includes(comparableName(entry.displayName)));
  }
  return false;
}

function usefulKeyHit(entry: EldredWorldbookEntryRef, sceneText: string): string | undefined {
  const lower = lowerText(sceneText);
  return [...entry.keys, ...entry.secondaryKeys].find(key => {
    const normalizedKey = comparableName(key);
    if (normalizedKey.length < 3 && normalizedKey !== comparableName(entry.name) && normalizedKey !== comparableName(entry.displayName)) {
      return false;
    }
    return key.length >= 2 && lower.includes(key.toLowerCase());
  });
}

function scoreEntry(entry: EldredWorldbookEntryRef, sceneText: string, config: EldredWorldbookSchedulerConfig): { score: number; reason: string } {
  if (isBlockedEntryName(entry.name)) {
    return { score: 0, reason: '变量初始化条目保持禁用' };
  }

  const scheduledIndex = configuredNameIndex(config.scheduledNames, entry);
  const inScheduledLibrary = scheduledIndex !== -1;
  const keepOnly = configuredNamesIncludeEntry(config.keepEnabledNames, entry) && !inScheduledLibrary;

  if (configuredNamesIncludeEntry(config.alwaysNames, entry) || keepOnly) {
    return { score: 0, reason: '原生常驻/保留启用，跳过智脑重复注入' };
  }

  const hasScheduledLibrary = config.scheduledNames.length > 0;
  if (hasScheduledLibrary && !inScheduledLibrary) {
    return { score: 0, reason: '不在脚本调度准入库' };
  }

  const scheduledBonus = inScheduledLibrary ? Math.max(80, 180 - scheduledIndex * 4) : 0;
  const npcBonus = entry.isNpc ? 90 : 0;

  if (inScheduledLibrary && sceneContainsConfiguredName(sceneText, entry, config.scheduledNames)) {
    return {
      score: 1240 + scheduledBonus + npcBonus,
      reason: '调度准入库+场景命中配置名/显示名',
    };
  }

  const lower = lowerText(sceneText);
  const aliasHit = entry.aliases.find(alias => alias.length >= 2 && lower.includes(alias.toLowerCase()));
  if (aliasHit) {
    return {
      score: (inScheduledLibrary ? 980 + scheduledBonus : 820) + npcBonus,
      reason: inScheduledLibrary ? `调度准入库+场景命中名称: ${aliasHit}` : `场景命中名称: ${aliasHit}`,
    };
  }

  const keyHit = usefulKeyHit(entry, sceneText);
  if (keyHit) {
    return {
      score: inScheduledLibrary ? 800 + scheduledBonus : 700,
      reason: `场景命中关键字: ${keyHit}`,
    };
  }

  const actionHit = detectActionTypes(sceneText).find(actionType => entryMatchesActionType(entry, actionType));
  if (actionHit) {
    return {
      score: inScheduledLibrary ? 760 + scheduledBonus : 560,
      reason: `行动类型触发关联规则: ${actionHit}`,
    };
  }

  return { score: 0, reason: '未命中调度证据' };
}

function entryMatchesActionType(entry: EldredWorldbookEntryRef, actionType: string): boolean {
  const actionHints: Record<string, string[]> = {
    '入城/盘查': ['城门', '盘查', '通行', '文书', '路引', '担保', '登记', '城墙'],
    '交涉': ['交涉', '询问', '谈判', '说服', '身份', '来意', '文书', 'NPC', '人物'],
    '调查': ['调查', '搜索', '线索', '痕迹', '核对', '档案', '病历', '记录', '主线', '异动'],
    '旅行': ['旅行', '路线', '路费', '营地', '马车', '商队', '地图', '交通', '耗时', '补给', '气候'],
    '委托': ['委托', '任务', '报酬', '看板', '行会', '担保', '地区委托'],
    '战斗': ['战斗', '攻击', '防御', '伤害', '魔物', '首领', '威胁', '敌人', '伤病'],
    '技能/升级': ['技能', '阶位', '等级', '升级', '经验', '加点', '训练', '导师', '法力', '技能等级'],
    '装备/声望/好感': ['装备', '穿戴', '拆卸', '修理', '耐久', '声望', '好感', '关系', '区域声望', '装备生成'],
  };
  const hints = actionHints[actionType] || [];
  if (hints.length === 0) return false;
  const haystack = `${entry.name}\n${entry.displayName}\n${entry.aliases.join('\n')}\n${entry.keys.join('\n')}\n${entry.secondaryKeys.join('\n')}\n${entry.content.slice(0, 1200)}`;
  return hints.some(hint => haystack.includes(hint));
}

export function buildEldredWorldbookInjection(
  scan: EldredWorldbookScan | null | undefined,
  sceneText: string,
  config: EldredWorldbookSchedulerConfig,
): { content: string; report: EldredWorldbookInjectionReport } | null {
  if (!scan || scan.entries.length === 0) return null;

  const scheduledOrder = (entry: EldredWorldbookEntryRef) => {
    const index = configuredNameIndex(config.scheduledNames, entry);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  const scored = scan.entries
    .map(entry => ({ entry, ...scoreEntry(entry, sceneText, config) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || scheduledOrder(a.entry) - scheduledOrder(b.entry) || b.entry.contentLength - a.entry.contentLength);

  const selected: typeof scored = [];
  let usedChars = 0;
  for (const item of scored) {
    if (selected.length >= config.maxEntries) break;
    const nextLen = Math.min(item.entry.contentLength, config.maxChars);
    if (usedChars > 0 && usedChars + nextLen > config.maxChars) continue;
    selected.push(item);
    usedChars += nextLen;
  }

  if (selected.length === 0) return null;

  const warnings: string[] = [];
  if (scan.duplicates.length > 0) warnings.push(`存在${scan.duplicates.length}组重名世界书条目`);
  if (scan.missingAlwaysNames.length > 0) warnings.push(`常驻清单缺失: ${scan.missingAlwaysNames.join('、')}`);
  if (scan.missingScheduledNames.length > 0) warnings.push(`调度清单缺失: ${scan.missingScheduledNames.join('、')}`);

  const parts: string[] = [];
  parts.push('<eldred_worldbook_bundle>');
  parts.push(`<调度时间>${new Date().toISOString()}</调度时间>`);
  parts.push(`<调度条目>${selected.map(item => item.entry.displayName).join('、')}</调度条目>`);
  parts.push('<对话名>角色发言使用【角色名】：“台词”；角色名使用显示名，职务写入身份或旁白。</对话名>');
  parts.push('<交互提示>获得物品/技能入库/委托更新/NPC收录/地点解锁/事件进展/升级提示/好感变化/声望变化/装备变更使用同名提示行。</交互提示>');
  parts.push('<战斗裁决>只写必要结论、数值、状态与变量更新。</战斗裁决>');
  parts.push('');
  for (const item of selected) {
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
      parts.push(`职务/条目名: ${entry.name}`);
      parts.push('写作约束: 正文发言必须写作【' + entry.displayName + '】：“台词”。不得写作【' + entry.name + '】。');
      parts.push('');
    }
    parts.push(entry.content.slice(0, Math.max(500, config.maxChars - parts.join('\n').length)));
    parts.push('</worldbook_entry>');
    parts.push('');
  }
  parts.push('</eldred_worldbook_bundle>');

  const content = parts.join('\n').trim();
  const report: EldredWorldbookInjectionReport = {
    injectedAt: new Date().toISOString(),
    entryIds: selected.map(item => item.entry.id),
    entryNames: selected.map(item => item.entry.displayName),
    reasonById: Object.fromEntries(selected.map(item => [item.entry.id, item.reason])),
    totalChars: content.length,
    estimatedTokens: Math.ceil(content.length / 1.7),
    sceneSignals: {
      locations: extractNameHits(scan.entries.filter(entry => /城|镇|村|塔|墙|门|港|路|区|国/.test(entry.name)), sceneText),
      characters: extractNameHits(scan.entries.filter(entry => /绯|菈|娜|尔|亚|贝|团长|骑士|书记|商人/.test(entry.name)), sceneText),
      actionTypes: detectActionTypes(sceneText),
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

export async function applyEldredWorldbookEnablePlan(config: EldredWorldbookSchedulerConfig): Promise<{
  backup: EldredWorldbookEnableBackup;
  changed: Array<{ worldbookName: string; uid: number; name: string; from: boolean; to: boolean }>;
}> {
  const keepConfigNames = [...config.alwaysNames, ...config.keepEnabledNames];
  if (keepConfigNames.length === 0) {
    throw new Error('常驻/保留启用清单为空，拒绝执行关闭计划，避免误关全部世界书条目');
  }

  const scan = await scanEldredWorldbooks(config);
  const backup: EldredWorldbookEnableBackup = {
    id: `eldred-wb-backup-${Date.now()}`,
    createdAt: new Date().toISOString(),
    entries: scan.entries.map(entry => ({
      worldbookName: entry.worldbookName,
      uid: entry.uid,
      name: entry.name,
      enabled: entry.enabled,
    })),
  };
  const changed: Array<{ worldbookName: string; uid: number; name: string; from: boolean; to: boolean }> = [];
  const byBook = new Map<string, EldredWorldbookEntryRef[]>();
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
        const entryRef = {
          name,
          displayName: inferNpcDisplayName(name, content, keys).displayName,
          aliases: inferNpcDisplayName(name, content, keys).aliases,
        } as EldredWorldbookEntryRef;
        const from = normalizeEnabled(rawEntry);
        const to = configuredNamesIncludeEntry(keepConfigNames, entryRef);
        if (from !== to) changed.push({ worldbookName, uid, name, from, to });
        return { ...rawEntry, enabled: to };
      });
    }, { render: 'debounced' });
  }

  return { backup, changed };
}

export async function restoreEldredWorldbookEnableBackup(backup: EldredWorldbookEnableBackup): Promise<number> {
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
