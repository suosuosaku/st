import { useEffect, useMemo, useState } from 'react';
import { Info, Play, RefreshCcw, Shield as ShieldIcon, Sword } from 'lucide-react';
import { motion } from 'motion/react';
import { Character, CombatUnit, PlayerState, Skill } from '../../types';
import { equippedIdsFromLoadout, getClassById, getEquipmentById, getSkillById, playerToCombatUnit } from '../../game/rules';
import { EldredFrontendEventInput } from '../../game/eldredEvents';
import { EldredRuntimeSave } from '../../game/eldredSave';
import { formatEldredLocation } from '../../game/locationFormat';

type CombatLog = {
  id: string;
  actor: string;
  action: string;
  result: string;
  color?: string;
};

type CombatCommandKind = 'attack' | 'guard' | 'escape' | 'skill';

type PendingCombatCommand = {
  id: string;
  actorId: string;
  actorName: string;
  kind: CombatCommandKind;
  label: string;
  targetId?: string;
  targetName?: string;
  skillId?: string;
  skillName?: string;
  facts: string[];
};

const commandLabel: Record<CombatCommandKind, string> = {
  attack: '普通攻击',
  guard: '防御',
  escape: '撤离',
  skill: '技能',
};

const EMPTY_NPCS: Character[] = [];
const EMPTY_COMBAT_UNITS: CombatUnit[] = [];
const EMPTY_LOGS: string[] = [];

type CombatPanelProps = {
  player: PlayerState;
  partyNpcs?: Character[];
  enemyUnits?: CombatUnit[];
  initialTurn?: number;
  initialLogs?: string[];
  runtime?: EldredRuntimeSave;
  onSubmitEvent?: (event: Omit<EldredFrontendEventInput, 'player' | 'party' | 'enemies'>) => Promise<void>;
};

const npcToCombatUnit = (npc: Character): CombatUnit => {
  return {
    id: npc.id,
    name: `${npc.name}（${getClassById(npc.classId).name}）`,
    isEnemy: false,
    level: npc.stats.level || 1,
    hp: npc.stats.hp,
    maxHp: npc.stats.maxHp,
    mp: npc.stats.mp,
    maxMp: npc.stats.maxMp,
    ac: npc.stats.ac,
    stats: {
      str: npc.stats.str,
      dex: npc.stats.dex,
      vit: npc.stats.vit,
      int: npc.stats.int,
      spr: npc.stats.spr,
    },
    skillIds: npc.activeSkillIds,
    equipmentIds: equippedIdsFromLoadout(npc.equipmentLoadout),
    ap: 1,
    maxAp: 1,
    shield: 0,
    statusLogs: [`等级${npc.stats.level || 1}`, npc.profession],
  };
};

const unitSummary = (unit: CombatUnit) => {
  const equipment = (unit.equipmentIds || [])
    .map(id => getEquipmentById(id)?.name || id)
    .join('、') || '无';
  const skills = unit.skillIds
    .map(id => getSkillById(id)?.name || id)
    .join('、') || '无';
  return `${unit.name}｜等级${unit.level}｜生命${unit.hp}/${unit.maxHp}｜法力${unit.mp}/${unit.maxMp}｜护甲${unit.ac}｜力量${unit.stats.str}/敏捷${unit.stats.dex}/体质${unit.stats.vit}/智力${unit.stats.int}/精神${unit.stats.spr}｜装备${equipment}｜技能${skills}｜状态${unit.statusLogs.join('、') || '无'}`;
};

const skillTargetIsAlly = (skill?: Skill) =>
  Boolean(skill && ['support', 'heal', 'reaction'].includes(skill.actionType));

const normalizeUnitName = (name: string) =>
  String(name || '')
    .replace(/[（）()].*?[）)]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();

