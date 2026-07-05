/**
 * 文本清理工具
 *
 * AI 输出中可能包含 "user" / "{{user}}" / "User" 等占位符，
 * 统一替换为实际玩家名。
 */

/**
 * 将 AI 输出中的 {{user}} / 独立单词 user 替换为实际玩家名。
 * 用 lookbehind/ahead 确保不误伤 username / misuser 等复合词。
 */
export function replaceUserReferences(text: string, userName: string): string {
  if (userName === '{{user}}') {
    console.warn('[textCleanup] ⚠️ userName 仍为 {{user}}，替换将不生效！请检查人设名称或 ST 用户名');
    return text;
  }
  const step1 = text.replace(/[{]{2}user[}]{2}/gi, userName);
  const matches = text.match(/[{]{2}user[}]{2}/gi);
  if (matches) console.info(`[textCleanup] 替换 {{user}} → "${userName}"，${matches.length}处`);
  const step2 = step1.replace(/(?<![{a-zA-Z])user(?![a-zA-Z}])/gi, userName);
  return step2;
}
