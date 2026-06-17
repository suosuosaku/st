// 艾尔德雷德：自动正则包
// 角色卡只导入本脚本；本脚本负责安装少量通用正则并处理未闭合剧情标签。
$(() => {
  const BUILD_ID = 'eldred-auto-regex-v1.0.3';
  const PREFIX = '[EldredAuto]';
  const TAGS = [
    '行动判定', '角色数值', '地图加载', '路径行动', '奇遇事件', '翻牌结果',
    '战斗开始', '先攻判定', '战斗行动', '战斗实况', '技能演出', '战斗快照',
    '战斗结算', 'NPC登记', '委托生成', '委托接取', '委托完成', '购买结算',
    '队伍编成', '主线进展', '技能习得', '装备获得', '副本生成', '副本结算',
  ];
  const TAG_ALT = TAGS.join('|');
  const LEGACY_TAG_REGEX_NAMES = new Set(TAGS.map(name => `${name}美化`));
  const EXTRA_LEGACY_NAMES = new Set([
    '委托接取美化', '委托完成美化', '购买结算美化', '翻牌结果美化', '奇遇事件美化',
    'NPC登记美化', '队伍编成美化', '主线进展美化', '行动判定美化', '战斗实况美化',
    '技能演出美化',
  ]);

  function getGlobal(name) {
    try { if (globalThis[name] !== undefined) return globalThis[name]; } catch (_) {}
    try { if (window.parent && window.parent !== window && window.parent[name] !== undefined) return window.parent[name]; } catch (_) {}
    return undefined;
  }

  function getRegexName(regex) {
    return regex?.script_name || regex?.scriptName || regex?.name || '';
  }

  function hasEldredTag(text) {
    return new RegExp(`<(?:${TAG_ALT})(?:\\s[^>]*)?>`, 'u').test(String(text || ''));
  }

  function normalizeMessage(raw, fallbackId = null) {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'string') return { message: raw, message_id: fallbackId };
    if (typeof raw === 'object') {
      return {
        message: String(raw.message ?? raw.mes ?? raw.text ?? raw.content ?? ''),
        message_id: raw.message_id ?? raw.messageId ?? raw.id ?? raw.mesid ?? fallbackId,
      };
    }
    return { message: String(raw), message_id: fallbackId };
  }

  function getLatestMessage() {
    const getChatMessages = getGlobal('getChatMessages');
    if (typeof getChatMessages !== 'function') return null;
    try {
      const list = getChatMessages(-1);
      const arr = Array.isArray(list) ? list : [list];
      return normalizeMessage(arr[arr.length - 1], null);
    } catch (error) {
      console.warn('[艾尔德雷德自动正则] 读取最新楼层失败', error);
      return null;
    }
  }

  function panelCss() {
    return '<style>.eldg{--ink:#24170f;--paper:#f4dfb3;--paper2:#dfbd79;--deep:#162133;--gold:#efc35f;--line:#68472a;box-sizing:border-box;letter-spacing:0;font-family:ui-sans-serif,system-ui,"Microsoft YaHei",sans-serif}.eldg *{box-sizing:border-box;letter-spacing:0}.eldg-card{position:relative;margin:12px 0;padding:10px;background:linear-gradient(180deg,#f7e7bd,#d8b270);border:2px solid #2f1d12;box-shadow:0 0 0 2px #f9d77d inset,0 0 0 4px #6c4521 inset,0 5px 0 #0d1724;color:var(--ink);image-rendering:pixelated}.eldg-card:before{content:"";position:absolute;inset:6px;border:1px dashed rgba(79,50,28,.34);pointer-events:none}.eldg-head{display:flex;align-items:center;gap:8px;min-height:30px;margin:0 0 8px;padding:5px 8px;background:linear-gradient(90deg,#152338,#25475a 72%,#7b3b33);border:2px solid #101723;color:#ffe6a0;box-shadow:inset 0 0 0 1px rgba(255,255,255,.16);font-weight:900}.eldg-mark{width:18px;height:18px;display:grid;place-items:center;flex:none;background:#efc35f;color:#1d2734;border:2px solid #111827;box-shadow:2px 2px 0 rgba(0,0,0,.35);font-size:11px;line-height:1}.eldg-title{font-size:14px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.eldg-body{position:relative;z-index:1;padding:8px;background:rgba(255,249,220,.7);border:2px solid rgba(93,63,35,.58);font-size:13px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}.eldg-body pre{white-space:pre-wrap;margin:0;font:inherit}.eldg-card[data-tag="NPC登记"] .eldg-mark,.eldg-card[data-tag="队伍编成"] .eldg-mark{background:#7fcf82}.eldg-card[data-tag="主线进展"] .eldg-mark{background:#ffd35d}.eldg-card[data-tag*="战斗"] .eldg-mark,.eldg-card[data-tag="技能演出"] .eldg-mark{background:#f27966}.eldg-card[data-tag*="委托"] .eldg-mark{background:#6ed0a8}.eldg-card[data-tag="路径行动"] .eldg-mark,.eldg-card[data-tag="地图加载"] .eldg-mark{background:#67b7cf}</style>';
  }

  function tagPanelReplacement() {
    return `${panelCss()}<div class="eldg"><div class="eldg-card" data-tag="$1"><div class="eldg-head"><span class="eldg-mark">◆</span><span class="eldg-title">$1</span></div><pre class="eldg-body">$2</pre></div></div>`;
  }

  function makeRegex({ name, find, replace, display = true, prompt = false, runOnEdit = true }) {
    return {
      id: `eldred-auto-${name}`,
      script_name: `${PREFIX}${name}`,
      enabled: true,
      find_regex: find,
      replace_string: replace,
      trim_strings: [],
      source: { user_input: false, ai_output: true, slash_command: false, world_info: false },
      destination: { display, prompt },
      run_on_edit: runOnEdit,
      min_depth: null,
      max_depth: null,
    };
  }

  function buildRegexes() {
    return [
      makeRegex({
        name: '剧情标签完整',
        find: `/<(${TAG_ALT})(?:\\s[^>]*)?>\\s*([\\s\\S]*?)\\s*<\\/\\1>/g`,
        replace: tagPanelReplacement(),
      }),
      makeRegex({
        name: '剧情标签未闭合兜底',
        find: `/<(${TAG_ALT})(?:\\s[^>]*)?>\\s*((?:(?!<\\/\\1>)[\\s\\S])*?)(?=\\s*(?:<\\/(?:eldred_content|content)>|<(?:${TAG_ALT})(?:\\s[^>]*)?>|<StatusPlaceHolderImpl\\s*\\/>|<UpdateVariable>|$))/g`,
        replace: tagPanelReplacement(),
      }),
      makeRegex({
        name: '正文壳标签清理_保留正文',
        find: '/<\\/?(?:eldred_content|content)(?:\\s[^>]*)?>/g',
        replace: '',
        display: false,
        prompt: true,
      }),
    ];
  }

  async function installRegexes() {
    const updateTavernRegexesWith = getGlobal('updateTavernRegexesWith');
    if (typeof updateTavernRegexesWith !== 'function') {
      console.warn('[艾尔德雷德自动正则] 未找到 updateTavernRegexesWith');
      return;
    }
    const nextRules = buildRegexes();
    await updateTavernRegexesWith(regexes => {
      const kept = (Array.isArray(regexes) ? regexes : []).filter(regex => {
        const name = getRegexName(regex);
        if (name.startsWith(PREFIX)) return false;
        if (LEGACY_TAG_REGEX_NAMES.has(name) || EXTRA_LEGACY_NAMES.has(name)) return false;
        return true;
      });
      return [...kept, ...nextRules];
    }, { type: 'character', name: 'current' });
    console.info('[艾尔德雷德自动正则] 已安装', BUILD_ID);
  }

  let timer = null;
  function schedule(reason = 'event') {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      timer = null;
      try {
        await installRegexes();
        console.debug?.('[艾尔德雷德自动正则] 同步完成', reason);
      } catch (error) {
        console.warn('[艾尔德雷德自动正则] 同步失败', error);
      }
    }, 500);
  }

  function initEvents() {
    const eventOn = getGlobal('eventOn');
    const tavernEvents = getGlobal('tavern_events') || {};
    if (typeof eventOn !== 'function') return;
    [
      tavernEvents.CHAT_CHANGED,
      tavernEvents.GENERATION_ENDED,
    ].filter(Boolean).forEach(eventName => {
      try { eventOn(eventName, () => schedule(eventName)); } catch (_) {}
    });
  }

  installRegexes().catch(error => {
    console.warn('[艾尔德雷德自动正则] 初始化失败', error);
  });
  initEvents();
  schedule('bootstrap');

  $(window).on('pagehide', () => {
    if (timer) clearTimeout(timer);
  });
});
