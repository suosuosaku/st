import { useState } from 'react';
import { eldredNPCs, resolveCharacterImage } from '../data';
import { ImmersiveNotice } from '../types';
import { parseNarrativeSegments, splitNarrativeTagParts } from '../game/narrativeTags';

type NoticeKind = 'item' | 'skill' | 'quest' | 'npc' | 'clue' | 'relation' | 'combat' | 'level' | 'event' | 'soft-location';

const noticeKindMap: Record<string, NoticeKind> = {
  获得物品: 'item',
  获得一次翻牌次数: 'event',
  获得技能: 'skill',
  技能入库: 'skill',
  装备变更: 'item',
  购买结算: 'item',
  新闻: 'event',
  新闻更新: 'event',
  见闻: 'event',
  见闻更新: 'event',
  看板更新: 'event',
  委托更新: 'quest',
  委托接取: 'quest',
  委托生成: 'quest',
  委托完成: 'quest',
  委托结算: 'quest',
  奖励结算: 'quest',
  NPC收录: 'npc',
  线索收录: 'clue',
  线索更新: 'clue',
  线索进展: 'clue',
  地点解锁: 'soft-location',
  地图加载: 'soft-location',
  路径行动: 'soft-location',
  事件推进: 'event',
  事件进展: 'event',
  奇遇事件: 'event',
  翻牌结果: 'event',
  主线进展: 'event',
  好感变化: 'relation',
  声望变化: 'relation',
  角色升级: 'level',
  升级提示: 'level',
  队伍编成: 'event',
  行动判定: 'combat',
  战斗开始: 'combat',
  先攻判定: 'combat',
  战斗行动: 'combat',
  战斗回合: 'combat',
  战斗结算: 'combat',
  战斗实况: 'combat',
  技能演出: 'combat',
};

const phaseNames = ['阶段一', '阶段二', '阶段三', '阶段四', '阶段五', '阶段六', '阶段七'];

const knownNpcByName = (name: string) =>
  eldredNPCs.find(npc => npc.name === name || npc.fullName.includes(name));

const getAvatar = (name: string) => {
  const known = knownNpcByName(name);
  return known?.avatarUrl || '';
};

const getPortrait = (name: string) => {
  const known = knownNpcByName(name);
  return known?.portraitUrl || '';
};

const imageFromField = (value: string | undefined, name: string, type: '头像' | '立绘') => {
  const raw = String(value || '').trim();
  const known = knownNpcByName(name);
  if (!raw && known) return type === '头像' ? getAvatar(name) : getPortrait(name);
  return resolveCharacterImage(name, type, {
    raw,
    fixed: Boolean(known),
    generic: !known,
    gender: value,
  });
};

const stripLabel = (title: string) => title.replace(/^【|】$/g, '').trim();

const splitNoticeParts = (body: string) =>
  splitNarrativeTagParts(body);

const splitField = (part: string): [string, string] | null => {
  const match = part.match(/^([^:：/]{1,12})[:：/]\s*(.+)$/);
  if (!match) return null;
  return [match[1].trim(), match[2].trim()];
};

const noticeFieldsFrom = (body: string) => {
  const parts = splitNoticeParts(body);
  const fields = new Map<string, string>();
  parts.forEach(part => {
    const field = splitField(part);
    if (field) fields.set(field[0], field[1]);
  });
  return { parts, fields };
};

const pickPart = (parts: string[], pattern: RegExp) => parts.find(part => pattern.test(part));

const fieldOrPart = (fields: Map<string, string>, parts: string[], keys: string[], pattern?: RegExp, fallback = '') => {
  for (const key of keys) {
    const value = fields.get(key);
    if (value && !/^(未登记|未记录|待登记|待补充|无)$/.test(value.trim())) return value;
  }
  if (pattern) return pickPart(parts, pattern)?.replace(pattern, '$1').trim() || '';
  return fallback;
};

const usableText = (value: string | undefined) => {
  const text = String(value || '').trim();
  return text && !/^(未登记|未记录|待登记|待补充|无)$/.test(text) ? text : '';
};

const cleanNoticeValue = (value = '', options: { dropPureNumber?: boolean } = {}) => {
  const text = value.trim();
  if (!text || /^(无|未登记|未记录|待登记|待补充)$/.test(text)) return '';
  if (options.dropPureNumber && /^\d{1,4}$/.test(text)) return '';
  return text;
};

