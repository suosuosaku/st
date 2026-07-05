/**
 * 全局后台队列 (Background Queue)
 *
 * 核心职责：
 * 1. 所有后台 AI 调用进入串行队列，绝不同时执行
 * 2. 正文生成永远最高优先级，后台任务不得与正文抢 API
 * 3. 用户发言后暂停启动新的后台任务；正文生成结束后恢复
 * 4. 后台任务之间串行，按优先级排序
 * 5. 提供完整状态供总览面板展示
 */

// ========== 类型定义 ==========

export type BackgroundTaskType =
  | 'grand_summary'
  | 'small_summary'
  | 'dreamtalk'
  | 'character_memory_update'
  | 'dynamic_profile_update'
  | 'world_progress'
  | 'ecosystem'
  | 'relationship_analysis'
  | 'embedding'
  | 'embedding_mem'
  | 'persona';

export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface BackgroundTask {
  id: string;
  type: BackgroundTaskType;
  status: TaskStatus;
  priority: number;
  label: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  durationMs?: number;
}

// ========== 优先级（数字越小越优先） ==========

const PRIORITY: Record<BackgroundTaskType, number> = {
  small_summary: 1,
  grand_summary: 2,
  dreamtalk: 3,
  dynamic_profile_update: 4,
  character_memory_update: 5,
  world_progress: 6,
  ecosystem: 7,
  relationship_analysis: 8,
  persona: 9,
  embedding: 10,
  embedding_mem: 11,
};

const TASK_LABELS: Record<BackgroundTaskType, string> = {
  small_summary: '小总结',
  grand_summary: '大总结',
  dreamtalk: '梦呓分析',
  dynamic_profile_update: '动态人设更新',
  character_memory_update: '角色记忆更新',
  world_progress: '世界推进',
  ecosystem: '后台推演',
  relationship_analysis: '关系分析',
  persona: '人格分析',
  embedding: '事件向量生成',
  embedding_mem: '记忆向量生成',
};

// ========== 内部状态 ==========

interface QueuedTask extends BackgroundTask {
  execute: () => Promise<void>;
}

const queue: QueuedTask[] = [];
const history: BackgroundTask[] = [];
const MAX_HISTORY = 20;

let isProcessing = false;
let isGenerating = false;
let isPaused = false;
let currentTask: QueuedTask | null = null;

// ========== 工具函数 ==========

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function toRecord(task: QueuedTask): BackgroundTask {
  const { execute, ...record } = task;
  return record;
}

function pushHistory(task: BackgroundTask): void {
  history.unshift(task);
  if (history.length > MAX_HISTORY) history.pop();
}

// ========== 核心 API ==========

/**
 * 将后台任务入队
 * - 同类型不重复入队
 * - 按优先级排序
 * - 如果正文生成中或暂停，任务入队但不立即执行
 */
export function enqueue(
  type: BackgroundTaskType,
  execute: () => Promise<void>,
  label?: string,
): void {
  // 去重：同类型已在队列中
  if (queue.some(t => t.type === type)) {
    console.info(`[后台队列] ${type} 已在队列中，跳过`);
    return;
  }
  // 去重：当前正在执行同类型
  if (currentTask?.type === type) {
    console.info(`[后台队列] ${type} 正在执行中，跳过`);
    return;
  }

  const task: QueuedTask = {
    id: generateId(),
    type,
    status: 'queued',
    priority: PRIORITY[type],
    label: label || TASK_LABELS[type],
    createdAt: Date.now(),
    execute,
  };

  queue.push(task);
  queue.sort((a, b) => a.priority - b.priority);

  console.info(`[后台队列] ${task.label} 入队 (优先级:${task.priority}, 队列:${queue.length})`);

  // 尝试开始处理
  if (!isProcessing && !isGenerating && !isPaused) {
    processQueue();
  }
}

/**
 * 正文生成锁
 * - true: 正文生成开始，暂停后台队列
 * - false: 正文生成结束，恢复后台队列
 */
export function setGenerating(value: boolean): void {
  const prev = isGenerating;
  isGenerating = value;
  if (prev && !value) {
    // 正文结束，恢复队列
    console.info(`[后台队列] 正文生成结束，恢复队列 (待处理:${queue.length})`);
    if (!isProcessing && !isPaused && queue.length > 0) {
      processQueue();
    }
  } else if (!prev && value) {
    console.info('[后台队列] 正文生成开始，暂停启动新任务');
  }
}

