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

function tryStringify(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeStatData(data: any): any | null {
  if (!data || typeof data !== 'object') return null;
  return data.stat_data || data.statData || data.data?.stat_data || data.data?.statData || data;
}

function walkUsefulValues(root: any, keyPattern: RegExp, limit = 12): string[] {
  const values: string[] = [];
  const seen = new Set<any>();

  function visit(value: any, path = '', depth = 0) {
    if (values.length >= limit || value == null || depth > 6 || seen.has(value)) return;
    if (typeof value === 'object') seen.add(value);
    const pathHit = keyPattern.test(path);

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      const text = String(value).trim();
      if (text && (pathHit || keyPattern.test(text))) values.push(path ? `${path}: ${text}` : text);
      return;
    }

    if (Array.isArray(value)) {
      value.slice(0, pathHit ? 30 : 8).forEach((item, index) => visit(item, `${path}/${index}`, depth + 1));
      return;
    }

    if (typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value).slice(0, 160)) {
      const nextPath = path ? `${path}/${key}` : key;
      if (pathHit || keyPattern.test(nextPath) || depth < 2) visit(child, nextPath, depth + 1);
    }
  }

  visit(root);
  return [...new Set(values)].slice(0, limit);
}

function firstValue(root: any, keyPattern: RegExp): string {
  const found = walkUsefulValues(root, keyPattern, 1)[0] || '';
  return found.includes(': ') ? found.split(': ').slice(1).join(': ').trim() : found;
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
  if (snapshot.currentContacts.length) lines.push(`当前接触: ${snapshot.currentContacts.join('；')}`);
  if (snapshot.daoists.length) lines.push(`道友/主要NPC: ${snapshot.daoists.join('；')}`);
  if (snapshot.cgState.length) lines.push(`CG/相册: ${snapshot.cgState.join('；')}`);
  if (snapshot.customRoles.length) lines.push(`状态栏自定义角色: ${snapshot.customRoles.join('、')}`);
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
      daoists: walkUsefulValues(statData, /道友录|主要NPC|道友|好感|关系/, 20).map(item => item.slice(0, 120)),
      currentContacts: walkUsefulValues(statData, /当前接触人物|当前接触角色|当前接触|在场|现场/, 16).map(item => item.slice(0, 120)),
      cgState: walkUsefulValues(statData, /CG|相册|插图|画廊/, 12).map(item => item.slice(0, 120)),
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
  const rawBrief = snapshot.rawStatData ? tryStringify(snapshot.rawStatData).slice(0, 5000) : '';
  return [snapshot.summaryText, rawBrief ? `<mvu_raw_digest>${rawBrief}</mvu_raw_digest>` : ''].filter(Boolean).join('\n');
}
