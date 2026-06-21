import worldMapImage from '../assets/maps/eldred-world-map.png';
import sevenBannersImage from '../assets/maps/region-seven-banners.png';
import whiteCrownImage from '../assets/maps/region-white-crown.png';
import grayMistImage from '../assets/maps/region-gray-mist-camp.png';
import starSandImage from '../assets/maps/region-star-sand-academy.png';
import whiteSailImage from '../assets/maps/region-white-sail-harbor.png';
import arareyaImage from '../assets/maps/region-arareya.png';
import grayForgeImage from '../assets/maps/region-gray-forge.png';
import blackPineImage from '../assets/maps/region-black-pine.png';
import littleBellImage from '../assets/maps/region-little-bell.png';
import silverLeafImage from '../assets/maps/region-silver-leaf-gate.png';
import tidebornImage from '../assets/maps/region-tideborn-coral.png';
import copperShellImage from '../assets/maps/region-copper-shell.png';
import frostFangImage from '../assets/maps/region-frost-fang.png';
import dragonScaleImage from '../assets/maps/region-dragon-scale-tower.png';

export type LandmarkPoint = {
  name: string;
  desc: string;
  x: number;
  y: number;
};

export type RegionMap = {
  id: string;
  name: string;
  area: string;
  summary: string;
  image: string;
  x: number;
  y: number;
  risk: '安全' | '轻险' | '中险' | '高险';
  services: string[];
  mainClues: string[];
  landmarks: LandmarkPoint[];
};

export { worldMapImage };

