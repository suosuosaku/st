import { Archive, Shield, Sparkles } from 'lucide-react';
import { PlayerState } from '../../types';
import { equippedIdsFromLoadout, getEquipmentById } from '../../game/rules';

const slotLabel: Record<string, string> = {
  weapon: '武器',
  upper: '上身',
  lower: '下身',
  hands: '手部',
  ring: '戒指',
  boots: '靴子',
  tool: '工具',
  shield: '盾牌',
};

export function InventoryPanel({ player }: { player: PlayerState }) {
  const equipment = player.equipmentIds.map(id => getEquipmentById(id)).filter(Boolean);
  const equippedIds = new Set(equippedIdsFromLoadout(player.equipmentLoadout));

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="grid gap-4 xl:grid-cols-[1.05fr_1fr]">
        <section className="glass-panel rounded-xl p-5 md:p-6">
          <div className="mb-5 flex items-center justify-between border-b border-fantasy-gold/20 pb-3">
            <h2 className="font-serif text-xl text-fantasy-gold">行囊</h2>
            <Archive className="h-5 w-5 text-fantasy-gold/60" />
          </div>
          {player.inventory.length === 0 ? (
            <div className="pixel-data-tile p-4 text-sm text-gray-500">暂无物品</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {player.inventory.map((item, index) => (
                <div key={`${item}-${index}`} className="pixel-data-tile p-3">
                  <div className="text-sm font-serif text-gray-100">{item}</div>
                  <div className="mt-1 text-[11px] text-gray-500">背包记录</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="glass-panel rounded-xl p-5 md:p-6">
          <div className="mb-5 flex items-center justify-between border-b border-fantasy-gold/20 pb-3">
            <h2 className="font-serif text-xl text-fantasy-gold">装备记录</h2>
            <Shield className="h-5 w-5 text-fantasy-gold/60" />
          </div>
          {equipment.length === 0 ? (
            <div className="pixel-data-tile p-4 text-sm text-gray-500">暂无装备</div>
          ) : (
            <div className="space-y-3">
              {equipment.map(item => item && (
                <div key={item.id} className={`pixel-data-tile p-3 ${equippedIds.has(item.id) ? 'border-fantasy-gold text-gray-100' : 'text-gray-400'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-serif text-sm text-gray-100">{item.name}</div>
                      <div className="mt-1 text-[11px] text-gray-500">{slotLabel[item.slot] || item.slot} / {item.grade}</div>
                    </div>
                    {equippedIds.has(item.id) && <Sparkles className="h-4 w-4 shrink-0 text-fantasy-gold" />}
                  </div>
                  <div className="mt-2 text-xs leading-5 text-gray-500">{item.traits.join('；')}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
