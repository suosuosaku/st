/**
 * 物品记忆库 (Item Memory)
 * 独立的物品实体库，跨大总结版本累积物品历史。
 * 数据来源：大总结V2事件中的items字段。
 * 功能：归档、合并同名物品、维护完整历史、前端CRUD。
 */

import type { ItemRecord, GrandSummaryV2Event } from './grandSummaryV2';
import { getEmbedding, cosineSimilarity } from './embedding';

// ======== 数据结构 ==========

export interface ItemHistoryEntry {
  storyTime: string;
  event: string;
  owner?: string;
  state?: string;
  floorRange?: string;
  summaryVersion?: number;
}

export interface ItemMemory {
  id: string;
  itemName: string;
  aliases: string[];
  currentOwner: string;
  currentLocation: string;
  currentState: string;
  description: string;
  history: ItemHistoryEntry[];
  relatedCharacters: string[];
  openQuestions: string[];
  lastUpdatedAt: string;
  status: 'active' | 'ignored' | 'merged';
  mergedInto?: string; // 合并目标的 id
  embedding?: number[]; // 语义向量（用于召回）
}

// ========== 归档逻辑 ==========

/**
 * 从大总结V2事件中归档物品到物品记忆库
 * 如果物品已存在（名字或别名匹配），更新其状态和历史；否则新建。
 */
export function archiveItemsFromEvents(
  events: GrandSummaryV2Event[],
  existingItems: ItemMemory[],
  summaryVersion: number,
): ItemMemory[] {
  const updatedItems = [...existingItems];

  for (const evt of events) {
    if (!evt.items || evt.items.length === 0) continue;

    for (const itemRecord of evt.items) {
      if (!itemRecord.itemName) continue;

      // 查找已有物品（按名字或别名匹配）
      const existing = findItemByName(updatedItems, itemRecord.itemName);

      if (existing) {
        // 冲突检测：名字相同但持有者和描述完全不同 → 视为不同物品
        const ownerConflict = existing.currentOwner && itemRecord.owner
          && existing.currentOwner !== itemRecord.owner
          && !existing.currentOwner.includes(itemRecord.owner)
          && !itemRecord.owner.includes(existing.currentOwner);
        const descConflict = existing.description && itemRecord.description
          && existing.description !== itemRecord.description
          && !existing.description.includes(itemRecord.description);

        if (ownerConflict && descConflict) {
          // 可能是不同物品同名，新建而非合并
          const newItem = createNewItem(itemRecord, evt, summaryVersion);
          updatedItems.push(newItem);
          console.warn(`[智脑-物品] 同名不同物: "${itemRecord.itemName}" (已有持有者:${existing.currentOwner}, 新:${itemRecord.owner})，已分别存储`);
        } else {
          // 正常更新
          updateExistingItem(existing, itemRecord, evt, summaryVersion);
        }
      } else {
        // 新建物品
        const newItem = createNewItem(itemRecord, evt, summaryVersion);
        updatedItems.push(newItem);
      }
    }
  }

  return updatedItems;
}

/**
 * 清理指定版本号产生的物品历史。
 * 重总结/撤回大总结时调用，防止物品重复。
 * 如果某物品清理后无历史，则移除该物品。
 */
export function removeItemHistoryByVersion(
  items: ItemMemory[],
  version: number,
): ItemMemory[] {
  return items.filter(item => {
    item.history = item.history.filter(h => h.summaryVersion !== version);
    // 清理后无历史 + 无向量的新建物品 → 移除
    if (item.history.length === 0 && !item.embedding) return false;
    // 清理后只剩其他版本的历史 → 用次新历史恢复状态
    if (item.history.length > 0) {
      const latest = item.history[item.history.length - 1];
      if (latest.owner) item.currentOwner = latest.owner;
      if (latest.state) item.currentState = latest.state;
    }
    return true;
  });
}

/**
 * 根据名字或别名查找物品
 */
function findItemByName(items: ItemMemory[], name: string): ItemMemory | undefined {
  const normalizedName = name.trim().toLowerCase();
  return items.find(item => {
    if (item.status === 'merged' || item.status === 'ignored') return false;
    if (item.itemName.toLowerCase() === normalizedName) return true;
    return item.aliases.some(a => a.toLowerCase() === normalizedName);
  });
}

/**
 * 更新已有物品的状态和历史
 */
