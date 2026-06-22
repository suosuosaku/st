import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Character, DynamicBoardItem, GameState, PlayerState, TabState } from './types';
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
import { FortunePanel } from './components/panels/FortunePanel';
import {
  EldredRuntimeSave,
  loadEldredRuntimeSave,
  persistEldredRuntimeCache,
  runtimeFromCreatedPlayer,
} from './game/eldredSave';
import { EldredFrontendEventInput } from './game/eldredEvents';
import {
  discardEldredInventoryItem,
  dismissEldredBoardItem,
  generateEldredNarrationFromEvent,
  generateEldredNarrationFromInput,
  generateEldredNarrationFromOpening,
  rerollLatestEldredNarration,
  selectEldredNarrationVariant,
} from './game/eldredNarration';
import {
  dispatchEldredD20Check,
  persistRuntimeNpcs,
  persistRuntimePlayer,
} from './game/eldredActions';
import {
  loadEldredAsyncVariableApiSettings,
  processEldredVariablesWithAsyncApi,
  saveEldredAsyncVariableApiSettings,
} from './game/asyncVariableApi';
import {
  drawEldredFortuneCard,
  triggerEldredDailyEncounter,
} from './game/eldredFortune';

type EldredTheme = 'dark' | 'light';

const loadEldredTheme = (): EldredTheme => {
  if (typeof window === 'undefined') return 'dark';
  return window.localStorage.getItem('eldred:ui-theme') === 'light' ? 'light' : 'dark';
};

