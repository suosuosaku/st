
/**
 * 苍玄界脚本 - 智脑系统入口
 *
 * 功能：
 * 1. 用户人格分析与注入
 * 2. 动态人设生成与注入
 * 3. 正文捕获与记录
 * 4. 精准大总结（精神链记忆库）
 * 5. 记忆激活系统
 * 6. 梦呓系统
 * 7. 调度系统（串行队列）
 * 8. 后台角色行动推演
 */
import { createScriptIdDiv, reloadOnChatChange, teleportStyle } from '@util/script';
import App from './App.vue';
import { buildDreamtalkInjection, executeDreamtalkAnalysis, scanCharacterNamesFromContent } from './core/dreamtalk';
import { injectDynamicProfiles } from './core/dynamicProfile';
import { injectPersonaIntoCompletion } from './core/persona';
import { injectNeuralChain } from './core/neuralChain';
import { injectNsfwData, isNsfwActive } from './core/nsfwIsolation';

import {
  getContentsSinceLast,
  shouldTriggerSummary,
  buildMemorySectionText,
} from './core/summary';
import {
  ensureRecentFloorsVisible as ensureRecentFloorsVisibleCore,
  getCapturedContentMessageIds,
  hideSummaryFloors,
} from './core/floorVisibility';
import { enqueueAnalysis, clearSchedulerQueue } from './core/backgroundQueue';
import { embedTimelineEvents, embedCharacterMemories, getEmbedding, cosineSimilarity } from './core/embedding';
import { executeSmallSummary } from './core/smallSummary';
import { executeEcosystemAnalysis, injectEcosystem } from './core/ecosystem';
import { syncSmallSummaryStatus } from './core/contextReplacement';
import { getHiddenFloorsFromChat } from './core/floorVisibility';
import { injectRelationshipProfiles, updateRelationshipWorldbookCacheFromLore } from './core/relationshipAnalysis';
import { extractContentFromMessage } from './utils/messageParser';
import { useMainStore, type GrandSummary, type TimelineEvent } from './stores/mainStore';

// ========== 新模块导入 ==========
import { executeGrandSummaryV2 } from './core/grandSummaryV2';
import { executeCharacterMemoryUpdate } from './core/characterMemoryUpdate';
import { archiveItemsFromEvents, embedItems, recallItems, invalidateItemEmbedding } from './core/itemMemory';
import { executeDynamicProfileV2, injectDynamicProfileV2 } from './core/dynamicProfileV2';
import { executeWorldProgress, injectWorldProgress, shouldTriggerWorldProgress } from './core/worldProgress';
import { injectPlotGuidance, executePlotCheck, shouldTriggerPlotCheck, advanceOutlineStage } from './core/plotDirector';
import { buildFactEmphasis, injectFactEmphasis } from './core/factEmphasis';
import {
  buildCangxuanSchedulerConfig,
  buildCangxuanWorldbookInjection,
  scanCangxuanWorldbooks,
} from './core/cangxuanWorldbookScheduler';
import { flattenCangxuanMvuForScene, readLatestCangxuanMvuSnapshot } from './core/cangxuanMvuBridge';

// ========== 关键词模糊匹配（子串命中） ==========

/**
 * 检查关键词是否在文本中命中（支持子串模糊匹配）
 *
 * 动机：AI 生成的关键词常为多字复合词（腥臭爱液、神魂共鸣、永恒山脉），
 * 但对话中极少完整复现，只会自然提到片段（爱液、共鸣、山脉）。
 *
 * 策略：
 * 1. 精确匹配优先（快路径）
 * 2. 长关键词（≥4字）提取 2-3 字子串，任一子串出现在文本中即命中
 * 3. 短关键词（≤3字）仅精确匹配（避免误触发）
 *
 * 注意：此方法只处理连续子串匹配，非连续的缩写（如 开辟空窍→开窍）
 * 需 AI 在关键词中同时包含缩写形式。
 */
function fuzzyMatchKeyword(keyword: string, text: string): boolean {
  const kw = keyword.toLowerCase();
  const t = text;
  // 1. 精确匹配
  if (t.includes(kw)) return true;
  // 2. 子串匹配：仅对 ≥4 字的关键词，提取 2-3 字滑动窗口
  if (kw.length >= 4) {
    for (let len = 3; len >= 2; len--) {
      for (let i = 0; i <= kw.length - len; i++) {
        const sub = kw.slice(i, i + len);
        if (t.includes(sub)) return true;
      }
    }
  }
  return false;
}

/**
 * 用户侧模糊匹配 — 比通用版更宽松，支持反向子串
 *
 * 动机：用户在对话中只说"蛊"或"剑"，应该匹配到触发词"月光蛊""十全剑"。
 * 在标准正向子串匹配（关键词片段 ⊆ 用户文本）之后，
 * 追加反向检测：用户文本中的完整词条是否被关键词包含。
 *
 * 反向匹配仅对 ≥1 字的词语生效，且仅用于用户侧（AI回复侧保持原有精度）。
 */
function fuzzyMatchKeywordUser(keyword: string, userText: string): boolean {
  // 标准正向匹配
  if (fuzzyMatchKeyword(keyword, userText)) return true;
  // 反向匹配：用户文本中的词 ⊆ 关键词
  const kwLower = keyword.toLowerCase();
  const ut = userText.toLowerCase();
  // 提取用户输入中的连续词块（中文/英文/数字）
  const userWords = ut.match(/[\u4e00-\u9fff\w]+/g) || [];
  for (const word of userWords) {
    if (word.length >= 1 && kwLower.includes(word)) return true;
  }
  return false;
}

