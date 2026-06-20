/**
 * 统一 API 调用封装
 *
 * 仅使用自定义 OpenAI-compatible API 发送请求。
 * 已移除跟随酒馆主 API 的功能，所有后台分析均通过自定义 API 执行。
 */

import { useMainStore } from '../stores/mainStore';

interface OrderedPrompt {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GenerateRawParams {
  user_input: string;
  ordered_prompts: (OrderedPrompt | 'user_input')[];
  should_silence?: boolean;
  max_chat_history?: number;
  /** 监听器用：分析类型标签（如"大总结""梦呓"等） */
  _monitorLabel?: string;
  /** 中止信号：外部可通过 AbortController 取消正在进行的请求 */
  _abortSignal?: AbortSignal;
  /** 最大重试次数，默认3。设为0跳过自动重试（如批量总结已有外层重试） */
  _maxRetries?: number;
  [key: string]: unknown;
}

/**
 * 调用 LLM 生成（自动选择 default/custom API）
 * 返回原始响应字符串，与 generateRaw() 返回格式一致
 * 默认自动重试3次（可通过 _maxRetries 覆盖，设为0跳过重试）
 */
export async function callGenerateRaw(params: GenerateRawParams): Promise<string> {
  const maxRetries = params._maxRetries ?? 3;
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = 2000 * Math.pow(2, attempt - 1);
      console.warn(`[智脑] API调用失败(${lastError?.message || lastError}), ${delay / 1000}s后重试(${attempt}/${maxRetries})...`);
      await new Promise(r => setTimeout(r, delay));
    }

    try {
      return await doCallGenerateRaw(params);
    } catch (err: any) {
      lastError = err;
      if (err?.name === 'AbortError') throw err; // 用户中止，不重试
      if (attempt >= maxRetries) {
        console.error(`[智脑] API调用失败，已重试${maxRetries}次，放弃`);
        throw err;
      }
    }
  }
  throw lastError;
}

/** callGenerateRaw 的单次执行体（仅使用自定义 API） */
async function doCallGenerateRaw(params: GenerateRawParams): Promise<string> {
  const store = useMainStore();
  const settings = store.settings;

  // 仅使用自定义 API，需确保配置完整
  if (!settings.customApiUrl || !settings.customApiKey) {
    throw new Error('自定义API未配置：请在设置中填写API地址、Key和模型');
  }

  // 自定义 API 路径
  // Claude 模型需要把 assistant prefill 转成 system 角色
  const modelName = settings.customApiModel || '';
  const orderedPrompts = adaptClaudePrefill(params.ordered_prompts, modelName);

  // 构建 OpenAI-compatible 请求
  const messages = buildOpenAIMessages(orderedPrompts, params.user_input);
  const apiUrl = normalizeApiUrl(settings.customApiUrl.trim());

  // 记录开始时间（监听器用）
  const startTime = settings.apiMonitorEnabled ? Date.now() : 0;
  const analysisName = params._monitorLabel || '后台分析';

  console.info(`[智脑] 自定义API请求 → ${apiUrl} (原始: ${settings.customApiUrl})`);
  console.info(`[智脑] 模型: ${settings.customApiModel}, 消息数: ${messages.length}`);

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.customApiKey}`,
      },
      body: JSON.stringify({
        model: settings.customApiModel,
        messages,
        temperature: 0.7,
        max_tokens: 65536,
      }),
      signal: params._abortSignal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err; // 用户中止，直接向上抛
    console.error('[智脑] fetch 失败（可能是CORS或网络问题）:', err.message || err);
    throw new Error(`网络请求失败: ${err.message || err}\n提示：如果酒馆通过HTTPS加载，自定义API也需要HTTPS；本地API可能需要配置CORS。`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '(无法读取响应)');
    console.error(`[智脑] API返回错误: ${response.status} ${response.statusText}`);

    if (response.status === 404) {
      throw new Error(
        `自定义API 404 Not Found\n` +
        `请求地址: ${apiUrl}\n` +
        `提示: 请确认URL是否包含完整路径（通常以 /v1/chat/completions 结尾）`
      );
    }

    throw new Error(`自定义API请求失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json().catch(() => null);
  if (!data) {
    throw new Error('自定义API返回了空响应或非JSON格式');
  }

  const rawContent = data?.choices?.[0]?.message?.content;
  if (!rawContent) {
    console.error('[智脑] API返回结构异常:', JSON.stringify(data).slice(0, 500));
    throw new Error(`自定义API返回格式异常，未找到 choices[0].message.content`);
  }

  const content = stripThinking(rawContent);
  console.info(`[智脑] 自定义API返回 ${content.length} 字符 (原始 ${rawContent.length})`);

  // 监听器：记录原始内容（含思维链），便于调试
  if (settings.apiMonitorEnabled) {
    const durationMs = Date.now() - startTime;
    store.pushApiMonitorLog({
      timestamp: new Date().toISOString(),
      analysisName,
      model: settings.customApiModel || modelName || '?',
      messages,
      response: rawContent,
      durationMs,
    });
  }

  return content;
}