function ImageOrInitial({
  src,
  name,
  imageClassName = '',
  fallbackClassName = '',
}: {
  src?: string;
  name: string;
  imageClassName?: string;
  fallbackClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-[#2a1c12] font-serif font-bold text-fantasy-gold ${fallbackClassName}`}>
        {name.slice(0, 1) || '？'}
      </div>
    );
  }
  return <img src={src} alt={name} className={imageClassName} onError={() => setFailed(true)} />;
}

const phaseIndexFrom = (text: string) => {
  const normalized = text.trim();
  const direct = phaseNames.findIndex(name => normalized.includes(name));
  if (direct >= 0) return direct;
  const numberMatch = normalized.match(/阶段\s*([1-7一二三四五六七])/);
  if (!numberMatch) return 0;
  const phaseMap: Record<string, number> = { '1': 0, 一: 0, '2': 1, 二: 1, '3': 2, 三: 2, '4': 3, 四: 3, '5': 4, 五: 4, '6': 5, 六: 5, '7': 6, 七: 6 };
  return phaseMap[numberMatch[1]] ?? 0;
};

type CluePhaseRecord = {
  phase: string;
  clues: string[];
  event: string;
};

const clueGroupsFrom = (body: string): Map<number, CluePhaseRecord> => {
  const groups = new Map<number, CluePhaseRecord>();
  const rawGroups = body
    .split(/[；;]\s*(?=阶段[一二三四五六七1-7])/)
    .map(group => group.trim())
    .filter(Boolean);
  const candidates = rawGroups.length > 1 ? rawGroups : [body];

  for (const group of candidates) {
    const parts = splitNoticeParts(group);
    if (parts.length === 0) continue;
    const phaseSource = parts.find(part => /阶段[一二三四五六七1-7]/.test(part)) || parts[0];
    const index = phaseIndexFrom(phaseSource);
    const startsWithPhase = /阶段[一二三四五六七1-7]/.test(parts[0]);
    const payload = startsWithPhase ? parts.slice(1) : parts;
    groups.set(index, {
      phase: phaseNames[index] || phaseSource,
      clues: payload.slice(0, 3),
      event: payload[3] || payload.find(part => /事件|真相|节点|结论/.test(part)) || '',
    });
  }

  return groups;
};

function HighlightText({ text }: { text: string }) {
  const tokens = String(text || '').split(/(「[^」]+」|《[^》]+》|Lv\.?\d+|\d+\/\d+|[+-]?\d+点?|S[1-5]|极高|高|中|低|成功|失败|未命中|命中|获得|完成|升级)/g).filter(Boolean);
  return (
    <>
      {tokens.map((token, index) => {
        const isNumber = /^([+-]?\d+点?|\d+\/\d+|Lv\.?\d+|S[1-5])$/.test(token);
        const isQuote = /^「|^《/.test(token);
        const isGood = /成功|获得|完成|升级/.test(token);
        const isBad = /失败|未命中|极高|高/.test(token);
        const className = isNumber
          ? 'eldred-text-number'
          : isQuote
            ? 'eldred-text-name'
            : isGood
              ? 'eldred-text-good'
              : isBad
                ? 'eldred-text-danger'
                : undefined;
        return className ? <span key={`${token}-${index}`} className={className}>{token}</span> : <span key={`${token}-${index}`}>{token}</span>;
      })}
    </>
  );
}

export function DialogueLine({ speaker, text }: { speaker: string; text: string }) {
  const avatar = getAvatar(speaker);
  return (
    <div className="eldred-dialogue-line pixel-dialogue">
      <div className="pixel-avatar eldred-dialogue-avatar shrink-0 overflow-hidden">
        <ImageOrInitial src={avatar} name={speaker} imageClassName="w-full h-full object-cover" fallbackClassName="text-lg" />
      </div>
      <div className="eldred-dialogue-main">
        <div className="eldred-dialogue-name">【{speaker}】</div>
        <div className="pixel-speech eldred-dialogue-bubble">
          {text}
        </div>
      </div>
    </div>
  );
}

