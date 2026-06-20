import { useEffect, useMemo, useState } from 'react';
import { Info, Play, RefreshCcw, Shield as ShieldIcon, Sword } from 'lucide-react';
import { motion } from 'motion/react';
import { Character, CombatUnit, PlayerState, Skill } from '../../types';
import { equippedIdsFromLoadout, getClassById, getEquipmentById, getSkillById, playerToCombatUnit } from '../../game/rules';
import { submitPayloadToSillyTavernInput } from '../../game/sillyTavernBridge';
import { EldredFrontendEventInput } from '../../game/eldredEvents';

type CombatLog = {
  id: string;
  actor: string;
  action: string;
  result: string;
  color?: string;
};

type CombatCommandKind = 'attack' | 'guard' | 'escape' | 'skill';

const commandLabel: Record<CombatCommandKind, string> = {
  attack: '普通攻击',
  guard: '防御',
  escape: '撤离',
  skill: '技能',
};

const submitToSillyTavern = async (payload: string) => {
  return submitPayloadToSillyTavernInput(payload, '已复制指令');
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

export function CombatPanel({
  player,
  partyNpcs = EMPTY_NPCS,
  enemyUnits = EMPTY_COMBAT_UNITS,
  initialTurn = 1,
  initialLogs = EMPTY_LOGS,
  onSubmitEvent,
}: CombatPanelProps) {
  const initialUnits = useMemo(() => {
    const party = partyNpcs.map(npcToCombatUnit);
    return [playerToCombatUnit(player), ...party, ...enemyUnits.filter(unit => unit.isEnemy)];
  }, [enemyUnits, partyNpcs, player]);

  const [units, setUnits] = useState<CombatUnit[]>(initialUnits);
  const [selectedActorId, setSelectedActorId] = useState('player');
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [selectedAllyTargetId, setSelectedAllyTargetId] = useState('player');
  const [selectedSkillId, setSelectedSkillId] = useState(player.activeSkillIds[0] || '');
  const [turn, setTurn] = useState(initialTurn);
  const [logs, setLogs] = useState<CombatLog[]>(() =>
    initialLogs.map((result, index) => ({ id: `mvu-${index}`, actor: '[变量]', action: '回合记录', result })),
  );

  useEffect(() => {
    setUnits(initialUnits);
    setSelectedActorId(initialUnits.find(unit => !unit.isEnemy)?.id || 'player');
    setSelectedTargetId(initialUnits.find(unit => unit.isEnemy)?.id || '');
    setSelectedAllyTargetId(initialUnits.find(unit => !unit.isEnemy)?.id || 'player');
    setTurn(initialTurn);
    setLogs(initialLogs.map((result, index) => ({ id: `mvu-${index}`, actor: '[变量]', action: '回合记录', result })));
  }, [initialLogs, initialTurn, initialUnits]);

  const players = units.filter(unit => !unit.isEnemy);
  const enemies = units.filter(unit => unit.isEnemy);
  const selectedActor = units.find(unit => unit.id === selectedActorId) || players[0];
  const selectedSkill = getSkillById(selectedSkillId);
  const selectedSkillTargetsAlly = skillTargetIsAlly(selectedSkill);
  const selectedTarget = selectedSkillTargetsAlly
    ? units.find(unit => unit.id === selectedAllyTargetId) || selectedActor
    : units.find(unit => unit.id === selectedTargetId) || enemies[0];

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
    setLogs(initialLogs.map((result, index) => ({ id: `mvu-${index}`, actor: '[变量]', action: '回合记录', result })));
  };

  const commandFacts = (kind: CombatCommandKind) => {
    const facts = [
      `回合：${turn}`,
      `行动者：${selectedActor?.name || '未选择'}`,
      `行动：${kind === 'skill' && selectedSkill ? `使用${selectedSkill.name}` : commandLabel[kind]}`,
      `目标：${selectedTarget?.name || '待正文确认'}`,
      `地点：${player.location.name} / ${player.location.landmarkName}`,
      `主角方：${players.map(unitSummary).join('；') || '无'}`,
      `敌方：${enemies.map(unitSummary).join('；') || '无'}`,
    ];
    if (kind === 'skill' && selectedSkill) {
      facts.push(`技能：${selectedSkill.name}｜${selectedSkill.rank}｜消耗${selectedSkill.mpCost}法力｜属性${selectedSkill.attribute}｜目标${selectedSkill.target}｜效果${selectedSkill.desc}`);
    }
    return facts;
  };

  const buildCommandPayload = (kind: CombatCommandKind) => {
    if (!selectedActor) return '';
    const skillLine = kind === 'skill' && selectedSkill
      ? `技能：${selectedSkill.name}｜${selectedSkill.rank}｜消耗${selectedSkill.mpCost}法力｜属性${selectedSkill.attribute}｜目标${selectedSkill.target}｜效果${selectedSkill.desc}`
      : '技能：无';
    const actionLine = kind === 'skill' && selectedSkill ? `使用【${selectedSkill.name}】` : commandLabel[kind];
    return `【艾尔德雷德战斗指令】
回合：${turn}
行动者：${selectedActor.name}
行动：${actionLine}
目标：${selectedTarget?.name || '待正文确认'}
${skillLine}
地点：${player.location.name}｜${player.location.landmarkName}
主角方：${players.map(unitSummary).join('\n')}
敌方：${enemies.map(unitSummary).join('\n')}

裁决请求：按当前正文、变量与世界书裁决本回合；本指令只是行动意图，不是既成结果。普通攻击、防御、撤离和技能都必须计算命中、目标值、伤害/治疗、状态、资源消耗、耐久与变量写回。输出 <战斗实况>；若使用技能或装备技，同时输出 <技能演出>。`;
  };

  const submitCommand = async (kind: CombatCommandKind) => {
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

    let status = '已提交事件';
    if (onSubmitEvent) {
      await onSubmitEvent({
        eventType: 'combat_command',
        title: `回合${turn}：${selectedActor.name}${commandLabel[kind]}`,
        playerIntent: kind === 'skill' && selectedSkill ? `${selectedActor.name} 使用「${selectedSkill.name}」` : `${selectedActor.name} 执行${commandLabel[kind]}`,
        actor: selectedActor.id,
        target: selectedTarget?.id || selectedTarget?.name,
        skillId: kind === 'skill' ? selectedSkill?.id : undefined,
        extraFacts: commandFacts(kind),
      });
    } else {
      const payload = buildCommandPayload(kind);
      status = await submitToSillyTavern(payload);
    }
    addLog({
      actor: `[${selectedActor.name}]`,
      action: commandLabel[kind],
      result: `${status}。目标：${selectedTarget?.name || '待定'}。`,
      color: kind === 'skill' ? 'text-fantasy-gold' : undefined,
    });
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
            <div className="text-sm font-serif text-gray-200 truncate">{player.location.name} · {player.location.landmarkName}</div>
            <div className="text-xs text-gray-400">正文裁决 / MVU写回</div>
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

      <div className="flex-1 flex flex-col xl:flex-row gap-4 z-10 min-h-0">
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-0 xl:pr-2">
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

        <div className="w-full xl:w-96 flex flex-col gap-4 min-h-[520px] xl:min-h-0">
          <div className="glass-panel rounded-xl p-4 shrink-0">
            <h3 className="text-xs text-fantasy-gold mb-3 font-serif border-b border-fantasy-gold/20 pb-2">行动指令</h3>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <button onClick={() => submitCommand('attack')} disabled={enemies.length === 0} className="btn-rpg px-3 py-2 rounded text-xs disabled:opacity-30">普通攻击</button>
              <button onClick={() => submitCommand('guard')} className="btn-rpg px-3 py-2 rounded text-xs">防御</button>
              <button onClick={() => submitCommand('escape')} className="btn-rpg px-3 py-2 rounded text-xs">撤离</button>
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

          <div className="glass-panel rounded-xl flex-1 p-4 flex flex-col min-h-0">
            <h3 className="text-xs text-fantasy-gold mb-3 font-serif border-b border-fantasy-gold/20 pb-2">指令记录</h3>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 text-sm">
              {logs.length === 0 && (
                <div className="p-3 rounded bg-black/20 border border-white/5 text-xs text-gray-500">暂无指令记录</div>
              )}
              {logs.map(log => <LogEntry key={log.id} actor={log.actor} action={log.action} result={log.result} color={log.color} />)}
            </div>
          </div>

          <div className="glass-panel rounded-xl p-4 shrink-0 bg-gradient-to-t from-fantasy-gold/5 to-transparent">
            <div className="text-xs text-gray-400 mb-2">当前技能</div>
            <button onClick={() => submitCommand('skill')} disabled={!selectedSkill || (!selectedSkillTargetsAlly && enemies.length === 0)} className="btn-rpg w-full px-4 py-3 rounded bg-fantasy-gold/20 border-fantasy-gold text-fantasy-gold hover:text-white flex items-center justify-center gap-2 group disabled:opacity-30">
              <Play className="w-4 h-4" /> 提交 {selectedSkill?.name || '技能'}
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
    <div className={`p-4 bg-black/40 rounded-lg border flex flex-col gap-3 relative overflow-hidden ${unit.isEnemy ? 'border-fantasy-red/20' : 'border-fantasy-blue/20'} ${isDead ? 'opacity-50 grayscale' : ''}`}>
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
          <div className="flex-1 h-1.5 bg-gray-900 rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${hpPct}%` }} className="h-full hp-bar-fill" />
          </div>
          <span className="text-xs font-mono text-gray-300 w-16 text-right">{unit.hp}/{unit.maxHp}</span>
        </div>

        {unit.maxMp > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 w-8">法力</span>
            <div className="flex-1 h-1.5 bg-gray-900 rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${mpPct}%` }} className="h-full mp-bar-fill" />
            </div>
            <span className="text-xs font-mono text-gray-300 w-16 text-right">{unit.mp}/{unit.maxMp}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function LogEntry({ actor, action, result, color = 'text-fantasy-gold' }: Omit<CombatLog, 'id'>) {
  return (
    <div className="pb-2 border-b border-white/5 last:border-0 last:pb-0">
      <div className="flex items-baseline gap-2 mb-1">
        <span className={`text-xs font-bold ${color}`}>{actor}</span>
        <span className="text-xs text-gray-300">{action}</span>
      </div>
      <div className="text-xs text-gray-400">{result}</div>
    </div>
  );
}
