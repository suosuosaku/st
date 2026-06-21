type AnyRecord = Record<string, any>;

const AVATAR_DB_NAME = 'eldred-avatar-db';
const AVATAR_STORE_NAME = 'avatars';
const AVATAR_DB_VERSION = 1;

export type EldredAvatarOwnerType = 'player' | 'npc';
export type EldredAvatarKind = 'avatar' | 'portrait';
export type EldredAvatarSourceType = 'upload' | 'url';

export type EldredAvatarRecord = {
  key: string;
  ownerType: EldredAvatarOwnerType;
  ownerName: string;
  imageKind: EldredAvatarKind;
  scopeKey: string;
  sourceType: EldredAvatarSourceType;
  value: string;
  updatedAt: number;
};

const asRecord = (value: unknown): AnyRecord => (
  value && typeof value === 'object' ? value as AnyRecord : {}
);

const textOf = (value: unknown) => String(value ?? '').trim();

const safeScope = (scopeFactory: () => unknown): AnyRecord | null => {
  try {
    const scope = scopeFactory();
    return scope && typeof scope === 'object' ? scope as AnyRecord : null;
  } catch {
    return null;
  }
};

const hostScopes = (): AnyRecord[] => {
  if (typeof window === 'undefined') return [globalThis as AnyRecord];
  return Array.from(new Set([
    safeScope(() => globalThis),
    safeScope(() => window),
    safeScope(() => window.parent),
    safeScope(() => window.top),
    safeScope(() => window.opener),
  ].filter((scope): scope is AnyRecord => Boolean(scope))));
};

const hostFunction = <T extends (...args: any[]) => any>(name: string): T | null => {
  for (const scope of hostScopes()) {
    try {
      if (typeof scope[name] === 'function') return scope[name] as T;
      const bridge = scope.__eldredWelcomeBridge;
      if (bridge && typeof bridge[name] === 'function') return bridge[name] as T;
      const tavern = scope.TavernHelper;
      if (tavern && typeof tavern[name] === 'function') return tavern[name] as T;
    } catch {
      // Cross-origin scopes can throw.
    }
  }
  return null;
};

const readCurrentCharacterName = () => {
  const getCurrentCharacterName = hostFunction<() => string>('getCurrentCharacterName');
  if (getCurrentCharacterName) {
    try {
      const name = textOf(getCurrentCharacterName());
      if (name) return name;
    } catch {
      // Try other sources below.
    }
  }

  for (const scope of hostScopes()) {
    try {
      const rawCharacter = scope.RawCharacter;
      if (rawCharacter && typeof rawCharacter.find === 'function') {
        const character = asRecord(rawCharacter.find({ name: 'current', allowAvatar: true }));
        const data = asRecord(character.data);
        const name = textOf(data.name ?? character.name);
        if (name) return name;
      }
      if (typeof scope.getCharData === 'function') {
        const character = asRecord(scope.getCharData('current'));
        const data = asRecord(character.data);
        const name = textOf(data.name ?? character.name);
        if (name) return name;
      }
    } catch {
      // Try the next host scope.
    }
  }

  return '艾尔德雷德';
};

export const getEldredAvatarScopeKey = () => `eldred:${readCurrentCharacterName()}`;

const avatarKey = (
  scopeKey: string,
  ownerType: EldredAvatarOwnerType,
  ownerName: string,
  imageKind: EldredAvatarKind,
) => `${scopeKey}::${ownerType}::${ownerName}::${imageKind}`;

