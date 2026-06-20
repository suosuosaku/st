import { Award, BookMarked, Heart, MapPin, PackagePlus, Shield, Sparkles, Swords, TrendingUp, UserPlus } from 'lucide-react';
import { characterImage, eldredNPCs } from '../data';
import { ImmersiveNotice, ImmersiveNoticeType } from '../types';

const iconByType: Record<ImmersiveNoticeType, typeof PackagePlus> = {
  item: PackagePlus,
  quest: BookMarked,
  event: Sparkles,
  npc: UserPlus,
  skill: Award,
  location: MapPin,
  level: TrendingUp,
  favor: Heart,
  reputation: Shield,
  equipment: PackagePlus,
};

const noticeTypeFromTitle = (title: string): ImmersiveNoticeType => {
  if (/物品|获得/.test(title)) return 'item';
  if (/委托/.test(title)) return 'quest';
  if (/NPC|角色|收录/.test(title)) return 'npc';
  if (/技能/.test(title)) return 'skill';
  if (/地点|地图/.test(title)) return 'location';
  if (/升级|等级/.test(title)) return 'level';
  if (/好感/.test(title)) return 'favor';
  if (/声望/.test(title)) return 'reputation';
  if (/装备/.test(title)) return 'equipment';
  return 'event';
};

const getAvatar = (name: string) => {
  const known = eldredNPCs.find(npc => npc.name === name || npc.fullName.includes(name));
  return known?.avatarUrl || characterImage(name, '头像');
};

export function DialogueLine({ speaker, text }: { speaker: string; text: string }) {
  return (
    <div className="my-4 flex gap-3 items-start pixel-dialogue">
      <div className="pixel-avatar w-12 h-12 md:w-14 md:h-14 shrink-0 overflow-hidden">
        <img src={getAvatar(speaker)} alt={speaker} className="w-full h-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-lg md:text-xl font-serif text-[#7b4218] mb-1 font-bold tracking-wide">【{speaker}】</div>
        <div className="pixel-speech relative px-4 py-3 text-sm md:text-base leading-7">
          {text}
        </div>
      </div>
    </div>
  );
}

export function ImmersiveNoticeCard({ notice }: { notice: ImmersiveNotice }) {
  const Icon = iconByType[notice.type];
  return (
    <NoticePanel title={notice.title} body={notice.body} meta={notice.meta} Icon={Icon} compact />
  );
}

function NoticePanel({
  title,
  body,
  meta,
  Icon,
  compact = false,
}: {
  title: string;
  body: string;
  meta?: string;
  Icon: typeof PackagePlus;
  compact?: boolean;
}) {
  const noticeTitle = title.replace(/^【|】$/g, '');
  const parts = body.split(/[｜|]/).map(part => part.trim()).filter(Boolean);
  return (
    <div className={`pixel-inline-notice ${compact ? 'pixel-inline-notice-compact' : ''}`}>
      <div className="pixel-inline-notice-icon">
        <Icon className="h-5 w-5" />
      </div>
      <div className="pixel-inline-notice-main">
        <div className="pixel-inline-notice-title font-serif text-sm md:text-base">【{noticeTitle}】</div>
        <div className="pixel-inline-notice-body text-xs md:text-sm">
          {parts.length > 1 ? (
            <div className="pixel-inline-notice-body-grid">
              {parts.map((part, index) => (
                <span className="pixel-inline-notice-chip" key={`${noticeTitle}-${index}`}>{part}</span>
              ))}
            </div>
          ) : (
            <div className="whitespace-pre-line">{body}</div>
          )}
          {meta && <div className="pixel-card-meta">{meta}</div>}
        </div>
      </div>
    </div>
  );
}

function InlineNotice({ title, body }: { title: string; body: string }) {
  const type = noticeTypeFromTitle(title);
  const Icon = title.includes('战斗') ? Swords : iconByType[type];
  return (
    <NoticePanel title={title} body={body} Icon={Icon} />
  );
}

export function RichNarrative({ text }: { text: string }) {
  const lines = text.split(/\n+/).map(line => line.trim()).filter(Boolean);
  return (
    <>
      {lines.map((line, index) => {
        const dialogue = line.match(/^【([^】]{1,32})】[：:]\s*[“"]?(.+?)[”"]?$/);
        if (dialogue) {
          return <DialogueLine key={`${dialogue[1]}-${index}`} speaker={dialogue[1]} text={dialogue[2]} />;
        }
        const notice = line.match(/^【(获得物品|获得技能|委托更新|NPC收录|地点解锁|事件推进|好感变化|声望变化|装备变更|角色升级|战斗回合|战斗结算)】[：:：]?\s*(.+)$/);
        if (notice) {
          return <InlineNotice key={`notice-${index}`} title={notice[1]} body={notice[2]} />;
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
