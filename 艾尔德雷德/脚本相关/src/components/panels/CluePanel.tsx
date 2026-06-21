import { CluePhase } from '../../types';

type CluePanelProps = {
  cluePhases: CluePhase[];
};

export function CluePanel({ cluePhases }: CluePanelProps) {
  const collected = cluePhases.reduce((sum, phase) => sum + phase.clues.length, 0);
  const rows = Array.from({ length: 7 }, (_, index) => cluePhases[index] || {
    id: `phase-${index + 1}`,
    phase: `阶段${index + 1}`,
    eventName: `阶段${index + 1}事件`,
    status: '锁定',
    progress: '0/3',
    buttonText: '待解锁',
    clues: [],
  });

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

        <div className="eldred-clue-page">
          {rows.map((phase, index) => {
            const active = phase.clues.length > 0;
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
                      return (
                        <div className={`eldred-clue-page-token ${clue ? 'is-found' : ''}`} key={`${phase.id}-${slot}`}>
                          <span>{clue?.display || `线索${slot + 1}`}</span>
                          <small>{clue?.location || clue?.carrier || (clue ? '已收录' : '未解锁')}</small>
                        </div>
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
      </section>
    </div>
  );
}
