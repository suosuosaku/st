import { extractCangxuanReadableContent } from '../utils/cangxuanParser';

const STYLE_ID = 'cangxuan-message-beautifier-style-v1-0-21';
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

const noticeVisuals: Record<string, { icon: string; tone: string }> = {
  获得物品: { icon: '◆', tone: 'item' },
  技能入库: { icon: '✦', tone: 'skill' },
  委托更新: { icon: '▣', tone: 'quest' },
  NPC收录: { icon: '●', tone: 'npc' },
  地点解锁: { icon: '▰', tone: 'location' },
  事件进展: { icon: '◇', tone: 'event' },
  升级提示: { icon: '▲', tone: 'level' },
  好感变化: { icon: '♥', tone: 'favor' },
  声望变化: { icon: '★', tone: 'reputation' },
  装备变更: { icon: '⬒', tone: 'equipment' },
  战斗实况: { icon: '⚔', tone: 'battle' },
  技能演出: { icon: '✧', tone: 'battle' },
};

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
  return /【[^】]{1,32}】[：:]\s*[“"]/.test(text)
    || /【(?:获得物品|技能入库|委托更新|NPC收录|地点解锁|事件进展|升级提示|好感变化|声望变化|装备变更|战斗实况|技能演出)】[：:]/.test(text)
    || /【[^】]{1,32}】[：:]\s*(?![“"])/.test(text)
    || /<战斗实况>|<技能演出>/.test(text);
}

function renderNotice(label: string, body: string): string {
  const visual = noticeVisuals[label] || { icon: '◆', tone: 'event' };
  const parts = body.split(/[｜|]/).map(item => item.trim()).filter(Boolean);
  const [title = body, ...details] = parts.length ? parts : [body];
  const detailRows = details
    .map(item => `<div class="cangxuan-notice-row">${escapeHtml(item)}</div>`)
    .join('');
  return [
    `<section class="cangxuan-notice-card cangxuan-notice-${visual.tone}">`,
    '<div class="cangxuan-notice-cap" aria-hidden="true"></div>',
    '<div class="cangxuan-notice-head">',
    `<span class="cangxuan-notice-icon">${escapeHtml(visual.icon)}</span>`,
    `<span class="cangxuan-notice-mark">【${escapeHtml(label)}】</span>`,
    '</div>',
    `<div class="cangxuan-notice-title">${escapeHtml(title || body)}</div>`,
    detailRows ? `<div class="cangxuan-notice-body">${detailRows}</div>` : '',
    '</section>',
  ].join('');
}

function renderBattleNotice(label: string, body: string): string {
  const visual = noticeVisuals[label] || noticeVisuals.战斗实况;
  const rows = body
    .split(/[；;\n]+/)
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const [key, ...rest] = item.split(/[：:]/);
      const value = rest.join('：').trim();
      if (!value) return `<div class="cangxuan-battle-line wide">${escapeHtml(item)}</div>`;
      return `<div class="cangxuan-battle-line"><b>${escapeHtml(key.trim())}</b><span>${escapeHtml(value)}</span></div>`;
    })
    .join('');
  return [
    `<section class="cangxuan-battle-card cangxuan-notice-${visual.tone}">`,
    '<div class="cangxuan-notice-cap" aria-hidden="true"></div>',
    '<div class="cangxuan-notice-head">',
    `<span class="cangxuan-notice-icon">${escapeHtml(visual.icon)}</span>`,
    `<span class="cangxuan-battle-mark">【${escapeHtml(label)}】</span>`,
    '</div>',
    `<div class="cangxuan-battle-grid">${rows || `<div class="cangxuan-battle-line wide">${escapeHtml(body)}</div>`}</div>`,
    '</section>',
  ].join('');
}

