// 苍玄界：自动正则调度脚本
// 参照“命定之诗”的自动正则思路：扫描最新楼层，按内容启用本局需要的角色卡正则。
$(() => {
  const BUILD_ID = 'cangxuan-auto-regex-v1.0.0';
  const CHAT_VAR_ENABLED = 'cx_auto_regex_enabled_names';
  const CHAT_VAR_LAST_MESSAGE_ID = 'cx_auto_regex_last_message_id';
  const SYNC_DELAY_MS = 180;
  const BOOTSTRAP_SCAN_LIMIT = 80;

  const ALWAYS_ON = [
    '开场白',
    '对话美化（气泡版）',
    '心声美化',
    '只发送最新3楼的变量更新',
    '状态栏美化',
    '仅格式思维链',
    '对 AI 隐藏状态栏',
    '小索思考完成',
    '小索思考中',
    '不发送插图',
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
    { name: '插图', quick: ['<插图>'], pattern: /<插图>[^<\n\s]+(?:<\/插图>)?/ },
  ];

  const KNOWN_NAMES = new Set([...ALWAYS_ON, ...ADAPTIVE_RULES.map(rule => rule.name)]);
  let syncTimer = null;
  let syncing = false;
  let pending = false;

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

  function readEnabledNames() {
    const vars = getChatVars();
    const raw = vars[CHAT_VAR_ENABLED];
    if (Array.isArray(raw)) return raw.filter(name => typeof name === 'string');
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter(name => typeof name === 'string');
      } catch (_) {}
    }
    return [];
  }

  function persistEnabledNames(names, messageId) {
    const unique = [...new Set(names)].filter(name => KNOWN_NAMES.has(name));
    const vars = getChatVars();
    const currentNames = Array.isArray(vars[CHAT_VAR_ENABLED]) ? vars[CHAT_VAR_ENABLED] : [];
    const sameNames = JSON.stringify([...new Set(currentNames)].filter(name => KNOWN_NAMES.has(name)).sort())
      === JSON.stringify([...unique].sort());
    const sameMessage = messageId === undefined || messageId === null || vars[CHAT_VAR_LAST_MESSAGE_ID] === messageId;
    if (sameNames && sameMessage) return;
    updateChatVars(variables => {
      variables[CHAT_VAR_ENABLED] = unique;
      if (messageId !== undefined && messageId !== null) variables[CHAT_VAR_LAST_MESSAGE_ID] = messageId;
      return variables;
    });
  }

  function getLatestMessage() {
    const getChatMessagesFn = getGlobal('getChatMessages');
    if (typeof getChatMessagesFn !== 'function') return null;
    try {
      const messages = getChatMessagesFn(-1);
      return Array.isArray(messages) ? messages[0] : null;
    } catch (error) {
      console.warn('[苍玄界自动正则] 读取最新楼层失败', error);
      return null;
    }
  }

  function getBootstrapMessages() {
    const getChatMessagesFn = getGlobal('getChatMessages');
    if (typeof getChatMessagesFn !== 'function') return [];
    try {
      const latest = getLatestMessage();
      if (!latest || !Number.isFinite(latest.message_id)) return [];
      const start = Math.max(0, latest.message_id - BOOTSTRAP_SCAN_LIMIT + 1);
      return getChatMessagesFn(`${start}-${latest.message_id}`) || [];
    } catch (error) {
      console.warn('[苍玄界自动正则] 扫描近期楼层失败', error);
      return [];
    }
  }

  function collectTriggeredRules(text) {
    const triggered = [];
    for (const rule of ADAPTIVE_RULES) {
      if (rule.quick?.length && !rule.quick.some(token => text.includes(token))) continue;
      if (!rule.pattern || rule.pattern.test(text)) triggered.push(rule.name);
      if (rule.pattern?.global) rule.pattern.lastIndex = 0;
    }
    return triggered;
  }

  function collectBootstrapRules() {
    const messages = getBootstrapMessages();
    const found = new Set();
    for (const message of messages) {
      const text = message?.message || '';
      collectTriggeredRules(text).forEach(name => found.add(name));
    }
    return [...found];
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

  async function applyRegexState(enabledNames) {
    const updateTavernRegexesWithFn = getGlobal('updateTavernRegexesWith');
    const getTavernRegexesFn = getGlobal('getTavernRegexes');
    if (typeof updateTavernRegexesWithFn !== 'function') {
      console.warn('[苍玄界自动正则] 未找到 updateTavernRegexesWith，无法自动调度正则');
      return;
    }
    const enabledSet = new Set(enabledNames);
    if (typeof getTavernRegexesFn === 'function') {
      try {
        const current = getTavernRegexesFn({ type: 'character', name: 'current' }) || [];
        const needsUpdate = current.some(regex => KNOWN_NAMES.has(regex.script_name) && regex.enabled !== enabledSet.has(regex.script_name));
        if (!needsUpdate) return;
      } catch (_) {}
    }
    await updateTavernRegexesWithFn(regexes => {
      for (const regex of regexes) {
        const name = regex.script_name;
        if (!KNOWN_NAMES.has(name)) continue;
        regex.enabled = enabledSet.has(name);
      }
      return regexes;
    }, { type: 'character', name: 'current' });
  }

  async function syncNow(reason = 'manual') {
    if (syncing) {
      pending = true;
      return;
    }
    syncing = true;
    try {
      const latest = getLatestMessage();
      const text = latest?.message || '';
      const alreadyEnabled = readEnabledNames();
      const nextEnabled = [
        ...ALWAYS_ON,
        ...alreadyEnabled,
        ...collectBootstrapRules(),
        ...collectTriggeredRules(text),
      ];
      persistEnabledNames(nextEnabled, latest?.message_id);
      await applyRegexState(nextEnabled);
      console.debug?.('[苍玄界自动正则] 已同步', { reason, build: BUILD_ID, enabled: nextEnabled });
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

  function scheduleSync(reason = 'event') {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncTimer = null;
      syncNow(reason);
    }, SYNC_DELAY_MS);
  }

  async function init() {
    patchReplaceVariablesWatcher();
    scheduleSync('init');

    const eventOnFn = getGlobal('eventOn');
    const tavernEvents = getGlobal('tavern_events');
    if (typeof eventOnFn === 'function' && tavernEvents) {
      [
        tavernEvents.MESSAGE_RECEIVED,
        tavernEvents.MESSAGE_SENT,
        tavernEvents.MESSAGE_SWIPED,
        tavernEvents.MESSAGE_UPDATED,
        tavernEvents.CHAT_CHANGED,
        tavernEvents.GENERATION_ENDED,
      ].filter(Boolean).forEach(eventName => eventOnFn(eventName, () => scheduleSync(eventName)));
    }
  }

  init().catch(error => console.warn('[苍玄界自动正则] 初始化失败', error));

  $(window).on('pagehide', () => {
    if (syncTimer) clearTimeout(syncTimer);
  });
});
