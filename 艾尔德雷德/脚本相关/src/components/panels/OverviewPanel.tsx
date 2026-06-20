import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Loader2, MapPin, RefreshCw, Send, ShieldAlert, ScrollText } from 'lucide-react';
import { RichNarrative } from '../ImmersiveText';
import { PlayerState } from '../../types';
import { EldredRuntimeSave } from '../../game/eldredSave';
import { formatEldredLocation } from '../../game/locationFormat';

let overviewNarrativeScrollTop = 0;

type OverviewRecord = {
  id: string;
  label: string;
  title: string;
  detail: string;
  tone: 'event' | 'quest' | 'combat' | 'relation' | 'world';
};

export function OverviewPanel({
  player,
  interactionStatus,
  isGenerating,
  runtime,
  onSubmitFreeInput,
  onRerollLatest,
  canReroll = false,
}: {
  player: PlayerState;
  interactionStatus: string;
  isGenerating: boolean;
  runtime?: EldredRuntimeSave;
  onSubmitFreeInput?: (text: string) => Promise<void>;
  onRerollLatest?: () => Promise<void>;
  canReroll?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const narrativeScrollRef = useRef<HTMLDivElement>(null);
  const entries = runtime?.narration.entries || [];
  const world = runtime?.world;
  const locationDisplay = formatEldredLocation(world, player.location);
  const timeText = world?.currentTime || '待正文落定';
  const weatherText = world?.weather || player.location.weather || '未登记';
  const riskText = world?.risk || player.location.trouble || '未登记';
  const travelText = world?.travelState || '未移动';
  const presentCharacters = world?.presentCharacters?.length ? world.presentCharacters.join('、') : '未登记';
  const visibleEntries = [...entries].reverse();
  const latestEntry = entries[0];
  const latestQuest = runtime?.quests?.[0];
  const boardItems = runtime?.world.dynamicBoard?.slice(0, 6) || [];
  const latestRelationship = player.relationships[0];
  const latestReputation = player.reputations[0];
  const latestCombatLog = runtime?.combat.logs.at(-1);
  const sideRecords = useMemo<OverviewRecord[]>(() => {
    const records: OverviewRecord[] = [];
    if (latestEntry) {
      records.push({
        id: `entry-${latestEntry.id}`,
        label: '正文',
        title: latestEntry.title,
        detail: latestEntry.text.slice(0, 72),
        tone: 'event',
      });
    }
    for (const notice of player.notices.slice(0, 4)) {
      records.push({
        id: notice.id,
        label: notice.title,
        title: notice.body.split(/[｜|]/)[0] || notice.title,
        detail: notice.meta || notice.body,
        tone: notice.type === 'quest' ? 'quest' : notice.type === 'favor' || notice.type === 'reputation' ? 'relation' : notice.type === 'level' ? 'combat' : 'event',
      });
    }
    for (const item of boardItems) {
      records.push({
        id: `board-${item.type}-${item.id}`,
        label: item.type,
        title: item.title,
        detail: [item.location, item.status, item.detail].filter(Boolean).join(' / '),
        tone: item.type === '委托' ? 'quest' : item.type === '新闻' || item.type === '见闻' ? 'world' : 'event',
      });
    }
    if (latestQuest) {
      records.push({
        id: `quest-${latestQuest.id}`,
        label: '委托',
        title: latestQuest.title,
        detail: `${latestQuest.risk}风险 / Lv.${latestQuest.recLevel} / ${latestQuest.task}`,
        tone: 'quest',
      });
    }
    if (latestCombatLog) {
      records.push({
        id: `combat-${latestCombatLog}`,
        label: '战斗',
        title: `第${runtime?.combat.turn || 1}回合`,
        detail: latestCombatLog,
        tone: 'combat',
      });
    }
    if (latestRelationship) {
      records.push({
        id: `relationship-${latestRelationship.characterId}`,
        label: '好感',
        title: latestRelationship.name,
        detail: `${latestRelationship.favorability} / ${latestRelationship.stage}${latestRelationship.lastChange ? ` / ${latestRelationship.lastChange}` : ''}`,
        tone: 'relation',
      });
    }
    if (latestReputation) {
      records.push({
        id: `reputation-${latestReputation.regionId}`,
        label: '声望',
        title: latestReputation.label,
        detail: `${latestReputation.value} / ${latestReputation.tier}`,
        tone: 'relation',
      });
    }
    records.push({
      id: 'world-state',
      label: '局势',
      title: locationDisplay.fullName,
      detail: `${timeText} / ${weatherText} / ${riskText}`,
      tone: 'world',
    });
    return records.slice(0, 9);
  }, [boardItems, entries, latestCombatLog, latestEntry, latestQuest, latestRelationship, latestReputation, locationDisplay.fullName, player.notices, riskText, runtime?.combat.turn, timeText, weatherText]);

  useEffect(() => {
    const node = narrativeScrollRef.current;
    if (!node) return;
    const frame = window.requestAnimationFrame(() => {
      node.scrollTop = overviewNarrativeScrollTop;
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const submitDraft = async () => {
    const text = draft.trim();
    if (!text || isGenerating) return;
    setDraft('');
    await onSubmitFreeInput?.(text);
  };

  const rerollLatest = async () => {
    if (!canReroll || isGenerating) return;
    await onRerollLatest?.();
  };

  return (
    <div data-eldred-overview="true" className="h-full w-full flex flex-col xl:flex-row gap-4 xl:gap-6 overflow-y-auto xl:overflow-hidden">
      <div data-eldred-overview-main="true" className="flex-1 min-h-[420px] xl:min-h-0 parchment-panel rounded-lg p-5 md:p-8 flex flex-col relative overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[#8b4513]/20 pb-4 mb-4">
          <ScrollText className="w-6 h-6 text-[#8b4513]" />
          <h2 className="text-xl font-bold text-[#5c3a21] tracking-widest">正文控制台</h2>
        </div>

        <div
          ref={narrativeScrollRef}
          onScroll={event => {
            overviewNarrativeScrollTop = event.currentTarget.scrollTop;
          }}
          className="flex-1 overflow-y-auto pr-2 md:pr-4 space-y-5 md:space-y-6 text-[#3A2C1D] leading-relaxed relative z-10 text-sm sm:text-base"
        >
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
            <div className="flex flex-row gap-2 sm:w-auto">
              <button
                onClick={rerollLatest}
                disabled={!canReroll || isGenerating}
                className="btn-rpg px-4 py-2.5 rounded text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                title="重新生成当前轮正文"
              >
                <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                重掷本轮
              </button>
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
      </div>

      <div data-eldred-overview-side="true" className="w-full xl:w-80 flex flex-col gap-4">
        <div className="glass-panel p-5 rounded-lg flex flex-col gap-3">
          <div className="text-fantasy-gold font-serif text-sm border-b border-fantasy-gold/20 pb-2">当前位置</div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-fantasy-blue/20 border border-fantasy-blue flex items-center justify-center text-fantasy-blue">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base md:text-lg text-amber-50 font-serif">{locationDisplay.fullName}</div>
              <div className="text-xs text-amber-100/75">{locationDisplay.detail || player.location.summary}</div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-lg flex flex-col gap-3 overview-state-panel">
          <div className="text-fantasy-gold font-serif text-sm border-b border-fantasy-gold/20 pb-2">入局状态</div>
          <div className="overview-state-row">
            <Clock className="w-4 h-4 text-fantasy-gold" />
            <span>时间</span>
            <strong>{timeText}</strong>
          </div>
          <InfoLine label="天气" value={weatherText} tone="blue" />
          <InfoLine label="风险" value={riskText} tone={riskText.includes('高') ? 'red' : 'gold'} />
          <InfoLine label="旅行" value={travelText} tone="green" />
          <InfoLine label="在场" value={presentCharacters} tone="gold" />
        </div>

        <div className="glass-panel p-5 rounded-lg min-h-48 xl:flex-1 flex flex-col gap-3">
          <div className="text-fantasy-gold font-serif text-sm border-b border-fantasy-gold/20 pb-2 flex items-center justify-between">
            <span>交互记录</span>
            <ShieldAlert className="w-4 h-4 text-fantasy-gold/50" />
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {sideRecords.length === 0 && (
              <div className="text-xs text-amber-100/55 leading-5">暂无记录</div>
            )}
            {sideRecords.map(record => (
              <div className={`overview-record overview-record-${record.tone}`} key={record.id}>
                <div className="overview-record-head">
                  <span>{record.label}</span>
                  <strong>{record.title}</strong>
                </div>
                <div className="overview-record-detail">{record.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoLine({ label, value, tone }: { label: string; value: string; tone: 'gold' | 'blue' | 'green' | 'red' }) {
  return (
    <div className={`overview-state-line overview-state-line-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
