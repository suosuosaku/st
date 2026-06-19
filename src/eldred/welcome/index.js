import './index.css';

(() => {
  const BUILD_ID = 'eldred-welcome-v3.2.1';
  const HOST_ID = new URLSearchParams(window.location.search).get('hostId') || '';

  const pages = [
    { id: 'cover', title: '卷首', sub: '世界入口' },
    { id: 'origin', title: '出生点', sub: '第一幕落点' },
    { id: 'identity', title: '身份', sub: '角色模板' },
    { id: 'dossier', title: '档案', sub: '玩家设定' },
    { id: 'party', title: '同行', sub: '队伍边界' },
    { id: 'confirm', title: '确认', sub: '开局指令' },
  ];

  const places = [
    {
      id: '黎明城墙白冠西门',
      region: '神圣王国艾琳西亚',
      risk: '低',
      service: '城门登记 / 临时通行证 / 旅店询问',
      mood: '体制内盘查',
      hook: '第一场麻烦通常不是魔物，而是解释自己为什么没有像样文书。',
    },
    {
      id: '风车港城外码头',
      region: '岚之领七城邦',
      risk: '中',
      service: '船运 / 商队 / 行会委托',
      mood: '海风与账单',
      hook: '一张写错名字的货单，可能比贵族请柬更快把人卷进故事。',
    },
    {
      id: '灰雾边境营地',
      region: '禁忌之地边缘',
      risk: '高',
      service: '巡防 / 救治 / 禁物封存',
      mood: '边境危机',
      hook: '帐篷外的泥很新，伤员也很新，没人有空把麻烦说得体面。',
    },
    {
      id: '星砂学院邮驿站',
      region: '星砂学院邦',
      risk: '低',
      service: '邮驿 / 鉴定 / 学徒委托',
      mood: '实验事故',
      hook: '驿站永远有寄错的箱子，偶尔箱子还会自己发光。',
    },
    {
      id: '白冠城外市集',
      region: '艾琳西亚',
      risk: '中',
      service: '补给 / 雇佣 / 传闻打听',
      mood: '市井轻喜剧',
      hook: '晚饭钱和第一份委托会同时出现，但前者通常更急。',
    },
    {
      id: '自定义出生点',
      region: '玩家指定',
      risk: '待定',
      service: '按设定生成',
      mood: '自由接入',
      hook: '写地点、氛围或眼前麻烦即可，世界会把它接进当前规则。',
    },
  ];

  const identities = [
    ['旅行者', '行动自由，但缺少担保，开局要处理落脚、文书和第一份收入。'],
    ['见习冒险者', '懂一点行会规矩，容易接委托，也容易被老手低估。'],
    ['边境杂役', '熟悉营地、货车和低价补给，知道路上真正缺什么。'],
    ['流亡小贵族', '懂礼仪和旧关系，但姓氏可能比钱包更先带来麻烦。'],
    ['学院旁听生', '有知识入口，容易卷进实验事故、账单和导师的临时差遣。'],
    ['自定义身份', '只保留玩家填写的身份气质，不预设隐藏血统或救世使命。'],
  ];

  const partyModes = [
    ['暂时独行', '第一幕重点落在落脚、盘查、委托入口和本地 NPC 接触。'],
    ['可遇伙伴', '允许剧情自然出现可同行角色，但不强行入队。'],
    ['已有同行', '玩家可在角色设计里写明同行者，剧情负责给出合理登场。'],
  ];

  const tones = ['轻喜剧冒险', '城邦日常', '遗迹探索', '边境危机'];

  const state = {
    page: 'cover',
    place: places[0].id,
    identity: identities[0][0],
    party: partyModes[0][0],
    tone: tones[0],
    submitted: false,
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

  function pageIndex() {
    return Math.max(0, pages.findIndex(page => page.id === state.page));
  }

  function currentPage() {
    return pages[pageIndex()] || pages[0];
  }

  function selectedPlace() {
    return places.find(place => place.id === state.place) || places[0];
  }

  function selectedIdentity() {
    return identities.find(identity => identity[0] === state.identity) || identities[0];
  }

  function selectedParty() {
    return partyModes.find(mode => mode[0] === state.party) || partyModes[0];
  }

  function actualPlaceName() {
    const custom = state.fields.customPlace.trim();
    return state.place === '自定义出生点' && custom ? custom : state.place;
  }

  function buildPrompt() {
    const place = selectedPlace();
    const identity = selectedIdentity();
    return [
      '【艾尔德雷德开局设定】',
      `玩家名: ${state.fields.name.trim() || '{{user}}'}`,
      `出生点: ${actualPlaceName()}`,
      `区域倾向: ${place.region}`,
      `地点服务: ${place.service}`,
      `地点风险: ${place.risk}`,
      `开场气质: ${place.mood}`,
      `角色模板: ${identity[0]}`,
      `模板边界: ${identity[1]}`,
      `角色设计: ${state.fields.design.trim() || '默认是纯路人，不预设隐藏身份，由玩家后续补充。'}`,
      `当前麻烦: ${state.fields.trouble.trim() || place.hook}`,
      `开局目标: ${state.fields.goal.trim() || '先进入当前地点的日常秩序，获得第一个可行动目标。'}`,
      `同行预案: ${state.party}`,
      `开局节奏: ${state.tone}`,
      `补充说明: ${state.fields.note.trim() || '无'}`,
      '生成要求: 根据以上角色设计和出生点自行设计第一幕剧情；不要使用固定开场白；输出必须遵守艾尔德雷德预设格式，正文使用<content>包裹，变量按MVU规则更新。',
    ].join('\n');
  }

  function post(type, payload = {}) {
    try {
      window.parent?.postMessage({ source: 'EldredWelcome', build: BUILD_ID, hostId: HOST_ID, type, ...payload }, '*');
    } catch (error) {}
  }

  function resizeSoon() {
    requestAnimationFrame(() => {
      const height = Math.max(
        document.documentElement.scrollHeight,
        document.body?.scrollHeight || 0,
        640,
      );
      post('resize', { height: height + 12 });
    });
  }

  function move(delta) {
    const next = Math.max(0, Math.min(pages.length - 1, pageIndex() + delta));
    state.page = pages[next].id;
    renderHome();
  }

  function fillSample() {
    state.page = 'confirm';
    state.place = places[0].id;
    state.identity = identities[0][0];
    state.party = partyModes[0][0];
    state.tone = tones[0];
    state.fields = {
      name: '{{user}}',
      customPlace: '',
      design: '看起来只是普通旅行者，背着磨旧的包，语气乐观，钱袋不算充足。',
      trouble: '没有能立刻证明身份的路引，但想进城找落脚处和第一份委托。',
      goal: '通过盘查，进入艾琳西亚，找到今晚能睡觉且不会太贵的地方。',
      note: '不要预设隐藏身份，玩家会在后续自己补充真实来历。',
    };
    renderHome();
  }

  function reset() {
    state.page = 'cover';
    state.place = places[0].id;
    state.identity = identities[0][0];
    state.party = partyModes[0][0];
    state.tone = tones[0];
    state.submitted = false;
    state.fields = { name: '{{user}}', customPlace: '', design: '', trouble: '', goal: '', note: '' };
    renderHome();
  }

  function submit() {
    state.submitted = true;
    post('submit', { text: buildPrompt() });
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

  function renderShell(inner) {
    const app = document.getElementById('app');
    if (!app) return;
    const place = selectedPlace();
    const page = currentPage();
    app.innerHTML = `
      <main class="eldred-welcome" data-build="${BUILD_ID}">
        <section class="ew-frame">
          <header class="ew-title">
            <div>
              <span>ELDRED KINGDOM DOSSIER</span>
              <h1>艾尔德雷德大世界</h1>
              <p>自由开局控制台 / 多阶段角色接入</p>
            </div>
            <div class="ew-seal">E</div>
          </header>

          <section class="ew-board">
            <aside class="ew-side">
              <div class="ew-side-card">
                <b>制作与边界</b>
                <p>开场只负责收集玩家设计、出生点与第一幕方向，不预设救世身份，不写固定开场白。</p>
              </div>
              <nav class="ew-steps">
                ${pages.map((item, index) => `
                  <button class="${state.page === item.id ? 'active' : ''}" data-page="${item.id}">
                    <span>${String(index + 1).padStart(2, '0')}</span>
                    <strong>${item.title}</strong>
                    <small>${item.sub}</small>
                  </button>
                `).join('')}
              </nav>
              <div class="ew-side-card compact">
                <b>${esc(actualPlaceName())}</b>
                <p>${esc(place.region)} / 风险 ${esc(place.risk)} / ${esc(state.tone)}</p>
              </div>
            </aside>

            <section class="ew-stage">
              <header class="ew-stage-head">
                <div>
                  <span>${esc(page.sub)} / ${esc(place.mood)}</span>
                  <h2>${esc(page.title)}</h2>
                </div>
                <div class="ew-fast">
                  <button data-page="origin">地点</button>
                  <button data-page="dossier">档案</button>
                  <button data-page="confirm">预览</button>
                </div>
              </header>
              <section class="ew-content">${inner}</section>
              <footer class="ew-footer">
                <div>
                  <button data-action="sample">填入示例</button>
                  <button data-action="reset">重置</button>
                </div>
                <div>
                  <button data-action="prev" ${pageIndex() === 0 ? 'disabled' : ''}>上一步</button>
                  <button data-action="next" ${pageIndex() === pages.length - 1 ? 'disabled' : ''}>下一步</button>
                  <button class="primary" data-action="submit">${state.submitted ? '已发送' : '发送开局设定'}</button>
                </div>
              </footer>
            </section>
          </section>
        </section>
      </main>`;
    bind(app);
    resizeSoon();
  }

  function coverPage() {
    return `
      <div class="ew-stack">
        <section class="ew-hero">
          <div>
            <span>ADVENTURE OPENING</span>
            <h3>先确定角色从哪里醒来，再让世界按规则回应。</h3>
            <p>这里不是固定开场白。玩家只需要给出角色设计、出生点和眼前麻烦，艾尔德雷德会从文书、委托、地标服务、NPC职责和当地传闻里生成第一幕。</p>
          </div>
          <div class="ew-orbit">
            <i></i><i></i><i></i><i></i>
            <strong>${esc(actualPlaceName())}</strong>
          </div>
        </section>
        <section class="ew-info-grid">
          <article><b>一页一件事</b><p>每一页只处理一个开局维度，避免把所有设定堆在同一屏。</p></article>
          <article><b>玩家先定调</b><p>身份、麻烦、目标可以很普通，世界负责给出可行动的剧情入口。</p></article>
          <article><b>首轮动态生成</b><p>新闻、传闻、委托、在场人物与变量由第一幕剧情同步落地。</p></article>
        </section>
      </div>`;
  }

  function originPage() {
    return `
      <div class="ew-stack">
        <section class="ew-map">
          ${places.slice(0, 5).map((place, index) => `
            <button class="ew-node n${index + 1} ${state.place === place.id ? 'selected' : ''}" data-place="${esc(place.id)}">
              <strong>${esc(place.id)}</strong><span>${esc(place.region)}</span>
            </button>
          `).join('')}
        </section>
        <section class="ew-card-grid">
          ${places.map(place => `
            <article class="ew-card ${state.place === place.id ? 'selected' : ''}" data-place="${esc(place.id)}">
              <div><b>${esc(place.id)}</b><span>${esc(place.mood)}</span></div>
              <p>${esc(place.hook)}</p>
              <small>${esc(place.service)} / 风险 ${esc(place.risk)}</small>
            </article>
          `).join('')}
        </section>
        ${state.place === '自定义出生点' ? field('customPlace', '自定义出生点', '例如：白冠城外一间漏雨旅店') : ''}
      </div>`;
  }

  function identityPage() {
    return `
      <section class="ew-card-grid three">
        ${identities.map(identity => `
          <article class="ew-card ${state.identity === identity[0] ? 'selected' : ''}" data-identity="${esc(identity[0])}">
            <div><b>${esc(identity[0])}</b><span>身份模板</span></div>
            <p>${esc(identity[1])}</p>
          </article>
        `).join('')}
      </section>`;
  }

  function dossierPage() {
    return `
      <section class="ew-form">
        ${field('name', '玩家名', '{{user}}')}
        ${field('goal', '开局目标', '进城、找委托、寻找某人、躲债、调查传闻等')}
        ${field('design', '角色设计', '外貌、性格、擅长什么、不擅长什么；保持可被世界验证', true)}
        ${field('trouble', '当前麻烦', '没有文书、包裹可疑、钱包紧张、被误会、刚从某地逃出来等', true)}
        ${field('note', '补充说明', '不要预设隐藏身份；玩家后续自己揭示的内容写这里', true)}
      </section>`;
  }

  function partyPage() {
    return `
      <div class="ew-stack">
        <section class="ew-card-grid three">
          ${partyModes.map(mode => `
            <article class="ew-card ${state.party === mode[0] ? 'selected' : ''}" data-party="${esc(mode[0])}">
              <div><b>${esc(mode[0])}</b><span>同行边界</span></div>
              <p>${esc(mode[1])}</p>
            </article>
          `).join('')}
        </section>
        <section class="ew-tone-row">
          ${tones.map(tone => `<button class="${state.tone === tone ? 'selected' : ''}" data-tone="${esc(tone)}">${esc(tone)}</button>`).join('')}
        </section>
        <section class="ew-info-grid">
          <article><b>首轮 NPC</b><p>由出生点自然决定。城门开局优先巡逻、登记员、行会窗口和临时委托人。</p></article>
          <article><b>入队边界</b><p>第一幕可以遇到伙伴，但是否入队必须由剧情关系、条件和后续选择共同决定。</p></article>
          <article><b>状态反馈</b><p>在场人物、可回访、可入队、关系立场应在变量与状态栏中同步可见。</p></article>
        </section>
      </div>`;
  }

  function confirmPage() {
    return `
      <div class="ew-stack">
        <section class="ew-summary">
          <div><span>出生点</span><b>${esc(actualPlaceName())}</b></div>
          <div><span>身份</span><b>${esc(state.identity)}</b></div>
          <div><span>同行</span><b>${esc(state.party)}</b></div>
          <div><span>节奏</span><b>${esc(state.tone)}</b></div>
        </section>
        <section class="ew-preview">
          <header><b>将发送给模型的开局设定</b><span>${state.submitted ? '已提交' : '等待确认'}</span></header>
          <pre>${esc(buildPrompt())}</pre>
        </section>
      </div>`;
  }

  function confirmMessagePage(raw) {
    const rows = String(raw || '')
      .split(/\r?\n/)
      .map(line => line.match(/^([^:：]{2,14})[:：]\s*([\s\S]+)$/))
      .filter(Boolean)
      .map(match => [match[1], match[2]])
      .slice(0, 14);
    return `
      <main class="eldred-welcome confirm-only">
        <section class="ew-frame compact-frame">
          <section class="ew-confirm-banner">
            <span>已提交</span>
            <h2>开局设定已写入聊天</h2>
            <p>下一轮正式回复应根据这份设定生成第一幕剧情，并使用 <content> 与 MVU 变量更新格式。</p>
          </section>
          <section class="ew-summary">
            ${rows.map(row => `<div><span>${esc(row[0])}</span><b>${esc(row[1])}</b></div>`).join('')}
          </section>
          <section class="ew-preview"><header><b>设定原文</b></header><pre>${esc(raw)}</pre></section>
        </section>
      </main>`;
  }

  function renderHome() {
    const renderer = {
      cover: coverPage,
      origin: originPage,
      identity: identityPage,
      dossier: dossierPage,
      party: partyPage,
      confirm: confirmPage,
    }[state.page] || coverPage;
    renderShell(renderer());
  }

  function renderConfirm(raw) {
    const app = document.getElementById('app');
    if (!app) return;
    app.innerHTML = confirmMessagePage(raw);
    resizeSoon();
  }

  function bind(app) {
    if (app.dataset.bound === BUILD_ID) return;
    app.dataset.bound = BUILD_ID;
    app.addEventListener('click', event => {
      const target = event.target;
      const page = target.closest?.('[data-page]');
      if (page) {
        state.page = page.dataset.page;
        renderHome();
        return;
      }
      const place = target.closest?.('[data-place]');
      if (place) {
        state.place = place.dataset.place;
        renderHome();
        return;
      }
      const identity = target.closest?.('[data-identity]');
      if (identity) {
        state.identity = identity.dataset.identity;
        renderHome();
        return;
      }
      const party = target.closest?.('[data-party]');
      if (party) {
        state.party = party.dataset.party;
        renderHome();
        return;
      }
      const tone = target.closest?.('[data-tone]');
      if (tone) {
        state.tone = tone.dataset.tone;
        renderHome();
        return;
      }
      const action = target.closest?.('[data-action]')?.dataset.action;
      if (action === 'sample') fillSample();
      if (action === 'reset') reset();
      if (action === 'prev') move(-1);
      if (action === 'next') move(1);
      if (action === 'submit') submit();
    });
    app.addEventListener('input', event => {
      const fieldName = event.target?.dataset?.field;
      if (!fieldName) return;
      state.fields[fieldName] = event.target.value;
      if (state.page === 'confirm') renderHome();
      else resizeSoon();
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
