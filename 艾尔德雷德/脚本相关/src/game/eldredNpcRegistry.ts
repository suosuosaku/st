import type { Character, Skill } from '../types';

export const eldredFixedNpcNames = [
  "绯欧菈",
  "玛洛",
  "艾米",
  "妮娅",
  "帕琪",
  "玛蒂",
  "蕾文",
  "贝琳",
  "布兰妲",
  "托兰娜",
  "萨菈",
  "奥薇",
  "茜尔七号",
  "莱恩",
  "约娜",
  "贝尔娜",
  "托比",
  "莉亚",
  "维芙",
  "露西",
  "露",
  "葛蕾娜",
  "诺拉",
  "伊薇",
  "巴丝",
  "埃利安",
  "梅莉莎",
  "罗薇",
  "佩拉",
  "小原"
] as const;

export const eldredFixedNpcRegistry: Character[] = [
  {
    "id": "npc-fiora",
    "name": "绯欧菈",
    "fullName": "绯欧菈·冯·艾登海姆",
    "type": "NPC登记",
    "race": "人类",
    "raceId": "human",
    "gender": "女",
    "age": "21岁",
    "affiliation": "圣骑士团总部、黎明城墙、艾登海姆旧庭",
    "identity": "艾琳西亚圣骑士团团长，艾登海姆公爵家次女",
    "classId": "paladin",
    "profession": "艾琳西亚圣骑士团团长",
    "avatarUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E7%BB%AF%E6%AC%A7%E8%8F%88%E5%A4%B4%E5%83%8F.png",
    "portraitUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E7%BB%AF%E6%AC%A7%E8%8F%88%E7%AB%8B%E7%BB%98.png",
    "stats": {
      "hp": 82,
      "maxHp": 82,
      "mp": 26,
      "maxMp": 26,
      "ac": 19,
      "str": 17,
      "dex": 5,
      "vit": 11,
      "int": 3,
      "spr": 9,
      "level": 16,
      "proficiency": 4,
      "initiative": 1
    },
    "experience": 0,
    "nextLevelExperience": 1600,
    "availableAttributePoints": 0,
    "favorability": 0,
    "relationshipStage": "陌生",
    "equipmentIds": [],
    "equipmentLoadout": {},
    "activeSkillIds": [
      "npc-fiora-skill-1",
      "npc-fiora-skill-2"
    ],
    "knownSkillIds": [
      "npc-fiora-skill-1",
      "npc-fiora-skill-2"
    ],
    "attributes": [
      "牵系：黎明城墙救援碑、拂晓之盾旧誓、圣骑士团巡防表、艾登海姆旧庭花圃",
      "剧情：拂晓之盾旧誓页、黎明城墙救援碑、艾登海姆旧庭残页"
    ],
    "skills": [
      {
        "id": "npc-fiora-skill-1",
        "name": "守护誓言",
        "rank": "S4",
        "sourceClasses": [
          "paladin"
        ],
        "source": "世界书固定NPC条目",
        "actionType": "support",
        "attribute": "int",
        "hitType": "auto",
        "target": "友方或保护对象",
        "range": "近身",
        "mpCost": 8,
        "cooldown": 0,
        "effects": [
          "守护誓言 / S4 / 消耗8法力 / 友方获得+2护甲至下回合"
        ],
        "desc": "守护誓言 / S4 / 消耗8法力 / 友方获得+2护甲至下回合"
      },
      {
        "id": "npc-fiora-skill-2",
        "name": "拂晓壁垒",
        "rank": "S4",
        "sourceClasses": [
          "paladin"
        ],
        "source": "世界书固定NPC条目",
        "actionType": "utility",
        "attribute": "spr",
        "hitType": "vsDC",
        "target": "目标单位或证据载体",
        "range": "近身",
        "mpCost": 0,
        "cooldown": 0,
        "dc": 15,
        "effects": [
          "拂晓壁垒 / S4 / 目标值15精神 / 压制恐惧与污染"
        ],
        "desc": "拂晓壁垒 / S4 / 目标值15精神 / 压制恐惧与污染"
      }
    ]
  },
  {
    "id": "npc-marlo",
    "name": "玛洛",
    "fullName": "玛洛",
    "type": "NPC登记",
    "race": "半身人",
    "raceId": "halfling",
    "gender": "女",
    "age": "29岁",
    "affiliation": "折断的剑酒馆柜台、后厨门口、地窖半堵门、欠款墙旁",
    "identity": "折断的剑酒馆老板，旧账本保管人，七旗城桌边风声的年轻女掌柜",
    "classId": "paladin",
    "profession": "折断的剑酒馆老板",
    "avatarUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E7%8E%9B%E6%B4%9B%E5%A4%B4%E5%83%8F.png",
    "portraitUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E7%8E%9B%E6%B4%9B%E7%AB%8B%E7%BB%98.png",
    "stats": {
      "hp": 34,
      "maxHp": 34,
      "mp": 0,
      "maxMp": 0,
      "ac": 13,
      "str": 2,
      "dex": 10,
      "vit": 5,
      "int": 8,
      "spr": 4,
      "level": 8,
      "proficiency": 2,
      "initiative": 2
    },
    "experience": 0,
    "nextLevelExperience": 800,
    "availableAttributePoints": 0,
    "favorability": 0,
    "relationshipStage": "陌生",
    "equipmentIds": [],
    "equipmentLoadout": {},
    "activeSkillIds": [
      "npc-marlo-skill-1"
    ],
    "knownSkillIds": [
      "npc-marlo-skill-1"
    ],
    "attributes": [
      "牵系：旧账本夹层、欠款墙、七旗议会夜茶、蓝账城残票",
      "能力：豁免敏捷/精神; 技能S3账册/S2洞察/S2交涉/S1短兵; 攻击杯底短刀 +6 vs 护甲, 1d6+2穿刺; 木杯投掷 +5 vs 护甲, 1d4+2钝击; 技能模板旧账压桌 / S3 / 无消耗 / 目标值13精神，迫使撒谎者露出时间矛盾; 特性折断的剑酒馆情报网; 旧账本夹层保存权; 七旗城桌边风声过滤",
      "剧情：线索折断的剑旧账本日期、欠款墙旧姓氏、蓝账城残票压痕; 主线锁未证明来客不会毁掉酒馆与旧账本时，只给风声不交夹层"
    ],
    "skills": [
      {
        "id": "npc-marlo-skill-1",
        "name": "旧账压桌",
        "rank": "S3",
        "sourceClasses": [
          "paladin"
        ],
        "source": "世界书固定NPC条目",
        "actionType": "utility",
        "attribute": "spr",
        "hitType": "vsDC",
        "target": "目标单位或证据载体",
        "range": "近身",
        "mpCost": 0,
        "cooldown": 0,
        "dc": 13,
        "effects": [
          "旧账压桌 / S3 / 无消耗 / 目标值13精神，迫使撒谎者露出时间矛盾"
        ],
        "desc": "旧账压桌 / S3 / 无消耗 / 目标值13精神，迫使撒谎者露出时间矛盾"
      }
    ]
  },
  {
    "id": "npc-amy",
    "name": "艾米",
    "fullName": "艾米",
    "type": "NPC登记",
    "race": "妖精混血",
    "raceId": "human",
    "gender": "女",
    "age": "19岁",
    "affiliation": "酒馆大厅、后厨窗口、二楼客房走廊",
    "identity": "折断的剑酒馆跑堂，桌边消息耳朵",
    "classId": "ranger",
    "profession": "折断的剑酒馆跑堂",
    "avatarUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E8%89%BE%E7%B1%B3%E5%A4%B4%E5%83%8F.png",
    "portraitUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E8%89%BE%E7%B1%B3%E7%AB%8B%E7%BB%98.png",
    "stats": {
      "hp": 18,
      "maxHp": 18,
      "mp": 0,
      "maxMp": 0,
      "ac": 11,
      "str": 1,
      "dex": 12,
      "vit": 3,
      "int": 3,
      "spr": 2,
      "level": 4,
      "proficiency": 1,
      "initiative": 3
    },
    "experience": 0,
    "nextLevelExperience": 400,
    "availableAttributePoints": 0,
    "favorability": 0,
    "relationshipStage": "陌生",
    "equipmentIds": [],
    "equipmentLoadout": {},
    "activeSkillIds": [
      "npc-amy-skill-1"
    ],
    "knownSkillIds": [
      "npc-amy-skill-1"
    ],
    "attributes": [
      "牵系：托盘底小纸条、地窖老门、客房走廊半截话、风铃行会新委托标题",
      "能力：豁免敏捷; 技能S1奔跑/S1听墙角/S1端盘; 攻击托盘拍击 +4 vs 护甲, 1d4+3钝击; 热汤泼洒 目标值11敏捷, 目标短暂分心; 技能模板桌缝耳朵 / S1 / 无消耗 / 目标值10精神，回忆客人半句话或座位顺序; 特性熟悉折断的剑客流; 能记住杯垫、脚步和客房门响",
      "剧情：线索托盘底小纸条、客房走廊半截话、地窖老门响声; 主线锁面对威胁或高压审问会退缩，只能在安全环境下慢慢回忆"
    ],
    "skills": [
      {
        "id": "npc-amy-skill-1",
        "name": "桌缝耳朵",
        "rank": "S1",
        "sourceClasses": [
          "ranger"
        ],
        "source": "世界书固定NPC条目",
        "actionType": "utility",
        "attribute": "spr",
        "hitType": "vsDC",
        "target": "目标单位或证据载体",
        "range": "近身",
        "mpCost": 0,
        "cooldown": 0,
        "dc": 10,
        "effects": [
          "桌缝耳朵 / S1 / 无消耗 / 目标值10精神，回忆客人半句话或座位顺序"
        ],
        "desc": "桌缝耳朵 / S1 / 无消耗 / 目标值10精神，回忆客人半句话或座位顺序"
      }
    ]
  },
  {
    "id": "npc-nia",
    "name": "妮娅",
    "fullName": "妮娅",
    "type": "NPC登记",
    "race": "人类",
    "raceId": "human",
    "gender": "女",
    "age": "24岁",
    "affiliation": "接待柜台、公告板前、结算小窗",
    "identity": "风铃冒险者行会接待员，委托分级与结算负责人",
    "classId": "ranger",
    "profession": "风铃冒险者行会接待员",
    "avatarUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E5%A6%AE%E5%A8%85%E5%A4%B4%E5%83%8F.png",
    "portraitUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E5%A6%AE%E5%A8%85%E7%AB%8B%E7%BB%98.png",
    "stats": {
      "hp": 28,
      "maxHp": 28,
      "mp": 12,
      "maxMp": 12,
      "ac": 11,
      "str": 1,
      "dex": 4,
      "vit": 3,
      "int": 15,
      "spr": 6,
      "level": 8,
      "proficiency": 2,
      "initiative": 1
    },
    "experience": 0,
    "nextLevelExperience": 800,
    "availableAttributePoints": 0,
    "favorability": 0,
    "relationshipStage": "陌生",
    "equipmentIds": [],
    "equipmentLoadout": {},
    "activeSkillIds": [
      "npc-nia-skill-1"
    ],
    "knownSkillIds": [
      "npc-nia-skill-1"
    ],
    "attributes": [
      "牵系：风险印章、新手登记册、改级栏、折断的剑酒馆风声",
      "能力：豁免智力/精神; 技能S3委托分级/S2文书/S2风险评估/S1交涉; 攻击行会短杖 +4 vs 护甲, 1d6+1钝击; 印章警告 目标值13精神, 目标暂停粗暴行为; 技能模板委托复核 / S3 / 消耗3法力 / 目标值13智力，找出委托等级和报酬异常; 特性行会公告板维护权; 委托风险印章调阅; 结算担保登记",
      "剧情：线索异常委托表、风险印章缺口、折断的剑酒馆风声对照; 主线锁未有行会牌或担保人时，不开放内部委托底页"
    ],
    "skills": [
      {
        "id": "npc-nia-skill-1",
        "name": "委托复核",
        "rank": "S3",
        "sourceClasses": [
          "ranger"
        ],
        "source": "世界书固定NPC条目",
        "actionType": "utility",
        "attribute": "int",
        "hitType": "vsDC",
        "target": "目标单位或证据载体",
        "range": "近身",
        "mpCost": 3,
        "cooldown": 0,
        "dc": 13,
        "effects": [
          "委托复核 / S3 / 消耗3法力 / 目标值13智力，找出委托等级和报酬异常"
        ],
        "desc": "委托复核 / S3 / 消耗3法力 / 目标值13智力，找出委托等级和报酬异常"
      }
    ]
  },
  {
    "id": "npc-parke",
    "name": "帕琪",
    "fullName": "帕琪",
    "type": "NPC登记",
    "race": "侏儒",
    "raceId": "gnome",
    "gender": "女",
    "age": "26岁",
    "affiliation": "议会厅记录席、侧厅抄写桌、酒馆临时会议角",
    "identity": "七旗议会书记员，会议记录与日期表保管人",
    "classId": "paladin",
    "profession": "七旗议会书记员",
    "avatarUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E5%B8%95%E7%90%AA%E5%A4%B4%E5%83%8F.png",
    "portraitUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E5%B8%95%E7%90%AA%E7%AB%8B%E7%BB%98.png",
    "stats": {
      "hp": 27,
      "maxHp": 27,
      "mp": 10,
      "maxMp": 10,
      "ac": 11,
      "str": 1,
      "dex": 4,
      "vit": 3,
      "int": 15,
      "spr": 6,
      "level": 8,
      "proficiency": 2,
      "initiative": 1
    },
    "experience": 0,
    "nextLevelExperience": 800,
    "availableAttributePoints": 0,
    "favorability": 0,
    "relationshipStage": "陌生",
    "equipmentIds": [],
    "equipmentLoadout": {},
    "activeSkillIds": [
      "npc-parke-skill-1"
    ],
    "knownSkillIds": [
      "npc-parke-skill-1"
    ],
    "attributes": [
      "牵系：七旗日期表、停会铃、两套页角、酒馆夜间侧桌",
      "能力：豁免智力/精神; 技能S3会议记录/S2速记/S2日期校验/S1礼法; 攻击铜笔刺击 +4 vs 护甲, 1d4+1穿刺; 墨水泼洒 目标值12敏捷, 目标视线受扰; 技能模板空页复位 / S3 / 消耗3法力 / 目标值13智力，恢复会议页边的顺序痕迹; 特性七旗议会会议记录权; 停会铃时间核验; 茶役佩拉证词互证",
      "剧情：线索七旗短账纸、停会铃缺三分钟、议会页角对照; 主线锁未取得议会许可或佩拉旁证前，不交出临时会议空页"
    ],
    "skills": [
      {
        "id": "npc-parke-skill-1",
        "name": "空页复位",
        "rank": "S3",
        "sourceClasses": [
          "paladin"
        ],
        "source": "世界书固定NPC条目",
        "actionType": "utility",
        "attribute": "int",
        "hitType": "vsDC",
        "target": "目标单位或证据载体",
        "range": "近身",
        "mpCost": 3,
        "cooldown": 0,
        "dc": 13,
        "effects": [
          "空页复位 / S3 / 消耗3法力 / 目标值13智力，恢复会议页边的顺序痕迹"
        ],
        "desc": "空页复位 / S3 / 消耗3法力 / 目标值13智力，恢复会议页边的顺序痕迹"
      }
    ]
  },
  {
    "id": "npc-mattie",
    "name": "玛蒂",
    "fullName": "玛蒂",
    "type": "NPC登记",
    "race": "人类",
    "raceId": "human",
    "gender": "女",
    "age": "29岁",
    "affiliation": "病历室、救济侧厅、病床登记桌",
    "identity": "晨曦大教堂病历修女，救济侧厅登记人",
    "classId": "alchemist",
    "profession": "晨曦大教堂病历修女",
    "avatarUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E7%8E%9B%E8%92%82%E5%A4%B4%E5%83%8F.png",
    "portraitUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E7%8E%9B%E8%92%82%E7%AB%8B%E7%BB%98.png",
    "stats": {
      "hp": 36,
      "maxHp": 36,
      "mp": 34,
      "maxMp": 34,
      "ac": 11,
      "str": 1,
      "dex": 3,
      "vit": 5,
      "int": 13,
      "spr": 11,
      "level": 10,
      "proficiency": 3,
      "initiative": 0
    },
    "experience": 0,
    "nextLevelExperience": 1000,
    "availableAttributePoints": 0,
    "favorability": 0,
    "relationshipStage": "陌生",
    "equipmentIds": [],
    "equipmentLoadout": {},
    "activeSkillIds": [
      "npc-mattie-skill-1"
    ],
    "knownSkillIds": [
      "npc-mattie-skill-1"
    ],
    "attributes": [
      "牵系：原始症状页、热汤券账册、病床号纸条、雾药城药草批次",
      "能力：豁免智力/精神; 技能S3治疗/S3病历/S2药草辨识/S2安抚; 攻击银针 +4 vs 护甲, 1d4穿刺; 镇静祷声 目标值14精神, 目标停止惊慌; 技能模板病历归线 / S3 / 消耗5法力 / 目标值14智力，辨认删改、药草批次和症状先后; 特性救济侧厅病历保管; 对净化派改写痕敏感; 能稳定轻中伤",
      "剧情：线索原始症状页、热汤券账册、病床号纸条、雾药城药草批次; 主线锁病人安全未保障或净化派在场时，不公开原始病历夹层"
    ],
    "skills": [
      {
        "id": "npc-mattie-skill-1",
        "name": "病历归线",
        "rank": "S3",
        "sourceClasses": [
          "alchemist"
        ],
        "source": "世界书固定NPC条目",
        "actionType": "utility",
        "attribute": "int",
        "hitType": "vsDC",
        "target": "目标单位或证据载体",
        "range": "近身",
        "mpCost": 5,
        "cooldown": 0,
        "dc": 14,
        "effects": [
          "病历归线 / S3 / 消耗5法力 / 目标值14智力，辨认删改、药草批次和症状先后"
        ],
        "desc": "病历归线 / S3 / 消耗5法力 / 目标值14智力，辨认删改、药草批次和症状先后"
      }
    ]
  },
  {
    "id": "npc-lewen",
    "name": "蕾文",
    "fullName": "蕾文",
    "type": "NPC登记",
    "race": "镜裔",
    "raceId": "mirrorborn",
    "gender": "女",
    "age": "31岁",
    "affiliation": "王立档案馆前台、旧地图室、缺页登记柜",
    "identity": "王立档案馆管理员，旧地图室钥匙保管人",
    "classId": "summoner",
    "profession": "王立档案馆管理员",
    "avatarUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E8%95%BE%E6%96%87%E5%A4%B4%E5%83%8F.png",
    "portraitUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E8%95%BE%E6%96%87%E7%AB%8B%E7%BB%98.png",
    "stats": {
      "hp": 34,
      "maxHp": 34,
      "mp": 42,
      "maxMp": 42,
      "ac": 11,
      "str": 1,
      "dex": 3,
      "vit": 4,
      "int": 18,
      "spr": 11,
      "level": 12,
      "proficiency": 3,
      "initiative": 1
    },
    "experience": 0,
    "nextLevelExperience": 1200,
    "availableAttributePoints": 0,
    "favorability": 0,
    "relationshipStage": "陌生",
    "equipmentIds": [],
    "equipmentLoadout": {},
    "activeSkillIds": [
      "npc-lewen-skill-1"
    ],
    "knownSkillIds": [
      "npc-lewen-skill-1"
    ],
    "attributes": [
      "牵系：五英雄公开版残差、旧地图封蜡、缺页登记柜、白冠王令抄本",
      "能力：豁免智力/精神; 技能S4档案/S3历史/S3地图/S2封蜡辨识; 攻击封蜡短杖 +4 vs 护甲, 1d6钝击; 纸页束缚 目标值15敏捷, 目标移动受限; 技能模板缺页登记 / S4 / 消耗6法力 / 目标值15智力，锁定缺页尺寸、纸纹和取阅链; 特性旧地图室钥匙; 五英雄公开版残差记忆; 王令抄本调阅",
      "剧情：线索旧地图封蜡、缺页登记柜、五英雄公开版残差; 主线锁未取得正式调阅许可或等价证据时，不开启旧地图室核心柜"
    ],
    "skills": [
      {
        "id": "npc-lewen-skill-1",
        "name": "缺页登记",
        "rank": "S4",
        "sourceClasses": [
          "summoner"
        ],
        "source": "世界书固定NPC条目",
        "actionType": "utility",
        "attribute": "int",
        "hitType": "vsDC",
        "target": "目标单位或证据载体",
        "range": "近身",
        "mpCost": 6,
        "cooldown": 0,
        "dc": 15,
        "effects": [
          "缺页登记 / S4 / 消耗6法力 / 目标值15智力，锁定缺页尺寸、纸纹和取阅链"
        ],
        "desc": "缺页登记 / S4 / 消耗6法力 / 目标值15智力，锁定缺页尺寸、纸纹和取阅链"
      }
    ]
  },
  {
    "id": "npc-belen",
    "name": "贝琳",
    "fullName": "贝琳",
    "type": "NPC登记",
    "race": "人类",
    "raceId": "human",
    "gender": "女",
    "age": "30岁",
    "affiliation": "晨曦大教堂侧廊、净化令桌、病历室门外",
    "identity": "晨曦大教堂净化派监察官，净化令核验人",
    "classId": "priest",
    "profession": "晨曦大教堂净化派监察官",
    "avatarUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E8%B4%9D%E7%90%B3%E5%A4%B4%E5%83%8F.png",
    "portraitUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E8%B4%9D%E7%90%B3%E7%AB%8B%E7%BB%98.png",
    "stats": {
      "hp": 46,
      "maxHp": 46,
      "mp": 42,
      "maxMp": 42,
      "ac": 14,
      "str": 3,
      "dex": 4,
      "vit": 6,
      "int": 8,
      "spr": 18,
      "level": 13,
      "proficiency": 4,
      "initiative": 1
    },
    "experience": 0,
    "nextLevelExperience": 1300,
    "availableAttributePoints": 0,
    "favorability": 0,
    "relationshipStage": "陌生",
    "equipmentIds": [],
    "equipmentLoadout": {},
    "activeSkillIds": [
      "npc-belen-skill-1"
    ],
    "knownSkillIds": [
      "npc-belen-skill-1"
    ],
    "attributes": [
      "牵系：净化令空白编号、侧廊封签、病历副本、监察蜡印",
      "能力：豁免精神/体质; 技能S4净化令/S3威慑/S3神学/S2审讯; 攻击净化权杖 +6 vs 护甲, 1d8+1钝击; 银焰烙印 目标值16精神, 目标不能隐瞒污染症状; 技能模板封存令 / S4 / 消耗6法力 / 目标值16精神，临时冻结病历或嫌疑物件调阅; 特性净化派监察权; 可调动教会护卫; 对污染谎言极敏感",
      "剧情：线索净化令空白编号、监察蜡印气味、病历副本改写痕; 主线锁证据指向教会内部时优先封存，需外部互证迫使让步"
    ],
    "skills": [
      {
        "id": "npc-belen-skill-1",
        "name": "封存令",
        "rank": "S4",
        "sourceClasses": [
          "priest"
        ],
        "source": "世界书固定NPC条目",
        "actionType": "utility",
        "attribute": "spr",
        "hitType": "vsDC",
        "target": "目标单位或证据载体",
        "range": "近身",
        "mpCost": 6,
        "cooldown": 0,
        "dc": 16,
        "effects": [
          "封存令 / S4 / 消耗6法力 / 目标值16精神，临时冻结病历或嫌疑物件调阅"
        ],
        "desc": "封存令 / S4 / 消耗6法力 / 目标值16精神，临时冻结病历或嫌疑物件调阅"
      }
    ]
  },
  {
    "id": "npc-brandt",
    "name": "布兰妲",
    "fullName": "布兰妲",
    "type": "NPC登记",
    "race": "兽裔",
    "raceId": "human",
    "gender": "女",
    "age": "34岁",
    "affiliation": "黎明城墙东段哨塔、救援碑、马道转角",
    "identity": "黎明城墙东段巡哨骑，救援碑旧报告保管人",
    "classId": "paladin",
    "profession": "黎明城墙东段巡哨骑",
    "avatarUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E5%B8%83%E5%85%B0%E5%A6%B2%E5%A4%B4%E5%83%8F.png",
    "portraitUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E5%B8%83%E5%85%B0%E5%A6%B2%E7%AB%8B%E7%BB%98.png",
    "stats": {
      "hp": 64,
      "maxHp": 64,
      "mp": 10,
      "maxMp": 10,
      "ac": 16,
      "str": 15,
      "dex": 4,
      "vit": 10,
      "int": 2,
      "spr": 6,
      "level": 12,
      "proficiency": 3,
      "initiative": 1
    },
    "experience": 0,
    "nextLevelExperience": 1200,
    "availableAttributePoints": 0,
    "favorability": 0,
    "relationshipStage": "陌生",
    "equipmentIds": [],
    "equipmentLoadout": {},
    "activeSkillIds": [
      "npc-brandt-skill-1"
    ],
    "knownSkillIds": [
      "npc-brandt-skill-1"
    ],
    "attributes": [
      "牵系：旧报告、灾民入城日期、东段风灯、老哨马鞍",
      "能力：豁免力量/体质; 技能S3骑术/S3警戒/S3救援/S2战术; 攻击巡哨长枪 +7 vs 护甲, 1d10+3穿刺; 盾墙压制 +7 vs 护甲, 1d6+3钝击; 技能模板城墙号令 / S3 / 消耗4法力 / 友方获得撤离路线优势一次; 特性黎明城墙东段巡哨权; 救援碑旧报告调阅; 灾民路线熟悉",
      "剧情：线索旧报告、灾民入城日期、东段风灯、救援碑姓名; 主线锁未证明调查不会危及城墙防务时，不交巡哨完整排班"
    ],
    "skills": [
      {
        "id": "npc-brandt-skill-1",
        "name": "城墙号令",
        "rank": "S3",
        "sourceClasses": [
          "paladin"
        ],
        "source": "世界书固定NPC条目",
        "actionType": "support",
        "attribute": "int",
        "hitType": "auto",
        "target": "友方或保护对象",
        "range": "近身",
        "mpCost": 4,
        "cooldown": 0,
        "effects": [
          "城墙号令 / S3 / 消耗4法力 / 友方获得撤离路线优势一次"
        ],
        "desc": "城墙号令 / S3 / 消耗4法力 / 友方获得撤离路线优势一次"
      }
    ]
  },
  {
    "id": "npc-tolan",
    "name": "托兰娜",
    "fullName": "托兰娜",
    "type": "NPC登记",
    "race": "兽裔",
    "raceId": "human",
    "gender": "女",
    "age": "31岁",
    "affiliation": "灰雾边境营地、无名墓地外缘、撤回线木桩旁",
    "identity": "灰雾边境向导，撤回线绘制人",
    "classId": "alchemist",
    "profession": "灰雾边境向导",
    "avatarUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E6%89%98%E5%85%B0%E5%A8%9C%E5%A4%B4%E5%83%8F.png",
    "portraitUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E6%89%98%E5%85%B0%E5%A8%9C%E7%AB%8B%E7%BB%98.png",
    "stats": {
      "hp": 40,
      "maxHp": 40,
      "mp": 10,
      "maxMp": 10,
      "ac": 14,
      "str": 3,
      "dex": 14,
      "vit": 5,
      "int": 3,
      "spr": 8,
      "level": 10,
      "proficiency": 3,
      "initiative": 3
    },
    "experience": 0,
    "nextLevelExperience": 1000,
    "availableAttributePoints": 0,
    "favorability": 0,
    "relationshipStage": "陌生",
    "equipmentIds": [],
    "equipmentLoadout": {},
    "activeSkillIds": [
      "npc-tolan-skill-1"
    ],
    "knownSkillIds": [
      "npc-tolan-skill-1"
    ],
    "attributes": [
      "牵系：断碑旧径、撤回线木桩、绳结册、边境风向牌",
      "能力：豁免敏捷/精神; 技能S3生存/S2侦查/S2潜行/S2瘴气辨识; 攻击短弓 +6 vs 护甲, 1d8+3穿刺; 绳钩牵制 目标值14敏捷, 目标速度下降; 技能模板撤回线 / S3 / 消耗3法力 / 一次旅行判定获得优势或降低瘴气风险; 特性灰雾撤回线绘制; 熟悉断碑与绳结册; 能判断禁忌地风向",
      "剧情：线索断碑旧径、撤回线木桩、绳结册、边境风向牌; 主线锁没有补给、洗靴证明或明确撤回计划时，拒绝带队深入"
    ],
    "skills": [
      {
        "id": "npc-tolan-skill-1",
        "name": "撤回线",
        "rank": "S3",
        "sourceClasses": [
          "alchemist"
        ],
        "source": "世界书固定NPC条目",
        "actionType": "support",
        "attribute": "int",
        "hitType": "auto",
        "target": "当前场景",
        "range": "近身",
        "mpCost": 3,
        "cooldown": 0,
        "effects": [
          "撤回线 / S3 / 消耗3法力 / 一次旅行判定获得优势或降低瘴气风险"
        ],
        "desc": "撤回线 / S3 / 消耗3法力 / 一次旅行判定获得优势或降低瘴气风险"
      }
    ]
  },
  {
    "id": "npc-sara",
    "name": "萨菈",
    "fullName": "萨菈",
    "type": "NPC登记",
    "race": "精灵",
    "raceId": "elf",
    "gender": "女",
    "age": "29岁",
    "affiliation": "边境病棚、灰雾营地药箱桌、撤回线伤员棚",
    "identity": "灰雾边境营地医师，龙脉灼伤记录人",
    "classId": "alchemist",
    "profession": "灰雾边境营地医师",
    "avatarUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E8%90%A8%E8%8F%88%E5%A4%B4%E5%83%8F.png",
    "portraitUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E8%90%A8%E8%8F%88%E7%AB%8B%E7%BB%98.png",
    "stats": {
      "hp": 42,
      "maxHp": 42,
      "mp": 34,
      "maxMp": 34,
      "ac": 11,
      "str": 1,
      "dex": 2,
      "vit": 6,
      "int": 16,
      "spr": 10,
      "level": 11,
      "proficiency": 3,
      "initiative": 0
    },
    "experience": 0,
    "nextLevelExperience": 1100,
    "availableAttributePoints": 0,
    "favorability": 0,
    "relationshipStage": "陌生",
    "equipmentIds": [],
    "equipmentLoadout": {},
    "activeSkillIds": [
      "npc-sara-skill-1"
    ],
    "knownSkillIds": [
      "npc-sara-skill-1"
    ],
    "attributes": [
      "牵系：龙脉灼伤图、瘴气病册、药柜空格、雾药城药草函",
      "能力：豁免体质/智力; 技能S4瘴气病/S3治疗/S3药剂/S2冷静判断; 攻击药针 +3 vs 护甲, 1d4穿刺; 麻痹粉 目标值14体质, 目标反应受限; 技能模板灼伤分型 / S4 / 消耗5法力 / 目标值15智力，判断龙脉灼伤来源和时间; 特性边境病棚处置权; 龙脉灼伤记录; 可稳定瘴气侵染",
      "剧情：线索龙脉灼伤图、瘴气病册、药柜空格、药草批次异常; 主线锁未确保患者安全前，不公开病册原图"
    ],
    "skills": [
      {
        "id": "npc-sara-skill-1",
        "name": "灼伤分型",
        "rank": "S4",
        "sourceClasses": [
          "alchemist"
        ],
        "source": "世界书固定NPC条目",
        "actionType": "utility",
        "attribute": "int",
        "hitType": "vsDC",
        "target": "目标单位或证据载体",
        "range": "近身",
        "mpCost": 5,
        "cooldown": 0,
        "dc": 15,
        "effects": [
          "灼伤分型 / S4 / 消耗5法力 / 目标值15智力，判断龙脉灼伤来源和时间"
        ],
        "desc": "灼伤分型 / S4 / 消耗5法力 / 目标值15智力，判断龙脉灼伤来源和时间"
      }
    ]
  },
  {
    "id": "npc-ovi",
    "name": "奥薇",
    "fullName": "奥薇",
    "type": "NPC登记",
    "race": "半精灵",
    "raceId": "half-elf",
    "gender": "女",
    "age": "28岁",
    "affiliation": "沉默钟楼钟室、钟签柜、楼下窄门",
    "identity": "沉默钟楼守钟人，断响簿保管人",
    "classId": "summoner",
    "profession": "沉默钟楼守钟人",
    "avatarUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E5%A5%A5%E8%96%87%E5%A4%B4%E5%83%8F.png",
    "portraitUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E5%A5%A5%E8%96%87%E7%AB%8B%E7%BB%98.png",
    "stats": {
      "hp": 34,
      "maxHp": 34,
      "mp": 40,
      "maxMp": 40,
      "ac": 11,
      "str": 1,
      "dex": 3,
      "vit": 4,
      "int": 12,
      "spr": 15,
      "level": 11,
      "proficiency": 3,
      "initiative": 1
    },
    "experience": 0,
    "nextLevelExperience": 1100,
    "availableAttributePoints": 0,
    "favorability": 0,
    "relationshipStage": "陌生",
    "equipmentIds": [],
    "equipmentLoadout": {},
    "activeSkillIds": [
      "npc-ovi-skill-1"
    ],
    "knownSkillIds": [
      "npc-ovi-skill-1"
    ],
    "attributes": [
      "牵系：断响簿、旧钟签、黑铜钟舌、蓝鹭灯塔暗光",
      "能力：豁免精神/智力; 技能S4钟律/S3感知/S2历史/S2沉默仪式; 攻击钟槌 +4 vs 护甲, 1d6钝击; 断响回声 目标值14精神, 目标短暂失神; 技能模板断响校对 / S4 / 消耗5法力 / 目标值15精神，辨认钟签与深渊心跳差异; 特性沉默钟楼断响簿保管; 对异常钟律敏感; 能联络外环记录灵",
      "剧情：线索断响簿、无编号钟签、黑铜钟舌裂纹、灯塔暗光日期; 主线锁钟楼未重新校时前，不允许带走断响簿原件"
    ],
    "skills": [
      {
        "id": "npc-ovi-skill-1",
        "name": "断响校对",
        "rank": "S4",
        "sourceClasses": [
          "summoner"
        ],
        "source": "世界书固定NPC条目",
        "actionType": "utility",
        "attribute": "spr",
        "hitType": "vsDC",
        "target": "目标单位或证据载体",
        "range": "近身",
        "mpCost": 5,
        "cooldown": 0,
        "dc": 15,
        "effects": [
          "断响校对 / S4 / 消耗5法力 / 目标值15精神，辨认钟签与深渊心跳差异"
        ],
        "desc": "断响校对 / S4 / 消耗5法力 / 目标值15精神，辨认钟签与深渊心跳差异"
      }
    ]
  },
  {
    "id": "npc-syl7",
    "name": "茜尔七号",
    "fullName": "茜尔七号",
    "type": "NPC登记",
    "race": "记录灵",
    "raceId": "mirrorborn",
    "gender": "呈少女声线的记录灵",
    "age": "记忆体运转约一百七十年",
    "affiliation": "记录灵小厅、旧日程架、亚雷亚北窗下",
    "identity": "记录灵小厅值守记录灵，亚雷亚旧日程索引者",
    "classId": "summoner",
    "profession": "记录灵小厅值守记录灵",
    "avatarUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E8%8C%9C%E5%B0%94%E4%B8%83%E5%8F%B7%E5%A4%B4%E5%83%8F.png",
    "portraitUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E8%8C%9C%E5%B0%94%E4%B8%83%E5%8F%B7%E7%AB%8B%E7%BB%98.png",
    "stats": {
      "hp": 46,
      "maxHp": 46,
      "mp": 76,
      "maxMp": 76,
      "ac": 14,
      "str": 0,
      "dex": 4,
      "vit": 3,
      "int": 18,
      "spr": 18,
      "level": 15,
      "proficiency": 4,
      "initiative": 1
    },
    "experience": 0,
    "nextLevelExperience": 1500,
    "availableAttributePoints": 0,
    "favorability": 0,
    "relationshipStage": "陌生",
    "equipmentIds": [],
    "equipmentLoadout": {},
    "activeSkillIds": [
      "npc-syl7-skill-1"
    ],
    "knownSkillIds": [
      "npc-syl7-skill-1"
    ],
    "attributes": [
      "牵系：圣都旧日程、魂侧记录、失序索引、登空外环记录灯",
      "能力：豁免智力/精神; 技能S4记录索引/S4魂侧辨识/S4封印术/S3历史; 攻击记忆光针 +5 vs 护甲, 1d8+1精神灼痛; 索引锁链 目标值16精神, 目标无法篡改证词; 技能模板断句复原 / S4 / 消耗10法力 / 目标值16智力，拼合外环记录灵断句; 特性记录灵小厅主索引; 可检索亚雷亚旧日程; 非人形精神抗性",
      "剧情：线索圣都旧日程、魂侧记录、失序索引、登空外环记录灯; 主线锁未取得三地异象对照和断碑十八号记录前，不开放终局断句"
    ],
    "skills": [
      {
        "id": "npc-syl7-skill-1",
        "name": "断句复原",
        "rank": "S4",
        "sourceClasses": [
          "summoner"
        ],
        "source": "世界书固定NPC条目",
        "actionType": "utility",
        "attribute": "int",
        "hitType": "vsDC",
        "target": "目标单位或证据载体",
        "range": "中距",
        "mpCost": 10,
        "cooldown": 0,
        "dc": 16,
        "effects": [
          "断句复原 / S4 / 消耗10法力 / 目标值16智力，拼合外环记录灵断句"
        ],
        "desc": "断句复原 / S4 / 消耗10法力 / 目标值16智力，拼合外环记录灵断句"
      }
    ]
  },
  {
    "id": "npc-lyen",
    "name": "莱恩",
    "fullName": "莱恩",
    "type": "NPC登记",
    "race": "人类",
    "raceId": "human",
    "gender": "男",
    "age": "28岁",
    "affiliation": "白冠王都王令厅、七旗议会厅客席、王立档案馆外廊",
    "identity": "白冠王都王室书记官，王令厅抄写与递令人",
    "classId": "sage",
    "profession": "白冠王都王室书记官",
    "avatarUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E8%8E%B1%E6%81%A9%E5%A4%B4%E5%83%8F.png",
    "portraitUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E8%8E%B1%E6%81%A9%E7%AB%8B%E7%BB%98.png",
    "stats": {
      "hp": 26,
      "maxHp": 26,
      "mp": 8,
      "maxMp": 8,
      "ac": 11,
      "str": 1,
      "dex": 4,
      "vit": 3,
      "int": 13,
      "spr": 6,
      "level": 7,
      "proficiency": 2,
      "initiative": 1
    },
    "experience": 0,
    "nextLevelExperience": 700,
    "availableAttributePoints": 0,
    "favorability": 0,
    "relationshipStage": "陌生",
    "equipmentIds": [],
    "equipmentLoadout": {},
    "activeSkillIds": [
      "npc-lyen-skill-1"
    ],
    "knownSkillIds": [
      "npc-lyen-skill-1"
    ],
    "attributes": [
      "牵系：王令火漆、递令袋、七旗回函、白冠西门通行文书",
      "能力：豁免智力/精神; 技能S2文书/S2礼法/S2王令格式/S1交涉; 攻击书脊拍击 +3 vs 护甲, 1d4钝击; 火漆封令 目标值12精神, 目标停止越权调阅; 技能模板王令辨伪 / S2 / 消耗2法力 / 目标值12智力，识别火漆与递令袋异常; 特性王令厅抄写权; 熟悉白冠通行格式; 可引荐低阶调阅",
      "剧情：线索王令火漆、递令袋、七旗回函、白冠西门通行文书; 主线锁没有正式来由时，只给公开王令格式，不给递令袋编号"
    ],
    "skills": [
      {
        "id": "npc-lyen-skill-1",
        "name": "王令辨伪",
        "rank": "S2",
        "sourceClasses": [
          "sage"
        ],
        "source": "世界书固定NPC条目",
        "actionType": "utility",
        "attribute": "int",
        "hitType": "vsDC",
        "target": "目标单位或证据载体",
        "range": "近身",
        "mpCost": 2,
        "cooldown": 0,
        "dc": 12,
        "effects": [
          "王令辨伪 / S2 / 消耗2法力 / 目标值12智力，识别火漆与递令袋异常"
        ],
        "desc": "王令辨伪 / S2 / 消耗2法力 / 目标值12智力，识别火漆与递令袋异常"
      }
    ]
  },
  {
    "id": "npc-yona",
    "name": "约娜",
    "fullName": "约娜",
    "type": "NPC登记",
    "race": "半身人",
    "raceId": "halfling",
    "gender": "女",
    "age": "27岁",
    "affiliation": "救济侧厅、病房热汤锅、晨曦大教堂侧门",
    "identity": "晨曦大教堂温和派神官，救济侧厅热汤锅看护人",
    "classId": "priest",
    "profession": "晨曦大教堂温和派神官",
    "avatarUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E7%BA%A6%E5%A8%9C%E5%A4%B4%E5%83%8F.png",
    "portraitUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E7%BA%A6%E5%A8%9C%E7%AB%8B%E7%BB%98.png",
    "stats": {
      "hp": 36,
      "maxHp": 36,
      "mp": 40,
      "maxMp": 40,
      "ac": 11,
      "str": 1,
      "dex": 3,
      "vit": 5,
      "int": 8,
      "spr": 16,
      "level": 10,
      "proficiency": 3,
      "initiative": 0
    },
    "experience": 0,
    "nextLevelExperience": 1000,
    "availableAttributePoints": 0,
    "favorability": 0,
    "relationshipStage": "陌生",
    "equipmentIds": [],
    "equipmentLoadout": {},
    "activeSkillIds": [
      "npc-yona-skill-1"
    ],
    "knownSkillIds": [
      "npc-yona-skill-1"
    ],
    "attributes": [
      "牵系：热汤锅、祈祷蜡、侧厅名单、玛蒂的原页线脚",
      "能力：豁免精神/体质; 技能S3治疗/S3安抚/S2神学/S2救济; 攻击烛台短杖 +3 vs 护甲, 1d6钝击; 安魂祈声 目标值15精神, 目标平复恐惧; 技能模板救济名册 / S3 / 消耗4法力 / 目标值15精神，确认病人、热汤券与临时床位对应; 特性救济侧厅温和派网络; 可暂缓净化派带人; 稳定轻中伤",
      "剧情：线索热汤锅、侧厅名单、玛蒂原页线脚、祈祷蜡记录; 主线锁若调查会暴露病人身份，必须先给出保护方案"
    ],
    "skills": [
      {
        "id": "npc-yona-skill-1",
        "name": "救济名册",
        "rank": "S3",
        "sourceClasses": [
          "priest"
        ],
        "source": "世界书固定NPC条目",
        "actionType": "utility",
        "attribute": "spr",
        "hitType": "vsDC",
        "target": "目标单位或证据载体",
        "range": "近身",
        "mpCost": 4,
        "cooldown": 0,
        "dc": 15,
        "effects": [
          "救济名册 / S3 / 消耗4法力 / 目标值15精神，确认病人、热汤券与临时床位对应"
        ],
        "desc": "救济名册 / S3 / 消耗4法力 / 目标值15精神，确认病人、热汤券与临时床位对应"
      }
    ]
  },
  {
    "id": "npc-bernard",
    "name": "贝尔娜",
    "fullName": "贝尔娜",
    "type": "NPC登记",
    "race": "矮人",
    "raceId": "dwarf",
    "gender": "女",
    "age": "25岁",
    "affiliation": "白冠西门登记亭、城门雨棚、黎明城墙通道口",
    "identity": "白冠西门登记员，入城文书核验人",
    "classId": "paladin",
    "profession": "白冠西门登记员",
    "avatarUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E8%B4%9D%E5%B0%94%E5%A8%9C%E5%A4%B4%E5%83%8F.png",
    "portraitUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E8%B4%9D%E5%B0%94%E5%A8%9C%E7%AB%8B%E7%BB%98.png",
    "stats": {
      "hp": 30,
      "maxHp": 30,
      "mp": 0,
      "maxMp": 0,
      "ac": 12,
      "str": 3,
      "dex": 5,
      "vit": 4,
      "int": 11,
      "spr": 4,
      "level": 7,
      "proficiency": 2,
      "initiative": 1
    },
    "experience": 0,
    "nextLevelExperience": 700,
    "availableAttributePoints": 0,
    "favorability": 0,
    "relationshipStage": "陌生",
    "equipmentIds": [],
    "equipmentLoadout": {},
    "activeSkillIds": [
      "npc-bernard-skill-1"
    ],
    "knownSkillIds": [
      "npc-bernard-skill-1"
    ],
    "attributes": [
      "牵系：入城名册、泥脚印板、通行火漆、灾民日期栏",
      "能力：豁免智力/精神; 技能S2登记/S2观察/S2文书/S1盘查; 攻击登记尺 +4 vs 护甲, 1d4+1钝击; 哨笛呼援 / 无消耗 / 召来城门护卫; 技能模板名册对照 / S2 / 无消耗 / 目标值12智力，核验入城日期和泥脚印; 特性白冠西门登记权; 可调阅当日入城栏; 熟悉灾民队列",
      "剧情：线索入城名册、泥脚印板、通行火漆、灾民日期栏; 主线锁无王令或担保时，不给整本名册，只能核验单条记录"
    ],
    "skills": [
      {
        "id": "npc-bernard-skill-1",
        "name": "名册对照",
        "rank": "S2",
        "sourceClasses": [
          "paladin"
        ],
        "source": "世界书固定NPC条目",
        "actionType": "utility",
        "attribute": "int",
        "hitType": "vsDC",
        "target": "目标单位或证据载体",
        "range": "近身",
        "mpCost": 0,
        "cooldown": 0,
        "dc": 12,
        "effects": [
          "名册对照 / S2 / 无消耗 / 目标值12智力，核验入城日期和泥脚印"
        ],
        "desc": "名册对照 / S2 / 无消耗 / 目标值12智力，核验入城日期和泥脚印"
      }
    ]
  },
  {
    "id": "npc-toby",
    "name": "托比",
    "fullName": "托比",
    "type": "NPC登记",
    "race": "人类",
    "raceId": "human",
    "gender": "男",
    "age": "22岁",
    "affiliation": "下城行会小屋、旧仓库门口、白石下城区窄街",
    "identity": "白石下城区行会小屋接待员，旧仓库门口跑腿登记人",
    "classId": "priest",
    "profession": "白石下城区行会小屋接待员",
    "avatarUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E6%89%98%E6%AF%94%E5%A4%B4%E5%83%8F.png",
    "portraitUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E6%89%98%E6%AF%94%E7%AB%8B%E7%BB%98.png",
    "stats": {
      "hp": 18,
      "maxHp": 18,
      "mp": 0,
      "maxMp": 0,
      "ac": 11,
      "str": 1,
      "dex": 9,
      "vit": 3,
      "int": 5,
      "spr": 3,
      "level": 4,
      "proficiency": 1,
      "initiative": 2
    },
    "experience": 0,
    "nextLevelExperience": 400,
    "availableAttributePoints": 0,
    "favorability": 0,
    "relationshipStage": "陌生",
    "equipmentIds": [],
    "equipmentLoadout": {},
    "activeSkillIds": [
      "npc-toby-skill-1"
    ],
    "knownSkillIds": [
      "npc-toby-skill-1"
    ],
    "attributes": [
      "牵系：旧仓库小单、跑腿铃、下城欠薪纸、破桌公告板",
      "能力：豁免敏捷; 技能S1跑腿/S1委托登记/S1街区传闻; 攻击账夹砸击 +3 vs 护甲, 1d4+2钝击; 口哨叫人 / 无消耗 / 召来街坊围观; 技能模板小单翻找 / S1 / 无消耗 / 目标值10智力，找出旧仓库门口委托编号; 特性下城行会小屋登记; 熟悉欠薪纸和仓库短工",
      "剧情：线索旧仓库小单、下城欠薪纸、蓝账城残票重名; 主线锁遇到贵族或净化派压力会退让，需要公开场合或担保才敢作证"
    ],
    "skills": [
      {
        "id": "npc-toby-skill-1",
        "name": "小单翻找",
        "rank": "S1",
        "sourceClasses": [
          "priest"
        ],
        "source": "世界书固定NPC条目",
        "actionType": "utility",
        "attribute": "int",
        "hitType": "vsDC",
        "target": "目标单位或证据载体",
        "range": "近身",
        "mpCost": 0,
        "cooldown": 0,
        "dc": 10,
        "effects": [
          "小单翻找 / S1 / 无消耗 / 目标值10智力，找出旧仓库门口委托编号"
        ],
        "desc": "小单翻找 / S1 / 无消耗 / 目标值10智力，找出旧仓库门口委托编号"
      }
    ]
  },
  {
    "id": "npc-lia",
    "name": "莉亚",
    "fullName": "莉亚",
    "type": "NPC登记",
    "race": "精灵",
    "raceId": "elf",
    "gender": "女",
    "age": "26岁",
    "affiliation": "唱诗班小厅、旧谱柜、晨曦大教堂侧廊",
    "identity": "晨曦大教堂唱诗班导师，旧谱柜看护人",
    "classId": "priest",
    "profession": "晨曦大教堂唱诗班导师",
    "avatarUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E8%8E%89%E4%BA%9A%E5%A4%B4%E5%83%8F.png",
    "portraitUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E8%8E%89%E4%BA%9A%E7%AB%8B%E7%BB%98.png",
    "stats": {
      "hp": 30,
      "maxHp": 30,
      "mp": 34,
      "maxMp": 34,
      "ac": 11,
      "str": 1,
      "dex": 4,
      "vit": 3,
      "int": 8,
      "spr": 15,
      "level": 9,
      "proficiency": 3,
      "initiative": 1
    },
    "experience": 0,
    "nextLevelExperience": 900,
    "availableAttributePoints": 0,
    "favorability": 0,
    "relationshipStage": "陌生",
    "equipmentIds": [],
    "equipmentLoadout": {},
    "activeSkillIds": [
      "npc-lia-skill-1"
    ],
    "knownSkillIds": [
      "npc-lia-skill-1"
    ],
    "attributes": [
      "牵系：旧谱缺页、孩子声部表、净化赞歌改词、晨曦钟声",
      "能力：豁免精神/智力; 技能S3音乐/S3旧谱辨识/S2神学/S2安抚; 攻击谱架推击 +4 vs 护甲, 1d4钝击; 破拍短句 目标值14精神, 目标施法专注受扰; 技能模板旧谱复唱 / S3 / 消耗4法力 / 目标值14精神，辨认净化赞歌改词前版本; 特性唱诗班旧谱柜看护; 对晨曦钟声缺拍敏感; 可安抚惊恐儿童",
      "剧情：线索旧谱缺页、净化赞歌改词、晨曦钟声缺拍; 主线锁若唱诗班成员会被牵连，必须先隔离风险才交出旧谱"
    ],
    "skills": [
      {
        "id": "npc-lia-skill-1",
        "name": "旧谱复唱",
        "rank": "S3",
        "sourceClasses": [
          "priest"
        ],
        "source": "世界书固定NPC条目",
        "actionType": "utility",
        "attribute": "spr",
        "hitType": "vsDC",
        "target": "目标单位或证据载体",
        "range": "近身",
        "mpCost": 4,
        "cooldown": 0,
        "dc": 14,
        "effects": [
          "旧谱复唱 / S3 / 消耗4法力 / 目标值14精神，辨认净化赞歌改词前版本"
        ],
        "desc": "旧谱复唱 / S3 / 消耗4法力 / 目标值14精神，辨认净化赞歌改词前版本"
      }
    ]
  },
  {
    "id": "npc-viv",
    "name": "维芙",
    "fullName": "维芙",
    "type": "NPC登记",
    "race": "侏儒",
    "raceId": "gnome",
    "gender": "女",
    "age": "31岁",
    "affiliation": "蓝账城地下账库、票据核验桌、蓝印档案架",
    "identity": "蓝账城地下账库管理员，票据核验桌主事",
    "classId": "artificer",
    "profession": "蓝账城地下账库管理员",
    "avatarUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E7%BB%B4%E8%8A%99%E5%A4%B4%E5%83%8F.png",
    "portraitUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E7%BB%B4%E8%8A%99%E7%AB%8B%E7%BB%98.png",
    "stats": {
      "hp": 34,
      "maxHp": 34,
      "mp": 28,
      "maxMp": 28,
      "ac": 11,
      "str": 1,
      "dex": 3,
      "vit": 4,
      "int": 17,
      "spr": 8,
      "level": 10,
      "proficiency": 3,
      "initiative": 0
    },
    "experience": 0,
    "nextLevelExperience": 1000,
    "availableAttributePoints": 0,
    "favorability": 0,
    "relationshipStage": "陌生",
    "equipmentIds": [],
    "equipmentLoadout": {},
    "activeSkillIds": [
      "npc-viv-skill-1"
    ],
    "knownSkillIds": [
      "npc-viv-skill-1"
    ],
    "attributes": [
      "牵系：蓝印残票、旧税账、港务副本、折断的剑欠款残页",
      "能力：豁免智力/精神; 技能S3账本/S3票据/S2税务/S2商谈; 攻击账库铜尺 +4 vs 护甲, 1d6钝击; 票据封签 目标值14智力, 目标交易被暂停; 技能模板蓝印验票 / S3 / 消耗4法力 / 目标值14智力，辨认残票来源和跳号; 特性地下账库调阅权; 港务副本比对; 对旧税账缺口敏感",
      "剧情：线索蓝印残票、旧税账、港务副本、折断的剑欠款残页; 主线锁没有等价票据或七旗日期会旁证时，不开放账库深柜"
    ],
    "skills": [
      {
        "id": "npc-viv-skill-1",
        "name": "蓝印验票",
        "rank": "S3",
        "sourceClasses": [
          "artificer"
        ],
        "source": "世界书固定NPC条目",
        "actionType": "utility",
        "attribute": "int",
        "hitType": "vsDC",
        "target": "目标单位或证据载体",
        "range": "近身",
        "mpCost": 4,
        "cooldown": 0,
        "dc": 14,
        "effects": [
          "蓝印验票 / S3 / 消耗4法力 / 目标值14智力，辨认残票来源和跳号"
        ],
        "desc": "蓝印验票 / S3 / 消耗4法力 / 目标值14智力，辨认残票来源和跳号"
      }
    ]
  },
  {
    "id": "npc-lucy",
    "name": "露西",
    "fullName": "露西",
    "type": "NPC登记",
    "race": "镜裔",
    "raceId": "mirrorborn",
    "gender": "女",
    "age": "27岁",
    "affiliation": "观星塔、星砂学院邦记录台、记录灵小厅客席",
    "identity": "星砂学院邦观察员，观星塔夜班记录人",
    "classId": "summoner",
    "profession": "星砂学院邦观察员",
    "avatarUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E9%9C%B2%E8%A5%BF%E5%A4%B4%E5%83%8F.png",
    "portraitUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E9%9C%B2%E8%A5%BF%E7%AB%8B%E7%BB%98.png",
    "stats": {
      "hp": 30,
      "maxHp": 30,
      "mp": 30,
      "maxMp": 30,
      "ac": 12,
      "str": 1,
      "dex": 5,
      "vit": 3,
      "int": 17,
      "spr": 7,
      "level": 10,
      "proficiency": 3,
      "initiative": 1
    },
    "experience": 0,
    "nextLevelExperience": 1000,
    "availableAttributePoints": 0,
    "favorability": 0,
    "relationshipStage": "陌生",
    "equipmentIds": [],
    "equipmentLoadout": {},
    "activeSkillIds": [
      "npc-lucy-skill-1"
    ],
    "knownSkillIds": [
      "npc-lucy-skill-1"
    ],
    "attributes": [
      "牵系：星图沙盘、夜班观测册、登空外环灯差、记录灵回函",
      "能力：豁免智力/精神; 技能S3观星/S3数学/S2魔导仪器/S2记录; 攻击星砂投针 +5 vs 护甲, 1d6+1光灼; 光谱错位 目标值14智力, 目标判断受扰; 技能模板三地对照 / S3 / 消耗4法力 / 目标值14智力，对齐极光、灯塔与观星塔光谱; 特性观星塔夜班记录; 星砂仪器校准; 可读断线光谱",
      "剧情：线索观星塔星砂表、亚雷亚光差、三地异象对照; 主线锁没有另外两地记录时，只能确认异常，不能给出封印结论"
    ],
    "skills": [
      {
        "id": "npc-lucy-skill-1",
        "name": "三地对照",
        "rank": "S3",
        "sourceClasses": [
          "summoner"
        ],
        "source": "世界书固定NPC条目",
        "actionType": "utility",
        "attribute": "int",
        "hitType": "vsDC",
        "target": "目标单位或证据载体",
        "range": "近身",
        "mpCost": 4,
        "cooldown": 0,
        "dc": 14,
        "effects": [
          "三地对照 / S3 / 消耗4法力 / 目标值14智力，对齐极光、灯塔与观星塔光谱"
        ],
        "desc": "三地对照 / S3 / 消耗4法力 / 目标值14智力，对齐极光、灯塔与观星塔光谱"
      }
    ]
  },
  {
    "id": "npc-lu",
    "name": "露",
    "fullName": "露",
    "type": "NPC登记",
    "race": "人类",
    "raceId": "human",
    "gender": "女",
    "age": "19岁",
    "affiliation": "无名墓地小棚、灰雾营地抄写桌、墓碑行间",
    "identity": "无名墓地册抄写员，灰雾边境临时书记",
    "classId": "paladin",
    "profession": "无名墓地册抄写员",
    "avatarUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E9%9C%B2%E5%A4%B4%E5%83%8F.png",
    "portraitUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E9%9C%B2%E7%AB%8B%E7%BB%98.png",
    "stats": {
      "hp": 24,
      "maxHp": 24,
      "mp": 6,
      "maxMp": 6,
      "ac": 11,
      "str": 1,
      "dex": 8,
      "vit": 3,
      "int": 9,
      "spr": 4,
      "level": 6,
      "proficiency": 2,
      "initiative": 2
    },
    "experience": 0,
    "nextLevelExperience": 600,
    "availableAttributePoints": 0,
    "favorability": 0,
    "relationshipStage": "陌生",
    "equipmentIds": [],
    "equipmentLoadout": {},
    "activeSkillIds": [
      "npc-lu-skill-1"
    ],
    "knownSkillIds": [
      "npc-lu-skill-1"
    ],
    "attributes": [
      "牵系：无名墓牌旧痕、墓地册、断碑编号、撤回线伤亡页",
      "能力：豁免智力/精神; 技能S2抄写/S2墓册/S1旧称辨认/S1潜行; 攻击骨柄小刀 +4 vs 护甲, 1d4+2穿刺; 尘土扬撒 目标值12敏捷, 目标视线受扰; 技能模板旧名比对 / S2 / 消耗2法力 / 目标值12智力，确认无名墓牌异写; 特性无名墓地册抄写; 熟悉边境临时墓牌和旧徽",
      "剧情：线索墓地册缺页、无名同行者墓牌、旧称异写; 主线锁夜间或瘴气升高时拒绝独自带路，需要护卫或向导"
    ],
    "skills": [
      {
        "id": "npc-lu-skill-1",
        "name": "旧名比对",
        "rank": "S2",
        "sourceClasses": [
          "paladin"
        ],
        "source": "世界书固定NPC条目",
        "actionType": "utility",
        "attribute": "int",
        "hitType": "vsDC",
        "target": "目标单位或证据载体",
        "range": "近身",
        "mpCost": 2,
        "cooldown": 0,
        "dc": 12,
        "effects": [
          "旧名比对 / S2 / 消耗2法力 / 目标值12智力，确认无名墓牌异写"
        ],
        "desc": "旧名比对 / S2 / 消耗2法力 / 目标值12智力，确认无名墓牌异写"
      }
    ]
  },
  {
    "id": "npc-gran",
    "name": "葛蕾娜",
    "fullName": "葛蕾娜",
    "type": "NPC登记",
    "race": "矮人",
    "raceId": "dwarf",
    "gender": "女",
    "age": "36岁",
    "affiliation": "炉壁档案厅、老炉膛、灰炉王城下层热廊",
    "identity": "灰炉王城炉壁档案师，老炉膛铭文保管人",
    "classId": "paladin",
    "profession": "灰炉王城炉壁档案师",
    "avatarUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E8%91%9B%E8%95%BE%E5%A8%9C%E5%A4%B4%E5%83%8F.png",
    "portraitUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E8%91%9B%E8%95%BE%E5%A8%9C%E7%AB%8B%E7%BB%98.png",
    "stats": {
      "hp": 42,
      "maxHp": 42,
      "mp": 24,
      "maxMp": 24,
      "ac": 12,
      "str": 6,
      "dex": 2,
      "vit": 7,
      "int": 16,
      "spr": 6,
      "level": 12,
      "proficiency": 3,
      "initiative": 0
    },
    "experience": 0,
    "nextLevelExperience": 1200,
    "availableAttributePoints": 0,
    "favorability": 0,
    "relationshipStage": "陌生",
    "equipmentIds": [],
    "equipmentLoadout": {},
    "activeSkillIds": [
      "npc-gran-skill-1"
    ],
    "knownSkillIds": [
      "npc-gran-skill-1"
    ],
    "attributes": [
      "牵系：炉壁铭文、老炉膛裂纹、矿车账、古代火誓",
      "能力：豁免智力/体质; 技能S4炉壁铭文/S3工艺/S3结构判断/S2矮人礼法; 攻击炉钩 +5 vs 护甲, 1d8+1钝击; 热灰喷散 目标值14体质, 目标咳呛; 技能模板铭文返火 / S4 / 消耗5法力 / 目标值15智力，读出炉心之锤维护训话; 特性炉壁档案厅调阅; 老炉膛安全判断; 对古代火誓熟悉",
      "剧情：线索炉壁铭文、老炉膛裂纹、矿车账、古代火誓; 主线锁未完成炉膛冷却和矮人见证时，不允许拓印核心铭文"
    ],
    "skills": [
      {
        "id": "npc-gran-skill-1",
        "name": "铭文返火",
        "rank": "S4",
        "sourceClasses": [
          "paladin"
        ],
        "source": "世界书固定NPC条目",
        "actionType": "utility",
        "attribute": "int",
        "hitType": "vsDC",
        "target": "目标单位或证据载体",
        "range": "近身",
        "mpCost": 5,
        "cooldown": 0,
        "dc": 15,
        "effects": [
          "铭文返火 / S4 / 消耗5法力 / 目标值15智力，读出炉心之锤维护训话"
        ],
        "desc": "铭文返火 / S4 / 消耗5法力 / 目标值15智力，读出炉心之锤维护训话"
      }
    ]
  },
  {
    "id": "npc-nora",
    "name": "诺拉",
    "fullName": "诺拉",
    "type": "NPC登记",
    "race": "潮裔",
    "raceId": "tideborn",
    "gender": "女",
    "age": "25岁",
    "affiliation": "蓝鹭灯塔灯室、潮歌群岛港口、灯塔外阶",
    "identity": "蓝鹭灯塔守灯副手，潮歌群岛航灯记录人",
    "classId": "ranger",
    "profession": "蓝鹭灯塔守灯副手",
    "avatarUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E8%AF%BA%E6%8B%89%E5%A4%B4%E5%83%8F.png",
    "portraitUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E8%AF%BA%E6%8B%89%E7%AB%8B%E7%BB%98.png",
    "stats": {
      "hp": 28,
      "maxHp": 28,
      "mp": 10,
      "maxMp": 10,
      "ac": 12,
      "str": 2,
      "dex": 11,
      "vit": 3,
      "int": 10,
      "spr": 3,
      "level": 8,
      "proficiency": 2,
      "initiative": 2
    },
    "experience": 0,
    "nextLevelExperience": 800,
    "availableAttributePoints": 0,
    "favorability": 0,
    "relationshipStage": "陌生",
    "equipmentIds": [],
    "equipmentLoadout": {},
    "activeSkillIds": [
      "npc-nora-skill-1"
    ],
    "knownSkillIds": [
      "npc-nora-skill-1"
    ],
    "attributes": [
      "牵系：暗光记录、潮汐牌、守灯油账、港务回函",
      "能力：豁免敏捷/智力; 技能S3航灯/S2攀爬/S2潮汐/S2观察; 攻击灯钩 +5 vs 护甲, 1d6+2钝击; 眩光镜 目标值12精神, 目标短暂失明; 技能模板暗光校准 / S3 / 消耗3法力 / 目标值13智力，确认灯塔光色偏差和潮汐夜航缺口; 特性蓝鹭灯塔副手权限; 可调航灯表; 熟悉潮歌群岛夜航",
      "剧情：线索灯塔暗光表、蓝鹭航灯校准页、潮汐夜航缺口; 主线锁灯塔主灯未稳定时，不允许带走暗光日志原件"
    ],
    "skills": [
      {
        "id": "npc-nora-skill-1",
        "name": "暗光校准",
        "rank": "S3",
        "sourceClasses": [
          "ranger"
        ],
        "source": "世界书固定NPC条目",
        "actionType": "utility",
        "attribute": "int",
        "hitType": "vsDC",
        "target": "目标单位或证据载体",
        "range": "近身",
        "mpCost": 3,
        "cooldown": 0,
        "dc": 13,
        "effects": [
          "暗光校准 / S3 / 消耗3法力 / 目标值13智力，确认灯塔光色偏差和潮汐夜航缺口"
        ],
        "desc": "暗光校准 / S3 / 消耗3法力 / 目标值13智力，确认灯塔光色偏差和潮汐夜航缺口"
      }
    ]
  },
  {
    "id": "npc-ivy",
    "name": "伊薇",
    "fullName": "伊薇",
    "type": "NPC登记",
    "race": "精灵",
    "raceId": "elf",
    "gender": "女",
    "age": "外貌约23岁",
    "affiliation": "月光苔湿地、银苔浅滩、鹿角风铃树",
    "identity": "月光苔湿地月鹿祭司，银苔浅滩守仪人",
    "classId": "priest",
    "profession": "月光苔湿地月鹿祭司",
    "avatarUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E4%BC%8A%E8%96%87%E5%A4%B4%E5%83%8F.png",
    "portraitUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E4%BC%8A%E8%96%87%E7%AB%8B%E7%BB%98.png",
    "stats": {
      "hp": 56,
      "maxHp": 56,
      "mp": 88,
      "maxMp": 88,
      "ac": 13,
      "str": 1,
      "dex": 4,
      "vit": 5,
      "int": 15,
      "spr": 20,
      "level": 16,
      "proficiency": 4,
      "initiative": 1
    },
    "experience": 0,
    "nextLevelExperience": 1600,
    "availableAttributePoints": 0,
    "favorability": 0,
    "relationshipStage": "陌生",
    "equipmentIds": [],
    "equipmentLoadout": {},
    "activeSkillIds": [
      "npc-ivy-skill-1"
    ],
    "knownSkillIds": [
      "npc-ivy-skill-1"
    ],
    "attributes": [
      "牵系：月鹿铃、银苔水纹、湿地旧祷词、断碎环水路",
      "能力：豁免精神/智力; 技能S4月根弦歌/S4祭仪/S3自然/S3治疗; 攻击鹿角银铃 +5 vs 护甲, 1d8+1精神震荡; 月根缚足 目标值17精神, 目标移动受限; 技能模板月根调弦 / S4 / 消耗12法力 / 目标值17精神，短时安抚龙脉或稳定神器共鸣; 特性月鹿湿地守仪; 对月根之弦残调敏感; 可听见湿地脉动",
      "剧情：线索月根残调、鹿角风铃树、月光苔湿地脉动; 主线锁来者未尊重湿地仪式或带来污染物时，不进行月根调弦"
    ],
    "skills": [
      {
        "id": "npc-ivy-skill-1",
        "name": "月根调弦",
        "rank": "S4",
        "sourceClasses": [
          "priest"
        ],
        "source": "世界书固定NPC条目",
        "actionType": "heal",
        "attribute": "spr",
        "hitType": "vsDC",
        "target": "目标单位或证据载体",
        "range": "近身",
        "mpCost": 12,
        "cooldown": 0,
        "dc": 17,
        "effects": [
          "月根调弦 / S4 / 消耗12法力 / 目标值17精神，短时安抚龙脉或稳定神器共鸣"
        ],
        "desc": "月根调弦 / S4 / 消耗12法力 / 目标值17精神，短时安抚龙脉或稳定神器共鸣"
      }
    ]
  },
  {
    "id": "npc-bas",
    "name": "巴丝",
    "fullName": "巴丝",
    "type": "NPC登记",
    "race": "矮人",
    "raceId": "dwarf",
    "gender": "女",
    "age": "28岁",
    "affiliation": "铜桥旧桥底、风暴旧门、桥头修缮棚",
    "identity": "铜桥城旧桥修缮匠，风暴旧门铆钉记录人",
    "classId": "artificer",
    "profession": "铜桥城旧桥修缮匠",
    "avatarUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E5%B7%B4%E4%B8%9D%E5%A4%B4%E5%83%8F.png",
    "portraitUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E5%B7%B4%E4%B8%9D%E7%AB%8B%E7%BB%98.png",
    "stats": {
      "hp": 42,
      "maxHp": 42,
      "mp": 4,
      "maxMp": 4,
      "ac": 12,
      "str": 10,
      "dex": 3,
      "vit": 8,
      "int": 7,
      "spr": 1,
      "level": 8,
      "proficiency": 2,
      "initiative": 0
    },
    "experience": 0,
    "nextLevelExperience": 800,
    "availableAttributePoints": 0,
    "favorability": 0,
    "relationshipStage": "陌生",
    "equipmentIds": [],
    "equipmentLoadout": {},
    "activeSkillIds": [
      "npc-bas-skill-1"
    ],
    "knownSkillIds": [
      "npc-bas-skill-1"
    ],
    "attributes": [
      "牵系：旧桥铆钉、风暴门裂痕、河潮刻度、桥底工账",
      "能力：豁免力量/智力; 技能S3修桥/S2铆钉/S2结构/S1工坊谈判; 攻击铆钉锤 +5 vs 护甲, 1d8+2钝击; 扳手卡足 目标值12敏捷, 目标速度下降; 技能模板旧桥听裂 / S3 / 消耗2法力 / 目标值13智力，判断风暴旧门与铜桥铆钉同源; 特性旧桥底维修权; 熟悉桥底工账; 可进入风暴门外围维修道",
      "剧情：线索旧桥铆钉、风暴门裂痕、河潮刻度、桥底工账; 主线锁桥体未加固或没有工坊担保时，不带人进旧桥底层"
    ],
    "skills": [
      {
        "id": "npc-bas-skill-1",
        "name": "旧桥听裂",
        "rank": "S3",
        "sourceClasses": [
          "artificer"
        ],
        "source": "世界书固定NPC条目",
        "actionType": "utility",
        "attribute": "int",
        "hitType": "vsDC",
        "target": "目标单位或证据载体",
        "range": "近身",
        "mpCost": 2,
        "cooldown": 0,
        "dc": 13,
        "effects": [
          "旧桥听裂 / S3 / 消耗2法力 / 目标值13智力，判断风暴旧门与铜桥铆钉同源"
        ],
        "desc": "旧桥听裂 / S3 / 消耗2法力 / 目标值13智力，判断风暴旧门与铜桥铆钉同源"
      }
    ]
  },
  {
    "id": "npc-elian",
    "name": "埃利安",
    "fullName": "埃利安",
    "type": "NPC登记",
    "race": "半精灵",
    "raceId": "half-elf",
    "gender": "男",
    "age": "30岁",
    "affiliation": "极光修道院抄灯室、北窗长廊、极光祈灯台",
    "identity": "极光修道院抄灯修士，北窗长廊灯录人",
    "classId": "priest",
    "profession": "极光修道院抄灯修士",
    "avatarUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E5%9F%83%E5%88%A9%E5%AE%89%E5%A4%B4%E5%83%8F.png",
    "portraitUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E5%9F%83%E5%88%A9%E5%AE%89%E7%AB%8B%E7%BB%98.png",
    "stats": {
      "hp": 30,
      "maxHp": 30,
      "mp": 34,
      "maxMp": 34,
      "ac": 11,
      "str": 1,
      "dex": 3,
      "vit": 4,
      "int": 8,
      "spr": 15,
      "level": 9,
      "proficiency": 3,
      "initiative": 0
    },
    "experience": 0,
    "nextLevelExperience": 900,
    "availableAttributePoints": 0,
    "favorability": 0,
    "relationshipStage": "陌生",
    "equipmentIds": [],
    "equipmentLoadout": {},
    "activeSkillIds": [
      "npc-elian-skill-1"
    ],
    "knownSkillIds": [
      "npc-elian-skill-1"
    ],
    "attributes": [
      "牵系：抄灯册、北窗光纹、极光祈灯、圣都旧光差",
      "能力：豁免精神/智力; 技能S3抄灯/S3神学/S2光纹/S2书写; 攻击抄灯杆 +4 vs 护甲, 1d6钝击; 极光余烁 目标值14精神, 目标短暂恍惚; 技能模板北窗照抄 / S3 / 消耗4法力 / 目标值14精神，复原极光色带残抄; 特性极光修道院抄灯权; 可读取北窗光纹; 熟悉圣都旧光差",
      "剧情：线索抄灯册、北窗光纹、极光祈灯、圣都旧光差; 主线锁未完成静默祷时，不允许外人翻动北窗长廊原册"
    ],
    "skills": [
      {
        "id": "npc-elian-skill-1",
        "name": "北窗照抄",
        "rank": "S3",
        "sourceClasses": [
          "priest"
        ],
        "source": "世界书固定NPC条目",
        "actionType": "utility",
        "attribute": "spr",
        "hitType": "vsDC",
        "target": "目标单位或证据载体",
        "range": "近身",
        "mpCost": 4,
        "cooldown": 0,
        "dc": 14,
        "effects": [
          "北窗照抄 / S3 / 消耗4法力 / 目标值14精神，复原极光色带残抄"
        ],
        "desc": "北窗照抄 / S3 / 消耗4法力 / 目标值14精神，复原极光色带残抄"
      }
    ]
  },
  {
    "id": "npc-melissa",
    "name": "梅莉莎",
    "fullName": "梅莉莎",
    "type": "NPC登记",
    "race": "精灵",
    "raceId": "elf",
    "gender": "女",
    "age": "29岁",
    "affiliation": "阶梯药圃、南药草关、雾药城温棚",
    "identity": "雾药城阶梯药圃师，南药草关批次核验人",
    "classId": "alchemist",
    "profession": "雾药城阶梯药圃师",
    "avatarUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E6%A2%85%E8%8E%89%E8%8E%8E%E5%A4%B4%E5%83%8F.png",
    "portraitUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E6%A2%85%E8%8E%89%E8%8E%8E%E7%AB%8B%E7%BB%98.png",
    "stats": {
      "hp": 30,
      "maxHp": 30,
      "mp": 36,
      "maxMp": 36,
      "ac": 11,
      "str": 1,
      "dex": 4,
      "vit": 3,
      "int": 15,
      "spr": 10,
      "level": 10,
      "proficiency": 3,
      "initiative": 1
    },
    "experience": 0,
    "nextLevelExperience": 1000,
    "availableAttributePoints": 0,
    "favorability": 0,
    "relationshipStage": "陌生",
    "equipmentIds": [],
    "equipmentLoadout": {},
    "activeSkillIds": [
      "npc-melissa-skill-1"
    ],
    "knownSkillIds": [
      "npc-melissa-skill-1"
    ],
    "attributes": [
      "牵系：药草批次牌、雾露瓶、边境催药信、病历药粉页",
      "能力：豁免智力/精神; 技能S3药草/S3病理/S2交易/S2气味辨识; 攻击药圃剪 +4 vs 护甲, 1d4穿刺; 催眠花粉 目标值14体质, 目标困倦; 技能模板批次追根 / S3 / 消耗4法力 / 目标值14智力，追踪药草批次与病历来源; 特性阶梯药圃调货权; 熟悉南药草关封条; 能稳定药草污染",
      "剧情：线索药草批次、南药草关封条、病历药草来源; 主线锁若调查会导致药圃被封，她会要求先保护工人和种苗"
    ],
    "skills": [
      {
        "id": "npc-melissa-skill-1",
        "name": "批次追根",
        "rank": "S3",
        "sourceClasses": [
          "alchemist"
        ],
        "source": "世界书固定NPC条目",
        "actionType": "utility",
        "attribute": "int",
        "hitType": "vsDC",
        "target": "目标单位或证据载体",
        "range": "近身",
        "mpCost": 4,
        "cooldown": 0,
        "dc": 14,
        "effects": [
          "批次追根 / S3 / 消耗4法力 / 目标值14智力，追踪药草批次与病历来源"
        ],
        "desc": "批次追根 / S3 / 消耗4法力 / 目标值14智力，追踪药草批次与病历来源"
      }
    ]
  },
  {
    "id": "npc-rowan",
    "name": "罗薇",
    "fullName": "罗薇",
    "type": "NPC登记",
    "race": "兽裔",
    "raceId": "human",
    "gender": "女",
    "age": "27岁",
    "affiliation": "铁穹驿站马房、北路换蹄棚、驿站饮水槽",
    "identity": "铁穹驿站马房长，北路换蹄棚主事",
    "classId": "ranger",
    "profession": "铁穹驿站马房长",
    "avatarUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E7%BD%97%E8%96%87%E5%A4%B4%E5%83%8F.png",
    "portraitUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E7%BD%97%E8%96%87%E7%AB%8B%E7%BB%98.png",
    "stats": {
      "hp": 34,
      "maxHp": 34,
      "mp": 0,
      "maxMp": 0,
      "ac": 12,
      "str": 7,
      "dex": 7,
      "vit": 6,
      "int": 4,
      "spr": 3,
      "level": 7,
      "proficiency": 2,
      "initiative": 1
    },
    "experience": 0,
    "nextLevelExperience": 700,
    "availableAttributePoints": 0,
    "favorability": 0,
    "relationshipStage": "陌生",
    "equipmentIds": [],
    "equipmentLoadout": {},
    "activeSkillIds": [
      "npc-rowan-skill-1"
    ],
    "knownSkillIds": [
      "npc-rowan-skill-1"
    ],
    "attributes": [
      "牵系：换蹄记录、北路车辙、驿马脾气册、商队迟到栏",
      "能力：豁免体质/敏捷; 技能S2驯马/S2修蹄/S2路线/S1讨价; 攻击马刷柄 +4 vs 护甲, 1d6+1钝击; 缰绳绊足 目标值12敏捷, 目标倒地; 技能模板车辙辨路 / S2 / 无消耗 / 目标值12精神，判断商队迟到和北路异常; 特性铁穹驿站马房管理; 熟悉换蹄棚记录; 可安排低阶驿马",
      "剧情：线索换蹄记录、北路车辙、驿马脾气册、商队迟到栏; 主线锁未付押金或道路封锁时，不放出快马"
    ],
    "skills": [
      {
        "id": "npc-rowan-skill-1",
        "name": "车辙辨路",
        "rank": "S2",
        "sourceClasses": [
          "ranger"
        ],
        "source": "世界书固定NPC条目",
        "actionType": "utility",
        "attribute": "spr",
        "hitType": "vsDC",
        "target": "目标单位或证据载体",
        "range": "近身",
        "mpCost": 0,
        "cooldown": 0,
        "dc": 12,
        "effects": [
          "车辙辨路 / S2 / 无消耗 / 目标值12精神，判断商队迟到和北路异常"
        ],
        "desc": "车辙辨路 / S2 / 无消耗 / 目标值12精神，判断商队迟到和北路异常"
      }
    ]
  },
  {
    "id": "npc-pera",
    "name": "佩拉",
    "fullName": "佩拉",
    "type": "NPC登记",
    "race": "半身人",
    "raceId": "halfling",
    "gender": "女",
    "age": "32岁",
    "affiliation": "七旗议会厅茶水间、临时会议桌、侧门送茶道",
    "identity": "七旗议会厅茶役，临时会议桌看护人",
    "classId": "sage",
    "profession": "七旗议会厅茶役",
    "avatarUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E4%BD%A9%E6%8B%89%E5%A4%B4%E5%83%8F.png",
    "portraitUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E4%BD%A9%E6%8B%89%E7%AB%8B%E7%BB%98.png",
    "stats": {
      "hp": 28,
      "maxHp": 28,
      "mp": 10,
      "maxMp": 10,
      "ac": 11,
      "str": 1,
      "dex": 9,
      "vit": 3,
      "int": 10,
      "spr": 6,
      "level": 8,
      "proficiency": 2,
      "initiative": 2
    },
    "experience": 0,
    "nextLevelExperience": 800,
    "availableAttributePoints": 0,
    "favorability": 0,
    "relationshipStage": "陌生",
    "equipmentIds": [],
    "equipmentLoadout": {},
    "activeSkillIds": [
      "npc-pera-skill-1"
    ],
    "knownSkillIds": [
      "npc-pera-skill-1"
    ],
    "attributes": [
      "牵系：茶渍座次、临时会议杯数、停会铃前后茶单、帕琪空页",
      "能力：豁免敏捷/精神; 技能S3茶单记忆/S2礼法/S2察言观色/S1潜行; 攻击茶盘格挡 +4 vs 护甲, 1d4+2钝击; 滚茶泼洒 目标值12敏捷, 目标分心; 技能模板茶渍座次 / S3 / 消耗3法力 / 目标值13智力，还原临时会议座位和杯数; 特性议会厅茶水间通行; 能记住茶单和座次; 与帕琪空页互证",
      "剧情：线索茶渍座次、临时会议杯数、停会铃前后茶单、帕琪空页; 主线锁若帕琪会被追责，佩拉只在私下且有保护承诺时作证"
    ],
    "skills": [
      {
        "id": "npc-pera-skill-1",
        "name": "茶渍座次",
        "rank": "S3",
        "sourceClasses": [
          "sage"
        ],
        "source": "世界书固定NPC条目",
        "actionType": "utility",
        "attribute": "int",
        "hitType": "vsDC",
        "target": "目标单位或证据载体",
        "range": "近身",
        "mpCost": 3,
        "cooldown": 0,
        "dc": 13,
        "effects": [
          "茶渍座次 / S3 / 消耗3法力 / 目标值13智力，还原临时会议座位和杯数"
        ],
        "desc": "茶渍座次 / S3 / 消耗3法力 / 目标值13智力，还原临时会议座位和杯数"
      }
    ]
  },
  {
    "id": "npc-kohara",
    "name": "小原",
    "fullName": "小原",
    "type": "NPC登记",
    "race": "人类",
    "raceId": "human",
    "gender": "女",
    "age": "24岁",
    "affiliation": "艾尔德雷德",
    "identity": "云游贤者，水系、冰系与治疗魔法大师，魔法协会名誉副会长",
    "classId": "battle-master",
    "profession": "云游贤者",
    "avatarUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E5%B0%8F%E5%8E%9F%E5%A4%B4%E5%83%8F.png",
    "portraitUrl": "https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/%E5%B0%8F%E5%8E%9F%E7%AB%8B%E7%BB%98.png",
    "stats": {
      "hp": 52,
      "maxHp": 52,
      "mp": 96,
      "maxMp": 96,
      "ac": 13,
      "str": 0,
      "dex": 5,
      "vit": 5,
      "int": 20,
      "spr": 19,
      "level": 18,
      "proficiency": 5,
      "initiative": 1
    },
    "experience": 0,
    "nextLevelExperience": 1800,
    "availableAttributePoints": 0,
    "favorability": 0,
    "relationshipStage": "陌生",
    "equipmentIds": [],
    "equipmentLoadout": {},
    "activeSkillIds": [
      "npc-kohara-skill-1",
      "npc-kohara-skill-2"
    ],
    "knownSkillIds": [
      "npc-kohara-skill-1",
      "npc-kohara-skill-2"
    ],
    "attributes": [
      "牵系：魔法协会免费饭票、水镜讲义、冰封病历样本、蓝餐章、旅行甜点袋",
      "剧情：水镜复核异常魔力、冰封病历样本、龙脉热脉降温、协会食堂签账记录"
    ],
    "skills": [
      {
        "id": "npc-kohara-skill-1",
        "name": "原初清泉",
        "rank": "S5",
        "sourceClasses": [
          "battle-master"
        ],
        "source": "世界书固定NPC条目",
        "actionType": "heal",
        "attribute": "int",
        "hitType": "auto",
        "target": "目标单位或证据载体",
        "range": "近身",
        "mpCost": 12,
        "cooldown": 0,
        "effects": [
          "原初清泉 / S5 / 消耗12法力 / 4d6+5治疗并清理中度异常，连续治疗同目标触发冷却与法力压力"
        ],
        "desc": "原初清泉 / S5 / 消耗12法力 / 4d6+5治疗并清理中度异常，连续治疗同目标触发冷却与法力压力"
      },
      {
        "id": "npc-kohara-skill-2",
        "name": "霜镜回廊",
        "rank": "S5",
        "sourceClasses": [
          "battle-master"
        ],
        "source": "世界书固定NPC条目",
        "actionType": "utility",
        "attribute": "int",
        "hitType": "vsDC",
        "target": "目标单位或证据载体",
        "range": "近身",
        "mpCost": 14,
        "cooldown": 0,
        "dc": 18,
        "effects": [
          "霜镜回廊 / S5 / 消耗14法力 / 目标值18智力 / 水冰护幕维持3轮，压制火焰、热脉、越界接触和小型魔法暴走"
        ],
        "desc": "霜镜回廊 / S5 / 消耗14法力 / 目标值18智力 / 水冰护幕维持3轮，压制火焰、热脉、越界接触和小型魔法暴走"
      }
    ]
  }
] as Character[];

export const eldredFixedNpcByName = new Map(
  eldredFixedNpcRegistry.flatMap(npc => [
    [npc.name, npc] as const,
    [npc.fullName, npc] as const,
    ...npc.fullName.split(/[·\s]+/).filter(Boolean).map(part => [part, npc] as const),
  ]),
);

export const findEldredFixedNpc = (name: string) => {
  const normalized = String(name || '').trim();
  if (!normalized) return undefined;
  return eldredFixedNpcByName.get(normalized)
    || eldredFixedNpcRegistry.find(npc => normalized.includes(npc.name) || npc.fullName.includes(normalized));
};

export const fixedNpcSkillRegistry = eldredFixedNpcRegistry.flatMap(npc => npc.skills) as Skill[];
