import { ClueRecord } from '../types';

export type CanonicalClueDefinition = {
  id: string;
  display: string;
  location: string;
  carrier: string;
  detail: string;
  aliases?: string[];
};

export type CanonicalCluePhase = {
  id: string;
  phase: string;
  eventName: string;
  eventDetail: string;
  aliases: string[];
  clues: CanonicalClueDefinition[];
};

export const eldredCanonicalCluePhases: CanonicalCluePhase[] = [
  {
    id: 'phase-1',
    phase: '风声汇账',
    eventName: '风声汇账事件',
    eventDetail: '七旗城的酒馆旧账、行会委托和议会日期互相咬合，确认第一条记录链不是普通欠款。',
    aliases: ['阶段一', '第一阶段', '风声阶段', 'phase-1'],
    clues: [
      {
        id: 'broken-sword-ledger-date',
        display: '折断的剑旧账本日期',
        location: '七旗城·折断的剑酒馆',
        carrier: '旧账本夹层',
        detail: '旧账本夹层短账纸上的日期与风铃行会异常委托表重合，证明酒馆风声与行会记录指向同一天。',
        aliases: ['折断的剑旧账本', '旧账本日期', '旧账本夹层', '短账纸日期'],
      },
      {
        id: 'windbell-abnormal-quest-list',
        display: '风铃行会异常委托表',
        location: '七旗城·风铃冒险者行会',
        carrier: '风险印章与改级栏',
        detail: '委托表的风险印章与改级栏存在同日改动，说明有人把低阶事项压成普通短工。',
        aliases: ['异常委托表', '风险印章', '改级栏', '风铃行会委托表'],
      },
      {
        id: 'seven-banners-meeting-blank-page',
        display: '七旗议会临时会议空页',
        location: '七旗城·七旗议会厅',
        carrier: '临时会议记录页角',
        detail: '会议空页的页角、停会铃时间和酒馆短账纸日期相互印证，补齐风声汇账的公共记录端。',
        aliases: ['七旗短账纸', '临时会议空页', '会议记录页角', '停会铃'],
      },
    ],
  },
  {
    id: 'phase-2',
    phase: '异象三地对照',
    eventName: '三地异象对照事件',
    eventDetail: '观星塔、灯塔和钟楼的三份异象记录对齐，确认辉光衰减不是单点事故。',
    aliases: ['阶段二', '第二阶段', '异象阶段', 'phase-2'],
    clues: [
      {
        id: 'stargazer-broken-spectrum',
        display: '观星塔断线光谱',
        location: '星砂学院邦·观星塔',
        carrier: '夜班星砂表',
        detail: '断线光谱记录到同一时间段的星辉缺口，是三地异象的学院观测端。',
        aliases: ['断线光谱', '观星塔星砂表', '星砂表'],
      },
      {
        id: 'blue-heron-dark-light-date',
        display: '蓝鹭灯塔暗光日期',
        location: '白帆群岛·蓝鹭灯塔',
        carrier: '航灯日志',
        detail: '蓝鹭灯塔暗光日期与观星塔断线光谱相同，说明海上航灯也受同一波辉光衰减影响。',
        aliases: ['灯塔暗光', '蓝鹭灯塔暗光', '航灯日志'],
      },
      {
        id: 'silent-bell-tower-broken-chime',
        display: '沉默钟楼断响簿',
        location: '浮空圣都亚雷亚·沉默钟楼',
        carrier: '断响簿与无编号钟签',
        detail: '断响簿记录到同日钟律缺拍，与观星和灯塔记录形成三地互证。',
        aliases: ['断响簿', '无编号钟签', '沉默钟楼断响'],
      },
    ],
  },
  {
    id: 'phase-3',
    phase: '断碑十八号',
    eventName: '断碑十八号事件',
    eventDetail: '灰雾边境的撤回线、断碑旧径和无名墓牌连成接缝线索，指向封印边缘的旧事故。',
    aliases: ['阶段三', '第三阶段', '接缝阶段', 'phase-3'],
    clues: [
      {
        id: 'gray-mist-retreat-stake',
        display: '灰雾撤回线木桩',
        location: '灰雾边境营地·撤回线',
        carrier: '撤回线木桩刻痕',
        detail: '木桩刻痕显示撤回线被临时改过一次，边境记录与禁忌地入口存在偏差。',
        aliases: ['撤回线木桩', '撤回线', '灰雾撤回线'],
      },
      {
        id: 'broken-stele-eighteen-old-path',
        display: '断碑十八号旧径',
        location: '禁忌之地外缘·断碑环',
        carrier: '断碑编号与旧径灰尘',
        detail: '断碑十八号旁的旧径残痕证明曾有人绕过正式撤回线进入封印接缝。',
        aliases: ['断碑十八号', '断碑旧径', '断碑环'],
      },
      {
        id: 'nameless-companion-old-emblem',
        display: '无名同行者墓牌旧徽',
        location: '灰雾边境·无名同行者墓地',
        carrier: '墓牌旧徽与墓册缺页',
        detail: '墓牌旧徽与墓册缺页对应到断碑十八号旧径，留下当年同行者的身份缺口。',
        aliases: ['无名墓牌旧徽', '无名同行者墓牌', '墓册缺页'],
      },
    ],
  },
  {
    id: 'phase-4',
    phase: '外环记录灵',
    eventName: '外环记录灵事件',
    eventDetail: '圣都外环记录灵的索引、断句和旧日程恢复，开始触及封印事故的魂侧记录。',
    aliases: ['阶段四', '第四阶段', '登空阶段', 'phase-4'],
    clues: [
      {
        id: 'aerea-old-schedule',
        display: '亚雷亚旧日程索引',
        location: '浮空圣都亚雷亚·记录灵小厅',
        carrier: '旧日程索引灯',
        detail: '旧日程索引显示灾夜前后有一段外环维护记录被挪到错误分类。',
        aliases: ['圣都旧日程', '旧日程索引', '亚雷亚旧日程'],
      },
      {
        id: 'outer-ring-record-spirit-fragment',
        display: '外环记录灵断句',
        location: '浮空圣都亚雷亚·外环记录灯',
        carrier: '记录灵断句',
        detail: '断句中保留了“魂侧偏移”和“深渊回声”的残片，是连接暗影龙真相的记录端。',
        aliases: ['记录灵断句', '外环记录灵', '断句复原'],
      },
      {
        id: 'soul-side-index-disorder',
        display: '魂侧记录失序索引',
        location: '浮空圣都亚雷亚·记录灵小厅',
        carrier: '失序索引链',
        detail: '失序索引证明记录被主动扰乱，且扰乱目标集中在魂侧而非躯侧。',
        aliases: ['魂侧记录', '失序索引', '魂侧碎片'],
      },
    ],
  },
  {
    id: 'phase-5',
    phase: '七旗日期会',
    eventName: '七旗日期会事件',
    eventDetail: '七旗城各端日期记录重新对齐，确认第一阶段风声不是孤证，而是全城记录被同一只手拨动。',
    aliases: ['阶段五', '第五阶段', '重稳阶段', 'phase-5'],
    clues: [
      {
        id: 'seven-banners-date-corner',
        display: '七旗日期表页角',
        location: '七旗城·七旗议会厅',
        carrier: '日期表页角',
        detail: '日期表页角留有两套折痕，说明会议记录被替换后又被匆忙复位。',
        aliases: ['七旗日期表', '日期表页角'],
      },
      {
        id: 'missing-three-minutes-bell',
        display: '停会铃缺三分钟',
        location: '七旗城·七旗议会厅',
        carrier: '停会铃簿',
        detail: '停会铃少了三分钟，与短账纸和委托改级栏形成精确时间缺口。',
        aliases: ['停会铃', '缺三分钟'],
      },
      {
        id: 'blue-ledger-ticket-pressmark',
        display: '蓝账城残票压痕',
        location: '岚之领·蓝账城地下账库',
        carrier: '蓝印残票',
        detail: '残票压痕对应七旗城短账纸的票据批次，说明账链跨出酒馆和行会。',
        aliases: ['蓝账城残票', '蓝印残票', '残票压痕'],
      },
    ],
  },
  {
    id: 'phase-6',
    phase: '勇者集结',
    eventName: '勇者集结事件',
    eventDetail: '五神器维护链被重新拼合，旧勇者故事从传说转回可以被验证的维护记录。',
    aliases: ['阶段六', '第六阶段', '勇者集结阶段', 'phase-6'],
    clues: [
      {
        id: 'dawn-shield-maintenance-page',
        display: '拂晓之盾维护页',
        location: '艾琳西亚·圣骑士团总部',
        carrier: '拂晓之盾旧誓页',
        detail: '维护页记录了拂晓之盾的最后一次公开校验，是五神器链的守护端。',
        aliases: ['拂晓之盾', '旧誓页', '维护页'],
      },
      {
        id: 'storm-key-rivet-record',
        display: '风暴之钥铆钉记录',
        location: '铜桥城·旧桥修缮处',
        carrier: '旧门铆钉记录',
        detail: '铆钉记录说明风暴之钥曾被当作桥门构件维护，神器并非只存在于王室叙事中。',
        aliases: ['风暴之钥', '铆钉记录', '风暴旧门'],
      },
      {
        id: 'star-cup-spectrum-check',
        display: '星灯之杯光谱校验',
        location: '星砂学院邦·观星塔',
        carrier: '星灯光谱校验表',
        detail: '星灯之杯的光谱校验与三地异象相互呼应，证明神器链正在响应辉光衰减。',
        aliases: ['星灯之杯', '光谱校验', '星灯'],
      },
    ],
  },
  {
    id: 'phase-7',
    phase: '灾厄之龙觉醒',
    eventName: '灾厄之龙觉醒事件',
    eventDetail: '龙脉灼伤、净化令空白编号和暗影龙碎片同时落定，灾厄之龙觉醒进入可见倒计时。',
    aliases: ['阶段七', '第七阶段', '灾厄之龙觉醒阶段', 'phase-7'],
    clues: [
      {
        id: 'dragon-vein-burn-chart',
        display: '龙脉灼伤图',
        location: '灰雾边境营地·病棚',
        carrier: '龙脉灼伤记录图',
        detail: '灼伤图显示症状不是普通瘴气侵染，而是龙脉回流留下的组织性灼痕。',
        aliases: ['龙脉灼伤', '灼伤分型', '龙脉灼伤记录'],
      },
      {
        id: 'blank-purification-order-number',
        display: '净化令空白编号',
        location: '艾琳西亚·晨曦大教堂',
        carrier: '净化令副本',
        detail: '空白编号说明净化派曾预留封存命令，用来提前截断病历与灾民记录。',
        aliases: ['净化令空白编号', '净化令', '监察蜡印'],
      },
      {
        id: 'shadow-dragon-soul-fragment',
        display: '暗影龙魂侧碎片',
        location: '浮空圣都亚雷亚·外环记录灯',
        carrier: '魂侧断句',
        detail: '魂侧碎片确认暗影龙并非完整复苏，而是通过封印缺口与记录失序逐步回声化。',
        aliases: ['暗影龙真相碎片', '魂侧碎片', '深渊回声'],
      },
    ],
  },
];

