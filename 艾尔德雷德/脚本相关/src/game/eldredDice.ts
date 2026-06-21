import { AttributeKey, CombatUnit, PlayerState } from '../types';
import {
  ATTRIBUTE_LABELS,
  attributeModifier,
  characterClasses,
  equippedIdsFromLoadout,
  getClassById,
  getEquipmentById,
  getRaceById,
  getTalentById,
  proficiencyBonus,
} from './rules';

export type D20Mode = 'normal' | 'advantage' | 'disadvantage';

export type EldredD20CheckIntent = {
  action: string;
  attribute: AttributeKey;
  dc: number;
  mode: D20Mode;
  bonus: number;
  contextualBonus: number;
  dcAdjustment: number;
  sourceNotes: string[];
  useProficiency: boolean;
  target?: string;
};

export type EldredD20CheckResult = EldredD20CheckIntent & {
  requestedDc: number;
  actorId: string;
  actorName: string;
  level: number;
  rolls: number[];
  chosenRoll: number;
  attributeBonus: number;
  proficiency: number;
  total: number;
  success: boolean;
  margin: number;
  formula: string;
  summary: string;
};

const ATTRIBUTE_ALIASES: Array<[AttributeKey, RegExp]> = [
  ['str', /力量|强行|推开|破门|举起|压制|近身/i],
  ['dex', /敏捷|潜行|躲藏|闪避|射击|攀爬|撬锁|拆线|反应/i],
  ['vit', /体质|耐力|抵抗|扛住|中毒|瘴气|伤病|长途/i],
  ['int', /智力|调查|搜索|文书|账本|档案|机关|辨识|知识|公式|分析/i],
  ['spr', /精神|感知|意志|说服|交涉|安抚|净化|祈祷|察觉/i],
];

const MATCH_GROUPS = [
  ['登记', '名册', '行会', '城门', '流程', '文书'],
  ['文书', '账本', '账页', '档案', '碑文', '旧页', '短账纸', '记录'],
  ['药草', '药剂', '毒素', '瘴气', '病历', '问诊', '伤病'],
  ['兽群', '脚印', '天气', '路线', '旧路', '旅行', '营地', '陷阱', '绕路'],
  ['机关', '锁机', '魔导器', '校准', '矿轨', '灯塔', '装备耐久', '修理', '拆解'],
  ['交涉', '礼仪', '说服', '安抚', '恐慌', '翻译', '跨族'],
  ['守护', '护送', '保护', '盾线'],
  ['近身', '冲突', '推拉', '保护队友', '前排'],
  ['游泳', '潮汐', '水路', '海雾', '船', '港'],
  ['召唤', '契约', '使魔', '召唤圈'],
  ['记录灵', '旧影像', '幻象', '镜面'],
];

const KEYWORD_STOPWORDS = new Set([
  '检定',
  '判定',
  '目标值',
  '优先级提高',
  '失败后',
  '可保留',
  '首次',
  '第一次',
  '普通',
  '当前',
  '需要',
  '可用',
  '信任',
]);

const textOf = (value: unknown) => String(value ?? '').trim();

const rollD20 = () => Math.floor(Math.random() * 20) + 1;

const clampDc = (dc: number) => Math.max(5, Math.min(30, dc));

const findAttribute = (text: string, fallback: AttributeKey): AttributeKey => {
  const explicit = ATTRIBUTE_ALIASES.find(([, pattern]) => pattern.test(text));
  return explicit?.[0] || fallback;
};

const parseMode = (text: string): D20Mode => {
  if (/劣势|不利|disadvantage/i.test(text)) return 'disadvantage';
  if (/优势|有利|advantage/i.test(text)) return 'advantage';
  return 'normal';
};

const parseBonus = (text: string) => {
  const match = text.match(/(?:额外修正|修正|加值|bonus)\s*[:：]?\s*([+-]?\d+)/i);
  return match ? Number(match[1]) : 0;
};

