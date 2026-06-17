/**
 * 神经链记忆激活系统
 *
 * 不是把所有记忆一次全塞进来，而是按关系链精准注入：
 * - 用户↔自己
 * - 用户↔角色A
 * - 角色A↔角色B
 *
 * 锚点是各个在场角色，只激活与当前场景相关的记忆链。
 * 插入位置：人设后面，使用 injectPrompts D1
 */

import { type CharacterMemory } from '../stores/mainStore';
import type { CharacterNameEntry } from './dreamtalk';
import { scanCharacterNamesFromContent } from './dreamtalk';

/** 从时间字符串提取日期和时段，如 "2025年2月5日晨" → {date:"2025年2月5日", period:"晨"} */
function parseTimeField(time: string): { date: string; period: string } | null {
  const m = time.match(/^(\d+年\d+月\d+日)(.*)$/);
  if (!m) return null;
  return { date: m[1], period: m[2] };
}

/**
 * 将记忆列表按日期→时段两级分组格式化
 * 所有日期均分组显示，时段按晨→夜时间顺序排列
 */
function formatTimeGrouped(items: Array<{ text: string; time?: string }>): string[] {
  const periodOrder: Record<string, number> = {
    '晨': 0, '上午': 1, '午': 2, '下午': 3, '暮': 4, '夜': 5, '深夜': 6,
  };

  // 按日期 → 时段分组，保持首次出现顺序
  const dateGroups: Array<{ date: string; periods: Map<string, Array<{ text: string }>> }> = [];
  const dateMap = new Map<string, number>();
  const noTime: Array<{ text: string }> = [];

  for (const item of items) {
    if (!item.time) { noTime.push(item); continue; }
    const parsed = parseTimeField(item.time);
    if (!parsed) { noTime.push(item); continue; }

    let idx = dateMap.get(parsed.date);
    if (idx === undefined) {
      idx = dateGroups.length;
      dateMap.set(parsed.date, idx);
      dateGroups.push({ date: parsed.date, periods: new Map() });
    }
    const pm = dateGroups[idx].periods;
    if (!pm.has(parsed.period)) pm.set(parsed.period, []);
    pm.get(parsed.period)!.push({ text: item.text });
  }

  const lines: string[] = [];

  for (const dg of dateGroups) {
    lines.push(`  ${dg.date}：`);
    const sortedPeriods = [...dg.periods.keys()].sort(
      (a, b) => (periodOrder[a] ?? 99) - (periodOrder[b] ?? 99),
    );
    for (const period of sortedPeriods) {
      const periodItems = dg.periods.get(period)!;
      for (let i = 0; i < periodItems.length; i++) {
        const item = periodItems[i];
        if (i === 0) {
          lines.push(`    [${period}] ${item.text}`);
        } else {
          lines.push(`         ${item.text}`);
        }
      }
    }
  }

  for (const item of noTime) {
    lines.push(`  - ${item.text}`);
  }

  return lines;
}

/**
 * 构建神经链记忆注入文本
 *
 * 逻辑：
 * 1. 扫描当前正文中出现的角色
 * 2. 只取这些角色的记忆
 * 3. 按关系链组织：用户↔角色、角色↔角色
 * 4. 不在场的角色记忆不注入
 */