function adaptClaudePrefill(
  orderedPrompts: (OrderedPrompt | 'user_input')[],
  modelName: string,
): (OrderedPrompt | 'user_input')[] {
  if (!/claude/i.test(modelName)) return orderedPrompts;

  const prompts = [...orderedPrompts];
  for (let i = prompts.length - 1; i >= 0; i--) {
    const item = prompts[i];
    if (item !== 'user_input' && item.role === 'assistant') {
      prompts[i] = { ...item, role: 'system' };
      break;
    }
  }
  return prompts;
}

/**
 * 规范化 API URL：模拟酒馆原生的自动补全行为
 * 如果 URL 未以 /chat/completions 结尾，自动追加
 */
function normalizeApiUrl(url: string): string {
  if (url.endsWith('/chat/completions')) return url;
  const trimmed = url.replace(/\/+$/, '');
  return `${trimmed}/chat/completions`;
}

/**
 * 将 ordered_prompts 转换为 OpenAI messages 数组
 * 'user_input' 占位符会被替换为实际的 user_input 内容
 */
function buildOpenAIMessages(
  orderedPrompts: (OrderedPrompt | 'user_input')[],
  userInput: string,
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];

  for (const item of orderedPrompts) {
    if (item === 'user_input') {
      messages.push({ role: 'user', content: userInput });
    } else {
      messages.push({ role: item.role, content: item.content });
    }
  }

  return messages;
}

/**
 * 剥离 AI 原生思维链/推理内容
 * 兼容：<think>...</think>、<thinking>...</thinking>、[reasoning]...[/reasoning]、[thinking]...[/thinking]
 */
function stripThinking(text: string): string {
  // 找到最后一个已知的思维链闭合标签，取其后的内容
  // 注意：必须找配对的闭合标签，防止正文中包含这些字符串导致误切
  const closeTags = ['</think>', '</thinking>', '[/reasoning]', '[/thinking]'];
  let bestEnd = -1;
  for (const tag of closeTags) {
    const idx = text.lastIndexOf(tag);
    if (idx > bestEnd) bestEnd = idx;
  }
  if (bestEnd > 0) {
    return text.slice(bestEnd + (closeTags.find(t => text.lastIndexOf(t) === bestEnd)?.length || 0)).trim();
  }
  // 如果只有开标签没有闭标签，尝试找开标签后的内容
  const openTags = ['<think>', '<thinking>', '[reasoning]', '[thinking]'];
  for (let i = 0; i < openTags.length; i++) {
    const openIdx = text.indexOf(openTags[i]);
    const closeIdx = text.indexOf(closeTags[i]);
    if (openIdx >= 0 && closeIdx > openIdx) {
      return text.slice(closeIdx + closeTags[i].length).trim();
    }
  }
  return text;
}


// ======== 小总结独立API ==========

/**
 * 小总结专用 API 调用
 * 如果启用了独立API (smallSummaryApiEnabled)，走独立的 URL/Key/Model
 * 否则 fallback 到 callGenerateRaw（通用API或酒馆API）
 */
export async function callSmallSummaryApi(params: Parameters<typeof callGenerateRaw>[0]): Promise<string> {
  const store = useMainStore();
  const settings = store.settings;

  // 未启用独立API → fallback（callGenerateRaw 自带重试）
  if (!settings.smallSummaryApiEnabled || !settings.smallSummaryApiUrl || !settings.smallSummaryApiKey || !settings.smallSummaryApiModel) {
    return callGenerateRaw(params);
  }

  // 走独立API，自带重试（与 callGenerateRaw 一致）
  const maxRetries = params._maxRetries ?? 3;
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = 2000 * Math.pow(2, attempt - 1);
      console.warn(`[智脑-小总结API] 请求失败(${lastError?.message || lastError}), ${delay / 1000}s后重试(${attempt}/${maxRetries})...`);
      await new Promise(r => setTimeout(r, delay));
    }

    try {
      return await doCallSmallSummaryApi(params);
    } catch (err: any) {
      lastError = err;
      if (err?.name === 'AbortError') throw err;
      if (attempt >= maxRetries) {
        console.error(`[智脑-小总结API] 请求失败，已重试${maxRetries}次，放弃`);
        throw err;
      }
    }
  }
  throw lastError;
}

