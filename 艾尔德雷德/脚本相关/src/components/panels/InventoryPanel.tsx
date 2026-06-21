import { useMemo, useState } from 'react';
import { Archive, ChevronLeft, ChevronRight, FlaskConical, Gem, Package, Play, ScrollText, Shield, Sparkles, Trash2 } from 'lucide-react';
import { PlayerState } from '../../types';
import { EldredFrontendEventInput } from '../../game/eldredEvents';
import { EldredRuntimeSave } from '../../game/eldredSave';
import { equippedIdsFromLoadout, getEquipmentById } from '../../game/rules';

type InventoryCategory = '消耗品' | '装备' | '线索' | '材料' | '任务物品' | '其他';

type InventoryDisplayItem = {
  id: string;
  name: string;
  category: InventoryCategory;
  detail: string;
  meta: string;
  quantity?: string;
  usable: boolean;
  equipmentId?: string;
  equipped?: boolean;
};

type InventoryPanelProps = {
  player: PlayerState;
  runtime?: EldredRuntimeSave;
  onSubmitEvent?: (event: Omit<EldredFrontendEventInput, 'player' | 'party' | 'enemies'>) => Promise<void>;
  onDiscardItem?: (item: { id?: string; name: string; category?: string; equipmentId?: string }) => Promise<void> | void;
  onOpenOverview?: () => void;
};

const PAGE_SIZE = 8;
const CATEGORIES: InventoryCategory[] = ['消耗品', '装备', '线索', '材料', '任务物品', '其他'];

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

const categoryIcon: Record<InventoryCategory, typeof Package> = {
  消耗品: FlaskConical,
  装备: Shield,
  线索: ScrollText,
  材料: Gem,
  任务物品: Archive,
  其他: Package,
};

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const asRecord = (value: unknown): Record<string, any> => isRecord(value) ? value : {};

const textOf = (value: unknown, fallback = '') => String(value ?? fallback).trim();

const rawItemRecord = (runtime: EldredRuntimeSave | undefined, itemName: string) => {
  const backpack = asRecord(asRecord(runtime?.rawStatData?.主角).背包);
  return asRecord(backpack[itemName]);
};

const classifyInventoryItem = (name: string, raw: Record<string, any>): InventoryCategory => {
  const haystack = [
    name,
    raw.分类,
    raw.类别,
    raw.类型,
    raw.tags,
    raw.标签,
    raw.用途,
    raw.说明,
  ].join(' ');
  if (/消耗|药剂|药水|回复|治疗|绷带|食物|口粮|酒|卷轴|符咒|炸弹|瓶|圣水|解毒/.test(haystack)) return '消耗品';
  if (/线索|证据|账本|短账纸|残页|档案|病历|钥匙册|旧页|拓印|抄页/.test(haystack)) return '线索';
  if (/材料|素材|矿|草药|药草|皮革|零件|齿轮|粉末|结晶|木材|布料/.test(haystack)) return '材料';
  if (/任务|委托|信物|凭证|许可|钥匙|通行证|令牌|证明|契约/.test(haystack)) return '任务物品';
  return '其他';
};

const itemQuantity = (raw: Record<string, any>) => {
  const quantity = raw.数量 ?? raw.count ?? raw.quantity;
  return quantity === undefined || quantity === null || quantity === '' ? '' : String(quantity);
};

const itemDetail = (name: string, raw: Record<string, any>) =>
  textOf(raw.说明 ?? raw.描述 ?? raw.详情 ?? raw.内容 ?? raw.效果 ?? raw.用途, `${name} 已登记在行囊中。`);

const buildInventoryItems = (player: PlayerState, runtime?: EldredRuntimeSave): InventoryDisplayItem[] => {
  const equippedIds = new Set(equippedIdsFromLoadout(player.equipmentLoadout));
  const items = new Map<string, InventoryDisplayItem>();

  player.inventory.forEach((name, index) => {
    const raw = rawItemRecord(runtime, name);
    const category = classifyInventoryItem(name, raw);
    const id = textOf(raw.id ?? raw.ID ?? raw.itemId, `bag-${name}-${index}`);
    items.set(`bag:${id}:${name}`, {
      id,
      name,
      category,
      detail: itemDetail(name, raw),
      meta: [textOf(raw.来源 ?? raw.source), textOf(raw.状态 ?? raw.status), itemQuantity(raw) ? `数量 ${itemQuantity(raw)}` : ''].filter(Boolean).join(' / '),
      quantity: itemQuantity(raw),
      usable: category === '消耗品',
    });
  });

  player.equipmentIds.forEach(equipmentId => {
    const equipment = getEquipmentById(equipmentId);
    if (!equipment) return;
    items.set(`equipment:${equipment.id}`, {
      id: equipment.id,
      name: equipment.name,
      category: '装备',
      detail: equipment.traits.join('；') || `${slotLabel[equipment.slot] || equipment.slot}装备`,
      meta: `${slotLabel[equipment.slot] || equipment.slot} / ${equipment.grade}${equippedIds.has(equipment.id) ? ' / 已穿戴' : ''}`,
      usable: false,
      equipmentId: equipment.id,
      equipped: equippedIds.has(equipment.id),
    });
  });

  return Array.from(items.values());
};

const pageItems = (items: InventoryDisplayItem[], page: number) =>
  items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

