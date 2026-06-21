import { CluePhase } from '../../types';
import { useEffect, useMemo, useState } from 'react';
import { clueRecordFromCanonical, eldredCanonicalCluePhases, findCanonicalClueSlot } from '../../game/mainClues';

type CluePanelProps = {
  cluePhases: CluePhase[];
};

export function CluePanel({ cluePhases }: CluePanelProps) {
  const rows = useMemo(() => eldredCanonicalCluePhases.map((phaseDef, index) => {
    const runtimePhase = cluePhases.find(phase =>
      phase.id === phaseDef.id
      || phase.phase === phaseDef.phase
      || phaseDef.aliases.includes(phase.phase),
    );
    const runtimeClues = runtimePhase?.clues || [];
    const clues = phaseDef.clues.map((clue, slot) => {
      const runtimeClue = runtimeClues.find(item =>
        item.id === clue.id
        || findCanonicalClueSlot(phaseDef.phase, item.display)?.clue.id === clue.id
        || findCanonicalClueSlot(phaseDef.phase, item.detail)?.clue.id === clue.id,
      );
      return clueRecordFromCanonical(clue, slot, {
        status: runtimeClue?.status || '未解锁',
        location: runtimeClue?.location || clue.location,
        carrier: runtimeClue?.carrier || clue.carrier,
        detail: runtimeClue?.status && runtimeClue.status !== '未解锁'
          ? runtimeClue.detail || clue.detail
          : clue.detail,
      });
    });
    const unlockedCount = clues.filter(clue => clue.status !== '未解锁').length;
    return {
      id: phaseDef.id || `phase-${index + 1}`,
      phase: phaseDef.phase,
      eventName: phaseDef.eventName,
      status: runtimePhase?.status || (unlockedCount > 0 ? '记录中' : '锁定'),
      progress: runtimePhase?.progress || `${unlockedCount}/3`,
      buttonText: phaseDef.eventDetail,
      clues,
    };
  }), [cluePhases]);
  const firstUnlocked = rows.flatMap(phase => phase.clues.map(clue => ({ phase, clue }))).find(item => item.clue.status !== '未解锁');
  const [selectedKey, setSelectedKey] = useState(firstUnlocked ? `${firstUnlocked.phase.id}:${firstUnlocked.clue.id}` : '');
  const collected = rows.reduce((sum, phase) => sum + phase.clues.filter(clue => clue.status !== '未解锁').length, 0);
  const selected = useMemo(() => {
    const [phaseId, clueId] = selectedKey.split(':');
    const phase = rows.find(item => item.id === phaseId);
    const clue = phase?.clues.find(item => item.id === clueId);
    return phase && clue ? { phase, clue } : null;
  }, [rows, selectedKey]);

  useEffect(() => {
    if (selectedKey) return;
    if (firstUnlocked) setSelectedKey(`${firstUnlocked.phase.id}:${firstUnlocked.clue.id}`);
  }, [firstUnlocked, selectedKey]);

  return (
    <div className="h-full w-full overflow-y-auto">
      <section className="glass-panel rounded-lg border-fantasy-gold/40 p-4 md:p-6">
        <div className="mb-5 flex flex-col gap-2 border-b border-fantasy-gold/20 pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-serif text-2xl text-fantasy-gold">线索收集</h2>
            <div className="mt-1 text-sm text-amber-100/80">七个阶段，每个阶段由三条证据拼合。</div>
          </div>
          <div className="rounded border border-white/10 bg-black/25 px-4 py-2 text-sm text-gray-200">
            已解锁 <span className="font-mono text-fantasy-gold">{collected}</span> / 21
          </div>
        </div>

        <div className="eldred-clue-page-layout">
          <div className="eldred-clue-page">
            {rows.map((phase, index) => {
              const active = phase.clues.some(clue => clue.status !== '未解锁');
              return (
                <div className={`eldred-clue-page-row ${active ? 'is-active' : ''}`} key={phase.id}>
                <div className="eldred-clue-page-index">{index + 1}</div>
                <div className="eldred-clue-page-main">
                  <div className="eldred-clue-page-head">
                    <span>{phase.phase || `阶段${index + 1}`}</span>
                    <strong>{phase.progress || `${phase.clues.length}/3`}</strong>
                  </div>
                  <div className="eldred-clue-page-chain">
                    {[0, 1, 2].map(slot => {
                      const clue = phase.clues[slot];
                      const unlocked = clue && clue.status !== '未解锁';
                      const selectedThis = selectedKey === `${phase.id}:${clue?.id}`;
                      return (
                        <button
                          className={`eldred-clue-page-token ${unlocked ? 'is-found' : ''} ${selectedThis ? 'is-selected' : ''}`}
                          key={`${phase.id}-${slot}`}
                          onClick={() => clue && setSelectedKey(`${phase.id}:${clue.id}`)}
                          type="button"
                        >
                          <span>{clue?.display || `线索${slot + 1}`}</span>
                          <small>{unlocked ? clue?.location || clue?.carrier || '已解锁' : '未解锁'}</small>
                        </button>
                      );
                    })}
                    <div className="eldred-clue-page-arrow">→</div>
                    <div className={`eldred-clue-page-event ${phase.status !== '锁定' ? 'is-found' : ''}`}>
                      <span>{phase.eventName || `阶段${index + 1}事件`}</span>
                      <small>{phase.status || '锁定'}</small>
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
          </div>

          <aside className="eldred-clue-detail-panel">
            <div className="eldred-clue-detail-kicker">证据详情</div>
            {selected ? (
              <>
                <h3>{selected.clue.display}</h3>
                <div className="eldred-clue-detail-meta">
                  <span>{selected.phase.phase}</span>
                  <span>{selected.clue.status}</span>
                </div>
                <dl>
                  <div><dt>地点</dt><dd>{selected.clue.location || '未解锁'}</dd></div>
                  <div><dt>载体</dt><dd>{selected.clue.carrier || '未解锁'}</dd></div>
                  <div><dt>详情</dt><dd>{selected.clue.status === '未解锁' ? '证据尚未收录。' : selected.clue.detail}</dd></div>
                  <div><dt>阶段事件</dt><dd>{selected.phase.eventName}</dd></div>
                </dl>
              </>
            ) : (
              <div className="eldred-clue-detail-empty">点击任意线索查看固定证据详情。</div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
