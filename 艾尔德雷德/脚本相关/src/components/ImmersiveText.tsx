import { Award, BookMarked, Heart, MapPin, PackagePlus, Shield, Sparkles, TrendingUp, UserPlus } from 'lucide-react';
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

const getAvatar = (name: string) => {
  const known = eldredNPCs.find(npc => npc.name === name || npc.fullName.includes(name));
  return known?.avatarUrl || characterImage(name, '头像');
};

export function DialogueLine({ speaker, text }: { speaker: string; text: string }) {
  return (
    <div className="my-4 flex gap-3 items-start">
      <div className="w-11 h-11 shrink-0 rounded border border-[#8b4513]/40 bg-[#3A2C1D]/10 overflow-hidden shadow">
        <img src={getAvatar(speaker)} alt={speaker} className="w-full h-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-base md:text-lg font-serif text-[#8b4513] mb-1">【{speaker}】</div>
        <div className="relative rounded border border-[#8b4513]/25 bg-[#f8edd4]/60 px-4 py-3 text-sm md:text-base leading-7 shadow-inner">
          {text}
        </div>
      </div>
    </div>
  );
}

export function ImmersiveNoticeCard({ notice }: { notice: ImmersiveNotice }) {
  const Icon = iconByType[notice.type];
  return (
    <div className="glass-panel rounded-lg p-4 border-fantasy-gold/40 bg-gradient-to-br from-fantasy-gold/10 via-black/30 to-fantasy-blue/10">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded bg-fantasy-gold/10 border border-fantasy-gold/30 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-fantasy-gold" />
        </div>
        <div className="min-w-0">
          <div className="font-serif text-fantasy-gold text-sm tracking-wider">{notice.title}</div>
          <div className="text-xs text-gray-300 leading-5 mt-1">{notice.body}</div>
          {notice.meta && <div className="text-[11px] text-gray-500 mt-2">{notice.meta}</div>}
        </div>
      </div>
    </div>
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
