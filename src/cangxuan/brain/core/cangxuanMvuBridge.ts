export interface CangxuanMvuSnapshot {
  available: boolean;
  rawStatData: any | null;
  currentTime: string;
  currentLocation: string;
  realm: string;
  wallet: string;
  daoists: string[];
  currentContacts: string[];
  cgState: string[];
  customRoles: string[];
  summaryText: string;
  error?: string;
}

const CUSTOM_ROLES_KEY = 'cx_status_custom_roles_v1';

function getHostWindow(): any {
  return window.parent || window;
}

function getMvuObj(): any | null {
  const host = getHostWindow();
  return host.Mvu || (window as any).Mvu || (globalThis as any).Mvu || null;
}

function normalizeStatData(data: any): any | null {
  if (!data || typeof data !== 'object') return null;
  return data.stat_data || data.statData || data.data?.stat_data || data.data?.statData || data;
}

function primitiveText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  return '';
}

function uniqLimit(values: string[], limit: number): string[] {
  return [...new Set(values.map(item => item.trim()).filter(Boolean))].slice(0, limit);
}

const NON_NAME_KEYS = new Set([
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '姓名',
  '名称',
  '角色名',
  'displayName',
  'name',
  'avatar',
  '头像',
  '立绘',
  '当前在地',
  '当前位置',
  '心声',
  '心情',
  '好感',
  '好感度',
  '关系',
  '关系标签',
  '境界',
  '修为',
  '状态',
  '备注',
  '印象',
  '描述',
  '简介',
  '是否在场',
  'lastUpdated',
  'updatedAt',
]);

function cleanNameCandidate(value: unknown): string {
  const text = primitiveText(value)
    .replace(/[<>{}"'“”‘’]/g, '')
    .replace(/\[|\]/g, '')
    .replace(/\s+/g, '')
    .trim();
  if (!text || text.includes('/') || text.includes(':') || text.includes('：')) return '';
  if (NON_NAME_KEYS.has(text) || /^[_$]/.test(text)) return '';
  if (/^(true|false|null|undefined|无|未知|空)$/i.test(text)) return '';
  if (/^\d+(\.\d+)?$/.test(text)) return '';
  if (text.length > 18) return '';
  return text;
}

function addName(names: string[], value: unknown, limit: number): void {
  if (names.length >= limit) return;
  const name = cleanNameCandidate(value);
  if (name && !names.includes(name)) names.push(name);
}

function addNamesFromText(names: string[], value: unknown, limit: number): void {
  const text = primitiveText(value);
  if (!text || text.length > 80) return;
  text.split(/[、,，;；\n]+/).forEach(part => addName(names, part, limit));
}

function addNamesFromValue(names: string[], value: any, limit: number, fallbackKey?: string): void {
  if (names.length >= limit) return;
  addName(names, fallbackKey, limit);
  if (value == null) return;

  if (typeof value === 'string' || typeof value === 'number') {
    addNamesFromText(names, value, limit);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value.slice(0, limit * 2)) {
      addNamesFromValue(names, item, limit);
      if (names.length >= limit) break;
    }
    return;
  }

  if (typeof value !== 'object') return;
  for (const key of ['姓名', '角色名', '名称', 'displayName', 'name']) {
    addName(names, value[key], limit);
  }
}

function collectSectionNames(root: any, sectionPattern: RegExp, limit: number): string[] {
  const names: string[] = [];
  const seen = new Set<any>();

  function harvest(value: any): void {
    if (names.length >= limit || value == null) return;
    if (typeof value === 'string') {
      addNamesFromText(names, value, limit);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value.slice(0, limit * 2)) {
        addNamesFromValue(names, item, limit);
        if (names.length >= limit) break;
      }
      return;
    }
    if (typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value).slice(0, limit * 3)) {
      addNamesFromValue(names, child, limit, key);
      if (names.length >= limit) break;
    }
  }

  function visit(value: any, key = '', depth = 0) {
    if (names.length >= limit || value == null || depth > 6 || seen.has(value)) return;
    if (sectionPattern.test(key)) {
      harvest(value);
      return;
    }
    if (typeof value === 'object') seen.add(value);
    if (Array.isArray(value)) {
      value.slice(0, 20).forEach((item, index) => visit(item, String(index), depth + 1));
    } else if (typeof value === 'object') {
      for (const [childKey, child] of Object.entries(value).slice(0, 160)) {
        visit(child, childKey, depth + 1);
      }
    }
  }

  visit(root);
  return uniqLimit(names, limit);
}