export const cluePhaseNames = eldredCanonicalCluePhases.map(phase => phase.phase);

const normalizeClueText = (value: unknown) =>
  String(value ?? '')
    .replace(/[【】「」《》\s:_：/｜|,，.。;；-]/g, '')
    .toLowerCase();

export const resolveCanonicalPhaseName = (value: unknown) => {
  const raw = String(value ?? '').trim();
  const normalized = normalizeClueText(raw);
  return eldredCanonicalCluePhases.find(phase =>
    normalizeClueText(phase.phase) === normalized
    || normalizeClueText(phase.id) === normalized
    || phase.aliases.some(alias => normalizeClueText(alias) === normalized || normalized.includes(normalizeClueText(alias)))
  )?.phase || raw || eldredCanonicalCluePhases[0].phase;
};

export const findCanonicalClueSlot = (phaseName: string, value: unknown) => {
  const phase = eldredCanonicalCluePhases.find(item => item.phase === resolveCanonicalPhaseName(phaseName));
  const normalized = normalizeClueText(value);
  if (!phase || !normalized) return null;
  const directSlot = String(value ?? '').match(/线索\s*([1-3一二三])/);
  if (directSlot) {
    const slotMap: Record<string, number> = { '1': 0, 一: 0, '2': 1, 二: 1, '3': 2, 三: 2 };
    const slot = slotMap[directSlot[1]];
    if (slot !== undefined) return { phase, slot, clue: phase.clues[slot] };
  }
  for (const [slot, clue] of phase.clues.entries()) {
    const candidates = [clue.id, clue.display, clue.carrier, clue.location, ...(clue.aliases || [])];
    if (candidates.some(candidate => {
      const normalizedCandidate = normalizeClueText(candidate);
      return normalizedCandidate && (normalized.includes(normalizedCandidate) || normalizedCandidate.includes(normalized));
    })) {
      return { phase, slot, clue };
    }
  }
  return null;
};

export const clueRecordFromCanonical = (
  clue: CanonicalClueDefinition,
  slot: number,
  override?: Partial<ClueRecord>,
): ClueRecord => ({
  id: clue.id,
  label: `线索${slot + 1}`,
  status: '未解锁',
  display: clue.display,
  location: clue.location,
  carrier: clue.carrier,
  detail: clue.detail,
  ...override,
});
