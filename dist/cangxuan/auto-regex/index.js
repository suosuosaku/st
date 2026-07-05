// 苍玄界：远端正则美化包装载器
// 只同步 GitHub 远端 regex.json 内的规则；不读取/刷新聊天楼层，不接管酒馆内已有正则。
$(() => {
  const BUILD_ID = 'cangxuan-auto-regex-v1.2.3';
  const PACKAGE_MARKER = 'cx-auto-regex';
  const PACKAGE_ID_PREFIX = 'cx-auto-regex:';

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

  const REMOTE_RULE_NAMES = new Set([
    '悬赏接取美化',
    '拍卖购入美化',
    '盲盒开启美化',
    '道友收录美化',
    '悬赏完成美化',
    '飞剑传书回信美化',
    '自由开局美化',
  ]);

  function getGlobal(name) {
    try {
      if (globalThis[name] !== undefined) return globalThis[name];
    } catch (_) {}
    try {
      if (window.parent && window.parent !== window && window.parent[name] !== undefined) return window.parent[name];
    } catch (_) {}
    return undefined;
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
    if (!REMOTE_RULE_NAMES.has(name)) return null;

    const markdownOnly = raw.markdownOnly === true;
    const promptOnly = raw.promptOnly === true;
    const legacyId = String(raw.id || name);

    return {
      id: `${PACKAGE_ID_PREFIX}${legacyId}`,
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

  async function loadRemoteRegexPackage() {
    let lastError = null;
    for (const url of REGEX_PACKAGE_URLS) {
      try {
        const json = await fetchJson(url);
        const entries = (Array.isArray(json) ? json : []).map(toPackagedTavernRegex).filter(Boolean);
        if (!entries.length) throw new Error('远端正则美化包为空');
        console.info('[苍玄界自动正则] 远端正则美化包加载完成', { build: BUILD_ID, count: entries.length, url });
        return entries;
      } catch (error) {
        lastError = error;
        console.warn('[苍玄界自动正则] 远端正则美化包加载失败，尝试备用地址', { url, error });
      }
    }
    throw lastError || new Error('远端正则美化包加载失败');
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

  function isOwnedRemoteRegex(regex) {
    const id = String(regex?.id || '');
    if (id.startsWith(PACKAGE_ID_PREFIX)) return true;
    if (regex?.cangxuan_auto_regex === true) return true;
    if (regex?.metadata?.owner === PACKAGE_MARKER) return true;
    return false;
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

  function needsRemoteRegexUpdate(regexes, entries) {
    const current = (Array.isArray(regexes) ? regexes : [])
      .filter(isOwnedRemoteRegex)
      .map(regexContentSignature)
      .join('\n');
    const next = entries.map(regexContentSignature).join('\n');
    return current !== next;
  }

  function buildRemoteRegexList(regexes, entries) {
    const localRegexes = (Array.isArray(regexes) ? regexes : []).filter(regex => !isOwnedRemoteRegex(regex));
    return [...localRegexes, ...entries.map(entry => ({ ...entry }))];
  }

  async function syncRemoteRegexes() {
    if (globalThis.__cangxuanAutoRegexSyncing === BUILD_ID) return;
    const updateTavernRegexesWith = getGlobal('updateTavernRegexesWith');
    const getTavernRegexes = getGlobal('getTavernRegexes');
    if (typeof updateTavernRegexesWith !== 'function') {
      console.warn('[苍玄界自动正则] 未找到 updateTavernRegexesWith，无法注册远端正则美化包');
      return;
    }

    const entries = await loadRemoteRegexPackage();
    if (typeof getTavernRegexes === 'function') {
      try {
        const current = getTavernRegexes({ type: 'character', name: 'current' }) || [];
        if (!needsRemoteRegexUpdate(current, entries)) {
          console.info('[苍玄界自动正则] 远端正则美化包已是最新', { build: BUILD_ID, count: entries.length });
          return;
        }
      } catch (error) {
        console.warn('[苍玄界自动正则] 读取当前正则失败，将直接同步远端包', error);
      }
    }

    globalThis.__cangxuanAutoRegexSyncing = BUILD_ID;
    try {
      await updateTavernRegexesWith(regexes => buildRemoteRegexList(regexes || [], entries), {
        type: 'character',
        name: 'current',
      });
      console.info('[苍玄界自动正则] 已同步远端正则美化包', { build: BUILD_ID, count: entries.length });
    } finally {
      globalThis.__cangxuanAutoRegexSyncing = null;
    }
  }

  syncRemoteRegexes().catch(error => {
    console.warn('[苍玄界自动正则] 初始化失败', error);
  });
});
