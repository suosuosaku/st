import { useState } from 'react';
import { ArrowLeft, Compass, LocateFixed, MapPin, Route, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { PlayerState } from '../../types';
import { EldredRuntimeSave } from '../../game/eldredSave';
import { formatEldredLocation } from '../../game/locationFormat';
import { getRegionById, RegionMap, regions, worldMapImage } from '../../game/mapData';

const getRiskColor = (risk: RegionMap['risk']) => {
  if (risk === '高险') return 'border-fantasy-red text-fantasy-red';
  if (risk === '中险') return 'border-orange-500 text-orange-300';
  if (risk === '轻险') return 'border-fantasy-gold text-fantasy-gold';
  return 'border-blue-300 text-blue-300';
};

export function MapPanel({ player, runtime }: { player: PlayerState; runtime?: EldredRuntimeSave }) {
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const selectedRegion = selectedRegionId ? getRegionById(selectedRegionId) : null;
  const locationDisplay = formatEldredLocation(runtime?.world, player.location);
  const currentRegion = locationDisplay.region || getRegionById(player.location.regionId);

  return (
    <div className="h-full w-full glass-panel rounded-xl overflow-y-auto xl:overflow-hidden flex flex-col xl:flex-row relative">
      <div className="flex-1 min-h-[320px] sm:min-h-[420px] xl:min-h-0 bg-[#1a202c] relative overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, #D4AF37 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4 md:p-8 z-10">
          <div className="w-full max-w-5xl aspect-[16/10] bg-fantasy-darker border-2 border-fantasy-gold/40 rounded-xl md:rounded-3xl relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)]">
            <img
              src={selectedRegion?.image || worldMapImage}
              alt={selectedRegion ? `${selectedRegion.name}二级地图` : '艾尔德雷德世界地图'}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-fantasy-darker/20 mix-blend-multiply" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/45 pointer-events-none" />

            {!selectedRegion && (
              <>
                {regions.map(region => {
                  const isCurrent = region.id === currentRegion.id;
                  return (
                    <motion.button
                      key={region.id}
                      whileHover={{ scale: 1.04 }}
                      onClick={() => setSelectedRegionId(region.id)}
                      className={`absolute z-20 group map-marker map-marker-anchor ${isCurrent ? 'text-fantasy-gold' : 'text-gray-200 hover:text-white'}`}
                      style={{ left: `${region.x}%`, top: `${region.y}%` }}
                    >
                      <span className={`map-marker-pin rounded-full border bg-fantasy-dark/90 flex items-center justify-center shadow-lg ${isCurrent ? 'w-8 h-8 sm:w-11 sm:h-11 border-2 border-fantasy-gold shadow-[0_0_18px_rgba(212,175,55,0.7)]' : `w-7 h-7 sm:w-9 sm:h-9 ${getRiskColor(region.risk)} group-hover:border-white`}`}>
                        {isCurrent ? (
                          <LocateFixed className="w-4 h-4 sm:w-5 sm:h-5 text-fantasy-gold animate-pulse" />
                        ) : (
                          <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
                        )}
                      </span>
                      <span className={`map-marker-label font-serif whitespace-nowrap text-[9px] sm:text-[11px] md:text-xs drop-shadow-md px-1.5 sm:px-2 py-0.5 rounded bg-black/75 border border-white/10 ${isCurrent ? 'text-fantasy-gold' : 'text-gray-200 group-hover:text-white'}`}>
                        {region.name}
                      </span>
                    </motion.button>
                  );
                })}
              </>
            )}

            {selectedRegion && (
              <>
                <button
                  onClick={() => setSelectedRegionId(null)}
                  className="absolute left-4 top-4 z-30 btn-rpg px-4 py-2 rounded text-xs flex items-center gap-2 bg-black/70"
                >
                  <ArrowLeft className="w-4 h-4" />
                  世界地图
                </button>

                {selectedRegion.landmarks.map(landmark => {
                  const isCurrent = selectedRegion.id === currentRegion.id && landmark.name === locationDisplay.landmarkName;
                  return (
                    <motion.button
                      key={landmark.name}
                      whileHover={{ scale: 1.04 }}
                      className={`absolute z-20 map-marker map-marker-anchor text-center ${isCurrent ? 'text-fantasy-gold' : 'text-gray-200 hover:text-white'}`}
                      style={{ left: `${landmark.x}%`, top: `${landmark.y}%` }}
                    >
                      <span className={`map-marker-pin w-6 h-6 sm:w-8 sm:h-8 rounded-full border bg-fantasy-dark/90 flex items-center justify-center shadow-lg ${isCurrent ? 'border-2 border-fantasy-gold shadow-[0_0_18px_rgba(212,175,55,0.7)]' : 'border-fantasy-gold/60 hover:border-fantasy-gold'}`}>
                        <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </span>
                      <span className={`map-marker-label block text-[9px] sm:text-[11px] md:text-xs font-serif whitespace-nowrap px-1.5 sm:px-2 py-0.5 rounded bg-black/75 border border-white/10 max-w-[120px] sm:max-w-[170px] overflow-hidden text-ellipsis ${isCurrent ? 'text-fantasy-gold' : 'text-gray-200'}`}>
                        {landmark.name}
                      </span>
                      {isCurrent && <span className="map-marker-current block text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded bg-fantasy-gold/20 border border-fantasy-gold/40">当前位置</span>}
                    </motion.button>
                  );
                })}

                <div className="absolute right-3 bottom-3 md:right-4 md:bottom-4 z-20 bg-black/70 border border-fantasy-gold/30 rounded px-3 md:px-4 py-2 text-[10px] sm:text-xs text-gray-300">
                  {selectedRegion.name}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="absolute top-4 right-4 md:top-6 md:right-6 z-20 text-fantasy-gold/40">
          <Compass className="w-10 h-10 md:w-16 md:h-16 animate-[spin_60s_linear_infinite]" />
        </div>
      </div>

      <div className="w-full xl:w-80 max-h-[45vh] xl:max-h-none bg-fantasy-darker border-t xl:border-t-0 xl:border-l border-fantasy-gold/20 flex flex-col relative z-20">
        <div className="p-4 xl:p-6 border-b border-fantasy-gold/20">
          <h2 className="text-xl xl:text-2xl font-serif text-copper-gradient mb-1">
            {selectedRegion ? selectedRegion.name : '艾尔德雷德世界地图'}
          </h2>
          <p className="text-gray-400 text-xs xl:text-sm leading-relaxed">
            {selectedRegion ? selectedRegion.summary : `当前坐标：${locationDisplay.fullName}`}
          </p>
        </div>

        <div className="p-4 xl:p-6 flex-1 overflow-y-auto space-y-5 xl:space-y-6">
          <div>
            <div className="text-xs text-fantasy-gold mb-3 font-semibold tracking-wider">地图状态</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-fantasy-dark p-3 rounded border border-white/5 flex flex-col items-center">
                <Route className="w-5 h-5 text-fantasy-gold mb-1" />
                <span className="text-xs text-gray-300 text-center break-words">{selectedRegion ? selectedRegion.area : '世界路网'}</span>
              </div>
              <div className="bg-fantasy-dark p-3 rounded border border-white/5 flex flex-col items-center">
                <ShieldAlert className="w-5 h-5 text-gray-400 mb-1" />
                <span className="text-xs text-gray-300 text-center">{selectedRegion ? selectedRegion.risk : currentRegion.risk}</span>
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs text-fantasy-gold mb-3 font-semibold tracking-wider">
              {selectedRegion ? '小地标' : '大地标'}
            </div>
            <div className="space-y-2">
              {(selectedRegion ? selectedRegion.landmarks : regions).map(item => {
                const name = item.name;
                const desc = 'desc' in item ? item.desc : item.summary;
                return (
                  <button
                    key={name}
                    onClick={() => {
                      if (!selectedRegion && 'id' in item) setSelectedRegionId(item.id);
                    }}
                    className="w-full text-left p-3 rounded bg-white/5 hover:bg-white/10 transition-colors border border-transparent hover:border-fantasy-gold/30 text-sm text-gray-300"
                  >
                    <span className="block text-gray-200 font-serif">{name}</span>
                    <span className="block text-xs text-gray-500 mt-1 line-clamp-2">{desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedRegion && (
            <div>
              <div className="text-xs text-fantasy-gold mb-3 font-semibold tracking-wider">服务与线索</div>
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedRegion.services.map(service => (
                  <span key={service} className="px-2 py-1 bg-fantasy-blue/20 border border-blue-400/20 text-blue-200 text-xs rounded">{service}</span>
                ))}
              </div>
              <div className="space-y-2">
                {selectedRegion.mainClues.map(clue => (
                  <div key={clue} className="text-xs bg-black/30 border border-white/5 rounded px-3 py-2 text-gray-400">{clue}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 xl:p-6 border-t border-fantasy-gold/20 bg-fantasy-dark">
          <button
            onClick={() => setSelectedRegionId(selectedRegion ? null : currentRegion.id)}
            className="btn-rpg w-full py-3 rounded text-sm tracking-widest bg-fantasy-gold/10"
          >
            {selectedRegion ? '返回世界地图' : '查看当前位置'}
          </button>
        </div>
      </div>
    </div>
  );
}
