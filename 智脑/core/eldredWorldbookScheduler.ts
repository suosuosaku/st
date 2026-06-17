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

const ACTION_TYPE_RULES: Array<{ label: string; patterns: RegExp[] }> = [
  { label: '入城/盘查', patterns: [/入城|城门|盘查|通行|文书|路引|担保|登记/] },
  { label: '交涉', patterns: [/交涉|询问|谈判|说服|解释|回答|问话|身份|来意/] },
  { label: '调查', patterns: [/调查|搜索|查看|线索|痕迹|询问|查验|核对/] },
  { label: '旅行', patterns: [/赶路|旅行|路线|路费|营地|马车|商队|地图/] },
  { label: '委托', patterns: [/委托|任务|报酬|接取|完成|看板|行会/] },
  { label: '战斗', patterns: [/战斗|攻击|防御|命中|伤害|魔物|逃跑|潜入/] },
];

function uniq(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((v): v is string => !!v && v.trim().length > 0).map(v => v.trim()))];
}

export function splitConfiguredNames(textOrList: string | string[] | undefined | null): string[] {
  if (Array.isArray(textOrList)) return uniq(textOrList);
  if (!textOrList) return [];
  return uniq(String(textOrList).split(/[\n,，、]+/));
}

export function buildEldredSchedulerConfig(settings: any): EldredWorldbookSchedulerConfig {
  return {
    alwaysNames: splitConfiguredNames(settings?.eldredWorldbookAlwaysNames),
    scheduledNames: splitConfiguredNames(settings?.eldredWorldbookScheduledNames),
    keepEnabledNames: splitConfiguredNames(settings?.eldredWorldbookKeepEnabledNames),
    maxEntries: Math.max(1, Number(settings?.eldredWorldbookMaxEntries ?? 8)),
    maxChars: Math.max(1000, Number(settings?.eldredWorldbookMaxChars ?? 9000)),
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

function normalizeEntry(raw: any, worldbookName: string): EldredWorldbookEntryRef {
  const name = entryName(raw);
  const strategy = raw?.strategy || {};
  const position = raw?.position || {};
  const keys = normalizeKeys(strategy.keys ?? raw?.key ?? raw?.keys);
  const secondaryKeys = normalizeKeys(strategy.keys_secondary?.keys ?? raw?.keysecondary);
  const content = typeof raw?.content === 'string' ? raw.content : String(raw?.content || '');
  return {
    id: `${worldbookName}#${Number(raw?.uid ?? 0)}#${name}`,
    worldbookName,
    uid: Number(raw?.uid ?? 0),
    name,
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

function classifyEntry(entry: EldredWorldbookEntryRef, config: EldredWorldbookSchedulerConfig): EldredWorldbookEntryRef {
  const exactAlways = config.alwaysNames.includes(entry.name);
  const exactScheduled = config.scheduledNames.includes(entry.name);
  const exactKeep = config.keepEnabledNames.includes(entry.name);
  const haystack = `${entry.name}\n${entry.keys.join('\n')}\n${entry.secondaryKeys.join('\n')}\n${entry.content.slice(0, 600)}`;
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

  const names = new Set(entries.map(entry => entry.name));
  return {
    scannedAt: new Date().toISOString(),
    bindings,
    entries,
    duplicates: findDuplicates(entries),
    missingAlwaysNames: config.alwaysNames.filter(name => !names.has(name)),
    missingScheduledNames: config.scheduledNames.filter(name => !names.has(name)),
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
    .filter(entry => entry.name.length >= 2 && lower.includes(entry.name.toLowerCase()))
    .map(entry => entry.name)
    .slice(0, 12);
}

function scoreEntry(entry: EldredWorldbookEntryRef, sceneText: string, config: EldredWorldbookSchedulerConfig): { score: number; reason: string } {
  if (config.alwaysNames.includes(entry.name) || config.keepEnabledNames.includes(entry.name)) {
    return { score: 1000, reason: '常驻清单' };
  }
  const lower = lowerText(sceneText);
  if (config.scheduledNames.includes(entry.name) && lower.includes(entry.name.toLowerCase())) {
    return { score: 820, reason: '调度清单+正文命中条目名' };
  }
  if (config.scheduledNames.includes(entry.name)) {
    return { score: 620, reason: '调度清单' };
  }
  if (entry.name.length >= 2 && lower.includes(entry.name.toLowerCase())) {
    return { score: 560, reason: '正文命中条目名' };
  }
  const keyHit = [...entry.keys, ...entry.secondaryKeys].find(key => key.length >= 2 && lower.includes(key.toLowerCase()));
  if (keyHit) {
    return { score: 480, reason: `正文命中关键字: ${keyHit}` };
  }
  if (entry.category === 'suggested_always') return { score: 240, reason: '常驻候选兜底' };
  if (entry.category === 'suggested_scheduled') return { score: 160, reason: '调度候选兜底' };
  return { score: 0, reason: '未命中' };
}

export function buildEldredWorldbookInjection(
  scan: EldredWorldbookScan | null | undefined,
  sceneText: string,
  config: EldredWorldbookSchedulerConfig,
): { content: string; report: EldredWorldbookInjectionReport } | null {
  if (!scan || scan.entries.length === 0) return null;

  const scored = scan.entries
    .map(entry => ({ entry, ...scoreEntry(entry, sceneText, config) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || b.entry.contentLength - a.entry.contentLength);

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
  parts.push('说明: 以下内容由智脑按世界书条目名和当前场景调度，仅作为艾尔德雷德本轮创作上下文。不得复述本说明。');
  parts.push(`调度时间: ${new Date().toISOString()}`);
  parts.push(`调度条目: ${selected.map(item => item.entry.name).join('、')}`);
  parts.push('');
  for (const item of selected) {
    const entry = item.entry;
    parts.push(`<worldbook_entry name="${escapeXml(entry.name)}" source="${escapeXml(entry.worldbookName)}" uid="${entry.uid}" reason="${escapeXml(item.reason)}">`);
    parts.push(entry.content.slice(0, Math.max(500, config.maxChars - parts.join('\n').length)));
    parts.push('</worldbook_entry>');
    parts.push('');
  }
  parts.push('</eldred_worldbook_bundle>');

  const content = parts.join('\n').trim();
  const report: EldredWorldbookInjectionReport = {
    injectedAt: new Date().toISOString(),
    entryIds: selected.map(item => item.entry.id),
    entryNames: selected.map(item => item.entry.name),
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
  const keepNames = new Set([...config.alwaysNames, ...config.keepEnabledNames]);
  if (keepNames.size === 0) {
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
        const from = normalizeEnabled(rawEntry);
        const to = keepNames.has(name);
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
