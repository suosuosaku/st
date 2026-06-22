import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Loader2, MapPin, RefreshCw, Send, ShieldAlert, ScrollText } from 'lucide-react';
import { RichNarrative } from '../ImmersiveText';
import { PlayerState } from '../../types';
import { EldredRuntimeSave } from '../../game/eldredSave';
import { formatEldredLocation } from '../../game/locationFormat';

let overviewNarrativeScrollTop = 0;
const NARRATIVE_FONT_SCALE_KEY = 'eldred:narrative-font-scale';

const clampNarrativeFontScale = (value: number) => Math.min(1.3, Math.max(0.85, value));

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
  onSelectNarrationVariant,
  canReroll = false,
}: {
  player: PlayerState;
  interactionStatus: string;
  isGenerating: boolean;
  runtime?: EldredRuntimeSave;
  onSubmitFreeInput?: (text: string) => Promise<void>;
  onRerollLatest?: () => Promise<void>;
  onSelectNarrationVariant?: (entryId: string, variantIndex: number) => Promise<void>;
  canReroll?: boolean;
}) {
  const draftStorageKey = useMemo(
    () => `eldred:overview-draft:${runtime?.contextKey || player.name || 'default'}`,
    [player.name, runtime?.contextKey],
  );
  const [draft, setDraft] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(draftStorageKey) || '';
  });
  const [narrativeFontScale, setNarrativeFontScale] = useState(() => {
    if (typeof window === 'undefined') return 1;
    const saved = Number(window.localStorage.getItem(NARRATIVE_FONT_SCALE_KEY));
    return Number.isFinite(saved) ? clampNarrativeFontScale(saved) : 1;
  });
  const [currentNarrativePage, setCurrentNarrativePage] = useState(1);
  const [narrativePageInput, setNarrativePageInput] = useState('1');
  const narrativeScrollRef = useRef<HTMLDivElement>(null);
  const entries = runtime?.narration.entries || [];
  const world = runtime?.world;
  const locationDisplay = formatEldredLocation(world, player.location);
  const timeText = world?.currentTime || '待正文落定';
  const weatherText = world?.weather || player.location.weather || '未登记';
  const riskText = world?.risk || player.location.trouble || '未登记';
  const travelText = world?.travelState || '未移动';
  const presentCharacters = world?.presentCharacters?.length ? world.presentCharacters.join('、') : '未登记';
  const visibleEntries = useMemo(() => [...entries].reverse(), [entries]);
  const totalNarrativePages = visibleEntries.length;
  const normalizedNarrativePage = totalNarrativePages
    ? Math.min(totalNarrativePages, Math.max(1, currentNarrativePage))
    : 1;
  const currentNarrativeEntry = totalNarrativePages ? visibleEntries[normalizedNarrativePage - 1] : null;
  const currentVariants = currentNarrativeEntry?.variants || [];
  const activeVariantIndex = currentNarrativeEntry
    ? Math.min(Math.max(0, currentNarrativeEntry.activeVariantIndex || 0), Math.max(0, currentVariants.length - 1))
    : 0;
  const canSwitchVariant = Boolean(currentNarrativeEntry && currentVariants.length > 1 && !isGenerating);
  const latestEntry = entries[0];
  const latestQuest = runtime?.quests?.[0];
  const boardItems = runtime?.world.dynamicBoard?.slice(0, 6) || [];
  const latestRelationship = player.relationships[0];
  const latestReputation = player.reputations[0];
  const latestCombatLog = runtime?.combat.logs.at(-1);
  const narrativeFontPercent = Math.round(narrativeFontScale * 100);
  const memorySummary = runtime?.memory.summary.current.trim() || '';
  const memoryBatchCount = runtime?.memory.summary.batches.length || 0;
  const memoryPreview = memorySummary.replace(/\s+/g, ' ').slice(0, 160);
  const narrativeFontStyle = {
    '--eldred-narrative-font-size': `${(1.02 * narrativeFontScale).toFixed(3)}rem`,
    '--eldred-dialogue-font-size': `${(0.98 * narrativeFontScale).toFixed(3)}rem`,
    '--eldred-dialogue-name-size': `${(1.04 * narrativeFontScale).toFixed(3)}rem`,
    '--eldred-tag-font-size': `${(0.95 * narrativeFontScale).toFixed(3)}rem`,
    '--eldred-notice-font-size': `${(1 * narrativeFontScale).toFixed(3)}rem`,
  } as CSSProperties;
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

  useEffect(() => {
    const nextPage = totalNarrativePages || 1;
    setCurrentNarrativePage(nextPage);
    setNarrativePageInput(String(nextPage));
  }, [latestEntry?.id, totalNarrativePages]);

  useEffect(() => {
    const page = String(normalizedNarrativePage);
    setNarrativePageInput(page);
    const node = narrativeScrollRef.current;
    if (node) node.scrollTop = 0;
  }, [currentNarrativeEntry?.id, normalizedNarrativePage]);

  useEffect(() => {
    window.localStorage.setItem(NARRATIVE_FONT_SCALE_KEY, String(narrativeFontScale));
  }, [narrativeFontScale]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setDraft(window.localStorage.getItem(draftStorageKey) || '');
  }, [draftStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (draft) window.localStorage.setItem(draftStorageKey, draft);
    else window.localStorage.removeItem(draftStorageKey);
  }, [draft, draftStorageKey]);

  const submitDraft = async () => {
    const text = draft.trim();
    if (!text || isGenerating) return;
    await onSubmitFreeInput?.(text);
    setDraft('');
    if (typeof window !== 'undefined') window.localStorage.removeItem(draftStorageKey);
  };

  const rerollLatest = async () => {
    if (!canReroll || isGenerating) return;
    await onRerollLatest?.();
  };

  const jumpNarrativePage = (value: number) => {
    const page = totalNarrativePages ? Math.min(totalNarrativePages, Math.max(1, value)) : 1;
    setCurrentNarrativePage(page);
    setNarrativePageInput(String(page));
  };

  const commitNarrativePageInput = () => {
    const parsed = Number.parseInt(narrativePageInput, 10);
    jumpNarrativePage(Number.isFinite(parsed) ? parsed : normalizedNarrativePage);
  };

  const selectVariant = async (index: number) => {
    if (!currentNarrativeEntry || !onSelectNarrationVariant || !canSwitchVariant) return;
    const normalizedIndex = Math.min(Math.max(0, index), currentVariants.length - 1);
    if (normalizedIndex === activeVariantIndex) return;
    await onSelectNarrationVariant(currentNarrativeEntry.id, normalizedIndex);
  };

  return (
    <div data-eldred-overview="true" className="h-full w-full flex flex-col xl:flex-row gap-4 xl:gap-6 overflow-y-auto xl:overflow-hidden">
      <div data-eldred-overview-main="true" className="flex-1 min-h-[420px] xl:min-h-0 parchment-panel rounded-lg p-5 md:p-8 flex flex-col relative overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#8b4513]/20 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-[#8b4513]" />
            <h2 className="text-xl font-bold text-[#5c3a21] tracking-widest">正文控制台</h2>
          </div>
          <label className="ml-auto flex items-center gap-2 rounded border border-[#8b4513]/25 bg-white/30 px-2.5 py-1.5 text-xs font-bold text-[#6b3d1f]">
            <span>字号</span>
            <input
              aria-label="正文字号"
              type="range"
              min="0.85"
              max="1.3"
              step="0.05"
              value={narrativeFontScale}
              onChange={event => setNarrativeFontScale(clampNarrativeFontScale(Number(event.target.value)))}
              className="w-28 md:w-40 accent-[#8b4513]"
            />
            <span className="w-10 text-right font-mono text-[11px]">{narrativeFontPercent}%</span>
          </label>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded border border-[#8b4513]/20 bg-white/25 px-3 py-2 text-xs font-bold text-[#6b3d1f]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => jumpNarrativePage(normalizedNarrativePage - 1)}
              disabled={!totalNarrativePages || normalizedNarrativePage <= 1}
              className="rounded border border-[#8b4513]/30 bg-[#5c3a21]/10 px-2.5 py-1 disabled:opacity-35"
            >
              上一页
            </button>
            <button
              type="button"
              onClick={() => jumpNarrativePage(normalizedNarrativePage + 1)}
              disabled={!totalNarrativePages || normalizedNarrativePage >= totalNarrativePages}
              className="rounded border border-[#8b4513]/30 bg-[#5c3a21]/10 px-2.5 py-1 disabled:opacity-35"
            >
              下一页
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span>第</span>
            <input
              aria-label="正文页码"
              value={narrativePageInput}
              onChange={event => setNarrativePageInput(event.target.value.replace(/[^\d]/g, '').slice(0, 3))}
              onBlur={commitNarrativePageInput}
              onKeyDown={event => {
                if (event.key === 'Enter') commitNarrativePageInput();
              }}
              className="h-7 w-14 rounded border border-[#8b4513]/30 bg-white/45 px-2 text-center font-mono text-[#3A2C1D] outline-none focus:border-[#8b4513]"
            />
            <span>页 / 共 {totalNarrativePages || 1} 页</span>
          </div>
          {currentNarrativeEntry && currentVariants.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void selectVariant(activeVariantIndex - 1)}
                disabled={!canSwitchVariant || activeVariantIndex <= 0}
                className="rounded border border-[#8b4513]/30 bg-[#5c3a21]/10 px-2 py-1 disabled:opacity-35"
                title="上一版备选"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span>备选 {activeVariantIndex + 1}/{currentVariants.length}</span>
              <button
                type="button"
                onClick={() => void selectVariant(activeVariantIndex + 1)}
                disabled={!canSwitchVariant || activeVariantIndex >= currentVariants.length - 1}
                className="rounded border border-[#8b4513]/30 bg-[#5c3a21]/10 px-2 py-1 disabled:opacity-35"
                title="下一版备选"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        <div
          ref={narrativeScrollRef}
          onScroll={event => {
            overviewNarrativeScrollTop = event.currentTarget.scrollTop;
          }}
          style={narrativeFontStyle}
          className="eldred-narrative-scroll flex-1 overflow-y-auto pr-1 md:pr-3 space-y-5 md:space-y-7 text-[#3A2C1D] relative z-10"
        >
          {!currentNarrativeEntry && (
            <div className="rounded border border-[#8b4513]/25 bg-[#f8edd4]/55 px-4 py-5 text-sm text-[#6b4b2e]">
              等待第一幕生成。
            </div>
          )}
          {currentNarrativeEntry && (
            <article key={currentNarrativeEntry.id} className="eldred-story-card">
              <div className="eldred-story-head">
                <div className="eldred-story-title">{currentNarrativeEntry.title}</div>
                <div className="eldred-story-time">{new Date(currentNarrativeEntry.createdAt).toLocaleString()}</div>
              </div>
              <div className="eldred-story-body">
                <RichNarrative text={currentNarrativeEntry.text || '正文未返回。'} />
              </div>
            </article>
          )}
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

        <div className="glass-panel p-5 rounded-lg flex flex-col gap-3">
          <div className="text-fantasy-gold font-serif text-sm border-b border-fantasy-gold/20 pb-2">内置札记</div>
          <div className="overview-state-row">
            <ScrollText className="w-4 h-4 text-fantasy-gold" />
            <span>小结</span>
            <strong>{memoryBatchCount}批</strong>
          </div>
          <div className="text-xs leading-5 text-amber-100/70">
            {memoryPreview || '尚未达到自动总结阈值'}
          </div>
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