function findPrimitiveIn(value: any, depth = 0): string {
  const ownText = primitiveText(value);
  if (ownText) return ownText;
  if (value == null || depth > 3 || typeof value !== 'object') return '';
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 8)) {
      const found = findPrimitiveIn(item, depth + 1);
      if (found) return found;
    }
    return '';
  }
  for (const child of Object.values(value).slice(0, 24)) {
    const found = findPrimitiveIn(child, depth + 1);
    if (found) return found;
  }
  return '';
}

function collectKeyValues(root: any, keyPattern: RegExp, limit: number): string[] {
  const values: string[] = [];
  const seen = new Set<any>();

  function visit(value: any, key = '', depth = 0) {
    if (values.length >= limit || value == null || depth > 6 || seen.has(value)) return;
    if (typeof value === 'object') seen.add(value);
    if (keyPattern.test(key)) {
      const found = findPrimitiveIn(value);
      if (found) values.push(found.slice(0, 80));
    }
    if (Array.isArray(value)) {
      value.slice(0, 20).forEach((item, index) => visit(item, String(index), depth + 1));
    } else if (typeof value === 'object') {
      for (const [childKey, child] of Object.entries(value).slice(0, 160)) {
        visit(child, childKey, depth + 1);
      }
    }
  }

  visit(root);
  return uniqLimit(values, limit);
}

function collectSectionSignals(root: any, sectionPattern: RegExp, limit: number): string[] {
  const signals: string[] = [];
  const seen = new Set<any>();

  function addSignal(key: string, value: any): void {
    if (signals.length >= limit) return;
    const cleanKey = cleanNameCandidate(key) || key.trim();
    const text = findPrimitiveIn(value);
    if (!cleanKey || !text) return;
    signals.push(`${cleanKey}: ${text.slice(0, 30)}`);
  }

  function harvest(value: any): void {
    if (value == null || signals.length >= limit) return;
    if (Array.isArray(value)) {
      value.slice(0, limit).forEach((item, index) => addSignal(String(index + 1), item));
      return;
    }
    if (typeof value === 'object') {
      for (const [key, child] of Object.entries(value).slice(0, limit * 3)) {
        addSignal(key, child);
        if (signals.length >= limit) break;
      }
    }
  }

  function visit(value: any, key = '', depth = 0) {
    if (signals.length >= limit || value == null || depth > 6 || seen.has(value)) return;
    if (sectionPattern.test(key)) {
      harvest(value);
      return;
    }
    if (typeof value === 'object') seen.add(value);
    if (Array.isArray(value)) {
      value.slice(0, 20).forEach((item, index) => visit(item, String(index), depth + 1));
    } else if (typeof value === 'object') {
      for (const [childKey, child] of Object.entries(value).slice(0, 160)) {
        visit(child, childKey, depth + 1);
      }
    }
  }

  visit(root);
  return uniqLimit(signals, limit);
}

function firstValue(root: any, keyPattern: RegExp): string {
  return collectKeyValues(root, keyPattern, 1)[0] || '';
}

function formatList(values: string[], limit: number): string {
  const shown = values.slice(0, limit);
  const suffix = values.length > shown.length ? `等${values.length}项` : '';
  return `${shown.join('、')}${suffix}`;
}

function readCustomRoles(): string[] {
  try {
    const storage = getHostWindow().localStorage;
    const raw = storage.getItem(CUSTOM_ROLES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.roles) ? parsed.roles : [];
    return list
      .map((item: any) => String(item?.name || item?.角色名 || item?.displayName || '').trim())
      .filter(Boolean)
      .slice(0, 30);
  } catch {
    return [];
  }
}

