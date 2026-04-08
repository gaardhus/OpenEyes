'use strict';

// Guard against double-injection
if (window.__openeyes_loaded) {
  // Already loaded — just re-register the message listener below (idempotent)
} else {
  window.__openeyes_loaded = true;
}

// ─── State ────────────────────────────────────────────────────────────────────

let pickerActive = false;
let hoveredEl = null;
let selectedEl = null;
let overlayContainer = null;
let shadowRoot = null;

// Persist toggle state across overlay opens within the same page session
let includeHtml = true;
let includeShot = true;

const HIGHLIGHT_STYLE = '2px solid #4f8ef7';
const SELECTED_STYLE = '2px solid #a6e3a1';

// ─── Picker ───────────────────────────────────────────────────────────────────

function activatePicker() {
  if (pickerActive) return;
  pickerActive = true;
  document.body.style.cursor = 'crosshair';
  document.addEventListener('mouseover', onHover, true);
  document.addEventListener('mouseout', onUnhover, true);
  document.addEventListener('click', onSelect, true);
  document.addEventListener('keydown', onKey, true);
}

function deactivatePicker() {
  if (!pickerActive) return;
  pickerActive = false;
  document.body.style.cursor = '';
  document.removeEventListener('mouseover', onHover, true);
  document.removeEventListener('mouseout', onUnhover, true);
  document.removeEventListener('click', onSelect, true);
  document.removeEventListener('keydown', onKey, true);

  if (hoveredEl && hoveredEl !== selectedEl) {
    hoveredEl.style.outline = '';
    hoveredEl.style.outlineOffset = '';
  }
  hoveredEl = null;
}

function onHover(e) {
  const el = e.target;
  if (el === overlayContainer || overlayContainer?.contains(el)) return;

  if (hoveredEl && hoveredEl !== selectedEl) {
    hoveredEl.style.outline = '';
    hoveredEl.style.outlineOffset = '';
  }
  hoveredEl = el;
  el.style.outline = HIGHLIGHT_STYLE;
  el.style.outlineOffset = '-2px';
}

function onUnhover(e) {
  const el = e.target;
  if (el === hoveredEl && el !== selectedEl) {
    el.style.outline = '';
    el.style.outlineOffset = '';
    hoveredEl = null;
  }
}

function onSelect(e) {
  const el = e.target;
  if (el === overlayContainer || overlayContainer?.contains(el)) return;

  e.preventDefault();
  e.stopPropagation();

  deactivatePicker();

  // Clear previous selection highlight
  if (selectedEl) {
    selectedEl.style.outline = '';
    selectedEl.style.outlineOffset = '';
  }

  selectedEl = el;
  el.style.outline = SELECTED_STYLE;
  el.style.outlineOffset = '-2px';

  captureAndShow(el);
}

function onKey(e) {
  if (e.key === 'Escape') {
    deactivatePicker();
    closeOverlay();
  }
}

// ─── Element info ─────────────────────────────────────────────────────────────

function getElementInfo(el) {
  const rect = el.getBoundingClientRect();
  return {
    tagName: el.tagName.toLowerCase(),
    cssSelector: buildSelector(el),
    outerHTML: el.outerHTML,
    url: window.location.href,
    title: document.title,
    rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
    devicePixelRatio: window.devicePixelRatio || 1,
  };
}

function buildSelector(el) {
  const parts = [];
  let current = el;
  while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.documentElement) {
    let part = current.nodeName.toLowerCase();
    if (current.id) {
      part += `#${CSS.escape(current.id)}`;
      parts.unshift(part);
      break;
    }
    const siblings = current.parentNode
      ? [...current.parentNode.children].filter(c => c.nodeName === current.nodeName)
      : [];
    if (siblings.length > 1) {
      part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
    }
    parts.unshift(part);
    current = current.parentNode;
  }
  return parts.join(' > ');
}

// ─── Screenshot + overlay ─────────────────────────────────────────────────────

async function captureAndShow(el) {
  const info = getElementInfo(el);

  // Request cropped screenshot from background
  let screenshotBase64 = null;
  try {
    const resp = await browser.runtime.sendMessage({
      type: 'CAPTURE_SCREENSHOT',
      rect: info.rect,
      devicePixelRatio: info.devicePixelRatio,
    });
    if (resp?.ok) screenshotBase64 = resp.screenshotBase64;
  } catch (_) {}

  showOverlay(el, info, screenshotBase64);
}

