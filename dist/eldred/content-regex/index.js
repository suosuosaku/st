// 艾尔德雷德：正文美化正则包
// 单独导入本脚本可安装正文外框与发送层正文壳清理；不处理剧情功能标签。
$(() => {
  const BUILD_ID = 'eldred-content-regex-v1.0.0';
  const PREFIX = '[EldredContent]';

  function getGlobal(name) {
    try { if (globalThis[name] !== undefined) return globalThis[name]; } catch (_) {}
    try { if (window.parent && window.parent !== window && window.parent[name] !== undefined) return window.parent[name]; } catch (_) {}
    return undefined;
  }

  function getRegexName(regex) {
    return regex?.script_name || regex?.scriptName || regex?.name || '';
  }

  function contentCss() {
    return '<style>.eldc-content{--ink:#24170f;--paper:#f6e4b8;--edge:#2f1d12;--gold:#efc35f;--deep:#172539;box-sizing:border-box;margin:12px 0;padding:12px;background:linear-gradient(180deg,#f8e9c3,#dbc07f);border:2px solid var(--edge);box-shadow:0 0 0 2px #ffe6a0 inset,0 0 0 5px rgba(108,69,33,.55) inset,0 5px 0 #0d1724;color:var(--ink);font-family:ui-sans-serif,system-ui,"Microsoft YaHei",sans-serif;letter-spacing:0}.eldc-content *{box-sizing:border-box;letter-spacing:0}.eldc-body{position:relative;padding:10px;background:rgba(255,250,225,.72);border:1px dashed rgba(79,50,28,.42);font-size:14px;line-height:1.72;white-space:pre-wrap;overflow-wrap:anywhere}.eldc-body p{margin:0 0 .8em}.eldc-body p:last-child{margin-bottom:0}</style>';
  }

  function contentReplacement() {
    return `${contentCss()}<div class="eldc-content"><div class="eldc-body">$1</div></div>`;
  }

  function makeRegex({ name, find, replace, display = true, prompt = false, runOnEdit = false }) {
    const markdownOnly = display === true && prompt !== true;
    const promptOnly = prompt === true && display !== true;
    return {
      id: `eldred-content-${name}`,
      scriptName: `${PREFIX}${BUILD_ID}:${name}`,
      script_name: `${PREFIX}${BUILD_ID}:${name}`,
      disabled: false,
      enabled: true,
      findRegex: find,
      find_regex: find,
      trimStrings: [],
      trim_strings: [],
      replaceString: replace,
      replace_string: replace,
      placement: [1, 2],
      substituteRegex: 0,
      markdownOnly,
      promptOnly,
      runOnEdit,
      run_on_edit: runOnEdit,
      source: { user_input: false, ai_output: true, slash_command: false, world_info: false },
      destination: { display, prompt },
      minDepth: null,
      maxDepth: null,
      min_depth: null,
      max_depth: null,
    };
  }

  function buildRegexes() {
    return [
      makeRegex({
        name: '正文外框美化',
        find: '/<(?:eldred_content|content)(?:\\s[^>]*)?>\\s*([\\s\\S]*?)\\s*<\\/(?:eldred_content|content)>/g',
        replace: contentReplacement(),
        display: true,
        prompt: false,
      }),
      makeRegex({
        name: '正文壳标签清理_发送',
        find: '/<\\/?(?:eldred_content|content)(?:\\s[^>]*)?>/g',
        replace: '',
        display: false,
        prompt: true,
      }),
    ];
  }

  function comparableRegex(regex) {
    return {
      script_name: getRegexName(regex),
      enabled: regex?.enabled !== false && regex?.disabled !== true,
      find_regex: regex?.find_regex || regex?.findRegex || '',
      replace_string: regex?.replace_string || regex?.replaceString || '',
      run_on_edit: regex?.run_on_edit ?? regex?.runOnEdit ?? false,
      markdownOnly: regex?.markdownOnly === true,
      promptOnly: regex?.promptOnly === true,
      min_depth: regex?.min_depth ?? regex?.minDepth ?? null,
      max_depth: regex?.max_depth ?? regex?.maxDepth ?? null,
    };
  }

  function sameRegexSet(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return JSON.stringify(a.map(comparableRegex)) === JSON.stringify(b.map(comparableRegex));
  }

  async function installRegexes() {
    if (globalThis.__eldredContentRegexInstalling === BUILD_ID) return;
    const updateTavernRegexesWith = getGlobal('updateTavernRegexesWith');
    const getTavernRegexes = getGlobal('getTavernRegexes');
    if (typeof updateTavernRegexesWith !== 'function') {
      console.warn('[艾尔德雷德正文正则] 未找到 updateTavernRegexesWith');
      return;
    }
    if (typeof getTavernRegexes !== 'function') {
      console.warn('[艾尔德雷德正文正则] 未找到 getTavernRegexes，跳过自动安装以避免反复刷新楼层');
      return;
    }
    const nextRules = buildRegexes();
    const currentRules = getTavernRegexes({ type: 'character', name: 'current' }) || [];
    const currentContentRules = currentRules.filter(regex => getRegexName(regex).startsWith(PREFIX));
    if (sameRegexSet(currentContentRules, nextRules)) {
      console.info('[艾尔德雷德正文正则] 已是最新，无需重载', BUILD_ID);
      return;
    }
    globalThis.__eldredContentRegexInstalling = BUILD_ID;
    try {
      await updateTavernRegexesWith(regexes => {
        const kept = (Array.isArray(regexes) ? regexes : []).filter(regex => !getRegexName(regex).startsWith(PREFIX));
        return [...kept, ...nextRules];
      }, { type: 'character', name: 'current' });
      console.info('[艾尔德雷德正文正则] 已安装', BUILD_ID);
    } finally {
      globalThis.__eldredContentRegexInstalling = null;
    }
  }

  installRegexes().catch(error => {
    console.warn('[艾尔德雷德正文正则] 初始化失败', error);
  });
});
