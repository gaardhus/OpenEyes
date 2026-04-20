'use strict';

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_SERVER_URL = 'http://127.0.0.1:4096';

// ─── Settings helpers ─────────────────────────────────────────────────────────

async function getSettings() {
  const data = await chrome.storage.local.get({
    backend: 'opencode',
    serverUrl: DEFAULT_SERVER_URL,
    sessionId: 'auto',
    username: '',
    password: '',
    token: '',
  });
  return data;
}

function authHeaders(settings) {
  if (!settings.password) return {};
  const creds = btoa(`${settings.username || 'opencode'}:${settings.password}`);
  return { Authorization: `Basic ${creds}` };
}

// ─── OpenCode API helpers ─────────────────────────────────────────────────────

async function apiFetch(path, opts = {}) {
  const settings = await getSettings();
  const base = settings.serverUrl.replace(/\/$/, '');
  const headers = {
    'Content-Type': 'application/json',
    ...authHeaders(settings),
    ...(opts.headers || {}),
  };
  return fetch(`${base}${path}`, { ...opts, headers });
}

async function resolveSessionId() {
  const settings = await getSettings();
  if (settings.sessionId && settings.sessionId !== 'auto') {
    return settings.sessionId;
  }
  // Auto-select: pick the most recently updated session
  const res = await apiFetch('/session');
  if (!res.ok) throw new Error(`Failed to list sessions: HTTP ${res.status}`);
  const sessions = await res.json();
  if (!sessions.length) throw new Error('No active sessions found. Start opencode first.');
  sessions.sort((a, b) => (b.time?.updated ?? 0) - (a.time?.updated ?? 0));
  return sessions[0].id;
}

// ─── Screenshot cropping (OffscreenCanvas — available in service workers) ────

async function cropScreenshot(dataUrl, rect, dpr) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const x = Math.round(rect.left * dpr);
  const y = Math.round(rect.top * dpr);
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));

  const canvas = new OffscreenCanvas(w, h);
  canvas.getContext('2d').drawImage(bitmap, x, y, w, h, 0, 0, w, h);
  bitmap.close();

  const resultBlob = await canvas.convertToBlob({ type: 'image/png' });
  const buffer = await resultBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ─── Message handlers ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CAPTURE_SCREENSHOT') {
    handleScreenshotCapture(message, sender).then(sendResponse);
    return true;
  }

  if (message.type === 'SEND_TO_OPENCODE') {
    handleSend(message.payload).then(sendResponse);
    return true;
  }

  if (message.type === 'ACTIVATE_PICKER_IN_TAB') {
    handleActivatePicker(message.tabId).then(sendResponse);
    return true;
  }
});

async function handleActivatePicker(tabId) {
  if (!tabId) return { ok: false, error: 'No tab id' };
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => window.__openeyes_loaded === true,
    }).catch(() => [{ result: false }]);

    if (!result?.result) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content_script.js'],
      });
    }
    await chrome.tabs.sendMessage(tabId, { type: 'ACTIVATE_PICKER' });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function handleScreenshotCapture(message, sender) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(sender.tab.windowId, {
      format: 'png',
    });
    const { rect, devicePixelRatio } = message;
    const base64 = await cropScreenshot(dataUrl, rect, devicePixelRatio || 1);
    return { ok: true, screenshotBase64: base64 };
  } catch (err) {
    console.error('[OpenEyes] Screenshot capture failed:', err);
    return { ok: false, screenshotBase64: null };
  }
}

async function handleSend(payload) {
  const settings = await getSettings();
  if (settings.backend === 'claudecode') return handleSendToClaudeCode(payload, settings);
  return handleSendToOpenCode(payload);
}

async function handleSendToOpenCode(payload) {
  try {
    const sessionId = await resolveSessionId();

    const parts = buildParts(payload);

    const res = await apiFetch(`/session/${sessionId}/message`, {
      method: 'POST',
      body: JSON.stringify({ parts }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `OpenCode API: HTTP ${res.status} — ${text}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function handleSendToClaudeCode(payload, settings) {
  try {
    const base = (settings.serverUrl || 'http://127.0.0.1:4097').replace(/\/$/, '');
    if (!settings.token) return { ok: false, error: 'Missing channel token' };

    const res = await fetch(`${base}/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OpenEyes-Token': settings.token,
      },
      body: JSON.stringify({
        instruction: payload.instruction,
        html: payload.html,
        url: payload.url,
        title: payload.title,
        cssSelector: payload.cssSelector,
        screenshotBase64: payload.screenshotBase64 || null,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Channel: HTTP ${res.status} — ${text}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ─── Message parts builder ────────────────────────────────────────────────────

function buildParts(payload) {
  const { instruction, html, url, title, cssSelector, screenshotBase64 } = payload;

  const lines = [
    `## ${instruction}`,
    '',
    `**Page:** [${title}](${url})`,
    `**Element:** \`${cssSelector}\``,
  ];

  if (html) {
    lines.push('', '```html', html, '```');
  }

  const textContent = lines.join('\n');

  const parts = [{ type: 'text', text: textContent }];

  if (screenshotBase64) {
    parts.push({
      type: 'file',
      mime: 'image/png',
      filename: 'element-screenshot.png',
      url: `data:image/png;base64,${screenshotBase64}`,
    });
  }

  return parts;
}
