import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { CalendarDays, ChevronRight, History, Sparkles } from 'lucide-react';
import { EldredRuntimeSave } from '../../game/eldredSave';
import {
  EldredFortuneResult,
  canTriggerDailyEncounter,
  rarityLabel,
} from '../../game/eldredFortune';
import { FortuneLog } from '../../types';

type FortunePanelProps = {
  runtime: EldredRuntimeSave;
  isBusy?: boolean;
  onDrawCard?: (slot: number) => Promise<EldredFortuneResult | null>;
  onTriggerDaily?: () => Promise<EldredFortuneResult | null>;
};

type FortunePage = 'encounter' | 'cards';

const rarityClass = (rarity: FortuneLog['rarity']) => {
  if (rarity === 'epic') return 'text-fuchsia-200 border-fuchsia-300/50 bg-fuchsia-400/10';
  if (rarity === 'rare') return 'text-amber-200 border-amber-300/50 bg-amber-400/10';
  if (rarity === 'uncommon') return 'text-sky-200 border-sky-300/50 bg-sky-400/10';
  return 'text-gray-200 border-white/15 bg-white/5';
};

const kindLabel = (kind: FortuneLog['kind']) => {
  if (kind === 'item') return '物品';
  if (kind === 'experience') return '经验';
  if (kind === 'attribute') return '加点';
  if (kind === 'skill') return '技能';
  if (kind === 'reputation') return '声望';
  if (kind === 'favor') return '好感';
  if (kind === 'effect') return '奇遇';
  return '邂逅';
};

