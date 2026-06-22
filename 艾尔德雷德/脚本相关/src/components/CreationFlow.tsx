import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Dice5, Minus, Plus, Sparkles } from 'lucide-react';
import { AttributeKey, CharacterClassId, CharacterIdentity, CharacterRaceId, PlayerState } from '../types';
import {
  ATTRIBUTE_KEYS,
  ATTRIBUTE_LABELS,
  OPENING_ATTRIBUTE_POINTS,
  buildPlayerState,
  calculateDerivedStats,
  characterClasses,
  characterRaces,
  getClassById,
  getEquipmentById,
  getOpeningSkillsByClass,
  getRaceById,
  getTalentById,
  originLocations,
} from '../game/rules';

type IntroSlide = {
  title: string;
  subtitle?: string;
  desc?: string;
  sections?: { title: string; body: string }[];
  tags?: string[];
  blank?: boolean;
};

const introSlides: IntroSlide[] = [
  {
    title: '艾尔德雷德',
    subtitle: '辉光减退期',
    desc: '众神长眠后的大陆。辉光减退，龙脉躁动，旧封印松动；王国、行会、教会、学院、群岛、森林与边境营地仍在各自的文书、道路和日常里维持秩序。',
    tags: ['辉光减退期', '龙脉异动', '五神器线索', '多地记录互证'],
  },
  {
    title: '作者寄语',
    subtitle: '留白页',
    blank: true,
  },
  {
    title: '世界、势力与故事背景',
    subtitle: '大陆记录',
    sections: [
      { title: '世界', body: '中央是禁忌之地与龙骨深渊；西侧有岚之领七城邦与白帆群岛；东南是星砂学院邦；东北是月鹿森林；北境连接黑松边寨与霜冠雪路；西北炉山坐落灰炉诸城。' },
      { title: '势力', body: '艾琳西亚以王令、圣骑士团与晨曦教会维持秩序；岚之领以行会、桥费与城邦议会运转；星砂学院邦掌握观测、图书与召唤试验；灰雾边境依靠撤回线、向导、药草和病棚守住禁忌之地外缘。' },
      { title: '背景', body: '圣都光辉变暗、魔物潮增多、药草与病历异常、票据和旧记录互相指向。第一条记录链通常从账本、病历、票据、钟签、日志、地图或碑拓开始。' },
    ],
  },
];

const randomizableOrigins = originLocations.filter(origin => origin.id !== 'random-origin');

