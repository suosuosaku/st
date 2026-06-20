import { useState } from 'react';
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
import { ATTRIBUTE_LABELS, buildPlayerState, getClassById, getEquipmentById, getRaceById, getSkillById, getTalentById } from './game/rules';
import { submitPayloadToSillyTavernInput } from './game/sillyTavernBridge';

export default function App() {
  const [gameState, setGameState] = useState<GameState>('creation');
  const [playerState, setPlayerState] = useState<PlayerState>(() => buildPlayerState('ranger', 'broken-sword'));
  const [activeTab, setActiveTab] = useState<TabState>('overview');
  const [hudExpanded, setHudExpanded] = useState(true);
  const [openingPayload, setOpeningPayload] = useState('');
  const [openingStatus, setOpeningStatus] = useState('待提交');

  const generateOpeningPrompt = (state: PlayerState) => {
    const cls = getClassById(state.classId);
    const race = getRaceById(state.raceId);
    const stats = (['str', 'dex', 'vit', 'int', 'spr'] as const)
      .map(key => `${ATTRIBUTE_LABELS[key]}${state.stats[key]}`)
      .join(' / ');
    const skillNames = state.activeSkillIds.map(id => getSkillById(id)?.name).filter(Boolean).join('、');
    const talentNames = state.talentIds.map(id => getTalentById(id)?.name).filter(Boolean).join('、');
    return `【艾尔德雷德入局设定】
姓名：${state.name}
性别：${state.identity.gender || '未记录'}
年龄：${state.identity.age || '未记录'}
经历：${state.identity.background || '未记录'}
种族：${race.name}｜${race.auraName}｜${race.auraEffect}
职业：${cls.name}｜${cls.classAuraName}｜${cls.classAuraEffect}
伴生天赋：${talentNames || '无'}
出生点：${state.location.name}｜${state.location.landmarkName}
五维：${stats}
等级：1
战斗底值：生命${state.stats.maxHp}｜法力${state.stats.maxMp}｜护甲${state.stats.ac}｜熟练+${state.stats.proficiency}
已选开局技能：${skillNames || '无'}
初始装备：${state.equipmentIds.map(id => getEquipmentById(id)?.name).filter(Boolean).join('、') || '按职业装备登记'}

入局请求：生成第一幕正文；只按以上已选内容初始化变量；未选择技能、默认剧情、默认队友、默认委托不得写入；输出 <UpdateVariable>。`;
  };

  const submitToSillyTavern = async (payload: string) => {
    return submitPayloadToSillyTavernInput(payload, '已复制载荷');
  };

  const handleCreationComplete = (state: PlayerState) => {
    setPlayerState(state);
    setGameState('playing');
    const prompt = generateOpeningPrompt(state);
    setOpeningPayload(prompt);
    setOpeningStatus('提交中');
    window.dispatchEvent(new CustomEvent('eldred:opening-ready', { detail: { prompt, state } }));
    void submitToSillyTavern(prompt).then(setOpeningStatus).catch(error => {
      console.warn('[艾尔德雷德] 入局载荷提交失败', error);
      setOpeningStatus('载荷已生成');
    });
  };

  const renderActivePanel = () => {
    switch (activeTab) {
      case 'overview': return <OverviewPanel player={playerState} openingPayload={openingPayload} openingStatus={openingStatus} />;
      case 'map': return <MapPanel player={playerState} />;
      case 'party': return <PartyPanel player={playerState} onUpdatePlayer={setPlayerState} />;
      case 'npc': return <NpcPanel />;
      case 'quests': return <QuestPanel />;
      case 'combat': return <CombatPanel player={playerState} />;
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
