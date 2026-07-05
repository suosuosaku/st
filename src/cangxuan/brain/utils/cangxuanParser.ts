export interface CangxuanMessageDiagnostics {
  contentMode: 'cangxuan_content' | 'content' | 'fallback';
  openTags: string[];
  unclosedTags: string[];
  jsonPatchValid: boolean | null;
  jsonPatchError: string | null;
  tags: {
    cgNames: string[];
    daoistCollectCount: number;
    questAcceptCount: number;
    questCompleteCount: number;
    auctionBuyCount: number;
    blindBoxOpenCount: number;
    flyingLetterCount: number;
    freeStartCount: number;
    hasUpdateVariable: boolean;
    ruleCheckCount: number;
  };
}

const STRUCTURAL_BLOCKS = [
  /<think(?:ing)?>[\s\S]*?<\/(?:think|thinking)>/gi,
  /<rule_check\b[^>]*>[\s\S]*?<\/rule_check>/gi,
  /\[cangxuan_audit\][\s\S]*?(?=<[a-zA-Z_\u4e00-\u9fff]|```|$)/gi,
  /<UpdateVariable\b[^>]*>[\s\S]*?<\/UpdateVariable>/gi,
  /<StatusPlaceHolderImpl\s*\/>/gi,
  /<StatusPlaceHolderImpl\b[^>]*>[\s\S]*?<\/StatusPlaceHolderImpl>/gi,
  /<变量更新\b[^>]*>[\s\S]*?<\/变量更新>/gi,
  /<状态栏\b[^>]*>[\s\S]*?<\/状态栏>/gi,
];

const TAG_NAME_RE = /<\/?([A-Za-z_][\w:-]*|[\u4e00-\u9fff][\u4e00-\u9fff\w:-]*)\b[^>]*>/g;

export function extractCangxuanReadableContent(messageText: string): { content: string; diagnostics: CangxuanMessageDiagnostics } {
  const cangxuanMatches = Array.from(messageText.matchAll(/<cangxuan_content\b[^>]*>([\s\S]*?)<\/cangxuan_content>/gi));
  if (cangxuanMatches.length > 0) {
    const content = cangxuanMatches.map(match => match[1].trim()).filter(Boolean).join('\n\n');
    return { content: withTimePrefix(messageText, content), diagnostics: buildDiagnostics(messageText, 'cangxuan_content') };
  }

  const contentMatches = Array.from(messageText.matchAll(/<content\b[^>]*>([\s\S]*?)<\/content>/gi));
  if (contentMatches.length > 0) {
    const content = contentMatches.map(match => match[1].trim()).filter(Boolean).join('\n\n');
    return { content: withTimePrefix(messageText, content), diagnostics: buildDiagnostics(messageText, 'content') };
  }

  let content = messageText;
  for (const block of STRUCTURAL_BLOCKS) {
    content = content.replace(block, '');
  }
  content = content
    .replace(/```(?:[^`\n]*)\n?([\s\S]*?)```/g, (_full, inner) => String(inner || '').trim())
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { content: withTimePrefix(messageText, content), diagnostics: buildDiagnostics(messageText, 'fallback') };
}

function withTimePrefix(messageText: string, content: string): string {
  if (!content) return '';
  const timeMatch = messageText.match(/<time>([\s\S]*?)<\/time>/i);
  return timeMatch ? `[时间 ${timeMatch[1].trim()}]\n${content}` : content;
}

function extractTagValues(messageText: string, tagName: string): string[] {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  return Array.from(messageText.matchAll(pattern))
    .map(match => match[1].trim())
    .filter(Boolean);
}

function countTags(messageText: string, tagName: string): number {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
  return Array.from(messageText.matchAll(pattern)).length;
}

function buildDiagnostics(messageText: string, mode: CangxuanMessageDiagnostics['contentMode']): CangxuanMessageDiagnostics {
  const stack: string[] = [];
  const openTags: string[] = [];
  const unclosedTags: string[] = [];
  const ignored = new Set(['br', 'hr', 'img', 'input', 'meta', 'link']);
  let match: RegExpExecArray | null;
  TAG_NAME_RE.lastIndex = 0;

  while ((match = TAG_NAME_RE.exec(messageText))) {
    const full = match[0];
    const name = match[1];
    if (ignored.has(name.toLowerCase()) || full.endsWith('/>')) continue;
    if (full.startsWith('</')) {
      const idx = stack.lastIndexOf(name);
      if (idx === -1) continue;
      stack.splice(idx, 1);
    } else {
      stack.push(name);
      openTags.push(name);
    }
  }

  for (const name of stack) {
    if (!['think', 'thinking', 'content', 'cangxuan_content'].includes(name)) unclosedTags.push(name);
  }

  const jsonPatch = messageText.match(/<JSONPatch>\s*([\s\S]*?)\s*<\/JSONPatch>/i);
  let jsonPatchValid: boolean | null = null;
  let jsonPatchError: string | null = null;
  if (jsonPatch) {
    try {
      const parsed = JSON.parse(jsonPatch[1]);
      jsonPatchValid = Array.isArray(parsed);
      if (!jsonPatchValid) jsonPatchError = 'JSONPatch 不是数组';
    } catch (error) {
      jsonPatchValid = false;
      jsonPatchError = (error as Error).message;
    }
  }

  return {
    contentMode: mode,
    openTags: [...new Set(openTags)],
    unclosedTags: [...new Set(unclosedTags)],
    jsonPatchValid,
    jsonPatchError,
    tags: {
      cgNames: extractTagValues(messageText, '插图'),
      daoistCollectCount: countTags(messageText, '道友收录'),
      questAcceptCount: countTags(messageText, '赏令接取'),
      questCompleteCount: countTags(messageText, '赏令完成'),
      auctionBuyCount: countTags(messageText, '拍卖购入'),
      blindBoxOpenCount: countTags(messageText, '盲盒开启'),
      flyingLetterCount: countTags(messageText, '飞剑回信'),
      freeStartCount: countTags(messageText, '自由开局'),
      hasUpdateVariable: /<UpdateVariable\b/i.test(messageText) || /<变量更新\b/i.test(messageText),
      ruleCheckCount: countTags(messageText, 'rule_check'),
    },
  };
}
