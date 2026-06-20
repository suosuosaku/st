import { Clock, MapPin, ShieldAlert, ScrollText } from 'lucide-react';
import { ImmersiveNoticeCard, RichNarrative } from '../ImmersiveText';
import { PlayerState } from '../../types';
import { EldredRuntimeSave } from '../../game/eldredSave';

export function OverviewPanel({
  player,
  openingPayload,
  openingStatus,
  runtime,
}: {
  player: PlayerState;
  openingPayload: string;
  openingStatus: string;
  runtime?: EldredRuntimeSave;
}) {
  const narrative = openingPayload || '等待入局设定';
  const world = runtime?.world;
  const locationName = world?.currentLocation || player.location.name;
  const landmarkName = world?.landmark || player.location.landmarkName;
  const timeText = world?.currentTime || '待正文落定';
  const weatherText = world?.weather || player.location.weather || '未登记';

  return (
    <div className="h-full w-full flex flex-col xl:flex-row gap-4 xl:gap-6 overflow-y-auto xl:overflow-hidden">
      <div className="flex-1 min-h-[420px] xl:min-h-0 parchment-panel rounded-lg p-5 md:p-8 flex flex-col relative overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[#8b4513]/20 pb-4 mb-4">
          <ScrollText className="w-6 h-6 text-[#8b4513]" />
          <h2 className="text-xl font-bold text-[#5c3a21] tracking-widest">入局载荷</h2>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 md:pr-4 space-y-5 md:space-y-6 text-[#3A2C1D] leading-relaxed relative z-10 text-sm sm:text-base md:text-lg">
          <RichNarrative text={narrative} />
        </div>

        <div className="mt-4 pt-4 border-t border-[#8b4513]/20 flex flex-col sm:flex-row gap-2">
          <div className="flex-1 bg-white/40 border border-[#8b4513]/30 rounded px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base text-[#3A2C1D]">
            {openingStatus}
          </div>
        </div>
      </div>

      <div className="w-full xl:w-80 flex flex-col gap-4">
        <div className="glass-panel p-5 rounded-lg flex flex-col gap-3">
          <div className="text-fantasy-gold font-serif text-sm border-b border-fantasy-gold/20 pb-2">当前位置</div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-fantasy-blue/20 border border-fantasy-blue flex items-center justify-center text-fantasy-blue">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base md:text-lg text-gray-200 font-serif">{locationName}·{landmarkName}</div>
              <div className="text-xs text-gray-400">{world?.subRegion || player.location.summary}</div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-lg flex flex-col gap-3">
          <div className="text-fantasy-gold font-serif text-sm border-b border-fantasy-gold/20 pb-2">入局状态</div>
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-gray-400" />
            <div className="text-gray-300 text-sm">{timeText}</div>
          </div>
          <div className="text-blue-400/80 text-sm pl-8">{weatherText}</div>
        </div>

        <div className="glass-panel p-5 rounded-lg min-h-48 xl:flex-1 flex flex-col gap-3">
          <div className="text-fantasy-gold font-serif text-sm border-b border-fantasy-gold/20 pb-2 flex items-center justify-between">
            <span>交互记录</span>
            <ShieldAlert className="w-4 h-4 text-fantasy-gold/50" />
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {player.notices.length === 0 && (
              <div className="text-xs text-gray-500 leading-5">暂无记录</div>
            )}
            {player.notices.map(notice => (
              <ImmersiveNoticeCard key={notice.id} notice={notice} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