function renderDialogue(speaker: string, text: string): string {
  return [
    '<div class="cangxuan-dialogue-line">',
    `<img class="cangxuan-dialogue-avatar" src="${avatarUrl(speaker)}" alt="${escapeHtml(speaker)}" loading="lazy" />`,
    '<div class="cangxuan-dialogue-main">',
    `<div class="cangxuan-dialogue-name">【${escapeHtml(speaker)}】</div>`,
    `<div class="cangxuan-dialogue-bubble">${escapeHtml(text)}</div>`,
    '</div>',
    '</div>',
  ].join('');
}

function renderParagraph(text: string, index: number): string {
  if (/^\[时间\s+.+\]$/.test(text)) {
    return `<div class="cangxuan-time-chip">${escapeHtml(text.replace(/^\[时间\s+|\]$/g, ''))}</div>`;
  }
  return `<p class="cangxuan-narrative ${index === 0 ? 'first' : ''}">${escapeHtml(text)}</p>`;
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

    if (notice && !/^[“"]/.test(notice[2].trim())) {
      return renderNotice(notice[1].trim(), notice[2].trim());
    }

    const dialogue = line.match(/^【([^】]{1,32})】[：:]\s*[“"]([\s\S]+?)[”"]?$/);
    if (dialogue) {
      return renderDialogue(dialogue[1].trim(), dialogue[2].trim());
    }

    return renderParagraph(line, index);
  }).join('');

  return `<div class="cangxuan-chat-beautified">${html}</div>`;
}

