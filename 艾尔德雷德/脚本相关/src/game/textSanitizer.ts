const NOTICE_TAGS = [
  '获得物品',
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
];

const noticeTagPattern = new RegExp(`<(${NOTICE_TAGS.join('|')})[^>]*>([\\s\\S]*?)(?:<\\/\\1>|$)`, 'g');

const stripKnownControlBlocks = (text: string) =>
  text
    .replace(/<UpdateVariable(?:variable)?\b[^>]*>[\s\S]*?(?:<\/UpdateVariable(?:variable)?>|$)/gi, '')
    .replace(/<Analysis\b[^>]*>[\s\S]*?(?:<\/Analysis>|$)/gi, '')
    .replace(/<JSONPatch\b[^>]*>[\s\S]*?(?:<\/JSONPatch>|<\/UpdateVariable(?:variable)?>|$)/gi, '')
    .replace(/<thinking\b[^>]*>[\s\S]*?(?:<\/thinking>|$)/gi, '')
    .replace(/<time\b[^>]*>[\s\S]*?(?:<\/time>|$)/gi, '')
    .replace(/<recap\b[^>]*>[\s\S]*?(?:<\/recap>|$)/gi, '')
    .replace(/<safe\b[^>]*>[\s\S]*?(?:<\/safe>|$)/gi, '')
    .replace(/<\/?(?:UpdateVariable(?:variable)?|Analysis|JSONPatch|content|thinking|time|recap|safe)\b[^>]*>/gi, '');

const isMetacognitionLine = (line: string) =>
  /^\s*(?:\[|【)?\s*METACOGNITION\s*(?:\]|】)?\s*$/i.test(line)
  || /^\s*(?:[-*]\s*)?(语言|视角|前情回顾|当前状态|言雪|写作风格|世界逻辑|合词|角色知识|当前目标|玩家输入|用户输入|变量计划|审查|轨则|终审|安全|生成|更新|落笔|禁止|状态为|本轮|输出|测试目标|当前测试目标|回复末尾|这只是测试|检查|是否|列出|包含)\s*[：:]/.test(line)
  || /^\s*[-*]\s*审查段[一二三四五六七八九十\d]+\s*[：:]/.test(line);

const stripLeakedMetacognition = (text: string) => {
  const lines = text.split(/\r?\n/);
  const result: string[] = [];
  let dropping = false;

  for (const line of lines) {
    if (/^\s*(?:\[|【)?\s*METACOGNITION\s*(?:\]|】)?\s*$/i.test(line)) {
      dropping = true;
      continue;
    }
    if (dropping) {
      const trimmed = line.trim();
      if (!trimmed || isMetacognitionLine(line) || /^[-*]\s+/.test(trimmed) || /^\d+[.、]\s*/.test(trimmed)) continue;
      if (!/^【[^】]{1,32}】[：:]/.test(trimmed) && !/^第?[一二三四五六七八九十\d]+[幕章回]/.test(trimmed)) continue;
      dropping = false;
    }
    if (isMetacognitionLine(line)) continue;
    result.push(line);
  }

  return result.join('\n');
};

const normalizeNoticeAngleTags = (text: string) =>
  text.replace(noticeTagPattern, (_, tag: string, body: string) => `\n【${tag}】：${String(body || '').trim()}\n`);

export const sanitizeEldredNarrationText = (rawText: string) => {
  const source = String(rawText || '');
  const matches = Array.from(source.matchAll(/<content\b[^>]*>([\s\S]*?)(?:<\/content>|$)/gi))
    .map(match => (match[1] || '').trim())
    .filter(Boolean);
  const content = matches.length ? matches.join('\n\n') : source;
  return stripLeakedMetacognition(stripKnownControlBlocks(normalizeNoticeAngleTags(content)))
    .replace(/\s*\[TIME:[^\]]+\]\s*$/i, '')
    .replace(/<\/?[\u4e00-\u9fa5A-Za-z0-9_-]+[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};
