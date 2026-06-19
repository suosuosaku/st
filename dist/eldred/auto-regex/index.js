// 艾尔德雷德：自动正则清理脚本
// 正文显示完全交给角色卡内的“艾尔德雷德正文美化”脚本；本脚本清理旧正则残留。
$(() => {
  const BUILD_ID = 'eldred-auto-regex-v1.1.2';
  const PREFIX = '[EldredAuto]';
  const LEGACY_REGEX_NAMES = new Set([
    '艾尔德雷德正文美化',
    '[不发送]艾尔德雷德正文壳清理',
    '[不发送]艾尔德雷德正文壳改名',
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

  function getRegexName(regex) {
    return regex?.script_name || regex?.scriptName || regex?.name || '';
  }

  function shouldRemove(regex) {
    const name = getRegexName(regex);
    return name.startsWith(PREFIX) || LEGACY_REGEX_NAMES.has(name);
  }

  async function cleanupLegacyAutoRegexes() {
    if (globalThis.__eldredAutoRegexCleanup === BUILD_ID) return;
    const updateTavernRegexesWith = getGlobal('updateTavernRegexesWith');
    const getTavernRegexes = getGlobal('getTavernRegexes');
    if (typeof updateTavernRegexesWith !== 'function' || typeof getTavernRegexes !== 'function') {
      console.warn('[艾尔德雷德自动正则] 找不到正则接口，跳过旧规则清理');
      return;
    }

    const currentRules = getTavernRegexes({ type: 'character', name: 'current' }) || [];
    const staleRules = currentRules.filter(shouldRemove);
    if (staleRules.length === 0) {
      console.info('[艾尔德雷德自动正则] 无旧自动正则残留', BUILD_ID);
      return;
    }

    globalThis.__eldredAutoRegexCleanup = BUILD_ID;
    try {
      await updateTavernRegexesWith(regexes => {
        return (Array.isArray(regexes) ? regexes : []).filter(regex => !shouldRemove(regex));
      }, { type: 'character', name: 'current' });
      console.info('[艾尔德雷德自动正则] 已清理旧自动正则残留', staleRules.map(getRegexName));
    } finally {
      globalThis.__eldredAutoRegexCleanup = null;
    }
  }

  cleanupLegacyAutoRegexes().catch(error => {
    console.warn('[艾尔德雷德自动正则] 清理失败', error);
  });
});
