import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { TabState } from '../types';
import { LayoutDashboard, Map as MapIcon, Users, Contact, ClipboardList, Package, Sword, Settings, SearchCheck } from 'lucide-react';

const TABS: { id: TabState; label: string; icon: any }[] = [
  { id: 'overview', label: '总览', icon: LayoutDashboard },
  { id: 'map', label: '地图', icon: MapIcon },
  { id: 'party', label: '队伍', icon: Users },
  { id: 'npc', label: 'NPC', icon: Contact },
  { id: 'quests', label: '看板', icon: ClipboardList },
  { id: 'clues', label: '线索', icon: SearchCheck },
  { id: 'inventory', label: '行囊', icon: Package },
  { id: 'combat', label: '战斗', icon: Sword },
  { id: 'system', label: '札记', icon: Settings },
];

interface HUDProps {
  activeTab: TabState;
  onTabChange: (tab: TabState) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export function HUD({ activeTab, onTabChange, isExpanded, onToggleExpand }: HUDProps) {
  const [isCompact, setIsCompact] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1439px)').matches : false,
  );

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1439px)');
    const syncCompact = () => setIsCompact(media.matches);
    syncCompact();
    media.addEventListener('change', syncCompact);
    return () => media.removeEventListener('change', syncCompact);
  }, []);

  return (
    <motion.div 
      key={isCompact ? 'compact-hud' : 'desktop-hud'}
      drag={!isCompact}
      dragMomentum={false}
      dragElastic={0.1}
      data-eldred-hud="tabs"
      className={`fixed left-2 right-2 top-2 bottom-auto lg:right-auto lg:left-4 lg:top-1/2 lg:bottom-auto lg:-translate-y-1/2 z-50 flex flex-row lg:flex-col items-center lg:items-stretch gap-1 lg:gap-2 p-1.5 lg:p-2 glass-panel rounded-xl select-none ${isExpanded ? 'lg:w-48' : 'lg:w-16'} transition-all duration-300 cursor-default lg:cursor-move border border-fantasy-gold/40 hover:border-fantasy-gold/70 overflow-x-auto overflow-y-hidden lg:overflow-visible`}
      style={{ boxShadow: '0 10px 40px rgba(0,0,0,0.8), inset 0 0 15px rgba(212,175,55,0.1)' }}
    >
      <div 
        className="hidden lg:flex w-full justify-center pb-2 border-b border-fantasy-gold/20 cursor-pointer text-fantasy-gold/60 hover:text-fantasy-gold transition-colors"
        onClick={onToggleExpand}
        title={isExpanded ? "收起面板" : "展开面板"}
      >
        <div className="w-8 h-1 bg-current rounded-full opacity-50" />
      </div>

      <div className="flex flex-row lg:flex-col gap-1 lg:mt-2 w-full justify-between lg:justify-start">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              id={`hud-tab-${tab.id}`}
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex items-center justify-center lg:justify-start p-2.5 lg:p-3 rounded-lg transition-all duration-200 cursor-pointer overflow-hidden group min-w-10
                ${isActive ? 'bg-fantasy-gold/20 text-white shadow-[inset_0_0_10px_rgba(212,175,55,0.2)]' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
              title={tab.label}
            >
              {isActive && (
                <motion.div 
                  layoutId="activeTabIndicator" 
                  className="absolute left-0 top-0 bottom-0 w-1 bg-fantasy-gold shadow-[0_0_8px_#D4AF37]" 
                />
              )}
              <div className="flex items-center gap-4">
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-fantasy-gold drop-shadow-[0_0_5px_rgba(212,175,55,0.5)]' : ''}`} />
                {isExpanded && (
                  <span className={`hidden lg:inline font-serif tracking-widest whitespace-nowrap ${isActive ? 'text-fantasy-gold font-semibold' : ''}`}>
                    {tab.label}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </motion.div>
  );
}
