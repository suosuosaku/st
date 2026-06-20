type AnyRecord = Record<string, any>;

export const ELDRED_DEDICATED_PRESET_NAME = '艾尔德雷德专用预设';
export const ELDRED_DEDICATED_WORLDBOOK_NAME = '艾尔德雷德世界书';

const RESOURCE_DIR = '专用预设与世界书';
const PRESET_FILENAME = '专用预设.json';
const WORLDBOOK_FILENAME = '艾尔德雷德世界书.json';

export type DedicatedResourceStatus = {
  presetImported: boolean;
  presetLoaded: boolean;
  worldbookImported: boolean;
  worldbookEnabled: boolean;
  loadedPresetName?: string;
};
export type DedicatedInstallResult = {
  presetImported: boolean;
  presetLoaded: boolean;
  worldbookName: string;
  sourceEntries: number;
  overwritten: number;
  added: number;
  enabledGlobally: boolean;
};

const safeScope = (scopeFactory: () => unknown): AnyRecord | null => {
  try {
    const scope = scopeFactory();
    return scope && typeof scope === 'object' ? scope as AnyRecord : null;
  } catch {
    return null;
  }
};

const hostScopes = (): AnyRecord[] => {
  const scopes = [
    safeScope(() => globalThis),
    safeScope(() => window),
    safeScope(() => window.parent),
    safeScope(() => window.top),
    safeScope(() => window.opener),
  ].filter((scope): scope is AnyRecord => Boolean(scope));
  return Array.from(new Set(scopes));
};

const hostFunction = <T extends (...args: any[]) => any>(name: string): T | null => {
  for (const scope of hostScopes()) {
    try {
      if (typeof scope[name] === 'function') return scope[name] as T;
      const bridge = scope.__eldredWelcomeBridge;
      if (bridge && typeof bridge[name] === 'function') return bridge[name] as T;
    } catch {
      // Cross-origin frames can throw.
    }
  }
  return null;
};

const resourceUrl = (filename: string) => {
  const base = String((globalThis as AnyRecord).__ELDRED_FULL_UI_BASE__ || document.baseURI || window.location.href);
  return new URL(`../../${RESOURCE_DIR}/${filename}`, base).href;
};

const fetchResourceText = async (filename: string) => {
  const response = await fetch(resourceUrl(filename), { cache: 'no-cache' });
  if (!response.ok) throw Error(`${filename} 读取失败：${response.status}`);
  return response.text();
};

const ensureStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? Array.from(new Set(value.map(item => String(item).trim()).filter(Boolean))) : [];

const secondaryLogic: Record<number, string> = {
  0: 'and_any',
  1: 'not_all',
  2: 'not_any',
  3: 'and_all',
};

const positionType: Record<number, string> = {
  0: 'before_character_definition',
  1: 'after_character_definition',
  2: 'before_author_note',
  3: 'after_author_note',
  4: 'at_depth',
  5: 'before_example_messages',
  6: 'after_example_messages',
};

const roleType: Record<number, string> = {
  0: 'system',
  1: 'user',
  2: 'assistant',
};

const convertWorldbookEntry = (entry: AnyRecord, index: number): AnyRecord => ({
  name: String(entry.comment || entry.name || `艾尔德雷德|未命名|${index}`),
  enabled: entry.disable !== true,
  strategy: {
    type: entry.constant ? 'constant' : entry.vectorized ? 'vectorized' : 'selective',
    keys: ensureStringArray(entry.key),
    keys_secondary: {
      logic: secondaryLogic[entry.selectiveLogic ?? 0] || 'and_any',
      keys: ensureStringArray(entry.keysecondary),
    },
    scan_depth: typeof entry.scanDepth === 'number' ? entry.scanDepth : 'same_as_global',
  },
  position: {
    type: positionType[entry.position ?? 0] || 'before_character_definition',
    role: roleType[entry.role ?? 0] || 'system',
    depth: typeof entry.depth === 'number' ? entry.depth : 4,
    order: typeof entry.order === 'number' ? entry.order : index,
  },
  content: String(entry.content || ''),
  probability: typeof entry.probability === 'number' ? entry.probability : 100,
  recursion: {
    prevent_incoming: Boolean(entry.excludeRecursion),
    prevent_outgoing: Boolean(entry.preventRecursion),
    delay_until: typeof entry.delayUntilRecursion === 'number' ? entry.delayUntilRecursion : null,
  },
  effect: {
    sticky: typeof entry.sticky === 'number' ? entry.sticky : null,
    cooldown: typeof entry.cooldown === 'number' ? entry.cooldown : null,
    delay: typeof entry.delay === 'number' ? entry.delay : null,
  },
  extra: {
    ...(entry.extra || {}),
    eldredDedicatedResource: {
      source: 'dedicated_resource_pack',
      originalUid: entry.uid,
      originalDisplayIndex: entry.displayIndex,
    },
  },
});