export function FortunePanel({ runtime, isBusy = false, onDrawCard, onTriggerDaily }: FortunePanelProps) {
  const [page, setPage] = useState<FortunePage>('cards');
  const [revealedSlot, setRevealedSlot] = useState<number | null>(null);
  const [revealedLog, setRevealedLog] = useState<FortuneLog | null>(null);
  const [localBusy, setLocalBusy] = useState(false);
  const fortune = runtime.fortune;
  const canDraw = fortune.flipCount > 0 && !isBusy && !localBusy;
  const canDaily = canTriggerDailyEncounter(fortune) && !isBusy && !localBusy;

  useEffect(() => {
    if (revealedSlot === null) return undefined;
    const timer = window.setTimeout(() => {
      setRevealedSlot(null);
      setRevealedLog(null);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [revealedSlot]);

  const drawCard = async (slot: number) => {
    if (!canDraw) return;
    setLocalBusy(true);
    try {
      const result = await onDrawCard?.(slot);
      if (result?.log) {
        setRevealedSlot(slot);
        setRevealedLog(result.log);
      }
    } finally {
      setLocalBusy(false);
    }
  };

  const triggerDaily = async () => {
    if (!canDaily) return;
    setLocalBusy(true);
    try {
      await onTriggerDaily?.();
    } finally {
      setLocalBusy(false);
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="grid h-full gap-4 xl:grid-cols-[minmax(0,1.45fr)_24rem]">
        <section className="glass-panel rounded-xl p-5 md:p-6 min-h-[34rem] flex flex-col">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-fantasy-gold/20 pb-3">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-fantasy-gold/80" />
              <h2 className="font-serif text-xl text-fantasy-gold">奇遇与翻牌</h2>
            </div>
            <div className="flex rounded-none border border-fantasy-gold/30 bg-black/30 p-1 text-xs">
              <button
                type="button"
                onClick={() => setPage('cards')}
                className={`px-3 py-1.5 ${page === 'cards' ? 'bg-fantasy-gold/20 text-fantasy-gold' : 'text-gray-400 hover:text-gray-200'}`}
              >
                翻牌
              </button>
              <button
                type="button"
                onClick={() => setPage('encounter')}
                className={`px-3 py-1.5 ${page === 'encounter' ? 'bg-fantasy-gold/20 text-fantasy-gold' : 'text-gray-400 hover:text-gray-200'}`}
              >
                奇遇
              </button>
            </div>
          </div>

          {page === 'cards' ? (
            <div className="flex flex-1 flex-col gap-6">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="pixel-data-tile p-4">
                  <div className="text-xs tracking-[0.18em] text-gray-500">可用次数</div>
                  <div className="mt-2 font-serif text-3xl text-fantasy-gold">{fortune.flipCount}</div>
                </div>
                <div className="pixel-data-tile p-4 md:col-span-2">
                  <div className="text-xs tracking-[0.18em] text-gray-500">当前规则</div>
                  <div className="mt-2 text-sm leading-relaxed text-gray-200">
                    每次点击消耗1次翻牌次数。普通奖励即时写入变量；邂逅类结果会自动生成正文。
                  </div>
                </div>
              </div>

              <div className="grid flex-1 content-center gap-4 md:grid-cols-3">
                {[1, 2, 3].map(slot => {
                  const isRevealed = revealedSlot === slot && revealedLog;
                  return (
                    <motion.button
                      key={slot}
                      type="button"
                      disabled={!canDraw}
                      onClick={() => drawCard(slot)}
                      className={`relative min-h-[18rem] border-[3px] p-4 text-left transition-all ${canDraw ? 'cursor-pointer hover:-translate-y-1 hover:border-fantasy-gold' : 'cursor-not-allowed opacity-55'} ${isRevealed ? 'border-fantasy-gold bg-fantasy-gold/10' : 'border-[#8a672b] bg-black/35'}`}
                      style={{
                        boxShadow: 'inset 0 0 0 1px rgba(255,226,128,.12), 5px 5px 0 rgba(0,0,0,.35)',
                        imageRendering: 'pixelated',
                      }}
                      animate={{ rotateY: isRevealed ? 180 : 0 }}
                      transition={{ duration: 0.32 }}
                    >
                      <div className="absolute inset-2 border border-fantasy-gold/20 pointer-events-none" />
                      <div className="flex h-full min-h-[15.5rem] flex-col items-center justify-center gap-4 text-center" style={{ transform: isRevealed ? 'rotateY(180deg)' : undefined }}>
                        {isRevealed ? (
                          <>
                            <span className={`border px-2 py-1 text-xs ${rarityClass(revealedLog.rarity)}`}>{rarityLabel(revealedLog.rarity)} / {kindLabel(revealedLog.kind)}</span>
                            <div className="font-serif text-2xl leading-snug text-fantasy-gold">{revealedLog.title}</div>
                            <div className="text-sm leading-relaxed text-gray-200">{revealedLog.detail}</div>
                          </>
                        ) : (
                          <>
                            <div className="pixel-token-icon text-lg">?</div>
                            <div className="font-serif text-xl text-fantasy-gold">命运牌 {slot}</div>
                            <div className="text-xs tracking-[0.16em] text-gray-500">FACE DOWN</div>
                          </>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-5">
              <div className="pixel-data-tile flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2 font-serif text-lg text-fantasy-gold">
                    <CalendarDays className="h-5 w-5" />
                    每日奇遇
                  </div>
                  <div className="mt-2 text-sm leading-relaxed text-gray-300">
                    每日可触发一次。普通奇遇会写入常驻效果；邂逅类奇遇会自动进入正文。
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!canDaily}
                  onClick={triggerDaily}
                  className="btn-rpg px-5 py-2 text-sm"
                >
                  {fortune.dailyKey ? '今日已触发' : '触发今日奇遇'}
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {fortune.activeEncounters.length === 0 ? (
                  <div className="pixel-data-tile p-5 text-sm text-gray-500 md:col-span-2">暂无常驻奇遇效果</div>
                ) : fortune.activeEncounters.map(effect => (
                  <div key={effect.id} className="pixel-data-tile p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="font-serif text-base text-fantasy-gold">{effect.title}</div>
                      <span className="text-[11px] text-gray-500">{effect.source}</span>
                    </div>
                    <div className="text-sm leading-relaxed text-gray-200">{effect.detail}</div>
                    {effect.expiresAt && <div className="mt-3 border-t border-white/10 pt-2 text-xs text-gray-500">{effect.expiresAt}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <aside className="glass-panel rounded-xl p-5 md:p-6 min-h-[24rem] flex flex-col">
          <div className="mb-4 flex items-center gap-2 border-b border-fantasy-gold/20 pb-3">
            <History className="h-5 w-5 text-fantasy-gold/80" />
            <h3 className="font-serif text-lg text-fantasy-gold">抽取记录</h3>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            {fortune.logs.length === 0 ? (
              <div className="rounded-none border border-white/10 bg-black/25 p-4 text-sm text-gray-500">暂无记录</div>
            ) : fortune.logs.map(log => (
              <div key={log.id} className="rounded-none border border-white/10 bg-black/25 p-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="font-serif text-sm text-gray-100">{log.title}</div>
                  <span className={`shrink-0 border px-2 py-0.5 text-[10px] ${rarityClass(log.rarity)}`}>{rarityLabel(log.rarity)}</span>
                </div>
                <div className="text-xs leading-relaxed text-gray-400">{log.detail}</div>
                <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2 text-[11px] text-gray-500">
                  <span>{kindLabel(log.kind)}{log.slot ? ` / 第${log.slot}张` : ''}</span>
                  <span className="inline-flex items-center gap-1">
                    {log.synced ? '已写入变量' : '本地缓存'}
                    <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
