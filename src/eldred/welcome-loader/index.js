(() => {
  const BUILD_ID = 'eldred-welcome-loader-v3.2.1';
  const APP_BUILD_ID = 'eldred-welcome-v3.2.1';
  const GLOBAL_KEY = '__eldredWelcomeLoader';
  const HTML_URL = globalThis.__ELDRED_WELCOME_HTML_URL__
    || 'https://testingcf.jsdelivr.net/gh/suosuosaku/st@eldred-welcome-v3.2.1/dist/eldred/welcome/index.html';
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
    iframe.src = `${HTML_URL}?build=${encodeURIComponent(APP_BUILD_ID)}&hostId=${encodeURIComponent(root.dataset.hostId)}`;
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
