import { extractEldredReadableContent } from '../utils/eldredParser';

const STYLE_ID = 'eldred-message-beautifier-style';
const R2_BASE = 'https://pub-0b945c39f816498d833c1a7e27007410.r2.dev/';

const noticeLabels = new Set([
  '获得物品',
  '技能入库',
  '委托更新',
  'NPC收录',
  '地点解锁',
  '事件进展',
  '升级提示',
  '好感变化',
  '声望变化',
  '装备变更',
  '战斗实况',
  '技能演出',
]);

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function avatarUrl(name: string): string {
  return `${R2_BASE}${encodeURIComponent(`${name}头像.png`)}`;
}

function normalizeSpecialBlocks(text: string): string {
  return text
    .replace(/<战斗实况>([\s\S]*?)<\/战斗实况>/g, (_match, body) => `\n【战斗实况】：${String(body).trim()}\n`)
    .replace(/<技能演出>([\s\S]*?)<\/技能演出>/g, (_match, body) => `\n【技能演出】：${String(body).trim()}\n`);
}

function shouldBeautify(text: string): boolean {
  return /【[^】]{1,32}】[：:][“"]/.test(text)
    || /【(?:获得物品|技能入库|委托更新|NPC收录|地点解锁|事件进展|升级提示|好感变化|声望变化|装备变更|战斗实况|技能演出)】[：:]/.test(text)
    || /<战斗实况>|<技能演出>/.test(text);
}

function renderNotice(label: string, body: string): string {
  const [title = '', source = '', effect = ''] = body.split(/[｜|]/).map(item => item.trim());
  return [
    '<div class="eldred-notice-card">',
    `<div class="eldred-notice-mark">${escapeHtml(label)}</div>`,
    '<div class="eldred-notice-body">',
    `<div class="eldred-notice-title">${escapeHtml(title || body)}</div>`,
    source ? `<div class="eldred-notice-meta">${escapeHtml(source)}</div>` : '',
    effect ? `<div class="eldred-notice-text">${escapeHtml(effect)}</div>` : '',
    '</div>',
    '</div>',
  ].join('');
}

function renderBattleNotice(label: string, body: string): string {
  const rows = body
    .split(/[；;\n]+/)
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const [key, ...rest] = item.split(/[：:]/);
      const value = rest.join('：').trim();
      if (!value) return `<div class="eldred-battle-line wide">${escapeHtml(item)}</div>`;
      return `<div class="eldred-battle-line"><b>${escapeHtml(key.trim())}</b><span>${escapeHtml(value)}</span></div>`;
    })
    .join('');
  return [
    '<div class="eldred-battle-card">',
    `<div class="eldred-battle-mark">${escapeHtml(label)}</div>`,
    `<div class="eldred-battle-grid">${rows || `<div class="eldred-battle-line wide">${escapeHtml(body)}</div>`}</div>`,
    '</div>',
  ].join('');
}

function renderDialogue(speaker: string, text: string): string {
  return [
    '<div class="eldred-dialogue-line">',
    `<img class="eldred-dialogue-avatar" src="${avatarUrl(speaker)}" alt="${escapeHtml(speaker)}" loading="lazy" />`,
    '<div class="eldred-dialogue-main">',
    `<div class="eldred-dialogue-name">【${escapeHtml(speaker)}】</div>`,
    `<div class="eldred-dialogue-bubble">${escapeHtml(text)}</div>`,
    '</div>',
    '</div>',
  ].join('');
}

function renderParagraph(text: string, index: number): string {
  if (/^\[时间\s+.+\]$/.test(text)) {
    return `<div class="eldred-time-chip">${escapeHtml(text.replace(/^\[时间\s+|\]$/g, ''))}</div>`;
  }
  return `<p class="eldred-narrative ${index === 0 ? 'first' : ''}">${escapeHtml(text)}</p>`;
}

function renderBeautifiedContent(rawContent: string): string {
  const content = normalizeSpecialBlocks(rawContent);
  const blocks = content.split(/\n+/).map(line => line.trim()).filter(Boolean);
  const html = blocks.map((line, index) => {
    const notice = line.match(/^【([^】]+)】[：:]\s*(.+)$/);
    if (notice && noticeLabels.has(notice[1])) {
      if (notice[1] === '战斗实况' || notice[1] === '技能演出') {
        return renderBattleNotice(notice[1], notice[2]);
      }
      return renderNotice(notice[1], notice[2]);
    }

    const dialogue = line.match(/^【([^】]{1,32})】[：:][“"]?([\s\S]+?)[”"]?$/);
    if (dialogue) {
      return renderDialogue(dialogue[1].trim(), dialogue[2].trim());
    }

    return renderParagraph(line, index);
  }).join('');

  return `<div class="eldred-chat-beautified">${html}</div>`;
}