const openAvatarDatabase = async (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(AVATAR_DB_NAME, AVATAR_DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(AVATAR_STORE_NAME)) {
        const store = database.createObjectStore(AVATAR_STORE_NAME, { keyPath: 'key' });
        store.createIndex('scopeKey', 'scopeKey', { unique: false });
        store.createIndex('ownerType', 'ownerType', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const readRequest = <T,>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const withStore = async <T,>(
  mode: IDBTransactionMode,
  handler: (store: IDBObjectStore) => Promise<T>,
): Promise<T> => {
  const database = await openAvatarDatabase();
  try {
    const transaction = database.transaction(AVATAR_STORE_NAME, mode);
    const store = transaction.objectStore(AVATAR_STORE_NAME);
    const result = await handler(store);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    return result;
  } finally {
    database.close();
  }
};

export const getEldredAvatarRecord = async (
  scopeKey: string,
  ownerType: EldredAvatarOwnerType,
  ownerName: string,
  imageKind: EldredAvatarKind,
): Promise<EldredAvatarRecord | null> =>
  withStore('readonly', async store => {
    const record = await readRequest(store.get(avatarKey(scopeKey, ownerType, ownerName, imageKind)));
    return (record as EldredAvatarRecord | undefined) ?? null;
  });

export const saveEldredAvatarRecord = async (
  avatarRecord: Omit<EldredAvatarRecord, 'key' | 'updatedAt'>,
): Promise<EldredAvatarRecord> => {
  const nextRecord: EldredAvatarRecord = {
    ...avatarRecord,
    key: avatarKey(avatarRecord.scopeKey, avatarRecord.ownerType, avatarRecord.ownerName, avatarRecord.imageKind),
    updatedAt: Date.now(),
  };
  return withStore('readwrite', async store => {
    await readRequest(store.put(nextRecord));
    return nextRecord;
  });
};

export const removeEldredAvatarRecord = async (
  scopeKey: string,
  ownerType: EldredAvatarOwnerType,
  ownerName: string,
  imageKind?: EldredAvatarKind,
) => withStore('readwrite', async store => {
  if (imageKind) {
    await readRequest(store.delete(avatarKey(scopeKey, ownerType, ownerName, imageKind)));
    return;
  }
  await readRequest(store.delete(avatarKey(scopeKey, ownerType, ownerName, 'avatar')));
  await readRequest(store.delete(avatarKey(scopeKey, ownerType, ownerName, 'portrait')));
});

export const readEldredAvatarFileAsDataUrl = async (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const normalizeTavernAvatarPath = (value: unknown) => {
  const path = textOf(value);
  if (!path || path === '{{userAvatarPath}}' || path === 'none') return '';
  return path;
};

export const resolveSillyTavernUserAvatar = async () => {
  const substituteParams = hostFunction<(text: string) => string | Promise<string>>('substituteParams');
  if (substituteParams) {
    try {
      const path = normalizeTavernAvatarPath(await substituteParams('{{userAvatarPath}}'));
      if (path) return path;
    } catch {
      // Try direct SillyTavern scopes below.
    }
  }

  for (const scope of hostScopes()) {
    try {
      const tavern = asRecord(scope.SillyTavern);
      if (typeof tavern.substituteParams === 'function') {
        const path = normalizeTavernAvatarPath(await tavern.substituteParams('{{userAvatarPath}}'));
        if (path) return path;
      }
      if (typeof scope.SillyTavern?.substituteParams === 'function') {
        const path = normalizeTavernAvatarPath(await scope.SillyTavern.substituteParams('{{userAvatarPath}}'));
        if (path) return path;
      }
    } catch {
      // Try getThumbnailUrl fallbacks below.
    }
  }

  for (const scope of hostScopes()) {
    try {
      const avatarFile = textOf(
        scope.user_avatar ??
        scope.power_user?.default_persona ??
        scope.power_user?.user_avatar ??
        scope.settings?.user_avatar ??
        scope.SillyTavern?.power_user?.default_persona ??
        scope.SillyTavern?.user_avatar
      );
      if (!avatarFile || avatarFile === 'none') continue;
      if (/^(https?:|data:|blob:|\/)/i.test(avatarFile)) return avatarFile;
      const getThumbnailUrl =
        typeof scope.getThumbnailUrl === 'function'
          ? scope.getThumbnailUrl
          : typeof scope.__eldredWelcomeBridge?.getThumbnailUrl === 'function'
            ? scope.__eldredWelcomeBridge.getThumbnailUrl
            : null;
      if (getThumbnailUrl) {
        const url = textOf(getThumbnailUrl('persona', avatarFile));
        if (url) return url;
      }
      return `User Avatars/${encodeURIComponent(avatarFile)}`;
    } catch {
      // Try the next host scope.
    }
  }

  return '';
};
