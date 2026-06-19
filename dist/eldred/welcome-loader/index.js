(() => {
  const BUILD_ID = 'eldred-welcome-loader-v3.2.2';
  const APP_BUILD_ID = 'eldred-welcome-v3.2.2';
  const GLOBAL_KEY = '__eldredWelcomeLoader';
  const WELCOME_HTML = "<!doctype html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<style>\nhtml,\nbody {\n  margin: 0;\n  padding: 0;\n  background: transparent;\n}\n\nbody {\n  color: #f8edcf;\n  font-family: \"Noto Serif SC\", \"Microsoft YaHei UI\", \"Microsoft YaHei\", serif;\n}\n\nbutton,\ninput,\ntextarea {\n  font: inherit;\n  letter-spacing: 0;\n}\n\n.eldred-welcome {\n  --void: #070912;\n  --night: #101827;\n  --blue: #214f7a;\n  --cyan: #43aeb1;\n  --leaf: #6e9a59;\n  --gold: #f0c668;\n  --gold2: #b47a35;\n  --wine: #913f55;\n  --paper: #ead49f;\n  --ink: #24170d;\n  --line: rgba(239, 204, 123, 0.34);\n  --soft: rgba(255, 255, 255, 0.075);\n  --muted: #cfc2a4;\n  width: min(1120px, calc(100vw - 16px));\n  margin: 8px auto;\n  box-sizing: border-box;\n}\n\n.eldred-welcome *,\n.eldred-welcome *::before,\n.eldred-welcome *::after {\n  box-sizing: border-box;\n}\n\n.ew-frame {\n  overflow: hidden;\n  border: 1px solid var(--line);\n  background:\n    radial-gradient(circle at 18% 8%, rgba(67, 174, 177, 0.18), transparent 26%),\n    radial-gradient(circle at 86% 10%, rgba(240, 198, 104, 0.18), transparent 24%),\n    linear-gradient(135deg, rgba(7, 9, 18, 0.98), rgba(19, 28, 48, 0.98) 48%, rgba(53, 36, 62, 0.96));\n  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.38), inset 0 0 0 1px rgba(255, 255, 255, 0.04);\n}\n\n.compact-frame {\n  display: grid;\n  gap: 16px;\n  padding: 20px;\n}\n\n.ew-title {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 18px;\n  padding: 22px 26px 18px;\n  border-bottom: 1px solid var(--line);\n  background: linear-gradient(90deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.025));\n}\n\n.ew-title span,\n.ew-hero span,\n.ew-stage-head span,\n.ew-card span,\n.ew-summary span,\n.ew-preview header span {\n  color: var(--gold);\n  font-size: 12px;\n  font-weight: 900;\n}\n\n.ew-title h1 {\n  margin: 6px 0 0;\n  color: #fff4cc;\n  font-size: 31px;\n  line-height: 1.05;\n}\n\n.ew-title p {\n  margin: 6px 0 0;\n  color: var(--muted);\n  font-size: 13px;\n  font-weight: 800;\n}\n\n.ew-seal {\n  width: 62px;\n  height: 62px;\n  display: grid;\n  place-items: center;\n  flex: 0 0 auto;\n  color: #2b1608;\n  font-size: 30px;\n  font-weight: 1000;\n  background: linear-gradient(135deg, #fff1af, var(--gold) 52%, #9f6728);\n  clip-path: polygon(50% 0, 91% 24%, 91% 75%, 50% 100%, 9% 75%, 9% 24%);\n  box-shadow: 0 0 0 8px rgba(240, 198, 104, 0.12);\n}\n\n.ew-board {\n  display: grid;\n  grid-template-columns: 252px minmax(0, 1fr);\n  min-height: 700px;\n}\n\n.ew-side {\n  display: grid;\n  grid-template-rows: auto 1fr auto;\n  gap: 16px;\n  padding: 18px;\n  border-right: 1px solid var(--line);\n  background:\n    linear-gradient(180deg, rgba(4, 8, 16, 0.86), rgba(19, 30, 47, 0.76)),\n    linear-gradient(90deg, rgba(240, 198, 104, 0.08), transparent);\n}\n\n.ew-side-card,\n.ew-info-grid article,\n.ew-card,\n.ew-preview,\n.ew-summary div,\n.ew-map {\n  border: 1px solid rgba(239, 204, 123, 0.22);\n  background: var(--soft);\n  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);\n}\n\n.ew-side-card {\n  padding: 13px;\n}\n\n.ew-side-card b,\n.ew-info-grid b,\n.ew-card b,\n.ew-preview b {\n  color: #fff4cc;\n}\n\n.ew-side-card p,\n.ew-info-grid p,\n.ew-card p,\n.ew-card small,\n.ew-hero p {\n  color: var(--muted);\n  line-height: 1.65;\n}\n\n.ew-side-card p,\n.ew-info-grid p,\n.ew-card p {\n  margin: 7px 0 0;\n  font-size: 13px;\n}\n\n.ew-side-card.compact p {\n  margin-top: 5px;\n  font-size: 12px;\n}\n\n.ew-steps {\n  display: grid;\n  align-content: start;\n  gap: 8px;\n}\n\n.ew-steps button {\n  min-height: 52px;\n  display: grid;\n  grid-template-columns: 34px minmax(0, 1fr);\n  grid-template-rows: auto auto;\n  align-items: center;\n  gap: 1px 9px;\n  padding: 8px 10px;\n  border: 1px solid rgba(239, 204, 123, 0.18);\n  background: rgba(255, 255, 255, 0.055);\n  color: #f6e6bd;\n  text-align: left;\n  cursor: pointer;\n}\n\n.ew-steps button span {\n  grid-row: 1 / span 2;\n  color: var(--gold);\n  font-size: 12px;\n  font-weight: 1000;\n}\n\n.ew-steps button strong {\n  color: inherit;\n  font-size: 15px;\n}\n\n.ew-steps button small {\n  color: var(--muted);\n  font-size: 11px;\n}\n\n.ew-steps button.active {\n  background: linear-gradient(135deg, rgba(240, 198, 104, 0.98), rgba(255, 239, 177, 0.94));\n  color: #261505;\n}\n\n.ew-steps button.active span,\n.ew-steps button.active small {\n  color: #67400f;\n}\n\n.ew-stage {\n  min-width: 0;\n  display: grid;\n  grid-template-rows: auto 1fr auto;\n}\n\n.ew-stage-head {\n  display: flex;\n  justify-content: space-between;\n  align-items: flex-start;\n  gap: 16px;\n  padding: 18px 22px 14px;\n  border-bottom: 1px solid var(--line);\n}\n\n.ew-stage-head h2 {\n  margin: 5px 0 0;\n  color: #fff4cc;\n  font-size: 28px;\n  line-height: 1.12;\n}\n\n.ew-fast,\n.ew-footer > div,\n.ew-tone-row {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 8px;\n  justify-content: flex-end;\n}\n\n.ew-fast button,\n.ew-footer button,\n.ew-tone-row button {\n  min-height: 34px;\n  padding: 0 12px;\n  border: 1px solid rgba(239, 204, 123, 0.22);\n  background: rgba(255, 255, 255, 0.06);\n  color: #f6e6bd;\n  font-weight: 900;\n  cursor: pointer;\n}\n\n.ew-footer button[disabled] {\n  opacity: 0.42;\n  cursor: default;\n}\n\n.ew-fast button:hover,\n.ew-footer button:not([disabled]):hover,\n.ew-tone-row button:hover,\n.ew-card:hover,\n.ew-node:hover {\n  border-color: rgba(67, 174, 177, 0.78);\n  box-shadow: 0 0 0 3px rgba(67, 174, 177, 0.1);\n}\n\n.ew-content {\n  padding: 20px 22px;\n}\n\n.ew-stack {\n  display: grid;\n  gap: 16px;\n}\n\n.ew-hero {\n  min-height: 260px;\n  display: grid;\n  grid-template-columns: minmax(0, 1.25fr) minmax(260px, 0.75fr);\n  gap: 20px;\n  overflow: hidden;\n  border: 1px solid rgba(239, 204, 123, 0.24);\n  background:\n    linear-gradient(135deg, rgba(16, 25, 43, 0.9), rgba(42, 50, 81, 0.7)),\n    radial-gradient(circle at 72% 22%, rgba(67, 174, 177, 0.18), transparent 28%);\n}\n\n.ew-hero > div:first-child {\n  padding: 26px;\n}\n\n.ew-hero h3 {\n  margin: 12px 0;\n  color: #fff6d2;\n  font-size: 35px;\n  line-height: 1.12;\n}\n\n.ew-orbit {\n  position: relative;\n  min-height: 235px;\n  margin: 18px 18px 18px 0;\n  border: 1px solid rgba(239, 204, 123, 0.28);\n  background:\n    linear-gradient(135deg, rgba(240, 198, 104, 0.12), rgba(67, 174, 177, 0.08)),\n    repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.065) 0 1px, transparent 1px 34px),\n    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.05) 0 1px, transparent 1px 34px);\n}\n\n.ew-orbit i {\n  position: absolute;\n  width: 14px;\n  height: 14px;\n  border-radius: 50%;\n  background: var(--gold);\n  box-shadow: 0 0 20px rgba(240, 198, 104, 0.55);\n}\n\n.ew-orbit i:nth-child(1) { left: 20%; top: 24%; }\n.ew-orbit i:nth-child(2) { left: 64%; top: 30%; background: var(--cyan); }\n.ew-orbit i:nth-child(3) { left: 48%; top: 62%; background: var(--leaf); }\n.ew-orbit i:nth-child(4) { left: 76%; top: 72%; background: var(--wine); }\n\n.ew-orbit strong {\n  position: absolute;\n  left: 22px;\n  right: 22px;\n  bottom: 20px;\n  color: #fff6d2;\n  font-size: 18px;\n}\n\n.ew-info-grid,\n.ew-card-grid,\n.ew-summary {\n  display: grid;\n  gap: 14px;\n}\n\n.ew-info-grid {\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n}\n\n.ew-info-grid article {\n  padding: 15px;\n}\n\n.ew-card-grid {\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n}\n\n.ew-card-grid.three {\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n}\n\n.ew-card {\n  min-height: 132px;\n  display: grid;\n  align-content: start;\n  gap: 9px;\n  padding: 15px;\n  cursor: pointer;\n}\n\n.ew-card div {\n  display: flex;\n  justify-content: space-between;\n  gap: 10px;\n}\n\n.ew-card small {\n  font-size: 12px;\n}\n\n.ew-card.selected,\n.ew-tone-row button.selected {\n  border-color: rgba(67, 174, 177, 0.78);\n  background: linear-gradient(135deg, rgba(67, 174, 177, 0.16), rgba(240, 198, 104, 0.08));\n}\n\n.ew-map {\n  position: relative;\n  min-height: 268px;\n  overflow: hidden;\n  background:\n    radial-gradient(circle at 50% 50%, rgba(67, 174, 177, 0.13), transparent 44%),\n    linear-gradient(135deg, rgba(11, 18, 31, 0.84), rgba(35, 49, 73, 0.6));\n}\n\n.ew-map::before {\n  content: \"\";\n  position: absolute;\n  inset: 40px 70px;\n  border: 1px dashed rgba(240, 198, 104, 0.36);\n  transform: skew(-10deg);\n}\n\n.ew-node {\n  position: absolute;\n  width: 190px;\n  min-height: 64px;\n  display: grid;\n  gap: 3px;\n  padding: 10px 12px;\n  border: 1px solid rgba(239, 204, 123, 0.22);\n  background: rgba(5, 8, 15, 0.76);\n  color: #fff4cc;\n  text-align: left;\n  cursor: pointer;\n}\n\n.ew-node span {\n  color: var(--muted);\n  font-size: 12px;\n}\n\n.ew-node.selected {\n  border-color: rgba(240, 198, 104, 0.84);\n  background: linear-gradient(135deg, rgba(240, 198, 104, 0.95), rgba(255, 239, 177, 0.9));\n  color: #251405;\n}\n\n.ew-node.selected span {\n  color: #67400f;\n}\n\n.n1 { left: 7%; top: 16%; }\n.n2 { right: 12%; top: 18%; }\n.n3 { left: 37%; top: 42%; }\n.n4 { left: 13%; bottom: 14%; }\n.n5 { right: 8%; bottom: 13%; }\n\n.ew-form {\n  display: grid;\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  gap: 14px;\n}\n\n.ew-field {\n  display: grid;\n  gap: 7px;\n}\n\n.ew-field.wide {\n  grid-column: 1 / -1;\n}\n\n.ew-field span {\n  color: #ecdcb6;\n  font-size: 12px;\n  font-weight: 1000;\n}\n\n.ew-field input,\n.ew-field textarea {\n  width: 100%;\n  border: 1px solid rgba(239, 204, 123, 0.25);\n  background: rgba(0, 0, 0, 0.24);\n  color: #fff4d3;\n  padding: 11px 12px;\n  outline: none;\n  line-height: 1.55;\n}\n\n.ew-field textarea {\n  min-height: 104px;\n  resize: vertical;\n}\n\n.ew-field input:focus,\n.ew-field textarea:focus {\n  border-color: rgba(67, 174, 177, 0.76);\n  box-shadow: 0 0 0 3px rgba(67, 174, 177, 0.12);\n}\n\n.ew-summary {\n  grid-template-columns: repeat(4, minmax(0, 1fr));\n}\n\n.ew-summary div {\n  display: grid;\n  gap: 6px;\n  padding: 12px;\n}\n\n.ew-summary b {\n  color: #fff4cc;\n  overflow-wrap: anywhere;\n}\n\n.ew-preview {\n  padding: 16px;\n  background: linear-gradient(180deg, rgba(234, 212, 159, 0.98), rgba(207, 172, 104, 0.96));\n  color: var(--ink);\n}\n\n.ew-preview header {\n  display: flex;\n  justify-content: space-between;\n  gap: 12px;\n  margin-bottom: 10px;\n}\n\n.ew-preview b {\n  color: #5c3816;\n}\n\n.ew-preview pre {\n  margin: 0;\n  white-space: pre-wrap;\n  overflow-wrap: anywhere;\n  color: #302113;\n  font: 13px/1.68 \"Noto Serif SC\", \"Microsoft YaHei\", serif;\n}\n\n.ew-footer {\n  display: flex;\n  justify-content: space-between;\n  gap: 12px;\n  padding: 14px 22px 20px;\n  border-top: 1px solid var(--line);\n}\n\n.ew-footer button.primary {\n  background: linear-gradient(135deg, var(--gold), #fff0ae);\n  color: #251606;\n}\n\n.ew-confirm-banner {\n  padding: 20px;\n  border: 1px solid rgba(239, 204, 123, 0.24);\n  background: rgba(255, 255, 255, 0.075);\n}\n\n.ew-confirm-banner span {\n  color: var(--gold);\n  font-weight: 1000;\n}\n\n.ew-confirm-banner h2 {\n  margin: 8px 0;\n  color: #fff4cc;\n}\n\n.ew-confirm-banner p {\n  margin: 0;\n  color: var(--muted);\n  line-height: 1.7;\n}\n\n@media (max-width: 900px) {\n  .ew-board {\n    grid-template-columns: 1fr;\n  }\n\n  .ew-side {\n    border-right: 0;\n    border-bottom: 1px solid var(--line);\n  }\n\n  .ew-steps {\n    grid-template-columns: repeat(3, minmax(0, 1fr));\n  }\n\n  .ew-hero,\n  .ew-card-grid,\n  .ew-card-grid.three,\n  .ew-info-grid,\n  .ew-form,\n  .ew-summary {\n    grid-template-columns: 1fr;\n  }\n\n  .ew-node {\n    position: relative;\n    left: auto;\n    right: auto;\n    top: auto;\n    bottom: auto;\n    width: auto;\n  }\n\n  .ew-map {\n    display: grid;\n    gap: 10px;\n    padding: 14px;\n  }\n\n  .ew-map::before {\n    display: none;\n  }\n}\n\n@media (max-width: 560px) {\n  .eldred-welcome {\n    width: 100%;\n    margin: 0;\n  }\n\n  .ew-title,\n  .ew-stage-head,\n  .ew-footer {\n    display: grid;\n  }\n\n  .ew-content,\n  .ew-title,\n  .ew-stage-head,\n  .ew-footer,\n  .ew-side {\n    padding-left: 14px;\n    padding-right: 14px;\n  }\n\n  .ew-steps {\n    grid-template-columns: 1fr;\n  }\n\n  .ew-hero h3 {\n    font-size: 27px;\n  }\n}\n\n</style>\n</head>\n<body>\n  <div id=\"app\"></div>\n\n<script type=\"module\">\n(() => {\n  const BUILD_ID = 'eldred-welcome-v3.2.2';\n  const HOST_ID = globalThis.__ELDRED_WELCOME_HOST_ID__ || new URLSearchParams(window.location.search).get('hostId') || '';\n\n  const pages = [\n    { id: 'cover', title: '卷首', sub: '世界入口' },\n    { id: 'origin', title: '出生点', sub: '第一幕落点' },\n    { id: 'identity', title: '身份', sub: '角色模板' },\n    { id: 'dossier', title: '档案', sub: '玩家设定' },\n    { id: 'party', title: '同行', sub: '队伍边界' },\n    { id: 'confirm', title: '确认', sub: '开局指令' },\n  ];\n\n  const places = [\n    {\n      id: '黎明城墙白冠西门',\n      region: '神圣王国艾琳西亚',\n      risk: '低',\n      service: '城门登记 / 临时通行证 / 旅店询问',\n      mood: '体制内盘查',\n      hook: '第一场麻烦通常不是魔物，而是解释自己为什么没有像样文书。',\n    },\n    {\n      id: '风车港城外码头',\n      region: '岚之领七城邦',\n      risk: '中',\n      service: '船运 / 商队 / 行会委托',\n      mood: '海风与账单',\n      hook: '一张写错名字的货单，可能比贵族请柬更快把人卷进故事。',\n    },\n    {\n      id: '灰雾边境营地',\n      region: '禁忌之地边缘',\n      risk: '高',\n      service: '巡防 / 救治 / 禁物封存',\n      mood: '边境危机',\n      hook: '帐篷外的泥很新，伤员也很新，没人有空把麻烦说得体面。',\n    },\n    {\n      id: '星砂学院邮驿站',\n      region: '星砂学院邦',\n      risk: '低',\n      service: '邮驿 / 鉴定 / 学徒委托',\n      mood: '实验事故',\n      hook: '驿站永远有寄错的箱子，偶尔箱子还会自己发光。',\n    },\n    {\n      id: '白冠城外市集',\n      region: '艾琳西亚',\n      risk: '中',\n      service: '补给 / 雇佣 / 传闻打听',\n      mood: '市井轻喜剧',\n      hook: '晚饭钱和第一份委托会同时出现，但前者通常更急。',\n    },\n    {\n      id: '自定义出生点',\n      region: '玩家指定',\n      risk: '待定',\n      service: '按设定生成',\n      mood: '自由接入',\n      hook: '写地点、氛围或眼前麻烦即可，世界会把它接进当前规则。',\n    },\n  ];\n\n  const identities = [\n    ['旅行者', '行动自由，但缺少担保，开局要处理落脚、文书和第一份收入。'],\n    ['见习冒险者', '懂一点行会规矩，容易接委托，也容易被老手低估。'],\n    ['边境杂役', '熟悉营地、货车和低价补给，知道路上真正缺什么。'],\n    ['流亡小贵族', '懂礼仪和旧关系，但姓氏可能比钱包更先带来麻烦。'],\n    ['学院旁听生', '有知识入口，容易卷进实验事故、账单和导师的临时差遣。'],\n    ['自定义身份', '只保留玩家填写的身份气质，不预设隐藏血统或救世使命。'],\n  ];\n\n  const partyModes = [\n    ['暂时独行', '第一幕重点落在落脚、盘查、委托入口和本地 NPC 接触。'],\n    ['可遇伙伴', '允许剧情自然出现可同行角色，但不强行入队。'],\n    ['已有同行', '玩家可在角色设计里写明同行者，剧情负责给出合理登场。'],\n  ];\n\n  const tones = ['轻喜剧冒险', '城邦日常', '遗迹探索', '边境危机'];\n\n  const state = {\n    page: 'cover',\n    place: places[0].id,\n    identity: identities[0][0],\n    party: partyModes[0][0],\n    tone: tones[0],\n    submitted: false,\n    fields: {\n      name: '{{user}}',\n      customPlace: '',\n      design: '',\n      trouble: '',\n      goal: '',\n      note: '',\n    },\n  };\n\n  function esc(value) {\n    return String(value ?? '').replace(/[&<>\"']/g, char => ({\n      '&': '&amp;',\n      '<': '&lt;',\n      '>': '&gt;',\n      '\"': '&quot;',\n      \"'\": '&#39;',\n    })[char]);\n  }\n\n  function pageIndex() {\n    return Math.max(0, pages.findIndex(page => page.id === state.page));\n  }\n\n  function currentPage() {\n    return pages[pageIndex()] || pages[0];\n  }\n\n  function selectedPlace() {\n    return places.find(place => place.id === state.place) || places[0];\n  }\n\n  function selectedIdentity() {\n    return identities.find(identity => identity[0] === state.identity) || identities[0];\n  }\n\n  function selectedParty() {\n    return partyModes.find(mode => mode[0] === state.party) || partyModes[0];\n  }\n\n  function actualPlaceName() {\n    const custom = state.fields.customPlace.trim();\n    return state.place === '自定义出生点' && custom ? custom : state.place;\n  }\n\n  function buildPrompt() {\n    const place = selectedPlace();\n    const identity = selectedIdentity();\n    return [\n      '【艾尔德雷德开局设定】',\n      `玩家名: ${state.fields.name.trim() || '{{user}}'}`,\n      `出生点: ${actualPlaceName()}`,\n      `区域倾向: ${place.region}`,\n      `地点服务: ${place.service}`,\n      `地点风险: ${place.risk}`,\n      `开场气质: ${place.mood}`,\n      `角色模板: ${identity[0]}`,\n      `模板边界: ${identity[1]}`,\n      `角色设计: ${state.fields.design.trim() || '默认是纯路人，不预设隐藏身份，由玩家后续补充。'}`,\n      `当前麻烦: ${state.fields.trouble.trim() || place.hook}`,\n      `开局目标: ${state.fields.goal.trim() || '先进入当前地点的日常秩序，获得第一个可行动目标。'}`,\n      `同行预案: ${state.party}`,\n      `开局节奏: ${state.tone}`,\n      `补充说明: ${state.fields.note.trim() || '无'}`,\n      '生成要求: 根据以上角色设计和出生点自行设计第一幕剧情；不要使用固定开场白；输出必须遵守艾尔德雷德预设格式，正文使用<content>包裹，变量按MVU规则更新。',\n    ].join('\\n');\n  }\n\n  function post(type, payload = {}) {\n    try {\n      window.parent?.postMessage({ source: 'EldredWelcome', build: BUILD_ID, hostId: HOST_ID, type, ...payload }, '*');\n    } catch (error) {}\n  }\n\n  function resizeSoon() {\n    requestAnimationFrame(() => {\n      const height = Math.max(\n        document.documentElement.scrollHeight,\n        document.body?.scrollHeight || 0,\n        640,\n      );\n      post('resize', { height: height + 12 });\n    });\n  }\n\n  function move(delta) {\n    const next = Math.max(0, Math.min(pages.length - 1, pageIndex() + delta));\n    state.page = pages[next].id;\n    renderHome();\n  }\n\n  function fillSample() {\n    state.page = 'confirm';\n    state.place = places[0].id;\n    state.identity = identities[0][0];\n    state.party = partyModes[0][0];\n    state.tone = tones[0];\n    state.fields = {\n      name: '{{user}}',\n      customPlace: '',\n      design: '看起来只是普通旅行者，背着磨旧的包，语气乐观，钱袋不算充足。',\n      trouble: '没有能立刻证明身份的路引，但想进城找落脚处和第一份委托。',\n      goal: '通过盘查，进入艾琳西亚，找到今晚能睡觉且不会太贵的地方。',\n      note: '不要预设隐藏身份，玩家会在后续自己补充真实来历。',\n    };\n    renderHome();\n  }\n\n  function reset() {\n    state.page = 'cover';\n    state.place = places[0].id;\n    state.identity = identities[0][0];\n    state.party = partyModes[0][0];\n    state.tone = tones[0];\n    state.submitted = false;\n    state.fields = { name: '{{user}}', customPlace: '', design: '', trouble: '', goal: '', note: '' };\n    renderHome();\n  }\n\n  function submit() {\n    state.submitted = true;\n    post('submit', { text: buildPrompt() });\n    renderHome();\n  }\n\n  function field(key, label, placeholder, textarea = false) {\n    const value = state.fields[key] || '';\n    return `\n      <label class=\"ew-field ${textarea ? 'wide' : ''}\">\n        <span>${label}</span>\n        ${textarea\n          ? `<textarea data-field=\"${key}\" placeholder=\"${esc(placeholder)}\">${esc(value)}</textarea>`\n          : `<input data-field=\"${key}\" value=\"${esc(value)}\" placeholder=\"${esc(placeholder)}\">`}\n      </label>`;\n  }\n\n  function renderShell(inner) {\n    const app = document.getElementById('app');\n    if (!app) return;\n    const place = selectedPlace();\n    const page = currentPage();\n    app.innerHTML = `\n      <main class=\"eldred-welcome\" data-build=\"${BUILD_ID}\">\n        <section class=\"ew-frame\">\n          <header class=\"ew-title\">\n            <div>\n              <span>ELDRED KINGDOM DOSSIER</span>\n              <h1>艾尔德雷德大世界</h1>\n              <p>自由开局控制台 / 多阶段角色接入</p>\n            </div>\n            <div class=\"ew-seal\">E</div>\n          </header>\n\n          <section class=\"ew-board\">\n            <aside class=\"ew-side\">\n              <div class=\"ew-side-card\">\n                <b>制作与边界</b>\n                <p>开场只负责收集玩家设计、出生点与第一幕方向，不预设救世身份，不写固定开场白。</p>\n              </div>\n              <nav class=\"ew-steps\">\n                ${pages.map((item, index) => `\n                  <button class=\"${state.page === item.id ? 'active' : ''}\" data-page=\"${item.id}\">\n                    <span>${String(index + 1).padStart(2, '0')}</span>\n                    <strong>${item.title}</strong>\n                    <small>${item.sub}</small>\n                  </button>\n                `).join('')}\n              </nav>\n              <div class=\"ew-side-card compact\">\n                <b>${esc(actualPlaceName())}</b>\n                <p>${esc(place.region)} / 风险 ${esc(place.risk)} / ${esc(state.tone)}</p>\n              </div>\n            </aside>\n\n            <section class=\"ew-stage\">\n              <header class=\"ew-stage-head\">\n                <div>\n                  <span>${esc(page.sub)} / ${esc(place.mood)}</span>\n                  <h2>${esc(page.title)}</h2>\n                </div>\n                <div class=\"ew-fast\">\n                  <button data-page=\"origin\">地点</button>\n                  <button data-page=\"dossier\">档案</button>\n                  <button data-page=\"confirm\">预览</button>\n                </div>\n              </header>\n              <section class=\"ew-content\">${inner}</section>\n              <footer class=\"ew-footer\">\n                <div>\n                  <button data-action=\"sample\">填入示例</button>\n                  <button data-action=\"reset\">重置</button>\n                </div>\n                <div>\n                  <button data-action=\"prev\" ${pageIndex() === 0 ? 'disabled' : ''}>上一步</button>\n                  <button data-action=\"next\" ${pageIndex() === pages.length - 1 ? 'disabled' : ''}>下一步</button>\n                  <button class=\"primary\" data-action=\"submit\">${state.submitted ? '已发送' : '发送开局设定'}</button>\n                </div>\n              </footer>\n            </section>\n          </section>\n        </section>\n      </main>`;\n    bind(app);\n    resizeSoon();\n  }\n\n  function coverPage() {\n    return `\n      <div class=\"ew-stack\">\n        <section class=\"ew-hero\">\n          <div>\n            <span>ADVENTURE OPENING</span>\n            <h3>先确定角色从哪里醒来，再让世界按规则回应。</h3>\n            <p>这里不是固定开场白。玩家只需要给出角色设计、出生点和眼前麻烦，艾尔德雷德会从文书、委托、地标服务、NPC职责和当地传闻里生成第一幕。</p>\n          </div>\n          <div class=\"ew-orbit\">\n            <i></i><i></i><i></i><i></i>\n            <strong>${esc(actualPlaceName())}</strong>\n          </div>\n        </section>\n        <section class=\"ew-info-grid\">\n          <article><b>一页一件事</b><p>每一页只处理一个开局维度，避免把所有设定堆在同一屏。</p></article>\n          <article><b>玩家先定调</b><p>身份、麻烦、目标可以很普通，世界负责给出可行动的剧情入口。</p></article>\n          <article><b>首轮动态生成</b><p>新闻、传闻、委托、在场人物与变量由第一幕剧情同步落地。</p></article>\n        </section>\n      </div>`;\n  }\n\n  function originPage() {\n    return `\n      <div class=\"ew-stack\">\n        <section class=\"ew-map\">\n          ${places.slice(0, 5).map((place, index) => `\n            <button class=\"ew-node n${index + 1} ${state.place === place.id ? 'selected' : ''}\" data-place=\"${esc(place.id)}\">\n              <strong>${esc(place.id)}</strong><span>${esc(place.region)}</span>\n            </button>\n          `).join('')}\n        </section>\n        <section class=\"ew-card-grid\">\n          ${places.map(place => `\n            <article class=\"ew-card ${state.place === place.id ? 'selected' : ''}\" data-place=\"${esc(place.id)}\">\n              <div><b>${esc(place.id)}</b><span>${esc(place.mood)}</span></div>\n              <p>${esc(place.hook)}</p>\n              <small>${esc(place.service)} / 风险 ${esc(place.risk)}</small>\n            </article>\n          `).join('')}\n        </section>\n        ${state.place === '自定义出生点' ? field('customPlace', '自定义出生点', '例如：白冠城外一间漏雨旅店') : ''}\n      </div>`;\n  }\n\n  function identityPage() {\n    return `\n      <section class=\"ew-card-grid three\">\n        ${identities.map(identity => `\n          <article class=\"ew-card ${state.identity === identity[0] ? 'selected' : ''}\" data-identity=\"${esc(identity[0])}\">\n            <div><b>${esc(identity[0])}</b><span>身份模板</span></div>\n            <p>${esc(identity[1])}</p>\n          </article>\n        `).join('')}\n      </section>`;\n  }\n\n  function dossierPage() {\n    return `\n      <section class=\"ew-form\">\n        ${field('name', '玩家名', '{{user}}')}\n        ${field('goal', '开局目标', '进城、找委托、寻找某人、躲债、调查传闻等')}\n        ${field('design', '角色设计', '外貌、性格、擅长什么、不擅长什么；保持可被世界验证', true)}\n        ${field('trouble', '当前麻烦', '没有文书、包裹可疑、钱包紧张、被误会、刚从某地逃出来等', true)}\n        ${field('note', '补充说明', '不要预设隐藏身份；玩家后续自己揭示的内容写这里', true)}\n      </section>`;\n  }\n\n  function partyPage() {\n    return `\n      <div class=\"ew-stack\">\n        <section class=\"ew-card-grid three\">\n          ${partyModes.map(mode => `\n            <article class=\"ew-card ${state.party === mode[0] ? 'selected' : ''}\" data-party=\"${esc(mode[0])}\">\n              <div><b>${esc(mode[0])}</b><span>同行边界</span></div>\n              <p>${esc(mode[1])}</p>\n            </article>\n          `).join('')}\n        </section>\n        <section class=\"ew-tone-row\">\n          ${tones.map(tone => `<button class=\"${state.tone === tone ? 'selected' : ''}\" data-tone=\"${esc(tone)}\">${esc(tone)}</button>`).join('')}\n        </section>\n        <section class=\"ew-info-grid\">\n          <article><b>首轮 NPC</b><p>由出生点自然决定。城门开局优先巡逻、登记员、行会窗口和临时委托人。</p></article>\n          <article><b>入队边界</b><p>第一幕可以遇到伙伴，但是否入队必须由剧情关系、条件和后续选择共同决定。</p></article>\n          <article><b>状态反馈</b><p>在场人物、可回访、可入队、关系立场应在变量与状态栏中同步可见。</p></article>\n        </section>\n      </div>`;\n  }\n\n  function confirmPage() {\n    return `\n      <div class=\"ew-stack\">\n        <section class=\"ew-summary\">\n          <div><span>出生点</span><b>${esc(actualPlaceName())}</b></div>\n          <div><span>身份</span><b>${esc(state.identity)}</b></div>\n          <div><span>同行</span><b>${esc(state.party)}</b></div>\n          <div><span>节奏</span><b>${esc(state.tone)}</b></div>\n        </section>\n        <section class=\"ew-preview\">\n          <header><b>将发送给模型的开局设定</b><span>${state.submitted ? '已提交' : '等待确认'}</span></header>\n          <pre>${esc(buildPrompt())}</pre>\n        </section>\n      </div>`;\n  }\n\n  function confirmMessagePage(raw) {\n    const rows = String(raw || '')\n      .split(/\\r?\\n/)\n      .map(line => line.match(/^([^:：]{2,14})[:：]\\s*([\\s\\S]+)$/))\n      .filter(Boolean)\n      .map(match => [match[1], match[2]])\n      .slice(0, 14);\n    return `\n      <main class=\"eldred-welcome confirm-only\">\n        <section class=\"ew-frame compact-frame\">\n          <section class=\"ew-confirm-banner\">\n            <span>已提交</span>\n            <h2>开局设定已写入聊天</h2>\n            <p>下一轮正式回复应根据这份设定生成第一幕剧情，并使用 <content> 与 MVU 变量更新格式。</p>\n          </section>\n          <section class=\"ew-summary\">\n            ${rows.map(row => `<div><span>${esc(row[0])}</span><b>${esc(row[1])}</b></div>`).join('')}\n          </section>\n          <section class=\"ew-preview\"><header><b>设定原文</b></header><pre>${esc(raw)}</pre></section>\n        </section>\n      </main>`;\n  }\n\n  function renderHome() {\n    const renderer = {\n      cover: coverPage,\n      origin: originPage,\n      identity: identityPage,\n      dossier: dossierPage,\n      party: partyPage,\n      confirm: confirmPage,\n    }[state.page] || coverPage;\n    renderShell(renderer());\n  }\n\n  function renderConfirm(raw) {\n    const app = document.getElementById('app');\n    if (!app) return;\n    app.innerHTML = confirmMessagePage(raw);\n    resizeSoon();\n  }\n\n  function bind(app) {\n    if (app.dataset.bound === BUILD_ID) return;\n    app.dataset.bound = BUILD_ID;\n    app.addEventListener('click', event => {\n      const target = event.target;\n      const page = target.closest?.('[data-page]');\n      if (page) {\n        state.page = page.dataset.page;\n        renderHome();\n        return;\n      }\n      const place = target.closest?.('[data-place]');\n      if (place) {\n        state.place = place.dataset.place;\n        renderHome();\n        return;\n      }\n      const identity = target.closest?.('[data-identity]');\n      if (identity) {\n        state.identity = identity.dataset.identity;\n        renderHome();\n        return;\n      }\n      const party = target.closest?.('[data-party]');\n      if (party) {\n        state.party = party.dataset.party;\n        renderHome();\n        return;\n      }\n      const tone = target.closest?.('[data-tone]');\n      if (tone) {\n        state.tone = tone.dataset.tone;\n        renderHome();\n        return;\n      }\n      const action = target.closest?.('[data-action]')?.dataset.action;\n      if (action === 'sample') fillSample();\n      if (action === 'reset') reset();\n      if (action === 'prev') move(-1);\n      if (action === 'next') move(1);\n      if (action === 'submit') submit();\n    });\n    app.addEventListener('input', event => {\n      const fieldName = event.target?.dataset?.field;\n      if (!fieldName) return;\n      state.fields[fieldName] = event.target.value;\n      if (state.page === 'confirm') renderHome();\n      else resizeSoon();\n    });\n  }\n\n  function receive(event) {\n    const data = event.data || {};\n    if (data.source !== 'EldredWelcomeLoader') return;\n    if (data.type === 'render') {\n      if (data.mode === 'confirm') renderConfirm(data.raw || '');\n      else renderHome();\n    }\n    if (data.type === 'submitted') {\n      state.submitted = !!data.ok;\n      renderHome();\n    }\n  }\n\n  function boot() {\n    window.addEventListener('message', receive);\n    renderHome();\n    post('ready');\n    resizeSoon();\n  }\n\n  if (document.readyState === 'loading') {\n    document.addEventListener('DOMContentLoaded', boot);\n  } else {\n    boot();\n  }\n})();\n\n</script>\n</body>\n</html>\n";
  const HOST_SELECTOR = '[data-eldred-welcome-host="true"]';
  const ORIGINAL_SELECTOR = '[data-eldred-welcome-original="true"]';
  const FRAME_SELECTOR = '[data-eldred-welcome-frame="true"]';
  const HOST_ID_PREFIX = 'eldred-welcome-';
  const timers = new Set();
  const listeners = [];
  let observer = null;
  let stopped = false;

  const previous = globalThis[GLOBAL_KEY];
  if (previous && previous.build === BUILD_ID) return;
  try { previous && previous.unmount && previous.unmount(); } catch (error) {}
  globalThis[GLOBAL_KEY] = { build: BUILD_ID, unmount, scan: renderAll };

  function hostWindow() {
    try {
      if (window.parent && window.parent.document) return window.parent;
    } catch (error) {}
    return window;
  }

  function hostDocument() {
    return hostWindow().document || document;
  }

  function getEvents() {
    try {
      return globalThis.tavern_events || window.parent?.tavern_events || {};
    } catch (error) {
      return {};
    }
  }

  function listen(event, fn) {
    try {
      const on = globalThis.eventOn || window.parent?.eventOn;
      if (event && typeof on === 'function') {
        on(event, fn);
        listeners.push([event, fn]);
      }
    } catch (error) {}
  }

  function schedule(delays = [0, 180, 600]) {
    delays.forEach(delay => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        renderAll();
      }, delay);
      timers.add(timer);
    });
  }

  function messageNodes() {
    const doc = hostDocument();
    const chat = doc.querySelector('#chat');
    const root = chat || doc;
    return Array.from(root.querySelectorAll('.mes'))
      .filter(node => node.querySelector('.mes_text'))
      .slice(-30);
  }

  function bodyOf(node) {
    return node.querySelector('.mes_text') || node;
  }

  function idOf(node) {
    const raw = node.getAttribute('mesid') || node.dataset?.mesid || node.id?.match(/\d+/)?.[0];
    return raw !== undefined && raw !== null ? Number(raw) : -1;
  }

  function rawOf(id, body) {
    const readers = [
      () => typeof getChatMessages === 'function' ? getChatMessages(id)?.[0] : null,
      () => hostWindow() && typeof hostWindow().getChatMessages === 'function' ? hostWindow().getChatMessages(id)?.[0] : null,
      () => globalThis.chat?.[id],
      () => hostWindow().chat?.[id],
    ];
    for (const read of readers) {
      try {
        const message = read();
        const text = message && (message.message || message.mes || message.text || message.content);
        if (typeof text === 'string' && text.trim()) return text;
      } catch (error) {}
    }
    const original = body?.querySelector?.(ORIGINAL_SELECTOR);
    if (original?.textContent?.trim()) return original.textContent;
    return body?.textContent || '';
  }

  function hash(value) {
    const text = String(value || '');
    let result = 0;
    for (let index = 0; index < text.length; index += 1) {
      result = (Math.imul(31, result) + text.charCodeAt(index)) | 0;
    }
    return String(result >>> 0);
  }

  function modeOf(raw) {
    const text = String(raw || '');
    if (/^\s*【艾尔德雷德开局设定】/.test(text)) return 'confirm';
    if (/^\s*(?:<eldred_welcome[^>]*>\s*)?【欢迎词】/.test(text)) return 'home';
    return '';
  }

  function wrap(body) {
    let wrapper = body.querySelector(ORIGINAL_SELECTOR);
    if (wrapper) return wrapper;
    wrapper = hostDocument().createElement('div');
    wrapper.dataset.eldredWelcomeOriginal = 'true';
    wrapper.style.display = 'none';
    while (body.firstChild) wrapper.appendChild(body.firstChild);
    body.appendChild(wrapper);
    return wrapper;
  }

  function restore(body) {
    if (!body) return;
    const root = body.querySelector(HOST_SELECTOR);
    if (root) root.remove();
    const original = body.querySelector(ORIGINAL_SELECTOR);
    if (original) {
      while (original.firstChild) body.insertBefore(original.firstChild, original);
      original.remove();
    }
  }

  function createHost(body) {
    let root = body.querySelector(HOST_SELECTOR);
    if (root) return root;
    root = hostDocument().createElement('div');
    root.dataset.eldredWelcomeHost = 'true';
    root.dataset.hostId = `${HOST_ID_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    root.style.cssText = [
      'display:block',
      'width:100%',
      'max-width:1120px',
      'margin:10px auto',
      'isolation:isolate',
      'position:relative',
      'z-index:0',
    ].join(';');

    const iframe = hostDocument().createElement('iframe');
    iframe.dataset.eldredWelcomeFrame = 'true';
    iframe.title = '艾尔德雷德开局控制台';
    iframe.loading = 'eager';
    iframe.referrerPolicy = 'no-referrer';
    iframe.sandbox = 'allow-scripts allow-forms';
    const hostScript = '<script>window.__ELDRED_WELCOME_HOST_ID__=' + JSON.stringify(root.dataset.hostId) + ';<\\/script>';
    iframe.srcdoc = WELCOME_HTML.replace('</head>', hostScript + '</head>');
    iframe.style.cssText = [
      'display:block',
      'width:100%',
      'height:780px',
      'border:0',
      'background:transparent',
      'overflow:hidden',
    ].join(';');
    iframe.addEventListener('load', () => sendState(root));

    root.appendChild(iframe);
    body.appendChild(root);
    return root;
  }

  function sendState(root) {
    const iframe = root.querySelector(FRAME_SELECTOR);
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage({
      source: 'EldredWelcomeLoader',
      build: BUILD_ID,
      type: 'render',
      mode: root.dataset.mode || 'home',
      raw: root.dataset.raw || '',
    }, '*');
  }

  function renderAll() {
    if (stopped) return;
    messageNodes().forEach(renderOne);
  }

  function renderOne(node) {
    const body = bodyOf(node);
    if (!body) return;
    const raw = rawOf(idOf(node), body);
    const mode = modeOf(raw);
    if (!mode) {
      if (body.querySelector(HOST_SELECTOR)) restore(body);
      return;
    }
    wrap(body);
    const root = createHost(body);
    const key = hash(raw);
    const changed = root.dataset.rawHash !== key || root.dataset.mode !== mode;
    root.dataset.mode = mode;
    root.dataset.raw = raw;
    root.dataset.rawHash = key;
    if (changed) sendState(root);
  }

  function findRootByMessage(event) {
    const doc = hostDocument();
    const hosts = Array.from(doc.querySelectorAll(HOST_SELECTOR));
    const hostId = event.data?.hostId;
    if (hostId) {
      const byId = hosts.find(root => root.dataset.hostId === hostId);
      if (byId) return byId;
    }
    const bySource = hosts.find(root => {
      const iframe = root.querySelector(FRAME_SELECTOR);
      return iframe?.contentWindow === event.source;
    });
    if (bySource) return bySource;
    return hosts.length === 1 ? hosts[0] : null;
  }

  function findSendTextarea() {
    const doc = hostDocument();
    const selectors = ['#send_textarea', 'textarea#send_textarea', 'textarea[name="text"]', 'textarea'];
    for (const selector of selectors) {
      try {
        const nodes = Array.from(doc.querySelectorAll(selector));
        const visible = nodes.find(node => {
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
        if (visible) return visible;
        if (nodes[0]) return nodes[0];
      } catch (error) {}
    }
    return null;
  }

  function setTextareaValue(textarea, text) {
    const win = hostWindow();
    const proto = textarea instanceof win.HTMLTextAreaElement
      ? win.HTMLTextAreaElement.prototype
      : win.HTMLInputElement?.prototype;
    const setter = proto && Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(textarea, text);
    else textarea.value = text;
    textarea.dispatchEvent(new win.Event('input', { bubbles: true }));
    textarea.dispatchEvent(new win.Event('change', { bubbles: true }));
    textarea.focus();
  }

  async function submitPrompt(text) {
    const scopes = [globalThis, window, hostWindow(), window.parent, window.top].filter(Boolean);
    for (const scope of scopes) {
      try {
        if (typeof scope.createChatMessages === 'function') {
          await scope.createChatMessages([{ role: 'user', message: text }]);
          if (typeof scope.triggerSlash === 'function') await scope.triggerSlash('/trigger');
          return true;
        }
      } catch (error) {
        console.warn('[EldredWelcomeLoader] createChatMessages failed', error);
      }
    }
    const textarea = findSendTextarea();
    if (textarea) {
      setTextareaValue(textarea, text);
      return true;
    }
    return false;
  }

  function handleMessage(event) {
    const data = event.data || {};
    if (data.source !== 'EldredWelcome' || data.build !== APP_BUILD_ID) return;
    const root = findRootByMessage(event);
    if (!root) return;
    if (data.type === 'resize') {
      const iframe = root.querySelector(FRAME_SELECTOR);
      const height = Math.max(560, Math.min(2400, Number(data.height) || 780));
      if (iframe) iframe.style.height = `${height}px`;
      return;
    }
    if (data.type === 'submit' && typeof data.text === 'string') {
      submitPrompt(data.text).then(ok => {
        const iframe = root.querySelector(FRAME_SELECTOR);
        iframe?.contentWindow?.postMessage({
          source: 'EldredWelcomeLoader',
          build: BUILD_ID,
          type: 'submitted',
          ok,
        }, '*');
      });
    }
  }

  function bootObserver() {
    const chat = hostDocument().querySelector('#chat');
    if (!chat || typeof MutationObserver !== 'function') return;
    observer = new MutationObserver(() => schedule([120]));
    observer.observe(chat, { childList: true, subtree: true });
  }

  function bootstrap() {
    schedule();
    const events = getEvents();
    [
      'MESSAGE_RECEIVED',
      'MESSAGE_UPDATED',
      'MESSAGE_SWIPED',
      'CHARACTER_MESSAGE_RENDERED',
      'CHAT_CHANGED',
      'MORE_MESSAGES_LOADED',
      'GENERATION_ENDED',
    ].forEach(key => listen(events[key], () => schedule()));
    hostWindow().addEventListener('message', handleMessage);
    bootObserver();
    try { $(window).on('pagehide', unmount); } catch (error) {}
  }

  function unmount() {
    stopped = true;
    timers.forEach(clearTimeout);
    timers.clear();
    observer?.disconnect();
    try { hostWindow().removeEventListener('message', handleMessage); } catch (error) {}
    hostDocument().querySelectorAll(HOST_SELECTOR).forEach(root => restore(root.closest('.mes_text') || root.parentElement));
  }

  if (typeof $ === 'function') $(bootstrap);
  else setTimeout(bootstrap, 200);
})();
