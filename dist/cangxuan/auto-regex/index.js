const REGEX_URLS = [
  'https://cdn.jsdelivr.net/gh/suosuosaku/st@184496040de99523aa5823420dc3e80a4d6c0a22/dist/cangxuan/auto-regex/regex.json',
  'https://gcore.jsdelivr.net/gh/suosuosaku/st@184496040de99523aa5823420dc3e80a4d6c0a22/dist/cangxuan/auto-regex/regex.json',
  'https://testingcf.jsdelivr.net/gh/suosuosaku/st@184496040de99523aa5823420dc3e80a4d6c0a22/dist/cangxuan/auto-regex/regex.json',
];

$(async () => {
  console.info('苍玄界自动正则脚本已加载');

  let rawRules = [];

  try {
    console.info('苍玄界自动正则: 正在从网络加载 regex.json...');
    let loaded = false;

    for (let index = 0; index < REGEX_URLS.length; index += 1) {
      const url = REGEX_URLS[index];

      try {
        console.info(`苍玄界自动正则: 尝试从第 ${index + 1} 个 URL 加载: ${url}`);
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        rawRules = await response.json();
        console.info(`苍玄界自动正则: 成功从第 ${index + 1} 个 URL 加载 ${rawRules.length} 条规则`);
        loaded = true;
        break;
      } catch (error) {
        console.warn(`苍玄界自动正则: 第 ${index + 1} 个 URL 加载失败:`, error);

        if (index < REGEX_URLS.length - 1) {
          console.info('苍玄界自动正则: 尝试下一个备用 URL...');
        }
      }
    }

    if (!loaded) {
      throw new Error('所有 CDN URL 均加载失败');
    }
  } catch (error) {
    console.error('苍玄界自动正则: 从网络加载失败:', error);
    toastr.error('苍玄界自动正则: 加载规则失败，请检查网络连接');
    return;
  }

  const NAMES_VAR = 'cangxuan_regex_names';
  const LAST_MESSAGE_VAR = 'cangxuan_regex_last_message_id';
  const DEFAULT_SOURCE = { user_input: false, ai_output: true, slash_command: false, world_info: false };
  const DEFAULT_DESTINATION = { display: true, prompt: false };
  const RECENT_SCAN_DEPTH = 8;

  let syncing = false;
  let chatId = null;
  let debounceTimer = null;
  let compiledTriggers = null;
  let tavernRules = null;

  const getManagedTavernRules = () => {
    if (tavernRules !== null) {
      return tavernRules;
    }

    tavernRules = rawRules
      .filter(rule => !rule.disabled)
      .map(rule => {
        const source =
          rule.source ??
          (rule.scriptName === '自由开局美化'
            ? { user_input: true, ai_output: true, slash_command: false, world_info: false }
            : DEFAULT_SOURCE);

        return {
          id: rule.id,
          script_name: rule.scriptName,
          enabled: true,
          scope: 'character',
          find_regex: rule.findRegex,
          replace_string: rule.replaceString,
          trim_strings: Array.isArray(rule.trimStrings) ? rule.trimStrings.join('\n') : '',
          source,
          destination: rule.destination ?? DEFAULT_DESTINATION,
          run_on_edit: rule.runOnEdit ?? true,
          min_depth: rule.minDepth ?? null,
          max_depth: rule.maxDepth ?? 10,
        };
      });

    return tavernRules;
  };

  const getCompiledTriggers = () => {
    if (compiledTriggers !== null) {
      return compiledTriggers;
    }

    compiledTriggers = rawRules
      .filter(rule => !rule.disabled)
      .map(rule => {
        let patternText = rule.findRegex;
        const literalMatch = patternText.match(/^\/(.+)\/([gimsuy]*)$/);

        if (literalMatch) {
          patternText = literalMatch[1];
        }

        try {
          const pattern = new RegExp(patternText, 'i');
          let quickCheck = '';

          if (patternText.includes('{') || patternText.includes('\\{')) {
            quickCheck = '{';
          } else if (patternText.includes('<') || patternText.includes('\\<')) {
            const tagMatch = patternText.match(/<(\w+)/);
            quickCheck = tagMatch ? `<${tagMatch[1]}` : '<';
          } else if (patternText.includes('\\[') || patternText.includes('\\]')) {
            quickCheck = '[';
          } else if (patternText.includes('\\(') || patternText.includes('\\)')) {
            quickCheck = '(';
          } else if (patternText.startsWith('>')) {
            quickCheck = '>';
          } else {
            quickCheck = patternText.substring(0, Math.min(15, patternText.length));
          }

          return { scriptName: rule.scriptName, pattern, quickCheck };
        } catch (error) {
          console.warn(`苍玄界自动正则: 无效的正则表达式: ${patternText}`, error);
          return null;
        }
      })
      .filter(Boolean);

    return compiledTriggers;
  };

  const getStoredNames = () => {
    try {
      const variables = getVariables({ type: 'chat' });
      const names = variables?.[NAMES_VAR];

      if (Array.isArray(names)) {
        return names.filter(name => typeof name === 'string');
      }
    } catch (error) {
      console.warn('苍玄界自动正则: 获取已存储正则名称失败:', error);
    }

    return [];
  };

  const saveStoredNames = names => {
    try {
      const sortedNames = [...new Set(names)].sort();
      insertOrAssignVariables({ [NAMES_VAR]: sortedNames }, { type: 'chat' });
      console.info(`苍玄界自动正则: 已保存 ${sortedNames.length} 个正则名称到聊天变量`);
    } catch (error) {
      console.warn('苍玄界自动正则: 保存正则名称失败:', error);
    }
  };

  const addRegex = async rule => {
    try {
      await updateTavernRegexesWith(regexes => [
        ...regexes.filter(regex => regex.script_name !== rule.script_name),
        rule,
      ]);
    } catch (error) {
      console.warn(`苍玄界自动正则: 注册正则失败: ${rule.script_name}`, error);
    }
  };

  const removeRegexes = async names => {
    if (names.length === 0) {
      return;
    }

    try {
      await updateTavernRegexesWith(regexes => regexes.filter(regex => !names.includes(regex.script_name)));
      console.info(`苍玄界自动正则: 已移除 ${names.length} 条规则`);
    } catch (error) {
      console.warn('苍玄界自动正则: 移除正则失败:', error);
    }
  };

  const getExistingRegexNames = async () => {
    const names = new Set();

    try {
      await updateTavernRegexesWith(regexes => {
        regexes.forEach(regex => names.add(regex.script_name));
        return regexes;
      });
    } catch (error) {
      console.warn('苍玄界自动正则: 获取角色卡正则列表失败:', error);
    }

    return names;
  };

  const syncRegexes = async () => {
    if (syncing) {
      console.info('苍玄界自动正则: 正在同步中，跳过本次调用');
      return;
    }

    try {
      syncing = true;
      const storedNames = getStoredNames();
      const storedNameSet = new Set(storedNames);
      const existingNames = await getExistingRegexNames();
      const managedRules = getManagedTavernRules();
      const managedNameSet = new Set(managedRules.map(rule => rule.script_name));
      const namesToRemove = [];

      for (const existingName of existingNames) {
        if (managedNameSet.has(existingName) && !storedNameSet.has(existingName)) {
          namesToRemove.push(existingName);
        }
      }

      const namesToAdd = [];
      for (const storedName of storedNames) {
        if (managedNameSet.has(storedName) && !existingNames.has(storedName)) {
          namesToAdd.push(storedName);
        }
      }

      if (namesToRemove.length > 0) {
        await removeRegexes(namesToRemove);
        console.info(`苍玄界自动正则: 已移除 ${namesToRemove.length} 条不在变量列表中的规则: ${namesToRemove.join(', ')}`);
      }

      if (namesToAdd.length > 0) {
        let addedCount = 0;

        for (const name of namesToAdd) {
          const rule = managedRules.find(item => item.script_name === name);

          if (rule) {
            await addRegex(rule);
            addedCount += 1;
            console.info(`苍玄界自动正则: 已注册 ${name}`);
          }
        }

        if (addedCount > 0) {
          console.info(`苍玄界自动正则: 共注册了 ${addedCount} 条规则`);
        }
      }

      if (namesToRemove.length === 0 && namesToAdd.length === 0) {
        console.info('苍玄界自动正则: 变量列表与角色卡正则列表已同步，无需更新');
      }
    } catch (error) {
      console.error('苍玄界自动正则: 同步正则列表失败:', error);
    } finally {
      syncing = false;
    }
  };

  const detectRegexNames = (text, existingNames = []) => {
    if (!text || text.length < 3) {
      return [];
    }

    const existingNameSet = new Set(existingNames);
    const detectedNames = [];

    for (const { scriptName, pattern, quickCheck } of getCompiledTriggers()) {
      if (existingNameSet.has(scriptName)) {
        continue;
      }

      if (quickCheck && !text.includes(quickCheck)) {
        continue;
      }

      try {
        pattern.lastIndex = 0;

        if (pattern.test(text)) {
          detectedNames.push(scriptName);
          console.info(`苍玄界自动正则: 检测到 ${scriptName}`);
        }
      } catch {
        // Ignore a single failed trigger test and continue scanning other rules.
      }
    }

    return detectedNames;
  };

  const readMessageText = message => {
    if (!message) {
      return '';
    }

    if (typeof message === 'string') {
      return message;
    }

    return message.message ?? message.mes ?? message.content ?? '';
  };

  const collectMessagesForIds = ids => {
    const seen = new Set();
    const messages = [];

    for (const id of ids) {
      if (!Number.isFinite(id)) {
        continue;
      }

      for (const role of [undefined, 'assistant', 'user']) {
        try {
          const result = role === undefined ? getChatMessages(id) : getChatMessages(id, { role });

          for (const message of result ?? []) {
            const text = readMessageText(message);
            const dedupeKey = `${id}:${role ?? 'any'}:${text}`;

            if (text && !seen.has(dedupeKey)) {
              seen.add(dedupeKey);
              messages.push(text);
            }
          }
        } catch {
          // Some SillyTavern helper builds do not support every getChatMessages signature.
        }
      }
    }

    return messages;
  };

  const collectRecentMessages = () => {
    const messages = [];
    const seenTexts = new Set();

    for (let offset = -1; offset >= -RECENT_SCAN_DEPTH; offset -= 1) {
      try {
        const result = getChatMessages(offset) ?? [];

        for (const message of result) {
          const text = readMessageText(message);

          if (text && !seenTexts.has(text)) {
            seenTexts.add(text);
            messages.push(text);
          }
        }
      } catch {
        // Negative offsets are best-effort; exact ids are handled on message events.
      }
    }

    return messages;
  };

  const scanTexts = async texts => {
    try {
      const joinedText = texts.filter(Boolean).join('\n\n');

      if (!joinedText) {
        console.info('苍玄界自动正则: 没有找到可扫描消息，返回');
        return;
      }

      const storedNames = getStoredNames();
      const detectedNames = detectRegexNames(joinedText, storedNames);
      const mergedNames = [...new Set([...storedNames, ...detectedNames])];
      const storedKey = [...storedNames].sort().join(',');
      const mergedKey = [...mergedNames].sort().join(',');

      if (storedKey !== mergedKey) {
        console.info(`苍玄界自动正则: 检测到变化，从 ${storedNames.length} 个更新到 ${mergedNames.length} 个`);
        saveStoredNames(mergedNames);
        await syncRegexes();
      } else {
        console.info('苍玄界自动正则: 无变化，不更新');
      }
    } catch (error) {
      console.error('苍玄界自动正则: 扫描消息更新变量失败:', error);
    }
  };

  const scanRecentMessages = async () => {
    console.info('苍玄界自动正则: 扫描最近消息');
    await scanTexts(collectRecentMessages());
  };

  const scanMessagePair = async messageId => {
    const numericMessageId = Number(messageId);

    if (!Number.isFinite(numericMessageId)) {
      await scanRecentMessages();
      return;
    }

    console.info(`苍玄界自动正则: 扫描消息 ${numericMessageId} 及其前一层`);
    await scanTexts(collectMessagesForIds([numericMessageId, numericMessageId - 1]));

    try {
      insertOrAssignVariables({ [LAST_MESSAGE_VAR]: numericMessageId }, { type: 'chat' });
      console.info(`苍玄界自动正则: 已更新最后处理的消息 ID 为 ${numericMessageId}`);
    } catch (error) {
      console.warn('苍玄界自动正则: 更新最后处理的消息 ID 失败:', error);
    }
  };

  eventOn(tavern_events.MESSAGE_RECEIVED, async messageId => {
    const lastMessageId = getVariables({ type: 'chat' })[LAST_MESSAGE_VAR];

    if (lastMessageId == null || String(lastMessageId) !== String(messageId)) {
      console.info(`苍玄界自动正则: 收到新消息 ${messageId}`);
      await scanMessagePair(messageId);
    } else {
      console.info(`苍玄界自动正则: 消息 ${messageId} 已处理过，跳过`);
    }
  });

  eventOn(tavern_events.MESSAGE_SENT, async messageId => {
    console.info(`苍玄界自动正则: 捕获用户消息 ${messageId}`);
    await scanMessagePair(messageId);
  });

  eventOn(tavern_events.CHAT_CHANGED, async newChatId => {
    console.info(`苍玄界自动正则: 检测到聊天切换到 ${newChatId}`);

    if (chatId !== newChatId) {
      chatId = newChatId;

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(async () => {
        await syncRegexes();
        await scanRecentMessages();
      }, 500);
    }
  });

  $(window).on('pagehide', async () => {
    const names = getStoredNames();

    if (names.length > 0) {
      await removeRegexes(names);
      console.info(`苍玄界自动正则: 已卸载 ${names.length} 条规则`);
    }

    console.info('苍玄界自动正则脚本已卸载');
  });

  console.info('苍玄界自动正则: 启动初始化');
  await syncRegexes();
  await scanRecentMessages();

  const usableRuleCount = rawRules.filter(rule => !rule.disabled).length;
  console.info(`苍玄界自动正则: 准备了 ${usableRuleCount} 条规则用于检测`);
});