import './index.css';

(() => {
  const BUILD_ID = 'eldred-welcome-v3.1.0';
  const API_KEY = '__EldredWelcomeExternal';
  const mounted = new WeakMap();

  const pages = [
    ['intro', '世界引言'],
    ['route', '出生星图'],
    ['origin', '身份模板'],
    ['profile', '角色档案'],
    ['party', '同行预案'],
    ['start', '确认开局'],
  ];

  const places = [
    {
      id: '黎明城墙外环',
      region: '艾琳西亚',
      risk: '低',
      service: '登记 / 临时通行 / 问路',
      hook: '第一件麻烦通常不是魔物，而是解释自己为什么没有像样文书。',
    },
    {
      id: '白冠城外市',
      region: '艾琳西亚',
      risk: '低',
      service: '住宿 / 雇佣 / 补给',
      hook: '晚饭钱和第一份委托会同时出现，但前者更急。',
    },
    {
      id: '风车港城',
      region: '岚之领',
      risk: '中',
      service: '船运 / 商队 / 行会',
      hook: '写错名字的货单，可能比贵族请柬更有用。',
    },
    {
      id: '灰雾边境营地',
      region: '禁忌地边线',
      risk: '中',
      service: '救治 / 巡防 / 封存',
      hook: '帐篷外的泥很新，伤员也很新，没人有空把麻烦说得体面。',
    },
    {
      id: '星砂学院邦驿站',
      region: '星砂学院邦',
      risk: '低',
      service: '邮驿 / 鉴定 / 学徒委托',
      hook: '驿站永远有寄错的箱子，偶尔箱子还会自己发光。',
    },
    {
      id: '自定义出生点',
      region: '玩家填写',
      risk: '待定',
      service: '按地点生成',
      hook: '只写地点、气氛或正在遭遇的麻烦，世界会把它接进当前规则。',
    },
  ];

  const origins = [
    ['旅人', '没有固定担保，行动自由，但开局要处理文书、落脚和第一份收入。'],
    ['见习冒险者', '懂一点行会规矩，容易接委托，也容易被老手低估。'],
    ['流亡小贵族', '懂礼仪和旧关系，但名字可能比钱包更先带来麻烦。'],
    ['边境杂役', '熟悉营地、货车和低价补给，知道路上真正缺什么。'],
    ['学院旁听生', '有知识入口，容易卷进实验事故、账单和导师的临时差遣。'],
    ['自定义身份', '只保留玩家填写的身份气质，不预设隐藏血统或救世使命。'],
  ];

  const partyModes = [
    ['暂时独行', '第一幕重点落在落脚、盘查、委托入口和本地 NPC 接触。'],
    ['可遇伙伴', '允许剧情自然出现可同行角色，但不强行入队。'],
    ['已有同行', '玩家可在角色设计中写明同行者，剧情负责给出合理登场。'],
  ];

  const tones = ['轻喜剧冒险', '城邦日常', '遗迹探索', '边境危机'];

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[char]);
  }

  function stateOf(root) {
    let state = mounted.get(root);
    if (!state) {
      state = {
        page: root.dataset.page || 'intro',
        place: root.dataset.place || places[0].id,
        origin: root.dataset.origin || origins[0][0],
        party: root.dataset.party || partyModes[0][0],
        tone: root.dataset.tone || tones[0],
        fields: {
          name: '{{user}}',
          customPlace: '',
          design: '',
          trouble: '',
          goal: '',
          note: '',
        },
      };
      mounted.set(root, state);
    }
    return state;
  }

  function selectedPlace(state) {
    return places.find(place => place.id === state.place) || places[0];
  }

  function selectedOrigin(state) {
    return origins.find(origin => origin[0] === state.origin) || origins[0];
  }

  function buildPrompt(state) {
    const place = selectedPlace(state);
    const origin = selectedOrigin(state);
    const customPlace = state.fields.customPlace.trim();
    const placeName = place.id === '自定义出生点' && customPlace ? customPlace : place.id;
    return [
      '【艾尔德雷德开局设定】',
      `玩家名: ${state.fields.name.trim() || '{{user}}'}`,
      `出生点: ${placeName}`,
      `区域倾向: ${place.region}`,
      `地点服务: ${place.service}`,
      `地点风险: ${place.risk}`,
      `角色模板: ${origin[0]}`,
      `模板边界: ${origin[1]}`,
      `角色设计: ${state.fields.design.trim() || '默认是纯路人，不预设隐藏身份，由玩家后续补充。'}`,
      `当前麻烦: ${state.fields.trouble.trim() || '没有稳定担保，需要在当地规矩中找到进入剧情的入口。'}`,
      `开局目标: ${state.fields.goal.trim() || '先进入当前地点的日常秩序，获得第一个可行动目标。'}`,
      `同行预案: ${state.party}`,
      `开局节奏: ${state.tone}`,
      `补充说明: ${state.fields.note.trim() || '无'}`,
      '生成要求: 根据以上角色设计和出生点自行设计第一幕剧情；不要使用固定开场白；输出必须遵守艾尔德雷德预设格式，正文使用<content>包裹，变量按MVU规则更新。',
    ].join('\n');
  }

  function renderShell(root, inner) {
    const state = stateOf(root);
    root.innerHTML = `
      <section class="eldred-welcome-ui" data-build="${BUILD_ID}">
        <div class="ew-frame">
          <div class="ew-layout">
            <aside class="ew-left">
              <div class="ew-brand">
                <div class="ew-sigil">艾</div>
                <h1>艾尔德雷德大世界</h1>
                <div class="ew-kicker">王国档案台 / 自由开局</div>
                <p class="ew-muted">玩家写下角色设计与出生点，第一幕由世界书、预设、智脑和变量链路共同接入。</p>
              </div>
              <nav class="ew-nav">
                ${pages.map(([id, label]) => `<button data-page="${id}" class="${state.page === id ? 'is-active' : ''}">${label}</button>`).join('')}
              </nav>
              <div class="ew-left-foot">
                <div class="ew-meter"><span></span><div class="ew-small">身份可以普通，麻烦必须具体；角色不用伟大，但第一件事要能被世界抓住。</div></div>
              </div>
            </aside>
            <section class="ew-main">
              <header class="ew-top">
                <div>
                  <div class="ew-title">${esc(pages.find(([id]) => id === state.page)?.[1] || '开局控制台')}</div>
                  <div class="ew-muted">${esc(selectedPlace(state).id)} / ${esc(state.origin)} / ${esc(state.tone)}</div>
                </div>
                <div class="ew-quick">
                  <button data-page="route">地点</button>
                  <button data-page="profile">档案</button>
                  <button data-page="start">确认</button>
                </div>
              </header>
              <main class="ew-page">${inner}</main>
              <footer class="ew-footer">
                <div class="ew-footer-group">
                  <button class="ew-btn" data-action="sample">填入示例</button>
                  <button class="ew-btn" data-action="reset">清空</button>
                </div>
                <div class="ew-footer-group">
                  <button class="ew-btn" data-action="prev">上一页</button>
                  <button class="ew-btn" data-action="next">下一页</button>
                  <button class="ew-btn primary" data-action="submit">发送开局设定</button>
                </div>
              </footer>
            </section>
          </div>
        </div>
      </section>`;
  }

  function render(root) {
    const state = stateOf(root);
    if ((root.dataset.mode || 'home') === 'confirm') {
      renderConfirm(root, root.dataset.raw || '');
      return;
    }
    const page = state.page;
    const html = page === 'intro' ? introPage()
      : page === 'route' ? routePage(state)
        : page === 'origin' ? originPage(state)
          : page === 'profile' ? profilePage(state)
            : page === 'party' ? partyPage(state)
              : startPage(state);
    renderShell(root, html);
    syncPreview(root);
  }

  function introPage() {
    return `
      <div class="ew-stack">
        <section class="ew-hero">
          <h2>开局不是一段固定朗诵，而是一份会被王国规矩接住的入境档案。</h2>
          <p>艾尔德雷德的第一幕从具体地点、具体麻烦和具体人物关系开始。城门、行会、委托、传闻、账单、巡逻和小误会，会把普通路人推向冒险。</p>
        </section>
        <div class="ew-grid">
          <article class="ew-letter"><b>引言</b><p>这里是剑与魔法的大世界，但不要求主角天生站在史诗中心。玩家可以从一张缺少印章的路引、一只过于可疑的包裹，或一份看起来不太划算的委托开始。</p></article>
          <article class="ew-letter"><b>作者寄语</b><p>请把第一幕写成能继续行动的现场：有人问话，有规矩挡路，有小利益诱惑，也有足够清晰的下一步。</p></article>
        </div>
        <div class="ew-grid three">
          <article class="ew-card"><b>世界会追问</b><p>姓名、来处、目的、担保、随身物和支付能力都可能成为剧情入口。</p></article>
          <article class="ew-card"><b>伙伴会拆台</b><p>角色缺陷、日常压力和轻喜剧误会优先于空泛史诗腔。</p></article>
          <article class="ew-card"><b>变量会落账</b><p>地点、在场人物、委托、传闻和状态变化由首轮剧情自然初始化。</p></article>
        </div>
      </div>`;
  }

  function routePage(state) {
    return `
      <div class="ew-stack">
        <section class="ew-route-board">
          <div class="ew-route-row">
            ${places.slice(0, 6).map(place => `
              <button class="ew-route-node ${state.place === place.id ? 'is-selected' : ''}" data-place="${esc(place.id)}">
                <strong>${esc(place.id)}</strong>
                <span>${esc(place.region)} / 风险${esc(place.risk)}</span>
              </button>`).join('')}
          </div>
        </section>
        <div class="ew-grid">
          ${places.map(place => `
            <article class="ew-card ${state.place === place.id ? 'is-selected' : ''}" data-place="${esc(place.id)}">
              <b>${esc(place.id)}</b>
              <p>${esc(place.hook)}</p>
              <div class="ew-tagline"><span class="ew-chip">${esc(place.region)}</span><span class="ew-chip">风险 ${esc(place.risk)}</span><span class="ew-chip">${esc(place.service)}</span></div>
            </article>`).join('')}
        </div>
        ${state.place === '自定义出生点' ? `<div class="ew-field"><label>自定义出生点</label><input data-field="customPlace" value="${esc(state.fields.customPlace)}" placeholder="例如：白冠城外一间漏雨旅店"></div>` : ''}
      </div>`;
  }

  function originPage(state) {
    return `
      <div class="ew-grid three">
        ${origins.map(origin => `
          <article class="ew-card ${state.origin === origin[0] ? 'is-selected' : ''}" data-origin="${esc(origin[0])}">
            <b>${esc(origin[0])}</b>
            <p>${esc(origin[1])}</p>
          </article>`).join('')}
      </div>`;
  }

  function profilePage(state) {
    return `
      <div class="ew-form">
        <div class="ew-field"><label>玩家名</label><input data-field="name" value="${esc(state.fields.name)}"></div>
        <div class="ew-field"><label>开局目标</label><input data-field="goal" value="${esc(state.fields.goal)}" placeholder="想进城、找委托、寻找某人、避开追债等"></div>
        <div class="ew-field wide"><label>角色设计</label><textarea data-field="design" placeholder="外貌、性格、擅长什么、不擅长什么，保持可被世界验证">${esc(state.fields.design)}</textarea></div>
        <div class="ew-field wide"><label>当前麻烦</label><textarea data-field="trouble" placeholder="没有文书、包裹可疑、钱包紧张、被误会、刚从某地逃出来等">${esc(state.fields.trouble)}</textarea></div>
        <div class="ew-field wide"><label>补充说明</label><textarea data-field="note" placeholder="不要预设隐藏身份；玩家后续自己杜撰的内容写这里">${esc(state.fields.note)}</textarea></div>
      </div>`;
  }

  function partyPage(state) {
    return `
      <div class="ew-stack">
        <div class="ew-grid three">
          ${partyModes.map(mode => `
            <article class="ew-choice ${state.party === mode[0] ? 'is-selected' : ''}" data-party="${esc(mode[0])}">
              <b>${esc(mode[0])}</b>
              <p>${esc(mode[1])}</p>
            </article>`).join('')}
        </div>
        <div class="ew-grid">
          <article class="ew-card"><b>首轮 NPC</b><p>由出生点自然决定。城门开局优先巡逻、登记员、行会窗口和临时委托人。</p></article>
          <article class="ew-card"><b>入队边界</b><p>第一幕可以遇到伙伴，但是否入队必须由剧情关系、条件和后续选择共同决定。</p></article>
        </div>
      </div>`;
  }

  function startPage(state) {
    return `
      <div class="ew-stack">
        <div class="ew-grid">
          <section class="ew-card"><b>开局节奏</b><div class="ew-tagline">${tones.map(tone => `<button class="ew-chip ${state.tone === tone ? 'is-selected' : ''}" data-tone="${esc(tone)}">${esc(tone)}</button>`).join('')}</div></section>
          <section class="ew-card"><b>当前选定</b><p>${esc(selectedPlace(state).id)} / ${esc(state.origin)} / ${esc(state.party)}</p></section>
        </div>
        <section class="ew-preview"><b>将发送给模型的开局设定</b><pre data-start-preview>${esc(buildPrompt(state))}</pre></section>
      </div>`;
  }

  function renderConfirm(root, raw) {
    const rows = parseSetting(raw);
    root.innerHTML = `
      <section class="eldred-welcome-ui" data-build="${BUILD_ID}">
        <div class="ew-frame">
          <div class="ew-confirm-head">
            <div class="ew-confirm-badge">启</div>
            <div>
              <div class="ew-title">开局设定已提交</div>
              <div class="ew-muted">下一轮回复将依据这份设定进入剧情，不再使用固定开场白。</div>
            </div>
          </div>
          <div class="ew-page ew-stack">
            <div class="ew-preview"><b>设定原文</b><pre>${esc(raw)}</pre></div>
            <div class="ew-confirm-list">${rows.map(row => `<div class="ew-confirm-item"><b>${esc(row[0])}</b>${esc(row[1])}</div>`).join('')}</div>
          </div>
        </div>
      </section>`;
  }

  function parseSetting(raw) {
    return String(raw || '')
      .split(/\r?\n/)
      .map(line => line.match(/^([^:：]{2,12})[:：]\s*([\s\S]+)$/))
      .filter(Boolean)
      .map(match => [match[1], match[2]])
      .slice(0, 12);
  }

  function syncPreview(root) {
    const preview = root.querySelector('[data-start-preview]');
    if (preview) preview.textContent = buildPrompt(stateOf(root));
  }

  function bind(root) {
    if (root.__eldredWelcomeBound) return;
    root.__eldredWelcomeBound = true;
    root.addEventListener('click', event => {
      const state = stateOf(root);
      const target = event.target;
      const page = target.closest?.('[data-page]');
      if (page) {
        state.page = page.dataset.page;
        render(root);
        return;
      }
      const place = target.closest?.('[data-place]');
      if (place) {
        state.place = place.dataset.place;
        render(root);
        return;
      }
      const origin = target.closest?.('[data-origin]');
      if (origin) {
        state.origin = origin.dataset.origin;
        render(root);
        return;
      }
      const party = target.closest?.('[data-party]');
      if (party) {
        state.party = party.dataset.party;
        render(root);
        return;
      }
      const tone = target.closest?.('[data-tone]');
      if (tone) {
        state.tone = tone.dataset.tone;
        render(root);
        return;
      }
      const action = target.closest?.('[data-action]')?.dataset.action;
      if (action === 'sample') fillSample(root);
      if (action === 'reset') reset(root);
      if (action === 'prev') move(root, -1);
      if (action === 'next') move(root, 1);
      if (action === 'submit') submit(root);
    });
    root.addEventListener('input', event => {
      const field = event.target?.dataset?.field;
      if (!field) return;
      stateOf(root).fields[field] = event.target.value;
      syncPreview(root);
    });
  }

  function move(root, delta) {
    const state = stateOf(root);
    const index = Math.max(0, pages.findIndex(([id]) => id === state.page));
    state.page = pages[Math.max(0, Math.min(pages.length - 1, index + delta))][0];
    render(root);
  }

  function fillSample(root) {
    const state = stateOf(root);
    state.page = 'start';
    state.place = places[0].id;
    state.origin = origins[0][0];
    state.party = partyModes[0][0];
    state.tone = tones[0];
    state.fields = {
      name: '{{user}}',
      customPlace: '',
      design: '看起来只是普通旅行者，背着磨旧的包，性格偏乐观，钱包不算充裕。',
      trouble: '没有能立刻证明身份的路引，但想进城找落脚处和第一份委托。',
      goal: '通过盘查，进入艾琳西亚，找到今晚能睡觉且不会太贵的地方。',
      note: '不要预设隐藏身份，玩家会在后续自己补充真实来历。',
    };
    render(root);
  }

  function reset(root) {
    mounted.delete(root);
    root.dataset.page = 'intro';
    root.dataset.place = places[0].id;
    root.dataset.origin = origins[0][0];
    render(root);
  }

  async function submit(root) {
    const text = buildPrompt(stateOf(root));
    const api = findApi();
    try {
      if (api.createChatMessages) {
        await api.createChatMessages([{ role: 'user', message: text }]);
        if (api.triggerSlash) await api.triggerSlash('/trigger');
        return;
      }
    } catch (error) {
      console.warn('[EldredWelcome] createChatMessages failed', error);
    }
    const doc = root.ownerDocument || document;
    const textarea = doc.querySelector('#send_textarea, textarea[name="text"], textarea')
      || window.parent?.document?.querySelector?.('#send_textarea, textarea[name="text"], textarea');
    if (textarea) {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(textarea), 'value')?.set;
      if (setter) setter.call(textarea, text);
      else textarea.value = text;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.focus();
      return;
    }
    window.alert?.(text);
  }

  function findApi() {
    const scopes = [globalThis, window, window.parent, window.top].filter(Boolean);
    for (const scope of scopes) {
      if (typeof scope.createChatMessages === 'function') {
        return {
          createChatMessages: scope.createChatMessages.bind(scope),
          triggerSlash: typeof scope.triggerSlash === 'function' ? scope.triggerSlash.bind(scope) : null,
        };
      }
    }
    return {};
  }

  function mount(root) {
    bind(root);
    render(root);
  }

  function scan(doc = document) {
    const roots = Array.from(doc.querySelectorAll('[data-eldred-welcome-host="true"]'));
    const app = doc.getElementById('app');
    if (app && !roots.includes(app)) {
      app.dataset.eldredWelcomeHost = 'true';
      app.dataset.mode = app.dataset.mode || 'home';
      roots.push(app);
    }
    roots.forEach(root => mount(root));
  }

  globalThis[API_KEY] = { build: BUILD_ID, scan, mount, buildPrompt };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scan());
  } else {
    scan();
  }
})();
