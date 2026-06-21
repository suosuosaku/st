import { Activity, Archive, Heart, Shield, Sparkles, User, UserPlus, Zap } from 'lucide-react';
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AttributeKey, Character, Equipment, EquipmentLoadout, PlayerState, Skill } from '../../types';
import { EldredFrontendEventInput } from '../../game/eldredEvents';
import { formatEldredLocation } from '../../game/locationFormat';
import {
  getEldredAvatarRecord,
  getEldredAvatarScopeKey,
  readEldredAvatarFileAsDataUrl,
  removeEldredAvatarRecord,
  resolveSillyTavernUserAvatar,
  saveEldredAvatarRecord,
} from '../../game/avatarStorage';
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
type PartyDetailPage = 'summary' | 'attributes' | 'talents' | 'skills' | 'equipment' | 'relations';
type AvatarOwner = { ownerType: 'player' | 'npc'; ownerName: string };

const detailPages: { id: PartyDetailPage; label: string }[] = [
  { id: 'summary', label: '总览' },
  { id: 'attributes', label: '五维' },
  { id: 'talents', label: '天赋' },
  { id: 'skills', label: '技能' },
  { id: 'equipment', label: '装备' },
  { id: 'relations', label: '关系' },
];

type PartyPanelProps = {
  player: PlayerState;
  onUpdatePlayer: (updater: PlayerState | ((prev: PlayerState) => PlayerState)) => void;
  onUpdateNpcs?: (updater: Character[] | ((prev: Character[]) => Character[])) => void;
  npcs?: Character[];
  onSubmitEvent?: (event: Omit<EldredFrontendEventInput, 'player' | 'party' | 'enemies'>) => Promise<void>;
};

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

const avatarOwnerKey = (owner: AvatarOwner) => `${owner.ownerType}:${owner.ownerName}`;