export function InventoryPanel({ player, runtime, onSubmitEvent, onDiscardItem, onOpenOverview }: InventoryPanelProps) {
  const [activeCategory, setActiveCategory] = useState<InventoryCategory>('消耗品');
  const [pageByCategory, setPageByCategory] = useState<Record<InventoryCategory, number>>({
    消耗品: 1,
    装备: 1,
    线索: 1,
    材料: 1,
    任务物品: 1,
    其他: 1,
  });
  const items = useMemo(() => buildInventoryItems(player, runtime), [player, runtime]);
  const equipment = player.equipmentIds.map(id => getEquipmentById(id)).filter(Boolean);
  const equippedIds = new Set(equippedIdsFromLoadout(player.equipmentLoadout));
  const categoryItems = items.filter(item => item.category === activeCategory);
  const totalPages = Math.max(1, Math.ceil(categoryItems.length / PAGE_SIZE));
  const currentPage = Math.min(totalPages, Math.max(1, pageByCategory[activeCategory] || 1));
  const visibleItems = pageItems(categoryItems, currentPage);
  const ActiveIcon = categoryIcon[activeCategory];

  const setCategoryPage = (category: InventoryCategory, page: number) => {
    const nextPage = Math.min(Math.max(1, page), Math.max(1, Math.ceil(items.filter(item => item.category === category).length / PAGE_SIZE)));
    setPageByCategory(prev => ({ ...prev, [category]: nextPage }));
  };

  const useItem = (item: InventoryDisplayItem) => {
    if (!item.usable) return;
    onOpenOverview?.();
    void onSubmitEvent?.({
      eventType: 'item_use',
      title: `使用物品：${item.name}`,
      playerIntent: `使用行囊物品「${item.name}」`,
      target: item.name,
      extraFacts: [
        `物品分类：${item.category}`,
        `物品说明：${item.detail}`,
        item.quantity ? `数量：${item.quantity}` : '数量：未登记',
      ],
    });
  };

  const discardItem = (item: InventoryDisplayItem) => {
    void onDiscardItem?.({
      id: item.id,
      name: item.name,
      category: item.category,
      equipmentId: item.equipmentId,
    });
  };

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="grid h-full gap-4 xl:grid-cols-[minmax(0,1.25fr)_22rem]">
        <section className="glass-panel rounded-xl p-5 md:p-6 min-h-[34rem] flex flex-col">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-fantasy-gold/20 pb-3">
            <div className="flex items-center gap-3">
              <ActiveIcon className="h-5 w-5 text-fantasy-gold/70" />
              <h2 className="font-serif text-xl text-fantasy-gold">行囊</h2>
            </div>
            <div className="text-xs text-gray-500">{items.length} 件记录</div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            {CATEGORIES.map(category => {
              const Icon = categoryIcon[category];
              const count = items.filter(item => item.category === category).length;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`rounded border px-3 py-2 text-left transition ${activeCategory === category ? 'border-fantasy-gold bg-fantasy-gold/15 text-fantasy-gold' : 'border-white/10 bg-black/20 text-gray-400 hover:border-fantasy-gold/50'}`}
                >
                  <div className="flex items-center gap-2 text-sm font-serif">
                    <Icon className="h-4 w-4" />
                    <span>{category}</span>
                  </div>
                  <div className="mt-1 text-[10px] text-gray-500">{count} 件</div>
                </button>
              );
            })}
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-400">
            <span>{activeCategory} / 第 {currentPage} 页，共 {totalPages} 页</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCategoryPage(activeCategory, currentPage - 1)}
                disabled={currentPage <= 1}
                className="btn-rpg bg-black px-2 py-1 text-xs disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setCategoryPage(activeCategory, currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="btn-rpg bg-black px-2 py-1 text-xs disabled:opacity-40"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {visibleItems.length === 0 ? (
            <div className="pixel-data-tile flex-1 p-5 text-sm text-gray-500">这一页暂无物品</div>
          ) : (
            <div className="grid flex-1 content-start gap-3 md:grid-cols-2">
              {visibleItems.map(item => (
                <div key={`${item.category}-${item.id}-${item.name}`} className={`pixel-data-tile p-3 ${item.equipped ? 'border-fantasy-gold text-gray-100' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-serif text-sm text-gray-100">{item.name}</div>
                      <div className="mt-1 text-[11px] text-gray-500">{item.meta || item.category}</div>
                    </div>
                    {item.equipped && <Sparkles className="h-4 w-4 shrink-0 text-fantasy-gold" />}
                  </div>
                  <div className="mt-2 min-h-12 text-xs leading-5 text-gray-400">{item.detail}</div>
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    {item.usable && (
                      <button
                        type="button"
                        onClick={() => useItem(item)}
                        className="btn-rpg border-fantasy-gold bg-fantasy-gold/15 px-3 py-1.5 text-xs text-fantasy-gold"
                      >
                        <Play className="h-3.5 w-3.5" />
                        使用
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => discardItem(item)}
                      className="btn-rpg border-red-900/70 bg-red-900/20 px-3 py-1.5 text-xs text-red-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      丢弃
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="glass-panel rounded-xl p-5 md:p-6">
          <div className="mb-5 flex items-center justify-between border-b border-fantasy-gold/20 pb-3">
            <h2 className="font-serif text-xl text-fantasy-gold">装备栏</h2>
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