export function CreationFlow({ onComplete }: { onComplete: (state: PlayerState) => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [identity, setIdentity] = useState<CharacterIdentity>({
    name: '',
    gender: '',
    age: '',
    background: '',
  });
  const [raceId, setRaceId] = useState<CharacterRaceId>('human');
  const [originId, setOriginId] = useState(randomizableOrigins[0].id);
  const [classId, setClassId] = useState<CharacterClassId>('ranger');
  const [stats, setStats] = useState<Record<AttributeKey, number>>(getClassById('ranger').presetStats);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>(getOpeningSkillsByClass('ranger').slice(0, 2).map(skill => skill.id));
  const [isGenerating, setIsGenerating] = useState(false);

  const setupStep = currentStep - introSlides.length;
  const totalSteps = introSlides.length + 6;
  const selectedClass = getClassById(classId);
  const selectedRace = getRaceById(raceId);
  const selectedOrigin = originLocations.find(origin => origin.id === originId) || randomizableOrigins[0];
  const raceBonus = selectedRace.attributeBonus;
  const finalStats = ATTRIBUTE_KEYS.reduce((acc, key) => {
    acc[key] = Math.max(0, Math.min(20, stats[key] + (raceBonus[key] || 0)));
    return acc;
  }, {} as Record<AttributeKey, number>);
  const pointTotal = ATTRIBUTE_KEYS.reduce((sum, key) => sum + stats[key], 0);
  const derived = calculateDerivedStats(1, classId, stats, selectedClass.startingEquipmentIds, raceId);
  const classSkills = getOpeningSkillsByClass(classId);
  const selectedTalents = selectedClass.companionTalentIds.flatMap(id => {
    const talent = getTalentById(id);
    return talent ? [talent] : [];
  });
  const talentNames = selectedTalents.map(talent => talent.name);

  const canContinue = useMemo(() => {
    if (setupStep === 0) return identity.name.trim().length > 0;
    if (setupStep === 4) return pointTotal === OPENING_ATTRIBUTE_POINTS;
    if (setupStep === 5) return selectedSkillIds.length > 0 && selectedSkillIds.length <= 2;
    return true;
  }, [identity.name, pointTotal, selectedSkillIds.length, setupStep]);

  const handleClassSelect = (id: CharacterClassId) => {
    const cls = getClassById(id);
    setClassId(id);
    setStats(cls.presetStats);
    setSelectedSkillIds(getOpeningSkillsByClass(id).slice(0, 2).map(skill => skill.id));
  };

  const adjustStat = (key: AttributeKey, delta: number) => {
    setStats(prev => {
      const nextValue = Math.max(0, Math.min(8, prev[key] + delta));
      const next = { ...prev, [key]: nextValue };
      const nextTotal = ATTRIBUTE_KEYS.reduce((sum, item) => sum + next[item], 0);
      if (nextTotal > OPENING_ATTRIBUTE_POINTS) return prev;
      return next;
    });
  };

  const toggleSkill = (skillId: string) => {
    setSelectedSkillIds(prev => {
      if (prev.includes(skillId)) return prev.filter(id => id !== skillId);
      if (prev.length >= 2) return prev;
      return [...prev, skillId];
    });
  };

  const randomOrigin = () => {
    const next = randomizableOrigins[Math.floor(Math.random() * randomizableOrigins.length)];
    setOriginId(next.id);
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
      return;
    }
    setIsGenerating(true);
    window.setTimeout(() => {
      onComplete(buildPlayerState({ identity, raceId, classId, originId, attributes: stats, activeSkillIds: selectedSkillIds }));
    }, 500);
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  };

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-fantasy-darker relative z-10">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45 }} className="flex flex-col items-center space-y-6">
          <Sparkles className="w-14 h-14 md:w-16 md:h-16 text-fantasy-gold animate-pulse" />
          <h1 className="text-xl md:text-3xl font-serif text-gold-gradient tracking-widest">登记册落章</h1>
          <div className="w-56 md:w-64 h-1 bg-gray-800 rounded-full overflow-hidden">
            <motion.div className="h-full bg-fantasy-gold" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 0.5, ease: 'easeInOut' }} />
          </div>
        </motion.div>
      </div>
    );
  }

  const currentIntro = currentStep < introSlides.length ? introSlides[currentStep] : null;
  const setupTitles = ['自定义身份', '种族登记', '出生点', '职业登记', '五维加点', '开局战斗技能'];
  const setupSubtitles = [
    '姓名、性别、年龄与经历',
    selectedRace.auraName,
    selectedOrigin.name,
    `${selectedClass.name} / 伴生天赋：${talentNames.join('、')}`,
    `剩余点数：${OPENING_ATTRIBUTE_POINTS - pointTotal}`,
    `${selectedSkillIds.length}/2`,
  ];

  return (
    <div className="flex flex-col items-center justify-start md:justify-center p-3 sm:p-5 md:p-8 h-full w-full relative overflow-y-auto">
      <div className="relative md:absolute md:top-10 text-center w-full mb-4 md:mb-0">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif text-copper-gradient mb-1 drop-shadow-md">艾尔德雷德</h1>
        <p className="text-fantasy-gold/60 font-serif tracking-widest text-[10px] sm:text-xs">辉光减退期</p>
      </div>

      <motion.div
        key={currentStep}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="glass-panel w-full max-w-4xl p-4 sm:p-6 md:p-10 rounded-lg"
      >
        <div className="mb-5 md:mb-8 text-center space-y-1.5 border-b border-fantasy-gold/20 pb-5 md:pb-8 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-7 md:-mt-12 text-fantasy-gold/20 text-4xl md:text-6xl font-serif font-black opacity-30 select-none">
            {String(currentStep + 1).padStart(2, '0')}
          </div>
          <h2 className="text-lg sm:text-xl md:text-2xl font-serif text-gray-200 tracking-wider relative z-10">
            {currentIntro?.title || setupTitles[setupStep]}
          </h2>
          <p className="text-gray-400 text-[11px] md:text-sm">
            {currentIntro?.subtitle || setupSubtitles[setupStep]}
          </p>
        </div>

        {currentIntro && (
          <div className="mb-6 md:mb-10 min-h-[220px] md:min-h-[260px] flex flex-col justify-center gap-4 md:gap-5">
            {currentIntro.blank ? (
              <div className="h-40 sm:h-48 md:h-52 rounded border border-fantasy-gold/20 bg-black/20" />
            ) : (
              <>
                {currentIntro.desc && <p className="text-gray-300 leading-7 md:leading-8 text-sm md:text-base text-center max-w-2xl mx-auto">{currentIntro.desc}</p>}
                {currentIntro.sections && (
                  <div className="grid gap-3 md:gap-4">
                    {currentIntro.sections.map(section => (
                      <div key={section.title} className="p-3 md:p-4 rounded bg-black/30 border border-fantasy-gold/20">
                        <div className="text-fantasy-gold font-serif text-sm mb-2 tracking-wider">{section.title}</div>
                        <div className="text-gray-400 text-xs md:text-sm leading-6 md:leading-7">{section.body}</div>
                      </div>
                    ))}
                  </div>
                )}
                {currentIntro.tags && (
                  <div className="flex flex-wrap justify-center gap-2">
                    {currentIntro.tags.map(tag => (
                      <span key={tag} className="px-3 py-1 bg-fantasy-gold/10 border border-fantasy-gold/30 rounded text-[11px] text-fantasy-gold">{tag}</span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {setupStep === 0 && (
          <div className="grid gap-3 mb-6 md:mb-8">
            <div className="grid sm:grid-cols-3 gap-3">
              <input className="bg-black/30 border border-fantasy-gold/25 rounded px-3 py-3 text-sm outline-none focus:border-fantasy-gold" placeholder="姓名" value={identity.name} onChange={event => setIdentity(prev => ({ ...prev, name: event.target.value }))} />
              <input className="bg-black/30 border border-fantasy-gold/25 rounded px-3 py-3 text-sm outline-none focus:border-fantasy-gold" placeholder="性别" value={identity.gender} onChange={event => setIdentity(prev => ({ ...prev, gender: event.target.value }))} />
              <input className="bg-black/30 border border-fantasy-gold/25 rounded px-3 py-3 text-sm outline-none focus:border-fantasy-gold" placeholder="年龄" value={identity.age} onChange={event => setIdentity(prev => ({ ...prev, age: event.target.value }))} />
            </div>
            <textarea className="min-h-28 bg-black/30 border border-fantasy-gold/25 rounded px-3 py-3 text-sm outline-none focus:border-fantasy-gold resize-none" placeholder="经历" value={identity.background} onChange={event => setIdentity(prev => ({ ...prev, background: event.target.value }))} />
          </div>
        )}

        {setupStep === 1 && (
          <div className="max-h-[min(52vh,34rem)] overflow-y-auto pr-1 sm:pr-2 mb-6 md:mb-8">
          <div className="grid md:grid-cols-2 gap-3 md:gap-4">
            {characterRaces.map(race => {
              const active = raceId === race.id;
              return (
                <button key={race.id} onClick={() => setRaceId(race.id)} className={`btn-rpg p-4 text-left rounded-md ${active ? 'active ring-1 ring-fantasy-gold' : ''}`}>
                  <div className="font-serif text-base md:text-lg text-gray-100">{race.name}</div>
                  <div className="text-xs text-gray-500 leading-5 mt-1">{race.summary}</div>
                  <div className="text-[11px] text-fantasy-gold/80 mt-2">{race.auraName}：{race.auraEffect}</div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {ATTRIBUTE_KEYS.map(key => race.attributeBonus[key] ? (
                      <span key={key} className="px-2 py-0.5 rounded bg-black/40 border border-fantasy-gold/20 text-[10px] text-fantasy-gold">
                        {ATTRIBUTE_LABELS[key]}{race.attributeBonus[key]! > 0 ? '+' : ''}{race.attributeBonus[key]}
                      </span>
                    ) : null)}
                  </div>
                </button>
              );
            })}
          </div>
          </div>
        )}

        {setupStep === 2 && (
          <div className="max-h-[min(52vh,34rem)] overflow-y-auto pr-1 sm:pr-2 mb-6 md:mb-8">
          <div className="grid md:grid-cols-2 gap-3 md:gap-4">
            {randomizableOrigins.map(origin => {
              const active = originId === origin.id;
              return (
                <button key={origin.id} onClick={() => setOriginId(origin.id)} className={`btn-rpg p-4 text-left rounded-md ${active ? 'active ring-1 ring-fantasy-gold' : ''}`}>
                  <div className="font-serif text-base md:text-lg text-gray-100">{origin.name}</div>
                  <div className="text-xs text-gray-500 leading-5 mt-1">{origin.summary}</div>
                  <div className="text-[11px] text-fantasy-gold/70 mt-2">{origin.landmarkName}</div>
                </button>
              );
            })}
            <button onClick={randomOrigin} className="btn-rpg p-4 text-left rounded-md border-dashed">
              <div className="flex items-center gap-2 font-serif text-base md:text-lg text-gray-100"><Dice5 className="w-4 h-4" /> 随机出生点</div>
              <div className="text-xs text-gray-500 leading-5 mt-1">由登记册随机落章。</div>
            </button>
          </div>
          </div>
        )}

        {setupStep === 3 && (
          <div className="max-h-[min(52vh,34rem)] overflow-y-auto pr-1 sm:pr-2 mb-6 md:mb-8">
          <div className="grid md:grid-cols-2 gap-3 md:gap-4">
            {characterClasses.map(cls => {
              const active = classId === cls.id;
              return (
                <button key={cls.id} onClick={() => handleClassSelect(cls.id)} className={`btn-rpg p-4 text-left rounded-md ${active ? 'active ring-1 ring-fantasy-gold' : ''}`}>
                  <div className="font-serif text-base md:text-lg text-gray-100">{cls.name}</div>
                  <div className="text-xs text-gray-500 leading-5 mt-1">{cls.summary}</div>
                  <div className="text-[11px] text-fantasy-gold/80 mt-2">{cls.classAuraName}：{cls.classAuraEffect}</div>
                  <div className="text-[11px] text-gray-400 mt-2">伴生天赋：{cls.companionTalentIds.map(id => getTalentById(id)?.name).filter(Boolean).join('、')}</div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {cls.primaryAttributes.map(attr => (
                      <span key={attr} className="px-2 py-0.5 rounded bg-black/40 border border-fantasy-gold/20 text-[10px] text-fantasy-gold">{ATTRIBUTE_LABELS[attr]}</span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
          </div>
        )}

        {setupStep === 4 && (
          <div className="grid lg:grid-cols-[1fr_260px] gap-4 mb-6 md:mb-8">
            <div className="grid gap-3">
              {ATTRIBUTE_KEYS.map(key => {
                const bonus = raceBonus[key] || 0;
                const bonusText = bonus > 0 ? `+${bonus}` : String(bonus);
                return (
                <div key={key} className="bg-black/30 border border-fantasy-gold/20 rounded p-3 flex items-center gap-3">
                  <div className="w-14 font-serif text-fantasy-gold text-sm">{ATTRIBUTE_LABELS[key]}</div>
                  <button className="btn-rpg w-8 h-8 md:w-9 md:h-9 rounded flex items-center justify-center" onClick={() => adjustStat(key, -1)} disabled={stats[key] <= 0}><Minus className="w-4 h-4" /></button>
                  <div className="flex-1 h-2 bg-black/60 rounded overflow-hidden">
                    <div className="h-full bg-fantasy-gold/70" style={{ width: `${(finalStats[key] / 10) * 100}%` }} />
                  </div>
                  <div className="grid w-28 grid-cols-3 gap-1 text-right font-mono text-[11px] md:text-xs">
                    <span className="text-gray-300" title="基础点">{stats[key]}</span>
                    <span className={bonus > 0 ? 'text-green-300' : bonus < 0 ? 'text-red-300' : 'text-gray-500'} title="种族修正">{bonusText}</span>
                    <span className="text-fantasy-gold" title="最终值">{finalStats[key]}</span>
                  </div>
                  <button className="btn-rpg w-8 h-8 md:w-9 md:h-9 rounded flex items-center justify-center" onClick={() => adjustStat(key, 1)} disabled={pointTotal >= OPENING_ATTRIBUTE_POINTS || stats[key] >= 8}><Plus className="w-4 h-4" /></button>
                </div>
              );
              })}
            </div>
            <div className="bg-black/30 border border-fantasy-gold/20 rounded p-4 space-y-3">
              <div className="text-fantasy-gold font-serif">登记数值</div>
              <div className="grid grid-cols-3 gap-1 text-[10px] text-gray-400">
                <span>基础点</span>
                <span className="text-right">种族修正</span>
                <span className="text-right text-fantasy-gold">最终值</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white/5 rounded p-2">生命 <span className="float-right font-mono">{derived.maxHp}</span></div>
                <div className="bg-white/5 rounded p-2">法力 <span className="float-right font-mono">{derived.maxMp}</span></div>
                <div className="bg-white/5 rounded p-2">护甲 <span className="float-right font-mono">{derived.ac}</span></div>
                <div className="bg-white/5 rounded p-2">熟练 <span className="float-right font-mono">+{derived.proficiency}</span></div>
              </div>
              <div className={`text-xs ${pointTotal === OPENING_ATTRIBUTE_POINTS ? 'text-green-300' : 'text-fantasy-gold'}`}>
                剩余点数：{OPENING_ATTRIBUTE_POINTS - pointTotal}
              </div>
            </div>
          </div>
        )}

        {setupStep === 5 && (
          <div className="max-h-[min(52vh,34rem)] overflow-y-auto pr-1 sm:pr-2 mb-6 md:mb-8">
          <div className="grid md:grid-cols-2 gap-3 md:gap-4">
            <div className="md:col-span-2 grid sm:grid-cols-2 gap-3">
              {selectedTalents.map(talent => (
                <div key={talent.id} className="rounded-md border border-fantasy-gold/25 bg-black/30 p-4 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-serif text-sm md:text-base text-gray-100">{talent.name}</span>
                    <span className="text-[10px] text-fantasy-gold border border-fantasy-gold/30 rounded px-2 py-0.5">{talent.rank}</span>
                  </div>
                  <div className="mt-2 text-xs leading-5 text-gray-400">{talent.effect}</div>
                </div>
              ))}
            </div>
            {classSkills.map(skill => {
              const active = selectedSkillIds.includes(skill.id);
              return (
                <button key={skill.id} onClick={() => toggleSkill(skill.id)} className={`btn-rpg p-4 text-left rounded-md ${active ? 'active ring-1 ring-fantasy-gold' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-serif text-base md:text-lg text-gray-100">{skill.name}</span>
                    <span className="text-[10px] text-fantasy-gold border border-fantasy-gold/30 rounded px-2 py-0.5">{skill.rank}</span>
                  </div>
                  <div className="text-xs text-gray-500 leading-5 mt-1">{skill.desc}</div>
                  <div className="text-[11px] text-gray-400 mt-2">消耗{skill.mpCost}法力 / {skill.target}</div>
                </button>
              );
            })}
            <div className="md:col-span-2 bg-black/30 border border-fantasy-gold/20 rounded p-4 text-xs text-gray-400">
              初始装备：{selectedClass.startingEquipmentIds.map(id => getEquipmentById(id)?.name).filter(Boolean).join('、')}
            </div>
          </div>
          </div>
        )}

        <div className="flex justify-between items-center gap-3">
          <div className="text-fantasy-gold/50 text-xs md:text-sm font-mono">
            阶段 {currentStep + 1} / {totalSteps}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="btn-rpg px-4 md:px-5 py-2.5 md:py-3 rounded text-xs md:text-sm tracking-widest flex items-center gap-2 border border-gray-600 text-gray-300 hover:border-fantasy-gold/50 hover:text-fantasy-gold transition-all disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
              返回
            </button>
            <button
              id="btn-create-next"
              onClick={handleNext}
              disabled={!canContinue}
              className="btn-rpg px-5 md:px-8 py-2.5 md:py-3 rounded text-xs md:text-sm tracking-widest flex items-center gap-2 group border border-fantasy-gold text-fantasy-gold hover:bg-fantasy-gold/20 hover:text-white transition-all disabled:opacity-30"
            >
              {currentStep === totalSteps - 1 ? '进入' : '继续'}
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
