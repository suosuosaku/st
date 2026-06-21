import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Character, GameState, PlayerState, TabState } from './types';
import { CreationFlow } from './components/CreationFlow';
import { HUD } from './components/HUD';
import { OverviewPanel } from './components/panels/OverviewPanel';
import { MapPanel } from './components/panels/MapPanel';
import { PartyPanel } from './components/panels/PartyPanel';
import { QuestPanel } from './components/panels/QuestPanel';
import { CluePanel } from './components/panels/CluePanel';
import { CombatPanel } from './components/panels/CombatPanel';
import { NpcPanel } from './components/panels/NpcPanel';
import { EmptyPanel } from './components/panels/EmptyPanel';
import { SystemPanel } from './components/panels/SystemPanel';
import { InventoryPanel } from './components/panels/InventoryPanel';
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
  rerollLatestEldredNarration,
} from './game/eldredNarration';
import {
  dispatchEldredCombatCommand,
  EldredCombatCommand,
  persistRuntimeNpcs,
  persistRuntimePlayer,
} from './game/eldredActions';

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
    const onHostRuntimeEvent = (event: MessageEvent) => {
      const data = event.data || {};
      if (data.source !== 'EldredWelcomeLoader' || data.type !== 'runtime-event') return;
      refreshRuntime();
    };
    const onCustomRuntimeEvent = () => refreshRuntime();
    window.addEventListener('focus', onFocus);
    window.addEventListener('message', onHostRuntimeEvent);
    window.addEventListener('eldred-runtime-event', onCustomRuntimeEvent);
    const timer = window.setInterval(refreshRuntime, 5000);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('message', onHostRuntimeEvent);
      window.removeEventListener('eldred-runtime-event', onCustomRuntimeEvent);
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

  const submitCombatCommand = async (command: EldredCombatCommand) => {
    if (!playerState) return;
    setInteractionStatus('前端结算中');
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
      const result = dispatchEldredCombatCommand(sourceRuntime, command);
      setRuntime(result.runtime);
      setPlayerState(result.runtime.player || playerState);
      setInteractionStatus(result.notice);
      if (result.event) {
        const generatedRuntime = await generateEldredNarrationFromEvent(result.runtime, {
          ...result.event,
          player: result.runtime.player,
          party: result.runtime.player
            ? result.runtime.npcs.filter(npc => result.runtime.player?.partyMemberIds.includes(npc.id) || result.runtime.player?.partyMemberIds.includes(npc.name))
            : [],
          enemies: result.runtime.combat.enemyUnits,
        });
        setRuntime(generatedRuntime);
        setPlayerState(generatedRuntime.player || result.runtime.player || playerState);
        setInteractionStatus(generatedRuntime.narration.lastError ? generatedRuntime.narration.lastError : '战斗正文已同步');
      }
    } catch (error) {
      setInteractionStatus(error instanceof Error ? error.message : '战斗结算失败');
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

  const rerollCurrentNarration = async () => {
    if (!playerState || !runtime.narration.entries.length || isGeneratingNarration) return;
    setInteractionStatus('本轮重掷中');
    setIsGeneratingNarration(true);
    try {
      const sourceRuntime = {
        ...loadEldredRuntimeSave(),
        player: playerState,
        npcs: runtime.npcs,
        quests: runtime.quests,
        cluePhases: runtime.cluePhases,
        combat: runtime.combat,
        world: runtime.world,
        narration: runtime.narration,
        messages: runtime.messages,
      };
      const generatedRuntime = await rerollLatestEldredNarration(sourceRuntime);
      setRuntime(generatedRuntime);
      setPlayerState(generatedRuntime.player || playerState);
      setInteractionStatus(generatedRuntime.narration.lastError ? generatedRuntime.narration.lastError : '本轮已重掷');
    } catch (error) {
      setInteractionStatus(error instanceof Error ? error.message : '本轮重掷失败');
    } finally {
      setIsGeneratingNarration(false);
    }
  };

  const updatePlayerPreview = (updater: PlayerState | ((prev: PlayerState) => PlayerState)) => {
    setPlayerState(prev => {
      if (!prev) return prev;
      const nextPlayer = typeof updater === 'function' ? updater(prev) : updater;
      setRuntime(current => persistRuntimePlayer(current, nextPlayer));
      return nextPlayer;
    });
  };

  const updateNpcs = (updater: Character[] | ((prev: Character[]) => Character[])) => {
    setRuntime(prev => {
      const nextNpcs = typeof updater === 'function' ? updater(prev.npcs) : updater;
      return persistRuntimeNpcs(prev, nextNpcs);
    });
  };

  const renderActivePanel = () => {
    if (!playerState) return <EmptyPanel title="等待入局" message="尚未读取到角色变量" />;
    switch (activeTab) {
      case 'overview': return <OverviewPanel player={playerState} interactionStatus={interactionStatus} isGenerating={isGeneratingNarration} runtime={runtime} onSubmitFreeInput={submitFreeInput} onRerollLatest={rerollCurrentNarration} canReroll={runtime.narration.entries.length > 0} />;
      case 'map': return <MapPanel player={playerState} runtime={runtime} />;
      case 'party': return <PartyPanel player={playerState} onUpdatePlayer={updatePlayerPreview} onUpdateNpcs={updateNpcs} npcs={runtime.npcs} onSubmitEvent={submitRuntimeEvent} />;
      case 'npc': return <NpcPanel npcs={runtime.npcs} />;
      case 'quests': return <QuestPanel quests={runtime.quests} boardItems={runtime.world.dynamicBoard} onSubmitEvent={submitRuntimeEvent} />;
      case 'clues': return <CluePanel cluePhases={runtime.cluePhases} />;
      case 'combat': return <CombatPanel player={playerState} partyNpcs={runtime.npcs.filter(npc => playerState.partyMemberIds.includes(npc.id) || playerState.partyMemberIds.includes(npc.name))} enemyUnits={runtime.combat.enemyUnits} initialTurn={runtime.combat.turn} initialLogs={runtime.combat.logs} runtime={runtime} onSubmitEvent={submitRuntimeEvent} onSubmitCommand={submitCombatCommand} />;
      case 'inventory': return <InventoryPanel player={playerState} />;
      case 'system': return <SystemPanel runtime={runtime} player={playerState} />;
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
            data-eldred-playing="true"
            className="w-full h-full p-3 pt-16 lg:pl-24 lg:pr-8 lg:py-8 relative flex"
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

            <div data-eldred-main="true" className="flex-1 ml-0 lg:ml-4 relative min-w-0">
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
