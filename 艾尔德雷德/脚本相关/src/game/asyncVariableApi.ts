import { EldredRuntimeSave, persistEldredRuntimeCache, runtimeFromStatData } from './eldredSave';
import {
  applyEldredJsonPatchOperations,
  extractEldredJsonPatchOperations,
  getEldredHostFunction,
  syncEldredNarrativeTagsToStatData,
  writeEldredStatDataToHost,
} from './eldredNarration';

type AnyRecord = Record<string, any>;

export type EldredAsyncVariableApiSettings = {
  enabled: boolean;
  apiurl: string;
  key: string;
  source: string;
  model: string;
  temperature: string;
  lastStatus?: string;
  lastRunAt?: string;
};

export type EldredAsyncVariableApiResult = {
  runtime: EldredRuntimeSave;
  rawText: string;
  applied: boolean;
  message: string;
};

const SETTINGS_KEY = 'eldred_async_variable_api_v1';

export const ELDRED_ASYNC_API_SOURCES = [
  { id: 'openai', label: 'OpenAI 兼容' },
  { id: 'claude', label: 'Claude' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'openrouter', label: 'OpenRouter' },
  { id: 'kobold', label: 'Kobold' },
  { id: 'textgenerationwebui', label: 'TextGen WebUI' },
  { id: 'custom', label: '自定义兼容' },
] as const;

export const createDefaultAsyncVariableApiSettings = (): EldredAsyncVariableApiSettings => ({
  enabled: false,
  apiurl: '',
  key: '',
  source: 'openai',
  model: '',
  temperature: '0.2',
});

const nowIso = () => new Date().toISOString();

const isRecord = (value: unknown): value is AnyRecord =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const cloneRecord = (value: unknown): AnyRecord => {
  if (!isRecord(value)) return {};
  try {
    if (typeof structuredClone === 'function') return structuredClone(value);
  } catch {
    // JSON clone below.
  }
  try {
    return JSON.parse(JSON.stringify(value)) as AnyRecord;
  } catch {
    return { ...value };
  }
};

export const loadEldredAsyncVariableApiSettings = (): EldredAsyncVariableApiSettings => {
  if (typeof localStorage === 'undefined') return createDefaultAsyncVariableApiSettings();
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return createDefaultAsyncVariableApiSettings();
    return { ...createDefaultAsyncVariableApiSettings(), ...JSON.parse(raw) };
  } catch {
    return createDefaultAsyncVariableApiSettings();
  }
};

export const saveEldredAsyncVariableApiSettings = (settings: EldredAsyncVariableApiSettings) => {
  const nextSettings = { ...settings, lastStatus: settings.lastStatus || undefined };
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
  }
  return nextSettings;
};

const extractStatDataPayload = (payload: unknown): AnyRecord | null => {
  if (!isRecord(payload)) return null;
  const candidates = [
    payload.stat_data,
    payload.statData,
    payload.variables?.stat_data,
    payload.data?.stat_data,
    payload,
  ];
  for (const candidate of candidates) {
    if (isRecord(candidate)) return cloneRecord(candidate);
  }
  return null;
};