export function CombatPanel({
  player,
  partyNpcs = EMPTY_NPCS,
  enemyUnits = EMPTY_COMBAT_UNITS,
  initialTurn = 1,
  initialLogs = EMPTY_LOGS,
  runtime,
  onSubmitEvent,
}: CombatPanelProps) {
  const initialUnits = useMemo(() => {
    const party = partyNpcs.map(npcToCombatUnit);
    const allyNames = new Set([
      normalizeUnitName(player.name),
      normalizeUnitName(player.identity.name),
      '{{user}}',
      '主角',
      '玩家',
      ...party.map(unit => normalizeUnitName(unit.name)),
      ...partyNpcs.map(npc => normalizeUnitName(npc.name)),
    ].filter(Boolean));
    const enemies = enemyUnits.filter(unit => unit.isEnemy && !allyNames.has(normalizeUnitName(unit.name)));
    return [playerToCombatUnit(player), ...party, ...enemies];
  }, [enemyUnits, partyNpcs, player]);

  const [units, setUnits] = useState<CombatUnit[]>(initialUnits);
  const [selectedActorId, setSelectedActorId] = useState('player');
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [selectedAllyTargetId, setSelectedAllyTargetId] = useState('player');
  const [selectedSkillId, setSelectedSkillId] = useState(player.activeSkillIds[0] || '');
  const [turn, setTurn] = useState(initialTurn);
  const [pendingCommands, setPendingCommands] = useState<Record<string, PendingCombatCommand[]>>({});
  const [logs, setLogs] = useState<CombatLog[]>(() =>
    initialLogs.map((result, index) => ({ id: `mvu-${index}`, actor: '[变量]', action: '回合记录', result })),
  );

  useEffect(() => {
    setUnits(initialUnits);
    setSelectedActorId(current => {
      const currentStillValid = initialUnits.some(unit => !unit.isEnemy && unit.id === current);
      return currentStillValid ? current : initialUnits.find(unit => !unit.isEnemy)?.id || 'player';
    });
    setSelectedTargetId(current => {
      const currentStillValid = initialUnits.some(unit => unit.isEnemy && unit.id === current);
      return currentStillValid ? current : initialUnits.find(unit => unit.isEnemy)?.id || '';
    });
    setSelectedAllyTargetId(current => {
      const currentStillValid = initialUnits.some(unit => !unit.isEnemy && unit.id === current);
      return currentStillValid ? current : initialUnits.find(unit => !unit.isEnemy)?.id || 'player';
    });
  }, [initialUnits]);

  useEffect(() => {
    setTurn(initialTurn);
    setPendingCommands({});
    setLogs(initialLogs.map((result, index) => ({ id: `mvu-${index}`, actor: '[变量]', action: '回合记录', result })));
  }, [initialLogs, initialTurn]);

  const players = units.filter(unit => !unit.isEnemy);
  const enemies = units.filter(unit => unit.isEnemy);
  const selectedActor = units.find(unit => unit.id === selectedActorId) || players[0];
  const selectedSkill = getSkillById(selectedSkillId);
  const selectedSkillTargetsAlly = skillTargetIsAlly(selectedSkill);
  const selectedTarget = selectedSkillTargetsAlly
    ? units.find(unit => unit.id === selectedAllyTargetId) || selectedActor
    : units.find(unit => unit.id === selectedTargetId) || enemies[0];
  const locationDisplay = formatEldredLocation(runtime?.world, player.location);
  const queuedCommandList = players.flatMap(unit => pendingCommands[unit.id] || []);
  const allPlayersReady = players.length > 0 && players.every(unit => (pendingCommands[unit.id]?.length || 0) > 0);

  const actorSkills = useMemo(
    () => selectedActor?.skillIds
      .map(id => getSkillById(id))
      .filter((skill): skill is Skill => Boolean(skill)) || [],
    [selectedActor],
  );

  useEffect(() => {
    if (!selectedActor) return;
    const firstSkill = actorSkills[0]?.id || '';
    setSelectedSkillId(current => actorSkills.some(skill => skill.id === current) ? current : firstSkill);
  }, [selectedActor?.id, actorSkills]);

  const addLog = (entry: Omit<CombatLog, 'id'>) => {
    setLogs(prev => [{ ...entry, id: `${Date.now()}-${Math.random()}` }, ...prev].slice(0, 12));
  };

  const resetCombat = () => {
    setUnits(initialUnits);
    setTurn(initialTurn);
    setPendingCommands({});
    setLogs(initialLogs.map((result, index) => ({ id: `mvu-${index}`, actor: '[变量]', action: '回合记录', result })));
  };

  const skillExtraActionSlots = (skill?: Skill) => {
    if (!skill) return 1;
    const text = `${skill.name} ${skill.desc} ${skill.target}`;
    return /额外行动|追加行动|再次行动|再行动|行动次数\s*[+＋]\s*1|获得\s*1\s*次行动/.test(text) ? 2 : 1;
  };

  const commandFacts = (kind: CombatCommandKind) => {
    const facts = [
      `回合：${turn}`,
      `行动者：${selectedActor?.name || '未选择'}`,
      `行动：${kind === 'skill' && selectedSkill ? `使用${selectedSkill.name}` : commandLabel[kind]}`,
      `目标：${selectedTarget?.name || '待正文确认'}`,
      `地点：${locationDisplay.fullName}`,
      `主角方：${players.map(unitSummary).join('；') || '无'}`,
      `敌方：${enemies.map(unitSummary).join('；') || '无'}`,
    ];
    if (kind === 'skill' && selectedSkill) {
      facts.push(`技能：${selectedSkill.name}｜${selectedSkill.rank}｜消耗${selectedSkill.mpCost}法力｜属性${selectedSkill.attribute}｜目标${selectedSkill.target}｜效果${selectedSkill.desc}`);
    }
    return facts;
  };

  const queueCommand = (kind: CombatCommandKind) => {
    if (!selectedActor) return;
    if ((kind === 'attack' || (kind === 'skill' && !selectedSkillTargetsAlly)) && !selectedTarget) {
      addLog({ actor: '[战斗台]', action: '缺少目标', result: '当前没有可提交的敌方单位。', color: 'text-fantasy-red' });
      return;
    }
    if (kind === 'skill' && !selectedSkill) {
      addLog({ actor: '[战斗台]', action: '缺少技能', result: '当前行动者没有可提交技能。', color: 'text-fantasy-red' });
      return;
    }
    if (kind === 'skill' && selectedSkill && selectedActor.mp < selectedSkill.mpCost) {
      addLog({ actor: '[战斗台]', action: '资源不足', result: `${selectedActor.name} 当前法力 ${selectedActor.mp}/${selectedSkill.mpCost}。`, color: 'text-fantasy-red' });
      return;
    }
    if (kind === 'escape' && selectedActor.id !== 'player') {
      addLog({ actor: '[战斗台]', action: '撤离受限', result: '撤离指令只由主角发起；同伴可选择防御或技能支援。', color: 'text-fantasy-red' });
      return;
    }

    const skillActionSlots = kind === 'skill' ? skillExtraActionSlots(selectedSkill) : 1;
    const command: PendingCombatCommand = {
      id: `${selectedActor.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      actorId: selectedActor.id,
      actorName: selectedActor.name,
      kind,
      label: kind === 'skill' && selectedSkill ? `使用「${selectedSkill.name}」` : commandLabel[kind],
      targetId: selectedTarget?.id,
      targetName: selectedTarget?.name,
      skillId: kind === 'skill' ? selectedSkill?.id : undefined,
      skillName: kind === 'skill' ? selectedSkill?.name : undefined,
      facts: commandFacts(kind),
    };

    setPendingCommands(prev => {
      const current = prev[selectedActor.id] || [];
      const currentSlots = Math.max(
        selectedActor.maxAp || 1,
        current.reduce((max, item) => Math.max(max, skillExtraActionSlots(item.skillId ? getSkillById(item.skillId) : undefined)), 1),
        skillActionSlots,
      );
      const nextForActor = current.length >= currentSlots
        ? [...current.slice(0, Math.max(0, currentSlots - 1)), command]
        : [...current, command];
      return { ...prev, [selectedActor.id]: nextForActor };
    });

    addLog({
      actor: `[${selectedActor.name}]`,
      action: '暂存指令',
      result: `${command.label}。目标：${selectedTarget?.name || '待定'}。`,
      color: kind === 'skill' ? 'text-fantasy-gold' : undefined,
    });
  };

  const submitRound = async () => {
    if (!allPlayersReady) {
      const missing = players
        .filter(unit => !(pendingCommands[unit.id]?.length))
        .map(unit => unit.name)
        .join('、') || '友方';
      addLog({ actor: '[战斗台]', action: '缺少指令', result: `${missing} 尚未暂存本回合行动。`, color: 'text-fantasy-red' });
      return;
    }

    const commands = players.flatMap(unit => pendingCommands[unit.id] || []);
    const commandSummary = commands
      .map((command, index) => `${index + 1}. ${command.actorName}${command.label}${command.targetName ? `→${command.targetName}` : ''}`)
      .join('；');
    let status = '已提交正文结算';
    if (onSubmitEvent) {
      await onSubmitEvent({
        eventType: 'combat_command',
        title: `回合${turn}：全队行动`,
        playerIntent: commandSummary,
        actor: 'party',
        target: enemies.map(unit => unit.name).join('、') || undefined,
        extraFacts: [
          `回合：${turn}`,
          `全队指令：${commandSummary}`,
          `主角方：${players.map(unitSummary).join('；') || '无'}`,
          `敌方：${enemies.map(unitSummary).join('；') || '无'}`,
          ...commands.flatMap((command, index) => [
            `指令${index + 1}：${command.actorName}｜${command.label}｜目标${command.targetName || '待定'}`,
            ...command.facts,
          ]),
        ],
      });
    } else {
      status = '未连接正文生成器';
    }
    addLog({
      actor: '[战斗台]',
      action: `回合${turn}提交`,
      result: `${status}。${commandSummary}`,
      color: 'text-fantasy-gold',
    });
    setPendingCommands({});
    setTurn(prev => prev + 1);
  };

  return (
    <div className="h-full w-full flex flex-col gap-4 relative overflow-y-auto xl:overflow-hidden">
      <div className="absolute inset-0 bg-red-900/5 mix-blend-color-burn pointer-events-none" />

      <div className="glass-panel p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 z-10 shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 bg-fantasy-red/20 rounded border border-fantasy-red/50 flex flex-col items-center justify-center shrink-0">
            <span className="text-xs text-fantasy-red tracking-widest font-serif block -mb-1">回合</span>
            <span className="text-xl text-white font-mono font-bold">{turn}</span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-serif text-gray-200 truncate">{locationDisplay.fullName}</div>
            <div className="text-xs text-gray-400">正文结算 / MVU同步</div>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={resetCombat} className="p-2 border border-white/10 rounded flex items-center gap-2 text-xs text-gray-400 bg-white/5 hover:bg-white/10 transition-colors">
            <RefreshCcw className="w-3 h-3" /> 重整
          </button>
          <button className="p-2 border border-fantasy-gold/30 rounded flex items-center gap-2 text-xs text-fantasy-gold bg-fantasy-gold/10">
            <Info className="w-3 h-3" /> 回合指令
          </button>
        </div>
      </div>

      <div className="combat-panel-body flex-1 flex flex-col 2xl:flex-row gap-4 z-10 min-h-0">
        <div className="flex-[1.1] flex flex-col gap-4 overflow-y-auto pr-0 2xl:pr-2">
          <div className="glass-panel-light rounded-xl p-4 border-t-2 border-fantasy-red/50">
            <h3 className="text-xs text-fantasy-red mb-4 tracking-widest flex items-center gap-2"><Sword className="w-3 h-3" /> 敌方目标</h3>
            <div className="space-y-4">
              {enemies.length === 0 && (
                <div className="p-4 rounded-lg bg-black/30 border border-white/5 text-sm text-gray-500">暂无敌方单位</div>
              )}
              {enemies.map(unit => (
                <button key={unit.id} onClick={() => setSelectedTargetId(unit.id)} className={`w-full text-left rounded-lg ${selectedTargetId === unit.id ? 'ring-1 ring-fantasy-gold' : ''}`}>
                  <UnitCard unit={unit} />
                </button>
              ))}
            </div>
          </div>

          <div className="glass-panel-light rounded-xl p-4 border-t-2 border-fantasy-blue/50">
            <h3 className="text-xs text-fantasy-blue mb-4 tracking-widest flex items-center gap-2"><ShieldIcon className="w-3 h-3" /> 主角方行动者</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {players.map(unit => (
                <button
                  key={unit.id}
                  onClick={() => {
                    setSelectedActorId(unit.id);
                    setSelectedAllyTargetId(unit.id);
                  }}
                  className={`text-left rounded-lg ${selectedActorId === unit.id ? 'ring-1 ring-fantasy-gold' : ''}`}
                >
                  <UnitCard unit={unit} compact />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="combat-command-column w-full 2xl:w-[42rem] flex flex-col gap-4 min-h-[720px] 2xl:min-h-0">
          <div className="glass-panel rounded-xl p-4 shrink-0">
            <h3 className="text-xs text-fantasy-gold mb-3 font-serif border-b border-fantasy-gold/20 pb-2">行动指令</h3>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <button onClick={() => queueCommand('attack')} disabled={enemies.length === 0} className="btn-rpg px-3 py-2 rounded text-xs disabled:opacity-30">暂存攻击</button>
              <button onClick={() => queueCommand('guard')} className="btn-rpg px-3 py-2 rounded text-xs">暂存防御</button>
              <button onClick={() => queueCommand('escape')} className="btn-rpg px-3 py-2 rounded text-xs">暂存撤离</button>
            </div>
            <div className="grid gap-2">
              {actorSkills.length === 0 && (
                <div className="p-3 rounded bg-black/30 border border-white/10 text-xs text-gray-500">当前行动者没有装配技能</div>
              )}
              {actorSkills.map(skill => {
                const active = selectedSkillId === skill.id;
                const disabled = selectedActor ? selectedActor.mp < skill.mpCost : true;
                return (
                  <button
                    key={skill.id}
                    onClick={() => setSelectedSkillId(skill.id)}
                    disabled={disabled}
                    className={`btn-rpg p-3 rounded text-left ${active ? 'active' : ''}`}
                  >
                    <div className="flex justify-between text-sm">
                      <span>{skill.name}</span>
                      <span>{skill.rank} / {skill.mpCost}法力</span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1">{skill.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="glass-panel rounded-xl p-4 shrink-0">
            <h3 className="text-xs text-fantasy-gold mb-3 font-serif border-b border-fantasy-gold/20 pb-2">友方目标</h3>
            <div className="flex flex-wrap gap-2">
              {players.map(unit => (
                <button key={unit.id} onClick={() => setSelectedAllyTargetId(unit.id)} className={`px-3 py-1.5 rounded text-xs border ${selectedAllyTargetId === unit.id ? 'border-fantasy-gold text-fantasy-gold bg-fantasy-gold/10' : 'border-white/10 text-gray-400 bg-white/5'}`}>
                  {unit.name}
                </button>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-xl flex-[2.6] p-4 flex flex-col min-h-[34rem] 2xl:min-h-0">
            <h3 className="text-xs text-fantasy-gold mb-3 font-serif border-b border-fantasy-gold/20 pb-2">指令记录</h3>
            <div className="mb-3 rounded border border-fantasy-gold/20 bg-black/25 p-3">
              <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                <span className="text-fantasy-gold">本回合暂存</span>
                <span className={allPlayersReady ? 'text-green-300' : 'text-gray-500'}>
                  {players.filter(unit => pendingCommands[unit.id]?.length).length}/{players.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {queuedCommandList.length === 0 && (
                  <div className="text-xs text-gray-500">尚未暂存行动</div>
                )}
                {queuedCommandList.map(command => (
                  <div key={command.id} className="flex items-center justify-between gap-3 rounded bg-white/5 px-2 py-1.5 text-xs">
                    <span className="text-gray-200">{command.actorName}</span>
                    <span className="text-fantasy-gold truncate">{command.label}{command.targetName ? ` → ${command.targetName}` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 text-sm">
              {logs.length === 0 && (
                <div className="p-3 rounded bg-black/20 border border-white/5 text-xs text-gray-500">暂无指令记录</div>
              )}
              {logs.map(log => <LogEntry key={log.id} actor={log.actor} action={log.action} result={log.result} color={log.color} />)}
            </div>
          </div>

          <div className="glass-panel rounded-xl p-4 shrink-0 bg-gradient-to-t from-fantasy-gold/5 to-transparent">
            <div className="text-xs text-gray-400 mb-2">当前技能</div>
            <button onClick={() => queueCommand('skill')} disabled={!selectedSkill || (!selectedSkillTargetsAlly && enemies.length === 0)} className="btn-rpg w-full px-4 py-3 rounded bg-fantasy-gold/20 border-fantasy-gold text-fantasy-gold hover:text-white flex items-center justify-center gap-2 group disabled:opacity-30">
              <Play className="w-4 h-4" /> 暂存 {selectedSkill?.name || '技能'}
            </button>
            <button onClick={() => void submitRound()} disabled={!allPlayersReady} className="btn-rpg mt-3 w-full px-4 py-3 rounded bg-fantasy-red/15 border-fantasy-red/50 text-orange-200 hover:text-white flex items-center justify-center gap-2 group disabled:opacity-30">
              提交本回合
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UnitCard({ unit }: { unit: CombatUnit; compact?: boolean }) {
  const hpPct = (unit.hp / unit.maxHp) * 100;
  const mpPct = unit.maxMp > 0 ? (unit.mp / unit.maxMp) * 100 : 0;
  const isDead = unit.hp <= 0;

  return (
    <div className={`pixel-unit-shell p-4 flex flex-col gap-3 relative overflow-hidden ${unit.isEnemy ? 'border-fantasy-red/50' : 'border-fantasy-gold/40'} ${isDead ? 'opacity-50 grayscale' : ''}`}>
      <div className="flex justify-between items-start gap-3">
        <div className="flex flex-col min-w-0">
          <span className={`font-serif tracking-wide truncate ${unit.isEnemy ? 'text-fantasy-red' : 'text-blue-300'}`}>{unit.name}</span>
          <div className="flex gap-1 mt-1 flex-wrap">
            <span className="px-1.5 py-0.5 bg-white/5 border border-white/10 text-[10px] text-gray-400 rounded">等级{unit.level}</span>
            <span className="px-1.5 py-0.5 bg-white/5 border border-white/10 text-[10px] text-gray-400 rounded">护甲{unit.ac}</span>
            {unit.statusLogs.map((s, i) => (
              <span key={i} className="px-1.5 py-0.5 bg-white/5 border border-white/10 text-[10px] text-gray-400 rounded">{s}</span>
            ))}
          </div>
        </div>

        <div className="flex gap-1 shrink-0">
          {Array.from({ length: unit.maxAp }).map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full ${i < unit.ap ? 'bg-orange-500 shadow-[0_0_5px_#f59e0b]' : 'bg-gray-700'}`} />
          ))}
        </div>
      </div>

      <div className="space-y-1.5 mt-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-8">生命</span>
          <div className="flex-1 pixel-bar-shell">
            <motion.div initial={{ width: 0 }} animate={{ width: `${hpPct}%` }} className="pixel-bar-fill hp" />
          </div>
          <span className="text-xs font-mono text-gray-300 w-16 text-right">{unit.hp}/{unit.maxHp}</span>
        </div>

        {unit.maxMp > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 w-8">法力</span>
            <div className="flex-1 pixel-bar-shell">
              <motion.div initial={{ width: 0 }} animate={{ width: `${mpPct}%` }} className="pixel-bar-fill mp" />
            </div>
            <span className="text-xs font-mono text-gray-300 w-16 text-right">{unit.mp}/{unit.maxMp}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function LogEntry({ actor, action, result, color = 'text-fantasy-gold' }: Omit<CombatLog, 'id'>) {
  const pieces = result.split(/[；;]/).map(piece => piece.trim()).filter(Boolean);
  const hasStructuredPieces = pieces.length > 1;
  const checkLine = pieces.find(piece => piece.includes('检定') || piece.includes('目标值') || piece.includes('目标护甲'));
  const costLine = pieces.find(piece => piece.includes('消耗') || piece.includes('法力') || piece.includes('护盾吸收'));
  const resultLine = pieces.find(piece => piece.includes('命中') || piece.includes('未命中') || piece.includes('成功') || piece.includes('失败') || piece.includes('造成')) || result;
  const executionLine = hasStructuredPieces
    ? pieces.filter(piece => piece !== checkLine && piece !== costLine && piece !== resultLine).join('；') || action
    : action;

  return (
    <div className="combat-action-card">
      <div className="combat-action-title">
        <span className={color}>{actor}</span>
        <strong>{action}</strong>
      </div>
      <CombatFact label="执行" value={executionLine} />
      {costLine && <CombatFact label="消耗" value={costLine} />}
      {checkLine && <CombatFact label="检定" value={checkLine} />}
      <CombatFact label="结果" value={resultLine} strong />
    </div>
  );
}

function CombatFact({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="combat-action-row">
      <span>{label}</span>
      <p className={strong ? 'text-gray-100' : ''}>{value}</p>
    </div>
  );
}