const getWorldbookSourceEntries = async () => {
  const raw = JSON.parse(await fetchResourceText(WORLDBOOK_FILENAME));
  const entries = raw?.entries;
  if (!entries) throw Error('世界书文件缺少 entries。');
  const values = Array.isArray(entries) ? entries : Object.values(entries);
  return values.map((entry, index) => convertWorldbookEntry(entry as AnyRecord, index));
};

export const getDedicatedResourceStatus = (): DedicatedResourceStatus => {
  const getPresetNames = hostFunction<() => string[]>('getPresetNames');
  const getLoadedPresetName = hostFunction<() => string | undefined>('getLoadedPresetName');
  const getWorldbookNames = hostFunction<() => string[]>('getWorldbookNames');
  const getGlobalWorldbookNames = hostFunction<() => string[]>('getGlobalWorldbookNames');
  const presetNames = getPresetNames?.() || [];
  const loadedPresetName = getLoadedPresetName?.();
  const worldbookNames = getWorldbookNames?.() || [];
  const globalWorldbooks = getGlobalWorldbookNames?.() || [];
  return {
    presetImported: presetNames.includes(ELDRED_DEDICATED_PRESET_NAME),
    presetLoaded: loadedPresetName === ELDRED_DEDICATED_PRESET_NAME,
    worldbookImported: worldbookNames.includes(ELDRED_DEDICATED_WORLDBOOK_NAME),
    worldbookEnabled: globalWorldbooks.includes(ELDRED_DEDICATED_WORLDBOOK_NAME),
    loadedPresetName,
  };
};

export const installDedicatedResources = async (): Promise<DedicatedInstallResult> => {
  const importRawPreset = hostFunction<(name: string, raw: string) => Promise<boolean> | boolean>('importRawPreset');
  const loadPreset = hostFunction<(name: string) => boolean>('loadPreset');
  const getWorldbookNames = hostFunction<() => string[]>('getWorldbookNames');
  const getWorldbook = hostFunction<(name: string) => Promise<AnyRecord[]> | AnyRecord[]>('getWorldbook');
  const createWorldbook = hostFunction<(name: string, entries: AnyRecord[]) => Promise<unknown> | unknown>('createWorldbook');
  const createOrReplaceWorldbook = hostFunction<(name: string, entries: AnyRecord[], option?: AnyRecord) => Promise<unknown> | unknown>('createOrReplaceWorldbook');
  const getGlobalWorldbookNames = hostFunction<() => string[]>('getGlobalWorldbookNames');
  const rebindGlobalWorldbooks = hostFunction<(names: string[]) => Promise<unknown> | unknown>('rebindGlobalWorldbooks');

  if (!importRawPreset || !loadPreset) throw Error('未检测到预设导入接口。');
  if (!getWorldbookNames || !getWorldbook || !createWorldbook || !createOrReplaceWorldbook) throw Error('未检测到世界书接口。');

  const presetRaw = await fetchResourceText(PRESET_FILENAME);
  const presetImported = Boolean(await importRawPreset(ELDRED_DEDICATED_PRESET_NAME, presetRaw));
  const presetLoaded = Boolean(loadPreset(ELDRED_DEDICATED_PRESET_NAME));

  const targetName = ELDRED_DEDICATED_WORLDBOOK_NAME;
  if (!getWorldbookNames().includes(targetName)) {
    await createWorldbook(targetName, []);
  }
  const existingEntries = await getWorldbook(targetName);
  const sourceEntries = await getWorldbookSourceEntries();
  const sourceByName = new Map(sourceEntries.map(entry => [entry.name, entry]));
  let overwritten = 0;
  const merged = existingEntries.map(entry => {
    const next = sourceByName.get(entry.name);
    if (!next) return entry;
    overwritten += 1;
    sourceByName.delete(entry.name);
    return next;
  });
  const additions = Array.from(sourceByName.values());
  await createOrReplaceWorldbook(targetName, [...merged, ...additions], { render: 'debounced' });

  let enabledGlobally = false;
  if (getGlobalWorldbookNames && rebindGlobalWorldbooks) {
    const current = getGlobalWorldbookNames();
    if (!current.includes(targetName)) {
      await rebindGlobalWorldbooks([...current, targetName]);
      enabledGlobally = true;
    }
  }

  return {
    presetImported,
    presetLoaded,
    worldbookName: targetName,
    sourceEntries: sourceEntries.length,
    overwritten,
    added: additions.length,
    enabledGlobally,
  };
};
