// Cloud-Sync: Der komplette Zustand liegt als JSON-Datei in einem privaten GitHub-Repository.
// Jede Änderung wird nach kurzer Pause hochgeladen, beim Öffnen wird der neueste Stand geholt.
import { state, replaceState, onChange } from './store.js';

const KEY = 'zentrum.sync';
const API = 'https://api.github.com';
const FILE = 'zentrum.json';

export const sync = { token: '', owner: '', repo: 'zentrum-daten', lastSync: null, error: null, busy: false };
try { Object.assign(sync, JSON.parse(localStorage.getItem(KEY) || '{}'), { busy: false }); } catch {}
function persist() { const { token, owner, repo, lastSync, error } = sync; try { localStorage.setItem(KEY, JSON.stringify({ token, owner, repo, lastSync, error })); } catch {} }

export const isConnected = () => !!(sync.token && sync.owner);

const enc = s => btoa(unescape(encodeURIComponent(s)));
const dec = b => decodeURIComponent(escape(atob(b.replace(/\n/g, ''))));

async function gh(path, opts = {}) {
  const r = await fetch(API + path, { ...opts, headers: { Authorization: `Bearer ${sync.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opts.headers || {}) } });
  return r;
}
const filePath = () => `/repos/${sync.owner}/${sync.repo}/contents/${FILE}`;

async function fetchRemote() {
  const r = await gh(`${filePath()}?t=${Date.now()}`, { cache: 'no-store' });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub antwortet mit ${r.status}`);
  const j = await r.json();
  return { sha: j.sha, state: JSON.parse(dec(j.content)) };
}

let suppress = false;
function applyRemote(s) { suppress = true; try { replaceState(s); } finally { suppress = false; } }

export async function connect(token, repo) {
  sync.token = token.trim(); sync.repo = (repo || 'zentrum-daten').trim() || 'zentrum-daten';
  const u = await gh('/user');
  if (!u.ok) { sync.token = ''; throw new Error('Der Schlüssel wurde von GitHub nicht akzeptiert.'); }
  sync.owner = (await u.json()).login;
  const r = await gh(`/repos/${sync.owner}/${sync.repo}`);
  if (r.status === 404) {
    const c = await gh('/user/repos', { method: 'POST', body: JSON.stringify({ name: sync.repo, private: true, auto_init: true, description: 'Zentrum – private Daten' }) });
    if (!c.ok) throw new Error(`Das private Repository „${sync.repo}“ fehlt und konnte nicht angelegt werden. Bitte auf GitHub anlegen.`);
  } else if (!r.ok) throw new Error('Kein Zugriff auf das Repository.');
  sync.error = null; persist();
  const remote = await fetchRemote();
  if (remote?.state?.habits && (remote.state.updatedAt || '') > (state.updatedAt || '')) { applyRemote(remote.state); sync.lastSync = new Date().toISOString(); persist(); return 'pulled'; }
  await push(true);
  return 'pushed';
}

export function disconnect() { sync.token = ''; sync.owner = ''; sync.lastSync = null; sync.error = null; persist(); }

let dirty = false;
export async function push(force = false) {
  if (!isConnected()) return;
  if (sync.busy) { dirty = true; return; }
  sync.busy = true;
  try {
    const remote = await fetchRemote();
    if (!force && remote?.state?.updatedAt && remote.state.updatedAt > (state.updatedAt || '')) { applyRemote(remote.state); }
    else {
      const body = { message: `Zentrum ${new Date().toLocaleString('de-DE')}`, content: enc(JSON.stringify(state)), ...(remote ? { sha: remote.sha } : {}) };
      const r = await gh(filePath(), { method: 'PUT', body: JSON.stringify(body) });
      if (!r.ok) throw new Error(`Hochladen fehlgeschlagen (${r.status})`);
    }
    sync.lastSync = new Date().toISOString(); sync.error = null;
  } catch (e) { sync.error = e.message; }
  finally { sync.busy = false; persist(); document.dispatchEvent(new Event('sync:update')); if (dirty) { dirty = false; push(); } }
}

export async function pull() {
  if (!isConnected() || sync.busy) return false;
  sync.busy = true;
  try {
    const remote = await fetchRemote();
    if (remote?.state?.habits && (remote.state.updatedAt || '') > (state.updatedAt || '')) { applyRemote(remote.state); sync.lastSync = new Date().toISOString(); sync.error = null; return true; }
    sync.error = null;
  } catch (e) { sync.error = e.message; }
  finally { sync.busy = false; persist(); document.dispatchEvent(new Event('sync:update')); }
  return false;
}

let timer = null;
export function initSync() {
  onChange(() => { if (suppress || !isConnected()) return; clearTimeout(timer); timer = setTimeout(() => push(), 1500); });
  if (isConnected()) pull();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pull(); });
  window.addEventListener('online', () => { if (isConnected()) push(); });
}

export function statusText() {
  if (!isConnected()) return 'Nicht verbunden';
  if (sync.busy) return 'Synchronisiert …';
  if (sync.error) return `Fehler: ${sync.error}`;
  if (sync.lastSync) { const d = new Date(sync.lastSync); return `Zuletzt ${d.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' })} um ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`; }
  return 'Verbunden';
}
