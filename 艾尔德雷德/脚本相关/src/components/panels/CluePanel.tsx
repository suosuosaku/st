import { CluePhase } from '../../types';
import { useEffect, useMemo, useState } from 'react';
import { clueRecordFromCanonical, eldredCanonicalCluePhases, findCanonicalClueSlot } from '../../game/mainClues';

type CluePanelProps = {
  cluePhases: CluePhase[];
};

export function CluePanel({ cluePhases }: CluePanelProps) {
  const rows = useMemo(() => {
    const baseRows = eldredCanonicalCluePhases.map((phaseDef, index) => {
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
      unlockedCount,
      clues,
    };
    });
    return baseRows.map((row, index) => {
      const previousComplete = index === 0 || baseRows[index - 1].unlockedCount >= 3;
      return {
        ...row,
        phaseUnlocked: previousComplete,
        phaseComplete: row.unlockedCount >= 3,
        status: previousComplete ? row.status : '阶段锁定',
        progress: previousComplete ? row.progress : '0/3',
      };
    });
  }, [cluePhases]);
  const firstUnlocked = rows
    .flatMap(phase => phase.phaseUnlocked ? phase.clues.map(clue => ({ phase, clue })) : [])
    .find(item => item.clue.status !== '未解锁');
  const [selectedKey, setSelectedKey] = useState(firstUnlocked ? `${firstUnlocked.phase.id}:${firstUnlocked.clue.id}` : '');
  const collected = rows.reduce((sum, phase) => sum + phase.clues.filter(clue => clue.status !== '未解锁').length, 0);
  const selected = useMemo(() => {
    const [phaseId, clueId] = selectedKey.split(':');
    const phase = rows.find(item => item.id === phaseId);
    const clue = phase?.clues.find(item => item.id === clueId);
    return phase?.phaseUnlocked && clue?.status !== '未解锁' ? { phase, clue } : null;
  }, [rows, selectedKey]);

  useEffect(() => {
    if (selected) return;
    if (firstUnlocked) {
      setSelectedKey(`${firstUnlocked.phase.id}:${firstUnlocked.clue.id}`);
      return;
    }
    if (selectedKey) setSelectedKey('');
  }, [firstUnlocked, selected, selectedKey]);

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
              const active = phase.phaseUnlocked;
              return (
                <div className={`eldred-clue-page-row ${active ? 'is-active' : 'is-locked'} ${phase.phaseComplete ? 'is-complete' : ''}`} key={phase.id}>
                <div className="eldred-clue-page-index">{index + 1}</div>
                <div className="eldred-clue-page-main">
                  <div className="eldred-clue-page-head">
                    <span>{phase.phase || `阶段${index + 1}`}</span>
                    <strong>{phase.progress || `${phase.clues.length}/3`}</strong>
                  </div>
                  <div className="eldred-clue-page-chain">
                    {[0, 1, 2].map(slot => {
                      const clue = phase.clues[slot];
                      const unlocked = phase.phaseUnlocked && clue && clue.status !== '未解锁';
                      const selectedThis = selectedKey === `${phase.id}:${clue?.id}`;
                      return (
                        <button
                          className={`eldred-clue-page-token ${unlocked ? 'is-found' : ''} ${selectedThis ? 'is-selected' : ''}`}
                          key={`${phase.id}-${slot}`}
                          disabled={!unlocked}
                          onClick={() => unlocked && clue && setSelectedKey(`${phase.id}:${clue.id}`)}
                          type="button"
                        >
                          <span>{unlocked ? clue?.display : phase.phaseUnlocked ? `线索${slot + 1}` : '未开放'}</span>
                          <small>{unlocked ? clue?.location || clue?.carrier || '已解锁' : phase.phaseUnlocked ? '未收录' : '阶段锁定'}</small>
                        </button>
                      );
                    })}
                    <div className="eldred-clue-page-arrow">→</div>
                    <div className={`eldred-clue-page-event ${phase.phaseComplete ? 'is-found' : ''}`}>
                      <span>{phase.phaseComplete ? phase.eventName || `阶段${index + 1}事件` : `阶段${index + 1}事件`}</span>
                      <small>{phase.phaseComplete ? '已拼合' : phase.phaseUnlocked ? '锁定' : '阶段锁定'}</small>
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
              <div className="eldred-clue-detail-empty">收录证据后可查阅详情。</div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
