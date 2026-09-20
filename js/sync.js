// Cloud-Sync: Der komplette Zustand liegt als JSON-Datei in einem privaten GitHub-Repository.
// Jede Änderung wird nach kurzer Pause hochgeladen, beim Öffnen wird der neueste Stand geholt.
import { state, replaceState, onChange, update } from './store.js';
import { imgGet, imgPut, imgKeys, blobToBase64 } from './images.js';

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
  let changed = false;
  try {
    const remote = await fetchRemote();
    if (remote?.state?.habits && (remote.state.updatedAt || '') > (state.updatedAt || '')) { applyRemote(remote.state); sync.lastSync = new Date().toISOString(); changed = true; }
    sync.error = null;
  } catch (e) { sync.error = e.message; }
  finally { sync.busy = false; persist(); document.dispatchEvent(new Event('sync:update')); }
  try { if (await importInbox()) changed = true; } catch (e) { console.warn('Inbox', e); }
  try { await syncVisionImages(); } catch (e) { console.warn('Bilder', e); }
  return changed;
}

/* ---------- Posteingang: Dateien, die der Kurzbefehl ablegt (inbox/*.txt) ----------
   Zeilenformat: typ,datum,wert   z. B.  steps,2026-09-19,8432  oder  weight,2026-09-19,78.4 */
