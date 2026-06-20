(() => {
  const BUILD_ID = 'eldred-welcome-loader-v3.3.4';
  const VERSION_REF = 'eldred-integrated-v3.3.4';
  const GLOBAL_KEY = '__eldredWelcomeLoader';
  const FRAME_SELECTOR = '[data-eldred-welcome-console="true"]';
  const FULL_UI_BASE = detectFullUiBase();
  const FULL_UI_ASSETS = {
    script: 'assets/index-CtYX08oX.js',
    style: 'assets/index-zfLregNA.css',
  };
  let iframeEl = null;
  let exitButtonEl = null;
  let viewportDestroy = null;
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

  function handleMessage(event) {
    const data = event.data || {};
    if (data.source !== 'EldredWelcome') return;
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
    registerScriptButton();
    hostWindow().addEventListener('message', handleMessage);
    mountConsole();
    try { $(window).on('pagehide', unmountConsole); } catch (error) {}
  }

  if (typeof $ === 'function') $(bootstrap);
  else setTimeout(bootstrap, 200);
})();
