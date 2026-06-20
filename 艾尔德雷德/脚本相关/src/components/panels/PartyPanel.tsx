import { Activity, Archive, Heart, Shield, Sparkles, User, UserPlus, Zap } from 'lucide-react';
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react';
import { AttributeKey, Character, Equipment, EquipmentLoadout, PlayerState, Skill } from '../../types';
import {
  ACTIVE_SKILL_LIMIT,
  ATTRIBUTE_KEYS,
  ATTRIBUTE_LABELS,
  allocateAttributePoint,
  calculateDerivedStats,
  canEquipEquipment,
  canUseSkill,
  equippedIdsFromLoadout,
  formatRequirements,
  getClassById,
  getEquipmentById,
  getRaceById,
  getSkillById,
  getTalentById,
  skillRankAvailableAtLevel,
} from '../../game/rules';

const defined = <T,>(value: T | undefined | null): value is T => Boolean(value);
const EMPTY_NPCS: Character[] = [];

const attributeImpact: Record<AttributeKey, string> = {
  str: '近战命中、近战伤害、推拉、负重、重武器与重甲需求。',
  dex: '护甲、先攻、远程命中、潜行、闪避、拆陷阱。',
  vit: '生命上限、疲劳、中毒、瘴气、伤病恢复和长途承压。',
  int: '法力、公式、炼金、机关、文书辨识和调查复核。',
  spr: '法力、治疗、净化、召唤、誓言、安抚和精神豁免。',
};

const equipmentSlotLabel: Record<string, string> = {
  weapon: '武器',
  upper: '上身',
  lower: '下身',
  hands: '手部',
  ring: '戒指',
  boots: '靴子',
  tool: '工具',
  shield: '盾牌',
};

const canNpcUseSkill = (skill: Skill, npc: Character) => {
  const level = npc.stats.level || 1;
  if (!skillRankAvailableAtLevel(skill.rank, level)) return false;
  if (npc.stats.mp < skill.mpCost) return false;
  if (skill.requirements?.level && level < skill.requirements.level) return false;
  if (skill.requirements?.equipmentTag) {
    const hasTag = equippedIdsFromLoadout(npc.equipmentLoadout)
      .map(id => getEquipmentById(id))
      .some(item => item?.tags.includes(skill.requirements!.equipmentTag!));
    if (!hasTag) return false;
  }
  return ATTRIBUTE_KEYS.every(key => {
    const required = skill.requirements?.[key];
    return required === undefined || npc.stats[key] >= required;
  });
};

const canNpcEquip = (equipment: Equipment, npc: Character) => {
  if (!equipment.requirements) return true;
  const level = npc.stats.level || 1;
  if (equipment.requirements.level && level < equipment.requirements.level) return false;
  return ATTRIBUTE_KEYS.every(key => {
    const required = equipment.requirements?.[key];
    return required === undefined || npc.stats[key] >= required;
  });
};

