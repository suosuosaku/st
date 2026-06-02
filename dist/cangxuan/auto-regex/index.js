// 苍玄界：自动正则调度脚本
// 扫描最新楼层，按内容启用本局需要的角色卡正则。
$(() => {
  const BUILD_ID = 'cangxuan-auto-regex-v1.0.24';
  const CHAT_VAR_ENABLED = 'cx_auto_regex_enabled_names';
  const CHAT_VAR_LAST_MESSAGE_ID = 'cx_auto_regex_last_message_id';
  const SYNC_DELAY_MS = 650;
  const INIT_GRACE_MS = 3500;

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
    { name: '插图', quick: ['<插图>'], pattern: /<插图>[^<\n\s]+<\/插图>/ },
  ];

  const KNOWN_NAMES = new Set([...ALWAYS_ON, ...ADAPTIVE_RULES.map(rule => rule.name)]);
  let syncTimer = null;
  let syncing = false;
  let pending = false;
  let lastRerenderSignature = '';
  let shouldSyncLatest = false;
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

  function collectTriggeredRules(text) {
    const triggered = [];
    for (const rule of ADAPTIVE_RULES) {
      if (rule.quick?.length && !rule.quick.some(token => text.includes(token))) continue;
      if (!rule.pattern || rule.pattern.test(text)) triggered.push(rule.name);
      if (rule.pattern?.global) rule.pattern.lastIndex = 0;
    }
    return triggered;
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
        const needsUpdate = current.some(regex => {
          const name = getRegexName(regex);
          return KNOWN_NAMES.has(name) && getRegexEnabled(regex) !== enabledSet.has(name);
        });
        if (!needsUpdate) return;
      } catch (_) {}
    }
    await updateTavernRegexesWithFn(regexes => {
      for (const regex of regexes) {
        const name = getRegexName(regex);
        if (!KNOWN_NAMES.has(name)) continue;
        setRegexEnabled(regex, enabledSet.has(name));
      }
      return regexes;
    }, { type: 'character', name: 'current' });
  }

  async function syncMessage(message, reason = 'manual') {
    const text = message?.message || '';
    const triggeredRules = collectTriggeredRules(text);
    const nextEnabled = [
      ...ALWAYS_ON,
      ...triggeredRules,
    ];
    persistEnabledNames(nextEnabled, message?.message_id);
    await applyRegexState(nextEnabled);
    await rerenderLatestMessageIfNeeded(message, triggeredRules);
    console.debug?.('[苍玄界自动正则] 已同步', { reason, build: BUILD_ID, messageId: message?.message_id, enabled: nextEnabled });
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

    scheduleSync('bootstrap');
  }

  init().catch(error => console.warn('[苍玄界自动正则] 初始化失败', error));

  $(window).on('pagehide', () => {
    if (syncTimer) clearTimeout(syncTimer);
  });
});