export function installCangxuanMessageBeautifierStyles(): void {
  const doc = window.parent?.document || document;
  doc.querySelectorAll('style[id^="cangxuan-message-beautifier-style"]').forEach(node => {
    if (node.id !== STYLE_ID) node.remove();
  });
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.cangxuan-chat-beautified {
  --cangxuan-gold: #d6b35a;
  --cangxuan-gold-dim: rgba(214, 179, 90, 0.36);
  --cangxuan-ink: #f4e8ce;
  --cangxuan-panel: rgba(22, 17, 15, 0.86);
  --cangxuan-panel-2: rgba(52, 36, 25, 0.72);
  display: grid;
  gap: 10px;
  color: var(--cangxuan-ink);
  font-size: clamp(12px, 1.8vw, 15px);
  line-height: 1.72;
}
.cangxuan-dialogue-line {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}
.cangxuan-dialogue-avatar {
  width: 42px;
  height: 42px;
  object-fit: cover;
  image-rendering: auto;
  border: 1px solid var(--cangxuan-gold-dim);
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.28);
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.22);
}
.cangxuan-dialogue-name {
  color: var(--cangxuan-gold);
  font-family: serif;
  font-size: 1em;
  letter-spacing: 0;
  margin: 0 0 3px;
}
.cangxuan-dialogue-bubble {
  border: 1px solid var(--cangxuan-gold-dim);
  border-radius: 6px;
  background: linear-gradient(135deg, rgba(80, 53, 29, 0.56), rgba(13, 17, 23, 0.72));
  padding: 8px 10px;
  box-shadow: inset 0 0 18px rgba(214, 179, 90, 0.05);
  word-break: break-word;
}
.cangxuan-notice-card {
  --notice-accent: #d6b35a;
  --notice-dark: rgba(41, 25, 12, 0.96);
  position: relative;
  display: block;
  width: min(18.5rem, calc(100% - 18px));
  margin: 12px auto 14px;
  padding: 8px;
  border: 3px solid rgba(98, 61, 25, 0.95);
  border-radius: 0;
  background:
    linear-gradient(180deg, rgba(78, 44, 17, 0.96), rgba(31, 17, 8, 0.98)),
    repeating-linear-gradient(90deg, rgba(255, 225, 150, 0.05) 0 3px, transparent 3px 10px);
  box-shadow:
    inset 0 0 0 2px rgba(255, 226, 150, 0.13),
    5px 5px 0 rgba(41, 20, 4, 0.24),
    0 8px 18px rgba(0, 0, 0, 0.2);
  color: #573518;
  image-rendering: pixelated;
  clear: both;
}
.cangxuan-notice-item { --notice-accent: #d9b15f; }
.cangxuan-notice-skill { --notice-accent: #cbb7ff; }
.cangxuan-notice-quest { --notice-accent: #f0c461; }
.cangxuan-notice-npc { --notice-accent: #9fd0ff; }
.cangxuan-notice-location { --notice-accent: #9fe3a5; }
.cangxuan-notice-event { --notice-accent: #e5cf89; }
.cangxuan-notice-level { --notice-accent: #ffd76a; }
.cangxuan-notice-favor { --notice-accent: #ff9aaa; }
.cangxuan-notice-reputation { --notice-accent: #efd374; }
.cangxuan-notice-equipment { --notice-accent: #c8ccd2; }
.cangxuan-notice-battle { --notice-accent: #ff746c; }
.cangxuan-notice-cap {
  position: absolute;
  left: 20px;
  right: 20px;
  top: -7px;
  height: 7px;
  border: 2px solid rgba(98, 61, 25, 0.95);
  border-bottom: 0;
  background: linear-gradient(180deg, var(--notice-accent), #87551f);
  box-shadow: 3px 0 0 rgba(41, 20, 4, 0.18);
}
.cangxuan-notice-head {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 8px;
  align-items: stretch;
  min-height: 42px;
}
.cangxuan-notice-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid rgba(98, 61, 25, 0.95);
  background:
    linear-gradient(135deg, rgba(48, 24, 10, 0.98), rgba(112, 68, 26, 0.96)),
    repeating-linear-gradient(45deg, rgba(255, 226, 150, 0.15) 0 2px, transparent 2px 8px);
  color: var(--notice-accent);
  font-weight: 900;
  line-height: 1;
  box-shadow: inset 0 0 0 1px rgba(255, 226, 150, 0.18), 3px 3px 0 rgba(41, 20, 4, 0.2);
}
.cangxuan-notice-mark,
.cangxuan-battle-mark {
  display: flex;
  align-items: center;
  min-width: 0;
  border: 2px solid rgba(98, 61, 25, 0.95);
  border-radius: 0;
  background:
    linear-gradient(180deg, rgba(255, 234, 176, 0.96), rgba(214, 179, 90, 0.92)),
    repeating-linear-gradient(0deg, rgba(98, 61, 25, 0.07) 0 2px, transparent 2px 8px);
  color: #5b3214;
  padding: 0 8px;
  font-family: serif;
  font-weight: 900;
  line-height: 1.25;
  overflow-wrap: anywhere;
  box-shadow: inset 0 0 0 1px rgba(255, 248, 214, 0.55), 3px 3px 0 rgba(41, 20, 4, 0.16);
}
.cangxuan-notice-title {
  margin-top: 8px;
  border: 3px solid rgba(98, 61, 25, 0.92);
  border-radius: 0;
  background:
    linear-gradient(180deg, rgba(255, 235, 184, 0.94), rgba(236, 199, 124, 0.9)),
    repeating-linear-gradient(0deg, rgba(98, 61, 25, 0.04) 0 2px, transparent 2px 9px);
  color: #553418;
  padding: 8px 9px;
  font-weight: 800;
  line-height: 1.55;
  overflow-wrap: anywhere;
  box-shadow: inset 0 0 0 1px rgba(255, 248, 214, 0.72), 4px 4px 0 rgba(41, 20, 4, 0.16);
}
.cangxuan-notice-body {
  display: grid;
  gap: 5px;
  margin-top: 8px;
}
.cangxuan-notice-row {
  border-left: 3px solid rgba(98, 61, 25, 0.82);
  background: rgba(255, 247, 215, 0.26);
  color: #5f3b1e;
  padding: 4px 7px;
  line-height: 1.55;
  overflow-wrap: anywhere;
}
.cangxuan-battle-card {
  --notice-accent: #ff746c;
  position: relative;
  display: block;
  width: min(28rem, calc(100% - 18px));
  margin: 12px auto 14px;
  padding: 8px;
  border: 3px solid rgba(104, 43, 31, 0.95);
  border-radius: 0;
  background:
    linear-gradient(180deg, rgba(74, 18, 15, 0.96), rgba(25, 14, 15, 0.98)),
    repeating-linear-gradient(90deg, rgba(255, 116, 108, 0.05) 0 3px, transparent 3px 10px);
  box-shadow:
    inset 0 0 0 2px rgba(255, 180, 140, 0.12),
    5px 5px 0 rgba(41, 7, 4, 0.24);
  image-rendering: pixelated;
  clear: both;
}
.cangxuan-battle-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 8px;
}
.cangxuan-battle-line {
  display: grid;
  grid-template-columns: 5.5em minmax(0, 1fr);
  gap: 6px;
  border: 2px solid rgba(120, 66, 36, 0.58);
  border-radius: 0;
  background: rgba(255, 235, 184, 0.1);
  padding: 6px 7px;
}
.cangxuan-battle-line.wide {
  display: block;
  grid-column: 1 / -1;
}
.cangxuan-battle-line b {
  color: var(--notice-accent);
  font-size: 0.86em;
}
.cangxuan-battle-line span {
  min-width: 0;
  color: rgba(244, 232, 206, 0.82);
  overflow-wrap: anywhere;
}
.cangxuan-time-chip {
  width: fit-content;
  max-width: 100%;
  border: 1px solid rgba(214, 179, 90, 0.22);
  border-radius: 4px;
  padding: 2px 7px;
  color: rgba(244, 232, 206, 0.72);
  background: rgba(0, 0, 0, 0.22);
  font-size: 0.8em;
}
.cangxuan-narrative {
  margin: 0;
  color: rgba(244, 232, 206, 0.86);
  word-break: break-word;
}
@media (max-width: 520px) {
  .cangxuan-chat-beautified {
    font-size: 12px;
    gap: 8px;
  }
  .cangxuan-dialogue-line {
    grid-template-columns: 34px minmax(0, 1fr);
    gap: 8px;
  }
  .cangxuan-dialogue-avatar {
    width: 34px;
    height: 34px;
  }
  .cangxuan-dialogue-bubble {
    padding: 7px 8px;
  }
  .cangxuan-notice-card {
    width: min(18rem, calc(100% - 8px));
    margin: 10px auto 12px;
    padding: 7px;
  }
  .cangxuan-battle-card {
    width: min(100%, calc(100% - 8px));
    padding: 7px;
  }
  .cangxuan-notice-head {
    grid-template-columns: 36px minmax(0, 1fr);
    min-height: 36px;
    gap: 7px;
  }
  .cangxuan-notice-icon {
    border-width: 2px;
  }
  .cangxuan-notice-title {
    border-width: 2px;
    padding: 7px 8px;
  }
  .cangxuan-battle-grid,
  .cangxuan-battle-line {
    grid-template-columns: 1fr;
  }
}
`;
  doc.head.appendChild(style);
}

export function beautifyCangxuanMessage(messageId: number, rawMessage?: string): boolean {
  installCangxuanMessageBeautifierStyles();
  const messages = rawMessage === undefined ? getChatMessages(messageId, { role: 'assistant' }) : [];
  const messageText = rawMessage ?? messages[0]?.message ?? '';
  if (!messageText) return false;

  const readable = extractCangxuanReadableContent(messageText).content;
  if (!readable || !shouldBeautify(readable)) return false;

  const $display = retrieveDisplayedMessage(messageId);
  if (!$display.length || $display.find('#curEditTextarea').length) return false;

  $display.html(renderBeautifiedContent(readable));
  $display.attr('data-cangxuan-beautified', 'true');
  return true;
}

export function beautifyVisibleCangxuanMessages(): void {
  installCangxuanMessageBeautifierStyles();
  $('#chat > .mes').each((_index, node) => {
    const messageId = Number($(node).attr('mesid'));
    if (!Number.isNaN(messageId)) beautifyCangxuanMessage(messageId);
  });
}