export function PartyPanel({ player, onUpdatePlayer, npcs = EMPTY_NPCS }: { player: PlayerState; onUpdatePlayer: Dispatch<SetStateAction<PlayerState>>; npcs?: Character[] }) {
  const [selectedId, setSelectedId] = useState('player');
  const [npcStates, setNpcStates] = useState<Record<string, Character>>(() =>
    Object.fromEntries(npcs.map(npc => [npc.id, npc])),
  );

  useEffect(() => {
    setNpcStates(Object.fromEntries(npcs.map(npc => [npc.id, npc])));
  }, [npcs]);

  const cls = getClassById(player.classId);
  const race = getRaceById(player.raceId);
  const rosterNpcs = useMemo(() => Object.values(npcStates), [npcStates]);
  const partyNpcs = useMemo(() => player.partyMemberIds.map(id => npcStates[id]).filter(defined), [npcStates, player.partyMemberIds]);
  const selectedNpc = selectedId === 'player' ? null : npcStates[selectedId] || null;

  const rebuildPlayer = (base: PlayerState, loadout: EquipmentLoadout = base.equipmentLoadout, baseAttributes = base.baseAttributes): PlayerState => ({
    ...base,
    baseAttributes,
    equipmentLoadout: loadout,
    stats: calculateDerivedStats(base.level, base.classId, baseAttributes, equippedIdsFromLoadout(loadout), base.raceId),
  });

  const updateNpc = (npcId: string, updater: (npc: Character) => Character) => {
    setNpcStates(prev => {
      const current = prev[npcId];
      if (!current) return prev;
      return { ...prev, [npcId]: updater(current) };
    });
  };

  const rebuildNpc = (npc: Character, loadout: EquipmentLoadout = npc.equipmentLoadout, statsOverride?: Partial<Character['stats']>): Character => {
    const level = npc.stats.level || 1;
    const derived = calculateDerivedStats(
      level,
      npc.classId,
      {
        str: statsOverride?.str ?? npc.stats.str,
        dex: statsOverride?.dex ?? npc.stats.dex,
        vit: statsOverride?.vit ?? npc.stats.vit,
        int: statsOverride?.int ?? npc.stats.int,
        spr: statsOverride?.spr ?? npc.stats.spr,
      },
      equippedIdsFromLoadout(loadout),
      npc.raceId || 'human',
    );
    return { ...npc, equipmentLoadout: loadout, stats: { ...derived, ...statsOverride } };
  };

  const addNpcToParty = (npcId: string) => {
    onUpdatePlayer(prev => {
      if (prev.partyMemberIds.includes(npcId) || prev.partyMemberIds.length >= 3) return prev;
      return { ...prev, partyMemberIds: [...prev.partyMemberIds, npcId] };
    });
    setSelectedId(npcId);
  };

  const removeNpcFromParty = (npcId: string) => {
    onUpdatePlayer(prev => ({ ...prev, partyMemberIds: prev.partyMemberIds.filter(id => id !== npcId) }));
    setSelectedId('player');
  };

  const togglePlayerSkill = (skillId: string) => {
    onUpdatePlayer(prev => {
      const skill = getSkillById(skillId);
      if (prev.activeSkillIds.includes(skillId)) {
        return { ...prev, activeSkillIds: prev.activeSkillIds.filter(id => id !== skillId) };
      }
      if (!skill || !canUseSkill(skill, prev) || prev.activeSkillIds.length >= ACTIVE_SKILL_LIMIT) return prev;
      return { ...prev, activeSkillIds: [...prev.activeSkillIds, skillId] };
    });
  };

  const forgetPlayerSkill = (skillId: string) => {
    onUpdatePlayer(prev => ({
      ...prev,
      activeSkillIds: prev.activeSkillIds.filter(id => id !== skillId),
      knownSkillIds: prev.knownSkillIds.filter(id => id !== skillId),
    }));
  };

  const togglePlayerEquipment = (equipmentId: string) => {
    onUpdatePlayer(prev => {
      const item = getEquipmentById(equipmentId);
      if (!item) return prev;
      const nextLoadout = { ...prev.equipmentLoadout };
      if (nextLoadout[item.slot] === equipmentId) {
        delete nextLoadout[item.slot];
        return rebuildPlayer(prev, nextLoadout);
      }
      if (!canEquipEquipment(item, prev)) return prev;
      nextLoadout[item.slot] = equipmentId;
      return rebuildPlayer(prev, nextLoadout);
    });
  };

  const toggleNpcSkill = (npcId: string, skillId: string) => {
    updateNpc(npcId, npc => {
      const skill = getSkillById(skillId);
      if (npc.activeSkillIds.includes(skillId)) return { ...npc, activeSkillIds: npc.activeSkillIds.filter(id => id !== skillId) };
      if (!skill || !canNpcUseSkill(skill, npc) || npc.activeSkillIds.length >= ACTIVE_SKILL_LIMIT) return npc;
      return { ...npc, activeSkillIds: [...npc.activeSkillIds, skillId] };
    });
  };

  const forgetNpcSkill = (npcId: string, skillId: string) => {
    updateNpc(npcId, npc => ({
      ...npc,
      activeSkillIds: npc.activeSkillIds.filter(id => id !== skillId),
      knownSkillIds: npc.knownSkillIds.filter(id => id !== skillId),
      skills: npc.skills.filter(skill => skill.id !== skillId),
    }));
  };

  const toggleNpcEquipment = (npcId: string, equipmentId: string) => {
    updateNpc(npcId, npc => {
      const item = getEquipmentById(equipmentId);
      if (!item) return npc;
      const nextLoadout = { ...npc.equipmentLoadout };
      if (nextLoadout[item.slot] === equipmentId) {
        delete nextLoadout[item.slot];
        return rebuildNpc(npc, nextLoadout);
      }
      if (!canNpcEquip(item, npc)) return npc;
      nextLoadout[item.slot] = equipmentId;
      return rebuildNpc(npc, nextLoadout);
    });
  };

  const allocateNpcPoint = (npcId: string, key: AttributeKey) => {
    updateNpc(npcId, npc => {
      if (npc.availableAttributePoints <= 0 || npc.stats[key] >= 20) return npc;
      const rebuilt = rebuildNpc(npc, npc.equipmentLoadout, { [key]: npc.stats[key] + 1 } as Partial<Character['stats']>);
      return { ...rebuilt, availableAttributePoints: Math.max(0, npc.availableAttributePoints - 1) };
    });
  };

  const selected = selectedNpc
    ? {
        kind: 'npc' as const,
        id: selectedNpc.id,
        name: selectedNpc.name,
        fullName: selectedNpc.fullName,
        raceName: selectedNpc.race,
        className: getClassById(selectedNpc.classId).name,
        location: selectedNpc.affiliation,
        avatar: selectedNpc.portraitUrl || selectedNpc.avatarUrl,
        level: selectedNpc.stats.level || 1,
        experience: selectedNpc.experience,
        nextExperience: selectedNpc.nextLevelExperience,
        availablePoints: selectedNpc.availableAttributePoints,
        stats: selectedNpc.stats,
        activeSkillIds: selectedNpc.activeSkillIds,
        knownSkillIds: selectedNpc.knownSkillIds,
        equipmentIds: selectedNpc.equipmentIds,
        equipmentLoadout: selectedNpc.equipmentLoadout,
        favorability: selectedNpc.favorability,
        relation: selectedNpc.relationshipStage,
      }
    : {
        kind: 'player' as const,
        id: 'player',
        name: player.name,
        fullName: player.name,
        raceName: race.name,
        className: cls.name,
        location: player.location.name,
        avatar: '',
        level: player.level,
        experience: player.experience,
        nextExperience: player.nextLevelExperience,
        availablePoints: player.availableAttributePoints,
        stats: player.stats,
        activeSkillIds: player.activeSkillIds,
        knownSkillIds: player.knownSkillIds,
        equipmentIds: player.equipmentIds,
        equipmentLoadout: player.equipmentLoadout,
        favorability: 0,
        relation: '自身',
      };

  const activeSkills = selected.activeSkillIds.map(id => getSkillById(id)).filter(defined);
  const librarySkills = selected.knownSkillIds.map(id => getSkillById(id)).filter(defined);
  const equipmentItems = selected.equipmentIds.map(id => getEquipmentById(id)).filter(defined);
  const equippedIds = equippedIdsFromLoadout(selected.equipmentLoadout);
  const talents = player.talentIds.map(id => getTalentById(id)).filter(defined);

  const allocatePoint = (key: AttributeKey) => {
    if (selected.kind === 'player') onUpdatePlayer(prev => allocateAttributePoint(prev, key));
    else allocateNpcPoint(selected.id, key);
  };

  const toggleSkill = (skillId: string) => {
    if (selected.kind === 'player') togglePlayerSkill(skillId);
    else toggleNpcSkill(selected.id, skillId);
  };

  const forgetSkill = (skillId: string) => {
    if (selected.kind === 'player') forgetPlayerSkill(skillId);
    else forgetNpcSkill(selected.id, skillId);
  };

  const toggleEquipment = (equipmentId: string) => {
    if (selected.kind === 'player') togglePlayerEquipment(equipmentId);
    else toggleNpcEquipment(selected.id, equipmentId);
  };

  return (
    <div className="h-full w-full flex flex-col xl:flex-row gap-4 xl:gap-6 overflow-y-auto xl:overflow-hidden">
      <div className="w-full xl:w-72 max-h-[26rem] xl:max-h-none glass-panel rounded-xl flex flex-col overflow-hidden shrink-0">
        <div className="p-4 border-b border-fantasy-gold/20 flex justify-between items-center bg-fantasy-darker/50">
          <h2 className="text-xl font-serif text-fantasy-gold">队伍成员</h2>
          <span className="text-sm font-mono text-gray-400">{1 + partyNpcs.length} / 4</span>
        </div>
        <div className="p-3 space-y-2 flex-1 overflow-y-auto">
          <button onClick={() => setSelectedId('player')} className={`w-full p-3 rounded border flex gap-4 text-left ${selectedId === 'player' ? 'bg-fantasy-gold/10 border-fantasy-gold' : 'bg-black/20 border-white/5'}`}>
            <div className="w-12 h-12 bg-fantasy-darker rounded border border-fantasy-gold/50 flex items-center justify-center">
              <User className="text-fantasy-gold w-6 h-6" />
            </div>
            <div>
              <div className="text-sm text-white font-serif tracking-wide">{player.name}</div>
              <div className="text-xs text-gray-400">等级{player.level} / {cls.name}</div>
            </div>
          </button>
          {partyNpcs.map(npc => (
            <button key={npc.id} onClick={() => setSelectedId(npc.id)} className={`w-full p-3 rounded border flex gap-4 text-left ${selectedId === npc.id ? 'bg-fantasy-gold/10 border-fantasy-gold' : 'bg-black/20 border-white/5'}`}>
              <div className="w-12 h-12 bg-fantasy-darker rounded border border-fantasy-gold/50 overflow-hidden shrink-0">
                {npc.avatarUrl && <img src={npc.avatarUrl} alt={npc.name} className="w-full h-full object-cover" />}
              </div>
              <div className="min-w-0">
                <div className="text-sm text-white font-serif tracking-wide truncate">{npc.name}</div>
                <div className="text-xs text-gray-400 truncate">等级{npc.stats.level} / {npc.profession}</div>
              </div>
            </button>
          ))}

          <div className="pt-3 mt-3 border-t border-white/10">
            <div className="text-xs text-fantasy-gold mb-2">可收录同行</div>
            {rosterNpcs.filter(npc => !player.partyMemberIds.includes(npc.id)).length === 0 && (
              <div className="p-3 rounded bg-black/20 border border-white/5 text-xs text-gray-500">暂无可编入同行</div>
            )}
            {rosterNpcs.filter(npc => !player.partyMemberIds.includes(npc.id)).slice(0, 5).map(npc => (
              <button key={npc.id} onClick={() => addNpcToParty(npc.id)} className="w-full p-2 rounded bg-black/30 border border-white/5 hover:border-fantasy-gold/30 flex items-center justify-between text-left mb-2">
                <span className="text-xs text-gray-300">{npc.name}</span>
                <UserPlus className="w-3 h-3 text-fantasy-gold" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-[720px] xl:min-h-0 glass-panel rounded-xl flex flex-col overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Shield className="w-64 h-64 text-fantasy-gold" />
        </div>

        <div className="p-5 md:p-8 border-b border-white/10 relative z-10 flex flex-col sm:flex-row gap-5 md:gap-8">
          <div className="w-24 h-24 md:w-32 md:h-32 bg-fantasy-darker border-2 border-fantasy-gold rounded flex items-center justify-center text-fantasy-gold shadow-lg shadow-black overflow-hidden shrink-0">
            {selected.avatar ? <img src={selected.avatar} alt={selected.fullName} className="w-full h-full object-contain" /> : <span className="text-xs md:text-sm font-serif opacity-50">玩家</span>}
          </div>
          <div className="flex flex-col justify-center min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <span className="px-2 py-0.5 rounded text-[10px] border border-gray-400 text-gray-400">{selected.kind === 'player' ? '玩家' : '同行'}</span>
              <h1 className="text-xl md:text-3xl font-serif text-white tracking-widest">{selected.fullName}</h1>
            </div>
            <div className="text-gray-400 text-sm mb-4">{selected.raceName} / {selected.className} / {selected.location}</div>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2"><Heart className="w-4 h-4 text-red-400" /><span className="text-sm font-mono text-gray-300">{selected.stats.hp} / {selected.stats.maxHp}</span></div>
              <div className="flex items-center gap-2"><Zap className="w-4 h-4 text-blue-400" /><span className="text-sm font-mono text-gray-300">{selected.stats.mp} / {selected.stats.maxMp}</span></div>
              <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-fantasy-gold" /><span className="text-sm font-mono text-gray-300">护甲 {selected.stats.ac}</span></div>
              <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-fantasy-gold" /><span className="text-sm font-mono text-gray-300">{selected.experience}/{selected.nextExperience}</span></div>
            </div>
            {selected.kind === 'npc' && (
              <div className="mt-3 flex gap-2 text-xs">
                <span className="px-2 py-1 rounded bg-black/40 border border-white/10 text-gray-300">好感 {selected.favorability}</span>
                <span className="px-2 py-1 rounded bg-black/40 border border-white/10 text-gray-300">{selected.relation}</span>
                <button onClick={() => removeNpcFromParty(selected.id)} className="px-2 py-1 rounded border border-fantasy-red/40 text-fantasy-red hover:bg-fantasy-red/10">移出队伍</button>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 md:p-8 flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 relative z-10 overflow-y-auto">
          <div className="space-y-6">
            <section className="space-y-4">
              <h3 className="text-sm font-serif text-fantasy-gold flex items-center gap-2 pb-2 border-b border-white/10">
                <Activity className="w-4 h-4" />
                五维属性
              </h3>
              <div className="grid gap-3">
                {ATTRIBUTE_KEYS.map(key => (
                  <div key={key} className="p-2 bg-white/5 rounded">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">{ATTRIBUTE_LABELS[key]}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-white text-lg">{selected.stats[key]}</span>
                        {selected.availablePoints > 0 && (
                          <button onClick={() => allocatePoint(key)} className="btn-rpg w-7 h-7 rounded flex items-center justify-center text-xs">+</button>
                        )}
                      </div>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1">{attributeImpact[key]}</div>
                  </div>
                ))}
              </div>
              {selected.availablePoints > 0 && (
                <div className="p-3 bg-fantasy-gold/10 border border-fantasy-gold/30 rounded text-xs text-fantasy-gold">
                  可分配点数：{selected.availablePoints}
                </div>
              )}
            </section>

            {selected.kind === 'player' && (
              <section className="space-y-4">
                <h3 className="text-sm font-serif text-fantasy-gold pb-2 border-b border-white/10">光环与伴生天赋</h3>
                <div className="space-y-2">
                  <div className="p-3 bg-black/30 border border-white/5 rounded">
                    <div className="text-sm text-gray-200 font-medium">{race.auraName}</div>
                    <div className="text-xs text-gray-500 mt-1">{race.auraEffect}</div>
                  </div>
                  <div className="p-3 bg-black/30 border border-white/5 rounded">
                    <div className="text-sm text-gray-200 font-medium">{cls.classAuraName}</div>
                    <div className="text-xs text-gray-500 mt-1">{cls.classAuraEffect}</div>
                  </div>
                  {talents.map(talent => (
                    <div key={talent.id} className="p-3 bg-black/30 border border-white/5 rounded">
                      <div className="flex justify-between text-sm text-gray-200 font-medium">
                        <span>{talent.name}</span>
                        <span className="text-fantasy-gold text-xs">{talent.rank}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{talent.effect}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-4">
              <h3 className="text-sm font-serif text-fantasy-gold flex items-center gap-2 pb-2 border-b border-white/10">
                <Archive className="w-4 h-4" />
                装备
              </h3>
              <div className="space-y-2">
                {equipmentItems.map(item => {
                  const usable = selected.kind === 'player' ? canEquipEquipment(item, player) : canNpcEquip(item, selectedNpc!);
                  const equipped = equippedIds.includes(item.id);
                  const slotItemId = selected.equipmentLoadout[item.slot];
                  const replacedItem = slotItemId && slotItemId !== item.id ? getEquipmentById(slotItemId) : null;
                  return (
                    <div key={item.id} className={`p-3 bg-black/30 border rounded ${usable ? 'border-white/5' : 'border-fantasy-red/30'}`}>
                      <div className="flex justify-between gap-3 text-sm text-gray-200 font-medium mb-1">
                        <span>{item.name}</span>
                        <span className="text-fantasy-gold text-xs">{item.grade}</span>
                      </div>
                      <div className="text-xs text-gray-500">{item.traits.join('；')}</div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                        <span className={usable ? 'text-green-300/80' : 'text-fantasy-red'}>{usable ? '可完整发挥' : '未达需求'}</span>
                        <span className="text-gray-500">槽位：{equipmentSlotLabel[item.slot] || item.slot}</span>
                        <span className="text-gray-500">需求：{formatRequirements(item.requirements)}</span>
                        {replacedItem && <span className="text-fantasy-gold">穿戴将替换：{replacedItem.name}</span>}
                      </div>
                      <button onClick={() => toggleEquipment(item.id)} disabled={!equipped && !usable} className="btn-rpg mt-3 px-3 py-1.5 rounded text-xs disabled:opacity-30">
                        {equipped ? '拆卸' : '穿戴'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="space-y-4">
              <h3 className="text-sm font-serif text-fantasy-gold pb-2 border-b border-white/10">激活技能 {selected.activeSkillIds.length} / {ACTIVE_SKILL_LIMIT}</h3>
              <div className="space-y-2">
                {activeSkills.map(skill => (
                  <button key={skill.id} onClick={() => toggleSkill(skill.id)} className="w-full text-left p-3 bg-fantasy-gold/10 border border-fantasy-gold/30 rounded hover:bg-fantasy-gold/20">
                    <div className="flex justify-between text-sm text-white font-medium mb-1">
                      <span>{skill.name}</span>
                      <span className="text-fantasy-gold text-xs">{skill.rank} / {skill.mpCost}法力</span>
                    </div>
                    <div className="text-xs text-gray-500">{skill.desc}</div>
                    <div className="text-[11px] text-gray-500 mt-2">需求：{formatRequirements(skill.requirements)}</div>
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-serif text-fantasy-gold pb-2 border-b border-white/10">技能库</h3>
              <div className="space-y-2">
                {librarySkills.length === 0 && (
                  <div className="p-3 bg-black/30 border border-white/5 rounded text-xs text-gray-500">暂无技能</div>
                )}
                {librarySkills.map(skill => {
                  const equipped = selected.activeSkillIds.includes(skill.id);
                  const usable = selected.kind === 'player' ? canUseSkill(skill, player) : canNpcUseSkill(skill, selectedNpc!);
                  return (
                    <div key={skill.id} className={`p-3 bg-black/30 border rounded ${usable ? 'border-white/5' : 'border-fantasy-red/30'}`}>
                      <div className="flex justify-between gap-3 text-sm text-gray-200 font-medium">
                        <span>{skill.name}</span>
                        <span className="text-fantasy-gold text-xs">{skill.rank} / {skill.mpCost}法力</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{skill.desc}</div>
                      <div className="text-[11px] text-gray-500 mt-2">
                        {usable ? '当前可用' : '未达等级/属性/法力/装备需求'} / 需求：{formatRequirements(skill.requirements)}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => toggleSkill(skill.id)} disabled={!equipped && !usable} className="btn-rpg px-3 py-1.5 rounded text-xs disabled:opacity-30">
                          {equipped ? '卸下' : '装配'}
                        </button>
                        {!equipped && (
                          <button onClick={() => forgetSkill(skill.id)} className="px-3 py-1.5 rounded text-xs border border-white/10 text-gray-400 hover:text-gray-200 hover:bg-white/5">
                            遗忘
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {selected.kind === 'player' && (
              <section className="space-y-4">
                <h3 className="text-sm font-serif text-fantasy-gold pb-2 border-b border-white/10">地区声望</h3>
                <div className="space-y-2">
                  {player.reputations.map(rep => (
                    <div key={rep.regionId} className="p-3 bg-black/30 border border-white/5 rounded">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-200">{rep.label}</span>
                        <span className="text-fantasy-gold">{rep.value}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{rep.tier}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
