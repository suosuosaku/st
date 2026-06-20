import { SearchCheck } from 'lucide-react';
import { CluePhase } from '../../types';

type CluePanelProps = {
  cluePhases: CluePhase[];
};

export function CluePanel({ cluePhases }: CluePanelProps) {
  const collected = cluePhases.reduce((sum, phase) => sum + phase.clues.length, 0);

  return (
    <div className="h-full w-full overflow-y-auto p-2 md:p-0">
      <div className="mx-auto grid max-w-6xl gap-5 xl:grid-cols-[18rem_1fr]">
        <div className="pixel-vertical-card w-full min-h-[22rem]">
          <div className="pixel-card-crown" />
          <div className="pixel-card-body">
            <div className="text-center">
              <div className="font-serif text-lg tracking-wider text-fantasy-gold">线索册</div>
              <div className="mt-4 text-4xl font-serif text-amber-50">{collected}</div>
              <div className="mt-2 text-xs text-amber-100/75">已登记线索</div>
            </div>
          </div>
          <div className="pixel-card-gems" aria-hidden="true"><span /><span /><span /></div>
        </div>

        <section className="glass-panel rounded-lg border-fantasy-gold/40 p-4 md:p-6">
          <div className="mb-5 flex items-center justify-between gap-3 border-b border-fantasy-gold/20 pb-4">
            <div>
              <h2 className="font-serif text-xl text-fantasy-gold">主线阶段线索</h2>
              <div className="mt-1 text-xs text-amber-100/70">三条线索汇成一个阶段事件</div>
            </div>
            <SearchCheck className="h-5 w-5 text-fantasy-gold/80" />
          </div>

          <div className="eldred-clue-page">
            {cluePhases.map((phase, index) => {
              const active = phase.clues.length > 0;
              return (
                <article className={`eldred-clue-page-row ${active ? 'is-active' : ''}`} key={phase.id}>
                  <div className="eldred-clue-page-index">{index + 1}</div>
                  <div className="eldred-clue-page-main">
                    <div className="eldred-clue-page-head">
                      <span>{phase.phase}</span>
                      <strong>{phase.progress}</strong>
                    </div>
                    <div className="eldred-clue-page-chain">
                      {[0, 1, 2].map(slot => {
                        const clue = phase.clues[slot];
                        return (
                          <div className={`eldred-clue-page-token ${clue ? 'is-found' : ''}`} key={`${phase.id}-${slot}`}>
                            <span>{clue?.display || `线索${slot + 1}`}</span>
                            {clue?.location && <small>{clue.location}</small>}
                          </div>
                        );
                      })}
                      <div className="eldred-clue-page-arrow">→</div>
                      <div className="eldred-clue-page-event">
                        <span>{phase.eventName}</span>
                        <small>{phase.status}</small>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