export function ImmersiveNoticeCard({ notice }: { notice: ImmersiveNotice }) {
  return (
    <NoticePanel title={notice.title} body={notice.body} meta={notice.meta} compact />
  );
}

function NpcArchiveNotice({ body, compact = false }: { body: string; compact?: boolean }) {
  const { parts, fields } = noticeFieldsFrom(body);
  const name = fields.get('姓名') || parts[0]?.replace(/^姓名[:：]/, '').trim() || '未知角色';
  const known = knownNpcByName(name);
  const exactStats = known?.stats;
  const identity = fieldOrPart(fields, parts, ['身份', '职责'], undefined, parts[1] || known?.identity || '');
  const isMajorNpc = /主要/.test(fields.get('类型') || fields.get('分类') || parts.join('｜'));
  const level = usableText(fields.get('等级'))
    || usableText(fields.get('机制数值'))?.match(/(?:Lv\.?|等级)\s*([0-9]+)/i)?.[1]
    || pickPart(parts, /(?:Lv\.?|等级)\s*([0-9]+)/i)?.match(/(?:Lv\.?|等级)\s*([0-9]+)/i)?.[1]
    || (exactStats ? String(exactStats.level || 1) : '');
  const hp = usableText(fields.get('生命'))
    || usableText(fields.get('HP'))
    || usableText(fields.get('机制数值'))?.match(/(?:HP|生命)[:：]?\s*([0-9]+\/[0-9]+)/i)?.[1]
    || pickPart(parts, /(?:HP|生命)[:：]?\s*([0-9]+\/[0-9]+)/i)?.match(/(?:HP|生命)[:：]?\s*([0-9]+\/[0-9]+)/i)?.[1]
    || (exactStats ? `${exactStats.hp}/${exactStats.maxHp}` : '');
  const mp = usableText(fields.get('法力'))
    || usableText(fields.get('MP'))
    || usableText(fields.get('机制数值'))?.match(/(?:MP|法力)[:：]?\s*([0-9]+\/[0-9]+)/i)?.[1]
    || pickPart(parts, /(?:MP|法力)[:：]?\s*([0-9]+\/[0-9]+)/i)?.match(/(?:MP|法力)[:：]?\s*([0-9]+\/[0-9]+)/i)?.[1]
    || (exactStats ? `${exactStats.mp}/${exactStats.maxMp}` : '');
  const ac = usableText(fields.get('护甲'))
    || usableText(fields.get('AC'))
    || usableText(fields.get('机制数值'))?.match(/(?:AC|护甲)[:：]?\s*([0-9]+)/i)?.[1]
    || pickPart(parts, /(?:AC|护甲)[:：]?\s*([0-9]+)/i)?.match(/(?:AC|护甲)[:：]?\s*([0-9]+)/i)?.[1]
    || (exactStats ? String(exactStats.ac) : '');
  const attributes = usableText(fields.get('属性'))
    || usableText(fields.get('五维'))
    || pickPart(parts, /力量|敏捷|体质|智力|精神/)
    || (exactStats ? `力量${exactStats.str} 敏捷${exactStats.dex} 体质${exactStats.vit} 智力${exactStats.int} 精神${exactStats.spr}` : '');
  const portrait = imageFromField(fields.get('立绘') || fields.get('性别'), name, '立绘');
  const affiliation = fields.get('所属') || fields.get('所属地区') || fields.get('所属地标') || fields.get('势力') || known?.affiliation || '';
  const revisit = fields.get('可回访') || fields.get('可回访地点') || fields.get('可回访事项') || parts.find(part => /可回访|回访/.test(part)) || '';
  const details = [
    identity ? `身份：${identity}` : '',
    level ? `等级：Lv.${level}` : '',
    hp ? `生命：${hp}` : '',
    mp ? `法力：${mp}` : '',
    ac ? `护甲：${ac}` : '',
    attributes ? `属性：${attributes}` : '',
    affiliation ? `所属：${affiliation}` : '',
    revisit ? `可回访：${revisit}` : '',
    !known && isMajorNpc ? '固定档案未匹配' : '',
    !known && !isMajorNpc ? '随机角色数据等待变量写入' : '',
  ].filter(Boolean);
  return (
    <div className={`eldred-notice eldred-notice-npc ${compact ? 'eldred-notice-compact' : ''}`}>
      <div className="eldred-notice-frame">
        <div className="eldred-notice-kicker">NPC 收录</div>
        <div className="eldred-npc-archive">
          <div className="eldred-npc-portrait">
            <ImageOrInitial src={portrait} name={name} imageClassName="h-full w-full object-contain" fallbackClassName="text-4xl bg-[#20140f]" />
          </div>
          <div className="eldred-npc-body">
            <div className="eldred-npc-name">{name}</div>
            <div className="eldred-npc-detail-grid">
              {(details.length ? details : ['档案未绑定']).map((part, index) => (
                <div className="eldred-npc-detail" key={`${name}-${index}`}><HighlightText text={part} /></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const splitCombatUnits = (value: string) =>
  String(value || '')
    .split(/[；;]/)
    .map(unit => unit.trim())
    .filter(Boolean);

const combatPartLooksLikeUnit = (value: string) =>
  /(?:\d+\s*\/\s*\d+\s*(?:HP|MP|生命|法力|血量)?|(?:HP|MP|AC|生命|法力|护甲|血量)\s*[:：]?\s*\d+)/i.test(value);

type CombatUnitDisplay = {
  name: string;
  level: string;
  hp: string;
  hpPercent: number;
  mp: string;
  mpPercent: number;
  ac: string;
  status: string;
  detail: string;
  raw: string;
};

const extractCombatPair = (raw: string, pattern: RegExp) => {
  const match = raw.match(pattern);
  if (!match) return { value: '', next: raw };
  const max = Math.max(0, Number(match[2]));
  const current = Math.min(Math.max(0, Number(match[1])), max);
  return {
    value: `${current}/${max}`,
    next: raw.replace(match[0], ' '),
  };
};

const parseCombatUnit = (rawUnit: string): CombatUnitDisplay => {
  let rest = rawUnit.trim();
  const levelMatch = rest.match(/(?:Lv\.?|等级)\s*([0-9]+)/i);
  const acMatch = rest.match(/(?:AC|护甲)\s*[:：]?\s*([0-9]+)/i);
  const statusMatch = rest.match(/(?:状态|态势)\s*[:：]\s*([^，,；;｜|]+)/);
  const hpExtract = extractCombatPair(rest, /(?:HP|生命|血量)?\s*[:：]?\s*(-?[0-9]+)\s*\/\s*(-?[0-9]+)\s*(?:HP|生命|血量|血)?/i);
  rest = hpExtract.next;
  const mpExtract = extractCombatPair(rest, /(?:MP|法力)?\s*[:：]?\s*(-?[0-9]+)\s*\/\s*(-?[0-9]+)\s*(?:MP|法力)?/i);
  rest = mpExtract.next;
  [levelMatch?.[0], acMatch?.[0], statusMatch?.[0]]
    .filter(Boolean)
    .forEach(token => {
      rest = rest.replace(String(token), ' ');
    });
  const name = rest
    .replace(/[()（）【】]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(友方|敌方|主角方|敌人)[:：]/, '')
    || rawUnit.replace(/\s*(?:HP|MP|AC|生命|法力|护甲).*/, '').trim()
    || '未知单位';
  const hpNumbers = hpExtract.value.split('/').map(value => Number(value));
  const mpNumbers = mpExtract.value.split('/').map(value => Number(value));
  const percent = (numbers: number[]) => {
    const [current, max] = numbers;
    if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0) return 0;
    return Math.max(0, Math.min(100, (current / max) * 100));
  };
  const detail = rest
    .replace(name, '')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    name,
    level: levelMatch?.[1] || '',
    hp: hpExtract.value,
    hpPercent: percent(hpNumbers),
    mp: mpExtract.value,
    mpPercent: percent(mpNumbers),
    ac: acMatch?.[1] || '',
    status: statusMatch?.[1] || '',
    detail,
    raw: rawUnit,
  };
};

function CombatUnitStrip({ title, value, enemy = false }: { title: string; value: string; enemy?: boolean }) {
  const units = splitCombatUnits(value);
  if (!units.length) return null;
  return (
    <div className={`eldred-combat-unit-strip ${enemy ? 'is-enemy' : 'is-ally'}`}>
      <div className="eldred-combat-unit-title">{title}</div>
      <div className="eldred-combat-unit-list">
        {units.map((unit, index) => {
          const parsed = parseCombatUnit(unit);
          return (
            <div className="eldred-combat-unit-card" key={`${title}-${index}`}>
              <div className="eldred-combat-unit-card-head">
                <strong><HighlightText text={parsed.name} /></strong>
                <span>{parsed.level ? `Lv.${parsed.level}` : enemy ? '敌方' : '友方'}</span>
              </div>
              <div className="eldred-combat-bars">
                {parsed.hp && (
                  <div className="eldred-combat-bar-row">
                    <span>HP</span>
                    <div className="eldred-combat-bar"><i style={{ width: `${parsed.hpPercent}%` }} /></div>
                    <strong>{parsed.hp}</strong>
                  </div>
                )}
                {parsed.mp && (
                  <div className="eldred-combat-bar-row is-mp">
                    <span>MP</span>
                    <div className="eldred-combat-bar"><i style={{ width: `${parsed.mpPercent}%` }} /></div>
                    <strong>{parsed.mp}</strong>
                  </div>
                )}
              </div>
              <div className="eldred-combat-unit-tags">
                {parsed.ac && <span>护甲 {parsed.ac}</span>}
                {parsed.status && <span>{parsed.status}</span>}
                {!parsed.hp && !parsed.mp && !parsed.ac && <span><HighlightText text={parsed.raw} /></span>}
                {parsed.detail && <span><HighlightText text={parsed.detail} /></span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CombatNotice({ title, body, compact = false }: { title: string; body: string; compact?: boolean }) {
  const noticeTitle = stripLabel(title);
  const { parts, fields } = noticeFieldsFrom(body);
  const part = (index: number) => cleanNoticeValue(parts[index] || '');
  const field = (...keys: string[]) => {
    for (const key of keys) {
      const value = cleanNoticeValue(fields.get(key));
      if (value) return value;
    }
    return '';
  };
  const valueFor = (...keysOrIndexes: Array<string | number>) => {
    for (const key of keysOrIndexes) {
      const value = typeof key === 'number' ? part(key) : field(key);
      if (value) return value;
    }
    return '';
  };
  const unitParts = parts.filter(partValue => !splitField(partValue) && combatPartLooksLikeUnit(partValue));
  const inferredAllies = unitParts[0] || '';
  const inferredEnemies = unitParts.slice(1).join('；');
  const isLiveSnapshot = noticeTitle === '战斗实况';
  const isCombatAction = noticeTitle === '战斗行动';
  const isSkillShow = noticeTitle === '技能演出';
  const skillOnly = isSkillShow && parts.length === 1 && fields.size === 0;
  const round = isLiveSnapshot
    ? valueFor('回合', 1, '阶段', 2) || noticeTitle
    : isCombatAction
      ? valueFor('回合', 0) || noticeTitle
      : noticeTitle === '战斗结算'
        ? field('结果') || '战斗结束'
        : noticeTitle;
  const actor = isSkillShow
    ? skillOnly ? '' : valueFor('行动者', '执行者', 0)
    : isCombatAction
      ? valueFor('行动者', '执行者', '单位', 1)
      : field('行动者', '执行者', '单位');
  const rawAction = isSkillShow
    ? skillOnly ? part(0) : valueFor('技能名', '招式', '行动', 1)
    : isCombatAction
      ? valueFor('招式', '技能名', '行动', 3)
      : valueFor('招式', '技能名', '行动');
  const action = combatPartLooksLikeUnit(rawAction) ? '' : cleanNoticeValue(rawAction, { dropPureNumber: true });
  const rank = isSkillShow ? valueFor('阶位', 2) : '';
  const cost = isSkillShow ? valueFor('消耗', 3) : field('消耗');
  const result = isSkillShow ? valueFor('判定', '命中', '结果', 4) : isCombatAction ? valueFor('命中', 4, '结果', 5, '判定') : field('结果', '命中', '判定');
  const damage = isSkillShow ? valueFor('数值', '伤害', '威力', '治疗', 5) : isCombatAction ? valueFor('伤害', 6) || field('消耗') : field('伤害', '威力');
  const status = isSkillShow ? valueFor('状态变化', '状态', '效果', '冷却', 6) : isCombatAction ? valueFor('状态', 7) : valueFor('状态', '状态变化', '下一压力', 9, '环境', 8);
  const allies = isLiveSnapshot ? valueFor('主角方', '友方', '我方', 6) || inferredAllies : field('主角方', '友方', '我方') || inferredAllies;
  const enemies = isLiveSnapshot ? valueFor('敌方', '敌人', 7) || inferredEnemies : field('敌方', '敌人') || inferredEnemies;
  const liveTrigger = isLiveSnapshot ? cleanNoticeValue(valueFor('触发', 0), { dropPureNumber: true }) : '';
  const detailParts = [
    liveTrigger ? `触发：${liveTrigger}` : '',
    valueFor('阶段', 2) && isLiveSnapshot ? `阶段：${valueFor('阶段', 2)}` : '',
    valueFor('地点', 3) ? `地点：${valueFor('地点', 3)}` : '',
    valueFor('胜负目标', 4) ? `胜负目标：${valueFor('胜负目标', 4)}` : '',
    valueFor('先攻顺序', 5) ? `先攻顺序：${valueFor('先攻顺序', 5)}` : '',
    cleanNoticeValue(actor, { dropPureNumber: true }) ? `行动者：${cleanNoticeValue(actor, { dropPureNumber: true })}` : '',
    isSkillShow && valueFor('阵营', 1) ? `阵营：${valueFor('阵营', 1)}` : '',
    isSkillShow && rank ? `阶位：${rank}` : '',
    action ? `行动：${action}` : '',
    cleanNoticeValue(cost) ? `消耗：${cleanNoticeValue(cost)}` : '',
    cleanNoticeValue(result) ? `判定：${cleanNoticeValue(result)}` : '',
    cleanNoticeValue(damage) ? `数值：${cleanNoticeValue(damage)}` : '',
    cleanNoticeValue(status) ? `状态：${cleanNoticeValue(status)}` : '',
    isLiveSnapshot && valueFor('环境', 8) ? `环境：${valueFor('环境', 8)}` : '',
    isLiveSnapshot && valueFor('下一压力', 9) ? `下一压力：${valueFor('下一压力', 9)}` : '',
  ].filter(Boolean);

  if (!action && !detailParts.length && !allies && !enemies) {
    return <StandardNotice title={noticeTitle} body={body || noticeTitle} kind="combat" compact />;
  }

  return (
    <div className={`eldred-notice eldred-notice-combat eldred-combat-notice ${compact ? 'eldred-notice-compact' : ''}`}>
      <div className="eldred-combat-frame">
        <div className="eldred-combat-head">
          <span>{noticeTitle}</span>
          <strong><HighlightText text={round} /></strong>
        </div>
        {action && <div className="eldred-combat-action"><HighlightText text={action} /></div>}
        <div className="eldred-combat-grid">
          {detailParts.map((part, index) => (
            <div className="eldred-combat-cell" key={`${noticeTitle}-${index}`}><HighlightText text={part} /></div>
          ))}
        </div>
        {(allies || enemies) && (
          <div className="eldred-combat-roster">
            <CombatUnitStrip title="主角方" value={allies} />
            <CombatUnitStrip title="敌方" value={enemies} enemy />
          </div>
        )}
      </div>
    </div>
  );
}

function ClueArchiveNotice({ body, compact = false }: { body: string; compact?: boolean }) {
  const records = clueGroupsFrom(body);
  const activeIndex = Math.max(0, ...Array.from(records.keys()));

  return (
    <div className={`eldred-notice eldred-notice-clue ${compact ? 'eldred-notice-compact' : ''}`}>
      <div className="eldred-notice-frame">
        <div className="eldred-notice-kicker">线索收录</div>
        <div className="eldred-clue-board">
          {phaseNames.map((phase, index) => {
            const record = records.get(index);
            const active = index === activeIndex && Boolean(record);
            const collected = Boolean(record) && !active;
            const clueParts = record?.clues || [];
            const event = record?.event || `${phase}事件`;
            return (
              <div className={`eldred-clue-row ${active ? 'is-active' : ''} ${collected ? 'is-collected' : ''}`} key={phase}>
                <div className="eldred-clue-phase">{phase}</div>
                <div className="eldred-clue-slots">
                  {[0, 1, 2].map(slot => (
                    <span className="eldred-clue-token" key={`${phase}-${slot}`}>
                      {record ? <HighlightText text={clueParts[slot] || `线索${slot + 1}`} /> : `线索${slot + 1}`}
                    </span>
                  ))}
                </div>
                <div className="eldred-clue-arrow">→</div>
                <div className="eldred-clue-event">{record ? <HighlightText text={event} /> : `${phase}事件`}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LocationLineNotice({ title, body }: { title: string; body: string }) {
  return (
    <p className="eldred-location-line">
      <span>【{stripLabel(title)}】</span>
      <HighlightText text={body} />
    </p>
  );
}

function StandardNotice({
  title,
  body,
  meta,
  kind,
  compact = false,
}: {
  title: string;
  body: string;
  meta?: string;
  kind: NoticeKind;
  compact?: boolean;
}) {
  const noticeTitle = stripLabel(title);
  const parts = splitNoticeParts(body);
  const [primaryPart, ...detailParts] = parts.length ? parts : [body];
  return (
    <div className={`eldred-notice eldred-notice-${kind} ${compact ? 'eldred-notice-compact' : ''}`}>
      <div className="eldred-notice-frame">
        <div className="eldred-notice-kicker">{noticeTitle}</div>
        <div className="eldred-notice-primary"><HighlightText text={primaryPart} /></div>
        {detailParts.length > 0 && (
          <div className="eldred-notice-detail-grid">
            {detailParts.map((part, index) => (
              <div className="eldred-notice-detail" key={`${noticeTitle}-${index}`}><HighlightText text={part} /></div>
            ))}
          </div>
        )}
        {meta && <div className="eldred-notice-meta"><HighlightText text={meta} /></div>}
      </div>
    </div>
  );
}

function NoticePanel({
  title,
  body,
  meta,
  compact = false,
}: {
  title: string;
  body: string;
  meta?: string;
  compact?: boolean;
}) {
  const noticeTitle = stripLabel(title);
  const kind = noticeKindMap[noticeTitle] || 'event';
  if (kind === 'soft-location') return <LocationLineNotice title={noticeTitle} body={body} />;
  if (kind === 'npc') return <NpcArchiveNotice body={body} compact={compact} />;
  if (kind === 'clue') return <LocationLineNotice title={noticeTitle} body={body} />;
  if (kind === 'combat') return <CombatNotice title={noticeTitle} body={body} compact={compact} />;
  return <StandardNotice title={noticeTitle} body={body} meta={meta} kind={kind} compact={compact} />;
}

function InlineNotice({ title, body }: { title: string; body: string }) {
  return (
    <NoticePanel title={title} body={body} />
  );
}

function TaggedLine({ title, body }: { title: string; body: string }) {
  return (
    <p className="eldred-tagged-line">
      <span>【{stripLabel(title)}】</span>
      <HighlightText text={body} />
    </p>
  );
}

export function RichNarrative({ text }: { text: string }) {
  const segments = parseNarrativeSegments(text);
  let paragraphIndex = 0;
  return (
    <>
      {segments.map((segment, index) => {
        if (segment.kind === 'tag') {
          return <InlineNotice key={`notice-${index}`} title={segment.tag.title} body={segment.tag.body} />;
        }

        const line = segment.text.trim();
        const dialogue = line.match(/^【([^】]{1,32})】[：:]\s*[“"](.+?)[”"]?$/);
        if (dialogue) {
          return <DialogueLine key={`${dialogue[1]}-${index}`} speaker={dialogue[1]} text={dialogue[2]} />;
        }

        const notice = line.match(/^【([^】]{1,32})】(?:[：:]\s*(.*))?$/);
        if (notice) {
          return <TaggedLine key={`tagged-${index}`} title={notice[1]} body={notice[2] || ''} />;
        }

        const isFirstParagraph = paragraphIndex === 0;
        paragraphIndex += 1;
        return (
          <p key={index} className="eldred-narrative-paragraph">
            {isFirstParagraph && <span className="eldred-drop-cap">{line.slice(0, 1)}</span>}
            {isFirstParagraph ? line.slice(1) : line}
          </p>
        );
      })}
    </>
  );
}
