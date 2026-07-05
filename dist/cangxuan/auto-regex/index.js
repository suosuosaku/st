// 苍玄界：远端正则美化包调度脚本
// 只注册 GitHub 远端 regex.json 里的美化规则，不接管酒馆内已有正则。
$(() => {
  const BUILD_ID = 'cangxuan-auto-regex-v1.2.2';
  const PACKAGE_MARKER = 'cx-auto-regex';
  const PACKAGE_ID_PREFIX = 'cx-auto-regex:';
  const SYNC_DELAY_MS = 650;
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

  const ADAPTIVE_RULES = [
    { name: '悬赏接取美化', quick: ['<赏令接取>'], pattern: /<赏令接取>/ },
    { name: '拍卖购入美化', quick: ['<拍卖购入>'], pattern: /<拍卖购入>/ },
    { name: '盲盒开启美化', quick: ['<盲盒开启>'], pattern: /<盲盒开启>/ },
    { name: '道友收录美化', quick: ['<道友收录>'], pattern: /<道友收录>/ },
    { name: '悬赏完成美化', quick: ['<赏令完成>'], pattern: /<赏令完成>/ },
    { name: '飞剑传书回信美化', quick: ['<飞剑回信>'], pattern: /<飞剑回信>/ },
    { name: '自由开局美化', quick: ['<自由开局>'], pattern: /<自由开局>/ },
  ];

  const ADAPTIVE_NAMES = new Set(ADAPTIVE_RULES.map(rule => rule.name));
  let adaptiveRegexPackagePromise = null;
  let adaptiveRegexEntries = [];
  let syncTimer = null;
  let syncing = false;
  let pending = false;
  let lastRerenderSignature = '';
  let shouldSyncLatest = false;
  const queuedMessageIds = new Set();
  const mutedMessageIds = new Map();

  function getGlobal(name) {
    try {
      if (globalThis[name] !== undefined) return globalThis[name];
    } catch (_) {}
    try {
      if (window.parent && window.parent !== window && window.parent[name] !== undefined) return window.parent[name];
    } catch (_) {}
    return undefined;
  }

  function toFiniteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function normalizeMessage(raw, fallbackId = null) {
    const messageId = toFiniteNumber(fallbackId);
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'string') return { message: raw, message_id: messageId };
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

  function normalizeMessageList(messages, fallbackId = null) {
    return (Array.isArray(messages) ? messages : [])
      .map(message => normalizeMessage(message, fallbackId))
      .filter(Boolean);
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

  function getMessageById(messageId) {
    const getChatMessagesFn = getGlobal('getChatMessages');
    if (typeof getChatMessagesFn !== 'function') return null;
    const attempts = [
      () => getChatMessagesFn(messageId),
      () => getChatMessagesFn(String(messageId)),
      () => getChatMessagesFn(`${messageId}-${messageId}`),
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
    if (lastError) console.warn('[苍玄界自动正则] 读取指定楼层失败', { messageId, error: lastError });
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

  async function rerenderOnceForNewPackageRule(latest, newlyEnabledRules) {
    if (!latest || !Number.isFinite(latest.message_id) || !newlyEnabledRules.length) return;
    const signature = `${latest.message_id}:${newlyEnabledRules.slice().sort().join('|')}:${hashText(latest.message || '')}`;
    if (signature === lastRerenderSignature) return;
    lastRerenderSignature = signature;
    mutedMessageIds.set(latest.message_id, Date.now() + 1500);

    const setChatMessagesFn = getGlobal('setChatMessages');
    if (typeof setChatMessagesFn !== 'function') return;
    try {
      await setChatMessagesFn([{ message_id: latest.message_id }], { refresh: 'affected' });
    } catch (error) {
      console.warn('[苍玄界自动正则] 首次启用远端美化包后刷新当前楼层失败', error);
    }
  }

  function isMutedMessageId(messageId) {
    const until = mutedMessageIds.get(messageId);
    if (!until) return false;
    if (Date.now() <= until) return true;
    mutedMessageIds.delete(messageId);
    return false;
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
    const legacyId = String(raw.id || '');
    return {
      id: `${PACKAGE_ID_PREFIX}${legacyId || name}`,
      legacy_id: legacyId,
      cangxuan_auto_regex: true,
      metadata: {
        owner: PACKAGE_MARKER,
        build: BUILD_ID,
      },
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
          if (!entries.length) throw new Error('远端正则美化包为空');
          adaptiveRegexEntries = entries;
          console.info('[苍玄界自动正则] 远端正则美化包加载完成', { build: BUILD_ID, count: entries.length, url });
          return entries;
        } catch (error) {
          lastError = error;
          console.warn('[苍玄界自动正则] 远端正则美化包加载失败，尝试备用地址', { url, error });
        }
      }
      throw lastError || new Error('远端正则美化包加载失败');
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

  function getRegexReplaceString(regex) {
    if (!regex) return '';
    if (typeof regex.replace_string === 'string') return regex.replace_string;
    if (typeof regex.replaceString === 'string') return regex.replaceString;
    return '';
  }

  function isOwnedPackagedRegex(regex) {
    const id = String(regex?.id || '');
    if (id.startsWith(PACKAGE_ID_PREFIX)) return true;
    if (regex?.cangxuan_auto_regex === true) return true;
    if (regex?.metadata?.owner === PACKAGE_MARKER) return true;
    return false;
  }

  function isPackagedRegex(regex) {
    return isOwnedPackagedRegex(regex);
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

  function buildPackagedRegexList(regexes, entries) {
    const next = (Array.isArray(regexes) ? regexes : []).filter(regex => !isPackagedRegex(regex));
    const activeEntries = entries.map(entry => ({ ...entry }));
    return [...next, ...activeEntries];
  }

  function needsPackagedRegexUpdate(regexes, entries) {
    const current = (Array.isArray(regexes) ? regexes : [])
      .filter(regex => isPackagedRegex(regex))
      .map(regexContentSignature)
      .join('\n');
    const next = entries
      .map(regexContentSignature)
      .join('\n');
    return current !== next;
  }

  async function syncPackagedRegexes(reason = 'manual') {
    const updateTavernRegexesWithFn = getGlobal('updateTavernRegexesWith');
    const getTavernRegexesFn = getGlobal('getTavernRegexes');
    if (typeof updateTavernRegexesWithFn !== 'function') {
      console.warn('[苍玄界自动正则] 未找到 updateTavernRegexesWith，无法注册远端正则美化包');
      return;
    }

    const entries = await loadAdaptiveRegexPackage();
    if (typeof getTavernRegexesFn === 'function') {
      try {
        const current = getTavernRegexesFn({ type: 'character', name: 'current' }) || [];
        if (!needsPackagedRegexUpdate(current, entries)) return false;
      } catch (_) {}
    }

    await updateTavernRegexesWithFn(regexes => buildPackagedRegexList(regexes || [], entries), {
      type: 'character',
      name: 'current',
    });
    console.info('[苍玄界自动正则] 已同步远端正则美化包', {
      reason,
      build: BUILD_ID,
      count: entries.length,
    });
    return true;
  }

  async function syncMessage(message, reason = 'manual') {
    const changed = await syncPackagedRegexes(reason);
    if (!changed) return;
    await rerenderOnceForNewPackageRule(message || getLatestMessage(), ADAPTIVE_RULES.map(rule => rule.name));
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
    scheduleSync('bootstrap');
  }

  init().catch(error => console.warn('[苍玄界自动正则] 初始化失败', error));

  $(window).on('pagehide', () => {
    if (syncTimer) clearTimeout(syncTimer);
  });
});