const parseDc = (text: string) => {
  const match = text.match(/(?:DC|dc|目标值|难度|目标)\s*[:：]?\s*(\d{1,2})/);
  if (!match) return null;
  const dc = Number(match[1]);
  return Number.isFinite(dc) ? clampDc(dc) : null;
};

const parseTarget = (text: string) => {
  const match = text.match(/(?:目标|对象)\s*[:：]\s*([^；;，,\n]+)/);
  return match?.[1]?.trim();
};

const cleanActionText = (text: string) =>
  text
    .replace(/^.*?(?:判定|检定)\s*[:：]?\s*/i, '')
    .replace(/(?:DC|dc|目标值|难度|目标)\s*[:：]?\s*\d{1,2}/g, '')
    .replace(/(?:额外修正|修正|加值|bonus)\s*[:：]?\s*[+-]?\d+/gi, '')
    .replace(/优势|劣势|有利|不利|advantage|disadvantage/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

const extractKeywords = (text: string) =>
  text
    .replace(/[+＋-]\d+/g, '')
    .split(/[、，。；;：:（）()\s/]+/)
    .map(keyword => keyword.trim())
    .filter(keyword => keyword.length >= 2 && !KEYWORD_STOPWORDS.has(keyword));

const matchesSource = (text: string, name: string, effect: string) => {
  if (name && text.includes(name)) return true;
  const keywords = extractKeywords(effect);
  if (keywords.some(keyword => text.includes(keyword))) return true;
  return MATCH_GROUPS.some(group => group.some(keyword => effect.includes(keyword)) && group.some(keyword => text.includes(keyword)));
};

const parseNumericBonus = (effect: string) => {
  const match = effect.match(/(?:检定|判定|交涉|问诊|近战命中|远程命中)?\s*([+＋-]\d+)/);
  if (!match) return 0;
  return Number(match[1].replace('＋', '+'));
};

const parseDcAdjustment = (effect: string) => {
  const match = effect.match(/目标值\s*([+-]\d+)/);
  if (!match) return 0;
  return Number(match[1]);
};

const getContextualCheckModifiers = (text: string, player: PlayerState) => {
  const notes: string[] = [];
  let contextualBonus = 0;
  let dcAdjustment = 0;

  const race = getRaceById(player.raceId);
  if (matchesSource(text, race.auraName, race.auraEffect)) {
    const bonus = parseNumericBonus(race.auraEffect);
    if (bonus) {
      contextualBonus += bonus;
      notes.push(`种族光环【${race.auraName}】${bonus >= 0 ? '+' : ''}${bonus}`);
    } else {
      notes.push(`种族光环【${race.auraName}】触发`);
    }
  }

  const cls = getClassById(player.classId);
  if (matchesSource(text, cls.classAuraName, cls.classAuraEffect)) {
    const bonus = parseNumericBonus(cls.classAuraEffect);
    if (bonus && !/目标值\s*[+＋]\d+/.test(cls.classAuraEffect)) {
      contextualBonus += bonus;
      notes.push(`职业光环【${cls.classAuraName}】${bonus >= 0 ? '+' : ''}${bonus}`);
    } else {
      notes.push(`职业光环【${cls.classAuraName}】触发`);
    }
  }

  player.talentIds
    .map(id => getTalentById(id))
    .filter(Boolean)
    .forEach(talent => {
      if (!talent || !matchesSource(text, talent.name, talent.effect)) return;
      const bonus = parseNumericBonus(talent.effect);
      if (bonus) {
        contextualBonus += bonus;
        notes.push(`伴生技能【${talent.name}】${bonus >= 0 ? '+' : ''}${bonus}`);
      } else {
        notes.push(`伴生技能【${talent.name}】触发`);
      }
    });

  equippedIdsFromLoadout(player.equipmentLoadout)
    .map(id => getEquipmentById(id))
    .filter(Boolean)
    .forEach(item => {
      if (!item) return;
      const matchedTraits = item.traits.filter(trait => matchesSource(text, item.name, trait));
      matchedTraits.forEach(trait => {
        const dcDelta = parseDcAdjustment(trait);
        const bonus = parseNumericBonus(trait);
        if (dcDelta) {
          dcAdjustment += dcDelta;
          notes.push(`装备【${item.name}】目标值${dcDelta >= 0 ? '+' : ''}${dcDelta}`);
        } else if (bonus && /检定|判定|交涉|问诊|命中/.test(trait)) {
          contextualBonus += bonus;
          notes.push(`装备【${item.name}】${bonus >= 0 ? '+' : ''}${bonus}`);
        }
      });
    });

  return { contextualBonus, dcAdjustment, sourceNotes: notes };
};

export const parseD20CheckIntent = (rawText: string, player: PlayerState): EldredD20CheckIntent | null => {
  const text = textOf(rawText);
  if (!/(判定|检定|DC|dc|目标值|难度)/.test(text)) return null;
  if (!/(判定|检定)/.test(text) || !/(DC|dc|目标值|难度)/.test(text)) return null;

  const dc = parseDc(text);
  if (!dc) return null;

  const classData = getClassById(player.classId);
  const fallbackAttribute = classData.primaryAttributes[0] || characterClasses[0].primaryAttributes[0];
  const attribute = findAttribute(text, fallbackAttribute);
  const action = cleanActionText(text) || '行动判定';
  const contextual = getContextualCheckModifiers(text, player);
  return {
    action,
    attribute,
    dc,
    mode: parseMode(text),
    bonus: parseBonus(text),
    contextualBonus: contextual.contextualBonus,
    dcAdjustment: contextual.dcAdjustment,
    sourceNotes: contextual.sourceNotes,
    useProficiency: !/不加熟练|无熟练|no proficiency/i.test(text),
    target: parseTarget(text),
  };
};

export const resolveD20Check = (
  actor: Pick<CombatUnit, 'id' | 'name' | 'level' | 'stats'>,
  intent: EldredD20CheckIntent,
): EldredD20CheckResult => {
  const rolls = intent.mode === 'normal' ? [rollD20()] : [rollD20(), rollD20()];
  const chosenRoll = intent.mode === 'advantage' ? Math.max(...rolls) : intent.mode === 'disadvantage' ? Math.min(...rolls) : rolls[0];
  const attributeBonus = attributeModifier(actor.stats[intent.attribute]);
  const proficiency = intent.useProficiency ? proficiencyBonus(actor.level) : 0;
  const total = chosenRoll + attributeBonus + proficiency + intent.bonus + intent.contextualBonus;
  const finalDc = clampDc(intent.dc + intent.dcAdjustment);
  const success = total >= finalDc;
  const margin = total - finalDc;
  const modeLabel = intent.mode === 'advantage' ? '优势' : intent.mode === 'disadvantage' ? '劣势' : '普通';
  const explicitBonusPart = intent.bonus ? `+显式修正${intent.bonus}` : '';
  const contextualBonusPart = intent.contextualBonus ? `+来源修正${intent.contextualBonus}` : '';
  const formula = `${modeLabel}d20(${rolls.join('/')})取${chosenRoll}+${ATTRIBUTE_LABELS[intent.attribute]}${attributeBonus}+熟练${proficiency}${explicitBonusPart}${contextualBonusPart}=${total}`;
  const dcPart = intent.dcAdjustment ? `目标值${finalDc}（原${intent.dc}${intent.dcAdjustment >= 0 ? '+' : ''}${intent.dcAdjustment}）` : `目标值${finalDc}`;
  const sourcePart = intent.sourceNotes.length ? `｜来源：${intent.sourceNotes.join('、')}` : '';
  const summary = `${actor.name}｜${intent.action}｜${formula}｜${dcPart}｜${success ? '成功' : '失败'}${margin === 0 ? '' : `｜差值${margin >= 0 ? '+' : ''}${margin}`}${sourcePart}`;
  return {
    ...intent,
    requestedDc: intent.dc,
    dc: finalDc,
    actorId: actor.id,
    actorName: actor.name,
    level: actor.level,
    rolls,
    chosenRoll,
    attributeBonus,
    proficiency,
    total,
    success,
    margin,
    formula,
    summary,
  };
};