export function PartyPanel({ player, onUpdatePlayer, onUpdateNpcs, npcs = EMPTY_NPCS, onSubmitEvent }: PartyPanelProps) {
  const [selectedId, setSelectedId] = useState('player');
  const [detailPage, setDetailPage] = useState<PartyDetailPage>('summary');
  const [avatarOverrides, setAvatarOverrides] = useState<Record<string, string>>({});
  const [portraitOverrides, setPortraitOverrides] = useState<Record<string, string>>({});
  const [playerDefaultAvatarUrl, setPlayerDefaultAvatarUrl] = useState('');
  const [npcStates, setNpcStates] = useState<Record<string, Character>>(() =>
    Object.fromEntries(npcs.map(npc => [npc.id, npc])),
  );
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const portraitFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNpcStates(Object.fromEntries(npcs.map(npc => [npc.id, npc])));
  }, [npcs]);

  const cls = getClassById(player.classId);
  const race = getRaceById(player.raceId);
  const playerLocationDisplay = formatEldredLocation(undefined, player.location);
  const rosterNpcs = useMemo(() => Object.values(npcStates), [npcStates]);
  const partyNpcs = useMemo(() => player.partyMemberIds
    .map(id => npcStates[id] || Object.values(npcStates).find(npc => npc.name === id || npc.fullName === id))
    .filter(defined), [npcStates, player.partyMemberIds]);
  const selectedNpc = selectedId === 'player' ? null : npcStates[selectedId] || Object.values(npcStates).find(npc => npc.name === selectedId || npc.fullName === selectedId) || null;
  const selectedAvatarOwner = useMemo(() => ({
    ownerType: selectedNpc ? 'npc' as const : 'player' as const,
    ownerName: selectedNpc?.name || 'player',
  }), [selectedNpc]);
  const selectedAvatarKey = avatarOwnerKey(selectedAvatarOwner);
  const playerAvatarKey = avatarOwnerKey({ ownerType: 'player', ownerName: 'player' });

  useEffect(() => {
    let ignore = false;
    const loadAvatar = async () => {
      try {
        const scopeKey = getEldredAvatarScopeKey();
        const [avatarRecord, portraitRecord, tavernAvatar] = await Promise.all([
          getEldredAvatarRecord(scopeKey, selectedAvatarOwner.ownerType, selectedAvatarOwner.ownerName, 'avatar'),
          getEldredAvatarRecord(scopeKey, selectedAvatarOwner.ownerType, selectedAvatarOwner.ownerName, 'portrait'),
          selectedAvatarOwner.ownerType === 'player' ? resolveSillyTavernUserAvatar() : Promise.resolve(''),
        ]);
        if (ignore) return;
        const ownerKey = avatarOwnerKey(selectedAvatarOwner);
        setAvatarOverrides(prev => ({ ...prev, [ownerKey]: avatarRecord?.value || '' }));
        setPortraitOverrides(prev => ({ ...prev, [ownerKey]: portraitRecord?.value || '' }));
        if (selectedAvatarOwner.ownerType === 'player') setPlayerDefaultAvatarUrl(tavernAvatar || '');
      } catch (error) {
        console.warn('[艾尔德雷德] 读取本地头像失败', error);
        if (ignore) return;
        const ownerKey = avatarOwnerKey(selectedAvatarOwner);
        setAvatarOverrides(prev => ({ ...prev, [ownerKey]: '' }));
        setPortraitOverrides(prev => ({ ...prev, [ownerKey]: '' }));
        if (selectedAvatarOwner.ownerType === 'player') setPlayerDefaultAvatarUrl('');
      }
    };
    void loadAvatar();
    return () => {
      ignore = true;
    };
  }, [selectedAvatarOwner.ownerName, selectedAvatarOwner.ownerType]);

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
      const next = { ...prev, [npcId]: updater(current) };
      onUpdateNpcs?.(Object.values(next));
      return next;
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
    const npc = npcStates[npcId];
    onUpdatePlayer(prev => {
      if (prev.partyMemberIds.includes(npcId) || prev.partyMemberIds.length >= 3) return prev;
      return { ...prev, partyMemberIds: [...prev.partyMemberIds, npcId] };
    });
    setSelectedId(npcId);
    submitPartyEvent(
      'party_update',
      `编入同行：${npc?.name || npcId}`,
      `将「${npc?.name || npcId}」编入当前队伍`,
      [`当前队伍人数：${1 + partyNpcs.length}/4`, `角色职业：${npc ? getClassById(npc.classId).name : '未登记'}`],
      { actor: player.name, target: npc?.name || npcId },
    );
  };

  const removeNpcFromParty = (npcId: string) => {
    const npc = npcStates[npcId];
    onUpdatePlayer(prev => ({ ...prev, partyMemberIds: prev.partyMemberIds.filter(id => id !== npcId) }));
    setSelectedId('player');
    submitPartyEvent(
      'party_update',
      `移出同行：${npc?.name || npcId}`,
      `将「${npc?.name || npcId}」移出当前队伍`,
      [`当前队伍人数：${1 + partyNpcs.length}/4`],
      { actor: player.name, target: npc?.name || npcId },
    );
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
        location: playerLocationDisplay.fullName,
        avatar: playerDefaultAvatarUrl,
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

  const selectedCustomAvatarUrl = avatarOverrides[selectedAvatarKey] || '';
  const selectedCustomPortraitUrl = portraitOverrides[selectedAvatarKey] || '';
  const selectedDisplayAvatar = selectedCustomPortraitUrl || selectedCustomAvatarUrl || selected.avatar;
  const playerListAvatar = avatarOverrides[playerAvatarKey] || playerDefaultAvatarUrl;

  const importSelectedImage = async (kind: 'avatar' | 'portrait', event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const value = await readEldredAvatarFileAsDataUrl(file);
      if (!value) return;
      const scopeKey = getEldredAvatarScopeKey();
      await saveEldredAvatarRecord({
        scopeKey,
        ownerType: selectedAvatarOwner.ownerType,
        ownerName: selectedAvatarOwner.ownerName,
        imageKind: kind,
        sourceType: 'upload',
        value,
      });
      const ownerKey = avatarOwnerKey(selectedAvatarOwner);
      if (kind === 'avatar') setAvatarOverrides(prev => ({ ...prev, [ownerKey]: value }));
      else setPortraitOverrides(prev => ({ ...prev, [ownerKey]: value }));
    } catch (error) {
      console.warn('[艾尔德雷德] 导入本地头像失败', error);
    }
  };

  const resetSelectedImages = async () => {
    try {
      await removeEldredAvatarRecord(
        getEldredAvatarScopeKey(),
        selectedAvatarOwner.ownerType,
        selectedAvatarOwner.ownerName,
      );
      const ownerKey = avatarOwnerKey(selectedAvatarOwner);
      setAvatarOverrides(prev => ({ ...prev, [ownerKey]: '' }));
      setPortraitOverrides(prev => ({ ...prev, [ownerKey]: '' }));
      if (selectedAvatarOwner.ownerType === 'player') {
        setPlayerDefaultAvatarUrl(await resolveSillyTavernUserAvatar());
      }
    } catch (error) {
      console.warn('[艾尔德雷德] 恢复默认头像失败', error);
    }
  };

  const activeSkills = selected.activeSkillIds.map(id => getSkillById(id)).filter(defined);
  const librarySkills = selected.knownSkillIds.map(id => getSkillById(id)).filter(defined);
  const equipmentItems = selected.equipmentIds.map(id => getEquipmentById(id)).filter(defined);
  const equippedIds = equippedIdsFromLoadout(selected.equipmentLoadout);
  const talents = player.talentIds.map(id => getTalentById(id)).filter(defined);

  const submitPartyEvent = (
    eventType: EldredFrontendEventInput['eventType'],
    title: string,
    playerIntent: string,
    extraFacts: string[] = [],
    extra?: Partial<Omit<EldredFrontendEventInput, 'eventType' | 'title' | 'playerIntent' | 'player' | 'party' | 'enemies' | 'extraFacts'>>,
  ) => {
    void onSubmitEvent?.({
      eventType,
      title,
      playerIntent,
      extraFacts,
      ...extra,
    });
  };

  const allocatePoint = (key: AttributeKey) => {
    if (selected.kind === 'player') onUpdatePlayer(prev => allocateAttributePoint(prev, key));
    else allocateNpcPoint(selected.id, key);
    submitPartyEvent(
      'attribute_allocate',
      `分配属性点：${selected.fullName}`,
      `${selected.fullName} 将1点可分配点投入${ATTRIBUTE_LABELS[key]}`,
      [`角色：${selected.fullName}`, `属性：${ATTRIBUTE_LABELS[key]}`, `剩余点数：${selected.availablePoints}`],
      { actor: selected.id, target: ATTRIBUTE_LABELS[key] },
    );
  };

  const toggleSkill = (skillId: string) => {
    const skill = getSkillById(skillId);
    if (selected.kind === 'player') togglePlayerSkill(skillId);
    else toggleNpcSkill(selected.id, skillId);
    const equipped = selected.activeSkillIds.includes(skillId);
    submitPartyEvent(
      'skill_change',
      `${equipped ? '卸下' : '装配'}技能：${skill?.name || skillId}`,
      `${selected.fullName} ${equipped ? '卸下' : '装配'}技能「${skill?.name || skillId}」`,
      [
        `角色：${selected.fullName}`,
        `技能：${skill?.name || skillId}`,
        `当前激活技能：${selected.activeSkillIds.map(id => getSkillById(id)?.name || id).join('、') || '无'}`,
        `激活上限：${ACTIVE_SKILL_LIMIT}`,
      ],
      { actor: selected.id, skillId },
    );
  };

  const forgetSkill = (skillId: string) => {
    const skill = getSkillById(skillId);
    if (selected.kind === 'player') forgetPlayerSkill(skillId);
    else forgetNpcSkill(selected.id, skillId);
    submitPartyEvent(
      'skill_change',
      `遗忘技能：${skill?.name || skillId}`,
      `${selected.fullName} 请求遗忘技能「${skill?.name || skillId}」`,
      [`角色：${selected.fullName}`, `技能：${skill?.name || skillId}`],
      { actor: selected.id, skillId },
    );
  };

  const toggleEquipment = (equipmentId: string) => {
    const item = getEquipmentById(equipmentId);
    if (selected.kind === 'player') togglePlayerEquipment(equipmentId);
    else toggleNpcEquipment(selected.id, equipmentId);
    const equipped = equippedIds.includes(equipmentId);
    const slotItemId = item ? selected.equipmentLoadout[item.slot] : undefined;
    const replacedItem = slotItemId && slotItemId !== equipmentId ? getEquipmentById(slotItemId) : undefined;
    submitPartyEvent(
      'equipment_change',
      `${equipped ? '拆卸' : '穿戴'}装备：${item?.name || equipmentId}`,
      `${selected.fullName} ${equipped ? '拆卸' : '穿戴'}装备「${item?.name || equipmentId}」`,
      [
        `角色：${selected.fullName}`,
        `装备：${item?.name || equipmentId}`,
        `槽位：${item ? equipmentSlotLabel[item.slot] || item.slot : '未知'}`,
        `同槽替换：${replacedItem?.name || '无'}`,
        `需求：${formatRequirements(item?.requirements)}`,
      ],
      { actor: selected.id, equipmentId },
    );
  };

  return (
    <div className="h-full w-full flex flex-col xl:flex-row gap-4 xl:gap-6 overflow-y-auto xl:overflow-hidden">
      <input
        ref={avatarFileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={event => void importSelectedImage('avatar', event)}
      />
      <input
        ref={portraitFileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={event => void importSelectedImage('portrait', event)}
      />
      <div className="w-full xl:w-72 max-h-[26rem] xl:max-h-none glass-panel rounded-xl flex flex-col overflow-hidden shrink-0">
        <div className="p-4 border-b border-fantasy-gold/20 flex justify-between items-center bg-fantasy-darker/50">
          <h2 className="text-xl font-serif text-fantasy-gold">队伍成员</h2>
          <span className="text-sm font-mono text-gray-400">{1 + partyNpcs.length} / 4</span>
        </div>
        <div className="p-3 space-y-2 flex-1 overflow-y-auto">
          <button onClick={() => setSelectedId('player')} className={`w-full p-3 rounded border flex gap-4 text-left ${selectedId === 'player' ? 'bg-fantasy-gold/10 border-fantasy-gold' : 'bg-black/20 border-white/5'}`}>
            <div className="w-12 h-12 bg-fantasy-darker rounded border border-fantasy-gold/50 flex items-center justify-center overflow-hidden shrink-0">
              {playerListAvatar ? (
                <img src={playerListAvatar} alt={player.name} className="w-full h-full object-cover" />
              ) : (
                <User className="text-fantasy-gold w-6 h-6" />
              )}
            </div>
            <div>
              <div className="text-sm text-white font-serif tracking-wide">{player.name}</div>
              <div className="text-xs text-gray-400">等级{player.level} / {cls.name}</div>
            </div>
          </button>
          {partyNpcs.map(npc => (
            (() => {
              const npcListAvatar = avatarOverrides[avatarOwnerKey({ ownerType: 'npc', ownerName: npc.name })] || npc.avatarUrl;
              return (
                <button key={npc.id} onClick={() => setSelectedId(npc.id)} className={`w-full p-3 rounded border flex gap-4 text-left ${selectedId === npc.id ? 'bg-fantasy-gold/10 border-fantasy-gold' : 'bg-black/20 border-white/5'}`}>
                  <div className="w-12 h-12 bg-fantasy-darker rounded border border-fantasy-gold/50 overflow-hidden shrink-0">
                    {npcListAvatar && <img src={npcListAvatar} alt={npc.name} className="w-full h-full object-cover" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm text-white font-serif tracking-wide truncate">{npc.name}</div>
                    <div className="text-xs text-gray-400 truncate">等级{npc.stats.level} / {npc.profession}</div>
                  </div>
                </button>
              );
            })()
          ))}

          <div className="pt-3 mt-3 border-t border-white/10">
            <div className="text-xs text-fantasy-gold mb-2">可收录同行</div>
            {rosterNpcs.filter(npc => !player.partyMemberIds.includes(npc.id) && !player.partyMemberIds.includes(npc.name)).length === 0 && (
              <div className="p-3 rounded bg-black/20 border border-white/5 text-xs text-gray-500">暂无可编入同行</div>
            )}
            {rosterNpcs.filter(npc => !player.partyMemberIds.includes(npc.id) && !player.partyMemberIds.includes(npc.name)).slice(0, 5).map(npc => (
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
            {selectedDisplayAvatar ? <img src={selectedDisplayAvatar} alt={selected.fullName} className="w-full h-full object-contain" /> : <span className="text-xs md:text-sm font-serif opacity-50">玩家</span>}
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
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <button onClick={() => avatarFileInputRef.current?.click()} className="px-2 py-1 rounded border border-fantasy-gold/40 text-fantasy-gold hover:bg-fantasy-gold/10">导入头像</button>
              <button onClick={() => portraitFileInputRef.current?.click()} className="px-2 py-1 rounded border border-fantasy-gold/40 text-fantasy-gold hover:bg-fantasy-gold/10">导入立绘</button>
              {(selectedCustomAvatarUrl || selectedCustomPortraitUrl) && (
                <button onClick={() => void resetSelectedImages()} className="px-2 py-1 rounded border border-white/20 text-gray-300 hover:border-fantasy-gold/40">恢复默认</button>
              )}
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

        <div className="relative z-10 border-b border-white/10 px-4 py-3 md:px-6">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {detailPages.map(page => (
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
          {detailPage === 'summary' && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="pixel-data-tile p-4"><div className="text-xs text-fantasy-gold mb-2">等级</div><div className="font-serif text-2xl text-white">Lv.{selected.level}</div></div>
              <div className="pixel-data-tile p-4"><div className="text-xs text-fantasy-gold mb-2">生命</div><div className="font-mono text-lg text-white">{selected.stats.hp}/{selected.stats.maxHp}</div></div>
              <div className="pixel-data-tile p-4"><div className="text-xs text-fantasy-gold mb-2">法力</div><div className="font-mono text-lg text-white">{selected.stats.mp}/{selected.stats.maxMp}</div></div>
              <div className="pixel-data-tile p-4"><div className="text-xs text-fantasy-gold mb-2">护甲</div><div className="font-mono text-lg text-white">{selected.stats.ac}</div></div>
              <div className="md:col-span-2 xl:col-span-4 grid gap-3 md:grid-cols-3">
                <div className="p-3 bg-black/30 border border-white/5 rounded text-sm text-gray-300">职业：{selected.className}</div>
                <div className="p-3 bg-black/30 border border-white/5 rounded text-sm text-gray-300">种族：{selected.raceName}</div>
                <div className="p-3 bg-black/30 border border-white/5 rounded text-sm text-gray-300">经验：{selected.experience}/{selected.nextExperience}</div>
              </div>
            </div>
          )}

          {detailPage === 'attributes' && (
            <section className="space-y-4">
              <h3 className="text-sm font-serif text-fantasy-gold flex items-center gap-2 pb-2 border-b border-white/10">
                <Activity className="w-4 h-4" />
                五维属性
              </h3>
              <div className="party-attribute-grid">
                {ATTRIBUTE_KEYS.map(key => (
                  <div key={key} className="party-attribute-card">
                    <div className="party-attribute-topline">
                      <span>{ATTRIBUTE_LABELS[key]}</span>
                      <div className="party-attribute-score">
                        <strong>{selected.stats[key]}</strong>
                        {selected.availablePoints > 0 && (
                          <button onClick={() => allocatePoint(key)} className="btn-rpg party-attribute-add">+</button>
                        )}
                      </div>
                    </div>
                    <div className="party-attribute-meter">
                      <div style={{ width: `${Math.min(100, (selected.stats[key] / 20) * 100)}%` }} />
                    </div>
                    <div className="party-attribute-impact">{attributeImpact[key]}</div>
                  </div>
                ))}
              </div>
              {selected.availablePoints > 0 && (
                <div className="p-3 bg-fantasy-gold/10 border border-fantasy-gold/30 rounded text-xs text-fantasy-gold">
                  可分配点数：{selected.availablePoints}
                </div>
              )}
            </section>
          )}

          {detailPage === 'talents' && (
            <section className="space-y-4">
              <h3 className="text-sm font-serif text-fantasy-gold pb-2 border-b border-white/10">光环与伴生天赋</h3>
              {selected.kind === 'player' ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="p-3 bg-black/30 border border-white/5 rounded">
                    <div className="text-sm text-gray-100 font-medium">{race.auraName}</div>
                    <div className="text-xs text-gray-500 mt-1">{race.auraEffect}</div>
                  </div>
                  <div className="p-3 bg-black/30 border border-white/5 rounded">
                    <div className="text-sm text-gray-100 font-medium">{cls.classAuraName}</div>
                    <div className="text-xs text-gray-500 mt-1">{cls.classAuraEffect}</div>
                  </div>
                  {talents.map(talent => (
                    <div key={talent.id} className="p-3 bg-black/30 border border-white/5 rounded">
                      <div className="flex justify-between text-sm text-gray-100 font-medium">
                        <span>{talent.name}</span>
                        <span className="text-fantasy-gold text-xs">{talent.rank}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{talent.effect}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-black/30 border border-white/5 rounded text-sm text-gray-400">NPC 天赋由职业、种族和已收录技能共同体现。</div>
              )}
            </section>
          )}

          {detailPage === 'equipment' && (
            <section className="space-y-4">
              <h3 className="text-sm font-serif text-fantasy-gold flex items-center gap-2 pb-2 border-b border-white/10">
                <Archive className="w-4 h-4" />
                装备
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {equipmentItems.map(item => {
                  const usable = selected.kind === 'player' ? canEquipEquipment(item, player) : canNpcEquip(item, selectedNpc!);
                  const equipped = equippedIds.includes(item.id);
                  const slotItemId = selected.equipmentLoadout[item.slot];
                  const replacedItem = slotItemId && slotItemId !== item.id ? getEquipmentById(slotItemId) : null;
                  return (
                    <div key={item.id} className={`p-3 bg-black/30 border rounded ${usable ? 'border-white/5' : 'border-fantasy-red/30'}`}>
                      <div className="flex justify-between gap-3 text-sm text-gray-100 font-medium mb-1">
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
          )}

          {detailPage === 'skills' && (
            <div className="grid gap-6 lg:grid-cols-2">
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
                        <div className="flex justify-between gap-3 text-sm text-gray-100 font-medium">
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
            </div>
          )}

          {detailPage === 'relations' && (
            <section className="space-y-4">
              <h3 className="text-sm font-serif text-fantasy-gold pb-2 border-b border-white/10">关系与声望</h3>
              {selected.kind === 'npc' ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="p-3 bg-black/30 border border-white/5 rounded text-sm text-gray-300">好感：{selected.favorability}</div>
                  <div className="p-3 bg-black/30 border border-white/5 rounded text-sm text-gray-300">关系：{selected.relation}</div>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {player.reputations.length === 0 && (
                    <div className="p-3 bg-black/30 border border-white/5 rounded text-xs text-gray-500">暂无地区声望记录</div>
                  )}
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
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
