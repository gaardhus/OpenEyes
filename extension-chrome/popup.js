'use strict';

const DEFAULT_SERVER_URL = 'http://127.0.0.1:4096';

const $ = (id) => document.getElementById(id);

// ─── Load settings ────────────────────────────────────────────────────────────

async function loadSettings() {
  const data = await chrome.storage.local.get({
    serverUrl: DEFAULT_SERVER_URL,
    sessionId: 'auto',
    password: '',
  });

  $('server-url').value = data.serverUrl;
  $('auth-password').value = data.password;

  await refreshSessions(data);
}

// ─── Health check ─────────────────────────────────────────────────────────────

async function checkHealth(serverUrl, password) {
  const dot = $('status-dot');
  const txt = $('status-text');

  dot.className = 'status-dot loading';
  txt.textContent = 'Connecting…';

  try {
    const headers = password
      ? { Authorization: `Basic ${btoa(`opencode:${password}`)}` }
      : {};

    const res = await fetch(`${serverUrl.replace(/\/$/, '')}/global/health`, { headers });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    dot.className = 'status-dot ok';
    txt.textContent = `Connected${data.version ? ` · ${data.version}` : ''}`;
    return true;
  } catch (err) {
    dot.className = 'status-dot error';
    txt.textContent = `Offline — ${err.message}`;
    return false;
  }
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

async function refreshSessions(settings) {
  const serverUrl = (settings?.serverUrl ?? $('server-url').value).replace(/\/$/, '');
  const password  = settings?.password ?? $('auth-password').value;
  const savedId   = settings?.sessionId ?? 'auto';

  const ok = await checkHealth(serverUrl, password);
  if (!ok) return;

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (password) headers.Authorization = `Basic ${btoa(`opencode:${password}`)}`;

    const res = await fetch(`${serverUrl}/session`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const sessions = await res.json();
    sessions.sort((a, b) => (b.time?.updated ?? 0) - (a.time?.updated ?? 0));

    const sel = $('session-select');
    // Keep the "auto" option, remove old session entries
    while (sel.options.length > 1) sel.remove(1);

    for (const s of sessions) {
      const opt = document.createElement('option');
      opt.value = s.id;
      const ago = relativeTime(s.time?.updated);
      opt.textContent = `${s.title || s.id.slice(0, 8)} (${ago})`;
      sel.appendChild(opt);
    }

    // Restore saved selection
    if (savedId !== 'auto') {
      const match = [...sel.options].find(o => o.value === savedId);
      if (match) sel.value = savedId;
    }
  } catch (err) {
    $('status-text').textContent = `Sessions error: ${err.message}`;
  }
}

// ─── Save settings ────────────────────────────────────────────────────────────

async function saveSettings() {
  const settings = {
    serverUrl: $('server-url').value.trim() || DEFAULT_SERVER_URL,
    sessionId: $('session-select').value,
    password:  $('auth-password').value,
  };

  await chrome.storage.local.set(settings);

  const confirm = $('save-confirm');
  confirm.textContent = 'Saved!';
  setTimeout(() => { confirm.textContent = ''; }, 1500);
}

// ─── Pick element ─────────────────────────────────────────────────────────────

async function pickElement() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  // Delegate to background so it can executeScript
  await chrome.runtime.sendMessage({ type: 'ACTIVATE_PICKER_IN_TAB', tabId: tab.id });

  window.close(); // close popup so picker is visible
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(ms) {
  if (!ms) return '?';
  const diff = Date.now() - ms;
  if (diff < 60_000)  return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ─── Wire up ──────────────────────────────────────────────────────────────────

$('btn-pick').addEventListener('click', pickElement);
$('btn-refresh').addEventListener('click', () => refreshSessions(null));
$('btn-save').addEventListener('click', saveSettings);
$('server-url').addEventListener('change', () => refreshSessions(null));

loadSettings();
