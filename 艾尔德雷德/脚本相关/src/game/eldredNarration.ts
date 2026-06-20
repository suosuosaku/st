import { Character, CombatUnit, PlayerState } from '../types';
import { ELDRED_CHAT_BEAUTIFY_RULES, ELDRED_COMBAT_INTERNAL_CHECKLIST, ELDRED_WORLD_ENGINE_PATCH } from './aiIntegration';
import { buildEldredFrontendEventPayload, EldredFrontendEventInput } from './eldredEvents';
import {
  ATTRIBUTE_LABELS,
  getClassById,
  getEquipmentById,
  getRaceById,
  getSkillById,
  getTalentById,
} from './rules';
import {
  EldredNarrationEntry,
  EldredNarrationKind,
  EldredRuntimeMessage,
  EldredRuntimeSave,
  persistEldredRuntimeCache,
} from './eldredSave';
import { formatEldredLocation } from './locationFormat';

type AnyRecord = Record<string, any>;
type StoryPrompt = { role: 'system' | 'assistant' | 'user'; content: string };

const nowIso = () => new Date().toISOString();

const createId = (prefix: string) => {
  const randomId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${randomId}`;
};

const quote = (value: unknown) => String(value ?? '').replaceAll('"', "'");

const safeScope = (scopeFactory: () => unknown): AnyRecord | null => {
  try {
    const scope = scopeFactory();
    return scope && typeof scope === 'object' ? scope as AnyRecord : null;
  } catch {
    return null;
  }
};

const getHostScopes = (): AnyRecord[] => {
  const scopes = [
    safeScope(() => globalThis),
    safeScope(() => window),
    safeScope(() => window.parent),
    safeScope(() => window.top),
    safeScope(() => window.opener),
  ].filter((scope): scope is AnyRecord => Boolean(scope));
  return Array.from(new Set(scopes));
};

const getHostFunction = <T extends (...args: any[]) => any>(name: string): T | null => {
  for (const scope of getHostScopes()) {
    try {
      if (typeof scope[name] === 'function') return scope[name] as T;
      const eldredBridge = scope.__eldredWelcomeBridge;
      if (eldredBridge && typeof eldredBridge[name] === 'function') return eldredBridge[name] as T;
    } catch {
      // Cross-origin frames can throw.
    }
  }
  return null;
};

const requestGenerateThroughLoader = (config: AnyRecord) => {
  const requestId = createId('eldred-bridge');
  const parentWindow = safeScope(() => window.parent) as (Window & AnyRecord) | null;
  if (!parentWindow || parentWindow === window) {
    return Promise.reject(Error('未检测到艾尔德雷德脚本桥接。请在 SillyTavern 脚本控制台内运行。'));
  }

  return new Promise<string>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', handleMessage);
      reject(Error('艾尔德雷德脚本生成超时。'));
    }, 600000);

    function handleMessage(event: MessageEvent) {
      const data = event.data || {};
      if (data.source !== 'EldredWelcomeLoader' || data.type !== 'generate-result' || data.requestId !== requestId) return;
      window.clearTimeout(timeout);
      window.removeEventListener('message', handleMessage);
      if (data.ok) resolve(String(data.text || ''));
      else reject(Error(String(data.error || '艾尔德雷德脚本生成失败。')));
    }

    window.addEventListener('message', handleMessage);
    parentWindow.postMessage({
      source: 'EldredWelcome',
      type: 'generate',
      requestId,
      config,
    }, '*');
  });
};

export const hasEldredGenerationBridge = () =>
  Boolean(getHostFunction('generate')) || Boolean(safeScope(() => window.parent) && window.parent !== window);

export const extractEldredContentBlock = (rawText: string) => {
  const source = String(rawText || '');
  const matches = Array.from(source.matchAll(/<content\b[^>]*>([\s\S]*?)<\/content>/gi))
    .map(match => (match[1] || '').trim())
    .filter(Boolean);
  const content = matches.length ? matches.join('\n\n') : source;
  return content
    .replace(/<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<time\b[^>]*>[\s\S]*?<\/time>/gi, '')
    .replace(/\s*\[TIME:[^\]]+\]\s*$/i, '')
    .trim();
};

const formatPlayerFacts = (player: PlayerState | null) => {
  if (!player) return '主角：未登记';
  const cls = getClassById(player.classId);
  const race = getRaceById(player.raceId);
  const stats = (['str', 'dex', 'vit', 'int', 'spr'] as const)
    .map(key => `${ATTRIBUTE_LABELS[key]}${player.stats[key]}`)
    .join(' / ');
  const skills = player.activeSkillIds.map(id => getSkillById(id)?.name || id).join('、') || '无';
  const talents = player.talentIds.map(id => getTalentById(id)?.name || id).join('、') || '无';
  const equipment = Object.values(player.equipmentLoadout)
    .filter(Boolean)
    .map(id => getEquipmentById(id!)?.name || id)
    .join('、') || '无';
  const location = formatEldredLocation(undefined, player.location);
  return [
    `主角：${player.name}`,
    `身份：${player.identity.gender || '未记录'} / ${player.identity.age || '未记录'} / ${player.identity.background || '未记录'}`,
    `种族：${race.name} / ${race.auraName} / ${race.auraEffect}`,
    `职业：${cls.name} / ${cls.classAuraName} / ${cls.classAuraEffect}`,
    `等级：${player.level}，经验：${player.experience}/${player.nextLevelExperience}，可分配点数：${player.availableAttributePoints}`,
    `生命：${player.stats.hp}/${player.stats.maxHp}，法力：${player.stats.mp}/${player.stats.maxMp}，护甲：${player.stats.ac}，熟练：+${player.stats.proficiency || 0}`,
    `五维：${stats}`,
    `伴生天赋：${talents}`,
    `激活技能：${skills}`,
    `装备：${equipment}`,
    `当前位置：${location.fullName} / ${player.location.summary}`,
  ].join('\n');
};

const formatPartyFacts = (party: Character[] = []) => {
  if (!party.length) return '队伍：无同行角色';
  return [
    '队伍：',
    ...party.map(member => {
      const skills = member.activeSkillIds.map(id => getSkillById(id)?.name || id).join('、') || '无';
      return `- ${member.name} / Lv.${member.stats.level || 1} / ${member.profession} / HP ${member.stats.hp}/${member.stats.maxHp} / MP ${member.stats.mp}/${member.stats.maxMp} / 技能 ${skills}`;
    }),
  ].join('\n');
};

const formatEnemyFacts = (enemies: CombatUnit[] = []) => {
  const hostile = enemies.filter(enemy => enemy.isEnemy);
  if (!hostile.length) return '敌方：无登记敌方单位';
  return [
    '敌方：',
    ...hostile.map(enemy => {
      const skills = enemy.skillIds.map(id => getSkillById(id)?.name || id).join('、') || '无';
      return `- ${enemy.name} / Lv.${enemy.level} / HP ${enemy.hp}/${enemy.maxHp} / MP ${enemy.mp}/${enemy.maxMp} / 护甲 ${enemy.ac} / 技能 ${skills} / 状态 ${enemy.statusLogs.join('、') || '无'}`;
    }),
  ].join('\n');
};

export const buildEldredOpeningFacts = (player: PlayerState) => {
  const cls = getClassById(player.classId);
  const race = getRaceById(player.raceId);
  const stats = (['str', 'dex', 'vit', 'int', 'spr'] as const)
    .map(key => `${ATTRIBUTE_LABELS[key]}${player.stats[key]}`)
    .join(' / ');
  const skillNames = player.activeSkillIds.map(id => getSkillById(id)?.name).filter(Boolean).join('、') || '无';
  const talentNames = player.talentIds.map(id => getTalentById(id)?.name).filter(Boolean).join('、') || '无';
  const equipment = player.equipmentIds.map(id => getEquipmentById(id)?.name).filter(Boolean).join('、') || '无';
  const location = formatEldredLocation(undefined, player.location);
  return [
    '【艾尔德雷德入局设定】',
    `姓名：${player.name}`,
    `性别：${player.identity.gender || '未记录'}`,
    `年龄：${player.identity.age || '未记录'}`,
    `经历：${player.identity.background || '未记录'}`,
    `种族：${race.name}｜${race.auraName}｜${race.auraEffect}`,
    `职业：${cls.name}｜${cls.classAuraName}｜${cls.classAuraEffect}`,
    `伴生天赋：${talentNames}`,
    `出生点：${location.fullName}`,
    `五维：${stats}`,
    '等级：1',
    `战斗底值：生命${player.stats.maxHp}｜法力${player.stats.maxMp}｜护甲${player.stats.ac}｜熟练+${player.stats.proficiency}`,
    `已选开局技能：${skillNames}`,
    `初始装备：${equipment}`,
  ].join('\n');
};

const buildRuntimeSummary = (runtime: EldredRuntimeSave, party: Character[] = [], enemies: CombatUnit[] = []) => {
  const world = runtime.world;
  const location = formatEldredLocation(world, runtime.player?.location);
  const recent = runtime.narration.entries
    .slice(0, 4)
    .reverse()
    .map(entry => `${entry.title}：${entry.text.slice(0, 160).replace(/\s+/g, ' ')}`)
    .join('\n') || '无';
  return [
    '【艾尔德雷德当前局势】',
    `数据来源：${runtime.source}`,
    `时间：${world.currentTime || '未登记'}`,
    `地点：${location.fullName}`,
    `天气：${world.weather || '未登记'}，风险：${world.risk || '未登记'}，旅行状态：${world.travelState || '未登记'}`,
    `在场角色：${world.presentCharacters.join('、') || '未登记'}`,
    formatPlayerFacts(runtime.player),
    formatPartyFacts(party),
    formatEnemyFacts(enemies),
    `近期正文：\n${recent}`,
  ].join('\n');
};

const buildWorldbookScanText = (runtime: EldredRuntimeSave, input: string, eventType?: string) => [
  '[艾尔德雷德:worldbook-scan]',
  '[艾尔德雷德:运行时]',
  runtime.player ? `[艾尔德雷德:职业:${getClassById(runtime.player.classId).name}]` : '',
  runtime.player ? `[艾尔德雷德:种族:${getRaceById(runtime.player.raceId).name}]` : '',
  runtime.player?.location.name || '',
  runtime.player?.location.landmarkName || '',
  runtime.world.currentLocation || '',
  runtime.world.region || '',
  runtime.world.landmark || '',
  eventType ? `[艾尔德雷德:事件:${eventType}]` : '',
  input,
].filter(Boolean).join('\n');

const buildHistoryPrompts = (runtime: EldredRuntimeSave): StoryPrompt[] =>
  runtime.messages.slice(-12).map(message => ({
    role: message.role === 'system' ? 'system' : message.role === 'assistant' ? 'assistant' : 'user',
    content: message.role === 'assistant' ? `<content>\n${message.text}\n</content>` : message.text,
  }));

const buildBaseSystemPrompt = (runtime: EldredRuntimeSave, userInput: string, kind: EldredNarrationKind, party: Character[] = [], enemies: CombatUnit[] = []) => [
  '艾尔德雷德脚本控制台事实输入。',
  '脚本控制台负责权威状态、按钮交互、战斗数值、装备槽位、技能装配和存档；正文负责演绎、场景反应、变量同步和沉浸提示。',
  ELDRED_WORLD_ENGINE_PATCH,
  ELDRED_CHAT_BEAUTIFY_RULES,
  kind === 'combat' ? ELDRED_COMBAT_INTERNAL_CHECKLIST : '',
  buildRuntimeSummary(runtime, party, enemies),
  '',
  '本轮输入：',
  userInput,
].filter(Boolean).join('\n\n');

const generateWithEldredPreset = async ({
  runtime,
  userInput,
  systemPrompt,
  worldbookScanText,
}: {
  runtime: EldredRuntimeSave;
  userInput: string;
  systemPrompt: string;
  worldbookScanText: string;
}) => {
  const generate = getHostFunction<(config: AnyRecord) => Promise<string>>('generate') || requestGenerateThroughLoader;
  if (!generate) {
    throw Error('未检测到 Tavern Helper generate()。请在 SillyTavern 脚本控制台内运行。');
  }

  return String(await generate({
    generation_id: createId('eldred-gen'),
    user_input: userInput,
    should_stream: false,
    should_silence: false,
    max_chat_history: 0,
    injects: [
      { role: 'system', content: systemPrompt, position: 'in_chat', depth: 0, should_scan: false },
      { role: 'system', content: worldbookScanText, position: 'none', depth: 0, should_scan: true },
    ],
    overrides: {
      chat_history: {
        with_depth_entries: true,
        prompts: buildHistoryPrompts(runtime),
      },
    },
  }));
};

const extractCharacterTags = (text: string) =>
  Array.from(new Set(Array.from(text.matchAll(/【([^】]{1,32})】[：:]/g)).map(match => match[1]))).slice(0, 12);

const appendGeneratedEntry = (
  runtime: EldredRuntimeSave,
  entry: Omit<EldredNarrationEntry, 'id' | 'createdAt'>,
) => {
  const timestamp = nowIso();
  const nextUserMessage: EldredRuntimeMessage = {
    id: createId('msg'),
    role: 'user',
    text: entry.userInput,
    createdAt: timestamp,
  };
  const nextAssistantMessage: EldredRuntimeMessage = {
    id: createId('msg'),
    role: 'assistant',
    text: entry.text,
    createdAt: timestamp,
  };
  return persistEldredRuntimeCache({
    ...runtime,
    narration: {
      entries: [
        {
          ...entry,
          id: createId('nar'),
          createdAt: timestamp,
        },
        ...runtime.narration.entries,
      ].slice(0, 80),
      lastGeneratedAt: timestamp,
      lastError: undefined,
    },
    messages: [...runtime.messages, nextUserMessage, nextAssistantMessage].slice(-40),
    updatedAt: timestamp,
  });
};

const persistGenerationError = (runtime: EldredRuntimeSave, error: unknown) => {
  const text = error instanceof Error ? error.message : String(error);
  return persistEldredRuntimeCache({
    ...runtime,
    narration: {
      ...runtime.narration,
      lastError: text,
    },
    updatedAt: nowIso(),
  });
};

export const generateEldredNarrationFromInput = async (
  runtime: EldredRuntimeSave,
  userInput: string,
  kind: EldredNarrationKind = 'free',
) => {
  const trimmedInput = userInput.trim();
  if (!trimmedInput) return runtime;
  try {
    const rawText = await generateWithEldredPreset({
      runtime,
      userInput: trimmedInput,
      systemPrompt: buildBaseSystemPrompt(runtime, trimmedInput, kind),
      worldbookScanText: buildWorldbookScanText(runtime, trimmedInput, kind),
    });
    const content = extractEldredContentBlock(rawText);
    return appendGeneratedEntry(runtime, {
      kind,
      title: kind === 'combat' ? '战斗回合' : '玩家行动',
      userInput: trimmedInput,
      text: content,
      characterTags: extractCharacterTags(content),
    });
  } catch (error) {
    return persistGenerationError(runtime, error);
  }
};

export const generateEldredNarrationFromOpening = async (runtime: EldredRuntimeSave, player: PlayerState) => {
  const openingFacts = buildEldredOpeningFacts(player);
  const userInput = '进入艾尔德雷德。';
  const systemPrompt = [
    buildBaseSystemPrompt(runtime, openingFacts, 'opening'),
    '生成第一幕正文。只按入局设定初始化变量；未选择技能、默认剧情、默认队友、默认委托不得写入。需要输出 <content> 与 <UpdateVariable>。',
  ].join('\n\n');
  try {
    const rawText = await generateWithEldredPreset({
      runtime,
      userInput,
      systemPrompt,
      worldbookScanText: buildWorldbookScanText(runtime, openingFacts, 'opening_setup'),
    });
    const content = extractEldredContentBlock(rawText);
    return appendGeneratedEntry(runtime, {
      kind: 'opening',
      title: '第一幕',
      userInput: openingFacts,
      text: content,
      sourceEventType: 'opening_setup',
      characterTags: extractCharacterTags(content),
    });
  } catch (error) {
    return persistGenerationError(runtime, error);
  }
};

export const generateEldredNarrationFromEvent = async (
  runtime: EldredRuntimeSave,
  input: EldredFrontendEventInput,
) => {
  const eventPayload = buildEldredFrontendEventPayload(input);
  const kind: EldredNarrationKind = input.eventType === 'combat_command' ? 'combat' : 'event';
  const party = input.party || [];
  const enemies = input.enemies || [];
  const userInput = input.playerIntent || input.title || '前端事件';
  const systemPrompt = [
    buildBaseSystemPrompt(runtime, eventPayload, kind, party, enemies),
    '按当前变量、世界书和前端权威事件生成下一段正文；事件中的 result 与 authoritative_state_after_event 已经发生。需要输出 <content> 与 <UpdateVariable>，变量写回必须与前端结果一致。',
  ].join('\n\n');
  try {
    const rawText = await generateWithEldredPreset({
      runtime,
      userInput,
      systemPrompt,
      worldbookScanText: buildWorldbookScanText(runtime, `${eventPayload}\n${userInput}`, input.eventType),
    });
    const content = extractEldredContentBlock(rawText);
    return appendGeneratedEntry(runtime, {
      kind,
      title: input.title || '事件推进',
      userInput,
      text: content,
      sourceEventType: input.eventType,
      characterTags: extractCharacterTags(content),
    });
  } catch (error) {
    return persistGenerationError(runtime, error);
  }
};
