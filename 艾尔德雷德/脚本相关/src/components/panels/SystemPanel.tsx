import { Activity, Database, MapPin, Radio, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { PlayerState } from '../../types';
import { EldredRuntimeSave } from '../../game/eldredSave';
import { formatEldredLocation } from '../../game/locationFormat';

type AnyRecord = Record<string, any>;

type VariableRow = {
  label: string;
  path: string;
  panel: string;
  active: boolean;
  value: string;
};

const sourceLabel: Record<EldredRuntimeSave['source'], string> = {
  mvu: 'MVU',
  cache: '缓存',
  empty: '空档',
};

const getPath = (source: unknown, path: string) => {
  const keys = path.split('.');
  let current: any = source;
  for (const key of keys) {
    if (!current || typeof current !== 'object') return undefined;
    current = current[key];
  }
  return current;
};

const countValue = (value: unknown) => {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') return Object.keys(value as AnyRecord).length;
  return String(value ?? '').trim() ? 1 : 0;
};

const previewValue = (value: unknown) => {
  if (Array.isArray(value)) return value.length ? value.join('、').slice(0, 36) : '空';
  if (value && typeof value === 'object') {
    const keys = Object.keys(value as AnyRecord);
    return keys.length ? `${keys.length}项：${keys.slice(0, 3).join('、')}` : '空';
  }
  const text = String(value ?? '').trim();
  return text ? text.slice(0, 36) : '空';
};

const variableRows = (runtime: EldredRuntimeSave): VariableRow[] => {
  const raw = runtime.rawStatData || {};
  const rows = [
    ['世界时间', '世界.当前时间', '概览/运行档案'],
    ['大地标', '世界.大区域', '概览/地图/战斗'],
    ['子区域', '世界.子区域', '概览/地图'],
    ['小地标', '世界.具体地标', '概览/地图/战斗'],
    ['天气', '世界.当前天气', '概览'],
    ['风险', '世界.风险等级', '运行档案'],
    ['旅行', '世界.旅行状态', '运行档案'],
    ['在场角色', '世界.在场角色', '运行档案/NPC'],
    ['身份', '主角.身份', '队伍/运行档案'],
    ['战斗面板', '主角.战斗', '队伍/战斗'],
    ['五维', '主角.战斗.五维', '队伍/战斗'],
    ['旧五维', '主角.属性', '队伍/战斗'],
    ['装备栏', '主角.战斗.装备栏', '队伍/行囊'],
    ['旧装备位', '主角.战斗.装备位', '队伍/行囊'],
    ['激活技能', '主角.战斗.激活技能', '队伍/战斗'],
    ['技能库', '主角.战斗.已知技能', '队伍'],
    ['背包', '主角.背包', '行囊'],
    ['当前队伍', '主角.当前队伍', '队伍/战斗'],
    ['主要NPC', '主角.角色收集.主要NPC', 'NPC/队伍'],
    ['其他NPC', '主角.角色收集.其他NPC', 'NPC/队伍'],
    ['任务列表', '主角.任务列表', '委托'],
    ['阶段钥匙册', '主线.阶段钥匙册', '线索'],
    ['线索矩阵', '主线.线索矩阵', '线索'],
    ['最近线索', '主线.最近线索', '线索'],
    ['好感', '关系.好感', 'NPC/队伍'],
    ['地区声望', '关系.地区声望', '队伍'],
    ['战斗缓存', '系统.战斗缓存', '战斗'],
    ['前端提示', '系统.前端提示', '概览'],
    ['事件记录', '系统.事件记录', '概览'],
  ] as const;

  return rows.map(([label, path, panel]) => {
    const value = getPath(raw, path);
    return {
      label,
      path,
      panel,
      active: countValue(value) > 0,
      value: previewValue(value),
    };
  });
};

export function SystemPanel({ runtime, player }: { runtime: EldredRuntimeSave; player: PlayerState }) {
  const locationDisplay = formatEldredLocation(runtime.world, player.location);
  const rows = useMemo(() => variableRows(runtime), [runtime]);
  const activeRows = rows.filter(row => row.active).length;
  const combatLogCount = runtime.combat.logs.length;
  const presentCharacters = runtime.world.presentCharacters.length ? runtime.world.presentCharacters.join('、') : '未登记';

  return (
    <div className="h-full w-full overflow-y-auto p-2 md:p-0">
      <div className="mx-auto grid max-w-5xl gap-5 xl:grid-cols-[18rem_1fr]">
        <div className="pixel-vertical-card w-full min-h-[22rem]">
          <div className="pixel-card-crown" />
          <div className="pixel-card-body">
            <div className="pixel-token-icon">
              <Database className="h-4 w-4" />
            </div>
            <div className="text-center">
              <div className="font-serif text-lg tracking-wider text-fantasy-gold">运行档案</div>
              <div className="mt-3 text-xs leading-6 text-amber-50/80">
                {sourceLabel[runtime.source]} / {activeRows}/{rows.length}
                <br />
                {new Date(runtime.updatedAt).toLocaleString()}
              </div>
            </div>
          </div>
          <div className="pixel-card-gems" aria-hidden="true"><span /><span /><span /></div>
        </div>

        <div className="grid gap-5">
          <section className="glass-panel rounded-lg border-fantasy-gold/40 p-5 md:p-6">
            <div className="mb-5 border-b border-fantasy-gold/20 pb-4">
              <h2 className="font-serif text-xl text-fantasy-gold">局内状态</h2>
              <div className="mt-1 text-xs text-gray-400">{locationDisplay.fullName}</div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <StatusBlock icon={<MapPin className="h-4 w-4" />} label="位置" value={locationDisplay.fullName} />
              <StatusBlock icon={<Activity className="h-4 w-4" />} label="战斗记录" value={`${combatLogCount}条`} />
              <StatusBlock icon={<Users className="h-4 w-4" />} label="收录角色" value={`${runtime.npcs.length}人`} />
              <StatusBlock icon={<Radio className="h-4 w-4" />} label="在场角色" value={presentCharacters} />
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
            <div className="glass-panel rounded-lg p-5 md:p-6">
              <h3 className="mb-4 border-b border-fantasy-gold/20 pb-3 font-serif text-lg text-fantasy-gold">角色核心</h3>
              <div className="grid gap-3 text-sm">
                <InfoLine label="姓名" value={player.name} />
                <InfoLine label="等级" value={`${player.level} / ${player.experience}/${player.nextLevelExperience}`} />
                <InfoLine label="生命" value={`${player.stats.hp}/${player.stats.maxHp}`} />
                <InfoLine label="法力" value={`${player.stats.mp}/${player.stats.maxMp}`} />
                <InfoLine label="护甲" value={`${player.stats.ac}`} />
                <InfoLine label="可分配点" value={`${player.availableAttributePoints}`} />
                <InfoLine label="队伍人数" value={`${1 + player.partyMemberIds.length}/4`} />
                <InfoLine label="委托" value={`${runtime.quests.length}项`} />
              </div>
            </div>

            <div className="glass-panel rounded-lg p-5 md:p-6">
              <h3 className="mb-4 border-b border-fantasy-gold/20 pb-3 font-serif text-lg text-fantasy-gold">变量覆盖</h3>
              <div className="grid max-h-[28rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {rows.map(row => (
                  <div key={row.path} className={`pixel-data-tile p-3 ${row.active ? 'text-gray-100' : 'text-gray-500'}`}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="font-serif text-sm">{row.label}</span>
                      <span className={`pixel-status-dot ${row.active ? 'bg-green-400' : 'bg-gray-600'}`} />
                    </div>
                    <div className="text-[11px] text-fantasy-gold/70">{row.panel}</div>
                    <div className="mt-1 truncate text-[11px] text-gray-500">{row.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatusBlock({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="pixel-data-tile p-3">
      <div className="mb-2 flex items-center gap-2 text-xs text-fantasy-gold">
        {icon}
        <span>{label}</span>
      </div>
      <div className="truncate font-serif text-sm text-gray-100">{value}</div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-2">
      <span className="text-gray-500">{label}</span>
      <span className="font-mono text-gray-200">{value}</span>
    </div>
  );
}