export function installEldredMessageBeautifierStyles(): void {
  const doc = window.parent?.document || document;
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.eldred-chat-beautified {
  --eldred-gold: #d6b35a;
  --eldred-gold-dim: rgba(214, 179, 90, 0.36);
  --eldred-ink: #f4e8ce;
  --eldred-panel: rgba(22, 17, 15, 0.86);
  --eldred-panel-2: rgba(52, 36, 25, 0.72);
  display: grid;
  gap: 10px;
  color: var(--eldred-ink);
  font-size: clamp(12px, 1.8vw, 15px);
  line-height: 1.72;
}
.eldred-dialogue-line {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}
.eldred-dialogue-avatar {
  width: 42px;
  height: 42px;
  object-fit: cover;
  image-rendering: auto;
  border: 1px solid var(--eldred-gold-dim);
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.28);
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.22);
}
.eldred-dialogue-name {
  color: var(--eldred-gold);
  font-family: serif;
  font-size: 1em;
  letter-spacing: 0;
  margin: 0 0 3px;
}
.eldred-dialogue-bubble {
  border: 1px solid var(--eldred-gold-dim);
  border-radius: 6px;
  background: linear-gradient(135deg, rgba(80, 53, 29, 0.56), rgba(13, 17, 23, 0.72));
  padding: 8px 10px;
  box-shadow: inset 0 0 18px rgba(214, 179, 90, 0.05);
  word-break: break-word;
}
.eldred-notice-card {
  display: grid;
  grid-template-columns: minmax(76px, auto) minmax(0, 1fr);
  gap: 10px;
  align-items: stretch;
  border: 1px solid var(--eldred-gold-dim);
  border-radius: 6px;
  background: linear-gradient(135deg, rgba(214, 179, 90, 0.12), rgba(16, 24, 32, 0.78));
  overflow: hidden;
}
.eldred-battle-card {
  display: grid;
  gap: 8px;
  border: 1px solid rgba(220, 60, 60, 0.36);
  border-radius: 6px;
  background: linear-gradient(135deg, rgba(88, 20, 20, 0.42), rgba(16, 16, 24, 0.86));
  padding: 10px;
  box-shadow: inset 0 0 22px rgba(214, 179, 90, 0.04);
}
.eldred-battle-mark {
  width: fit-content;
  border: 1px solid rgba(214, 179, 90, 0.42);
  border-radius: 4px;
  color: #24170d;
  background: linear-gradient(180deg, #d6b35a, #9b6b27);
  padding: 3px 8px;
  font-weight: 800;
  font-size: 0.82em;
}
.eldred-battle-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}
.eldred-battle-line {
  display: grid;
  grid-template-columns: 5.5em minmax(0, 1fr);
  gap: 6px;
  border: 1px solid rgba(214, 179, 90, 0.14);
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.18);
  padding: 6px 7px;
}
.eldred-battle-line.wide {
  display: block;
  grid-column: 1 / -1;
}
.eldred-battle-line b {
  color: var(--eldred-gold);
  font-size: 0.86em;
}
.eldred-battle-line span {
  min-width: 0;
  color: rgba(244, 232, 206, 0.82);
  overflow-wrap: anywhere;
}
.eldred-notice-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  color: #1a120b;
  background: var(--eldred-gold);
  font-weight: 700;
  font-size: 0.78em;
  text-align: center;
}
.eldred-notice-body {
  min-width: 0;
  padding: 8px 10px;
}
.eldred-notice-title {
  color: var(--eldred-ink);
  font-weight: 700;
}
.eldred-notice-meta,
.eldred-notice-text {
  color: rgba(244, 232, 206, 0.68);
  font-size: 0.84em;
  margin-top: 2px;
}
.eldred-time-chip {
  width: fit-content;
  max-width: 100%;
  border: 1px solid rgba(214, 179, 90, 0.22);
  border-radius: 4px;
  padding: 2px 7px;
  color: rgba(244, 232, 206, 0.72);
  background: rgba(0, 0, 0, 0.22);
  font-size: 0.8em;
}
.eldred-narrative {
  margin: 0;
  color: rgba(244, 232, 206, 0.86);
  word-break: break-word;
}
@media (max-width: 520px) {
  .eldred-chat-beautified {
    font-size: 12px;
    gap: 8px;
  }
  .eldred-dialogue-line {
    grid-template-columns: 34px minmax(0, 1fr);
    gap: 8px;
  }
  .eldred-dialogue-avatar {
    width: 34px;
    height: 34px;
  }
  .eldred-dialogue-bubble {
    padding: 7px 8px;
  }
  .eldred-notice-card {
    grid-template-columns: 1fr;
    gap: 0;
  }
  .eldred-battle-grid,
  .eldred-battle-line {
    grid-template-columns: 1fr;
  }
  .eldred-notice-mark {
    justify-content: flex-start;
    padding: 5px 8px;
  }
}
`;
  doc.head.appendChild(style);
}

export function beautifyEldredMessage(messageId: number, rawMessage?: string): boolean {
  installEldredMessageBeautifierStyles();
  const messages = rawMessage === undefined ? getChatMessages(messageId, { role: 'assistant' }) : [];
  const messageText = rawMessage ?? messages[0]?.message ?? '';
  if (!messageText) return false;

  const readable = extractEldredReadableContent(messageText).content;
  if (!readable || !shouldBeautify(readable)) return false;

  const $display = retrieveDisplayedMessage(messageId);
  if (!$display.length || $display.find('#curEditTextarea').length) return false;

  $display.html(renderBeautifiedContent(readable));
  $display.attr('data-eldred-beautified', 'true');
  return true;
}

export function beautifyVisibleEldredMessages(): void {
  installEldredMessageBeautifierStyles();
  $('#chat > .mes').each((_index, node) => {
    const messageId = Number($(node).attr('mesid'));
    if (!Number.isNaN(messageId)) beautifyEldredMessage(messageId);
  });
}
