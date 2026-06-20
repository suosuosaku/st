import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { GameState, PlayerState, TabState } from './types';
import { CreationFlow } from './components/CreationFlow';
import { HUD } from './components/HUD';
import { OverviewPanel } from './components/panels/OverviewPanel';
import { MapPanel } from './components/panels/MapPanel';
import { PartyPanel } from './components/panels/PartyPanel';
import { QuestPanel } from './components/panels/QuestPanel';
import { CombatPanel } from './components/panels/CombatPanel';
import { NpcPanel } from './components/panels/NpcPanel';
import { EmptyPanel } from './components/panels/EmptyPanel';
import {
  EldredRuntimeSave,
  loadEldredRuntimeSave,
  persistEldredRuntimeCache,
  runtimeFromCreatedPlayer,
} from './game/eldredSave';
import { EldredFrontendEventInput } from './game/eldredEvents';
import {
  generateEldredNarrationFromEvent,
  generateEldredNarrationFromInput,
  generateEldredNarrationFromOpening,
} from './game/eldredNarration';

export default function App() {
  const [initialRuntime] = useState<EldredRuntimeSave>(() => loadEldredRuntimeSave());
  const [runtime, setRuntime] = useState<EldredRuntimeSave>(initialRuntime);
  const [gameState, setGameState] = useState<GameState>(() => initialRuntime.player ? 'playing' : 'creation');
  const [playerState, setPlayerState] = useState<PlayerState | null>(() => initialRuntime.player);
  const [activeTab, setActiveTab] = useState<TabState>('overview');
  const [hudExpanded, setHudExpanded] = useState(true);
  const [interactionStatus, setInteractionStatus] = useState('待生成');
  const [isGeneratingNarration, setIsGeneratingNarration] = useState(false);

  const refreshRuntime = useCallback(() => {
    const nextRuntime = loadEldredRuntimeSave();
    setRuntime(nextRuntime);
    if (nextRuntime.player) {
      setPlayerState(nextRuntime.player);
      setGameState('playing');
    }
  }, []);

  useEffect(() => {
    refreshRuntime();
    const onFocus = () => refreshRuntime();
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(refreshRuntime, 5000);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(timer);
    };
  }, [refreshRuntime]);

  const handleCreationComplete = (state: PlayerState) => {
    setPlayerState(state);
    setGameState('playing');
    const nextRuntime = persistEldredRuntimeCache(runtimeFromCreatedPlayer(state));
    setRuntime(nextRuntime);
    setInteractionStatus('第一幕生成中');
    setIsGeneratingNarration(true);
    void generateEldredNarrationFromOpening(nextRuntime, state).then(generatedRuntime => {
      setRuntime(generatedRuntime);
      setPlayerState(generatedRuntime.player || state);
      setInteractionStatus(generatedRuntime.narration.lastError ? generatedRuntime.narration.lastError : '第一幕已生成');
    }).catch(error => {
      console.warn('[艾尔德雷德] 第一幕生成失败', error);
      setInteractionStatus(error instanceof Error ? error.message : '第一幕生成失败');
    }).finally(() => setIsGeneratingNarration(false));
  };

  const submitRuntimeEvent = async (event: Omit<EldredFrontendEventInput, 'player' | 'party' | 'enemies'>) => {
    if (!playerState) return;
    setInteractionStatus('正文生成中');
    setIsGeneratingNarration(true);
    try {
      const sourceRuntime = {
        ...loadEldredRuntimeSave(),
        player: playerState,
        npcs: runtime.npcs,
        quests: runtime.quests,
        combat: runtime.combat,
        world: runtime.world,
      };
      const generatedRuntime = await generateEldredNarrationFromEvent(sourceRuntime, {
        ...event,
        player: playerState,
        party: runtime.npcs.filter(npc => playerState?.partyMemberIds.includes(npc.id) || playerState?.partyMemberIds.includes(npc.name)),
        enemies: runtime.combat.enemyUnits,
      });
      setRuntime(generatedRuntime);
      setPlayerState(generatedRuntime.player || playerState);
      setInteractionStatus(generatedRuntime.narration.lastError ? generatedRuntime.narration.lastError : '正文已生成');
    } catch (error) {
      setInteractionStatus(error instanceof Error ? error.message : '正文生成失败');
    } finally {
      setIsGeneratingNarration(false);
    }
  };

  const submitFreeInput = async (text: string) => {
    if (!playerState || !text.trim()) return;
    setInteractionStatus('正文生成中');
    setIsGeneratingNarration(true);
    try {
      const sourceRuntime = {
        ...loadEldredRuntimeSave(),
        player: playerState,
        npcs: runtime.npcs,
        quests: runtime.quests,
        combat: runtime.combat,
        world: runtime.world,
      };
      const generatedRuntime = await generateEldredNarrationFromInput(sourceRuntime, text, 'free');
      setRuntime(generatedRuntime);
      setPlayerState(generatedRuntime.player || playerState);
      setInteractionStatus(generatedRuntime.narration.lastError ? generatedRuntime.narration.lastError : '正文已生成');
    } catch (error) {
      setInteractionStatus(error instanceof Error ? error.message : '正文生成失败');
    } finally {
      setIsGeneratingNarration(false);
    }
  };

  const updatePlayerPreview = (updater: PlayerState | ((prev: PlayerState) => PlayerState)) => {
    setPlayerState(prev => {
      if (!prev) return prev;
      return typeof updater === 'function' ? updater(prev) : updater;
    });
  };

  const renderActivePanel = () => {
    if (!playerState) return <EmptyPanel title="等待入局" message="尚未读取到角色变量" />;
    switch (activeTab) {
      case 'overview': return <OverviewPanel player={playerState} interactionStatus={interactionStatus} isGenerating={isGeneratingNarration} runtime={runtime} onSubmitFreeInput={submitFreeInput} />;
      case 'map': return <MapPanel player={playerState} />;
      case 'party': return <PartyPanel player={playerState} onUpdatePlayer={updatePlayerPreview} npcs={runtime.npcs} onSubmitEvent={submitRuntimeEvent} />;
      case 'npc': return <NpcPanel npcs={runtime.npcs} />;
      case 'quests': return <QuestPanel quests={runtime.quests} onSubmitEvent={submitRuntimeEvent} />;
      case 'combat': return <CombatPanel player={playerState} partyNpcs={runtime.npcs.filter(npc => playerState.partyMemberIds.includes(npc.id) || playerState.partyMemberIds.includes(npc.name))} enemyUnits={runtime.combat.enemyUnits} initialTurn={runtime.combat.turn} initialLogs={runtime.combat.logs} onSubmitEvent={submitRuntimeEvent} />;
      case 'inventory': return <EmptyPanel title="行囊与物资" message={playerState.inventory.join('、')} />;
      case 'system': return <EmptyPanel title="旅程札记" message={`${playerState.location.name} / ${playerState.location.landmarkName}`} />;
      default: return <EmptyPanel title="未知区域" />;
    }
  };

  return (
    <div className="w-screen h-screen overflow-hidden flex font-sans text-gray-200">
      <AnimatePresence mode="wait">
        {gameState === 'creation' ? (
          <motion.div
            key="creation"
            className="w-full h-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.6 }}
          >
            <CreationFlow onComplete={handleCreationComplete} />
          </motion.div>
        ) : (
          <motion.div
            key="playing"
            className="w-full h-full p-3 pb-20 sm:pl-20 sm:pr-4 sm:py-4 lg:pl-24 lg:pr-8 lg:py-8 relative flex"
            initial={{ opacity: 0, backdropFilter: 'blur(10px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(0px)' }}
            transition={{ duration: 1.0, delay: 0.2 }}
          >
            <HUD
              activeTab={activeTab}
              onTabChange={setActiveTab}
              isExpanded={hudExpanded}
              onToggleExpand={() => setHudExpanded(!hudExpanded)}
            />

            <div className="flex-1 ml-0 sm:ml-4 relative min-w-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="w-full h-full"
                >
                  {renderActivePanel()}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
