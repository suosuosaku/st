import { useEffect, useMemo, useState } from 'react';
import { Heart, Info, MapPin, Shield, User } from 'lucide-react';
import { Character } from '../../types';
import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS, getClassById, getEquipmentById } from '../../game/rules';

type NpcPanelProps = {
  npcs?: Character[];
};

type NpcDetailPage = 'stats' | 'traits' | 'skills' | 'equipment';

const npcDetailPages: { id: NpcDetailPage; label: string }[] = [
  { id: 'stats', label: '数值' },
  { id: 'traits', label: '特质' },
  { id: 'skills', label: '技能' },
  { id: 'equipment', label: '装备' },
];

export function NpcPanel({ npcs = [] }: NpcPanelProps) {
  const [selectedNpcId, setSelectedNpcId] = useState('');
  const [detailPage, setDetailPage] = useState<NpcDetailPage>('stats');
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
            <div className="p-5 md:p-8 border-b border-white/10 relative z-10 flex flex-col sm:flex-row gap-5 md:gap-8 bg-gradient-to-b from-white/5 to-transparent">
              <div className="w-28 h-28 md:w-32 md:h-32 bg-fantasy-darker border-2 border-fantasy-gold rounded flex items-center justify-center text-fantasy-gold shadow-lg shadow-black overflow-hidden shrink-0">
                {selectedNpc.portraitUrl ? (
                  <img src={selectedNpc.portraitUrl} alt={selectedNpc.fullName} className="w-full h-full object-contain" />
                ) : (
                  <span className="text-sm font-serif opacity-50">人物档案</span>
                )}
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <span className="px-2 py-0.5 rounded text-[10px] bg-fantasy-blue/20 border border-blue-400/30 text-blue-300">{selectedNpc.type}</span>
                  <h1 className="text-2xl md:text-3xl font-serif text-white tracking-widest leading-tight">{selectedNpc.fullName}</h1>
                </div>
                <div className="text-gray-400 text-sm mb-4">
                  {selectedNpc.race} / {selectedNpc.gender} / {selectedNpc.age}岁 / {selectedClass.name}
                </div>
                <div className="flex flex-col md:flex-row gap-2 md:gap-4">
                  <div className="text-xs text-gray-300 flex items-center gap-1 bg-black/40 px-3 py-1.5 rounded border border-white/10">
                    <MapPin className="w-3 h-3 text-fantasy-gold" /> 所属 {selectedNpc.affiliation}
                  </div>
                  <div className="text-xs text-gray-300 flex items-center gap-1 bg-black/40 px-3 py-1.5 rounded border border-white/10">
                    <Info className="w-3 h-3 text-fantasy-gold" /> 身份 {selectedNpc.identity}
                  </div>
                  <div className="text-xs text-gray-300 flex items-center gap-1 bg-black/40 px-3 py-1.5 rounded border border-white/10">
                    <Heart className="w-3 h-3 text-red-400" /> 好感 {selectedNpc.favorability} / {selectedNpc.relationshipStage}
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 border-b border-white/10 px-4 py-3 md:px-6">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {npcDetailPages.map(page => (
                  <button
                    key={page.id}
                    onClick={() => setDetailPage(page.id)}
                    className={`px-3 py-2 rounded border text-xs font-serif tracking-widest whitespace-nowrap ${detailPage === page.id ? 'border-fantasy-gold bg-fantasy-gold/15 text-fantasy-gold' : 'border-white/10 bg-black/20 text-gray-300 hover:border-fantasy-gold/40'}`}
                  >
                    {page.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5 md:p-8 flex-1 relative z-10 overflow-y-auto">
              {detailPage === 'stats' && (
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
              )}

              {detailPage === 'traits' && (
                <section className="space-y-4">
                  <h3 className="text-sm font-serif text-fantasy-gold pb-2 border-b border-white/10">情报特质</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedNpc.attributes.map((attr, idx) => (
                      <span key={idx} className="px-3 py-1 bg-fantasy-gold/10 text-fantasy-gold text-xs rounded border border-fantasy-gold/30">{attr}</span>
                    ))}
                  </div>
                </section>
              )}

              {detailPage === 'skills' && (
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
              )}

              {detailPage === 'equipment' && (
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
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
