import { useEffect, useState } from 'react';
import { AlertCircle, Clock, Coins, Newspaper, Scroll } from 'lucide-react';
import { DynamicBoardItem, Quest } from '../../types';
import { EldredFrontendEventInput } from '../../game/eldredEvents';

type QuestPanelProps = {
  quests?: Quest[];
  boardItems?: DynamicBoardItem[];
  onSubmitEvent?: (event: Omit<EldredFrontendEventInput, 'player' | 'party' | 'enemies'>) => Promise<void>;
  onDismissBoardItem?: (item: DynamicBoardItem) => void | Promise<void>;
  onOpenOverview?: () => void;
};

const EMPTY_QUESTS: Quest[] = [];
const EMPTY_BOARD_ITEMS: DynamicBoardItem[] = [];
const NEWS_TYPES = new Set<DynamicBoardItem['type']>(['新闻', '见闻', '市场', '传讯', '路径行动']);

const riskColor = (risk: Quest['risk']) => {
  if (risk === '极高') return 'text-red-500';
  if (risk === '高') return 'text-orange-500';
  if (risk === '中') return 'text-fantasy-gold';
  return 'text-green-500';
};

const boardTypeColor = (type: DynamicBoardItem['type']) => {
  if (type === '新闻') return 'text-sky-300 border-sky-300/30 bg-sky-300/10';
  if (type === '见闻') return 'text-violet-300 border-violet-300/30 bg-violet-300/10';
  if (type === '委托') return 'text-fantasy-gold border-fantasy-gold/30 bg-fantasy-gold/10';
  if (type === '市场') return 'text-emerald-300 border-emerald-300/30 bg-emerald-300/10';
  if (type === '传讯') return 'text-rose-300 border-rose-300/30 bg-rose-300/10';
  return 'text-cyan-300 border-cyan-300/30 bg-cyan-300/10';
};

const questFromBoardItem = (item: DynamicBoardItem): Quest => ({
  id: item.id,
  title: item.title,
  source: item.source || item.location || '未登记',
  task: item.detail || '委托详情未登记',
  recLevel: item.recLevel || 1,
  risk: (['极高', '高', '中', '低'].includes(String(item.risk)) ? item.risk : '中') as Quest['risk'],
  reward: item.reward || '',
  timeLimit: item.timeLimit || '',
  status: '可接取',
});

