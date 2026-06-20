import { characterImage, eldredNPCs } from '../data';
import { ImmersiveNotice } from '../types';

const noticeLabels = new Set([
  '获得物品',
  '获得技能',
  '技能入库',
  '委托更新',
  '委托接取',
  '委托生成',
  '委托完成',
  'NPC收录',
  '地点解锁',
  '地图加载',
  '路径行动',
  '事件推进',
  '事件进展',
  '奇遇事件',
  '翻牌结果',
  '主线进展',
  '好感变化',
  '声望变化',
  '装备变更',
  '角色升级',
  '升级提示',
  '队伍编成',
  '购买结算',
  '战斗回合',
  '战斗结算',
  '战斗实况',
  '技能演出',
]);

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
  return (
    <NoticePanel title={notice.title} body={notice.body} meta={notice.meta} compact />
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
  const noticeTitle = title.replace(/^【|】$/g, '');
  const parts = body.split(/[｜|]/).map(part => part.trim()).filter(Boolean);
  const [primaryPart, ...detailParts] = parts;
  return (
    <div className={`pixel-inline-notice ${compact ? 'pixel-inline-notice-compact' : ''}`}>
      <div className="pixel-inline-notice-main">
        <div className="pixel-inline-notice-title font-serif">【{noticeTitle}】</div>
        <div className="pixel-inline-notice-body text-xs md:text-sm">
          {parts.length > 1 ? (
            <>
              <div className="pixel-inline-notice-primary">{primaryPart}</div>
              {detailParts.length > 0 && (
                <div className="pixel-inline-notice-body-grid">
                  {detailParts.map((part, index) => (
                    <span className="pixel-inline-notice-chip" key={`${noticeTitle}-${index}`}>{part}</span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="pixel-inline-notice-text whitespace-pre-line">{body}</div>
          )}
          {meta && <div className="pixel-card-meta">{meta}</div>}
        </div>
      </div>
    </div>
  );
}

function InlineNotice({ title, body }: { title: string; body: string }) {
  return (
    <NoticePanel title={title} body={body} />
  );
}

export function RichNarrative({ text }: { text: string }) {
  const lines = text.split(/\n+/).map(line => line.trim()).filter(Boolean);
  return (
    <>
      {lines.map((line, index) => {
        const notice = line.match(/^【([^】]{1,32})】[：:]\s*(.+)$/);
        if (notice && noticeLabels.has(notice[1])) {
          return <InlineNotice key={`notice-${index}`} title={notice[1]} body={notice[2]} />;
        }

        const dialogue = line.match(/^【([^】]{1,32})】[：:]\s*[“"](.+?)[”"]?$/);
        if (dialogue) {
          return <DialogueLine key={`${dialogue[1]}-${index}`} speaker={dialogue[1]} text={dialogue[2]} />;
        }

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
