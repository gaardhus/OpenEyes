'use strict';

const DEFAULTS = {
  opencode: 'http://127.0.0.1:4096',
  claudecode: 'http://127.0.0.1:4097',
};

const $ = (id) => document.getElementById(id);

// ─── Load settings ────────────────────────────────────────────────────────────

async function loadSettings() {
  const data = await browser.storage.local.get({
    backend: 'opencode',
    serverUrl: DEFAULTS.opencode,
    sessionId: 'auto',
    password: '',
    token: '',
  });

  $('backend-select').value = data.backend;
  $('server-url').value = data.serverUrl;
  $('auth-password').value = data.password;
  $('auth-token').value = data.token;

  applyBackendUI(data.backend);

  if (data.backend === 'opencode') {
    await refreshSessions(data);
  } else {
    await checkClaudeCodeHealth(data.serverUrl);
  }
}

function applyBackendUI(backend) {
  const isOpenCode = backend === 'opencode';
  $('session-field').style.display = isOpenCode ? '' : 'none';
  $('password-field').style.display = isOpenCode ? '' : 'none';
  $('token-field').style.display = isOpenCode ? 'none' : '';
}

// ─── Health checks ────────────────────────────────────────────────────────────

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

async function checkClaudeCodeHealth(serverUrl) {
  const dot = $('status-dot');
  const txt = $('status-text');

  dot.className = 'status-dot loading';
  txt.textContent = 'Connecting…';

  try {
    const res = await fetch(`${serverUrl.replace(/\/$/, '')}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    dot.className = 'status-dot ok';
    txt.textContent = `Channel ready${data.version ? ` · ${data.version}` : ''}`;
    return true;
  } catch (err) {
    dot.className = 'status-dot error';
    txt.textContent = `Offline — ${err.message}`;
    return false;
  }
}

// ─── Sessions (OpenCode only) ─────────────────────────────────────────────────

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
    while (sel.options.length > 1) sel.remove(1);

    for (const s of sessions) {
      const opt = document.createElement('option');
      opt.value = s.id;
      const ago = relativeTime(s.time?.updated);
      opt.textContent = `${s.title || s.id.slice(0, 8)} (${ago})`;
      sel.appendChild(opt);
    }

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
  const backend = $('backend-select').value;
  const settings = {
    backend,
    serverUrl: $('server-url').value.trim() || DEFAULTS[backend],
    sessionId: $('session-select').value,
    password:  $('auth-password').value,
    token:     $('auth-token').value,
  };

  await browser.storage.local.set(settings);

  const confirm = $('save-confirm');
  confirm.textContent = 'Saved!';
  setTimeout(() => { confirm.textContent = ''; }, 1500);
}

// ─── Backend switch ───────────────────────────────────────────────────────────

function onBackendChange() {
  const backend = $('backend-select').value;
  applyBackendUI(backend);

  // Swap default URL if current value matches the *other* default
  const url = $('server-url').value.trim();
  const other = backend === 'opencode' ? DEFAULTS.claudecode : DEFAULTS.opencode;
  if (url === '' || url === other) $('server-url').value = DEFAULTS[backend];

  if (backend === 'opencode') refreshSessions(null);
  else checkClaudeCodeHealth($('server-url').value);
}

// ─── Pick element ─────────────────────────────────────────────────────────────

async function pickElement() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  await browser.runtime.sendMessage({ type: 'ACTIVATE_PICKER_IN_TAB', tabId: tab.id });
  window.close();
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
$('backend-select').addEventListener('change', onBackendChange);
$('server-url').addEventListener('change', () => {
  if ($('backend-select').value === 'opencode') refreshSessions(null);
  else checkClaudeCodeHealth($('server-url').value);
});

loadSettings();