function buildSummary(snapshot: Omit<CangxuanMvuSnapshot, 'summaryText'>): string {
  if (!snapshot.available) return snapshot.error ? `MVU不可用: ${snapshot.error}` : 'MVU不可用';
  const lines: string[] = ['<mvu_snapshot>'];
  if (snapshot.currentTime) lines.push(`当前时间: ${snapshot.currentTime}`);
  if (snapshot.currentLocation) lines.push(`当前地点: ${snapshot.currentLocation}`);
  if (snapshot.realm) lines.push(`主角修为: ${snapshot.realm}`);
  if (snapshot.wallet) lines.push(`灵石/钱包: ${snapshot.wallet}`);
  if (snapshot.currentContacts.length) lines.push(`当前接触: ${formatList(snapshot.currentContacts, 6)}`);
  if (snapshot.daoists.length) lines.push(`道友/主要NPC: ${formatList(snapshot.daoists, 10)}`);
  if (snapshot.cgState.length) lines.push(`CG/相册: ${formatList(snapshot.cgState, 6)}`);
  if (snapshot.customRoles.length) lines.push(`状态栏自定义角色: ${formatList(snapshot.customRoles, 10)}`);
  lines.push('</mvu_snapshot>');
  return lines.join('\n');
}

export async function readLatestCangxuanMvuSnapshot(): Promise<CangxuanMvuSnapshot> {
  try {
    const mvu = getMvuObj();
    if (!mvu || typeof mvu.getMvuData !== 'function') {
      const unavailable = {
        available: false,
        rawStatData: null,
        currentTime: '',
        currentLocation: '',
        realm: '',
        wallet: '',
        daoists: [],
        currentContacts: [],
        cgState: [],
        customRoles: readCustomRoles(),
        error: '未检测到 Mvu.getMvuData',
      };
      return { ...unavailable, summaryText: buildSummary(unavailable) };
    }

    const raw = await Promise.resolve(mvu.getMvuData({ type: 'message', message_id: -1 }));
    const statData = normalizeStatData(raw);
    if (!statData) {
      const empty = {
        available: false,
        rawStatData: null,
        currentTime: '',
        currentLocation: '',
        realm: '',
        wallet: '',
        daoists: [],
        currentContacts: [],
        cgState: [],
        customRoles: readCustomRoles(),
        error: '最新楼层没有 stat_data',
      };
      return { ...empty, summaryText: buildSummary(empty) };
    }

    const snapshot = {
      available: true,
      rawStatData: statData,
      currentTime: firstValue(statData, /当前时间|时间|日期/),
      currentLocation: firstValue(statData, /当前地点|地点|位置|区域|地标/),
      realm: firstValue(statData, /当前境界|境界|修为|修炼|进度/),
      wallet: firstValue(statData, /灵石|钱包|资产|余额|金钱/),
      daoists: collectSectionNames(statData, /道友录|主要NPC|结识道友录/, 12),
      currentContacts: collectSectionNames(statData, /当前接触人物|当前接触角色|当前接触|在场角色|现场角色/, 8),
      cgState: collectSectionSignals(statData, /CG|相册|插图|画廊/, 6),
      customRoles: readCustomRoles(),
    };
    return { ...snapshot, summaryText: buildSummary(snapshot) };
  } catch (error) {
    const failed = {
      available: false,
      rawStatData: null,
      currentTime: '',
      currentLocation: '',
      realm: '',
      wallet: '',
      daoists: [],
      currentContacts: [],
      cgState: [],
      customRoles: readCustomRoles(),
      error: (error as Error).message,
    };
    return { ...failed, summaryText: buildSummary(failed) };
  }
}

export function flattenCangxuanMvuForScene(snapshot: CangxuanMvuSnapshot): string {
  if (!snapshot.available) return '';
  const lines: string[] = ['<mvu_scene_signal>'];
  if (snapshot.currentTime) lines.push(`当前时间: ${snapshot.currentTime}`);
  if (snapshot.currentLocation) lines.push(`当前地点: ${snapshot.currentLocation}`);
  if (snapshot.realm) lines.push(`主角修为: ${snapshot.realm}`);
  if (snapshot.wallet) lines.push(`灵石/钱包: ${snapshot.wallet}`);
  if (snapshot.currentContacts.length) lines.push(`当前接触: ${formatList(snapshot.currentContacts, 6)}`);
  lines.push('</mvu_scene_signal>');
  return lines.join('\n');
}
