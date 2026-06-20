import { useEffect, useState } from 'react';
import { AlertCircle, Clock, Coins, Scroll } from 'lucide-react';
import { Quest } from '../../types';
import { EldredFrontendEventInput } from '../../game/eldredEvents';

type QuestPanelProps = {
  quests?: Quest[];
  onSubmitEvent?: (event: Omit<EldredFrontendEventInput, 'player' | 'party' | 'enemies'>) => Promise<void>;
};

const EMPTY_QUESTS: Quest[] = [];

const riskColor = (risk: Quest['risk']) => {
  if (risk === '极高') return 'text-red-500';
  if (risk === '高') return 'text-orange-500';
  if (risk === '中') return 'text-fantasy-gold';
  return 'text-green-500';
};

export function QuestPanel({ quests = EMPTY_QUESTS, onSubmitEvent }: QuestPanelProps) {
  const [selectedQuestId, setSelectedQuestId] = useState('');
  const selectedQuest = quests.find(q => q.id === selectedQuestId) || quests[0] || null;

  useEffect(() => {
    if (selectedQuest && selectedQuest.id !== selectedQuestId) setSelectedQuestId(selectedQuest.id);
    if (!selectedQuest && selectedQuestId) setSelectedQuestId('');
  }, [selectedQuest, selectedQuestId]);

  const acceptQuest = () => {
    if (!selectedQuest) return;
    void onSubmitEvent?.({
      eventType: 'quest_accept',
      title: `揭下委托单：${selectedQuest.title}`,
      playerIntent: `接受委托「${selectedQuest.title}」`,
      target: selectedQuest.title,
      quest: selectedQuest,
      extraFacts: [
        `发布者：${selectedQuest.source || '未登记'}`,
        `建议等级：${selectedQuest.recLevel}`,
        `风险：${selectedQuest.risk}`,
        `报酬：${selectedQuest.reward || '未登记'}`,
        `时限：${selectedQuest.timeLimit || '未登记'}`,
      ],
    });
  };

  return (
    <div className="h-full w-full flex flex-col xl:flex-row gap-4 xl:gap-6 overflow-y-auto xl:overflow-hidden">
      <div className="w-full xl:w-1/3 max-h-72 xl:max-h-none glass-panel rounded-xl flex flex-col overflow-hidden shrink-0">
        <div className="p-5 border-b border-fantasy-gold/20 bg-fantasy-darker/60 flex items-center justify-between">
          <h2 className="text-lg font-serif text-gray-200">委托看板</h2>
          <span className="text-xs text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {quests.length}条</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {quests.length === 0 && (
            <div className="p-4 rounded bg-black/20 border border-white/5 text-sm text-gray-500">暂无委托记录</div>
          )}
          {quests.map(q => (
            <button
              key={q.id}
              onClick={() => setSelectedQuestId(q.id)}
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
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-[520px] xl:min-h-0 glass-panel rounded-xl relative overflow-hidden flex flex-col">
        {!selectedQuest ? (
          <div className="h-full min-h-[420px] flex items-center justify-center p-8">
            <div className="w-full max-w-md rounded-xl border border-fantasy-gold/20 bg-black/20 p-8 text-center">
              <Scroll className="w-10 h-10 mx-auto text-fantasy-gold/70 mb-4" />
              <div className="text-xl font-serif text-fantasy-gold mb-2">暂无委托</div>
              <div className="text-sm text-gray-500">等待正文登记</div>
            </div>
          </div>
        ) : (
          <>
            <div className="px-5 md:px-8 py-6 md:py-10 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent relative">
              <span className="absolute top-4 right-6 text-2xl font-serif text-white/5">委托</span>
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-1 bg-white/10 text-gray-400 text-[10px] uppercase rounded border border-white/10 tracking-widest">{selectedQuest.source || '未登记'}</span>
              </div>
              <h1 className="text-xl md:text-3xl font-serif text-white mb-2 leading-snug">{selectedQuest.title}</h1>
              <div className="flex flex-wrap gap-4 md:gap-6 mt-6">
                <div className="flex flex-col gap-1 text-sm">
                  <span className="text-gray-500">建议等级</span>
                  <span className="text-gray-200 font-mono text-lg">{selectedQuest.recLevel}</span>
                </div>
                <div className="flex flex-col gap-1 text-sm">
                  <span className="text-gray-500">截止时限</span>
                  <span className="text-gray-200 flex items-center gap-1"><Clock className="w-4 h-4 text-gray-500" /> {selectedQuest.timeLimit || '未登记'}</span>
                </div>
              </div>
            </div>

            <div className="flex-1 p-5 md:p-8 overflow-y-auto space-y-6 md:space-y-8">
              <div>
                <h3 className="text-sm text-fantasy-gold font-serif mb-3 tracking-widest flex items-center gap-2">
                  <Scroll className="w-4 h-4" /> 委托陈述
                </h3>
                <p className="text-gray-300 leading-relaxed text-sm p-4 bg-black/20 rounded border border-white/5">
                  {selectedQuest.task || '未登记'}
                </p>
              </div>

              <div className="p-4 bg-fantasy-gold/5 border border-fantasy-gold/20 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-400 uppercase tracking-wider">预期报酬</span>
                  <div className="text-fantasy-gold flex items-center gap-2">
                    <Coins className="w-4 h-4" /> {selectedQuest.reward || '未登记'}
                  </div>
                  {selectedQuest.reputationReward !== undefined && (
                    <div className="text-xs text-gray-400 mt-1">地区声望 +{selectedQuest.reputationReward}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 md:p-6 border-t border-white/5 bg-black/40 flex flex-col sm:flex-row justify-end gap-3 md:gap-4">
              <button className="btn-rpg bg-black px-6 py-2 rounded text-sm text-gray-400 border-gray-600">忽略</button>
              <button onClick={acceptQuest} className="btn-rpg bg-fantasy-gold/20 text-fantasy-gold border-fantasy-gold px-8 py-2 rounded text-sm tracking-widest hover:bg-fantasy-gold hover:text-black">
                揭下委托单
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