function updateExistingItem(
  item: ItemMemory,
  record: ItemRecord,
  evt: GrandSummaryV2Event,
  summaryVersion: number,
): void {
  // 更新当前状态
  if (record.owner) item.currentOwner = record.owner;
  if (record.state) item.currentState = record.state;
  if (evt.location) item.currentLocation = evt.location;
  if (record.description && !item.description) item.description = record.description;

  // 添加历史条目
  const historyEntry: ItemHistoryEntry = {
    storyTime: evt.time,
    event: record.change || `${record.itemName}出现于${evt.location || '未知地点'}`,
    owner: record.owner || undefined,
    state: record.state || undefined,
    summaryVersion,
  };
  item.history.push(historyEntry);

  // 更新相关角色
  for (const char of evt.presentCharacters) {
    if (!item.relatedCharacters.includes(char)) {
      item.relatedCharacters.push(char);
    }
  }

  item.lastUpdatedAt = new Date().toISOString();
}

/**
 * 创建新物品记录
 */
function createNewItem(
  record: ItemRecord,
  evt: GrandSummaryV2Event,
  summaryVersion: number,
): ItemMemory {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  return {
    id,
    itemName: record.itemName,
    aliases: [],
    currentOwner: record.owner || '',
    currentLocation: evt.location || '',
    currentState: record.state || '',
    description: record.description || '',
    history: [{
      storyTime: evt.time,
      event: record.change || `首次出现`,
      owner: record.owner || undefined,
      state: record.state || undefined,
      summaryVersion,
    }],
    relatedCharacters: [...evt.presentCharacters],
    openQuestions: [],
    lastUpdatedAt: new Date().toISOString(),
    status: 'active',
  };
}

// ========== 物品合并 ==========

/**
 * 合并两个物品（sourceId 合并到 targetId）
 * - 源物品标记为 merged，其别名和历史转移到目标
 * - 持有者/位置/状态以目标为准（目标是"主物品"）
 */
export function mergeItems(
  items: ItemMemory[],
  sourceId: string,
  targetId: string,
): ItemMemory[] {
  const source = items.find(i => i.id === sourceId);
  const target = items.find(i => i.id === targetId);
  if (!source || !target) return items;

  // 将源物品名加入目标别名
  if (!target.aliases.includes(source.itemName)) {
    target.aliases.push(source.itemName);
  }
  // 合并源物品别名
  for (const alias of source.aliases) {
    if (!target.aliases.includes(alias) && alias !== target.itemName) {
      target.aliases.push(alias);
    }
  }

  // 合并历史（去重按 storyTime+event）
  for (const h of source.history) {
    const exists = target.history.some(
      th => th.storyTime === h.storyTime && th.event === h.event,
    );
    if (!exists) target.history.push(h);
  }
  // 按时间排序历史
  target.history.sort((a, b) => a.storyTime.localeCompare(b.storyTime));

  // 合并相关角色
  for (const char of source.relatedCharacters) {
    if (!target.relatedCharacters.includes(char)) {
      target.relatedCharacters.push(char);
    }
  }

  // 标记源为已合并
  source.status = 'merged';
  source.mergedInto = targetId;
  target.lastUpdatedAt = new Date().toISOString();

  return items;
}

// ========== 物品忽略/恢复 ==========

export function ignoreItem(items: ItemMemory[], itemId: string): void {
  const item = items.find(i => i.id === itemId);
  if (item) item.status = 'ignored';
}

export function restoreItem(items: ItemMemory[], itemId: string): void {
  const item = items.find(i => i.id === itemId);
  if (item && item.status === 'ignored') item.status = 'active';
}

// ========== 查询工具 ==========

/** 获取所有活跃物品 */
export function getActiveItems(items: ItemMemory[]): ItemMemory[] {
  return items.filter(i => i.status === 'active');
}

/** 根据角色名获取相关物品 */
export function getItemsByCharacter(items: ItemMemory[], characterName: string): ItemMemory[] {
  return items.filter(i =>
    i.status === 'active' && i.relatedCharacters.includes(characterName),
  );
}

/** 根据地点获取物品 */
export function getItemsByLocation(items: ItemMemory[], location: string): ItemMemory[] {
  return items.filter(i =>
    i.status === 'active' && i.currentLocation.includes(location),
  );
}

