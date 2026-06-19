(() => {
  const BUILD_ID = 'eldred-welcome-loader-v3.1.0';
  const APP_BUILD_ID = 'eldred-welcome-v3.1.0';
  const GLOBAL_KEY = '__eldredWelcomeLoader';
  const APP_KEY = '__EldredWelcomeExternal';
  const HTML_URL = 'https://testingcf.jsdelivr.net/gh/suosuosaku/st@eldred-welcome-v3.1.0/dist/eldred/welcome/index.html';
  const HOST_SELECTOR = '[data-eldred-welcome-host="true"]';
  const ORIGINAL_SELECTOR = '[data-eldred-welcome-original="true"]';
  const STYLE_ID = 'eldred-welcome-external-style-v3-1-0';
  const SCRIPT_ID = 'eldred-welcome-external-script-v3-1-0';
  const timers = [];
  const listeners = [];
  let observer = null;
  let stopped = false;
  let loading = null;

  const previous = globalThis[GLOBAL_KEY];
  if (previous && previous.build === BUILD_ID) return;
  try { previous && previous.unmount && previous.unmount(); } catch (error) {}
  globalThis[GLOBAL_KEY] = { build: BUILD_ID, unmount, scan: renderAll };

  function hostDocument() {
    try {
      return window.parent && window.parent.document ? window.parent.document : document;
    } catch (error) {
      return document;
    }
  }

  function hostWindow() {
    return hostDocument().defaultView || window;
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

  function schedule(delays = [0, 160, 520]) {
    delays.forEach(delay => timers.push(setTimeout(renderAll, delay)));
  }

  function messageNodes() {
    const doc = hostDocument();
    const nodes = Array.from(doc.querySelectorAll('#chat .mes, .mes')).filter(node => node.querySelector('.mes_text'));
    return nodes.length ? nodes : Array.from(doc.querySelectorAll('.mes_text')).map(node => node.closest('.mes') || node);
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
      () => typeof getChatMessages === 'function' ? getChatMessages(id)[0] : null,
      () => window.parent && typeof window.parent.getChatMessages === 'function' ? window.parent.getChatMessages(id)[0] : null,
      () => globalThis.chat && globalThis.chat[id],
      () => window.parent?.chat && window.parent.chat[id],
    ];
    for (const read of readers) {
      try {
        const message = read();
        const text = message && (message.message || message.mes || message.text || message.content);
        if (typeof text === 'string' && text.trim()) return text;
      } catch (error) {}
    }
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
    if (/^\s*【艾尔德雷德开局设定】/.test(raw || '')) return 'confirm';
    if (/^\s*(?:<eldred_welcome[^>]*>\s*)?【欢迎词】/.test(raw || '')) return 'home';
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
    const root = body.querySelector(HOST_SELECTOR);
    if (root) root.remove();
    const original = body.querySelector(ORIGINAL_SELECTOR);
    if (original) {
      while (original.firstChild) body.insertBefore(original.firstChild, original);
      original.remove();
    }
  }

  async function ensureExternal() {
    const win = hostWindow();
    if (win[APP_KEY]?.build === APP_BUILD_ID) return win[APP_KEY];
    if (loading) return loading;
    loading = fetch(HTML_URL, { cache: 'no-cache' })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then(html => installExternal(html))
      .catch(error => {
        console.error('[EldredWelcomeLoader] external welcome load failed', error);
        throw error;
      })
      .finally(() => {
        loading = null;
      });
    return loading;
  }

  async function installExternal(html) {
    const doc = hostDocument();
    const win = hostWindow();
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const styleText = Array.from(parsed.querySelectorAll('style')).map(style => style.textContent || '').join('\n');
    if (styleText) {
      let style = doc.getElementById(STYLE_ID);
      if (!style) {
        style = doc.createElement('style');
        style.id = STYLE_ID;
        doc.head.appendChild(style);
      }
      style.textContent = styleText;
    }
    if (win[APP_KEY]?.build !== APP_BUILD_ID && !doc.getElementById(SCRIPT_ID)) {
      const scriptText = Array.from(parsed.querySelectorAll('script')).map(script => script.textContent || '').filter(Boolean).join('\n');
      const script = doc.createElement('script');
      script.id = SCRIPT_ID;
      script.type = 'module';
      script.textContent = `${scriptText}\n//# sourceURL=eldred-welcome-v3.1.0.js`;
      doc.head.appendChild(script);
    }
    for (let index = 0; index < 60; index += 1) {
      if (win[APP_KEY]?.build === APP_BUILD_ID) return win[APP_KEY];
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw new Error('external welcome app did not register');
  }

  function fallback(root, error) {
    root.innerHTML = `<div style="border:1px solid rgba(228,184,91,.45);background:#17110a;color:#f2dfb2;padding:14px;line-height:1.65;font-family:serif">
      <b>艾尔德雷德开局页载入失败</b><br>
      请确认外部脚本版本已推送：${HTML_URL}<br>
      ${String(error?.message || error || '')}
    </div>`;
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
    let root = body.querySelector(HOST_SELECTOR);
    if (!root) {
      root = hostDocument().createElement('div');
      root.dataset.eldredWelcomeHost = 'true';
      body.appendChild(root);
    }
    const key = hash(raw);
    root.dataset.mode = mode;
    root.dataset.raw = raw;
    root.dataset.rawHash = key;
    ensureExternal()
      .then(app => {
        if (!stopped) app.scan(hostDocument());
      })
      .catch(error => fallback(root, error));
  }

  function bootObserver() {
    const doc = hostDocument();
    const chat = doc.querySelector('#chat') || doc.body;
    if (!chat || typeof MutationObserver !== 'function') return;
    observer = new MutationObserver(() => schedule([80]));
    observer.observe(chat, { childList: true, subtree: true });
  }

  function bootstrap() {
    schedule();
    const events = getEvents();
    ['MESSAGE_RECEIVED', 'MESSAGE_UPDATED', 'MESSAGE_SWIPED', 'CHARACTER_MESSAGE_RENDERED', 'CHAT_CHANGED', 'MORE_MESSAGES_LOADED', 'GENERATION_ENDED'].forEach(key => listen(events[key], () => schedule()));
    bootObserver();
    try { $(window).on('pagehide', unmount); } catch (error) {}
  }

  function unmount() {
    stopped = true;
    timers.forEach(clearTimeout);
    observer?.disconnect();
    const doc = hostDocument();
    doc.querySelectorAll(HOST_SELECTOR).forEach(root => restore(root.closest('.mes_text') || root.parentElement));
    doc.getElementById(STYLE_ID)?.remove();
  }

  if (typeof $ === 'function') $(bootstrap);
  else setTimeout(bootstrap, 200);
})();
