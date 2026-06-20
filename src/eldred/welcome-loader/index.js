(() => {
  const BUILD_ID = 'eldred-welcome-loader-v3.5.1';
  const VERSION_REF = 'eldred-integrated-v3.5.1';
  const GLOBAL_KEY = '__eldredWelcomeLoader';
  const FRAME_SELECTOR = '[data-eldred-welcome-console="true"]';
  const FULL_UI_BASE = detectFullUiBase();
  const FULL_UI_ASSETS = {
    script: 'assets/index-Gln-7-OL.js',
    style: 'assets/index-CuRMzv8z.css',
  };
  let iframeEl = null;
  let exitButtonEl = null;
  let viewportDestroy = null;
  let runtimeEventDestroy = null;
  let stopped = false;
  const escapeKeyTargets = [];

  const previous = globalThis[GLOBAL_KEY];
  if (previous && previous.build === BUILD_ID) return;
  try { previous?.unmount?.(); } catch (error) {}
  globalThis[GLOBAL_KEY] = { build: BUILD_ID, mount: mountConsole, unmount: unmountConsole, open: mountConsole };

  function detectScriptUrl() {
    const candidates = [];
    try {
      if (document.currentScript?.src) candidates.push(document.currentScript.src);
    } catch (error) {}
    try {
      const entries = performance.getEntriesByType?.('resource') || [];
      entries.forEach(entry => candidates.push(entry.name));
    } catch (error) {}
    try {
      const stack = new Error().stack || '';
      const matches = stack.match(/(?:https?|file):\/\/[^\s)"'<>]+\/eldred\/welcome-loader\/index\.js(?:[?#][^\s)"'<>]*)?/g) || [];
      candidates.push(...matches);
    } catch (error) {}

    const scriptUrl = candidates
      .filter(Boolean)
      .find(url => /\/eldred\/welcome-loader\/index\.js(?:[?#].*)?$/.test(String(url)));
    return scriptUrl ? String(scriptUrl).replace(/[?#].*$/, '') : '';
  }

  function detectFullUiBase() {
    const scriptUrl = detectScriptUrl();
    if (scriptUrl) {
      try {
        const repoBase = scriptUrl.replace(/\/dist\/eldred\/welcome-loader\/index\.js$/, '/');
        return new URL('艾尔德雷德/脚本相关/dist/', repoBase).href;
      } catch (error) {}
    }
    return `https://testingcf.jsdelivr.net/gh/suosuosaku/st@${VERSION_REF}/%E8%89%BE%E5%B0%94%E5%BE%B7%E9%9B%B7%E5%BE%B7/%E8%84%9A%E6%9C%AC%E7%9B%B8%E5%85%B3/dist/`;
  }

  function hostWindow() {
    try {
      if (window.parent && window.parent.document) return window.parent;
    } catch (error) {}
    return window;
  }

  function hostDocument() {
    return hostWindow().document || document;
  }

  function uniqueScopes(scopes) {
    return Array.from(new Set(scopes.filter(Boolean)));
  }

  function findCallable(name) {
    const scopes = uniqueScopes([
      globalThis,
      window,
      (() => { try { return window.parent; } catch (error) { return null; } })(),
      (() => { try { return window.top; } catch (error) { return null; } })(),
      (() => { try { return hostWindow(); } catch (error) { return null; } })(),
    ]);
    for (const scope of scopes) {
      try {
        if (typeof scope?.[name] === 'function') return scope[name].bind(scope);
      } catch (error) {}
    }
    return null;
  }

  function findMvuMethod(name) {
    const scopes = uniqueScopes([
      globalThis,
      window,
      (() => { try { return window.parent; } catch (error) { return null; } })(),
      (() => { try { return window.top; } catch (error) { return null; } })(),
      (() => { try { return hostWindow(); } catch (error) { return null; } })(),
    ]);
    for (const scope of scopes) {
      try {
        if (typeof scope?.Mvu?.[name] === 'function') return scope.Mvu[name].bind(scope.Mvu);
      } catch (error) {}
    }
    return null;
  }

  function findMvuGetter() {
    return findMvuMethod('getMvuData');
  }

  function findMvuEvents() {
    const scopes = uniqueScopes([
      globalThis,
      window,
      (() => { try { return window.parent; } catch (error) { return null; } })(),
      (() => { try { return window.top; } catch (error) { return null; } })(),
      (() => { try { return hostWindow(); } catch (error) { return null; } })(),
    ]);
    for (const scope of scopes) {
      try {
        if (scope?.Mvu?.events) return scope.Mvu.events;
      } catch (error) {}
    }
    return null;
  }

  function installHostBridge() {
    const bridge = {
      build: BUILD_ID,
      generate(config) {
        const generate = findCallable('generate');
        if (!generate) throw Error('未检测到 Tavern Helper generate()。请在 SillyTavern 脚本控制台内运行。');
        return generate(config);
      },
      getVariables(option) {
        const getVariables = findCallable('getVariables');
        if (!getVariables) return null;
        return getVariables(option);
      },
      replaceVariables(variables, option) {
        const replaceVariables = findCallable('replaceVariables');
        if (!replaceVariables) return false;
        return replaceVariables(variables, option);
      },
      getLastMessageId() {
        const getLastMessageId = findCallable('getLastMessageId');
        return getLastMessageId ? getLastMessageId() : undefined;
      },
      getCurrentMessageId() {
        const getCurrentMessageId = findCallable('getCurrentMessageId');
        return getCurrentMessageId ? getCurrentMessageId() : undefined;
      },
      getChatMessages(range, option) {
        const getChatMessages = findCallable('getChatMessages');
        return getChatMessages ? getChatMessages(range, option) : [];
      },
      generateRaw(config) {
        const generateRaw = findCallable('generateRaw');
        if (!generateRaw) throw Error('未检测到 Tavern Helper generateRaw()。');
        return generateRaw(config);
      },
      importRawPreset(name, raw) {
        const importRawPreset = findCallable('importRawPreset');
        if (!importRawPreset) throw Error('未检测到 importRawPreset()。');
        return importRawPreset(name, raw);
      },
      loadPreset(name) {
        const loadPreset = findCallable('loadPreset');
        if (!loadPreset) return false;
        return loadPreset(name);
      },
      getPresetNames() {
        const getPresetNames = findCallable('getPresetNames');
        return getPresetNames ? getPresetNames() : [];
      },
      getLoadedPresetName() {
        const getLoadedPresetName = findCallable('getLoadedPresetName');
        return getLoadedPresetName ? getLoadedPresetName() : undefined;
      },
      getWorldbookNames() {
        const getWorldbookNames = findCallable('getWorldbookNames');
        return getWorldbookNames ? getWorldbookNames() : [];
      },
      getWorldbook(name) {
        const getWorldbook = findCallable('getWorldbook');
        if (!getWorldbook) return [];
        return getWorldbook(name);
      },
      createWorldbook(name, entries) {
        const createWorldbook = findCallable('createWorldbook');
        if (!createWorldbook) throw Error('未检测到 createWorldbook()。');
        return createWorldbook(name, entries);
      },
      createOrReplaceWorldbook(name, entries, option) {
        const createOrReplaceWorldbook = findCallable('createOrReplaceWorldbook');
        if (!createOrReplaceWorldbook) throw Error('未检测到 createOrReplaceWorldbook()。');
        return createOrReplaceWorldbook(name, entries, option);
      },
      createWorldbookEntries(name, entries, option) {
        const createWorldbookEntries = findCallable('createWorldbookEntries');
        if (!createWorldbookEntries) throw Error('未检测到 createWorldbookEntries()。');
        return createWorldbookEntries(name, entries, option);
      },
      getGlobalWorldbookNames() {
        const getGlobalWorldbookNames = findCallable('getGlobalWorldbookNames');
        return getGlobalWorldbookNames ? getGlobalWorldbookNames() : [];
      },
      rebindGlobalWorldbooks(names) {
        const rebindGlobalWorldbooks = findCallable('rebindGlobalWorldbooks');
        if (!rebindGlobalWorldbooks) return false;
        return rebindGlobalWorldbooks(names);
      },
      getOrCreateChatWorldbook(chat, name) {
        const getOrCreateChatWorldbook = findCallable('getOrCreateChatWorldbook');
        if (!getOrCreateChatWorldbook) throw Error('未检测到 getOrCreateChatWorldbook()。');
        return getOrCreateChatWorldbook(chat, name);
      },
      rebindChatWorldbook(chat, name) {
        const rebindChatWorldbook = findCallable('rebindChatWorldbook');
        if (!rebindChatWorldbook) throw Error('未检测到 rebindChatWorldbook()。');
        return rebindChatWorldbook(chat, name);
      },
      Mvu: {
        getMvuData(option) {
          const getMvuData = findMvuGetter();
          if (!getMvuData) return null;
          return getMvuData(option);
        },
        parseMessage(message, oldData) {
          const parseMessage = findMvuMethod('parseMessage');
          if (!parseMessage) throw Error('未检测到 MVU parseMessage()。请确认 MVU 变量框架已加载。');
          return parseMessage(message, oldData);
        },
        replaceMvuData(data, option) {
          const replaceMvuData = findMvuMethod('replaceMvuData');
          if (!replaceMvuData) throw Error('未检测到 MVU replaceMvuData()。请确认 MVU 变量框架已加载。');
          return replaceMvuData(data, option);
        },
      },
    };

    try { hostWindow().__eldredWelcomeBridge = bridge; } catch (error) {}
    try { window.__eldredWelcomeBridge = bridge; } catch (error) {}
  }

  function hostViewport() {
    const win = hostWindow();
    const doc = hostDocument();
    const viewport = win.visualViewport;
    const fallbackWidth = doc.documentElement?.clientWidth || win.innerWidth || window.innerWidth || 1280;
    const fallbackHeight = doc.documentElement?.clientHeight || win.innerHeight || window.innerHeight || 720;
    return {
      width: Math.max(320, Math.floor(viewport?.width || fallbackWidth)),
      height: Math.max(360, Math.floor(viewport?.height || fallbackHeight)),
      left: Math.floor(viewport?.offsetLeft || 0),
      top: Math.floor(viewport?.offsetTop || 0),
    };
  }

  function addEscapeKeyTarget(target) {
    if (!target || escapeKeyTargets.includes(target)) return;
    target.addEventListener('keydown', handleEscapeKey, true);
    escapeKeyTargets.push(target);
  }

  function removeEscapeControls() {
    escapeKeyTargets.forEach(target => target.removeEventListener('keydown', handleEscapeKey, true));
    escapeKeyTargets.length = 0;
    exitButtonEl?.remove();
    exitButtonEl = null;
  }

  function handleEscapeKey(event) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    unmountConsole();
  }

  function mountEscapeControls() {
    if (exitButtonEl) return;
    const doc = hostDocument();
    const button = doc.createElement('button');
    button.type = 'button';
    button.dataset.eldredWelcomeExit = 'true';
    button.textContent = '退出开局';
    button.title = '退出艾尔德雷德开局控制台';
    button.setAttribute('aria-label', '退出艾尔德雷德开局控制台');
    button.style.cssText = [
      'position:fixed',
      'top:14px',
      'right:14px',
      'z-index:100000',
      'height:32px',
      'padding:0 12px',
      'border:2px solid #2a1717',
      'border-radius:0',
      'background:linear-gradient(180deg,#ffe27c,#c87932)',
      'color:#24100c',
      'font:700 12px/1 "Microsoft YaHei UI","Microsoft YaHei",system-ui,sans-serif',
      'letter-spacing:0',
      'box-shadow:0 0 0 1px rgba(255,244,202,.5),4px 4px 0 rgba(0,0,0,.38)',
      'cursor:pointer',
    ].join(';');
    button.addEventListener('click', unmountConsole);
    doc.body.appendChild(button);
    exitButtonEl = button;
    addEscapeKeyTarget(doc);
    addEscapeKeyTarget(hostWindow());
  }

  function syncViewportToIframe() {
    if (!iframeEl) return;
    const viewport = hostViewport();
    iframeEl.style.left = `${viewport.left}px`;
    iframeEl.style.top = `${viewport.top}px`;
    iframeEl.style.width = `${viewport.width}px`;
    iframeEl.style.height = `${viewport.height}px`;
    iframeEl.style.right = 'auto';
    iframeEl.style.bottom = 'auto';
  }

  function bindViewport() {
    if (viewportDestroy) viewportDestroy();
    const win = hostWindow();
    const viewport = win.visualViewport;
    const update = () => syncViewportToIframe();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    win.addEventListener('resize', update);
    win.addEventListener('orientationchange', update);
    viewportDestroy = () => {
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      win.removeEventListener('resize', update);
      win.removeEventListener('orientationchange', update);
    };
    update();
  }

  function postRuntimeEvent(name, args) {
    const target = iframeEl?.contentWindow;
    try {
      target?.postMessage({
        source: 'EldredWelcomeLoader',
        type: 'runtime-event',
        name,
        args: Array.from(args || []).map(value => {
          if (value && typeof value === 'object') return '[object]';
          return value;
        }),
        at: Date.now(),
      }, '*');
    } catch (error) {
      console.warn('[EldredWelcomeLoader] runtime event post failed', error);
    }
  }

  function bindRuntimeEvents() {
    if (runtimeEventDestroy) runtimeEventDestroy();
    const eventOnFn = findCallable('eventOn');
    const tavernEventMap = (() => {
      try { return hostWindow().tavern_events || window.tavern_events || globalThis.tavern_events; } catch (error) { return null; }
    })();
    const mvuEvents = findMvuEvents();
    const disposers = [];
    const bind = (eventName, label) => {
      if (!eventOnFn || !eventName) return;
      try {
        const dispose = eventOnFn(eventName, (...args) => postRuntimeEvent(label || eventName, args));
        if (typeof dispose === 'function') disposers.push(dispose);
        else if (typeof dispose?.stop === 'function') disposers.push(() => dispose.stop());
      } catch (error) {
        console.warn('[EldredWelcomeLoader] runtime event bind failed', label || eventName, error);
      }
    };

    bind(mvuEvents?.VARIABLE_UPDATE_ENDED, 'mvu-variable-update-ended');
    bind(mvuEvents?.BEFORE_MESSAGE_UPDATE, 'mvu-before-message-update');
    bind(tavernEventMap?.GENERATION_ENDED, 'generation-ended');
    bind(tavernEventMap?.MESSAGE_RECEIVED, 'message-received');
    bind(tavernEventMap?.MESSAGE_UPDATED, 'message-updated');
    bind(tavernEventMap?.MESSAGE_EDITED, 'message-edited');
    bind(tavernEventMap?.MESSAGE_SWIPED, 'message-swiped');
    bind(tavernEventMap?.CHARACTER_MESSAGE_RENDERED, 'character-message-rendered');
    bind(tavernEventMap?.CHAT_CHANGED, 'chat-changed');

    runtimeEventDestroy = () => {
      disposers.forEach(dispose => {
        try { dispose(); } catch (error) {}
      });
      disposers.length = 0;
    };
  }

  function mountWelcomeDocument(iframe) {
    if (!iframe || iframe.dataset.eldredWelcomeMounted === 'true') return;
    const doc = iframe.contentDocument;
    if (!doc) return;
    iframe.dataset.eldredWelcomeMounted = 'true';
    const scriptUrl = new URL(FULL_UI_ASSETS.script, FULL_UI_BASE).href;
    const styleUrl = new URL(FULL_UI_ASSETS.style, FULL_UI_BASE).href;
    doc.open();
    doc.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <base href="${FULL_UI_BASE}">
  <title>艾尔德雷德大世界</title>
  <link rel="stylesheet" crossorigin href="${styleUrl}">
  <style>
    html,body,#root{width:100%;height:100%;margin:0;overflow:hidden;background:#08090a;color:#d1d5db;}
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    globalThis.__ELDRED_FULL_UI_BASE__ = ${JSON.stringify(FULL_UI_BASE)};
  <\/script>
  <script type="module" crossorigin src="${scriptUrl}"><\/script>
</body>
</html>`);
    doc.close();
    syncViewportToIframe();
  }

  function mountConsole() {
    if (stopped) stopped = false;
    if (iframeEl) return;
    const doc = hostDocument();
    if (!doc.body) return;
    mountEscapeControls();

    const iframe = doc.createElement('iframe');
    iframe.dataset.eldredWelcomeConsole = 'true';
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('title', '艾尔德雷德开局控制台');
    iframe.setAttribute('aria-label', '艾尔德雷德开局控制台');
    iframe.loading = 'eager';
    iframe.referrerPolicy = 'no-referrer';
    iframe.style.cssText = [
      'position:fixed',
      'left:0',
      'top:0',
      'width:100vw',
      'height:100dvh',
      'z-index:99999',
      'border:none',
      'background:#050810',
      'display:block',
      'color-scheme:dark',
    ].join(';');
    iframe.addEventListener('load', () => {
      mountWelcomeDocument(iframe);
      syncViewportToIframe();
    });

    iframeEl = iframe;
    bindViewport();
    doc.body.appendChild(iframe);
    mountWelcomeDocument(iframe);
    setTimeout(syncViewportToIframe, 0);
  }

  function unmountConsole() {
    stopped = true;
    viewportDestroy?.();
    viewportDestroy = null;
    iframeEl?.remove();
    iframeEl = null;
    removeEscapeControls();
  }

  function postGenerateResult(targetWindow, requestId, payload) {
    try {
      targetWindow?.postMessage({
        source: 'EldredWelcomeLoader',
        type: 'generate-result',
        requestId,
        ...payload,
      }, '*');
    } catch (error) {
      console.warn('[EldredWelcomeLoader] generate response failed', error);
    }
  }

  function handleGenerateMessage(event, data) {
    if (iframeEl && event.source && event.source !== iframeEl.contentWindow) return;
    const targetWindow = event.source || iframeEl?.contentWindow;
    const requestId = String(data.requestId || '');
    const config = data.config || {};
    Promise.resolve()
      .then(() => {
        installHostBridge();
        return hostWindow().__eldredWelcomeBridge?.generate(config);
      })
      .then(text => {
        postGenerateResult(targetWindow, requestId, { ok: true, text: String(text || '') });
      })
      .catch(error => {
        postGenerateResult(targetWindow, requestId, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }

  function handleMessage(event) {
    const data = event.data || {};
    if (data.source !== 'EldredWelcome') return;
    if (data.type === 'generate') {
      handleGenerateMessage(event, data);
      return;
    }
    if (data.type === 'ready') {
      syncViewportToIframe();
      return;
    }
    if (data.type === 'resize') {
      syncViewportToIframe();
      return;
    }
  }

  function registerScriptButton() {
    try {
      if (typeof replaceScriptButtons === 'function') {
        replaceScriptButtons([{ name: '进入艾尔德雷德开局', visible: true }]);
      }
      const eventName = typeof getButtonEvent === 'function' ? getButtonEvent('进入艾尔德雷德开局') : null;
      if (eventName && typeof eventOn === 'function') eventOn(eventName, mountConsole);
    } catch (error) {
      console.warn('[EldredWelcomeLoader] script button registration failed', error);
    }
  }

  function bootstrap() {
    installHostBridge();
    bindRuntimeEvents();
    setTimeout(() => {
      installHostBridge();
      bindRuntimeEvents();
      postRuntimeEvent('runtime-bridge-refresh', []);
    }, 1000);
    setTimeout(() => {
      installHostBridge();
      bindRuntimeEvents();
      postRuntimeEvent('runtime-bridge-refresh', []);
    }, 3000);
    registerScriptButton();
    hostWindow().addEventListener('message', handleMessage);
    mountConsole();
    try {
      $(window).on('pagehide', () => {
        runtimeEventDestroy?.();
        runtimeEventDestroy = null;
        unmountConsole();
      });
    } catch (error) {}
  }

  if (typeof $ === 'function') $(bootstrap);
  else setTimeout(bootstrap, 200);
})();
