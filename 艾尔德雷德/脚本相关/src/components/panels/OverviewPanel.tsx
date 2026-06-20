import { useState } from 'react';
import { Clock, Loader2, MapPin, Send, ShieldAlert, ScrollText } from 'lucide-react';
import { ImmersiveNoticeCard, RichNarrative } from '../ImmersiveText';
import { PlayerState } from '../../types';
import { EldredRuntimeSave } from '../../game/eldredSave';
import { formatEldredLocation } from '../../game/locationFormat';

export function OverviewPanel({
  player,
  interactionStatus,
  isGenerating,
  runtime,
  onSubmitFreeInput,
}: {
  player: PlayerState;
  interactionStatus: string;
  isGenerating: boolean;
  runtime?: EldredRuntimeSave;
  onSubmitFreeInput?: (text: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState('');
  const entries = runtime?.narration.entries || [];
  const world = runtime?.world;
  const locationDisplay = formatEldredLocation(world, player.location);
  const timeText = world?.currentTime || '待正文落定';
  const weatherText = world?.weather || player.location.weather || '未登记';
  const visibleEntries = [...entries].reverse();

  const submitDraft = async () => {
    const text = draft.trim();
    if (!text || isGenerating) return;
    setDraft('');
    await onSubmitFreeInput?.(text);
  };

  return (
    <div className="h-full w-full flex flex-col xl:flex-row gap-4 xl:gap-6 overflow-y-auto xl:overflow-hidden">
      <div className="flex-1 min-h-[420px] xl:min-h-0 parchment-panel rounded-lg p-5 md:p-8 flex flex-col relative overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[#8b4513]/20 pb-4 mb-4">
          <ScrollText className="w-6 h-6 text-[#8b4513]" />
          <h2 className="text-xl font-bold text-[#5c3a21] tracking-widest">正文控制台</h2>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 md:pr-4 space-y-5 md:space-y-6 text-[#3A2C1D] leading-relaxed relative z-10 text-sm sm:text-base">
          {visibleEntries.length === 0 && (
            <div className="rounded border border-[#8b4513]/25 bg-[#f8edd4]/55 px-4 py-5 text-sm text-[#6b4b2e]">
              等待第一幕生成。
            </div>
          )}
          {visibleEntries.map(entry => (
            <article key={entry.id} className="rounded border border-[#8b4513]/20 bg-[#f8edd4]/45 px-4 py-4 shadow-inner">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#8b4513]/15 pb-2">
                <div className="text-sm font-bold tracking-widest text-[#8b4513]">{entry.title}</div>
                <div className="text-[11px] text-[#8b4513]/65">{new Date(entry.createdAt).toLocaleString()}</div>
              </div>
              <RichNarrative text={entry.text || '正文未返回。'} />
            </article>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-[#8b4513]/20 flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void submitDraft();
            }}
            disabled={isGenerating}
            className="min-h-20 resize-none rounded border border-[#8b4513]/30 bg-white/45 px-3 py-3 text-sm text-[#3A2C1D] outline-none focus:border-[#8b4513]"
            placeholder="输入行动或对话"
          />
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 bg-white/40 border border-[#8b4513]/30 rounded px-3 md:px-4 py-2.5 text-sm text-[#3A2C1D]">
              {interactionStatus}
            </div>
            <button
              onClick={submitDraft}
              disabled={!draft.trim() || isGenerating}
              className="btn-rpg px-5 py-2.5 rounded text-sm flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              发送
            </button>
          </div>
        </div>
      </div>

      <div className="w-full xl:w-80 flex flex-col gap-4">
        <div className="glass-panel p-5 rounded-lg flex flex-col gap-3">
          <div className="text-fantasy-gold font-serif text-sm border-b border-fantasy-gold/20 pb-2">当前位置</div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-fantasy-blue/20 border border-fantasy-blue flex items-center justify-center text-fantasy-blue">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base md:text-lg text-gray-200 font-serif">{locationDisplay.fullName}</div>
              <div className="text-xs text-gray-400">{locationDisplay.detail || player.location.summary}</div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-lg flex flex-col gap-3">
          <div className="text-fantasy-gold font-serif text-sm border-b border-fantasy-gold/20 pb-2">入局状态</div>
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-gray-400" />
            <div className="text-gray-300 text-sm">{timeText}</div>
          </div>
          <div className="text-blue-400/80 text-sm pl-8">{weatherText}</div>
        </div>

        <div className="glass-panel p-5 rounded-lg min-h-48 xl:flex-1 flex flex-col gap-3">
          <div className="text-fantasy-gold font-serif text-sm border-b border-fantasy-gold/20 pb-2 flex items-center justify-between">
            <span>交互记录</span>
            <ShieldAlert className="w-4 h-4 text-fantasy-gold/50" />
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {player.notices.length === 0 && (
              <div className="text-xs text-gray-500 leading-5">暂无记录</div>
            )}
            {player.notices.map(notice => (
              <ImmersiveNoticeCard key={notice.id} notice={notice} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