/** 构建物品记忆注入文本（用于本轮状态包） */
export function buildItemMemoryInjection(
  items: ItemMemory[],
  relevantCharacters: string[],
  currentLocation?: string,
): string | null {
  // 只取与当前在场角色或当前地点相关的物品
  const relevant = items.filter(i => {
    if (i.status !== 'active') return false;
    if (relevantCharacters.some(c => i.relatedCharacters.includes(c))) return true;
    if (currentLocation && i.currentLocation.includes(currentLocation)) return true;
    return false;
  });

  if (relevant.length === 0) return null;

  const lines: string[] = ['<item_memory>'];
  for (const item of relevant) {
    const aliases = item.aliases.length > 0 ? `（${item.aliases.join('/')})` : '';
    lines.push(
      `${item.itemName}${aliases}: ${item.description || item.currentState} |` +
      `持有:${item.currentOwner || '未知'} | 位于:${item.currentLocation || '未知'} | ` +
      `状态:${item.currentState || '正常'}`,
    );
  }
  lines.push('</item_memory>');

  return lines.join('\n');
}

// ========== 物品语义召回 ==========

export interface EmbeddingSettings {
  enabled: boolean;
  apiUrl: string;
  apiKey: string;
  model: string;
  dimensions: number;
  similarityThreshold: number;
}

/** 构建物品的嵌入文本 */
function buildItemEmbedText(item: ItemMemory): string {
  const parts: string[] = [`[物品] ${item.itemName}`];
  if (item.description) parts.push(item.description);
  parts.push(`持有:${item.currentOwner || '未知'}`);
  parts.push(`位于:${item.currentLocation || '未知'}`);
  parts.push(`状态:${item.currentState || '正常'}`);
  return parts.join(' | ');
}

/**
 * 为没有向量的活跃物品生成 embedding
 * 调用方负责在完成后 persist
 */
export async function embedItems(
  items: ItemMemory[],
  settings: EmbeddingSettings,
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const toEmbed: { item: ItemMemory; text: string }[] = [];
  for (const item of items) {
    if (item.status !== 'active') continue;
    if (item.embedding && item.embedding.length > 0) continue;
    const text = buildItemEmbedText(item);
    if (text.trim()) toEmbed.push({ item, text });
  }

  if (toEmbed.length === 0) {
    console.info('[智脑-物品召回] 无需生成新向量');
    return 0;
  }

  console.info(`[智脑-物品召回] 待嵌入: ${toEmbed.length} 件物品`);
  let done = 0;
  for (const { item, text } of toEmbed) {
    try {
      item.embedding = await getEmbedding(text, settings);
      done++;
      onProgress?.(done, toEmbed.length);
    } catch (err) {
      console.warn(`[智脑-物品召回] 物品"${item.itemName}"嵌入失败:`, (err as Error).message);
    }
  }

  console.info(`[智脑-物品召回] 完成: ${done}/${toEmbed.length} 件`);
  return done;
}

/**
 * 语义召回相关物品
 * @param queryText 查询文本（当前上下文）
 * @param items 物品列表
 * @param settings embedding 设置
 * @param topN 最多返回 N 件
 * @returns 按相似度降序排列的物品数组
 */
export async function recallItems(
  queryText: string,
  items: ItemMemory[],
  settings: EmbeddingSettings,
  topN: number = 5,
): Promise<Array<{ item: ItemMemory; score: number }>> {
  if (!settings.enabled || !settings.apiKey) return [];
  const activeItems = items.filter(i => i.status === 'active' && i.embedding && i.embedding.length > 0);
  if (activeItems.length === 0) return [];

  try {
    const queryVec = await getEmbedding(queryText, settings);
    const scored = activeItems.map(item => ({
      item,
      score: cosineSimilarity(queryVec, item.embedding!),
    }));
    scored.sort((a, b) => b.score - a.score);
    const results = scored.filter(s => s.score >= settings.similarityThreshold).slice(0, topN);

    if (results.length > 0) {
      console.info(
        `[智脑-物品召回] 召回 ${results.length}/${activeItems.length} 件，` +
        results.map(r => `${r.item.itemName}(${r.score.toFixed(3)})`).join(', '),
      );
    }
    return results;
  } catch (err) {
    console.warn('[智脑-物品召回] 召回失败:', (err as Error).message);
    return [];
  }
}

/** 清空物品的 embedding（编辑后标记为脏，下次大总结重嵌） */
export function invalidateItemEmbedding(item: ItemMemory): void {
  delete item.embedding;
}
