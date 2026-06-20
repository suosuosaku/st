import { useEffect, useMemo, useState } from 'react';
import { Heart, Info, MapPin, Shield, User } from 'lucide-react';
import { Character } from '../../types';
import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS, getClassById, getEquipmentById } from '../../game/rules';

type NpcPanelProps = {
  npcs?: Character[];
};

export function NpcPanel({ npcs = [] }: NpcPanelProps) {
  const [selectedNpcId, setSelectedNpcId] = useState('');
  const selectedNpc = useMemo(
    () => npcs.find(npc => npc.id === selectedNpcId) || npcs[0] || null,
    [npcs, selectedNpcId],
  );

  useEffect(() => {
    if (selectedNpc && selectedNpc.id !== selectedNpcId) {
      setSelectedNpcId(selectedNpc.id);
    }
    if (!selectedNpc && selectedNpcId) {
      setSelectedNpcId('');
    }
  }, [selectedNpc, selectedNpcId]);

  const selectedClass = selectedNpc ? getClassById(selectedNpc.classId) : null;
  const equipment = selectedNpc ? selectedNpc.equipmentIds.map(id => getEquipmentById(id)).filter(Boolean) : [];

  return (
    <div className="h-full w-full flex flex-col xl:flex-row gap-4 xl:gap-6 overflow-y-auto xl:overflow-hidden">
      <div className="w-full xl:w-72 max-h-60 xl:max-h-none glass-panel rounded-xl flex flex-col overflow-hidden shrink-0">
        <div className="p-4 border-b border-fantasy-gold/20 flex justify-between items-center bg-fantasy-darker/50">
          <h2 className="text-xl font-serif text-fantasy-gold">已知角色</h2>
          <span className="text-sm font-mono text-gray-400">{npcs.length}人</span>
        </div>
        <div className="p-3 space-y-2 flex-1 overflow-y-auto">
          {npcs.length === 0 && (
            <div className="p-4 rounded border border-white/5 bg-black/20 text-sm text-gray-500">暂无已收录角色</div>
          )}
          {npcs.map(npc => (
            <button
              key={npc.id}
              onClick={() => setSelectedNpcId(npc.id)}
              className={`w-full text-left p-3 rounded flex gap-4 cursor-pointer transition-colors border ${selectedNpc?.id === npc.id ? 'bg-fantasy-gold/10 border-fantasy-gold shadow-[0_0_10px_rgba(212,175,55,0.1)]' : 'bg-black/20 border-transparent hover:border-fantasy-gold/30'}`}
            >
              <div className="w-12 h-12 bg-fantasy-darker shrink-0 rounded border border-fantasy-gold/50 flex items-center justify-center overflow-hidden">
                {npc.avatarUrl ? (
                  <img src={npc.avatarUrl} alt={npc.name} className="w-full h-full object-cover rounded" />
                ) : (
                  <User className="text-fantasy-gold w-6 h-6 opacity-80" />
                )}
              </div>
              <div className="overflow-hidden">
                <div className="text-base text-gray-100 font-serif tracking-wide truncate">{npc.name}</div>
                <div className="text-[11px] text-gray-500 truncate">{npc.profession}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-[620px] xl:min-h-0 glass-panel rounded-xl flex flex-col overflow-hidden relative">
        {!selectedNpc || !selectedClass ? (
          <div className="h-full min-h-[420px] flex items-center justify-center p-8">
            <div className="w-full max-w-md rounded-xl border border-fantasy-gold/20 bg-black/20 p-8 text-center">
              <User className="w-10 h-10 mx-auto text-fantasy-gold/70 mb-4" />
              <div className="text-xl font-serif text-fantasy-gold mb-2">暂无角色档案</div>
              <div className="text-sm text-gray-500">等待收录</div>
            </div>
          </div>
        ) : (
          <>
            <div className="dossier-hero relative z-10 bg-gradient-to-b from-white/5 to-transparent">
              <div className="dossier-portrait dossier-portrait-lg">
                {selectedNpc.portraitUrl ? (
                  <img src={selectedNpc.portraitUrl} alt={selectedNpc.fullName} className="h-full w-full object-contain" />
                ) : (
                  <span>人物档案</span>
                )}
              </div>
              <div className="min-w-0 flex-1 text-center">
                <div className="mx-auto mb-2 w-fit border border-blue-400/25 bg-fantasy-blue/20 px-3 py-1 text-xs text-blue-200">{selectedNpc.type} / Lv.{selectedNpc.stats.level}</div>
                <h1 className="font-serif text-2xl font-bold leading-tight tracking-widest text-white md:text-4xl">{selectedNpc.fullName}</h1>
                <div className="mt-2 text-sm text-gray-400">
                  {selectedNpc.race} / {selectedNpc.gender} / {selectedNpc.age}岁 / {selectedClass.name}
                </div>
                <div className="dossier-attributes mt-5">
                  {ATTRIBUTE_KEYS.map(key => (
                    <div key={key} className="dossier-attribute">
                      <span>{ATTRIBUTE_LABELS[key].slice(0, 1)}</span>
                      <strong>{selectedNpc.stats[key]}</strong>
                    </div>
                  ))}
                </div>
                <div className="mt-5 grid gap-2 md:grid-cols-3">
                  <div className="dossier-meter"><MapPin className="h-4 w-4 text-fantasy-gold" /><span>所属 {selectedNpc.affiliation}</span></div>
                  <div className="dossier-meter"><Info className="h-4 w-4 text-fantasy-gold" /><span>身份 {selectedNpc.identity}</span></div>
                  <div className="dossier-meter"><Heart className="h-4 w-4 text-red-400" /><span>好感 {selectedNpc.favorability} / {selectedNpc.relationshipStage}</span></div>
                </div>
              </div>
            </div>

            <div className="p-5 md:p-8 flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 relative z-10 overflow-y-auto">
              <div className="space-y-6">
                <section className="space-y-4">
                  <h3 className="text-sm font-serif text-fantasy-gold border-b border-white/10 pb-2">机制数值</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex justify-between p-2 bg-white/5 rounded text-sm"><span className="text-gray-500">等级</span><span className="font-mono text-gray-300">{selectedNpc.stats.level}</span></div>
                    <div className="flex justify-between p-2 bg-white/5 rounded text-sm"><span className="text-gray-500">护甲</span><span className="font-mono text-gray-300">{selectedNpc.stats.ac}</span></div>
                    <div className="flex justify-between p-2 bg-white/5 rounded text-sm"><span className="text-gray-500">生命</span><span className="font-mono text-gray-300">{selectedNpc.stats.maxHp}</span></div>
                    <div className="flex justify-between p-2 bg-white/5 rounded text-sm"><span className="text-gray-500">法力</span><span className="font-mono text-gray-300">{selectedNpc.stats.maxMp}</span></div>
                    {ATTRIBUTE_KEYS.map(key => (
                      <div key={key} className="flex justify-between p-2 bg-white/5 rounded text-sm">
                        <span className="text-gray-500">{ATTRIBUTE_LABELS[key]}</span>
                        <span className="font-mono text-gray-300">{selectedNpc.stats[key]}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2 bg-white/5 rounded text-sm flex justify-between"><span className="text-gray-500">经验</span><span className="font-mono text-gray-300">{selectedNpc.experience}/{selectedNpc.nextLevelExperience}</span></div>
                    <div className="p-2 bg-white/5 rounded text-sm flex justify-between"><span className="text-gray-500">可分配点</span><span className="font-mono text-gray-300">{selectedNpc.availableAttributePoints}</span></div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-sm font-serif text-fantasy-gold pb-2 border-b border-white/10">情报特质</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedNpc.attributes.map((attr, idx) => (
                      <span key={idx} className="px-3 py-1 bg-fantasy-gold/10 text-fantasy-gold text-xs rounded border border-fantasy-gold/30">{attr}</span>
                    ))}
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                <section className="space-y-4">
                  <h3 className="text-sm font-serif text-fantasy-gold pb-2 border-b border-white/10">已知技能</h3>
                  <div className="space-y-2">
                    {selectedNpc.skills.map(skill => (
                      <div key={skill.id} className="p-3 bg-black/30 border border-white/5 rounded">
                        <div className="flex justify-between gap-2 text-sm text-gray-200 font-medium mb-1">
                          <span>{skill.name}</span>
                          <span className="text-fantasy-gold text-xs">{skill.rank} / {skill.mpCost}法力</span>
                        </div>
                        <div className="text-xs text-gray-500">{skill.desc}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-sm font-serif text-fantasy-gold pb-2 border-b border-white/10 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    装备
                  </h3>
                  <div className="space-y-2">
                    {equipment.map(item => item && (
                      <div key={item.id} className="p-3 bg-black/30 border border-white/5 rounded">
                        <div className="flex justify-between text-sm text-gray-200 font-medium">
                          <span>{item.name}</span>
                          <span className="text-fantasy-gold text-xs">{item.grade}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{item.traits.join('，')}</div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
