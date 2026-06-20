import './index.css';

(() => {
  const BUILD_ID = 'eldred-welcome-v3.3.2';
  const HOST_ID = globalThis.__ELDRED_WELCOME_HOST_ID__ || new URLSearchParams(window.location.search).get('hostId') || '';
  const MAP_BASE = globalThis.__ELDRED_MAP_BASE__ || new URL('../maps/', window.location.href).toString();

  const chapters = [
    { id: 'cover', title: '封面', tag: 'PRESS START' },
    { id: 'author', title: '作者寄语', tag: 'LETTER' },
    { id: 'world', title: '世界简介', tag: 'WORLD MAP' },
    { id: 'factions', title: '势力简介', tag: 'FACTIONS' },
    { id: 'story', title: '故事背景', tag: 'PROLOGUE' },
    { id: 'setup', title: '开局设置', tag: 'CHARACTER' },
  ];

  const regions = [
    {
      id: 'elinsea',
      name: '艾琳西亚',
      title: '神圣王国',
      map: 'eldred-map-elinsea-v1.png',
      risk: '低至中',
      tone: '城门、文书、教会与王都秩序',
      start: '黎明城墙白冠西门',
      services: '通行登记 / 旅店 / 行会窗口 / 教会救济',
      hooks: ['缺少路引', '行会试用委托', '白冠城外市集传闻'],
      x: 64,
      y: 52,
    },
    {
      id: 'stormland',
      name: '岚之领',
      title: '七城邦与风车港',
      map: 'eldred-map-stormland-v1.png',
      risk: '中',
      tone: '商路、码头、债单与海风',
      start: '风车港城外码头',
      services: '船运 / 商会 / 酒馆委托 / 走私传闻',
      hooks: ['错名货单', '失踪船员', '商队护送'],
      x: 31,
      y: 47,
    },
    {
      id: 'forbidden',
      name: '禁忌之地',
      title: '灰雾边境',
      map: 'eldred-map-forbidden-v1.png',
      risk: '高',
      tone: '营地、封存物、伤员与雾潮',
      start: '灰雾边境营地',
      services: '巡防 / 救治 / 禁物封存 / 前线补给',
      hooks: ['夜间警铃', '伤员名单', '遗物封箱'],
      x: 50,
      y: 48,
    },
    {
      id: 'aeraya',
      name: '亚雷亚',
      title: '浮空圣都',
      map: 'eldred-map-aeraya-v1.png',
      risk: '中',
      tone: '记录灵、浮空城、空港与古代档案',
      start: '记录灵小厅',
      services: '档案查询 / 空港通行 / 学术鉴定',
      hooks: ['编号异常', '旧档案缺页', '空港临时封锁'],
      x: 42,
      y: 21,
    },
    {
      id: 'neighbors',
      name: '邻国边境',
      title: '霜冠、南境与镜塔',
      map: 'eldred-map-neighbor-realms-v1.png',
      risk: '中至高',
      tone: '异国边贸、佣兵、旧约与远方消息',
      start: '镜塔自由市外环',
      services: '边贸 / 镜塔情报 / 佣兵雇佣 / 过境文书',
      hooks: ['失效通行章', '雇佣告示', '边境线索'],
      x: 72,
      y: 63,
    },
  ];

  const identities = [
    { id: 'traveler', name: '旅行者', stat: '灵巧 +1', note: '行动自由，缺少担保。' },
    { id: 'rookie', name: '见习冒险者', stat: '力量 +1', note: '熟悉行会流程，容易接到试用委托。' },
    { id: 'borderhand', name: '边境杂役', stat: '体魄 +1', note: '懂补给、营地和路上真正缺什么。' },
    { id: 'exile', name: '流亡小贵族', stat: '魅力 +1', note: '懂礼仪，有旧关系，也有旧麻烦。' },
    { id: 'listener', name: '学院旁听生', stat: '学识 +1', note: '能接触鉴定、档案和实验事故。' },
    { id: 'custom', name: '自定义身份', stat: '自由 +1', note: '按玩家填写的角色设计落地。' },
  ];

  const classes = [
    { id: 'blade', name: '剑盾新手', icon: '⚔', role: '前排 / 护卫 / 近战压制', bonus: '力量' },
    { id: 'ranger', name: '巡路猎手', icon: '➶', role: '侦察 / 路线 / 远程支援', bonus: '灵巧' },
    { id: 'scribe', name: '记录学徒', icon: '✦', role: '鉴定 / 调查 / 记录灵接口', bonus: '学识' },
    { id: 'mender', name: '随队医者', icon: '✚', role: '治疗 / 营地 / 状态处理', bonus: '体魄' },
    { id: 'broker', name: '市井掮客', icon: '◆', role: '交易 / 传闻 / 谈判', bonus: '魅力' },
  ];

  const factions = [
    ['白冠王室', '艾琳西亚王都、城墙、文书与骑士秩序。'],
    ['圣辉教会', '救济、审判、净化、旧圣物保管。'],
    ['七城邦商会', '码头、船票、债单、货路与雇佣委托。'],
    ['星砂学院邦', '鉴定、记录灵、魔法实验与学徒事故。'],
    ['灰雾边境军', '巡防营地、禁物封存、雾潮监视。'],
    ['镜塔自由市', '情报、佣兵、边贸与异国过境。'],
  ];

  const storyBeats = [
    ['灰雾回潮', '禁忌黑土边界出现新的雾墙与失踪记录。'],
    ['王都封章', '白冠王都收紧通行，普通旅人也会被卷入盘查。'],
    ['商路异动', '风车港与七城邦的货单、船票和债务开始互相咬合。'],
    ['记录缺页', '亚雷亚的记录灵出现空白编号，旧档案无法完整对齐。'],
  ];

  const state = {
    chapter: 'cover',
    region: regions[0].id,
    identity: identities[0].id,
    classId: classes[0].id,
    level: 1,
    party: '暂时独行',
    submitted: false,
    stats: { 力量: 1, 灵巧: 1, 体魄: 1, 学识: 1, 魅力: 1 },
    fields: {
      name: '{{user}}',
      customPlace: '',
      design: '',
      trouble: '',
      goal: '',
      note: '',
    },
  };

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[char]);
  }

  function chapterIndex() {
    return Math.max(0, chapters.findIndex(item => item.id === state.chapter));
  }

  function selectedRegion() {
    return regions.find(item => item.id === state.region) || regions[0];
  }

  function selectedIdentity() {
    return identities.find(item => item.id === state.identity) || identities[0];
  }

  function selectedClass() {
    return classes.find(item => item.id === state.classId) || classes[0];
  }

  function statPool() {
    const spent = Object.values(state.stats).reduce((sum, value) => sum + Number(value || 0), 0);
    return 9 + (state.level - 1) * 2 - spent;
  }

  function actualPlaceName() {
    const custom = state.fields.customPlace.trim();
    return custom || selectedRegion().start;
  }

  function post(type, payload = {}) {
    try {
      window.parent?.postMessage({ source: 'EldredWelcome', build: BUILD_ID, hostId: HOST_ID, type, ...payload }, '*');
    } catch (error) {}
  }

  function resizeSoon() {
    requestAnimationFrame(() => {
      const height = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0, 720);
      post('resize', { height: height + 12 });
    });
  }

  function move(delta) {
    const next = Math.max(0, Math.min(chapters.length - 1, chapterIndex() + delta));
    state.chapter = chapters[next].id;
    renderHome();
  }

  function buildPrompt() {
    const region = selectedRegion();
    const identity = selectedIdentity();
    const klass = selectedClass();
    const attrs = Object.entries(state.stats).map(([key, value]) => `${key}${value}`).join(' / ');
    return [
      '【艾尔德雷德开局设定】',
      `玩家名: ${state.fields.name.trim() || '{{user}}'}`,
      `开局地区: ${region.name} - ${region.title}`,
      `出生地标: ${actualPlaceName()}`,
      `地区风险: ${region.risk}`,
      `地区服务: ${region.services}`,
      `身份: ${identity.name}`,
      `职业定位: ${klass.name}`,
      `职业职责: ${klass.role}`,
      `等级: ${state.level}`,
      `属性加点: ${attrs}`,
      `同行状态: ${state.party}`,
      `角色设计: ${state.fields.design.trim() || identity.note}`,
      `当前麻烦: ${state.fields.trouble.trim() || region.hooks[0]}`,
      `开局目标: ${state.fields.goal.trim() || '在当前地标取得第一份可执行目标。'}`,
      `补充: ${state.fields.note.trim() || '无'}`,
      '生成要求: 根据以上档案生成第一幕；正文必须使用<content>包裹；同步输出必要MVU变量更新；不得预设玩家隐藏血统或救世身份。',
    ].join('\n');
  }

  function submitToTavernInput(text) {
    const windows = [];
    try { windows.push(window.parent); } catch (error) {}
    try { windows.push(window.top); } catch (error) {}
    try { windows.push(window.opener); } catch (error) {}
    windows.push(window);
    const seen = new Set();
    for (const win of windows) {
      if (!win || seen.has(win)) continue;
      seen.add(win);
      try {
        const doc = win.document;
        if (!doc) continue;
        const selectors = ['#send_textarea', 'textarea#send_textarea', 'textarea[name="text"]', 'textarea'];
        for (const selector of selectors) {
          const candidates = Array.from(doc.querySelectorAll(selector));
          const target = candidates.find(node => {
            const rect = node.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }) || candidates[0];
          if (!target) continue;
          const proto = target instanceof win.HTMLTextAreaElement
            ? win.HTMLTextAreaElement.prototype
            : win.HTMLInputElement?.prototype;
          const setter = proto && Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setter) setter.call(target, text);
          else target.value = text;
          target.dispatchEvent(new win.Event('input', { bubbles: true }));
          target.dispatchEvent(new win.Event('change', { bubbles: true }));
          target.focus();
          return true;
        }
      } catch (error) {}
    }
    return false;
  }

  function submit() {
    const text = buildPrompt();
    const direct = submitToTavernInput(text);
    state.submitted = true;
    post('submit', { text, direct });
    renderHome();
  }

  function randomize() {
    state.region = regions[Math.floor(Math.random() * regions.length)].id;
    state.identity = identities[Math.floor(Math.random() * (identities.length - 1))].id;
    state.classId = classes[Math.floor(Math.random() * classes.length)].id;
    state.level = 1 + Math.floor(Math.random() * 3);
    state.party = ['暂时独行', '可遇伙伴', '已有同行'][Math.floor(Math.random() * 3)];
    state.stats = { 力量: 1, 灵巧: 1, 体魄: 1, 学识: 1, 魅力: 1 };
    let pool = statPool();
    const keys = Object.keys(state.stats);
    while (pool > 0) {
      const key = keys[Math.floor(Math.random() * keys.length)];
      if (state.stats[key] < 5) {
        state.stats[key] += 1;
        pool -= 1;
      }
    }
    state.fields.trouble = selectedRegion().hooks[0];
    renderHome();
  }

  function field(key, label, placeholder, textarea = false) {
    const value = state.fields[key] || '';
    return `
      <label class="ew-field ${textarea ? 'wide' : ''}">
        <span>${label}</span>
        ${textarea
          ? `<textarea data-field="${key}" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`
          : `<input data-field="${key}" value="${esc(value)}" placeholder="${esc(placeholder)}">`}
      </label>`;
  }

  function pixelButton(label, action, extra = '') {
    return `<button class="ew-pixel-btn ${extra}" data-action="${esc(action)}">${label}</button>`;
  }

  function renderShell(inner) {
    const app = document.getElementById('app');
    if (!app) return;
    const chapter = chapters[chapterIndex()];
    app.innerHTML = `
      <main class="eldred-welcome" data-build="${BUILD_ID}">
        <section class="ew-console">
          <div class="ew-console-top">
            <div class="ew-brand">
              <span>ELDRED</span>
              <h1>艾尔德雷德大世界</h1>
            </div>
            <div class="ew-cartridge">${esc(chapter.tag)}</div>
          </div>
          <section class="ew-slide" data-chapter="${esc(chapter.id)}">
            ${inner}
          </section>
          <footer class="ew-command">
            <nav class="ew-chapters">
              ${chapters.map((item, index) => `
                <button class="${item.id === state.chapter ? 'active' : ''}" data-chapter="${item.id}">
                  <span>${String(index + 1).padStart(2, '0')}</span>${esc(item.title)}
                </button>
              `).join('')}
            </nav>
            <div class="ew-controls">
              ${pixelButton('◀ 上一步', 'prev', chapterIndex() === 0 ? 'is-disabled' : '')}
              ${state.chapter === 'setup' ? pixelButton(state.submitted ? '已写入' : '写入开局', 'submit', 'primary') : pixelButton('下一步 ▶', 'next', 'primary')}
            </div>
          </footer>
        </section>
      </main>`;
    bind(app);
    resizeSoon();
  }

  function coverPage() {
    return `
      <div class="ew-cover" style="--cover-map:url('${MAP_BASE}eldred-world-map-base-v1.png')">
        <div class="ew-title-stack">
          <span class="ew-press">PRESS START</span>
          <h2>艾尔德雷德</h2>
          <p>像素冒险 / 西幻大世界 / 自由开局</p>
        </div>
        <div class="ew-save-slots">
          <button data-action="next"><b>NEW GAME</b><small>进入开场章节</small></button>
          <button data-chapter="setup"><b>LOAD SETUP</b><small>直接创建角色</small></button>
        </div>
      </div>`;
  }

  function authorPage() {
    return `
      <div class="ew-two">
        <section class="ew-letter">
          <span>AUTHOR</span>
          <h2>给初入艾尔德雷德的旅人</h2>
          <p>你可以从城门、码头、营地、学院或异国边境开始。</p>
          <p>你可以只是普通旅行者、见习冒险者、边境杂役、旁听生，或一个不愿再使用旧姓氏的人。</p>
          <p>名字会被登记，金币会被花掉，伤口会留下记录，同行者也会记得你做过什么。</p>
        </section>
        <section class="ew-pixel-panel">
          <div class="ew-big-icon">★</div>
          <b>冒险存档 001</b>
          <small>白冠城墙外 / 风车港码头 / 灰雾营地 / 记录灵小厅</small>
        </section>
      </div>`;
  }

  function worldPage() {
    return `
      <div class="ew-map-layout">
        <section class="ew-world-map" style="--world-map:url('${MAP_BASE}eldred-world-map-base-v1.png')">
          ${regions.map(region => `
            <button class="ew-map-pin ${region.id === state.region ? 'active' : ''}" style="left:${region.x}%;top:${region.y}%" data-region="${region.id}">
              <span>${esc(region.name)}</span>
            </button>
          `).join('')}
        </section>
        <section class="ew-region-deck">
          ${regions.map(region => `
            <button class="ew-region-card ${region.id === state.region ? 'selected' : ''}" data-region="${region.id}">
              <b>${esc(region.name)}</b>
              <span>${esc(region.title)}</span>
              <small>${esc(region.tone)}</small>
            </button>
          `).join('')}
        </section>
      </div>`;
  }

  function factionsPage() {
    return `
      <div class="ew-faction-grid">
        ${factions.map(([name, text], index) => `
          <article class="ew-faction">
            <div class="ew-token">${['♜', '✚', '◆', '✦', '⚑', '◇'][index]}</div>
            <b>${esc(name)}</b>
            <p>${esc(text)}</p>
          </article>
        `).join('')}
      </div>`;
  }

  function storyPage() {
    return `
      <div class="ew-story">
        <section class="ew-story-banner">
          <h2>雾潮回卷，旧档缺页，新的旅人抵达边界。</h2>
          <p>城门钟声、港口税单、营地封箱与记录灵缺页同时亮起；第一幕从旅人脚下的地标开始。</p>
        </section>
        <section class="ew-timeline">
          ${storyBeats.map((item, index) => `
            <article>
              <span>${String(index + 1).padStart(2, '0')}</span>
              <b>${esc(item[0])}</b>
              <p>${esc(item[1])}</p>
            </article>
          `).join('')}
        </section>
      </div>`;
  }

  function setupPage() {
    const region = selectedRegion();
    const identity = selectedIdentity();
    const klass = selectedClass();
    return `
      <div class="ew-setup">
        <section class="ew-setup-map">
          <div class="ew-area-map" style="--area-map:url('${MAP_BASE}${region.map}')">
            <div class="ew-location-tag">
              <span>START</span>
              <b>${esc(actualPlaceName())}</b>
              <small>${esc(region.name)} / 风险 ${esc(region.risk)}</small>
            </div>
          </div>
          <div class="ew-hooks">
            ${region.hooks.map(hook => `<button data-trouble="${esc(hook)}">${esc(hook)}</button>`).join('')}
          </div>
        </section>

        <section class="ew-maker">
          <div class="ew-choice-row">
            <header><span>REGION</span><b>地区开场</b></header>
            <div class="ew-choice-grid">
              ${regions.map(item => `<button class="${item.id === state.region ? 'selected' : ''}" data-region="${item.id}">${esc(item.name)}</button>`).join('')}
            </div>
          </div>

          <div class="ew-choice-row">
            <header><span>IDENTITY</span><b>身份</b></header>
            <div class="ew-choice-grid three">
              ${identities.map(item => `
                <button class="${item.id === state.identity ? 'selected' : ''}" data-identity="${item.id}">
                  <b>${esc(item.name)}</b><small>${esc(item.stat)}</small>
                </button>
              `).join('')}
            </div>
          </div>

          <div class="ew-choice-row">
            <header><span>CLASS</span><b>职业定位</b></header>
            <div class="ew-class-grid">
              ${classes.map(item => `
                <button class="${item.id === state.classId ? 'selected' : ''}" data-class="${item.id}">
                  <span>${item.icon}</span><b>${esc(item.name)}</b><small>${esc(item.role)}</small>
                </button>
              `).join('')}
            </div>
          </div>

          <div class="ew-build-grid">
            <section class="ew-level-box">
              <header><span>LEVEL</span><b>等级 ${state.level}</b></header>
              <div class="ew-stepper">
                <button data-action="level-down">-</button>
                <strong>Lv.${state.level}</strong>
                <button data-action="level-up">+</button>
              </div>
              <small>剩余属性点：${statPool()}</small>
            </section>
            <section class="ew-stat-box">
              ${Object.entries(state.stats).map(([key, value]) => `
                <div class="ew-stat">
                  <span>${esc(key)}</span>
                  <button data-stat="${esc(key)}" data-delta="-1">-</button>
                  <b>${value}</b>
                  <button data-stat="${esc(key)}" data-delta="1">+</button>
                </div>
              `).join('')}
            </section>
          </div>

          <section class="ew-form">
            ${field('name', '玩家名', '{{user}}')}
            ${field('customPlace', '出生地标', region.start)}
            ${field('design', '角色外观与性格', `${identity.name}，${klass.name}，${identity.note}`, true)}
            ${field('trouble', '眼前麻烦', region.hooks[0], true)}
            ${field('goal', '第一目标', '通过盘查、接取委托、寻找落脚处、调查传闻等', true)}
            ${field('note', '额外设定', '可写同行者、禁忌、债务、旧识或不希望出现的设定', true)}
          </section>

          <div class="ew-party-row">
            ${['暂时独行', '可遇伙伴', '已有同行'].map(mode => `<button class="${state.party === mode ? 'selected' : ''}" data-party="${mode}">${mode}</button>`).join('')}
            <button data-action="random">随机档案</button>
          </div>

          <section class="ew-character-sheet">
            <header><span>READY</span><b>${esc(state.fields.name.trim() || '{{user}}')} / ${esc(region.name)} / ${esc(klass.name)}</b></header>
            <div>
              <p>${esc(actualPlaceName())}</p>
              <p>${esc(identity.name)} · ${esc(klass.role)} · ${esc(state.party)}</p>
              <p>${esc(Object.entries(state.stats).map(([key, value]) => `${key}${value}`).join(' / '))}</p>
            </div>
          </section>
        </section>
      </div>`;
  }

  function confirmMessagePage(raw) {
    const rows = String(raw || '')
      .split(/\r?\n/)
      .map(line => line.match(/^([^:：]{2,14})[:：]\s*([\s\S]+)$/))
      .filter(Boolean)
      .map(match => [match[1], match[2]])
      .slice(0, 12);
    return `
      <main class="eldred-welcome confirm-only">
        <section class="ew-console">
          <section class="ew-confirm">
            <span>SAVED</span>
            <h2>开局档案已写入输入框</h2>
            <div class="ew-summary">
              ${rows.map(row => `<article><span>${esc(row[0])}</span><b>${esc(row[1])}</b></article>`).join('')}
            </div>
          </section>
        </section>
      </main>`;
  }

  function renderHome() {
    const renderer = {
      cover: coverPage,
      author: authorPage,
      world: worldPage,
      factions: factionsPage,
      story: storyPage,
      setup: setupPage,
    }[state.chapter] || coverPage;
    renderShell(renderer());
  }

  function renderConfirm(raw) {
    const app = document.getElementById('app');
    if (!app) return;
    app.innerHTML = confirmMessagePage(raw);
    resizeSoon();
  }

  function setStat(key, delta) {
    if (!Object.prototype.hasOwnProperty.call(state.stats, key)) return;
    const next = state.stats[key] + delta;
    if (next < 1 || next > 5) return;
    if (delta > 0 && statPool() <= 0) return;
    state.stats[key] = next;
    renderHome();
  }

  function bind(app) {
    if (app.dataset.bound === BUILD_ID) return;
    app.dataset.bound = BUILD_ID;
    app.addEventListener('click', event => {
      const target = event.target;
      const chapter = target.closest?.('[data-chapter]');
      if (chapter) {
        state.chapter = chapter.dataset.chapter;
        renderHome();
        return;
      }
      const region = target.closest?.('[data-region]');
      if (region) {
        state.region = region.dataset.region;
        renderHome();
        return;
      }
      const identity = target.closest?.('[data-identity]');
      if (identity) {
        state.identity = identity.dataset.identity;
        renderHome();
        return;
      }
      const klass = target.closest?.('[data-class]');
      if (klass) {
        state.classId = klass.dataset.class;
        renderHome();
        return;
      }
      const party = target.closest?.('[data-party]');
      if (party) {
        state.party = party.dataset.party;
        renderHome();
        return;
      }
      const trouble = target.closest?.('[data-trouble]');
      if (trouble) {
        state.fields.trouble = trouble.dataset.trouble;
        renderHome();
        return;
      }
      const stat = target.closest?.('[data-stat]');
      if (stat) {
        setStat(stat.dataset.stat, Number(stat.dataset.delta || 0));
        return;
      }
      const action = target.closest?.('[data-action]')?.dataset.action;
      if (action === 'next') move(1);
      if (action === 'prev' && chapterIndex() > 0) move(-1);
      if (action === 'submit') submit();
      if (action === 'random') randomize();
      if (action === 'level-up' && state.level < 3) {
        state.level += 1;
        renderHome();
      }
      if (action === 'level-down' && state.level > 1) {
        const requiredMax = 9 + (state.level - 2) * 2;
        const spent = Object.values(state.stats).reduce((sum, value) => sum + value, 0);
        if (spent <= requiredMax) state.level -= 1;
        renderHome();
      }
    });
    app.addEventListener('input', event => {
      const fieldName = event.target?.dataset?.field;
      if (!fieldName) return;
      state.fields[fieldName] = event.target.value;
      resizeSoon();
    });
  }

  function receive(event) {
    const data = event.data || {};
    if (data.source !== 'EldredWelcomeLoader') return;
    if (data.type === 'render') {
      if (data.mode === 'confirm') renderConfirm(data.raw || '');
      else renderHome();
    }
    if (data.type === 'submitted') {
      state.submitted = !!data.ok;
      renderHome();
    }
  }

  function boot() {
    window.addEventListener('message', receive);
    renderHome();
    post('ready');
    resizeSoon();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