// ─── Overlay ──────────────────────────────────────────────────────────────────

function showOverlay(el, info, screenshotBase64) {
  closeOverlay(); // remove any existing overlay

  overlayContainer = document.createElement('div');
  overlayContainer.id = '__openeyes_root__';
  // Fixed-position zero-size host so it doesn't affect layout
  overlayContainer.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;';
  document.documentElement.appendChild(overlayContainer);

  shadowRoot = overlayContainer.attachShadow({ mode: 'open' });

  // Position panel near the element, keeping it on-screen
  const { top, left, width, height } = info.rect;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const panelW = 330;
  const panelH = 200; // estimated

  let px = Math.round(left);
  let py = Math.round(top + height + 10);
  if (py + panelH > vh) py = Math.max(8, Math.round(top - panelH - 10));
  if (px + panelW > vw) px = Math.max(8, vw - panelW - 8);

  const labelText = `<${info.tagName}> · ${truncate(info.cssSelector, 44)}`;

  shadowRoot.innerHTML = `
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      :host { all: initial; font-family: system-ui, sans-serif; }

      .panel {
        position: fixed;
        left: ${px}px;
        top: ${py}px;
        width: ${panelW}px;
        background: #1e1e2e;
        border: 1px solid #4f8ef7;
        border-radius: 10px;
        padding: 14px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        color: #cdd6f4;
        font-size: 13px;
        line-height: 1.4;
      }

      .header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
      }
      .dot {
        width: 8px; height: 8px;
        border-radius: 50%;
        background: #a6e3a1;
        flex-shrink: 0;
      }
      .tag {
        font-family: monospace;
        font-size: 11px;
        color: #89b4fa;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .close-btn {
        margin-left: auto;
        background: none;
        border: none;
        color: #6c7086;
        font-size: 16px;
        cursor: pointer;
        line-height: 1;
        padding: 0 2px;
        flex-shrink: 0;
      }
      .close-btn:hover { color: #cdd6f4; }

      hr { border: none; border-top: 1px solid #313244; margin-bottom: 10px; }

      label {
        display: block;
        font-size: 11px;
        color: #6c7086;
        margin-bottom: 5px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      textarea {
        width: 100%;
        background: #181825;
        border: 1px solid #313244;
        border-radius: 6px;
        color: #cdd6f4;
        font-size: 13px;
        font-family: system-ui, sans-serif;
        padding: 7px 9px;
        resize: vertical;
        min-height: 68px;
        outline: none;
        line-height: 1.4;
      }
      textarea:focus { border-color: #4f8ef7; }
      textarea::placeholder { color: #45475a; }

      .hint {
        font-size: 10px;
        color: #45475a;
        margin-top: 4px;
        margin-bottom: 8px;
      }

      .toggles {
        display: flex;
        gap: 6px;
        margin-bottom: 10px;
      }
      .toggle {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 3px 10px 3px 8px;
        border-radius: 20px;
        border: 1px solid #313244;
        background: #181825;
        color: #45475a;
        font-size: 11px;
        font-family: system-ui, sans-serif;
        cursor: pointer;
        user-select: none;
        transition: background 0.1s, color 0.1s, border-color 0.1s;
      }
      .toggle:hover:not(:disabled) { border-color: #45475a; color: #6c7086; }
      .toggle.active {
        background: rgba(79,142,247,0.12);
        border-color: #4f8ef7;
        color: #89b4fa;
      }
      .toggle.active:hover { background: rgba(79,142,247,0.2); }
      .toggle:disabled { opacity: 0.3; cursor: not-allowed; }
      .toggle-icon { font-size: 12px; line-height: 1; }

      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
      button {
        padding: 5px 14px;
        border-radius: 6px;
        border: none;
        cursor: pointer;
        font-size: 12px;
        font-family: system-ui, sans-serif;
        font-weight: 500;
      }
      .btn-cancel { background: #313244; color: #cdd6f4; }
      .btn-cancel:hover { background: #45475a; }
      .btn-send { background: #4f8ef7; color: #fff; }
      .btn-send:hover { background: #6ba3fa; }
      .btn-send:disabled { background: #45475a; cursor: not-allowed; color: #6c7086; }

      .status {
        font-size: 11px;
        margin-top: 6px;
        display: none;
        padding: 4px 8px;
        border-radius: 4px;
      }
      .status.sending { display: block; color: #89b4fa; background: #1e1e2e; }
      .status.success { display: block; color: #a6e3a1; background: #1e1e2e; }
      .status.error   { display: block; color: #f38ba8; background: #1e1e2e; }
    </style>

    <div class="panel" id="panel">
      <div class="header">
        <span class="dot"></span>
        <span class="tag" title="${escapeAttr(info.cssSelector)}">${escapeHtml(labelText)}</span>
        <button class="close-btn" id="close" title="Cancel (Esc)">×</button>
      </div>
      <hr>
      <label for="instruction">Instruction</label>
      <textarea id="instruction" placeholder="e.g. Summarise this, fix the bug, explain…" rows="3"></textarea>
      <div class="hint">Ctrl+Enter to send · Esc to cancel</div>
      <div class="toggles">
        <button class="toggle${includeHtml ? ' active' : ''}" id="tog-html">
          <span class="toggle-icon">⌥</span> Source
        </button>
        <button class="toggle${includeShot ? ' active' : ''}" id="tog-shot"${screenshotBase64 ? '' : ' disabled'}>
          <span class="toggle-icon">◈</span> Screenshot
        </button>
      </div>
      <div class="actions">
        <button class="btn-cancel" id="cancel">Cancel</button>
        <button class="btn-send" id="send">Send</button>
      </div>
      <div class="status" id="status"></div>
    </div>
  `;

  const textarea = shadowRoot.getElementById('instruction');
  const sendBtn  = shadowRoot.getElementById('send');
  const status   = shadowRoot.getElementById('status');

  shadowRoot.getElementById('close').addEventListener('click', () => {
    closeOverlay();
    clearSelection();
  });
  shadowRoot.getElementById('cancel').addEventListener('click', () => {
    closeOverlay();
    clearSelection();
  });

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeOverlay(); clearSelection(); return; }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      doSend();
    }
  });

  sendBtn.addEventListener('click', doSend);

  // Toggles
  const togHtml = shadowRoot.getElementById('tog-html');
  const togShot = shadowRoot.getElementById('tog-shot');

  togHtml.addEventListener('click', () => {
    includeHtml = !includeHtml;
    togHtml.classList.toggle('active', includeHtml);
  });
  togShot.addEventListener('click', () => {
    includeShot = !includeShot;
    togShot.classList.toggle('active', includeShot);
  });

  // Focus the textarea after a tick so the keydown Escape doesn't immediately close
  setTimeout(() => textarea.focus(), 50);

  async function doSend() {
    const instruction = textarea.value.trim();
    if (!instruction) {
      textarea.focus();
      return;
    }

    sendBtn.disabled = true;
    setStatus('sending', 'Sending to OpenCode…');

    const payload = {
      instruction,
      html: includeHtml ? info.outerHTML : null,
      url: info.url,
      title: info.title,
      cssSelector: info.cssSelector,
      screenshotBase64: (includeShot && screenshotBase64) ? screenshotBase64 : null,
    };

    const result = await browser.runtime.sendMessage({ type: 'SEND_TO_OPENCODE', payload });

    if (result?.ok) {
      setStatus('success', 'Sent to OpenCode!');
      setTimeout(() => { closeOverlay(); clearSelection(); }, 1800);
    } else {
      setStatus('error', result?.error ?? 'Unknown error');
      sendBtn.disabled = false;
    }
  }

  function setStatus(cls, text) {
    status.className = `status ${cls}`;
    status.textContent = text;
  }
}

function closeOverlay() {
  if (overlayContainer) {
    overlayContainer.remove();
    overlayContainer = null;
    shadowRoot = null;
  }
}

function clearSelection() {
  if (selectedEl) {
    selectedEl.style.outline = '';
    selectedEl.style.outlineOffset = '';
    selectedEl = null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(str, max) {
  return str.length > max ? '…' + str.slice(-(max - 1)) : str;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;');
}

// ─── Message listener ─────────────────────────────────────────────────────────

browser.runtime.onMessage.addListener((message) => {
  if (message.type === 'ACTIVATE_PICKER') {
    closeOverlay();
    clearSelection();
    activatePicker();
  }
});