/** 手动暂停 */
export function pause(): void {
  isPaused = true;
  console.info('[后台队列] 已暂停');
}

/** 手动恢复 */
export function resume(): void {
  isPaused = false;
  console.info(`[后台队列] 已恢复 (待处理:${queue.length})`);
  if (!isProcessing && !isGenerating && queue.length > 0) {
    processQueue();
  }
}

/** 清空队列（聊天切换/紧急停止） */
export function clear(): void {
  // 标记所有排队任务为取消
  for (const task of queue) {
    task.status = 'cancelled';
    task.completedAt = Date.now();
    pushHistory(toRecord(task));
  }
  queue.length = 0;
  console.info('[后台队列] 队列已清空');
}

/**
 * 获取完整队列状态（供面板展示）
 */
export function getQueueState(): {
  isProcessing: boolean;
  isGenerating: boolean;
  isPaused: boolean;
  current: BackgroundTask | null;
  queued: BackgroundTask[];
  history: BackgroundTask[];
} {
  return {
    isProcessing,
    isGenerating,
    isPaused,
    current: currentTask ? toRecord(currentTask) : null,
    queued: queue.map(toRecord),
    history: [...history],
  };
}

// ========== 队列处理 ==========

const TASK_TIMEOUT = 5 * 60 * 1000; // 5分钟
const TASK_INTERVAL = 300; // 任务间隔 ms

async function processQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    while (queue.length > 0) {
      // 检查锁：正文生成中或暂停则挂起
      if (isGenerating || isPaused) {
        console.info(`[后台队列] 等待中 (generating=${isGenerating}, paused=${isPaused})`);
        break;
      }

      const task = queue.shift()!;
      currentTask = task;
      task.status = 'running';
      task.startedAt = Date.now();

      console.info(`[后台队列] ▶ ${task.label} 开始`);

      try {
        await Promise.race([
          task.execute(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`超时 (${TASK_TIMEOUT / 1000}s)`)), TASK_TIMEOUT),
          ),
        ]);
        task.status = 'completed';
        task.completedAt = Date.now();
        task.durationMs = task.completedAt - task.startedAt;
        console.info(`[后台队列] ✅ ${task.label} 完成 (${task.durationMs}ms)`);
      } catch (error: any) {
        task.status = 'failed';
        task.completedAt = Date.now();
        task.durationMs = task.completedAt - task.startedAt;
        task.error = error?.message || String(error);
        console.error(`[后台队列] ❌ ${task.label} 失败:`, error);
      }

      pushHistory(toRecord(task));
      currentTask = null;

      // 任务间隔
      if (queue.length > 0 && !isGenerating && !isPaused) {
        await new Promise(r => setTimeout(r, TASK_INTERVAL));
      }
    }
  } finally {
    currentTask = null;
    isProcessing = false;
  }
}

// ========== 兼容旧 scheduler 接口（过渡期） ==========

/** 兼容 enqueueAnalysis — 旧 task name 映射到新 type */
const LEGACY_NAME_MAP: Record<string, BackgroundTaskType> = {
  summary_chain: 'grand_summary',
  dreamtalk_chain: 'dreamtalk',
  dynamic_profile_v2: 'dynamic_profile_update',
  ecosystem: 'ecosystem',
  persona: 'persona',
  embedding: 'embedding',
  embedding_mem: 'embedding_mem',
};

export function enqueueAnalysis(name: string, execute: () => Promise<void>): void {
  const type = LEGACY_NAME_MAP[name] || (name as BackgroundTaskType);
  enqueue(type, execute);
}

export function clearSchedulerQueue(): void {
  clear();
}

export function getSchedulerStatus(): {
  isProcessing: boolean;
  currentTask: string | null;
  queueLength: number;
  queueNames: string[];
} {
  return {
    isProcessing,
    currentTask: currentTask?.type || null,
    queueLength: queue.length,
    queueNames: queue.map(t => t.type),
  };
}

export function isSchedulerBusy(): boolean {
  return isProcessing || queue.length > 0;
}