const normalizeQuestTitle = (value: string) =>
  String(value || '')
    .replace(/[【】「」《》“”"'`]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();

const InfoTile = ({ label, value, tone = 'normal' }: { label: string; value?: string | number; tone?: 'normal' | 'gold' | 'red' | 'blue' }) => {
  const toneClass = tone === 'gold'
    ? 'text-fantasy-gold'
    : tone === 'red'
      ? 'text-orange-300'
      : tone === 'blue'
        ? 'text-sky-200'
        : 'text-gray-100';
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 px-4 py-3">
      <div className="text-[11px] tracking-[0.18em] text-gray-500 mb-1">{label}</div>
      <div className={`text-sm font-medium leading-relaxed ${toneClass}`}>{value || '未登记'}</div>
    </div>
  );
};

export function QuestPanel({ quests = EMPTY_QUESTS, boardItems = EMPTY_BOARD_ITEMS, onSubmitEvent, onDismissBoardItem, onOpenOverview }: QuestPanelProps) {
  const [selectedQuestId, setSelectedQuestId] = useState('');
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const newsItems = boardItems.filter(item => NEWS_TYPES.has(item.type));
  const questTitleSet = new Set(quests.map(quest => normalizeQuestTitle(quest.title || quest.id)).filter(Boolean));
  const boardQuestItems = boardItems.filter(item =>
    item.type === '委托' && !questTitleSet.has(normalizeQuestTitle(item.title || item.id)),
  );
  const selectedBoardItem = boardItems.find(item => item.id === selectedBoardId) || null;
  const selectedAcceptedBoardQuest = selectedBoardItem?.type === '委托'
    ? quests.find(quest => normalizeQuestTitle(quest.title || quest.id) === normalizeQuestTitle(selectedBoardItem.title || selectedBoardItem.id)) || null
    : null;
  const selectedQuest = selectedBoardItem && !selectedAcceptedBoardQuest ? null : quests.find(q => q.id === selectedQuestId) || quests[0] || null;
  const selectedBoardQuest = selectedBoardItem?.type === '委托' && !selectedAcceptedBoardQuest ? questFromBoardItem(selectedBoardItem) : null;
  const activeQuest = selectedAcceptedBoardQuest || selectedQuest || selectedBoardQuest;
  const isBoardQuest = Boolean(selectedBoardItem && selectedBoardQuest && !selectedAcceptedBoardQuest);
  const isQuestInProgress = Boolean(activeQuest && /进行中/.test(activeQuest.status || ''));

  useEffect(() => {
    if (selectedBoardId && !boardItems.some(item => item.id === selectedBoardId)) setSelectedBoardId('');
  }, [boardItems, selectedBoardId]);

  useEffect(() => {
    if (selectedBoardId || selectedQuestId || quests.length || !boardItems.length) return;
    const firstBoardItem = boardItems.find(item => NEWS_TYPES.has(item.type)) || boardItems[0];
    if (firstBoardItem) setSelectedBoardId(firstBoardItem.id);
  }, [boardItems, quests.length, selectedBoardId, selectedQuestId]);

  useEffect(() => {
    if (selectedBoardId) return;
    if (selectedQuest && selectedQuest.id !== selectedQuestId) setSelectedQuestId(selectedQuest.id);
    if (!selectedQuest && selectedQuestId) setSelectedQuestId('');
  }, [selectedBoardId, selectedQuest, selectedQuestId]);

  const acceptQuest = () => {
    if (!activeQuest || !isBoardQuest || isQuestInProgress) return;
    onOpenOverview?.();
    void onSubmitEvent?.({
      eventType: 'quest_accept',
      title: `揭下委托单：${activeQuest.title}`,
      playerIntent: `接受委托「${activeQuest.title}」`,
      target: activeQuest.title,
      quest: activeQuest,
      extraFacts: [
        `发布者：${activeQuest.source || '未登记'}`,
        `建议等级：${activeQuest.recLevel}`,
        `风险：${activeQuest.risk}`,
        `报酬：${activeQuest.reward || '未登记'}`,
        `时限：${activeQuest.timeLimit || '未登记'}`,
      ],
    });
  };

  const abandonQuest = () => {
    if (!activeQuest || !isQuestInProgress) return;
    onOpenOverview?.();
    void onSubmitEvent?.({
      eventType: 'quest_abandon',
      title: `中断委托：${activeQuest.title}`,
      playerIntent: `中断正在进行的委托「${activeQuest.title}」`,
      target: activeQuest.title,
      quest: activeQuest,
      extraFacts: [
        `当前状态：${activeQuest.status || '进行中'}`,
        `发布者：${activeQuest.source || '未登记'}`,
        `建议等级：${activeQuest.recLevel}`,
        `风险：${activeQuest.risk}`,
        `报酬：${activeQuest.reward || '未登记'}`,
      ],
    });
  };

  return (
    <div className="h-full w-full flex flex-col xl:flex-row gap-4 xl:gap-6 overflow-y-auto xl:overflow-hidden">
      <div className="w-full xl:w-[34rem] max-h-72 xl:max-h-none glass-panel rounded-xl flex flex-col overflow-hidden shrink-0">
        <div className="p-5 border-b border-fantasy-gold/20 bg-fantasy-darker/60 flex items-center justify-between">
          <h2 className="text-lg font-serif text-gray-200">城镇看板</h2>
          <span className="text-xs text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {quests.length + boardItems.length}条</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {newsItems.length > 0 && (
            <section className="space-y-2">
              <div className="text-[11px] tracking-[0.2em] text-gray-500">新闻见闻</div>
              {newsItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelectedBoardId(item.id);
                    setSelectedQuestId('');
                  }}
                  className={`w-full text-left p-4 rounded-lg flex flex-col gap-2 transition-all border ${selectedBoardItem?.id === item.id ? 'bg-white/10 border-fantasy-gold shadow-[0_0_10px_rgba(212,175,55,0.15)]' : 'bg-black/20 border-white/5 hover:border-fantasy-gold/40'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-gray-200 line-clamp-2">{item.title}</div>
                    <span className={`shrink-0 px-2 py-0.5 text-[10px] border rounded ${boardTypeColor(item.type)}`}>{item.type}</span>
                  </div>
                  <div className="text-xs text-gray-400 line-clamp-2">{item.detail || item.location || item.source || '已记录'}</div>
                </button>
              ))}
            </section>
          )}

          <section className="space-y-2">
            <div className="text-[11px] tracking-[0.2em] text-gray-500">委托</div>
            {quests.length === 0 && boardQuestItems.length === 0 && (
              <div className="p-4 rounded bg-black/20 border border-white/5 text-sm text-gray-500">暂无委托记录</div>
            )}
            {boardQuestItems.map(item => (
              (() => {
                const boardQuest = questFromBoardItem(item);
                return (
              <button
                key={item.id}
                onClick={() => {
                  setSelectedBoardId(item.id);
                  setSelectedQuestId('');
                }}
                className={`w-full text-left p-4 rounded-lg flex flex-col gap-2 transition-all border ${selectedBoardItem?.id === item.id ? 'bg-fantasy-gold/10 border-fantasy-gold shadow-[0_0_10px_rgba(212,175,55,0.15)]' : 'bg-black/20 border-white/5 hover:border-fantasy-gold/40'}`}
              >
                <div className="text-sm font-medium text-fantasy-gold line-clamp-2">{item.title}</div>
                <div className="text-xs text-gray-400 line-clamp-2">{item.detail || item.source || '委托已张贴'}</div>
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <span className="rounded border border-white/10 bg-black/25 px-2 py-1 text-gray-400">等级{boardQuest.recLevel}</span>
                  <span className={`rounded border border-white/10 bg-black/25 px-2 py-1 ${riskColor(boardQuest.risk)}`}>风险{boardQuest.risk}</span>
                  <span className="rounded border border-white/10 bg-black/25 px-2 py-1 text-fantasy-gold truncate">{boardQuest.reward || '奖励未登记'}</span>
                </div>
              </button>
                );
              })()
            ))}
            {quests.map(q => (
              <button
                key={q.id}
                onClick={() => {
                  setSelectedQuestId(q.id);
                  setSelectedBoardId('');
                }}
                className={`w-full text-left p-4 rounded-lg flex flex-col gap-2 transition-all border ${selectedQuest?.id === q.id ? 'bg-fantasy-gold/10 border-fantasy-gold shadow-[0_0_10px_rgba(212,175,55,0.15)]' : 'bg-black/20 border-white/5 hover:border-fantasy-gold/40'}`}
              >
                <div className={`text-sm font-medium ${selectedQuest?.id === q.id ? 'text-fantasy-gold' : 'text-gray-300'}`}>{q.title}</div>
                <div className="flex justify-between items-center text-xs mt-2">
                  <div className="flex items-center gap-1">
                    <AlertCircle className={`w-3 h-3 ${riskColor(q.risk)}`} />
                    <span className="text-gray-400">风险 {q.risk}</span>
                  </div>
                  <span className="text-gray-500 font-mono">等级{q.recLevel}</span>
                </div>
                <div className="text-[11px] text-fantasy-gold truncate">{q.reward || '奖励未登记'}</div>
              </button>
            ))}
          </section>
        </div>
      </div>

      <div className="flex-1 min-h-[520px] xl:min-h-0 glass-panel rounded-xl relative overflow-hidden flex flex-col">
        {selectedBoardItem && !selectedBoardQuest ? (
          <>
            <div className="px-5 md:px-8 py-6 md:py-10 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent relative">
              <span className={`inline-flex mb-4 px-3 py-1 text-xs border rounded ${boardTypeColor(selectedBoardItem.type)}`}>{selectedBoardItem.type}</span>
              <h1 className="text-xl md:text-3xl font-serif text-white mb-3 leading-snug">{selectedBoardItem.title}</h1>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <InfoTile label="来源" value={selectedBoardItem.source || selectedBoardItem.location} tone="blue" />
                <InfoTile label="地点" value={selectedBoardItem.location} />
                <InfoTile label="状态" value={selectedBoardItem.status} tone="gold" />
                <InfoTile label="更新" value={selectedBoardItem.updatedAt} />
              </div>
            </div>
            <div className="flex-1 p-5 md:p-8 overflow-y-auto">
              <div className="rounded-xl border border-white/10 bg-black/25 p-5 md:p-6 text-gray-200 leading-relaxed">
                {selectedBoardItem.detail || '正文已登记该条目，等待后续推进。'}
              </div>
            </div>
          </>
        ) : !activeQuest ? (
          <div className="h-full min-h-[420px] flex items-center justify-center p-8">
            <div className="w-full max-w-md rounded-xl border border-fantasy-gold/20 bg-black/20 p-8 text-center">
              <Newspaper className="w-10 h-10 mx-auto text-fantasy-gold/70 mb-4" />
              <div className="text-xl font-serif text-fantasy-gold mb-2">暂无看板记录</div>
              <div className="text-sm text-gray-500">等待正文登记</div>
            </div>
          </div>
        ) : (
          <>
            <div className="px-5 md:px-8 py-6 md:py-10 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent relative">
              <span className="absolute top-4 right-6 text-2xl font-serif text-white/5">委托</span>
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-1 bg-white/10 text-gray-300 text-[10px] uppercase rounded border border-white/10 tracking-widest">{activeQuest.source || '未登记'}</span>
                <span className={`px-2 py-1 text-[10px] rounded border border-fantasy-gold/30 bg-fantasy-gold/10 ${activeQuest.status === '进行中' ? 'text-fantasy-gold' : 'text-gray-300'}`}>{activeQuest.status || '可接取'}</span>
              </div>
              <h1 className="text-xl md:text-3xl font-serif text-white mb-5 leading-snug">{activeQuest.title}</h1>
              <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
                <InfoTile label="建议等级" value={`等级${activeQuest.recLevel}`} tone="blue" />
                <InfoTile label="危险等级" value={activeQuest.risk} tone={activeQuest.risk === '高' || activeQuest.risk === '极高' ? 'red' : 'gold'} />
                <InfoTile label="截止时限" value={activeQuest.timeLimit} />
                <InfoTile label="委托状态" value={activeQuest.status || '可接取'} tone="gold" />
                <InfoTile label="发布来源" value={activeQuest.source} tone="blue" />
              </div>
            </div>

            <div className="flex-1 p-5 md:p-8 overflow-y-auto space-y-6 md:space-y-8">
              <div className="rounded-xl border border-white/10 bg-black/25 p-5">
                <h3 className="text-sm text-fantasy-gold font-serif mb-3 tracking-widest flex items-center gap-2">
                  <Scroll className="w-4 h-4" /> 委托陈述
                </h3>
                <p className="text-gray-200 leading-relaxed text-sm md:text-base">
                  {activeQuest.task || '未登记'}
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <InfoTile label="预期报酬" value={activeQuest.reward} tone="gold" />
                <InfoTile label="危险等级" value={activeQuest.risk} tone={activeQuest.risk === '高' || activeQuest.risk === '极高' ? 'red' : 'gold'} />
                <InfoTile label="截止时限" value={activeQuest.timeLimit} />
              </div>

              <div className="p-4 bg-fantasy-gold/5 border border-fantasy-gold/20 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-400 uppercase tracking-wider">预期报酬</span>
                  <div className="text-fantasy-gold flex items-center gap-2">
                    <Coins className="w-4 h-4" /> {activeQuest.reward || '未登记'}
                  </div>
                  {activeQuest.reputationReward !== undefined && (
                    <div className="text-xs text-gray-400 mt-1">地区声望 +{activeQuest.reputationReward}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 md:p-6 border-t border-white/5 bg-black/40 flex flex-col sm:flex-row justify-end gap-3 md:gap-4">
              <button
                onClick={() => {
                  if (isQuestInProgress) {
                    abandonQuest();
                    return;
                  }
                  if (selectedBoardItem) void onDismissBoardItem?.(selectedBoardItem);
                }}
                disabled={!selectedBoardItem && !isQuestInProgress}
                className="btn-rpg bg-black px-6 py-2 rounded text-sm text-gray-400 border-gray-600 disabled:opacity-40"
              >
                {isQuestInProgress ? '中断' : '忽略'}
              </button>
              <button
                onClick={acceptQuest}
                disabled={!isBoardQuest || isQuestInProgress}
                className="btn-rpg bg-fantasy-gold/20 text-fantasy-gold border-fantasy-gold px-8 py-2 rounded text-sm tracking-widest hover:bg-fantasy-gold hover:text-black disabled:opacity-45 disabled:hover:bg-fantasy-gold/20 disabled:hover:text-fantasy-gold"
              >
                {isQuestInProgress ? '委托进行中' : '揭下委托单'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