export default function App() {
  const [initialRuntime] = useState<EldredRuntimeSave>(() => loadEldredRuntimeSave());
  const [runtime, setRuntime] = useState<EldredRuntimeSave>(initialRuntime);
  const [gameState, setGameState] = useState<GameState>(() => initialRuntime.player ? 'playing' : 'creation');
  const [playerState, setPlayerState] = useState<PlayerState | null>(() => initialRuntime.player);
  const [activeTab, setActiveTab] = useState<TabState>('overview');
  const [hudExpanded, setHudExpanded] = useState(true);
  const [eldredTheme, setEldredTheme] = useState<EldredTheme>(loadEldredTheme);
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

  const applyVariableApiAfterNarration = useCallback(async (generatedRuntime: EldredRuntimeSave) => {
    const settings = loadEldredAsyncVariableApiSettings();
    if (!settings.enabled) return { runtime: generatedRuntime, message: '' };
    if (!settings.apiurl.trim() || !settings.model.trim()) {
      return { runtime: generatedRuntime, message: '变量API已启用但缺少接口地址或模型' };
    }
    setInteractionStatus('变量API写回中');
    try {
      const result = await processEldredVariablesWithAsyncApi(generatedRuntime, settings);
      saveEldredAsyncVariableApiSettings({
        ...settings,
        lastRunAt: new Date().toISOString(),
        lastStatus: result.message,
      });
      return { runtime: result.runtime, message: result.message };
    } catch (error) {
      const message = error instanceof Error ? error.message : '变量API写回失败';
      console.warn('[艾尔德雷德] 变量API写回失败', error);
      saveEldredAsyncVariableApiSettings({ ...settings, lastStatus: message });
      return { runtime: generatedRuntime, message };
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

  useEffect(() => {
    document.documentElement.dataset.eldredTheme = eldredTheme;
    window.localStorage.setItem('eldred:ui-theme', eldredTheme);
  }, [eldredTheme]);

  const handleCreationComplete = (state: PlayerState) => {
    setPlayerState(state);
    setGameState('playing');
    const nextRuntime = persistEldredRuntimeCache(runtimeFromCreatedPlayer(state));
    setRuntime(nextRuntime);
    setInteractionStatus('第一幕生成中');
    setIsGeneratingNarration(true);
    void generateEldredNarrationFromOpening(nextRuntime, state).then(async generatedRuntime => {
      const processed = await applyVariableApiAfterNarration(generatedRuntime);
      setRuntime(processed.runtime);
      setPlayerState(processed.runtime.player || state);
      const status = processed.runtime.narration.lastError ? processed.runtime.narration.lastError : '第一幕已生成';
      setInteractionStatus(processed.message ? `${status} / ${processed.message}` : status);
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
        memory: runtime.memory,
      };
      const generatedRuntime = await generateEldredNarrationFromEvent(sourceRuntime, {
        ...event,
        player: playerState,
        party: runtime.npcs.filter(npc => playerState?.partyMemberIds.includes(npc.id) || playerState?.partyMemberIds.includes(npc.name)),
        enemies: runtime.combat.enemyUnits,
      });
      const processed = await applyVariableApiAfterNarration(generatedRuntime);
      setRuntime(processed.runtime);
      setPlayerState(processed.runtime.player || playerState);
      const status = processed.runtime.narration.lastError ? processed.runtime.narration.lastError : '正文已生成';
      setInteractionStatus(processed.message ? `${status} / ${processed.message}` : status);
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
        memory: runtime.memory,
      };
      const checkResult = dispatchEldredD20Check(sourceRuntime, text);
      if (checkResult?.event) {
        setRuntime(checkResult.runtime);
        setPlayerState(checkResult.runtime.player || playerState);
        const generatedRuntime = await generateEldredNarrationFromEvent(checkResult.runtime, {
          ...checkResult.event,
          player: checkResult.runtime.player,
          party: checkResult.runtime.player
            ? checkResult.runtime.npcs.filter(npc => checkResult.runtime.player?.partyMemberIds.includes(npc.id) || checkResult.runtime.player?.partyMemberIds.includes(npc.name))
            : [],
          enemies: checkResult.runtime.combat.enemyUnits,
        });
        const processed = await applyVariableApiAfterNarration(generatedRuntime);
        setRuntime(processed.runtime);
        setPlayerState(processed.runtime.player || checkResult.runtime.player || playerState);
        const status = processed.runtime.narration.lastError ? processed.runtime.narration.lastError : '判定正文已同步';
        setInteractionStatus(processed.message ? `${status} / ${processed.message}` : status);
        return;
      }
      const generatedRuntime = await generateEldredNarrationFromInput(sourceRuntime, text, 'free');
      const processed = await applyVariableApiAfterNarration(generatedRuntime);
      setRuntime(processed.runtime);
      setPlayerState(processed.runtime.player || playerState);
      const status = processed.runtime.narration.lastError ? processed.runtime.narration.lastError : '正文已生成';
      setInteractionStatus(processed.message ? `${status} / ${processed.message}` : status);
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
        memory: runtime.memory,
        messages: runtime.messages,
      };
      const generatedRuntime = await rerollLatestEldredNarration(sourceRuntime);
      const processed = await applyVariableApiAfterNarration(generatedRuntime);
      setRuntime(processed.runtime);
      setPlayerState(processed.runtime.player || playerState);
      const status = processed.runtime.narration.lastError ? processed.runtime.narration.lastError : '本轮已重掷';
      setInteractionStatus(processed.message ? `${status} / ${processed.message}` : status);
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

  const selectNarrationVariant = async (entryId: string, variantIndex: number) => {
    if (!playerState || isGeneratingNarration) return;
    setInteractionStatus('切换备选中');
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
        memory: runtime.memory,
        messages: runtime.messages,
      };
      const nextRuntime = await selectEldredNarrationVariant(sourceRuntime, entryId, variantIndex);
      setRuntime(nextRuntime);
      setPlayerState(nextRuntime.player || playerState);
      setInteractionStatus(`已切换到备选 ${variantIndex + 1}`);
    } catch (error) {
      setInteractionStatus(error instanceof Error ? error.message : '备选切换失败');
    }
  };

  const updateNpcs = (updater: Character[] | ((prev: Character[]) => Character[])) => {
    setRuntime(prev => {
      const nextNpcs = typeof updater === 'function' ? updater(prev.npcs) : updater;
      return persistRuntimeNpcs(prev, nextNpcs);
    });
  };

  const dismissBoardItem = async (item: DynamicBoardItem) => {
    const nextRuntime = await dismissEldredBoardItem(loadEldredRuntimeSave(), item);
    setRuntime(nextRuntime);
    setInteractionStatus(`已忽略：${item.title}`);
  };

  const discardInventoryItem = async (item: { id?: string; name: string; category?: string; equipmentId?: string }) => {
    const nextRuntime = await discardEldredInventoryItem(loadEldredRuntimeSave(), item);
    setRuntime(nextRuntime);
    if (nextRuntime.player) setPlayerState(nextRuntime.player);
    setInteractionStatus(`已丢弃：${item.name}`);
  };

  const queueFortuneNarration = (
    sourceRuntime: EldredRuntimeSave,
    event: Omit<EldredFrontendEventInput, 'player' | 'party' | 'enemies'>,
  ) => {
    if (!sourceRuntime.player) return;
    setActiveTab('overview');
    setInteractionStatus('奇遇正文生成中');
    setIsGeneratingNarration(true);
    void generateEldredNarrationFromEvent(sourceRuntime, {
      ...event,
      player: sourceRuntime.player,
      party: sourceRuntime.npcs.filter(npc => sourceRuntime.player?.partyMemberIds.includes(npc.id) || sourceRuntime.player?.partyMemberIds.includes(npc.name)),
      enemies: sourceRuntime.combat.enemyUnits,
    }).then(async generatedRuntime => {
      const processed = await applyVariableApiAfterNarration(generatedRuntime);
      setRuntime(processed.runtime);
      setPlayerState(processed.runtime.player || sourceRuntime.player);
      const status = processed.runtime.narration.lastError ? processed.runtime.narration.lastError : '奇遇正文已生成';
      setInteractionStatus(processed.message ? `${status} / ${processed.message}` : status);
    }).catch(error => {
      setInteractionStatus(error instanceof Error ? error.message : '奇遇正文生成失败');
    }).finally(() => setIsGeneratingNarration(false));
  };

  const drawFortuneCard = async (slot: number) => {
    const result = await drawEldredFortuneCard(loadEldredRuntimeSave(), slot);
    if (!result) {
      setInteractionStatus('没有可用翻牌次数');
      return null;
    }
    setRuntime(result.runtime);
    if (result.runtime.player) setPlayerState(result.runtime.player);
    setInteractionStatus(result.message);
    if (result.event) queueFortuneNarration(result.runtime, result.event);
    return result;
  };

  const triggerDailyEncounter = async () => {
    const result = await triggerEldredDailyEncounter(loadEldredRuntimeSave());
    if (!result) {
      setInteractionStatus('今日奇遇已触发');
      return null;
    }
    setRuntime(result.runtime);
    if (result.runtime.player) setPlayerState(result.runtime.player);
    setInteractionStatus(result.message);
    if (result.event) queueFortuneNarration(result.runtime, result.event);
    return result;
  };

  const handleRuntimeProcessed = (nextRuntime: EldredRuntimeSave, message: string) => {
    setRuntime(nextRuntime);
    if (nextRuntime.player) setPlayerState(nextRuntime.player);
    setInteractionStatus(message);
  };

  const renderActivePanel = () => {
    if (!playerState) return <EmptyPanel title="等待入局" message="尚未读取到角色变量" />;
    switch (activeTab) {
      case 'overview': return <OverviewPanel player={playerState} interactionStatus={interactionStatus} isGenerating={isGeneratingNarration} runtime={runtime} onSubmitFreeInput={submitFreeInput} onRerollLatest={rerollCurrentNarration} onSelectNarrationVariant={selectNarrationVariant} canReroll={runtime.narration.entries.length > 0} />;
      case 'map': return <MapPanel player={playerState} runtime={runtime} />;
      case 'party': return <PartyPanel player={playerState} onUpdatePlayer={updatePlayerPreview} onUpdateNpcs={updateNpcs} npcs={runtime.npcs} onSubmitEvent={submitRuntimeEvent} />;
      case 'npc': return <NpcPanel npcs={runtime.npcs} />;
      case 'quests': return <QuestPanel quests={runtime.quests} boardItems={runtime.world.dynamicBoard} onSubmitEvent={submitRuntimeEvent} onDismissBoardItem={dismissBoardItem} onOpenOverview={() => setActiveTab('overview')} />;
      case 'clues': return <CluePanel cluePhases={runtime.cluePhases} />;
      case 'combat': return <CombatPanel player={playerState} partyNpcs={runtime.npcs.filter(npc => playerState.partyMemberIds.includes(npc.id) || playerState.partyMemberIds.includes(npc.name))} enemyUnits={runtime.combat.enemyUnits} initialTurn={runtime.combat.turn} initialLogs={runtime.combat.logs} runtime={runtime} onSubmitEvent={submitRuntimeEvent} />;
      case 'inventory': return <InventoryPanel player={playerState} runtime={runtime} onSubmitEvent={submitRuntimeEvent} onDiscardItem={discardInventoryItem} onOpenOverview={() => setActiveTab('overview')} />;
      case 'fortune': return <FortunePanel runtime={runtime} isBusy={isGeneratingNarration} onDrawCard={drawFortuneCard} onTriggerDaily={triggerDailyEncounter} />;
      case 'system': return <SystemPanel runtime={runtime} player={playerState} onRuntimeProcessed={handleRuntimeProcessed} />;
      default: return <EmptyPanel title="未知区域" />;
    }
  };

  return (
    <div className={`w-screen h-screen overflow-hidden flex font-sans ${eldredTheme === 'dark' ? 'text-gray-200' : 'text-stone-900'}`}>
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
            data-eldred-theme={eldredTheme}
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
              theme={eldredTheme}
              onThemeChange={setEldredTheme}
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
