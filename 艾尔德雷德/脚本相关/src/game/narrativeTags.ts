export type NarrativeTagLine = {
  title: string;
  rawTitle: string;
  body: string;
  fields: string[];
  named: Record<string, string>;
  raw: string;
};

export type NarrativeSegment =
  | { kind: 'text'; text: string }
  | { kind: 'tag'; tag: NarrativeTagLine };

const CANONICAL_NOTICE_TAGS = [
  '获得物品',
  '获得一次翻牌次数',
  '获得技能',
  '技能入库',
  '装备变更',
  '购买结算',
  '新闻',
  '新闻更新',
  '见闻',
  '见闻更新',
  '看板更新',
  '委托更新',
  '委托接取',
  '委托生成',
  '委托完成',
  '委托结算',
  '奖励结算',
  'NPC收录',
  '线索收录',
  '线索更新',
  '线索进展',
  '地点解锁',
  '地图加载',
  '路径行动',
  '事件推进',
  '事件进展',
  '奇遇事件',
  '翻牌结果',
  '主线进展',
  '好感变化',
  '声望变化',
  '角色升级',
  '升级提示',
  '队伍编成',
  '行动判定',
  '战斗开始',
  '先攻判定',
  '战斗行动',
  '战斗回合',
  '战斗结算',
  '战斗实况',
  '技能演出',
] as const;

const TAG_ALIASES: Record<string, string> = {
  NPC录入: 'NPC收录',
  角色收录: 'NPC收录',
  角色录入: 'NPC收录',
  物品获得: '获得物品',
  道具获得: '获得物品',
  任务接取: '委托接取',
  任务更新: '委托更新',
  任务完成: '委托完成',
  任务结算: '委托结算',
  战斗行动结算: '战斗行动',
  战斗快照: '战斗实况',
  技能释放: '技能演出',
  技能结算: '技能演出',
};

const canonicalSet = new Set<string>(CANONICAL_NOTICE_TAGS);

export const ELDRED_NOTICE_TAGS = Array.from(new Set([
  ...CANONICAL_NOTICE_TAGS,
  ...Object.keys(TAG_ALIASES),
]));

const compactTitle = (value: string) =>
  String(value || '')
    .replace(/^【|】$/g, '')
    .replace(/\s+/g, '')
    .trim();

export const normalizeNarrativeTagTitle = (title: string) => {
  const compact = compactTitle(title);
  return TAG_ALIASES[compact] || compact;
};

export const isKnownNarrativeTagTitle = (title: string) =>
  canonicalSet.has(normalizeNarrativeTagTitle(title));

const cleanPart = (value: string) =>
  value
    .replace(/^\s*[-*]\s*/, '')
    .trim();

export const splitNarrativeTagParts = (body: string) =>
  String(body || '')
    .split(/[\n｜|/;；,，]+/)
    .map(cleanPart)
    .filter(Boolean);

const fieldKeyPattern =
  /^(姓名|名称|角色|标题|委托|来源|发布者|委托人|任务详情|内容|目标|说明|事项|建议等级|等级|Lv|LV|风险|危险等级|奖励|报酬|时限|截止|状态|时间|完成时间|地点|地区|身份|职责|职业|性别|年龄|种族|所属|所属地区|所属地标|势力|HP|MP|AC|生命|生命值|法力|法力值|护甲|护甲等级|力量|敏捷|体质|智力|精神|装备|装备栏|已知技能|激活技能|特质|线索|线索位|槽位|阶段|指向|详情|行动者|执行者|单位|技能名|招式|行动|阶位|消耗|判定|命中|结果|数值|伤害|威力|治疗|状态变化|效果|冷却|阵营|回合|主角方|友方|我方|敌方|敌人|触发|胜负目标|先攻顺序|环境|下一压力|分类|类型|数量|用途|描述)\s*[：:]/;

const isContinuationLine = (line: string, currentTitle: string) => {
  const trimmed = line.trim();
  if (!trimmed || /^【[^】]{1,32}】/.test(trimmed)) return false;
  if (/^\s+/.test(line)) return true;
  if (/^[-*]\s*[^：:]{1,24}\s*[：:]/.test(trimmed)) return true;
  if (fieldKeyPattern.test(trimmed)) return true;
  if (/战斗|技能/.test(currentTitle)) {
    return /(?:->|→|=>|HP|MP|AC|\d+d\d+|伤害|治疗|命中|未命中|消耗|冷却|状态|判定|目标值|vs\s*(?:AC|DC))/i.test(trimmed);
  }
  return false;
};

const parseNamedFields = (parts: string[]) => {
  const named: Record<string, string> = {};
  parts.forEach(part => {
    const match = part.match(/^([^：:]{1,16})[：:]\s*(.+)$/);
    if (match) named[match[1].trim()] = match[2].trim();
  });
  return named;
};

const createTag = (rawTitle: string, bodyLines: string[]): NarrativeTagLine => {
  const title = normalizeNarrativeTagTitle(rawTitle);
  const body = bodyLines.map(line => line.trim()).filter(Boolean).join('\n').trim();
  const fields = splitNarrativeTagParts(body);
  return {
    title,
    rawTitle: rawTitle.trim(),
    body,
    fields,
    named: parseNamedFields(fields),
    raw: [`【${rawTitle}】`, ...bodyLines].join('\n'),
  };
};

export const parseNarrativeSegments = (rawText: string): NarrativeSegment[] => {
  const lines = String(rawText || '').split(/\r?\n/);
  const segments: NarrativeSegment[] = [];
  let current: { rawTitle: string; title: string; bodyLines: string[] } | null = null;

  const flushTag = () => {
    if (!current) return;
    segments.push({ kind: 'tag', tag: createTag(current.rawTitle, current.bodyLines) });
    current = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^【([^】]{1,32})】\s*(?:[：:]\s*)?(.*)$/);
    if (match && isKnownNarrativeTagTitle(match[1])) {
      flushTag();
      current = {
        rawTitle: match[1].trim(),
        title: normalizeNarrativeTagTitle(match[1]),
        bodyLines: match[2] ? [match[2]] : [],
      };
      continue;
    }

    if (current && isContinuationLine(line, current.title)) {
      current.bodyLines.push(trimmed);
      continue;
    }

    flushTag();
    if (trimmed) segments.push({ kind: 'text', text: trimmed });
  }

  flushTag();
  return segments;
};

export const parseNarrativeTags = (rawText: string) =>
  parseNarrativeSegments(rawText)
    .filter((segment): segment is { kind: 'tag'; tag: NarrativeTagLine } => segment.kind === 'tag')
    .map(segment => segment.tag);
