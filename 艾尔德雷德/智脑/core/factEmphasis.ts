/**
 * 事实信息强调 (Fact Emphasis)
 * 每轮正文生成前，前端自动从已有数据组装短小事实校验表，
 * 注入到用户输入末尾。防止AI在当前轮犯时间/地点/状态/物品错误。
 * 功能名：事实信息强调（默认关闭，设置页开关）
 */

import type { SmallSummaryRecord } from '../stores/mainStore';
import type { DynamicProfileV2 } from './dynamicProfileV2';
import type { ItemMemory } from './itemMemory';
import { getActiveItems } from './itemMemory';
import { scanCharacterNamesFromContent } from './dreamtalk';

// ========== 组装函数 ==========

export interface FactEmphasisInput {
  smallSummaries: SmallSummaryRecord[];
  dynamicProfiles: DynamicProfileV2[];
  itemMemories: ItemMemory[];
  latestContent: string;
  allCharacterNames: string[];
}

/**
 * 构建事实信息强调文本
 * 从最新小总结+动态人设V2+物品库中提取关键事实
 */
export function buildFactEmphasis(input: FactEmphasisInput): string | null {
  const { smallSummaries, dynamicProfiles, itemMemories, latestContent, allCharacterNames } = input;

  // 最新小总结（取最近一条ready的）
  const latestSmall = [...smallSummaries]
    .filter(s => s.status === 'ready' || s.status === 'hidden-active')
    .sort((a, b) => b.floorRange.end - a.floorRange.end)[0];

  // 当前在场角色（去重）
  const currentCharacters = [...new Set(scanCharacterNamesFromContent(latestContent, allCharacterNames))];

  // 当前时间和地点（从最新小总结或动态人设中提取）
  let storyTime = latestSmall?.storyTime || '';
  let location = latestSmall?.location || '';

  // 从动态人设V2事实层补充（如果小总结没有）
  if (!location || !storyTime) {
    for (const dp of dynamicProfiles) {
      if (!currentCharacters.includes(dp.characterName)) continue;
      const factual = dp.factualState || '';
      if (!location) {
        const locMatch = factual.match(/位置[：:]\s*(.+)/);
        if (locMatch) location = locMatch[1].trim();
      }
      break;
    }
  }

  // 相关物品（在场角色相关 + 当前地点相关）
  const activeItems = getActiveItems(itemMemories);
  const relevantItems = activeItems.filter(item =>
    currentCharacters.some(c => item.relatedCharacters.includes(c)) ||
    (location && item.currentLocation.includes(location)),
  ).slice(0, 5); // 最多5个物品

  // 关键事实（从动态人设V2的禁止假设段提取，标注角色名）
  const keyFacts: string[] = [];
  for (const dp of dynamicProfiles) {
    if (!currentCharacters.includes(dp.characterName)) continue;
    const dynamicText = dp.dynamicProfile || '';
    // 提取"禁止假设"段中的条目
    const forbiddenMatch = dynamicText.match(/禁止假设[：:]([\s\S]*?)(?=\n[^\s-]|$)/);
    if (forbiddenMatch) {
      const lines = forbiddenMatch[1].split('\n')
        .map(l => l.trim())
        .filter(l => l.startsWith('- '))
        .map(l => l.slice(2).trim())
        .slice(0, 3);
      for (const line of lines) {
        keyFacts.push(`[${dp.characterName}] ${line}`);
      }
    }
  }

  // 如果什么信息都没有，不注入
  if (!storyTime && !location && currentCharacters.length === 0 && relevantItems.length === 0 && keyFacts.length === 0) {
    return null;
  }

  // 组装文本
  const parts: string[] = [];
  parts.push('');
  parts.push('---');
  parts.push('[事实信息强调 — 本轮若涉及以下内容则不得违背]');

  if (storyTime) parts.push(`时间：${storyTime}`);
  if (location) parts.push(`地点：${location}`);
  if (currentCharacters.length > 0) parts.push(`在场：${currentCharacters.join('、')}`);

  if (relevantItems.length > 0) {
    const itemTexts = relevantItems.map(item => {
      const owner = item.currentOwner ? `${item.currentOwner}持有` : '';
      const state = item.currentState || '正常';
      return `${item.itemName}（${[owner, state].filter(Boolean).join('，')}）`;
    });
    parts.push(`物品：${itemTexts.join('；')}`);
  }

  if (keyFacts.length > 0) {
    parts.push('关键事实：');
    for (const fact of keyFacts) {
      parts.push(`- ${fact}`);
    }
  }

  return parts.join('\n');
}

/**
 * 将事实信息强调注入到 messages 中最后一条 user 消息的末尾
 */
export function injectFactEmphasis(
  messages: any[],
  factText: string,
): boolean {
  if (!factText) return false;

  // 找到最后一条 user role 的消息
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user' && typeof messages[i].content === 'string') {
      messages[i].content += factText;
      console.info(`[智脑-事实强调] 已注入到用户消息末尾 (index=${i})`);
      return true;
    }
  }

  console.warn('[智脑-事实强调] 未找到 user 消息，跳过注入');
  return false;
}
