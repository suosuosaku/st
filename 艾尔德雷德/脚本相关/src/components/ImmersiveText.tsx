import { useState } from 'react';
import { eldredNPCs, resolveCharacterImage } from '../data';
import { ImmersiveNotice } from '../types';
import { calculateDerivedStats } from '../game/rules';

type NoticeKind = 'item' | 'skill' | 'quest' | 'npc' | 'clue' | 'relation' | 'combat' | 'level' | 'event' | 'soft-location';

const noticeKindMap: Record<string, NoticeKind> = {
  获得物品: 'item',
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
  if (!raw) return type === '头像' ? getAvatar(name) : getPortrait(name);
  return resolveCharacterImage(name, type, { raw, fixed: Boolean(knownNpcByName(name)) });
};

const stripLabel = (title: string) => title.replace(/^【|】$/g, '').trim();

const splitNoticeParts = (body: string) =>
  body
    .split(/[｜|]/)
    .map(part => part.trim())
    .filter(Boolean);

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
    <div className="my-4 flex gap-3 items-start pixel-dialogue">
      <div className="pixel-avatar w-12 h-12 md:w-14 md:h-14 shrink-0 overflow-hidden">
        <ImageOrInitial src={avatar} name={speaker} imageClassName="w-full h-full object-cover" fallbackClassName="text-lg" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xl md:text-2xl font-serif text-[#7b4218] mb-1 font-bold tracking-wide">【{speaker}】</div>
        <div className="pixel-speech relative px-4 py-3 text-sm md:text-base leading-7">
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
  const fallbackStats = known?.stats || calculateDerivedStats(1, known?.classId || 'sage', { str: 1, dex: 3, vit: 3, int: 5, spr: 3 });
  const identity = fieldOrPart(fields, parts, ['身份', '职责'], undefined, parts[1] || '身份待登记');
  const level = usableText(fields.get('等级'))
    || usableText(fields.get('机制数值'))?.match(/(?:Lv\.?|等级)\s*([0-9]+)/i)?.[1]
    || pickPart(parts, /(?:Lv\.?|等级)\s*([0-9]+)/i)?.match(/(?:Lv\.?|等级)\s*([0-9]+)/i)?.[1]
    || String(fallbackStats.level || 1);
  const hp = usableText(fields.get('生命'))
    || usableText(fields.get('HP'))
    || usableText(fields.get('机制数值'))?.match(/(?:HP|生命)[:：]?\s*([0-9]+\/[0-9]+)/i)?.[1]
    || pickPart(parts, /(?:HP|生命)[:：]?\s*([0-9]+\/[0-9]+)/i)?.match(/(?:HP|生命)[:：]?\s*([0-9]+\/[0-9]+)/i)?.[1]
    || `${fallbackStats.hp}/${fallbackStats.maxHp}`;
  const mp = usableText(fields.get('法力'))
    || usableText(fields.get('MP'))
    || usableText(fields.get('机制数值'))?.match(/(?:MP|法力)[:：]?\s*([0-9]+\/[0-9]+)/i)?.[1]
    || pickPart(parts, /(?:MP|法力)[:：]?\s*([0-9]+\/[0-9]+)/i)?.match(/(?:MP|法力)[:：]?\s*([0-9]+\/[0-9]+)/i)?.[1]
    || `${fallbackStats.mp}/${fallbackStats.maxMp}`;
  const ac = usableText(fields.get('护甲'))
    || usableText(fields.get('AC'))
    || usableText(fields.get('机制数值'))?.match(/(?:AC|护甲)[:：]?\s*([0-9]+)/i)?.[1]
    || pickPart(parts, /(?:AC|护甲)[:：]?\s*([0-9]+)/i)?.match(/(?:AC|护甲)[:：]?\s*([0-9]+)/i)?.[1]
    || String(fallbackStats.ac);
  const attributes = usableText(fields.get('属性')) || usableText(fields.get('五维')) || pickPart(parts, /力量|敏捷|体质|智力|精神/) || '';
  const portrait = imageFromField(fields.get('立绘'), name, '立绘');
  const affiliation = fields.get('所属') || fields.get('所属地区') || fields.get('所属地标') || fields.get('势力') || '';
  const revisit = fields.get('可回访') || fields.get('可回访地点') || fields.get('可回访事项') || parts.find(part => /可回访|回访/.test(part)) || '';
  const details = [
    `身份：${identity}`,
    `等级：Lv.${level}`,
    `生命：${hp}`,
    `法力：${mp}`,
    `护甲：${ac}`,
    attributes ? `属性：${attributes}` : '',
    affiliation ? `所属：${affiliation}` : '',
    revisit ? `可回访：${revisit}` : '',
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
              {(details.length ? details : ['资料待补全']).map((part, index) => (
                <div className="eldred-npc-detail" key={`${name}-${index}`}><HighlightText text={part} /></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CombatNotice({ title, body, compact = false }: { title: string; body: string; compact?: boolean }) {
  const noticeTitle = stripLabel(title);
  const { parts, fields } = noticeFieldsFrom(body);
  const round = fields.get('回合') || fields.get('触发') || parts[0] || noticeTitle;
  const actor = fields.get('行动者') || fields.get('执行者') || fields.get('单位') || fields.get('触发') || '';
  const action = fields.get('招式') || fields.get('技能名') || fields.get('行动') || fields.get('阶段') || parts[1] || '';
  const result = fields.get('结果') || fields.get('命中') || fields.get('判定') || '';
  const damage = fields.get('伤害') || fields.get('威力') || fields.get('消耗') || '';
  const status = fields.get('状态') || fields.get('状态变化') || fields.get('下一压力') || fields.get('环境') || '';
  const detailParts = [
    actor ? `行动者：${actor}` : '',
    action ? `行动：${action}` : '',
    result ? `判定：${result}` : '',
    damage ? `数值：${damage}` : '',
    status ? `状态：${status}` : '',
    ...parts.slice(2),
  ].filter(Boolean);

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
  const lines = text.split(/\n+/).map(line => line.trim()).filter(Boolean);
  return (
    <>
      {lines.map((line, index) => {
        const notice = line.match(/^【([^】]{1,32})】[：:]\s*(.+)$/);
        if (notice && noticeKindMap[notice[1]]) {
          return <InlineNotice key={`notice-${index}`} title={notice[1]} body={notice[2]} />;
        }

        const dialogue = line.match(/^【([^】]{1,32})】[：:]\s*[“"](.+?)[”"]?$/);
        if (dialogue) {
          return <DialogueLine key={`${dialogue[1]}-${index}`} speaker={dialogue[1]} text={dialogue[2]} />;
        }

        if (notice) {
          return <TaggedLine key={`tagged-${index}`} title={notice[1]} body={notice[2]} />;
        }

        return (
          <p key={index}>
            {index === 0 && <span className="text-2xl md:text-3xl font-bold float-left mr-2 text-[#8b4513]">{line.slice(0, 1)}</span>}
            {index === 0 ? line.slice(1) : line}
          </p>
        );
      })}
    </>
  );
}