export const regions: RegionMap[] = [
  {
    id: 'gray-forge',
    name: '灰炉诸城',
    area: '西北炉山',
    summary: '矿轨、工票、炉壁档案、封印矿石和锻造工坊集中地。',
    image: grayForgeImage,
    x: 15,
    y: 18,
    risk: '中险',
    services: ['武备校验', '矿轨通行', '工票担保', '炉壁拓印'],
    mainClues: ['灰炉维修训话抄页', '炉心裂石口', '封印矿石'],
    landmarks: [
      { name: '炉壁档案厅', desc: '维修记录、旧铭文、炉脉回火。', x: 78, y: 15 },
      { name: '矿轨总站', desc: '矿车、工票、晚点记录。', x: 22, y: 17 },
      { name: '锻造工坊街', desc: '武备校验、炉火委托。', x: 78, y: 53 },
      { name: '封印矿石仓', desc: '裂纹判断、矿石登记。', x: 25, y: 40 },
    ],
  },
  {
    id: 'black-pine',
    name: '黑松边寨',
    area: '北境边线',
    summary: '雪路、热汤券、哨塔预警和边境储粮节点。',
    image: blackPineImage,
    x: 36,
    y: 11,
    risk: '轻险',
    services: ['热汤棚', '哨塔预警', '雪路通行', '边寨补给'],
    mainClues: ['井水苦汤', '储粮记录', '北境消息'],
    landmarks: [
      { name: '边寨哨塔', desc: '预警旗、雪路封闭。', x: 50, y: 18 },
      { name: '热汤饭棚', desc: '井水苦汤、热汤券。', x: 62, y: 62 },
      { name: '储粮棚', desc: '储粮变动、边寨账。', x: 26, y: 47 },
      { name: '巡逻营帐', desc: '巡逻路线、雪靴记录。', x: 78, y: 38 },
    ],
  },
  {
    id: 'frost-fang',
    name: '霜牙猎寨',
    area: '霜冠雪路',
    summary: '猎路、兽群记录、角羊栏和旧雪地战吼训练场。',
    image: frostFangImage,
    x: 44,
    y: 18,
    risk: '中险',
    services: ['雪路向导', '猎具校准', '兽群辨识', '防寒补给'],
    mainClues: ['旧小国徽章', '角羊栏记录', '雪地脚印'],
    landmarks: [
      { name: '角羊栏', desc: '驮兽、蹄印、饲料账。', x: 69, y: 20 },
      { name: '猎路木牌', desc: '猎路分岔、雪崩痕。', x: 36, y: 72 },
      { name: '霜牙火塘', desc: '边寨消息、旧战吼。', x: 61, y: 50 },
      { name: '雪靴修补棚', desc: '防寒与撤离。', x: 80, y: 55 },
    ],
  },
  {
    id: 'arareya',
    name: '浮空圣都亚雷亚',
    area: '圣铃修道领上空',
    summary: '高空圣城，光辉封印、水道、记录灵和沉默钟楼所在地。',
    image: arareyaImage,
    x: 61,
    y: 9,
    risk: '中险',
    services: ['巡礼登记', '监察补章', '记录灵问讯', '水道检修'],
    mainClues: ['沉默钟楼断响', '外环记录灵断句', '水道升温'],
    landmarks: [
      { name: '星环广场', desc: '巡礼、商贩登记、公开钟表。', x: 50, y: 40 },
      { name: '祈星水道', desc: '水道热流、检修段。', x: 51, y: 60 },
      { name: '白鸽廊桥', desc: '拂晓之盾纹路线。', x: 24, y: 51 },
      { name: '沉默钟楼', desc: '钟签、断响翎。', x: 13, y: 39 },
      { name: '记录灵小厅', desc: '旧称呼、旁侧记录。', x: 78, y: 49 },
    ],
  },
  {
    id: 'moon-deer',
    name: '月鹿森林',
    area: '东北古林',
    summary: '森林边界、鹿径、精灵通行规矩与龙脉回声。',
    image: silverLeafImage,
    x: 79,
    y: 20,
    risk: '轻险',
    services: ['边界登记', '森林向导', '鹿径通行', '药草问询'],
    mainClues: ['月鹿避路', '鹿角风铃根', '银苔浅滩消息'],
    landmarks: [
      { name: '银叶边界门', desc: '边界许可、通行问询。', x: 50, y: 34 },
      { name: '鹿径', desc: '兽群辨识、月鹿避路。', x: 14, y: 29 },
      { name: '登记桌', desc: '来访登记、携带物核对。', x: 24, y: 68 },
      { name: '月光哨台', desc: '森林动向、边界预警。', x: 76, y: 31 },
    ],
  },
  {
    id: 'white-crown',
    name: '白冠王都',
    area: '神圣王国艾琳西亚',
    summary: '王权、圣骑士团、教会病房与王立档案馆集中地。',
    image: whiteCrownImage,
    x: 66,
    y: 45,
    risk: '安全',
    services: ['文书许可', '治疗', '骑士担保', '档案查阅'],
    mainClues: ['旧地图', '王令副本', '边境报告', '净化令编号'],
    landmarks: [
      { name: '白冠西门', desc: '入城名册、泥脚印板、通行火漆。', x: 9, y: 25 },
      { name: '圣骑士团总部', desc: '骑士报告、护送令、巡防表。', x: 61, y: 50 },
      { name: '晨曦大教堂', desc: '病房、救济、圣铃时钟。', x: 79, y: 27 },
      { name: '王立档案馆', desc: '王令副本、旧地图、档案查阅。', x: 39, y: 30 },
      { name: '黎明城墙', desc: '外层防线，通往七旗城和灰雾边境。', x: 17, y: 84 },
      { name: '白石下城区', desc: '短工、旧书摊、临时床位。', x: 39, y: 75 },
    ],
  },
  {
    id: 'gray-mist',
    name: '灰雾边境营地',
    area: '禁忌之地外圈',
    summary: '撤回与救治营地，连接灰雾边缘、断碑环和旧封印外围。',
    image: grayMistImage,
    x: 43,
    y: 49,
    risk: '中险',
    services: ['防瘴药', '向导', '采药登记', '返程绳', '医治'],
    mainClues: ['断碑拓片', '灾民徽章', '撤回旗灰纹', '龙脉灼伤记录'],
    landmarks: [
      { name: '营火路口', desc: '队伍集合、补给分发、路线问询。', x: 45, y: 55 },
      { name: '撤回线木桩', desc: '深浅撤回旗、返程路线。', x: 78, y: 51 },
      { name: '边境病棚', desc: '瘴气病册、龙脉灼伤图。', x: 66, y: 46 },
      { name: '深浅观察坡', desc: '雾灯偏紫、灾厄龙骨远影。', x: 73, y: 15 },
      { name: '避誓塔方向绳桩', desc: '通往龙鳞避誓塔的撤回绳与路牌。', x: 57, y: 14 },
      { name: '断碑环外场', desc: '旧封印地外围。', x: 79, y: 77 },
    ],
  },
  {
    id: 'dragon-scale',
    name: '龙鳞避誓塔',
    area: '灰雾深浅交界',
    summary: '旧誓约、龙裂纹、避誓碑和封印维护页所在。',
    image: dragonScaleImage,
    x: 46,
    y: 27,
    risk: '高险',
    services: ['撤回绳登记', '碑文拓印', '防瘴校验', '誓约复核'],
    mainClues: ['旧封印维护页', '龙鳞热斑井', '避誓碑裂纹'],
    landmarks: [
      { name: '避誓碑阶', desc: '誓约残句、裂纹计数。', x: 56, y: 64 },
      { name: '龙鳞热斑井', desc: '灼热井壁、灰雾回声。', x: 80, y: 75 },
      { name: '撤回绳桩', desc: '撤离路线、队伍登记。', x: 18, y: 78 },
      { name: '塔顶残铃', desc: '钟声断点、主线载体。', x: 56, y: 16 },
    ],
  },
  {
    id: 'seven-banners',
    name: '七旗城',
    area: '岚之领七城邦',
    summary: '七城邦议事中枢，行会、短账和商路风声聚集。',
    image: sevenBannersImage,
    x: 31,
    y: 49,
    risk: '轻险',
    services: ['酒馆', '行会登记', '武备铺', '马车', '短工'],
    mainClues: ['折断的剑旧账本日期', '行会异常委托表', '七旗短账纸'],
    landmarks: [
      { name: '七旗议会厅', desc: '会议记录、日程表、临时会议侧厅。', x: 50, y: 41 },
      { name: '风铃行会街', desc: '委托看板、风险印章、结算小窗。', x: 78, y: 66 },
      { name: '折断的剑酒馆', desc: '旧账本夹层、欠款墙、地窖半堵门。', x: 74, y: 40 },
      { name: '夜茶小廊', desc: '议员跑腿、后半夜消息。', x: 84, y: 64 },
      { name: '小铃市集', desc: '南门外半身人集市。', x: 58, y: 86 },
      { name: '城门马房', desc: '马车、过桥费、出城路线。', x: 80, y: 16 },
    ],
  },
  {
    id: 'little-bell',
    name: '小铃市集',
    area: '七旗城南门外',
    summary: '半身人铃扣摊、短工票据和白帆商路入口。',
    image: littleBellImage,
    x: 28,
    y: 64,
    risk: '安全',
    services: ['补给', '铃扣登记', '短工介绍', '商队问路'],
    mainClues: ['铃扣欠条', '白帆商队排班', '南门小路'],
    landmarks: [
      { name: '铃扣摊', desc: '小额交易、铃扣凭证。', x: 48, y: 44 },
      { name: '南门茶棚', desc: '商队闲谈、短工消息。', x: 72, y: 65 },
      { name: '旧桥货格', desc: '货物核对、路费争执。', x: 39, y: 82 },
      { name: '半身人账桌', desc: '零钱、欠条、担保。', x: 78, y: 56 },
    ],
  },
  {
    id: 'white-sail',
    name: '白帆港',
    area: '白帆群岛',
    summary: '群岛正式港口，船票、港税、夜航与灯塔线索聚集。',
    image: whiteSailImage,
    x: 19,
    y: 63,
    risk: '轻险',
    services: ['船票', '港税登记', '修船', '渔市补给'],
    mainClues: ['船票重号', '星灯铜环', '灯油路线'],
    landmarks: [
      { name: '船票窗口', desc: '改签、船名、截线。', x: 18, y: 29 },
      { name: '海关桌', desc: '货物登记、港税编号。', x: 53, y: 16 },
      { name: '渔市棚', desc: '鱼骨旧环、港口传闻。', x: 24, y: 66 },
      { name: '海事布告板', desc: '海事急单、夜航缺口。', x: 37, y: 42 },
      { name: '蓝鹭灯塔', desc: '暗光日志、潮汐台阶、守灯小屋。', x: 86, y: 17 },
      { name: '断桅自由港', desc: '私船港、旧海图和偏门消息。', x: 78, y: 77 },
    ],
  },
  {
    id: 'tideborn-coral',
    name: '潮裂珊瑚埠',
    area: '白帆群岛外礁',
    summary: '潮门、礁桥、潮裔登记和沉船圣坛入口。',
    image: tidebornImage,
    x: 14,
    y: 43,
    risk: '中险',
    services: ['潮汐登记', '水路向导', '潜水补给', '礁桥通行'],
    mainClues: ['潮门开合表', '沉船圣坛残页', '潮裔口信'],
    landmarks: [
      { name: '潮门水阶', desc: '退潮入口、礁桥开合。', x: 50, y: 46 },
      { name: '珊瑚埠台', desc: '潮裔登记、水路货单。', x: 50, y: 15 },
      { name: '沉船圣坛', desc: '海难遗物、星灯旧光。', x: 79, y: 75 },
      { name: '盐雾绳桥', desc: '潮湿绳索、撤离路线。', x: 27, y: 59 },
    ],
  },
  {
    id: 'star-sand',
    name: '星砂学院邦',
    area: '东南学术小邦',
    summary: '学院、图书馆城、自治街和召唤试验场组成的学术小邦。',
    image: starSandImage,
    x: 74,
    y: 70,
    risk: '安全',
    services: ['课程旁听', '观测排班', '图书借阅', '召唤试验登记'],
    mainClues: ['观星塔断线光谱', '三地对照图', '空名契约'],
    landmarks: [
      { name: '星砂学院', desc: '主讲堂、公式回廊、考试草坪。', x: 51, y: 25 },
      { name: '观星塔', desc: '夜班观测册、断线光谱。', x: 14, y: 26 },
      { name: '图书馆城', desc: '寻书公告墙、百年逾期。', x: 85, y: 45 },
      { name: '学生自治街', desc: '二手法杖、热汤车、社团板。', x: 49, y: 78 },
      { name: '召唤试验场', desc: '契约桌、清理棚、赔偿板。', x: 16, y: 67 },
      { name: '铜壳机关街', desc: '侏儒工坊街、工单墙。', x: 74, y: 76 },
    ],
  },
  {
    id: 'copper-shell',
    name: '铜壳机关街',
    area: '星砂学院邦工坊区',
    summary: '侏儒工坊、校准钟井、锁机试验和魔导器维修地。',
    image: copperShellImage,
    x: 68,
    y: 61,
    risk: '轻险',
    services: ['机关维修', '校准', '零件采购', '锁机测试'],
    mainClues: ['铜壳工单', '校准钟井偏差', '锁机停摆记录'],
    landmarks: [
      { name: '校准钟井', desc: '时间偏差、工坊班表。', x: 49, y: 50 },
      { name: '侏儒工坊街', desc: '零件、护目镜、维修单。', x: 80, y: 55 },
      { name: '锁机试验台', desc: '构装体暂停、事故记录。', x: 51, y: 70 },
      { name: '铜壳仓', desc: '矿轨零件、灯塔铜屑。', x: 82, y: 81 },
    ],
  },
];

export const getRegionById = (regionId: string) =>
  regions.find(region => region.id === regionId) || regions[0];