const parseJsonPayload = (rawText: string): unknown => {
  const cleaned = rawText
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();
  if (!cleaned) return null;
  try {
    return JSON.parse(cleaned);
  } catch {
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
};

const buildVariableProcessorPrompt = (runtime: EldredRuntimeSave) => {
  const rawStatData = runtime.rawStatData || {};
  const recentNarration = runtime.narration.entries.slice(0, 3).map(entry => ({
    title: entry.title,
    kind: entry.kind,
    text: entry.text.slice(0, 1200),
    createdAt: entry.createdAt,
  }));

  return [
    '你是艾尔德雷德变量异步整理器，只处理变量一致性，不续写正文。',
    '根据 current_stat_data 与 recent_narration 纠正缺失、重复、状态不一致或列表超量的问题。',
    '只允许输出以下两种之一：',
    '1. <JSONPatch>[{"op":"replace","path":"世界.当前时间","value":"..."}]</JSONPatch>',
    '2. {"stat_data":{...完整变量对象...}}',
    '不得输出解释、问候、正文、思维链或 Markdown 说明。',
    '约束：委托接取后在主角.任务列表且状态=进行中；委托完成后状态=已完成或待结算；奖励结算后从主角.任务列表与世界.动态看板.委托移除。',
    '约束：世界.动态看板.新闻、见闻、委托每类最多4条；保留最新且字段完整的条目。',
    '约束：不得新增正文没有发生的奖励、等级、好感、声望、装备或主线线索。',
    '',
    'current_stat_data:',
    JSON.stringify(rawStatData, null, 2),
    '',
    'recent_narration:',
    JSON.stringify(recentNarration, null, 2),
  ].join('\n');
};

const callThroughTavernGenerateRaw = async (settings: EldredAsyncVariableApiSettings, userInput: string) => {
  const generateRaw = getEldredHostFunction<(config: AnyRecord) => Promise<string | AnyRecord>>('generateRaw');
  if (!generateRaw) return null;
  const temperature = Number(settings.temperature) || 0.2;
  const text = await generateRaw({
    generation_id: `eldred-variable-api-${Date.now().toString(36)}`,
    user_input: userInput,
    should_stream: false,
    should_silence: true,
    max_chat_history: 0,
    custom_api: {
      apiurl: settings.apiurl,
      key: settings.key || undefined,
      source: settings.source || 'openai',
      model: settings.model,
      temperature,
      max_tokens: 2048,
    },
    ordered_prompts: [
      {
        role: 'system',
        content: '只输出 JSONPatch 或 stat_data JSON。不要输出正文、解释、思维链。',
      },
      'user_input',
    ],
  });
  return typeof text === 'string' ? text : JSON.stringify(text);
};

const completionsUrl = (apiurl: string) => {
  const trimmed = apiurl.trim().replace(/\/+$/, '');
  if (/\/chat\/completions$/i.test(trimmed) || /\/v1\/responses$/i.test(trimmed)) return trimmed;
  return `${trimmed}/chat/completions`;
};

const callThroughFetch = async (settings: EldredAsyncVariableApiSettings, userInput: string) => {
  const response = await fetch(completionsUrl(settings.apiurl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(settings.key ? { Authorization: `Bearer ${settings.key}` } : {}),
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role: 'system', content: '只输出 JSONPatch 或 stat_data JSON。不要输出正文、解释、思维链。' },
        { role: 'user', content: userInput },
      ],
      temperature: Number(settings.temperature) || 0.2,
      stream: false,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw Error(`异步 API ${response.status}: ${detail.slice(0, 220)}`);
  }
  const json = await response.json();
  return String(json.choices?.[0]?.message?.content ?? json.output_text ?? json.text ?? '');
};

const callVariableApi = async (settings: EldredAsyncVariableApiSettings, userInput: string) => {
  const throughTavern = await callThroughTavernGenerateRaw(settings, userInput);
  if (throughTavern !== null) return throughTavern;
  return callThroughFetch(settings, userInput);
};

export const refreshEldredAsyncVariableApiModels = async (settings: EldredAsyncVariableApiSettings) => {
  const getModelList = getEldredHostFunction<(customApi: { apiurl: string; key?: string }) => Promise<string[]>>('getModelList');
  if (!getModelList || !settings.apiurl.trim()) return [] as string[];
  return getModelList({ apiurl: settings.apiurl.trim(), key: settings.key || undefined });
};

export const processEldredVariablesWithAsyncApi = async (
  runtime: EldredRuntimeSave,
  settings: EldredAsyncVariableApiSettings,
): Promise<EldredAsyncVariableApiResult> => {
  if (!settings.apiurl.trim() || !settings.model.trim()) {
    throw Error('请先填写接口地址和模型。');
  }

  const prompt = buildVariableProcessorPrompt(runtime);
  const rawText = await callVariableApi(settings, prompt);
  const baseStatData = runtime.rawStatData || {};
  const patchSource = /<JSONPatch\b/i.test(rawText) ? rawText : `<JSONPatch>${rawText}</JSONPatch>`;
  const operations = extractEldredJsonPatchOperations(patchSource);
  const patched = applyEldredJsonPatchOperations(baseStatData, operations);
  const parsedPayload = parseJsonPayload(rawText);
  const replacement = patched || extractStatDataPayload(parsedPayload);
  const tagSynced = syncEldredNarrativeTagsToStatData(rawText, replacement || baseStatData);
  const nextStatData = tagSynced || replacement;

  if (!nextStatData || !Object.keys(nextStatData).length) {
    return {
      runtime,
      rawText,
      applied: false,
      message: '未检测到可写入的 JSONPatch 或 stat_data。',
    };
  }

  await writeEldredStatDataToHost(nextStatData);
  const nextRuntime = persistEldredRuntimeCache({
    ...runtimeFromStatData(nextStatData),
    narration: runtime.narration,
    messages: runtime.messages,
    updatedAt: nowIso(),
  });

  return {
    runtime: nextRuntime,
    rawText,
    applied: true,
    message: operations.length ? `已应用 ${operations.length} 条变量补丁。` : '已写入完整变量对象。',
  };
};