export function buildNeuralChainInjection(
  store: { getFusedMemories: (characterName: string, recentVersions?: number, queryEmb?: number[], recallLimit?: number, queryText?: string) => Array<{ text: string; isCore: boolean }> },
  characterMemories: CharacterMemory[],
  currentCharacterNames: string[],
  userName: string,
  queryEmb?: number[],
  queryText?: string,
  preReranked?: Map<string, Array<{ text: string; time?: string }>>,
): string | null {
  // 只取当前在场角色的记忆
  const relevantMemories = characterMemories.filter(m => currentCharacterNames.includes(m.characterName));

  if (relevantMemories.length === 0) return null;

  const parts: string[] = [];

  parts.push('<neural_chain>');
  parts.push('**以下是当前场景相关的可用记忆链，正文创作时可自然引用这些记忆作为角色行为的依据：**');
  parts.push('');

  // 链1：用户↔各在场角色
  for (const memory of relevantMemories) {
    const chainId = `${userName}_${memory.characterName}`.replace(/\s+/g, '_');
    parts.push(`<memory_chain_${chainId}>`);
    parts.push(
      `${memory.characterName}对${userName}的记忆（态度：${memory.attitude === 'like' ? '好感' : memory.attitude === 'dislike' ? '厌恶' : '中立'}）：`,
    );
    // 用融合记忆：优先使用重排结果，否则遍历所有版本运行时融合
    const reranked = preReranked?.get(memory.characterName);
    const fused = reranked || store.getFusedMemories(memory.characterName, undefined, queryEmb, undefined, queryText);
    if (fused && fused.length > 0) {
      const timeItems = fused.map(item => ({
        text: item.text,
        time: (item as any).time as string | undefined,
      }));
      for (const line of formatTimeGrouped(timeItems)) {
        parts.push(line);
      }
    } else {
      const orderedItems = (memory as any).orderedNewMemories as Array<{ text: string; time?: string }> | undefined;
      if (orderedItems && orderedItems.length > 0) {
        for (const line of formatTimeGrouped(orderedItems)) {
          parts.push(line);
        }
      } else {
      // 兜底：直接列记忆内容（兼容旧 string[] 格式）
      for (const item of memory.coreMemories || []) {
        parts.push(`  - ${typeof item === 'string' ? item : (item as any).text || ''}`);
      }
      for (const item of memory.recentMemories || []) {
        parts.push(`  - ${item}`);
      }
      }
    }
    parts.push(`</memory_chain_${chainId}>`);
    parts.push('');
  }

  // 链2：在场角色之间的交叉记忆（如果有多个在场角色）
  if (relevantMemories.length > 1) {
    for (let i = 0; i < relevantMemories.length; i++) {
      for (let j = i + 1; j < relevantMemories.length; j++) {
        const a = relevantMemories[i];
        const b = relevantMemories[j];
        // 用融合记忆保持排序
        function getOrderedTexts(mem: CharacterMemory): string[] {
          const fusedCross = store.getFusedMemories(mem.characterName, undefined, queryEmb, undefined, queryText);
          if (fusedCross && fusedCross.length > 0) return fusedCross.map(m => m.text);
          const coreTexts = (mem.coreMemories || []).map(c => typeof c === 'string' ? c : ((c as any).text || ''));
          return [...coreTexts, ...(mem.recentMemories || [])];
        }
        const allMemsA = getOrderedTexts(a);
        const allMemsB = getOrderedTexts(b);
        const aMemsAboutB = allMemsA.filter(m => m.includes(b.characterName));
        const bMemsAboutA = allMemsB.filter(m => m.includes(a.characterName));

        if (aMemsAboutB.length > 0 || bMemsAboutA.length > 0) {
          const crossId = `${a.characterName}_${b.characterName}`.replace(/\s+/g, '_');
          parts.push(`<memory_chain_${crossId}>`);
          if (aMemsAboutB.length > 0) {
            parts.push(`${a.characterName}关于${b.characterName}的记忆：`);
            for (const item of aMemsAboutB) {
              parts.push(`- ${item}`);
            }
          }
          if (bMemsAboutA.length > 0) {
            parts.push(`${b.characterName}关于${a.characterName}的记忆：`);
            for (const item of bMemsAboutA) {
              parts.push(`- ${item}`);
            }
          }
          parts.push(`</memory_chain_${crossId}>`);
          parts.push('');
        }
      }
    }
  }

  parts.push('</neural_chain>');

  return parts.join('\n');
}

/**
 * 注入神经链记忆
 * 使用 injectPrompts 注入到 D1（人设后面）
 */
let currentNeuralInjection: { uninject: () => void } | null = null;

export function injectNeuralChain(
  store: { getFusedMemories: (characterName: string, recentVersions?: number, queryEmb?: number[], recallLimit?: number, queryText?: string) => Array<{ text: string; isCore: boolean }> },
  characterMemories: CharacterMemory[],
  latestContent: string,
  allCharacterNames: string[],
  characterEntries: CharacterNameEntry[],
  userName: string,
  queryEmb?: number[],
  queryText?: string,
  preReranked?: Map<string, Array<{ text: string; time?: string }>>,
): void {
  // 先移除旧的注入
  if (currentNeuralInjection) {
    currentNeuralInjection.uninject();
    currentNeuralInjection = null;
  }

  // 扫描当前在场角色（支持别名）
  const currentCharacters = scanCharacterNamesFromContent(latestContent, allCharacterNames, characterEntries);

  if (currentCharacters.length === 0) return;

  // 构建注入文本
  const injectionText = buildNeuralChainInjection(store, characterMemories, currentCharacters, userName, queryEmb, queryText, preReranked);
  if (!injectionText) return;

  // 使用 injectPrompts 注入到 D1（紧跟人设后面）
  currentNeuralInjection = injectPrompts([
    {
      id: 'zhino_neural_chain',
      position: 'in_chat',
      depth: 0,
      role: 'system',
      content: injectionText,
      should_scan: false,
    },
  ]);

  console.info(`[智脑] 神经链记忆已激活 (${currentCharacters.length} 角色)`);
}

/**
 * 移除神经链注入
 */
export function removeNeuralChainInjection(): void {
  if (currentNeuralInjection) {
    currentNeuralInjection.uninject();
    currentNeuralInjection = null;
  }
}
