// 苍玄界：自动正则调度脚本
// 扫描最新楼层，按内容从正则美化包注册本局需要的角色卡正则。
$(() => {
  const BUILD_ID = 'cangxuan-auto-regex-v1.1.0';
  const CHAT_VAR_ENABLED = 'cx_auto_regex_enabled_names';
  const CHAT_VAR_LAST_MESSAGE_ID = 'cx_auto_regex_last_message_id';
  const CUSTOM_ROLE_STORAGE_KEY = 'cx_status_custom_roles_v1';
  const USER_AVATAR_STORAGE_KEY = 'cx_status_user_avatar_v1';
  const CUSTOM_ROLE_SYNC_EVENT = 'cx-status-custom-role-sync';
  const DIALOGUE_REGEX_NAME = '对话美化（气泡版）';
  const AVATAR_BLOCK_START = '/* cx-auto-avatar:start */';
  const AVATAR_BLOCK_END = '/* cx-auto-avatar:end */';
  const SYNC_DELAY_MS = 650;
  const AVATAR_SYNC_DELAY_MS = 900;
  const INIT_GRACE_MS = 3500;
  const REGEX_PACKAGE_URLS = (() => {
    const fallback = [
      'https://testingcf.jsdelivr.net/gh/suosuosaku/st@master/dist/cangxuan/auto-regex/regex.json',
      'https://cdn.jsdelivr.net/gh/suosuosaku/st@master/dist/cangxuan/auto-regex/regex.json',
      'https://gcore.jsdelivr.net/gh/suosuosaku/st@master/dist/cangxuan/auto-regex/regex.json',
    ];
    try {
      return [new URL('./regex.json', import.meta.url).href, ...fallback];
    } catch (_) {
      return fallback;
    }
  })();

  const ALWAYS_ON = [
    '开场白',
    '对话美化（气泡版）',
    '心声美化',
    '[不发送]去除变量更新',
    '防隐藏状态栏占位',
    '仅格式思维链',
    '对 AI 隐藏状态栏',
    '小索思考完成',
    '小索思考中',
    '天道审查美化',
  ];

  const ADAPTIVE_RULES = [
    { name: '悬赏接取美化', quick: ['<赏令接取>'], pattern: /<赏令接取>/ },
    { name: '拍卖购入美化', quick: ['<拍卖购入>'], pattern: /<拍卖购入>/ },
    { name: '盲盒开启美化', quick: ['<盲盒开启>'], pattern: /<盲盒开启>/ },
    { name: '道友收录美化', quick: ['<道友收录>'], pattern: /<道友收录>/ },
    { name: '悬赏完成美化', quick: ['<赏令完成>'], pattern: /<赏令完成>/ },
    { name: '飞剑传书回信美化', quick: ['<飞剑回信>'], pattern: /<飞剑回信>/ },
    { name: '自由开局美化', quick: ['<自由开局>'], pattern: /<自由开局>/ },
  ];

  const LOCAL_ADAPTIVE_RULES = [
    { name: '插图', quick: ['<插图>'], pattern: /<插图>[^<\n\s]+<\/插图>/ },
  ];

  const ADAPTIVE_NAMES = new Set(ADAPTIVE_RULES.map(rule => rule.name));
  const STATIC_NAMES = new Set(ALWAYS_ON);
  const INSERT_BEFORE_NAMES = new Set([
    '只发送最新3楼的变量更新',
    '状态栏美化',
    '仅格式思维链',
    '对 AI 隐藏状态栏',
    '小索思考完成',
    '小索思考中',
    '不发送插图',
    '天道审查美化',
    '[不发送]去除变量更新',
    '防隐藏状态栏占位',
  ]);
  let adaptiveRegexPackagePromise = null;
  let adaptiveRegexEntries = [];
  let syncTimer = null;
  let syncing = false;
  let pending = false;
  let lastRerenderSignature = '';
  let shouldSyncLatest = false;
  let avatarSyncTimer = null;
  let avatarSyncing = false;
  let pendingAvatarSync = false;
  let lastAvatarSignature = '';
  const queuedMessageIds = new Set();
  const mutedMessageIds = new Map();
  const startedAt = Date.now();

  function getGlobal(name) {
    try {
      if (globalThis[name] !== undefined) return globalThis[name];
    } catch (_) {}
    try {
      if (window.parent && window.parent !== window && window.parent[name] !== undefined) return window.parent[name];
    } catch (_) {}
    return undefined;
  }

  function getChatVars() {
    const getVariablesFn = getGlobal('getVariables');
    if (typeof getVariablesFn !== 'function') return {};
    try {
      return getVariablesFn({ type: 'chat' }) || {};
    } catch (error) {
      console.warn('[苍玄界自动正则] 读取聊天变量失败', error);
      return {};
    }
  }

  function updateChatVars(updater) {
    const updateVariablesWithFn = getGlobal('updateVariablesWith');
    if (typeof updateVariablesWithFn !== 'function') return null;
    try {
      return updateVariablesWithFn(variables => {
        const next = variables && typeof variables === 'object' ? variables : {};
        return updater(next) || next;
      }, { type: 'chat' });
    } catch (error) {
      console.warn('[苍玄界自动正则] 写入聊天变量失败', error);
      return null;
    }
  }

  function persistEnabledNames(names, messageId) {
    const unique = [...new Set(names)].filter(name => ADAPTIVE_NAMES.has(name));
    const vars = getChatVars();
    const currentNames = Array.isArray(vars[CHAT_VAR_ENABLED]) ? vars[CHAT_VAR_ENABLED] : [];
    const sameNames = JSON.stringify([...new Set(currentNames)].filter(name => ADAPTIVE_NAMES.has(name)).sort())
      === JSON.stringify([...unique].sort());
    const sameMessage = messageId === undefined || messageId === null || vars[CHAT_VAR_LAST_MESSAGE_ID] === messageId;
    if (sameNames && sameMessage) return;
    updateChatVars(variables => {
      variables[CHAT_VAR_ENABLED] = unique;
      if (messageId !== undefined && messageId !== null) variables[CHAT_VAR_LAST_MESSAGE_ID] = messageId;
      return variables;
    });
  }

  function getStoredAdaptiveNames() {
    const vars = getChatVars();
    const names = Array.isArray(vars[CHAT_VAR_ENABLED]) ? vars[CHAT_VAR_ENABLED] : [];
    return [...new Set(names)].filter(name => ADAPTIVE_NAMES.has(name));
  }

  function toFiniteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function normalizeMessage(raw, fallbackId = null) {
    const messageId = toFiniteNumber(fallbackId);
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'string') {
      return { message: raw, message_id: messageId };
    }
    if (typeof raw === 'object') {
      const rawMessage = raw.message ?? raw.mes ?? raw.text ?? raw.content ?? '';
      const rawId = raw.message_id ?? raw.messageId ?? raw.id ?? raw.mesid ?? fallbackId;
      return {
        message: String(rawMessage ?? ''),
        message_id: toFiniteNumber(rawId),
      };
    }
    return { message: String(raw), message_id: messageId };
  }

  function getLastMessageIdValue() {
    const getLastMessageIdFn = getGlobal('getLastMessageId');
    if (typeof getLastMessageIdFn !== 'function') return null;
    try {
      return toFiniteNumber(getLastMessageIdFn());
    } catch (error) {
      console.warn('[苍玄界自动正则] 读取最新楼层编号失败', error);
      return null;
    }
  }

  function normalizeMessageList(messages, fallbackId = null) {
    return (Array.isArray(messages) ? messages : [])
      .map(message => normalizeMessage(message, fallbackId))
      .filter(Boolean);
  }

  function getMessageById(messageId) {
    const getChatMessagesFn = getGlobal('getChatMessages');
    if (typeof getChatMessagesFn !== 'function') return null;
    const attempts = [
      () => getChatMessagesFn(messageId),
      () => getChatMessagesFn(String(messageId)),
      () => getChatMessagesFn(`${messageId}-${messageId}`),
      () => messageId === 0 ? getChatMessagesFn(1) : null,
      () => getChatMessagesFn(messageId, messageId + 1),
    ];
    let lastError = null;
    for (const attempt of attempts) {
      try {
        const messages = normalizeMessageList(attempt(), messageId);
        if (messages.length) return messages[messages.length - 1];
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError) {
      console.warn('[苍玄界自动正则] 读取指定楼层失败', { messageId, error: lastError });
    }
    return null;
  }

  function getLatestMessage() {
    const getChatMessagesFn = getGlobal('getChatMessages');
    if (typeof getChatMessagesFn !== 'function') return null;
    const lastMessageId = getLastMessageIdValue();
    const byId = lastMessageId !== null && lastMessageId >= 0 ? getMessageById(lastMessageId) : null;
    if (byId) return byId;
    try {
      const messages = normalizeMessageList(getChatMessagesFn(-1), lastMessageId);
      return messages.length ? messages[messages.length - 1] : null;
    } catch (error) {
      console.warn('[苍玄界自动正则] 读取最新楼层失败', error);
      return null;
    }
  }

  function hashText(text) {
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
    }
    return String(hash);
  }

  async function rerenderLatestMessageIfNeeded(latest, triggeredRules) {
    if (!latest || !Number.isFinite(latest.message_id) || !triggeredRules.length) return;
    const signature = `${latest.message_id}:${triggeredRules.slice().sort().join('|')}:${hashText(latest.message || '')}`;
    if (signature === lastRerenderSignature) return;
    lastRerenderSignature = signature;
    mutedMessageIds.set(latest.message_id, Date.now() + 1500);

    const setChatMessagesFn = getGlobal('setChatMessages');
    if (typeof setChatMessagesFn === 'function') {
      try {
        await setChatMessagesFn([{ message_id: latest.message_id }], { refresh: 'affected' });
        return;
      } catch (error) {
        console.warn('[苍玄界自动正则] 重渲染当前楼层失败', error);
      }
    }

    const reloadAndRenderChatWithoutEventsFn = getGlobal('reloadAndRenderChatWithoutEvents');
    if (typeof reloadAndRenderChatWithoutEventsFn === 'function') {
      try {
        await reloadAndRenderChatWithoutEventsFn();
      } catch (error) {
        console.warn('[苍玄界自动正则] 刷新聊天显示失败', error);
      }
    }
  }

  function isMutedMessageId(messageId) {
    const until = mutedMessageIds.get(messageId);
    if (!until) return false;
    if (Date.now() <= until) return true;
    mutedMessageIds.delete(messageId);
    return false;
  }

  function collectTriggeredRules(text, rules = ADAPTIVE_RULES) {
    const triggered = [];
    for (const rule of rules) {
      if (rule.quick?.length && !rule.quick.some(token => text.includes(token))) continue;
      if (!rule.pattern || rule.pattern.test(text)) triggered.push(rule.name);
      if (rule.pattern?.global) rule.pattern.lastIndex = 0;
    }
    return triggered;
  }

  function oldPlacementHas(regex, placement) {
    return Array.isArray(regex?.placement) ? regex.placement.includes(placement) : false;
  }

  function toTrimStrings(value) {
    if (Array.isArray(value)) return value.map(item => String(item ?? ''));
    if (typeof value === 'string') return value ? value.split('\n') : [];
    return [];
  }

  function toPackagedTavernRegex(raw) {
    const name = raw?.script_name || raw?.scriptName || raw?.name || '';
    if (!ADAPTIVE_NAMES.has(name)) return null;
    const markdownOnly = raw.markdownOnly === true;
    const promptOnly = raw.promptOnly === true;
    return {
      id: String(raw.id || `cx-${name}`),
      script_name: name,
      enabled: true,
      find_regex: String(raw.find_regex ?? raw.findRegex ?? ''),
      replace_string: String(raw.replace_string ?? raw.replaceString ?? ''),
      trim_strings: toTrimStrings(raw.trim_strings ?? raw.trimStrings),
      source: {
        user_input: oldPlacementHas(raw, 1),
        ai_output: oldPlacementHas(raw, 2) || !oldPlacementHas(raw, 1),
        slash_command: false,
        world_info: false,
      },
      destination: {
        display: !promptOnly,
        prompt: !markdownOnly,
      },
      run_on_edit: raw.run_on_edit ?? raw.runOnEdit ?? true,
      min_depth: raw.min_depth ?? raw.minDepth ?? null,
      max_depth: raw.max_depth ?? raw.maxDepth ?? 1,
    };
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return response.json();
  }

  async function loadAdaptiveRegexPackage() {
    if (adaptiveRegexPackagePromise) return adaptiveRegexPackagePromise;
    adaptiveRegexPackagePromise = (async () => {
      let lastError = null;
      for (const url of REGEX_PACKAGE_URLS) {
        try {
          const json = await fetchJson(url);
          const entries = (Array.isArray(json) ? json : [])
            .map(toPackagedTavernRegex)
            .filter(Boolean);
          if (!entries.length) throw new Error('正则美化包为空');
          adaptiveRegexEntries = entries;
          console.info('[苍玄界自动正则] 正则美化包加载完成', { build: BUILD_ID, count: entries.length, url });
          return entries;
        } catch (error) {
          lastError = error;
          console.warn('[苍玄界自动正则] 正则美化包加载失败，尝试备用地址', { url, error });
        }
      }
      throw lastError || new Error('正则美化包加载失败');
    })();
    return adaptiveRegexPackagePromise;
  }

  function getRegexName(regex) {
    return regex?.scriptName || regex?.script_name || regex?.name || '';
  }

  function getRegexEnabled(regex) {
    if (!regex) return false;
    if (typeof regex.disabled === 'boolean') return !regex.disabled;
    if (typeof regex.enabled === 'boolean') return regex.enabled;
    return false;
  }

  function setRegexEnabled(regex, enabled) {
    if (!regex) return;
    if ('disabled' in regex) regex.disabled = !enabled;
    if ('enabled' in regex) regex.enabled = enabled;
    if (!('disabled' in regex) && !('enabled' in regex)) regex.disabled = !enabled;
  }

  function getRegexReplaceString(regex) {
    if (!regex) return '';
    if (typeof regex.replace_string === 'string') return regex.replace_string;
    if (typeof regex.replaceString === 'string') return regex.replaceString;
    return '';
  }

  function setRegexReplaceString(regex, value) {
    if (!regex) return;
    if ('replace_string' in regex) regex.replace_string = value;
    if ('replaceString' in regex) regex.replaceString = value;
    if (!('replace_string' in regex) && !('replaceString' in regex)) regex.replace_string = value;
  }

  function readStorageItem(key) {
    try {
      const value = localStorage.getItem(key);
      if (value !== null) return value;
    } catch (_) {}
    try {
      if (window.parent && window.parent !== window) {
        const value = window.parent.localStorage.getItem(key);
        if (value !== null) return value;
      }
    } catch (_) {}
    return null;
  }

  function asCleanText(value, maxLength = 160) {
    return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLength);
  }

  function normalizeImageUrl(value) {
    const url = asCleanText(value, 1600);
    if (!url) return '';
    if (/^(https?:|data:image\/|blob:)/i.test(url)) return url;
    return '';
  }

  function normalizeCustomRole(role) {
    if (!role || typeof role !== 'object') return null;
    const name = asCleanText(role.name, 40);
    const defaultImg = normalizeImageUrl(role.defaultImg || role.avatar || role.avatarUrl);
    if (!name || !defaultImg) return null;
    return { name, defaultImg };
  }

  function loadCustomRoles() {
    try {
      const parsed = JSON.parse(readStorageItem(CUSTOM_ROLE_STORAGE_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      const roleMap = new Map();
      parsed.forEach(role => {
        const normalized = normalizeCustomRole(role);
        if (normalized) roleMap.set(normalized.name, normalized);
      });
      return [...roleMap.values()];
    } catch (_) {
      return [];
    }
  }

  function loadUserAvatarUrl() {
    return normalizeImageUrl(readStorageItem(USER_AVATAR_STORAGE_KEY) || '');
  }

  function resolvePlayerName() {
    const candidates = [];
    try {
      const macroFn = getGlobal('substitudeMacros');
      if (typeof macroFn === 'function') candidates.push(macroFn('{{user}}'));
    } catch (_) {}
    try {
      const st = getGlobal('SillyTavern');
      if (st && typeof st.name1 === 'string') candidates.push(st.name1);
      if (st && typeof st.getContext === 'function') {
        const ctx = st.getContext();
        if (ctx && typeof ctx.name1 === 'string') candidates.push(ctx.name1);
      }
    } catch (_) {}
    try { candidates.push(getGlobal('name1')); } catch (_) {}
    for (const value of candidates) {
      const name = asCleanText(value, 40);
      if (name && name !== '{{user}}' && name !== 'undefined' && name !== 'null') return name;
    }
    return '';
  }

  function cssAttrValue(value) {
    return String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
  }

  function cssUrlValue(value) {
    return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '');
  }

  function stripAvatarBlock(text) {
    return String(text || '').replace(/\/\* cx-auto-avatar:start \*\/[\s\S]*?\/\* cx-auto-avatar:end \*\/\s*/g, '');
  }

  function buildDialogueAvatarCss() {
    const avatarMap = new Map();
    loadCustomRoles().forEach(role => avatarMap.set(role.name, role.defaultImg));

    const userAvatar = loadUserAvatarUrl();
    if (userAvatar) {
      avatarMap.set('{{user}}', userAvatar);
      const playerName = resolvePlayerName();
      if (playerName) avatarMap.set(playerName, userAvatar);
    }

    if (!avatarMap.size) return '';
    const emptyAfterSelectors = [];
    const selectorsByUrl = new Map();
    for (const [name, url] of avatarMap.entries()) {
      const selector = `.compact-dialogue[data-name="${cssAttrValue(name)}"] .compact-avatar`;
      emptyAfterSelectors.push(`${selector}::after`);
      const selectors = selectorsByUrl.get(url) || [];
      selectors.push(selector);
      selectorsByUrl.set(url, selectors);
    }
    const imageRules = [...selectorsByUrl.entries()].map(([url, selectors]) =>
      `${selectors.join(',\n')} { background-image: url('${cssUrlValue(url)}'); }`
    );

    return [
      AVATAR_BLOCK_START,
      `${emptyAfterSelectors.join(',\n')} { content: ""; }`,
      ...imageRules,
      AVATAR_BLOCK_END,
      '',
    ].join('\n');
  }

  function mergeDialogueAvatarCss(replaceString) {
    const clean = stripAvatarBlock(replaceString);
    const block = buildDialogueAvatarCss();
    if (!block) return clean;
    if (clean.includes('</style>')) return clean.replace('</style>', `${block}</style>`);
    return `${clean}\n<style>\n${block}</style>`;
  }

  async function syncDialogueAvatarRegex(reason = 'manual') {
    if (avatarSyncing) {
      pendingAvatarSync = true;
      return;
    }
    avatarSyncing = true;
    try {
      const updateTavernRegexesWithFn = getGlobal('updateTavernRegexesWith');
      const getTavernRegexesFn = getGlobal('getTavernRegexes');
      if (typeof updateTavernRegexesWithFn !== 'function') return;

      const customRoles = loadCustomRoles();
      const signature = JSON.stringify({
        roles: customRoles.map(role => [role.name, role.defaultImg]),
        userAvatar: loadUserAvatarUrl(),
        playerName: resolvePlayerName(),
      });

      if (signature === lastAvatarSignature && typeof getTavernRegexesFn === 'function') return;

      if (typeof getTavernRegexesFn === 'function') {
        try {
          const current = getTavernRegexesFn({ type: 'character', name: 'current' }) || [];
          const target = current.find(regex => getRegexName(regex) === DIALOGUE_REGEX_NAME);
          if (target) {
            const before = getRegexReplaceString(target);
            const after = mergeDialogueAvatarCss(before);
            if (before === after) {
              lastAvatarSignature = signature;
              return;
            }
          }
        } catch (_) {}
      }

      await updateTavernRegexesWithFn(regexes => {
        for (const regex of regexes) {
          if (getRegexName(regex) !== DIALOGUE_REGEX_NAME) continue;
          setRegexReplaceString(regex, mergeDialogueAvatarCss(getRegexReplaceString(regex)));
        }
        return regexes;
      }, { type: 'character', name: 'current' });
      lastAvatarSignature = signature;
      console.debug?.('[苍玄界自动正则] 已同步对话头像', { reason, build: BUILD_ID });
    } catch (error) {
      console.warn('[苍玄界自动正则] 对话头像同步失败', error);
    } finally {
      avatarSyncing = false;
      if (pendingAvatarSync) {
        pendingAvatarSync = false;
        scheduleAvatarSync('pending');
      }
    }
  }

  function scheduleAvatarSync(reason = 'event') {
    if (avatarSyncTimer) clearTimeout(avatarSyncTimer);
    avatarSyncTimer = setTimeout(() => {
      avatarSyncTimer = null;
      syncDialogueAvatarRegex(reason);
    }, AVATAR_SYNC_DELAY_MS);
  }

  function installAvatarSyncEvents() {
    const onSync = () => scheduleAvatarSync('custom-role-event');
    try { window.addEventListener(CUSTOM_ROLE_SYNC_EVENT, onSync); } catch (_) {}
    try {
      if (window.parent && window.parent !== window) window.parent.addEventListener(CUSTOM_ROLE_SYNC_EVENT, onSync);
    } catch (_) {}
    try {
      window.addEventListener('storage', event => {
        if ([CUSTOM_ROLE_STORAGE_KEY, USER_AVATAR_STORAGE_KEY].includes(event.key)) scheduleAvatarSync('storage');
      });
    } catch (_) {}
  }

  function patchReplaceVariablesWatcher() {
    const original = getGlobal('replaceVariables');
    if (typeof original !== 'function' || original.__cxAutoRegexWrapped) return;
    const wrapped = function wrappedReplaceVariables(...args) {
      const result = original.apply(this, args);
      try {
        const option = args[1] || { type: 'chat' };
        if (!option || option.type === 'chat') scheduleSync('replaceVariables');
      } catch (_) {}
      return result;
    };
    Object.defineProperty(wrapped, '__cxAutoRegexWrapped', { value: true });
    try {
      window.replaceVariables = wrapped;
      if (window.parent && window.parent !== window) window.parent.replaceVariables = wrapped;
    } catch (_) {}
  }

  function regexContentSignature(regex) {
    return JSON.stringify({
      id: regex?.id || '',
      name: getRegexName(regex),
      find: regex?.find_regex ?? regex?.findRegex ?? '',
      replace: getRegexReplaceString(regex),
      enabled: getRegexEnabled(regex),
      source: regex?.source ?? null,
      destination: regex?.destination ?? null,
      run_on_edit: regex?.run_on_edit ?? regex?.runOnEdit ?? null,
      min_depth: regex?.min_depth ?? regex?.minDepth ?? null,
      max_depth: regex?.max_depth ?? regex?.maxDepth ?? null,
    });
  }

  function buildPackagedRegexList(regexes, entries, enabledNames) {
    const enabledSet = new Set(enabledNames);
    const packageNames = new Set(entries.map(entry => entry.script_name));
    const next = regexes.filter(regex => !packageNames.has(getRegexName(regex)));
    const activeEntries = entries
      .filter(entry => enabledSet.has(entry.script_name))
      .map(entry => ({ ...entry }));
    if (!activeEntries.length) return next;

    const insertIndex = next.findIndex(regex => INSERT_BEFORE_NAMES.has(getRegexName(regex)));
    if (insertIndex < 0) return [...next, ...activeEntries];
    return [
      ...next.slice(0, insertIndex),
      ...activeEntries,
      ...next.slice(insertIndex),
    ];
  }

  function needsPackagedRegexUpdate(regexes, entries, enabledNames) {
    const current = regexes.map(regexContentSignature).join('\n');
    const next = buildPackagedRegexList(regexes, entries, enabledNames).map(regexContentSignature).join('\n');
    return current !== next;
  }

  async function syncPackagedRegexes(enabledNames, reason = 'manual') {
    const updateTavernRegexesWithFn = getGlobal('updateTavernRegexesWith');
    const getTavernRegexesFn = getGlobal('getTavernRegexes');
    if (typeof updateTavernRegexesWithFn !== 'function') {
      console.warn('[苍玄界自动正则] 未找到 updateTavernRegexesWith，无法注册正则美化包');
      return;
    }

    const entries = await loadAdaptiveRegexPackage();
    const names = [...new Set(enabledNames)].filter(name => ADAPTIVE_NAMES.has(name));
    if (typeof getTavernRegexesFn === 'function') {
      try {
        const current = getTavernRegexesFn({ type: 'character', name: 'current' }) || [];
        if (!needsPackagedRegexUpdate(current, entries, names)) return;
      } catch (_) {}
    }

    await updateTavernRegexesWithFn(regexes => buildPackagedRegexList(regexes || [], entries, names), {
      type: 'character',
      name: 'current',
    });
    console.debug?.('[苍玄界自动正则] 已同步正则美化包', { reason, build: BUILD_ID, enabled: names });
  }

  async function removePackagedRegexes(reason = 'unload') {
    try {
      const updateTavernRegexesWithFn = getGlobal('updateTavernRegexesWith');
      if (typeof updateTavernRegexesWithFn !== 'function') return;
      const entries = adaptiveRegexEntries.length ? adaptiveRegexEntries : await loadAdaptiveRegexPackage();
      const packageNames = new Set(entries.map(entry => entry.script_name));
      if (!packageNames.size) return;
      await updateTavernRegexesWithFn(regexes => (regexes || []).filter(regex => !packageNames.has(getRegexName(regex))), {
        type: 'character',
        name: 'current',
      });
      console.debug?.('[苍玄界自动正则] 已卸载正则美化包', { reason, build: BUILD_ID });
    } catch (error) {
      console.warn('[苍玄界自动正则] 卸载正则美化包失败', error);
    }
  }

  async function applyLocalRegexState(localNames) {
    const updateTavernRegexesWithFn = getGlobal('updateTavernRegexesWith');
    const getTavernRegexesFn = getGlobal('getTavernRegexes');
    if (typeof updateTavernRegexesWithFn !== 'function') {
      console.warn('[苍玄界自动正则] 未找到 updateTavernRegexesWith，无法同步卡内正则');
      return;
    }
    const enabledSet = new Set([...STATIC_NAMES, ...localNames]);
    const localNamesSet = new Set([...STATIC_NAMES, ...LOCAL_ADAPTIVE_RULES.map(rule => rule.name)]);
    if (typeof getTavernRegexesFn === 'function') {
      try {
        const current = getTavernRegexesFn({ type: 'character', name: 'current' }) || [];
        const needsUpdate = current.some(regex => {
          const name = getRegexName(regex);
          return localNamesSet.has(name) && getRegexEnabled(regex) !== enabledSet.has(name);
        });
        if (!needsUpdate) return;
      } catch (_) {}
    }
    await updateTavernRegexesWithFn(regexes => {
      for (const regex of regexes) {
        const name = getRegexName(regex);
        if (!localNamesSet.has(name)) continue;
        setRegexEnabled(regex, enabledSet.has(name));
      }
      return regexes;
    }, { type: 'character', name: 'current' });
  }

  async function syncMessage(message, reason = 'manual') {
    const text = message?.message || '';
    const triggeredPackagedRules = collectTriggeredRules(text, ADAPTIVE_RULES);
    const triggeredLocalRules = collectTriggeredRules(text, LOCAL_ADAPTIVE_RULES);
    const nextPackagedNames = [
      ...getStoredAdaptiveNames(),
      ...triggeredPackagedRules,
    ];
    persistEnabledNames(nextPackagedNames, message?.message_id);
    await syncPackagedRegexes(nextPackagedNames, reason);
    await applyLocalRegexState(triggeredLocalRules);
    await rerenderLatestMessageIfNeeded(message, [...triggeredPackagedRules, ...triggeredLocalRules]);
    console.debug?.('[苍玄界自动正则] 已同步', {
      reason,
      build: BUILD_ID,
      messageId: message?.message_id,
      packaged: [...new Set(nextPackagedNames)].filter(name => ADAPTIVE_NAMES.has(name)),
      local: triggeredLocalRules,
    });
  }

  async function syncNow(reason = 'manual') {
    if (syncing) {
      pending = true;
      return;
    }
    syncing = true;
    try {
      const targetIds = [...queuedMessageIds].sort((a, b) => a - b);
      const includeLatest = shouldSyncLatest || targetIds.length === 0;
      queuedMessageIds.clear();
      shouldSyncLatest = false;

      const messages = [];
      const seenIds = new Set();
      for (const messageId of targetIds) {
        const message = getMessageById(messageId);
        if (!message) continue;
        messages.push(message);
        if (Number.isFinite(message.message_id)) seenIds.add(message.message_id);
      }

      if (includeLatest) {
        const latest = getLatestMessage();
        if (latest && !seenIds.has(latest.message_id)) messages.push(latest);
      }

      if (!messages.length) {
        await syncMessage(null, reason);
      } else {
        for (const message of messages) {
          await syncMessage(message, reason);
        }
      }
    } catch (error) {
      console.warn('[苍玄界自动正则] 同步失败', error);
    } finally {
      syncing = false;
      if (pending) {
        pending = false;
        scheduleSync('pending');
      }
    }
  }

  function scheduleSync(reason = 'event', messageId = null) {
    const targetId = toFiniteNumber(messageId);
    if (targetId !== null && targetId >= 0) {
      if (isMutedMessageId(targetId)) return;
      queuedMessageIds.add(targetId);
    } else {
      shouldSyncLatest = true;
    }
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncTimer = null;
      syncNow(reason);
    }, SYNC_DELAY_MS);
  }

  async function init() {
    const eventOnFn = getGlobal('eventOn');
    const tavernEvents = getGlobal('tavern_events');
    installAvatarSyncEvents();
    patchReplaceVariablesWatcher();
    if (typeof eventOnFn === 'function' && tavernEvents) {
      [
        tavernEvents.MESSAGE_RECEIVED,
        tavernEvents.MESSAGE_SENT,
        tavernEvents.MESSAGE_SWIPED,
        tavernEvents.MESSAGE_UPDATED,
        tavernEvents.CHAT_CHANGED,
      ].filter(Boolean).forEach(eventName => eventOnFn(eventName, (...args) => {
        if (Date.now() - startedAt < INIT_GRACE_MS && eventName === tavernEvents.CHAT_CHANGED) return;
        const messageId = eventName === tavernEvents.CHAT_CHANGED ? null : args[0];
        scheduleSync(eventName, messageId);
      }));
    }

    scheduleAvatarSync('bootstrap');
    scheduleSync('bootstrap');
  }

  init().catch(error => console.warn('[苍玄界自动正则] 初始化失败', error));

  $(window).on('pagehide', () => {
    if (syncTimer) clearTimeout(syncTimer);
    if (avatarSyncTimer) clearTimeout(avatarSyncTimer);
    void removePackagedRegexes('pagehide');
  });
});