/** callSmallSummaryApi 的单次执行体（独立API路径） */
async function doCallSmallSummaryApi(params: Parameters<typeof callGenerateRaw>[0]): Promise<string> {
  const store = useMainStore();
  const settings = store.settings;

  const messages = buildOpenAIMessagesFromParams(params);
  const apiUrl = normalizeSmallSummaryUrl(settings.smallSummaryApiUrl.trim());
  const modelName = settings.smallSummaryApiModel;

  const startTime = settings.apiMonitorEnabled ? Date.now() : 0;
  const analysisName = params._monitorLabel || '小总结';

  console.info(`[智脑-小总结API] 独立API请求 -> ${apiUrl}, model=${modelName}`);

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.smallSummaryApiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        temperature: 0.5,
        max_tokens: 2048,
      }),
      signal: params._abortSignal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
    console.error('[智脑-小总结API] fetch 失败:', err.message || err);
    throw new Error(`小总结API网络请求失败: ${err.message || err}`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '(无法读取响应)');
    throw new Error(`小总结API请求失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json().catch(() => null);
  if (!data) {
    throw new Error('小总结API返回了空响应或非JSON格式');
  }

  const rawContent = data?.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error('小总结API返回格式异常，未找到 choices[0].message.content');
  }

  const content = stripThinking(rawContent);
  console.info(`[智脑-小总结API] 返回 ${content.length} 字符`);

  // 监听器记录
  if (settings.apiMonitorEnabled) {
    const durationMs = Date.now() - startTime;
    store.pushApiMonitorLog({
      timestamp: new Date().toISOString(),
      analysisName,
      model: modelName,
      messages,
      response: rawContent,
      durationMs,
    });
  }

  return content;
}

/** 从 GenerateRawParams 构建 OpenAI messages */
function buildOpenAIMessagesFromParams(params: Parameters<typeof callGenerateRaw>[0]): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];
  for (const item of params.ordered_prompts) {
    if (item === 'user_input') {
      messages.push({ role: 'user', content: params.user_input });
    } else {
      messages.push({ role: item.role, content: item.content });
    }
  }
  return messages;
}

/** 规范化小总结API URL */
function normalizeSmallSummaryUrl(url: string): string {
  if (url.endsWith('/chat/completions')) return url;
  const trimmed = url.replace(/\/+$/, '');
  if (trimmed.endsWith('/v1')) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

// ========== 模型列表获取 ==========

/**
 * 获取指定 API 的可用模型列表
 * 兼容 OpenAI / DepSeek / 中转站等 /v1/models 接口
 */
export async function fetchAvailableModels(apiUrl: string, apiKey: string): Promise<string[]> {
  let modelsUrl = apiUrl.trim().replace(/\/+$/, '');
  if (modelsUrl.endsWith('/chat/completions')) {
    modelsUrl = modelsUrl.replace('/chat/completions', '/models');
  } else if (modelsUrl.endsWith('/v1')) {
    modelsUrl = modelsUrl + '/models';
  } else if (!modelsUrl.endsWith('/models')) {
    modelsUrl = modelsUrl + '/v1/models';
  }

  console.info(`[智脑] 获取模型列表: ${modelsUrl}`);

  const maxRetries = 3;
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = 1000 * Math.pow(2, attempt - 1);
      console.warn(`[智脑] 获取模型列表失败(${lastError?.message || lastError}), ${delay / 1000}s后重试(${attempt}/${maxRetries})...`);
      await new Promise(r => setTimeout(r, delay));
    }

    try {
      const response = await fetch(modelsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`获取模型列表失败 (${response.status}): ${errText.slice(0, 200)}`);
      }

      const data = await response.json();
      if (Array.isArray(data?.data)) {
        return data.data.map((m: any) => m.id || m.name || '').filter(Boolean).sort();
      }
      if (Array.isArray(data)) {
        return data.map((m: any) => (typeof m === 'string' ? m : m.id || m.name || '')).filter(Boolean).sort();
      }
      throw new Error('模型列表返回格式不支持');
    } catch (err: any) {
      lastError = err;
      if (err?.name === 'AbortError') throw err;
      if (attempt >= maxRetries) throw err;
    }
  }
  throw lastError;
}