export async function importInbox() {
  if (!isConnected()) return false;
  const r = await gh(`/repos/${sync.owner}/${sync.repo}/contents/inbox?t=${Date.now()}`, { cache: 'no-store' });
  if (r.status === 404) return false;
  if (!r.ok) throw new Error(`Inbox ${r.status}`);
  const files = (await r.json()).filter(f => f.type === 'file');
  if (!files.length) return false;
  const steps = {}, weight = {}, health = {}, workouts = [];
  const processed = [];
  for (const f of files) {
    const path = encodeURIComponent('inbox/' + f.name);
    const fr = await gh(`/repos/${sync.owner}/${sync.repo}/contents/${path}?t=${Date.now()}`, { headers: { Accept: 'application/vnd.github.raw+json' }, cache: 'no-store' });
    if (!fr.ok) continue;
    const text = await fr.text();
    // Datum der Ablage (für „heute“/„gestern“ in der Datei)
    let fileDay = null;
    const needsDay = /\b(heute|gestern|today|yesterday)\b/i.test(text) || text.split(/\r?\n/).some(l => l.trim().split(/[,;]\s*/).length === 2);
    if (needsDay) {
      const cr = await gh(`/repos/${sync.owner}/${sync.repo}/commits?path=inbox/${encodeURIComponent(f.name)}&per_page=1&t=${Date.now()}`, { cache: 'no-store' });
      if (cr.ok) { const c = (await cr.json())[0]; const iso = c?.commit?.committer?.date || c?.commit?.author?.date; if (iso) { const d = new Date(iso); fileDay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; } }
      if (!fileDay) fileDay = dateKeyLocal();
    }
    for (const line of text.split(/\r?\n/)) {
      let parts = line.trim().split(/[,;]\s*/);
      if (parts.length < 2) continue;
      const type = parts[0].toLowerCase().trim();
      if (type === 'workout' || type === 'training') {
        // workout,<datum>,<Art>,<Minuten>,<Ø Puls>,<km>
        const date = normalizeDate(parts[1], fileDay); if (!date) continue;
        const kindRaw = (parts[2] || '').trim(); const minutes = Math.round(parseDurationMin(parts[3] || '')) || 0;
        const avgHr = Math.round(parseNum(parts[4] || '')) || 0; const km = Math.round((parseNum(parts[5] || '') || 0) * 100) / 100;
        if (minutes >= 5) workouts.push({ date, kind: mapWorkoutKind(kindRaw), minutes, avgHr, km, note: `Apple Watch: ${kindRaw}` });
        continue;
      }
      if (parts.length === 2) parts = [parts[0], 'heute', parts[1]]; // Zeile ohne Datum: Tag der Übertragung
      if (parts.length < 3) continue;
      const date = normalizeDate(parts[1], fileDay);
      const val = parseNum(parts.slice(2).join(','));
      if (!date || !(val >= 0)) continue;
      if (type.startsWith('step') || type.startsWith('schritt')) steps[date] = Math.max(steps[date] || 0, Math.round(val));
      else if (type.startsWith('weight') || type.startsWith('gewicht')) weight[date] = Math.round(val * 10) / 10;
      else if (type.startsWith('sleep') || type.startsWith('schlaf')) { const raw = parts.slice(2).join(','); const mins = /:/.test(raw) || /min|std|\bh\b|sek|\bs\b/i.test(raw) ? parseDurationMin(raw) : (val > 20 ? val : val * 60); (health[date] ||= {}).sleep = Math.round(mins / 60 * 100) / 100; }
      else if (type === 'rhr' || type.startsWith('ruhepuls') || type.startsWith('resting')) (health[date] ||= {}).rhr = Math.round(val);
      else if (type === 'hrv' || type.startsWith('hrv')) (health[date] ||= {}).hrv = Math.round(val);
      else if (type.startsWith('vo2')) (health[date] ||= {}).vo2 = Math.round(val * 10) / 10;
    }
    processed.push(f);
  }
  const any = Object.keys(steps).length || Object.keys(weight).length || Object.keys(health).length || workouts.length;
  if (any) update(s => {
    for (const [d, v] of Object.entries(steps)) if (v > 0) s.steps[d] = v;
    for (const [d, kg] of Object.entries(weight)) if (kg > 20 && kg < 400) { s.weight = s.weight.filter(x => x.date !== d); s.weight.push({ date: d, kg }); }
    for (const [d, h] of Object.entries(health)) { s.health ||= {}; s.health[d] = { ...(s.health[d] || {}), ...h }; }
    // Trainings von der Watch: nur eintragen, wenn an dem Tag noch nichts steht; längstes Training des Tages gewinnt
    for (const w of workouts) {
      const hasPlan = (s.training?.sessions || []).some(x => x.date === w.date);
      const existing = s.freeWorkouts?.[w.date];
      if (hasPlan) continue;
      if (existing && !(existing.note || '').startsWith('Apple Watch') ) continue;
      if (existing && existing.minutes >= w.minutes) continue;
      (s.freeWorkouts ||= {})[w.date] = { kind: w.kind, minutes: w.minutes, avgHr: w.avgHr, km: w.km, load: 0, note: w.note, at: new Date().toISOString() };
    }
    s.lastImport = new Date().toISOString();
  });
  for (const f of processed) {
    await gh(`/repos/${sync.owner}/${sync.repo}/contents/${encodeURIComponent('inbox/' + f.name)}`, { method: 'DELETE', body: JSON.stringify({ message: 'verarbeitet', sha: f.sha }) });
  }
  return !!any;
}
// Dauer robust in Minuten: „45 min“, „0:45:12“, „45:12“, „1 h 20 min“, „2700 s“, „7,4 h“
function parseDurationMin(t) {
  t = String(t || '').trim().toLowerCase();
  if (!t) return NaN;
  if (/:/.test(t)) { const p = t.split(':').map(x => parseFloat(x) || 0); if (p.length === 3) return p[0] * 60 + p[1] + p[2] / 60; if (p.length === 2) return p[0] + p[1] / 60; }
  let total = 0, found = false;
  const h = t.match(/([\d.,]+)\s*(h|std|hour|hr)/); if (h) { total += parseFloat(h[1].replace(',', '.')) * 60; found = true; }
  const m = t.match(/([\d.,]+)\s*(min|m\b)/); if (m) { total += parseFloat(m[1].replace(',', '.')); found = true; }
  const sec = t.match(/([\d.,]+)\s*(sek|sec|s\b)/); if (sec) { total += parseFloat(sec[1].replace(',', '.')) / 60; found = true; }
  if (found) return total;
  const n = parseNum(t); return n > 600 ? n / 60 : n; // nackte Zahl: über 600 → Sekunden, sonst Minuten
}
function mapWorkoutKind(raw) {
  const t = String(raw).toLowerCase();
  if (/walk|geh|wander|hik|ruck/.test(t)) return 'Spaziergang';
  if (/run|lauf|jog/.test(t)) return 'Laufen';
  if (/cycl|rad|bike/.test(t)) return 'Radfahren';
  if (/swim|schwimm/.test(t)) return 'Schwimmen';
  if (/strength|kraft|functional|core/.test(t)) return 'Kraft';
  if (/hiit|interval|cardio|elliptical|rower|rudern|stair|treppe/.test(t)) return 'Ausdauer';
  if (/yoga|flex|mobility|stretch|cooldown|pilates/.test(t)) return 'Mobility';
  return 'Sport';
}
function dateKeyLocal(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function shiftDay(k, n) { const [y, m, d] = k.split('-').map(Number); const x = new Date(y, m - 1, d + n); return dateKeyLocal(x); }
// Versteht: heute/gestern, 2026-09-19, 19-09-2026, 19.09.2026, 19/09/2026, jeweils auch mit Uhrzeit dahinter
function normalizeDate(t, fileDay) {
  t = String(t).trim();
  const low = t.toLowerCase();
  if (/^(heute|today)\b/.test(low)) return fileDay || dateKeyLocal();
  if (/^(gestern|yesterday)\b/.test(low)) return shiftDay(fileDay || dateKeyLocal(), -1);
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(t); if (!isNaN(d)) return dateKeyLocal(d);
  return null;
}
// Zahlen wie „8432“, „8.432“, „78,4 kg“, „78.4“, „8432,0“ robust lesen
function parseNum(t) {
  let s = String(t).replace(/[^\d.,-]/g, '');
  if (!s) return NaN;
  const hasDot = s.includes('.'), hasComma = s.includes(',');
  if (hasDot && hasComma) { if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, ''); }
  else if (hasComma) s = s.replace(',', '.');
  else if (hasDot && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  return parseFloat(s);
}

/* ---------- Bilder: lokal in IndexedDB, Kopie im Daten-Repo unter vision/<id>.jpg ---------- */
export async function uploadImage(id, blob) {
  if (!isConnected()) return;
  const path = `/repos/${sync.owner}/${sync.repo}/contents/vision/${id}.jpg`;
  const existing = await gh(`${path}?t=${Date.now()}`, { cache: 'no-store' });
  const sha = existing.ok ? (await existing.json()).sha : undefined;
  const r = await gh(path, { method: 'PUT', body: JSON.stringify({ message: `Bild ${id}`, content: await blobToBase64(blob), ...(sha ? { sha } : {}) }) });
  if (!r.ok) throw new Error(`Bild-Upload fehlgeschlagen (${r.status})`);
}
export async function deleteRemoteImage(id) {
  if (!isConnected()) return;
  const path = `/repos/${sync.owner}/${sync.repo}/contents/vision/${id}.jpg`;
  const existing = await gh(`${path}?t=${Date.now()}`, { cache: 'no-store' });
  if (!existing.ok) return;
  const { sha } = await existing.json();
  await gh(path, { method: 'DELETE', body: JSON.stringify({ message: `Bild ${id} gelöscht`, sha }) });
}
// Fehlende Bilder (z. B. nach Neuinstallation) aus dem Repo holen, lokale ohne Kopie hochladen.
export async function syncVisionImages() {
  if (!isConnected() || !state.vision?.length) return;
  const local = new Set(await imgKeys());
  for (const v of state.vision) {
    if (local.has(v.id)) continue;
    const r = await gh(`/repos/${sync.owner}/${sync.repo}/contents/vision/${v.id}.jpg?t=${Date.now()}`, { headers: { Accept: 'application/vnd.github.raw+json' }, cache: 'no-store' });
    if (r.ok) { await imgPut(v.id, await r.blob()); document.dispatchEvent(new Event('images:update')); }
  }
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