$(() => {
  const pinia = createPinia();
  const app = createApp(App).use(pinia);

  // ========== 前端面板挂载（div模式，挂载到酒馆网页body） ==========

  const $app = createScriptIdDiv().appendTo('body');
  const { destroy } = teleportStyle();
  app.mount($app[0]);

  // 捕获开场白（第0层不会触发 MESSAGE_RECEIVED 事件）
  useMainStore(pinia).captureFloorZero();

  // ========== 世界书角色名缓存 ==========

  /** 从世界书条目中提取的角色名集合（每次推演时实时更新） */
  let worldBookNames = new Set<string>();
  /** 世界书角色名→内容（用于手动注入到 callGenerateRaw 调用中） */
  let worldBookContents = new Map<string, string>();
  /** 原始世界书条目（保留用于后续重新扫描） */
  let worldBookRawEntries: any[] = [];

  function refreshWorldBookCache(store: ReturnType<typeof useMainStore>) {
    if (worldBookRawEntries.length === 0) return;
    const knownNames = [
      ...store.getAllCharacterNames(),
      ...store.getDreamtalkCharacterNames(),
      ...store.dynamicProfiles.map(p => p.characterName),
      ...(store.ecosystemManualChars || '').split(',').map(s => s.trim()).filter(Boolean),
    ];
    const knownNamesSet = new Set(knownNames);
    if (knownNamesSet.size === 0) return;

    const names = new Set<string>();
    const contents = new Map<string, string>();

    for (const entry of worldBookRawEntries) {
      const entryContent: string = (entry as any).content || '';
      // entry.key / entry.keysecondary 可能是 string 或 string[]
      const rawKey = (entry as any).key;
      const rawKeySecondary = (entry as any).keysecondary;
      const keyStr = Array.isArray(rawKey) ? rawKey.join(',') : (rawKey || '');
      const keySecStr = Array.isArray(rawKeySecondary) ? rawKeySecondary.join(',') : (rawKeySecondary || '');
      const keys = [
        ...keyStr.split(',').map((k: string) => k.trim().toLowerCase()),
        ...keySecStr.split(',').map((k: string) => k.trim().toLowerCase()),
      ].filter(Boolean);
      const contentLower = entryContent.toLowerCase();

      for (const name of knownNamesSet) {
        const nameLower = name.toLowerCase();
        const nameNorm = nameLower.replace(/\s*\(.+?\)\s*/g, '').trim();
        if (keys.some(k => k.includes(nameNorm) || nameNorm.includes(k))
            || contentLower.includes(nameNorm)
            || contentLower.includes(nameLower)) {
          names.add(name);
          const existing = contents.get(name) || '';
          contents.set(name, existing ? existing + '\n---\n' + entryContent : entryContent);
        }
      }
    }

    if (names.size > 0) {
      worldBookNames = names;
      worldBookContents = contents;
      console.info(`[智脑] 世界书角色缓存: ${[...names].join('、')} (${names.size}/${knownNamesSet.size}个, ${contents.size}条内容)`);
    }
  }

  async function refreshCangxuanWorldbookScan(store: ReturnType<typeof useMainStore>): Promise<void> {
    if (!store.settings.cangxuanWorldbookSchedulerEnabled) return;
    try {
      const scan = await scanCangxuanWorldbooks(buildCangxuanSchedulerConfig(store.settings));
      store.chatData.cangxuanWorldbookScan = scan;
      console.info(
        `[智脑-苍玄界] 世界书扫描完成: ${scan.counts.books}本 ${scan.counts.entries}条，重名${scan.duplicates.length}组`,
      );
    } catch (error) {
      console.warn('[智脑-苍玄界] 世界书扫描失败:', error);
    }
  }

  async function collectCangxuanVariableSceneHints(store: ReturnType<typeof useMainStore>): Promise<string> {
    const lines: string[] = [];

    function pushLine(path: string, value: unknown) {
      if (lines.length >= 40) return;
      let text = '';
      if (typeof value === 'string') {
        text = value;
      } else {
        try {
          text = JSON.stringify(value);
        } catch {
          text = String(value ?? '');
        }
      }
      if (!text) return;
      lines.push(`${path}: ${text.replace(/\s+/g, ' ').trim().slice(0, 220)}`);
    }

    const latestSummary = store.getLatestSummary();
    for (const event of latestSummary?.timeline?.slice(-1) || []) {
      pushLine(`summary/${event.time || ''}/${event.event || ''}`, `${event.detail || ''}`);
    }
    for (const content of store.capturedContents.slice(-2)) {
      pushLine(`captured/${content.messageId}`, content.content || '');
    }
    for (const record of store.userInputRecords.slice(-2)) {
      pushLine(`user/${record.messageId}`, record.userInput || '');
    }

    try {
      const snapshot = await readLatestCangxuanMvuSnapshot();
      pushLine('mvu_snapshot', flattenCangxuanMvuForScene(snapshot));
    } catch (error) {
      console.warn('[智脑-苍玄界] 读取 MVU 场景线索失败:', error);
    }

    return lines.join('\n').slice(-4000);
  }

  eventOn(tavern_events.WORLDINFO_ENTRIES_LOADED, (lores) => {
    updateRelationshipWorldbookCacheFromLore(lores);
    // 保存原始条目供后续重新扫描（过滤关闭的条目）
    const allRawEntries = [
      ...(lores.characterLore || []),
      ...(lores.globalLore || []),
      ...(lores.chatLore || []),
      ...(lores.personaLore || []),
    ];
    worldBookRawEntries = allRawEntries.filter((e: any) => e.enabled !== false);
    const store = useMainStore(pinia);
    // 同步世界书条目到 store，供剧情导演等模块引用
    store.chatData.worldBookEntries = worldBookRawEntries
      .map((e: any) => {
        const rawKey = e.key;
        const displayKey = e.comment || (Array.isArray(rawKey) ? rawKey.join(', ') : (rawKey || '未命名'));
        const content = typeof e.content === 'string' ? e.content : String(e.content || '');
        const insertionOrder = typeof e.insertion_order === 'number' ? e.insertion_order : 0;
        return { key: displayKey, content, insertionOrder };
      })
      .filter((e: any) => e.content)
      .sort((a: any, b: any) => b.insertionOrder - a.insertionOrder);
    refreshWorldBookCache(store);
    void refreshCangxuanWorldbookScan(store);
  });

  // ========== 正文捕获系统 ==========

  // 监听AI回复完成 → 捕获正文 + 记录用户输入 + 检查是否触发大总结 + 后台推演
  eventOn(tavern_events.MESSAGE_RECEIVED, (messageId, type) => {
    console.info(`[智脑] MESSAGE_RECEIVED #${messageId} type=${type || 'undefined'}`);
    try {
      const store = useMainStore(pinia);
      if (!store.settings.captureEnabled) {
        console.info(`[智脑] 跳过 #${messageId}: 捕获已禁用`);
        return;
      }

      // 只跳过明确不需要捕获的类型
      if (type === 'quiet' || type === 'command' || type === 'extension') {
        console.info(`[智脑] 跳过 #${messageId}: type=${type} (已过滤)`);
        return;
      }

      const aiMessages = getChatMessages(messageId, { role: 'assistant' });
      if (!aiMessages || aiMessages.length === 0) {
        console.info(`[智脑] 跳过 #${messageId}: getChatMessages 返回 ${aiMessages ? aiMessages.length : 'null/undefined'} 条`);
        return;
      }

      const aiMsg = aiMessages[0];
      const content = extractContentFromMessage(aiMsg.message);
      if (content) {
        store.captureContent(messageId, content);
        console.info(`[智脑] ✅ 捕获楼层 #${messageId} 正文 (${content.length} 字)`);

        // 记录用户输入
        const userMessages = getChatMessages(messageId - 1, { role: 'user' });
        if (userMessages && userMessages.length > 0) {
          store.recordUserInput(messageId - 1, userMessages[0].message, content);
        }

        // 检查是否应该触发大总结（通过调度器入队）
        checkAndTriggerSummary(store);

        // 小总结：每轮用户+AI完成后入队生成
        if (store.settings.captureEnabled) {
          const userFloor = messageId - 1;
          const aiFloor = messageId;
          const userText = userMessages && userMessages.length > 0 ? userMessages[0].message : '';
          enqueueAnalysis('small_summary', async () => {
            const allNames = store.getAllCharacterNames();
            const record = await executeSmallSummary(userText, content, userFloor, aiFloor, allNames, store.getUserName());
            // 重 roll 时替换同楼层范围的旧记录，保持位置不变
            const existingIdx = store.chatData.smallSummaries.findIndex(
              (s: any) => s.floorRange?.start === userFloor && s.floorRange?.end === aiFloor,
            );
            if (existingIdx !== -1) {
              store.chatData.smallSummaries[existingIdx] = record;
            } else {
              store.chatData.smallSummaries.push(record);
            }
            store.forcePersist();
          });
        }

        // 后台推演：每 N 楼触发，必须在酒馆 AI 回复完成后
        if (store.settings.ecosystemEnabled) {
          const capturedCount = store.capturedContents.length;
          if (capturedCount > 0 && capturedCount % store.settings.ecosystemInterval === 0) {
            enqueueAnalysis('ecosystem', async () => {
              await triggerEcosystemAnalysis(store);
            });
          }
        }

        // 世界推进：每 N 个AI楼层触发
        if (store.settings.worldProgressEnabled) {
          const lastWPFloor = store.chatData.lastWorldProgressFloor;
          if (shouldTriggerWorldProgress(messageId, lastWPFloor, store.settings.worldProgressInterval)) {
            enqueueAnalysis('world_progress', async () => {
              await triggerWorldProgress(store, messageId);
            });
          }
        }

        // 剧情校对：剧情导演开启且有活跃大纲时
        if (store.settings.plotDirectorEnabled && store.chatData.plotOutline?.status === 'active') {
          const lastCheckFloor = store.chatData.lastPlotCheckFloor;
          if (shouldTriggerPlotCheck(messageId, lastCheckFloor, store.settings.plotCheckInterval)) {
            enqueueAnalysis('plot_check', async () => {
              await triggerPlotCheck(store, messageId);
            });
          }
        }

        // 动态人设V2：达到间隔后标记 pending，等下次用户输入再触发（防重roll）
        if (store.settings.dynamicProfileEnabled && store.settings.dynamicProfileInterval > 0) {
          const newCount = store.capturedContents.filter(
            c => c.messageId > store.chatData.lastDynamicProfileFloor,
          ).length;
          if (newCount >= store.settings.dynamicProfileInterval) {
            store.chatData.pendingDynamicProfile = true;
            console.info(`[智脑-动态人设] 计数${newCount}/${store.settings.dynamicProfileInterval}，标记pending，等待下次用户输入`);
          }
        }
      } else {
        console.info(`[智脑] 跳过 #${messageId}: extractContentFromMessage 返回空 (消息长度=${aiMsg.message?.length || 0})`);
      }
    } catch (err) {
      console.error(`[智脑] ❌ MESSAGE_RECEIVED #${messageId} 异常:`, err);
    }
  });

  // ========== 动态人设V2：用户发消息时检查pending并触发分析 ==========

  eventOn(tavern_events.MESSAGE_SENT, () => {
    const store = useMainStore(pinia);
    if (!store.settings.dynamicProfileEnabled) return;
    if (!store.chatData.pendingDynamicProfile) return;

    store.chatData.pendingDynamicProfile = false;
    const interval = store.settings.dynamicProfileInterval;
    const latestRounds = store.capturedContents.slice(-interval);

    if (latestRounds.length === 0) return;

    console.info(`[智脑-动态人设V2] pending触发, 分析最新${latestRounds.length}轮 (楼层${latestRounds[0].messageId}-${latestRounds[latestRounds.length-1].messageId})`);

    enqueueAnalysis('dynamic_profile_v2', async () => {
      try {
        const result = await executeDynamicProfileV2(
          latestRounds,
          store.chatData.dynamicProfilesV2,
          store.getUserName(),
        );
        store.chatData.dynamicProfilesV2 = result.profiles;
        store.chatData.lastDynamicProfileFloor = Math.max(...latestRounds.map(c => c.messageId), store.chatData.lastDynamicProfileFloor);
        store.forcePersist();
        console.info(`[智脑-动态人设V2] 更新完成: ${result.profiles.length} 角色, 截止楼层${store.chatData.lastDynamicProfileFloor}`);
      } catch (e) {
        console.error('[智脑-动态人设V2] 分析失败:', e);
      }
    });
  });

  // 监听消息被swipe → 更新正文记录
  eventOn(tavern_events.MESSAGE_SWIPED, messageId => {
    const store = useMainStore(pinia);
    if (!store.settings.captureEnabled) return;

    setTimeout(() => {
      const aiMessages = getChatMessages(messageId, { role: 'assistant' });
      if (aiMessages.length === 0) return;

      const aiMsg = aiMessages[0];
      const content = extractContentFromMessage(aiMsg.message);
      if (content) {
        store.captureContent(messageId, content);
        console.info(`[智脑] 更新楼层 #${messageId} 正文 (swipe)`);

        const userMessages = getChatMessages(messageId - 1, { role: 'user' });
        if (userMessages.length > 0) {
          store.recordUserInput(messageId - 1, userMessages[0].message, content);
        }
      }
    }, 500);
  });

  // ========== 提示词注入系统 ==========

  eventOn(tavern_events.CHAT_COMPLETION_SETTINGS_READY, async completion => {
    const store = useMainStore(pinia);

    // ═══ 后台分析守护 ═══
    // callGenerateRaw 在原生 API 模式下会在 prompt 头部注入 <!--ZHINO_BG--> 标记。
    // 遍历 completion 所有可搜索字段，只要标记出现在任何地方就跳过注入。
    let bgMarkerFound = false;
    for (const key of Object.keys(completion)) {
      try {
        const val = (completion as any)[key];
        if (typeof val === 'string' && val.includes('<!--ZHINO_BG-->')) {
          bgMarkerFound = true; break;
        }
        // 数组：如 messages, ordered_prompts
        if (Array.isArray(val)) {
          const arrStr = JSON.stringify(val);
          if (arrStr.includes('<!--ZHINO_BG-->')) { bgMarkerFound = true; break; }
        }
        // 嵌套对象可能有 content
        if (val && typeof val === 'object' && typeof (val as any).content === 'string') {
          if ((val as any).content.includes('<!--ZHINO_BG-->')) { bgMarkerFound = true; break; }
        }
      } catch (_) {
        // Ignore malformed completion fragments while scanning for the background marker.
      }
    }
    // 兜底：JSON 序列化整个 completion
    if (!bgMarkerFound) {
      try {
        const full = JSON.stringify(completion);
        bgMarkerFound = full.includes('<!--ZHINO_BG-->');
      } catch (_) {
        // Ignore non-serializable completion payloads.
      }
    }

    console.info(`[智脑-注入守护] 标记检测=${bgMarkerFound}, completion键=${Object.keys(completion).join(',')}, prompt类型=${typeof completion.prompt}`);

    if (bgMarkerFound) {
      console.warn('[智脑-注入守护] 后台分析调用，跳过本轮注入。');
      return;
    }
    // 兼容旧逻辑：_isBackgroundCall 标记也检查（自定义 API 路径仍使用此标记）
    if (store._isBackgroundCall) {
      console.warn('[智脑-注入守护] _isBackgroundCall 标记为真，跳过本轮注入。');
      return;
    }

    // 标记为真实聊天消息（首次发送 / 重roll / swipe 都算）。
    // 不能放在 MESSAGE_SENT 中：MESSAGE_SENT 只在用户发送新消息时触发，
    // 重roll/swipe 不会触发 MESSAGE_SENT 但会触发本事件，放在这里才能覆盖。
    store._isRealChatMessage = true;

    const latestSummary = store.getLatestSummary();
    const activatedEventNames = new Set<string>();

    // ─── 苍玄界世界书按名调度注入 ───
    if (
      store.settings.cangxuanWorldbookSchedulerEnabled
      && store.settings.cangxuanWorldbookAutoInjectEnabled
      && Array.isArray((completion as any).messages)
    ) {
      if (!store.chatData.cangxuanWorldbookScan?.entries?.length) {
        await refreshCangxuanWorldbookScan(store);
      }
      const messages = (completion as any).messages as Array<{ role?: string; content?: unknown }>;
      const latestCaptured = store.capturedContents[store.capturedContents.length - 1];
      const lastUserMsg = [...messages].reverse().find(message => message.role === 'user');
      const lastUserText = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '';
      const variableSceneHints = await collectCangxuanVariableSceneHints(store);
      const sceneText = [
        lastUserText,
        latestCaptured?.content || '',
        variableSceneHints,
      ].join('\n').slice(-6000);
      const injection = buildCangxuanWorldbookInjection(
        store.chatData.cangxuanWorldbookScan,
        sceneText,
        buildCangxuanSchedulerConfig(store.settings),
      );
      if (injection) {
        const insertAt = Math.max(0, messages.length - 1);
        messages.splice(insertAt, 0, { role: 'system', content: injection.content });
        store.chatData.cangxuanWorldbookLastInjection = injection.report;
        console.info(
          `[智脑-苍玄界] 已注入世界书调度包: ${injection.report.entryNames.join('、')} (${injection.report.estimatedTokens} token估算)`,
        );
      }
    }

    // ─── 统一查询向量（事件召回 + 记忆召回共用） ───
    let sharedQueryEmb: number[] | null = null;
    let sharedQueryText: string = '';
    const useSemantic = store.settings.embeddingEnabled && store.settings.embeddingApiKey;
    if (useSemantic) {
      const latestCaptured = store.capturedContents[store.capturedContents.length - 1];
      const scanText = latestCaptured?.content || '';
      const userRecords = store.userInputRecords;
      const lastUserInput = userRecords.length > 0
        ? userRecords[userRecords.length - 1]?.userInput || ''
        : '';
      sharedQueryText = (lastUserInput + '\n' + scanText).slice(0, 2000);
      try {
        const t0 = Date.now();
        console.info(`[智脑-语义召回] 🔍 查询文本 (${sharedQueryText.length}字): "${sharedQueryText.slice(0, 80)}${sharedQueryText.length > 80 ? '…' : ''}"`);
        sharedQueryEmb = await getEmbedding(sharedQueryText, {
          enabled: true,
          apiUrl: store.settings.embeddingApiUrl,
          apiKey: store.settings.embeddingApiKey,
          model: store.settings.embeddingModel,
          dimensions: store.settings.embeddingDimensions,
          similarityThreshold: 0,
        });
        console.info(`[智脑-语义召回] ⏱️ 查询向量耗时 ${Date.now() - t0}ms`);
      } catch (e) {
        console.warn(`[智脑-语义召回] 查询向量失败（降级为关键词）: ${(e as Error).message}`);
      }
    }

    // --- 神经链记忆激活（提前执行，召回结果供后续大总结注入使用） ---
    if (store.settings.memoryActivationEnabled) {
      const latestMemory = store.getLatestSummary()?.characterMemories || [];
      console.log(`[智脑-注入诊断] 记忆激活: enabled=true, characterMemories数量=${latestMemory.length}`);
      if (latestMemory.length > 0) {
        const latestCaptured = store.capturedContents[store.capturedContents.length - 1];
        const scanText = latestCaptured?.content || '';
        const allNames = store.getAllCharacterNames();
        const characterEntries = latestMemory.map(m => ({
          name: m.characterName,
          aliases: m.aliases || [],
        }));
        const userName = store.getUserName();

        // 重排增强召回（可选，异步执行）
        let preReranked: Map<string, Array<{ text: string; isCore: boolean; time?: string }>> | undefined;
        if (store.settings.rerankEnabled && sharedQueryText) {
          const currentChars = scanCharacterNamesFromContent(scanText, allNames, characterEntries);
          if (currentChars.length > 0) {
            try {
              preReranked = await store.rerankEnhancedRecall(currentChars, sharedQueryText);
            } catch (e) {
              console.warn(`[智脑-语义召回] 重排失败，降级为粗筛: ${(e as Error).message}`);
            }
          }
        }

        injectNeuralChain(store, latestMemory, scanText, allNames, characterEntries, userName, sharedQueryEmb ?? undefined, sharedQueryText || undefined, preReranked);

        // B4: 事件回忆注入 — 近期全注入 + 远期触发召回
        const timeline = store.getLatestSummary()?.timeline || [];
        if (timeline.length > 0) {
          // 扩展扫描范围：AI回复 + 用户上条输入
          const userRecords = store.userInputRecords;
          const lastUserInput = userRecords.length > 0
            ? userRecords[userRecords.length - 1]?.userInput || ''
            : '';
          const scanTextFull = (lastUserInput + '\n' + scanText).toLowerCase();

          const currentVersion = store.getLatestSummary()?.version || 0;
          const recentCount = store.settings.eventRecallRecent || 2;
          const recentThreshold = currentVersion - recentCount + 1;
          const recallLimit = store.settings.eventRecallLimit || 8;

          // 分流：近期 vs 远期
          const recentAll = timeline.filter(e => (e.summaryVersion || 0) >= recentThreshold);
          const olderAll = timeline.filter(e => (e.summaryVersion || 0) < recentThreshold);

          const toInject: Array<{ event: string; detail?: string }> = [];

          // 1. 近期所有事件 → 无条件注入
          for (const evt of recentAll) {
            toInject.push({ event: evt.event, detail: evt.detail });
          }

          // 2. 远期事件召回
          const versionRange = Math.max(currentVersion - recentThreshold + 2, 1);
          const useSemantic = store.settings.embeddingEnabled && store.settings.embeddingApiKey;
          const lastUserInputLower = lastUserInput.toLowerCase();
          const scanTextLower = scanText.toLowerCase();

          if (sharedQueryEmb) {
            // ═══ 语义路径：复用统一查询向量 → 余弦相似度 → 打分排序 ═══
            const withEmb = olderAll.filter(e => e.embedding);
            console.info(
              `[智脑-语义召回] 远期事件 ${olderAll.length} 个 ` +
              `(有向量:${withEmb.length} 无向量:${olderAll.length - withEmb.length})`,
            );
            if (withEmb.length > 0) {
              try {
                const threshold = store.settings.embeddingSimilarityThreshold;
                type ScoredEmb = { event: string; detail: string; version: number; score: number;
                  sim: number; recency: number; importance: number };
                const scored: ScoredEmb[] = [];
                const belowThreshold: { event: string; sim: number }[] = [];

                for (const evt of withEmb) {
                  const sim = cosineSimilarity(sharedQueryEmb, evt.embedding!);
                  if (sim < threshold) {
                    belowThreshold.push({ event: evt.event, sim });
                    continue;
                  }

                  const impScore = (evt.importance || 3) / 5;
                  const rawRecency = ((evt.summaryVersion || 0) - recentThreshold + 1);
                  const recency = Math.max(0, Math.min(rawRecency / versionRange, 1));
                  const score = 0.60 * sim + 0.25 * recency + 0.15 * impScore;

                  scored.push({ event: evt.event, detail: evt.detail || '', version: evt.summaryVersion || 0, score, sim, recency, importance: impScore });
                }

                scored.sort((a, b) => b.score - a.score || b.version - a.version);
                const topN = scored.slice(0, recallLimit);
                for (const s of topN) toInject.push({ event: s.event, detail: s.detail });

                console.info(
                  `[智脑-语义召回] 📊 共${withEmb.length}条 → ` +
                  `命中${scored.length}条 → 注入${topN.length}条 ` +
                  `(阈值=${(threshold * 100).toFixed(0)}% 未达标${belowThreshold.length}条)`,
                );
                // 注入的事件（全部显示）
                for (const e of topN) {
                  console.info(`  🌐 +(${e.score.toFixed(3)}) v${e.version} ${e.event.slice(0, 50)}… | sim:${e.sim.toFixed(3)} r:${e.recency.toFixed(2)} i:${e.importance.toFixed(2)}`);
                }
                // 被阈值砍掉的事件（显示前 5 个相似度最高的）
                if (belowThreshold.length > 0) {
                  belowThreshold.sort((a, b) => b.sim - a.sim);
                  const showN = Math.min(5, belowThreshold.length);
                  console.info(`[智脑-语义召回] ✂️ 被阈值砍掉 ${belowThreshold.length} 条，最高 ${showN} 个:`);
                  for (let i = 0; i < showN; i++) {
                    console.info(`  ✂️ -(${belowThreshold[i].sim.toFixed(3)}) ${belowThreshold[i].event.slice(0, 50)}…`);
                  }
                }
              } catch (err) {
                console.warn(`[智脑-语义召回] ❌ 检索失败，降级关键词: ${(err as Error).message}`);
                // 降级：语义失败时回退到关键词匹配
                keywordRecall(olderAll.filter(e => e.triggers));
              }
            } else {
              console.info('[智脑-语义召回] ⚠️ 远期事件均无向量，降级关键词');
              // 尚无 embedding 的事件用关键词兜底
              keywordRecall(olderAll.filter(e => e.triggers));
            }
          } else {
            // ═══ 关键词路径（embedding 未开启） ═══
            console.info('[智脑-召回] embedding 未开启，使用关键词匹配');
            keywordRecall(olderAll.filter(e => e.triggers));
          }

          // ── 关键词匹配（局部函数，语义/降级/关闭时复用）──
          function keywordRecall(olderWithTriggers: typeof olderAll) {
            if (olderWithTriggers.length === 0) return;

            type ScoredEvent = { event: string; detail: string; version: number; score: number;
              userHit: boolean;
              _dbg: { matchQ: number; recency: number; kwDens: number; charOvlp: number; importance: number } };
            const matched: ScoredEvent[] = [];

            for (const evt of olderWithTriggers) {
              const trigChars = evt.triggers!.characters;
              const trigKeywords = evt.triggers!.keywords;

              let anyUserHit = false;
              let weightedCharSum = 0;
              const hitChars: string[] = [];
              for (const c of trigChars) {
                const cLower = c.toLowerCase();
                const hitU = lastUserInputLower.includes(cLower);
                const hitA = scanTextLower.includes(cLower);
                if (hitU) anyUserHit = true;
                if (hitU || hitA) hitChars.push(c);
                if (hitU && hitA) weightedCharSum += 1.0;
                else if (hitU) weightedCharSum += 0.8;
                else if (hitA) weightedCharSum += 0.5;
              }
              const charHit = hitChars.length > 0;

              let weightedKwSum = 0;
              for (const k of trigKeywords) {
                const parenMatch = k.match(/^(.+?)\((.+?)\)$/);
                const variants = parenMatch ? [parenMatch[1], parenMatch[2]] : [k];
                const hitU = variants.some((v: string) => fuzzyMatchKeywordUser(v, lastUserInputLower));
                const hitA = variants.some((v: string) => fuzzyMatchKeyword(v, scanTextLower));
                if (hitU) anyUserHit = true;
                if (hitU && hitA) weightedKwSum += 1.0;
                else if (hitU) weightedKwSum += 1.0;
                else if (hitA) weightedKwSum += 0.6;
              }
              const kwCount = trigKeywords.filter(k => {
                const parenMatch = k.match(/^(.+?)\((.+?)\)$/);
                const variants = parenMatch ? [parenMatch[1], parenMatch[2]] : [k];
                return variants.some((v: string) => fuzzyMatchKeywordUser(v, lastUserInputLower) || fuzzyMatchKeyword(v, scanTextLower));
              }).length;

              const shouldInject = (charHit && kwCount >= 1) || (!charHit && kwCount >= 2);
              if (!shouldInject) continue;

              const evtText = ((evt.event || '') + ' ' + (evt.detail || '')).toLowerCase();

              const kwRatio = trigKeywords.length > 0 ? weightedKwSum / trigKeywords.length : 0;
              const charRatio = trigChars.length > 0 ? weightedCharSum / trigChars.length : 0;
              const matchQ = 0.7 * kwRatio + 0.3 * charRatio;

              const rawRecency = ((evt.summaryVersion || 0) - recentThreshold + 1);
              const recency = Math.max(0, Math.min(rawRecency / versionRange, 1));

              let kwDens = 0;
              if (trigKeywords.length > 0 && evtText.length > 50) {
                let totalHits = 0;
                for (const k of trigKeywords) {
                  const kw = k.toLowerCase();
                  let pos = evtText.indexOf(kw);
                  while (pos !== -1) { totalHits++; pos = evtText.indexOf(kw, pos + 1); }
                }
                kwDens = Math.min(totalHits / (evtText.length / 100), 5) / 5;
              }

              const charOvlp = trigChars.length > 0 ? hitChars.length / trigChars.length : 0;
              const importance = (evt.importance || 3) / 5;
              const score = 0.50 * matchQ + 0.10 * recency + 0.15 * kwDens + 0.15 * charOvlp + 0.10 * importance;

              matched.push({
                event: evt.event,
                detail: evt.detail || '',
                version: evt.summaryVersion || 0,
                score,
                userHit: anyUserHit,
                _dbg: { matchQ, recency, kwDens, charOvlp, importance },
              });
            }

            if (matched.length === 0) return;

            // 用户匹配优先
            const userMatched = matched.filter(e => e.userHit).sort((a, b) => b.score - a.score || b.version - a.version);
            const aiOnlyMatched = matched.filter(e => !e.userHit).sort((a, b) => b.score - a.score || b.version - a.version);
            const userCount = Math.min(userMatched.length, recallLimit);
            const aiCount = Math.min(aiOnlyMatched.length, recallLimit - userCount);
            const toInjectKw = [...userMatched.slice(0, userCount), ...aiOnlyMatched.slice(0, aiCount)];

            console.info(`[智脑-关键词] 候选${matched.length}条(用户命中${userMatched.length}), 注入${toInjectKw.length}条(用户优先${userCount}+AI${aiCount})`);
            const top3 = toInjectKw.slice(0, 3);
            for (const e of top3) {
              const dbg = e._dbg;
              console.info(`  🔑 (${e.score.toFixed(3)}) ${e.event.slice(0, 30)}… | MQ:${dbg.matchQ.toFixed(2)} R:${dbg.recency.toFixed(2)} KD:${dbg.kwDens.toFixed(2)} CO:${dbg.charOvlp.toFixed(2)} IM:${dbg.importance.toFixed(2)}`);
            }

            for (const s of toInjectKw) {
              toInject.push({ event: s.event, detail: s.detail });
            }
          }

          // 收集所有激活事件名（供大总结注入判断是否用详情）
          for (const t of toInject) activatedEventNames.add(t.event);
        }
      }
    }

    // --- 大总结注入（每次生成请求时动态获取最新总结内容） ---
    console.log(`[智脑-注入诊断] summaries总数=${store.summaries.length}, latestSummary=${latestSummary ? 'v'+latestSummary.version : 'null'}, rawText长度=${latestSummary?.rawText?.length || 0}, dynamicProfiles=${store.dynamicProfiles.length}, activatedEvents=${activatedEventNames.size}`);
    if (store.settings.summaryInjectionEnabled && latestSummary && latestSummary.rawText) {
      injectSummaryIntoCompletion(completion.messages, latestSummary, activatedEventNames, store);
    } else {
      console.warn('[智脑] ⚠️ 剧情摘要未注入: latestSummary=' + !!latestSummary + ', rawText=' + !!(latestSummary?.rawText));
    }

    // --- 摘要替代层：已废弃（小总结不再注入正文） ---

    // --- 用户人设注入 ---
    if (store.settings.personaEnabled && store.persona.analyzedProfile) {
      injectPersonaIntoCompletion(
        completion.messages,
        store.persona.analyzedProfile,
        store.persona.rawInput,
        store.getUserName(),
      );
    }

    // --- 动态人设注入（V2优先，旧版兜底） ---
    if (store.settings.dynamicProfileEnabled) {
      const latestCaptured = store.capturedContents[store.capturedContents.length - 1];
      const scanText = latestCaptured?.content || '';
      const allNamesDP = [...store.getAllCharacterNames(), ...store.getDreamtalkCharacterNames(), ...store.chatData.dynamicProfilesV2.map(p => p.characterName)];
      const uniqueNamesDP = Array.from(new Set(allNamesDP));

      if (store.chatData.dynamicProfilesV2.length > 0) {
        // V2 版本注入
        injectDynamicProfileV2(store.chatData.dynamicProfilesV2, scanText, uniqueNamesDP);
      } else if (store.dynamicProfiles.length > 0) {
        // 旧版兜底
        const dpEntries = (latestSummary?.characterMemories || []).map(m => ({
          name: m.characterName,
          aliases: m.aliases || [],
        }));
        injectDynamicProfiles(store.dynamicProfiles, scanText, uniqueNamesDP, dpEntries);
      }
    }

    // --- 事实信息强调注入 ---
    if (store.settings.factEmphasisEnabled) {
      const latestCapturedFact = store.capturedContents[store.capturedContents.length - 1];
      const factText = buildFactEmphasis({
        smallSummaries: store.chatData.smallSummaries,
        dynamicProfiles: store.chatData.dynamicProfilesV2,
        itemMemories: store.chatData.itemMemories,
        latestContent: latestCapturedFact?.content || '',
        allCharacterNames: [...store.getAllCharacterNames(), ...store.getDreamtalkCharacterNames()],
      });
      if (factText) {
        injectFactEmphasis(completion.messages, factText);
      }
    }

    // --- 物品语义召回注入 ---
    if (store.settings.itemRecallEnabled && store.settings.embeddingEnabled && store.settings.embeddingApiKey) {
      const latestCapturedItem = store.capturedContents[store.capturedContents.length - 1];
      if (latestCapturedItem && store.chatData.itemMemories.length > 0) {
        try {
          const scanText = latestCapturedItem.content || '';
          const userRecords = store.userInputRecords;
          const lastUserInput = userRecords.length > 0
            ? userRecords[userRecords.length - 1]?.userInput || ''
            : '';
          const queryText = (lastUserInput + '\n' + scanText).slice(0, 2000);
          const recalled = await recallItems(queryText, store.chatData.itemMemories, {
            enabled: store.settings.embeddingEnabled,
            apiUrl: store.settings.embeddingApiUrl,
            apiKey: store.settings.embeddingApiKey,
            model: store.settings.embeddingModel,
            dimensions: store.settings.embeddingDimensions,
            similarityThreshold: store.settings.embeddingSimilarityThreshold,
          }, 5);
          if (recalled.length > 0) {
            const lines = ['<item_recall>'];
            for (const { item, score } of recalled) {
              const aliases = item.aliases.length > 0 ? `（${item.aliases.join('/')})` : '';
              lines.push(
                `${item.itemName}${aliases}: ${item.description || item.currentState} |` +
                `持有:${item.currentOwner || '未知'} | 位于:${item.currentLocation || '未知'} | ` +
                `状态:${item.currentState || '正常'}`,
              );
            }
            lines.push('</item_recall>');
            const lastMsg = [...completion.messages].reverse().find((m: any) => m.role === 'user');
            if (lastMsg && typeof lastMsg.content === 'string') {
              lastMsg.content += '\n' + lines.join('\n');
              console.info(`[智脑-物品召回] 已注入 ${recalled.length} 件物品`);
            }
          }
        } catch (err) {
          console.warn('[智脑-物品召回] 注入跳过:', (err as Error).message);
        }
      }
    }

    // --- 剧情导演引导注入 ---
    if (store.settings.plotDirectorEnabled && store.chatData.plotOutline?.status === 'active') {
      injectPlotGuidance(store.chatData.plotOutline, store.chatData.lastPlotCheckResult);
    }

    // --- 世界推进注入 ---
    if (store.settings.worldProgressEnabled && store.chatData.worldProgressRecords.length > 0) {
      injectWorldProgress(store.chatData.worldProgressRecords);
    }

    // --- 关系档案注入（手动分析后的稳定关系设定） ---
    if (store.settings.relationshipInjectionEnabled && store.relationshipProfiles.length > 0) {
      const relCaptured = store.capturedContents[store.capturedContents.length - 1];
      const relScanText = relCaptured?.content || '';
      const relAllNames = store.getAllCharacterNames();
      const relEntries = (latestSummary?.characterMemories || []).map(m => ({
        name: m.characterName,
        aliases: m.aliases || [],
      }));
      const relChars = scanCharacterNamesFromContent(relScanText, relAllNames, relEntries);
      console.info(
        `[智脑-注入诊断] 关系档案: profiles=${store.relationshipProfiles.length}条, ` +
        `全角色=${relAllNames.join(',') || '(无)'}, 扫描到=${relChars.join(',') || '(无)'}, ` +
        `扫描文本长度=${relScanText.length}`,
      );
      if (relChars.length > 0) {
        injectRelationshipProfiles(store.relationshipProfiles, relChars, store.getUserName());
      } else {
        console.warn('[智脑-注入诊断] 关系档案: 未扫描到在场角色，跳过注入');
      }
    } else {
      console.info(
        `[智脑-注入诊断] 关系档案: 跳过 ` +
        `(enabled=${store.settings.relationshipInjectionEnabled}, profiles=${store.relationshipProfiles.length})`,
      );
    }

    // --- 梦呓注入 ---
    if (store.settings.dreamtalkEnabled && store.dreamtalk) {
      injectDreamtalkIntoUserMessage(completion.messages, store);
    }

    // --- NSFW隔离层注入 ---
    if (isNsfwActive()) {
      const latestCaptured2 = store.capturedContents[store.capturedContents.length - 1];
      const scanText2 = latestCaptured2?.content || '';
      const allNames2 = [...store.getAllCharacterNames(), ...store.getDreamtalkCharacterNames()];
      const currentChars = scanCharacterNamesFromContent(scanText2, Array.from(new Set(allNames2)));
      injectNsfwData(store.nsfwMemories, store.nsfwDreamtalk, store.nsfwDynamicProfiles, currentChars);
    }




    // --- 后台行动推演注入（已通过 injectEcosystem 持久注入，此处确保状态同步） ---
    if (store.settings.ecosystemEnabled && store.ecosystemState) {
      injectEcosystem(store.ecosystemState);
    }

    // 重置真实聊天消息标记
    store._isRealChatMessage = false;
  });

  // ========== 大总结注入到 messages（splice 方式，确保在导出的上下文中可见） ==========

  function injectSummaryIntoCompletion(
    messages: SillyTavern.SendingMessage[],
    summary: GrandSummary,
    activatedEventNames: Set<string>,
    store: ReturnType<typeof useMainStore>,
  ): void {
    const injectionText = buildSummaryInjectionText(summary, store as any, activatedEventNames);
    if (!injectionText) {
      console.warn('[智脑] ⚠️ buildSummaryInjectionText 返回空, rawText前300字:', summary.rawText?.substring(0, 300));
      console.warn('[智脑] ⚠️ sections[0]前300字:', (summary.rawText || '').split(/---SECTION---/i)[0]?.substring(0, 300));
      return;
    }

    console.log(`[智脑-注入诊断] summary注入文本长度=${injectionText.length}, 前150字: ${injectionText.substring(0, 150)}`);
    console.log(`[智脑-注入诊断] messages总数=${messages.length}, 寻找注入位置...`);

    let injected = false;

    // 策略：找到包含 <chathistory> 的消息，直接在它的 content 里把摘要塞在 <chathistory> 之前
    // 这样摘要才真正紧贴 <chathistory>，而不是隔着一整条世界书消息
    for (let i = 0; i < messages.length; i++) {
      const content = messages[i].content;
      if (typeof content !== 'string') continue;
      if (content.includes('<chathistory>')) {
        messages[i].content = content.replace('<chathistory>', injectionText + '\n<chathistory>');
        injected = true;
        console.log(`[智脑-注入诊断] 紧贴 <chathistory> 前注入成功 (消息index=${i})`);
        break;
      }
    }

    // 备选：如果没找到 <chathistory>，找 </chathistory> 在其后紧贴注入
    if (!injected) {
      for (let i = 0; i < messages.length; i++) {
        const content = messages[i].content;
        if (typeof content !== 'string') continue;
        if (content.includes('</chathistory>')) {
          messages[i].content = content.replace('</chathistory>', '</chathistory>\n' + injectionText);
          injected = true;
          console.log(`[智脑-注入诊断] 紧贴 </chathistory> 后注入成功 (消息index=${i})`);
          break;
        }
      }
    }

    // 兜底：splice 新消息
    if (!injected) {
      const idx = Math.max(0, messages.length - 2);
      messages.splice(idx, 0, { role: 'system', content: injectionText });
      injected = true;
      console.log(`[智脑-注入诊断] 兜底注入 (index=${idx}, 总计${messages.length}条消息)`);
    }

    console.info(`[智脑] ✅ 剧情摘要已注入 (injected=${injected}, textLength=${injectionText.length})`);
  }

  // ========== 大总结注入文本构建 ==========

  function buildSummaryInjectionText(summary: GrandSummary, store: any, activatedEvents: Set<string>): string {
    try {
      if (!summary.rawText) { console.warn('[智脑-注入诊断] rawText为空'); return ''; }

      const recentCount = store.settings?.eventRecallRecent || 2;
      const recentThreshold = summary.version - recentCount + 1;

      const parts: string[] = [];
      parts.push(`<grand_summary version="${summary.version}" generated_at="${summary.generatedAt}">`);

      if (summary.timeline && summary.timeline.length > 0) {
        // 提取日期部分辅助函数（"2025年2月5日晨" → date="2025年2月5日", period="晨"）
        const parseTime = (t: string) => {
          const m = t?.match(/^(\d+年\d+月\d+日)(.*)$/);
          return m ? { date: m[1], period: m[2] } : null;
        };
        const periodOrder: Record<string, number> = {
          '晨': 0, '上午': 1, '午': 2, '下午': 3, '暮': 4, '夜': 5, '深夜': 6,
        };

        // 按日期→时段两级分组，保持首次出现顺序
        const dateGroups: Array<{ date: string; periods: Map<string, Array<{ eventNum: number; text: string }>> }> = [];
        const dateMap = new Map<string, number>();
        const noTimeEvents: Array<{ eventNum: number; time: string; text: string }> = [];

        let eventNum = 0;
        let detailCount = 0;

        for (const e of summary.timeline) {
          eventNum++;
          const isRecent = (e.summaryVersion || 0) >= recentThreshold;
          const isActivated = activatedEvents?.has(e.event) ?? false;
          const useDetail = (isRecent || isActivated) && !!e.detail;
          if (useDetail) detailCount++;
          const text = useDetail ? e.detail! : (e.event || '[空事件]');

          const parsed = parseTime(e.time || '');
          if (!parsed?.date) {
            noTimeEvents.push({ eventNum, time: e.time || '?', text });
            continue;
          }

          let idx = dateMap.get(parsed.date);
          if (idx === undefined) {
            idx = dateGroups.length;
            dateMap.set(parsed.date, idx);
            dateGroups.push({ date: parsed.date, periods: new Map() });
          }
          const pm = dateGroups[idx].periods;
          if (!pm.has(parsed.period)) pm.set(parsed.period, []);
          pm.get(parsed.period)!.push({ eventNum, text });
        }

        parts.push('## 事件');

        for (const dg of dateGroups) {
          parts.push(`${dg.date}：`);
          const sortedPeriods = [...dg.periods.keys()].sort(
            (a, b) => (periodOrder[a] ?? 99) - (periodOrder[b] ?? 99),
          );
          for (const period of sortedPeriods) {
            const periodEvents = dg.periods.get(period)!;
            for (let i = 0; i < periodEvents.length; i++) {
              const evt = periodEvents[i];
              if (i === 0) {
                parts.push(`  [${period}] ${evt.text}`);
              } else {
                parts.push(`       ${evt.text}`);
              }
            }
          }
        }

        for (const evt of noTimeEvents) {
          parts.push(`[${evt.time}] ${evt.text}`);
        }

        parts.push('');
        console.log(`[智脑-注入诊断] 注入文本: ${summary.timeline.length}事件(其中${detailCount}条用详情, ${activatedEvents?.size || 0}条激活), 共${parts.join('\n').length}字`);
      } else {
        const sections = summary.rawText.split(/---SECTION---/i);
        const raw = sections[0] || '';
        if (!raw.trim()) { console.warn('[智脑-注入诊断] sections[0]为空'); return ''; }
        parts.push(raw.trim());
      }

      parts.push('</grand_summary>');
      const text = parts.join('\n');
      if (!text.trim()) { console.warn('[智脑-注入诊断] 注入文本完全为空'); return ''; }
      return text;
    } catch (err) {
      console.error('[智脑-注入诊断] buildSummaryInjectionText 异常:', err);
      return '';
    }
  }

  // ========== 梦呓注入函数 ==========

  function injectDreamtalkIntoUserMessage(
    messages: SillyTavern.SendingMessage[],
    store: ReturnType<typeof useMainStore>,
  ) {
    // 仅对非后台的 completion 注入（首次发送/重roll/swipe 均会在 handler 中标记）
    if (!store._isRealChatMessage) return;

    const dreamtalkData = store.dreamtalk;
    if (!dreamtalkData) return;

    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx === -1) return;

    const lastUserMsg = messages[lastUserIdx];
    if (typeof lastUserMsg.content !== 'string') return;

    let latestContent = '';
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant' && typeof messages[i].content === 'string') {
        latestContent = messages[i].content as string;
        break;
      }
    }

    // 和神经链记忆激活用同一套判定：从 characterMemories 拿别名，扫名一致
    const latestMemory = store.getLatestSummary()?.characterMemories || [];
    const characterEntries = latestMemory.map(m => ({
      name: m.characterName,
      aliases: m.aliases || [],
    }));
    const allNames = store.getAllCharacterNames();
    const currentCharacters = scanCharacterNamesFromContent(
      latestContent + lastUserMsg.content,
      allNames,
      characterEntries,
    );

    const dreamtalkText = buildDreamtalkInjection(dreamtalkData, currentCharacters);
    // 插入到 "CangxuanBrain: 我即将开始创作" 正上方
    // 模板结构: ...</UpdateVariable> \n <dreamtalk> \n CangxuanBrain: 我即将开始创作...
    const sceneStartMarker = 'CangxuanBrain: 我即将开始创作';
    const sceneStartIdx = lastUserMsg.content.lastIndexOf(sceneStartMarker);
    if (sceneStartIdx !== -1) {
      lastUserMsg.content =
        lastUserMsg.content.slice(0, sceneStartIdx) +
        dreamtalkText + '\n\n' +
        lastUserMsg.content.slice(sceneStartIdx);
    } else {
      // 没找到，回退到 "从此处开始" 之前
      const altMarker = '从此处开始';
      const altIdx = lastUserMsg.content.lastIndexOf(altMarker);
      if (altIdx !== -1) {
        lastUserMsg.content =
          lastUserMsg.content.slice(0, altIdx) +
          dreamtalkText + '\n\n' +
          lastUserMsg.content.slice(altIdx);
      } else {
        // 回退到 <interactive_input> 之前
        const interactiveIdx = lastUserMsg.content.lastIndexOf('<interactive_input>');
        if (interactiveIdx !== -1) {
          lastUserMsg.content =
            lastUserMsg.content.slice(0, interactiveIdx) +
            dreamtalkText + '\n\n' +
            lastUserMsg.content.slice(interactiveIdx);
        } else {
          // 都没找到，回退到破限标记之后
          const resetMarker = '[RESET ALL OF THE ABOVE TO NULL]';
          const resetIdx = lastUserMsg.content.indexOf(resetMarker);
          if (resetIdx !== -1) {
            const afterReset = resetIdx + resetMarker.length;
            lastUserMsg.content =
              lastUserMsg.content.slice(0, afterReset) + '\n\n' + dreamtalkText +
              lastUserMsg.content.slice(afterReset);
          } else {
            // 兜底 prepend
            lastUserMsg.content = dreamtalkText + '\n\n' + lastUserMsg.content;
          }
        }
      }
    }
    console.info(`[智脑] 梦呓已注入用户消息 (${currentCharacters.length} 角色匹配)`);
  }

  // ========== 梦呓分析触发 ==========

  async function triggerDreamtalkAnalysis(store: ReturnType<typeof useMainStore>): Promise<void> {
    store.setDreamtalkInProgress(true);
    const style = (store.settings as any).preferredPlayStyle || undefined;
    try {
      console.info(`[智脑] 正在分析用户行为模式（梦呓）... (${style || '自动判定'})`);
      const { dreamtalk, nsfwDreamtalk } = await executeDreamtalkAnalysis(store.userInputRecords, store.persona.rawInput, store.dreamtalk ?? undefined, style, store.getUserName());
      store.updateDreamtalk(dreamtalk);
      if (nsfwDreamtalk) {
        store.updateNsfwDreamtalk(nsfwDreamtalk);
        console.info('[智脑] NSFW梦呓数据已更新');
      }
      store.forcePersist(); // 兜底（updateDynamicProfile 循环内有 N 次写入）
      console.info(`[智脑] 梦呓分析完成 (${dreamtalk.characterInteractions.length} 角色交互模式)`);
    } catch (error: any) {
      console.error('[智脑] 梦呓分析失败:', error);
      const msg = error?.message || String(error);
      try { window.toastr?.error(msg, '❌ 梦呓分析失败', { timeOut: 8000, extendedTimeOut: 3000 }); } catch(_) {
        // Toastr is optional in some script contexts.
      }
    } finally {
      store.setDreamtalkInProgress(false);
    }
  }

  async function ensureRecentFloorsVisible() {
    return ensureRecentFloorsVisibleCore('affected');
  }

  // ========== 大总结触发（通过调度器入队） ==========

  async function checkAndTriggerSummary(store: ReturnType<typeof useMainStore>) {
    if (store.summaryInProgress) return;

    if (!shouldTriggerSummary(store.capturedContents, store.lastSummaryAtMessageId, store.settings.summaryInterval, store.settings.preserveRecentFloors)) {
      return;
    }

    // 通过调度器入队，确保大总结链（大总结→梦呓→倒果为因）串行执行
    enqueueAnalysis('summary_chain', async () => {
      await executeSummaryChain(store);
    });
  }

  async function executeSummaryChain(store: ReturnType<typeof useMainStore>) {
    store.setSummaryInProgress(true);
    console.info('[智脑] 触发大总结');

    // 获取待总结内容（排除最新 N 条不总结的 AI 回复）
    const pendingContents = getContentsSinceLast(store.capturedContents, store.lastSummaryAtMessageId, store.settings.preserveRecentFloors);
    if (pendingContents.length === 0) {
      console.info('[智脑] 排除最新楼层后无可总结内容，跳过');
      store.setSummaryInProgress(false);
      return;
    }

    try {
      // 大总结引导弹窗：用户可填写总结方向
      let userGuidance = '';
      if (store.requestSummaryGuidance) {
        const guidance = await store.requestSummaryGuidance(pendingContents.length);
        if (guidance === null) {
          // 用户点击取消，跳过本次总结
          console.info('[智脑] 用户取消大总结');
          store.setSummaryInProgress(false);
          return;
        }
        userGuidance = guidance;
      }

      const previousSummary = store.getLatestSummary();

      // === V2 大总结：步骤1 — 白描事实时间线 ===
      const v2Result = await executeGrandSummaryV2(
        store.chatData.smallSummaries || [],
        pendingContents,
        previousSummary?.rawText,
        store.getUserName(),
      );

      // === V2 大总结：步骤2 — 角色记忆+NSFW（调色盘分析） ===
      const existingMemories = previousSummary?.characterMemories || [];
      const memResult = await executeCharacterMemoryUpdate(
        pendingContents,
        existingMemories,
        store.settings.memoryMinPerChar,
        store.settings.memoryMaxPerChar,
        store.getUserName(),
      );

      // === 组装 GrandSummary（统一存储格式） ===
      const summarizedMessageIds = getCapturedContentMessageIds(pendingContents);
      const summarizedUpTo = summarizedMessageIds[summarizedMessageIds.length - 1] ?? store.lastSummaryAtMessageId;
      const summaryVersion = (previousSummary?.version || 0) + 1;

      // V2 事件 → TimelineEvent[]（summary=速览用于召回，detail=完整经过用于注入）
      const timeline: TimelineEvent[] = v2Result.events.map(e => ({
        time: e.time,
        event: e.summary || e.event.slice(0, 50),
        detail: e.event,
        importance: e.importance,
        triggers: {
          characters: e.presentCharacters,
          keywords: e.keywords,
        },
      }));

      // 事件编号续接上次大总结
      const offset = previousSummary
        ? (() => { let max = 0; const s1 = previousSummary.rawText.split(/---SECTION---/i)[0] || ''; for (const m of s1.matchAll(/\[#(\d+)\]/g)) max = Math.max(max, parseInt(m[1], 10)); return max; })()
        : 0;
      let eventNum = offset;
      const s1Lines: string[] = [];
      for (const e of timeline) {
        eventNum++;
        s1Lines.push(`[#${eventNum}] [${e.time}] ${e.event}`);
        s1Lines.push(`重要性: ${e.importance || 3}`);
        if (e.detail) s1Lines.push(e.detail);
        if (e.triggers?.characters?.length) s1Lines.push(`[角色: ${e.triggers.characters.join(', ')}]`);
        if (e.triggers?.keywords?.length) s1Lines.push(`[关键词: ${e.triggers.keywords.join(', ')}]`);
        s1Lines.push('');
      }

      // Section 2: 角色记忆
      const section2 = buildMemorySectionText(memResult.characterMemories);

      // Section 3: NSFW
      let section3 = '[NSFW记录]\n无NSFW内容';
      if (memResult.nsfwMemories.length > 0) {
        const nsfwParts: string[] = [];
        for (const n of memResult.nsfwMemories) {
          nsfwParts.push(`### ${n.characterName}`);
          nsfwParts.push(`敏感点: ${n.sensitivePoints.join(', ')}`);
          nsfwParts.push(`偏好: ${n.preferences.join(', ')}`);
          nsfwParts.push(`行为模式: ${n.behaviors.join(', ')}`);
          nsfwParts.push('记忆:');
          for (const m of n.memories) nsfwParts.push(`- ${m}`);
        }
        section3 = nsfwParts.join('\n');
      }

      const rawText = [
        s1Lines.join('\n').trim() || '[剧情摘要]',
        '---SECTION---',
        section2.trim() || '[角色记忆]',
        '---SECTION---',
        section3,
      ].join('\n');

      const summary: GrandSummary = {
        version: summaryVersion,
        generatedAt: new Date().toISOString(),
        characterMemories: memResult.characterMemories,
        timeline,
        characterTable: memResult.characterMemories.map(m => ({
          name: m.characterName,
          aliases: m.keywords.slice(0, 3),
          identity: '',
          relationship: m.attitude === 'like' ? '好感' : m.attitude === 'dislike' ? '厌恶' : '中立',
          status: '活跃',
        })),
        rawText,
      };

      const nsfwMemories = memResult.nsfwMemories;

      // Toastr 弹窗警告：AI 输出的角色记忆为空
      const totalNewMemories = summary.characterMemories.reduce(
        (s, m) => s + (m.coreMemories?.length || 0) + (m.recentMemories?.length || 0),
        0,
      );
      if (totalNewMemories === 0) {
        console.warn('[智脑] ⚠️ AI 输出的角色记忆为空！可能是格式异常，建议重新总结');
        try {
          window.toastr?.warning(
            'AI 输出的角色记忆为空！可能是格式异常，建议重新总结',
            '苍玄界智脑',
            { timeOut: 8000, extendedTimeOut: 3000 },
          );
        } catch(e) {
          // Toastr is optional in some script contexts.
        }
      }

      store.addSummary(summary, summarizedUpTo, summarizedMessageIds);
      // 增量模式：rawText Section 2 的合并由 assembledSummary 在读取时自动完成

      // ★ 物品归档：从大总结V2事件中提取物品到物品记忆库
      const archivedItems = archiveItemsFromEvents(
        v2Result.events,
        store.chatData.itemMemories || [],
        summaryVersion,
      );
      store.chatData.itemMemories = archivedItems;
      if (archivedItems.length > 0) {
        console.info(`[智脑-物品] 物品库已更新: ${archivedItems.length} 件`);
      }

      // 物品向量：大总结后批量生成物品 embedding（后台任务，不阻塞主流程）
      if (store.settings.embeddingEnabled && store.settings.embeddingApiKey && store.chatData.itemMemories.length > 0) {
        const activeCount = store.chatData.itemMemories.filter(i => i.status === 'active' && (!i.embedding || i.embedding.length === 0)).length;
        if (activeCount > 0) {
          console.info(`[智脑-物品召回] 📥 入队: ${activeCount} 件物品待嵌入`);
          enqueueAnalysis('embedding', async () => {
            await embedItems(store.chatData.itemMemories, {
              enabled: store.settings.embeddingEnabled,
              apiUrl: store.settings.embeddingApiUrl,
              apiKey: store.settings.embeddingApiKey,
              model: store.settings.embeddingModel,
              dimensions: store.settings.embeddingDimensions,
              similarityThreshold: store.settings.embeddingSimilarityThreshold,
            });
            store.forcePersist();
          });
        }
      }

      // 语义向量：大总结后批量生成事件 embedding（后台任务，不阻塞主流程）
      if (store.settings.embeddingEnabled && store.settings.embeddingApiKey && summary.timeline.length > 0) {
        console.info(`[智脑-Embedding] 📥 入队: v${summary.version} 时间线 ${summary.timeline.length} 个事件`);
        enqueueAnalysis('embedding', async () => {
          await embedTimelineEvents(
            summary.timeline,
            store.settings.embeddingApiUrl,
            store.settings.embeddingApiKey,
            store.settings.embeddingModel,
            store.settings.embeddingDimensions,
          );
          store.forcePersist();
        });
      }

      // 核心记忆向量：大总结后批量生成（后台任务，不阻塞主流程）
      if (store.settings.embeddingEnabled && store.settings.embeddingApiKey && summary.characterMemories.length > 0) {
        const totalCores = summary.characterMemories.reduce((s, m) => s + (m.coreMemories?.length || 0), 0);
        if (totalCores > 0) {
          console.info(`[智脑-Embedding] 📥 入队: v${summary.version} 角色记忆 ${summary.characterMemories.length}角色 ${totalCores}条核心`);
          enqueueAnalysis('embedding_mem', async () => {
            await embedCharacterMemories(
              summary.characterMemories,
              store.settings.embeddingApiUrl,
              store.settings.embeddingApiKey,
              store.settings.embeddingModel,
              store.settings.embeddingDimensions,
            );
            store.forcePersist();
          });
        }
      }

      // 存储NSFW记忆
      if (nsfwMemories.length > 0) {
        store.updateNsfwMemories(nsfwMemories);
        store.forcePersist(); // 立即落盘，避免刷新丢失
        console.info(`[智脑] NSFW记忆已更新 (${nsfwMemories.length} 角色)`);
      }

      console.info(`[智脑] 大总结 v${summary.version} 完成 (${summary.characterMemories.length} 角色)`);

      // ★ 总结完成，立刻标记结束，避免后续后台任务阻塞 UI 进度显示
      store.setSummaryInProgress(false);

      const hiddenIds = await hideSummaryFloors(summarizedUpTo, 0, 'affected');
      if (hiddenIds.length > 0) {
        console.info(`[智脑] ✅ 已隐藏 ${hiddenIds.length} 个已总结楼层`);
        // ★ 立刻同步小总结状态（隐藏的 → hidden-active），不等下次发消息
        syncSmallSummaryStatus(store.chatData.smallSummaries, new Set(hiddenIds));
      } else {
        console.info(`[智脑] ⚠️ 未隐藏任何楼层 (summarizedUpTo=${summarizedUpTo})`);
      }

      // 大总结完成后触发梦呓（拆为独立调度任务，不再阻塞 summary_chain）
      enqueueAnalysis('dreamtalk_chain', async () => {
        await triggerDreamtalkAnalysis(store);
      });
    } catch (error: any) {
      console.error('[智脑] 大总结失败:', error);
      // ★ 大总结失败 → 清空调度队列，后续任务无意义
      clearSchedulerQueue();
      console.info('[智脑-调度] 已清空队列（大总结失败）');
      // 创建空总结占位，方便用户点重新总结
      const version = (store.getLatestSummary()?.version ?? 0) + 1;
      const summarizedMessageIds = getCapturedContentMessageIds(pendingContents);
      const failedSummary: GrandSummary = {
        version,
        generatedAt: new Date().toISOString(),
        upToMessageId: summarizedMessageIds[summarizedMessageIds.length - 1],
        coveredMessageIds: summarizedMessageIds,
        characterMemories: [],
        timeline: [],
        characterTable: [],
        rawText: '总结失败，请重新总结',
      };
      store.addSummary(failedSummary, failedSummary.upToMessageId, summarizedMessageIds);
      const msg = error?.message || String(error);
      try { window.toastr?.error(msg, '❌ 大总结失败：请重新总结', { timeOut: 8000, extendedTimeOut: 3000 }); } catch(_) {
        // Toastr is optional in some script contexts.
      }
    } finally {
      store.setSummaryInProgress(false);
      // 执行期间新楼层可能已累积到够触发下一轮，延迟检查
      setTimeout(() => {
        checkAndTriggerSummary(store);
      }, 0);
    }
  }



  // ========== 世界推进触发 ==========

  async function triggerWorldProgress(store: ReturnType<typeof useMainStore>, currentFloor: number): Promise<void> {
    try {
      const latestSummary = store.getLatestSummary();
      if (!latestSummary) { console.log('[智脑-世界推进] 无摘要，跳过'); return; }

      const recentAiReplies: string[] = [];
      const allCaptured = store.capturedContents;
      for (let i = allCaptured.length - 1; i >= 0 && recentAiReplies.length < 2; i--) {
        recentAiReplies.unshift(allCaptured[i].content);
      }

      // 世界推进选中的世界书条目
      const wpSelectedKeys = new Set(store.chatData.worldProgressWorldBookKeys || []);
      const wpWorldBook = (store.chatData.worldBookEntries || []).filter(e => wpSelectedKeys.has(e.key));

      const record = await executeWorldProgress(
        latestSummary,
        store.dynamicProfiles,
        store.chatData.smallSummaries,
        recentAiReplies,
        currentFloor,
        store.getUserName(),
        undefined,
        store.chatData.plotOutline,
        wpWorldBook,
      );

      store.chatData.worldProgressRecords.push(record);
      store.chatData.lastWorldProgressFloor = currentFloor;
      store.forcePersist();

      // 注入最新世界推进
      injectWorldProgress(store.chatData.worldProgressRecords);
      console.info(`[智脑-世界推进] 完成: ${record.advancedCharacters.length} 角色`);
    } catch (error) {
      console.error('[智脑-世界推进] 失败:', error);
    }
  }

  // ========== 剧情校对触发 ==========

  async function triggerPlotCheck(store: ReturnType<typeof useMainStore>, currentFloor: number): Promise<void> {
    try {
      const outline = store.chatData.plotOutline;
      if (!outline || outline.status !== 'active') return;

      // 收集最近正文
      const recentContent = store.capturedContents
        .slice(-3)
        .map(c => c.content)
        .join('\n---\n');

      const result = await executePlotCheck(outline, recentContent, store.getUserName());
      store.chatData.lastPlotCheckFloor = currentFloor;
      store.chatData.lastPlotCheckResult = result;

      // 如果需要推进阶段
      if (result.shouldAdvanceStage) {
        store.chatData.plotOutline = advanceOutlineStage(outline);
        console.info(`[智脑-剧情导演] 阶段推进: ${outline.currentStageIndex} → ${outline.currentStageIndex + 1}`);
      }

      store.forcePersist();

      // 更新注入
      injectPlotGuidance(store.chatData.plotOutline, result);
      console.info(`[智脑-剧情导演] 校对完成: progress=${result.stageProgress}, deviating=${result.isDeviating}`);
    } catch (error) {
      console.error('[智脑-剧情导演] 校对失败:', error);
    }
  }

  // ========== 后台行动推演触发 ==========

  async function triggerEcosystemAnalysis(store: ReturnType<typeof useMainStore>): Promise<void> {
    try {
      const latestSummary = store.getLatestSummary();
      if (!latestSummary) { console.log('[智脑-生态] 无摘要，跳过后台推演'); return; }

      // 在场/不在场由 AI 根据最近回复自行判断，不做代码扫描
      const userName = store.getUserName();

      // 提取最近 1 条 AI 回复作为推演上下文
      const recentAiReplies: string[] = [];
      const allCaptured = store.capturedContents;
      for (let i = allCaptured.length - 1; i >= 0 && recentAiReplies.length < 1; i--) {
        recentAiReplies.unshift(allCaptured[i].content);
      }

      // 手动指定角色（逗号分隔，最多5个，跟随聊天保存，排除主角）
      const rawManualChars = store.ecosystemManualChars || '';
      const manualChars = rawManualChars
        ? rawManualChars.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5)
            .filter(c => c !== userName && c !== '{{user}}')
        : [];
      // 用当前已知角色名重新扫描世界书（确保手动指定/新动态人设能被匹配到）
      refreshWorldBookCache(store);
      console.info(`[智脑-生态] 手动角色原始值="${rawManualChars}" → 解析后=[${manualChars.join(', ')}] (AI自行判断在场)`);
      console.info(`[智脑-生态] 世界书状态: names=${worldBookNames.size}个 contents=${worldBookContents.size}条 | ${[...worldBookNames].join(', ') || '(空)'}`);

      const ecoStart = Date.now();
      const modeLabel = manualChars.length > 0 ? `手动:${manualChars.join('、')}` : '自动';
      console.info(`[智脑-生态] ▶ 第${(store.ecosystemState?.analysisCount ?? 0) + 1}次推演开始 | ${modeLabel}`);

      const newState = await executeEcosystemAnalysis(
        latestSummary,
        store.dynamicProfiles,
        store.ecosystemState,
        worldBookNames,
        worldBookContents,
        manualChars,
        recentAiReplies,
        userName,
      );
      store.updateEcosystemState(newState);

      // 更新注入
      injectEcosystem(newState);

      console.info(`[智脑-生态] ✅ 完成 | ${newState.actors.length}角色 ${newState.backgroundEvents.length}事件 | 耗时${Date.now() - ecoStart}ms`);
      if (newState.rawOutput) {
        console.info(`[智脑-生态] 📥 发送给AI的输入:\n${newState.rawInput}`);
        console.info(`[智脑-生态] 📝 AI原始输出:\n${newState.rawOutput}`);
      }
    } catch (error) {
      console.error('[智脑-生态] ❌ 推演失败:', error);
    }
  }

  // ========== 聊天切换时重载 ==========

  reloadOnChatChange();

  // 聊天切换时清空调度队列
  eventOn(tavern_events.CHAT_CHANGED, () => {
    clearSchedulerQueue();
  });

  // ========== 卸载清理 ==========

  $(window).on('pagehide', () => {
    clearSchedulerQueue();
    app.unmount();
    $app.remove();
    destroy();
  });

  console.info('[智脑] 苍玄界智脑脚本已加载');
});
