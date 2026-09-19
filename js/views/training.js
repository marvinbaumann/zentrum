import { state, update, dateKey, uid, addDays, weekStart } from '../store.js';
import { esc, header, sectionLabel, segmented, icons, relDay, fmtKg, fmtDM } from '../ui.js';
import { openSheet, closeSheet, field, toggle } from '../sheet.js';
import { celebrate, haptic } from '../fx.js';

let editMode = false;

function selectedDay(s) {
  const days = s.training.days;
  return days.find(d => d.id === s.training.selectedDay) || days[0] || null;
}
const wTxt = w => w == null ? 'Eigengewicht' : `${fmtKg(w)} kg`;
const round = x => Math.round(x * 100) / 100;

function lastEntry(s, exId) { for (const se of s.training.sessions) { const e = se.entries.find(x => x.exerciseId === exId); if (e) return { ...e, date: se.date }; } return null; }
function history(s, exId) { const rows = []; for (const se of s.training.sessions) { const e = se.entries.find(x => x.exerciseId === exId); if (e) rows.push({ ...e, date: se.date }); } return rows; }

/* ---------- Verfügbare Gewichte ---------- */
export function availableWeights(s) {
  return String(s.settings.weights || '').split(/[,;\s]+/).map(x => parseFloat(x.replace(',', '.'))).filter(x => x > 0).sort((a, b) => a - b);
}
export function nextWeight(s, cur, increment) {
  const av = availableWeights(s);
  const cand = av.find(w => w > cur + 1e-9);
  const w = cand ?? round(cur + (increment || 2.5));
  return { w, jump: cur > 0 ? (w - cur) / cur : 0 };
}

/* ---------- Fortschritt seit Start ---------- */
// Kraft-Score = bestes Gewicht × beste Wiederholung (Eigengewicht: Wiederholungen). Vergleich erster vs. letzter Eintrag.
function scoreOf(e) { const w = e.weight == null ? 1 : e.weight; return w * Math.max(...e.reps); }
export function progressSinceStart(s, exId) {
  const rows = history(s, exId); if (rows.length < 2) return null;
  const first = rows[rows.length - 1], last = rows[0];
  const a = scoreOf(first), b = scoreOf(last);
  if (!(a > 0)) return null;
  const pct = Math.round((b - a) / a * 100);
  return { first, last, pct, sessions: rows.length };
}
function progressText(p) {
  const f = p.first.weight == null ? `${Math.max(...p.first.reps)} Wdh.` : `${fmtKg(p.first.weight)} kg × ${Math.max(...p.first.reps)}`;
  const l = p.last.weight == null ? `${Math.max(...p.last.reps)} Wdh.` : `${fmtKg(p.last.weight)} kg × ${Math.max(...p.last.reps)}`;
  return `${f} → ${l}`;
}

/* ---------- Rekorde ---------- */
function bestBefore(s, exId) {
  const rows = history(s, exId);
  const best = { any: rows.length > 0, maxWeight: 0, repsAt: {}, maxVolume: 0 };
  for (const r of rows) {
    const w = r.weight == null ? 0 : r.weight;
    best.maxWeight = Math.max(best.maxWeight, w);
    const key = String(w); best.repsAt[key] = Math.max(best.repsAt[key] || 0, ...r.reps);
    best.maxVolume = Math.max(best.maxVolume, r.reps.reduce((a, b) => a + b, 0) * (w || 1));
  }
  return best;
}
function detectPRs(s, ex, reps, weight) {
  const b = bestBefore(s, ex.id); if (!b.any) return [];
  const prs = [];
  const w = weight == null ? 0 : weight;
  if (weight != null && w > b.maxWeight) prs.push('Gewicht');
  if (Math.max(...reps) > (b.repsAt[String(w)] || 0) && (b.repsAt[String(w)] || 0) > 0) prs.push('Wiederholungen');
  if (reps.reduce((a, c) => a + c, 0) * (w || 1) > b.maxVolume) prs.push('Volumen');
  return prs;
}

/* ---------- Pausen-Timer (zeitstempelbasiert, läuft über Null weiter) ---------- */
let rest = null; // { startAt, seconds, timer, buzzed }
function restEl() { let el = document.getElementById('rest'); if (!el) { el = document.createElement('button'); el.id = 'rest'; el.type = 'button'; el.className = 'rest'; el.addEventListener('click', stopRest); document.body.appendChild(el); } return el; }
export function startRest() {
  const seconds = Math.max(10, parseInt(state.settings.restSeconds) || 90);
  if (rest?.timer) clearInterval(rest.timer);
  rest = { startAt: Date.now(), seconds, buzzed: false };
  tickRest();
  rest.timer = setInterval(tickRest, 500);
}
function tickRest() {
  if (!rest) return;
  const el = restEl();
  const left = rest.seconds - Math.floor((Date.now() - rest.startAt) / 1000);
  const fmt = n => `${Math.floor(Math.abs(n) / 60)}:${String(Math.abs(n) % 60).padStart(2, '0')}`;
  if (left >= 0) { el.textContent = `Pause ${fmt(left)}`; el.classList.remove('over'); }
  else { el.textContent = `Pause +${fmt(left)}`; el.classList.add('over'); if (!rest.buzzed) { rest.buzzed = true; haptic(); } }
  el.classList.add('on');
}
export function stopRest() { if (rest?.timer) clearInterval(rest.timer); rest = null; const el = document.getElementById('rest'); if (el) { el.classList.remove('on'); setTimeout(() => el.remove(), 300); } }

/* ---------- Render ---------- */
function trainingHero(s) {
  const today = dateKey();
  const all = s.training.sessions;
  const trainedToday = all.find(x => x.date === today);
  const ws = weekStart(today);
  const thisWeek = all.filter(x => x.date >= ws).length;
  const last28 = all.filter(x => x.date >= addDays(today, -27));
  const prs = last28.reduce((n, se) => n + se.entries.reduce((m, e) => m + (e.prs?.length || 0) + (e.result === 'levelup' ? 1 : 0), 0), 0);
  const days = s.training.days;
  let next = null;
  if (days.length) { const last = all[0]; const i = last ? days.findIndex(d => d.id === last.dayId) : -1; next = days[(i + 1) % days.length]; }
  const lastDate = all[0] ? relDay(all[0].date) : null;
  const title = trainedToday ? `${esc(trainedToday.dayName)} absolviert` : next ? `Heute: ${esc(next.name)}` : 'Kein Plan';
  const line = trainedToday ? 'Stark. Erholung ist jetzt Teil des Trainings.' : lastDate ? `Zuletzt ${lastDate}. Dranbleiben.` : 'Dein erstes Training wartet.';
  // Wochen-Serie: aufeinanderfolgende Wochen mit mindestens einem Training
  let weeks = 0, w = ws; const weekHas = k => all.some(x => x.date >= k && x.date < addDays(k, 7));
  if (!weekHas(w)) w = addDays(w, -7);
  while (weekHas(w) && weeks < 500) { weeks++; w = addDays(w, -7); }
  return `<div class="hero-card compact" style="background:linear-gradient(135deg,#FF9F0A 0%,#FF5E3A 100%)">
    <div class="hero-top">
      <span class="hero-icon">${icons.dumbbell}</span>
      <div class="grow"><div class="hero-big">${title}</div><div class="hero-line">${line}</div></div>
    </div>
    <div class="hero-stats">
      <div><b>${thisWeek}</b><span>diese Woche</span></div>
      <div><b>${weeks}</b><span>Wochen in Folge</span></div>
      <div><b>${prs}</b><span>Rekorde · 4 Wo.</span></div>
    </div>
  </div>`;
}

export function render(s) {
  const day = selectedDay(s);
  const sessions = s.training.sessions.slice(0, 5);
  return `
    ${header('Training', 'Progressive Overload', `<button class="icon-btn" data-action="trainingSettings" aria-label="Hanteln und Pause">${icons.gear}</button><button class="link-btn ${editMode ? 'bold' : ''}" data-action="toggleEdit">${editMode ? 'Fertig' : 'Plan'}</button>`)}
    ${editMode ? '' : trainingHero(s)}
    ${s.training.days.length ? segmented(s.training.days, day?.id, 'selectDay') : ''}
    ${editMode ? `<div class="btn-row"><button class="btn btn-soft btn-sm" data-action="addDay">${icons.plus.replace('<svg', '<svg style="width:15px;height:15px"')} Tag</button>${day ? `<button class="btn btn-soft btn-sm" data-action="renameDay">Umbenennen</button><button class="btn btn-danger btn-sm" data-action="delDay">Tag löschen</button>` : ''}</div>` : ''}

    ${day ? `
    ${sectionLabel(`${day.name} · ${day.exercises.length} Übungen`, editMode ? `<button class="link-btn" data-action="addExercise">+ Übung</button>` : '')}
    <div class="card">
      ${day.exercises.map((ex, i) => exerciseBlock(s, ex, i, day.exercises.length)).join('')}
      ${!day.exercises.length ? '<div class="empty">Noch keine Übungen. Tippe oben auf „Plan“.</div>' : ''}
    </div>
    ${day.exercises.length && !editMode ? `<div class="stack" style="padding-top:0"><button class="btn btn-primary" data-action="saveSession" style="background:linear-gradient(135deg,#FF9F0A,#FF5E3A);box-shadow:0 10px 20px -10px rgba(255,120,40,.7)">Training abschließen</button></div>` : ''}
    ` : `<div class="card"><div class="empty">Noch kein Trainingsplan. Tippe auf „Plan“ und lege einen Tag an.</div></div>`}

    ${sessions.length ? `
      ${sectionLabel('Letzte Trainings')}
      <div class="card">
        ${sessions.map(se => `<div class="row link" data-action="showSession" data-id="${se.id}">
          <div class="grow"><div class="title">${esc(se.dayName)}</div><div class="meta">${relDay(se.date)} · ${se.entries.length} Übungen · ${sessionSummary(se)}</div></div>
          <span class="chev">${icons.chevron}</span></div>`).join('')}
      </div>` : ''}
  `;
}

function exerciseBlock(s, ex, i, n) {
  const last = lastEntry(s, ex.id);
  const target = ex.targetReps || ex.repMin;
  return `<div class="exercise" data-ex="${ex.id}">
    <div class="ex-head">
      <div class="grow">
        <button type="button" class="ex-name" data-action="history" data-id="${ex.id}">${esc(ex.name)}</button>
        <div class="ex-target">Ziel: <b>${ex.sets} × ${target}</b> · ${wTxt(ex.weight)} <span style="color:var(--text3)">·</span> Range ${ex.repMin}–${ex.repMax}</div>
      </div>
      ${editMode ? `<div class="ex-edit">
        ${i > 0 ? `<button type="button" class="mini-btn" data-action="moveEx" data-id="${ex.id}" data-dir="-1">${icons.up}</button>` : ''}
        ${i < n - 1 ? `<button type="button" class="mini-btn" data-action="moveEx" data-id="${ex.id}" data-dir="1">${icons.down}</button>` : ''}
        <button type="button" class="mini-btn" data-action="editExercise" data-id="${ex.id}">${icons.pencil}</button>
        <button type="button" class="mini-btn red" data-action="delExercise" data-id="${ex.id}">${icons.trash}</button>
      </div>` : (last ? `<button type="button" class="btn btn-soft btn-sm" data-action="fillLast" data-id="${ex.id}" title="Werte vom letzten Mal übernehmen">Wie zuletzt</button>` : '')}
    </div>
    ${!editMode ? `
    <div class="ex-sets" style="--n:${ex.sets}">
      <label>Gewicht${ex.weight == null ? `<span class="bw">Eigengew.</span>` : `<input type="number" inputmode="decimal" step="0.5" name="w-${ex.id}" value="${ex.weight}">`}</label>
      ${Array.from({ length: ex.sets }, (_, k) => `<label>Satz ${k + 1}<input type="number" inputmode="numeric" name="r-${ex.id}-${k}" placeholder="${last?.reps?.[k] ?? target}" data-change="setInput" data-ex="${ex.id}" data-k="${k}"></label>`).join('')}
    </div>
    <div class="ex-last">${last ? `<span>Zuletzt (${relDay(last.date)}): ${last.reps.join(' / ')} · ${wTxt(last.weight)}</span>${resultPill(last.result)}${(last.prs || []).map(p => `<span class="pill" style="--c:var(--orange)">🏆 ${esc(p)}</span>`).join('')}` : '<span>Erstes Mal. Grau sind die Zielwerte, trage deine Wiederholungen ein.</span>'}<span class="ex-live"></span></div>
    ${(() => { const p = progressSinceStart(s, ex.id); if (!p || p.pct === 0) return ''; return `<div class="ex-progress" style="--c:${p.pct > 0 ? 'var(--green)' : 'var(--text2)'}"><span class="ex-progress-pct">${p.pct > 0 ? '+' : ''}${p.pct} %</span><span>seit ${fmtDM(p.first.date)} · ${progressText(p)}</span></div>`; })()}
    ` : ''}
  </div>`;
}

function resultPill(r) {
  if (r === 'levelup') return '<span class="pill" style="--c:var(--green)">Gewicht hoch</span>';
  if (r === 'extend') return '<span class="pill" style="--c:var(--blue)">Range erweitert</span>';
  if (r === 'progress') return '<span class="pill" style="--c:var(--blue)">+ Reps</span>';
  if (r === 'hold') return '<span class="pill gray">Gehalten</span>';
  return '';
}
function sessionSummary(se) {
  const up = se.entries.filter(e => e.result === 'levelup').length;
  const pr = se.entries.filter(e => e.result === 'progress' || e.result === 'extend').length;
  const prs = se.entries.reduce((n, e) => n + (e.prs?.length || 0), 0);
  return [up && `${up}× Gewicht hoch`, pr && `${pr}× Fortschritt`, prs && `${prs} Rekord${prs > 1 ? 'e' : ''}`].filter(Boolean).join(' · ') || 'gehalten';
}

/* ---------- Progressive-Overload-Logik ----------
   Ziel = Wiederholungen, die ALLE Sätze schaffen müssen.
   Alle Sätze ≥ Max der Range → nächstes verfügbares Gewicht. Ist der Sprung zu groß,
   wird stattdessen die Range um 2 erweitert. Alle Sätze ≥ Ziel → Ziel = min(Sätze) + 1. */
export function evaluate(ex, reps, weight, s = state) {
  const target = ex.targetReps || ex.repMin;
  const minReps = Math.min(...reps);
  const sameWeight = (ex.weight == null && weight == null) || Number(weight) === Number(ex.weight);
  if (!sameWeight) return { result: 'hold', next: { targetReps: target, weight: ex.weight }, message: 'Anderes Gewicht als geplant, Ziel bleibt.' };
  if (minReps >= ex.repMax) {
    if (ex.weight == null) return { result: 'levelup', next: { targetReps: ex.repMax, weight: null }, message: 'Maximum erreicht! Zeit für eine schwerere Variante oder Zusatzgewicht.' };
    const { w, jump } = nextWeight(s, ex.weight, ex.increment);
    const limit = (parseFloat(s.settings.jumpLimit) || 20) / 100;
    if (jump > limit && ex.repMax < ex.repMin + 12) {
      return { result: 'extend', next: { targetReps: minReps + 1, weight: ex.weight, repMax: ex.repMax + 2 }, message: `Nächstes Gewicht wäre ${fmtKg(w)} kg (+${Math.round(jump * 100)} %). Range erweitert auf ${ex.repMin}–${ex.repMax + 2}, Ziel ${ex.sets} × ${minReps + 1}.` };
    }
    return { result: 'levelup', next: { targetReps: ex.repMin, weight: w }, message: `Gewicht hoch auf ${fmtKg(w)} kg · neues Ziel ${ex.sets} × ${ex.repMin}` };
  }
  if (minReps >= target) return { result: 'progress', next: { targetReps: minReps + 1, weight: ex.weight }, message: `Nächstes Ziel: ${ex.sets} × ${minReps + 1}` };
  return { result: 'hold', next: { targetReps: target, weight: ex.weight }, message: `Ziel bleibt: ${ex.sets} × ${target}` };
}

/* ---------- Aktionen ---------- */
export const changes = {
  setInput(el) {
    const v = parseInt(el.value, 10);
    if (!(v > 0)) return;
    startRest();
    // Live-Rekord: mehr Wiederholungen als je zuvor bei diesem Gewicht
    const day = selectedDay(state); const ex = day?.exercises.find(e => e.id === el.dataset.ex); if (!ex) return;
    const wIn = document.querySelector(`[name="w-${ex.id}"]`); const weight = ex.weight == null ? 0 : (parseFloat(wIn?.value) || ex.weight);
    const b = bestBefore(state, ex.id);
    const live = el.closest('.exercise')?.querySelector('.ex-live');
    if (live) live.innerHTML = (b.any && (b.repsAt[String(weight)] || 0) > 0 && v > b.repsAt[String(weight)]) ? '<span class="pill" style="--c:var(--orange)">🏆 Neuer Rekord</span>' : '';
  },
};

export const actions = {
  toggleEdit() { editMode = !editMode; stopRest(); update(() => {}); },
  selectDay(el) { update(s => { s.training.selectedDay = el.dataset.id; }); },
  fillLast(el) {
    const last = lastEntry(state, el.dataset.id); if (!last) return;
    last.reps.forEach((r, k) => { const i = document.querySelector(`[name="r-${el.dataset.id}-${k}"]`); if (i) i.value = r || ''; });
    const w = document.querySelector(`[name="w-${el.dataset.id}"]`); if (w && last.weight != null) w.value = last.weight;
    haptic();
  },
  trainingSettings() {
    openSheet({ title: 'Hanteln & Pause',
      html: `${field({ label: 'Verfügbare Gewichte (kg), mit Komma getrennt', name: 'weights', value: state.settings.weights || '', placeholder: 'z. B. 2.5, 5, 7.5, 10, 12.5, 15, 20' })}
        <div class="hint">Beim Gewichtssprung nimmt die App das nächste Gewicht aus dieser Liste. Ist der Sprung größer als die Grenze unten, wird stattdessen die Rep-Range erweitert.</div>
        <div class="field-row">${field({ label: 'Max. Sprung (%)', name: 'jumpLimit', type: 'number', value: state.settings.jumpLimit ?? 20, attrs: 'min="5" max="100" inputmode="numeric"' })}${field({ label: 'Pause (Sekunden)', name: 'restSeconds', type: 'number', value: state.settings.restSeconds ?? 90, attrs: 'min="10" max="600" step="10" inputmode="numeric"' })}</div>
        <div class="hint">Der Pausen-Timer startet, sobald du einen Satz einträgst, und läuft über Null weiter, damit du siehst, wie lang du wirklich pausiert hast.</div>`,
      onSubmit(d) { update(s => { s.settings.weights = d.weights; s.settings.jumpLimit = Math.max(5, parseInt(d.jumpLimit) || 20); s.settings.restSeconds = Math.max(10, parseInt(d.restSeconds) || 90); }); } });
  },
  addDay() {
    openSheet({ title: 'Neuer Trainingstag', html: field({ label: 'Name', name: 'name', placeholder: 'z. B. Push, Pull, Beine', autofocus: true, attrs: 'required' }),
      onSubmit(d) { const name = d.name.trim(); if (!name) return false; update(s => { const id = uid(); s.training.days.push({ id, name, exercises: [] }); s.training.selectedDay = id; }); } });
  },
  renameDay() {
    const day = selectedDay(state); if (!day) return;
    openSheet({ title: 'Tag umbenennen', html: field({ label: 'Name', name: 'name', value: day.name, autofocus: true, attrs: 'required' }),
      onSubmit(d) { const name = d.name.trim(); if (!name) return false; update(s => { selectedDay(s).name = name; }); } });
  },
  delDay() {
    const day = selectedDay(state); if (!day) return;
    if (confirm(`„${day.name}“ mit allen Übungen löschen?`)) update(s => { s.training.days = s.training.days.filter(d => d.id !== day.id); s.training.selectedDay = s.training.days[0]?.id || null; });
  },
  addExercise() { openExerciseForm(null); },
  editExercise(el) { openExerciseForm(selectedDay(state).exercises.find(e => e.id === el.dataset.id)); },
  delExercise(el) {
    const day = selectedDay(state); const ex = day.exercises.find(e => e.id === el.dataset.id);
    if (confirm(`„${ex.name}“ löschen?`)) update(s => { const d = selectedDay(s); d.exercises = d.exercises.filter(e => e.id !== ex.id); });
  },
  moveEx(el) {
    update(s => { const d = selectedDay(s); const i = d.exercises.findIndex(e => e.id === el.dataset.id); const j = i + Number(el.dataset.dir);
      if (j < 0 || j >= d.exercises.length) return; [d.exercises[i], d.exercises[j]] = [d.exercises[j], d.exercises[i]]; });
  },
  history(el) { openHistory(el.dataset.id); },
  showSession(el) {
    const se = state.training.sessions.find(x => x.id === el.dataset.id); if (!se) return;
    openSheet({ title: `${se.dayName} · ${relDay(se.date)}`,
      html: `<div class="summary-list">${se.entries.map(e => `<div class="row"><div class="grow"><div class="title">${esc(e.name)}</div><div class="meta">${e.reps.join(' / ')} · ${wTxt(e.weight)}</div></div>${resultPill(e.result)}${(e.prs || []).map(p => `<span class="pill" style="--c:var(--orange)">🏆 ${esc(p)}</span>`).join('')}</div>`).join('')}</div>
        <div class="stack"><button type="button" class="btn btn-danger" data-action="delSession" data-id="${se.id}">Training löschen</button></div>`,
      actions: { delSession: b => { if (confirm('Dieses Training löschen? Die Ziele der Übungen werden nicht zurückgesetzt.')) { update(s => { s.training.sessions = s.training.sessions.filter(x => x.id !== b.dataset.id); }); closeSheet(); } } } });
  },
  saveSession() {
    const day = selectedDay(state); if (!day) return;
    const entries = [], updates = [];
    for (const ex of day.exercises) {
      const reps = [];
      for (let k = 0; k < ex.sets; k++) { const v = parseInt(document.querySelector(`[name="r-${ex.id}-${k}"]`)?.value, 10); if (v > 0) reps.push(v); }
      if (!reps.length) continue;
      while (reps.length < ex.sets) reps.push(0);
      const wIn = document.querySelector(`[name="w-${ex.id}"]`);
      const weight = ex.weight == null ? null : (parseFloat(wIn?.value) || ex.weight);
      const ev = evaluate(ex, reps, weight, state);
      const prs = detectPRs(state, ex, reps, weight);
      entries.push({ exerciseId: ex.id, name: ex.name, weight, reps, result: ev.result, targetBefore: ex.targetReps || ex.repMin, message: ev.message, prs });
      updates.push({ id: ex.id, next: ev.next });
    }
    if (!entries.length) { alert('Trage zuerst deine Wiederholungen ein.'); return; }
    haptic(); stopRest();
    const session = { id: uid(), date: dateKey(), dayId: day.id, dayName: day.name, entries };
    update(s => {
      const d = selectedDay(s);
      for (const u of updates) { const ex = d.exercises.find(e => e.id === u.id); ex.targetReps = u.next.targetReps; ex.weight = u.next.weight; if (u.next.repMax) ex.repMax = u.next.repMax; }
      s.training.sessions.unshift(session);
      s.training.selectedDay = s.training.days[(s.training.days.findIndex(x => x.id === day.id) + 1) % s.training.days.length]?.id || day.id;
    });
    const totalPRs = entries.reduce((n, e) => n + e.prs.length, 0);
    openSheet({ title: 'Training gespeichert', html: `${totalPRs ? `<div class="pr-banner">🏆 ${totalPRs === 1 ? 'Ein neuer Rekord' : `${totalPRs} neue Rekorde`}</div>` : ''}<div class="summary-list">${entries.map(e => `<div class="row"><div class="grow"><div class="title">${esc(e.name)}</div><div class="meta">${e.reps.join(' / ')} · ${wTxt(e.weight)}${e.prs.length ? ` · 🏆 ${e.prs.join(', ')}` : ''}</div><div class="session-res res-${e.result === 'extend' ? 'progress' : e.result}">${esc(e.message)}</div></div></div>`).join('')}</div>
      <div class="stack"><button type="button" class="btn btn-primary" data-action="__closeSheet" style="background:linear-gradient(135deg,#FF9F0A,#FF5E3A)">Stark! Weiter</button></div>` });
    window.scrollTo(0, 0);
    if (entries.some(e => e.result === 'levelup') || totalPRs) celebrate(['#FF9F0A', '#FF5E3A', '#FFD60A', '#FFFFFF']);
  },
};

function openExerciseForm(ex) {
  openSheet({
    title: ex ? 'Übung bearbeiten' : 'Neue Übung',
    html: `
      ${field({ label: 'Name', name: 'name', value: ex?.name || '', placeholder: 'z. B. Liegestütze', autofocus: !ex, attrs: 'required' })}
      <div class="field-row3">
        ${field({ label: 'Sätze', name: 'sets', type: 'number', value: ex?.sets ?? 3, attrs: 'min="1" max="10" inputmode="numeric"' })}
        ${field({ label: 'Reps min', name: 'repMin', type: 'number', value: ex?.repMin ?? 10, attrs: 'min="1" inputmode="numeric"' })}
        ${field({ label: 'Reps max', name: 'repMax', type: 'number', value: ex?.repMax ?? 15, attrs: 'min="1" inputmode="numeric"' })}
      </div>
      ${toggle({ label: 'Eigengewicht (ohne Zusatzgewicht)', name: 'bodyweight', checked: ex ? ex.weight == null : false })}
      <div class="field-row" style="margin-top:12px">
        ${field({ label: 'Aktuelles Gewicht (kg)', name: 'weight', type: 'number', value: ex?.weight ?? 10, attrs: 'min="0" step="0.5" inputmode="decimal"' })}
        ${field({ label: 'Steigerung, falls keine Hantelliste (kg)', name: 'increment', type: 'number', value: ex?.increment ?? 2.5, attrs: 'min="0" step="0.5" inputmode="decimal"' })}
      </div>
      ${field({ label: 'Aktuelles Rep-Ziel', name: 'targetReps', type: 'number', value: ex?.targetReps ?? ex?.repMin ?? 10, attrs: 'min="1" inputmode="numeric"' })}
      <div class="hint">Das Rep-Ziel gilt für alle Sätze. Sind alle Sätze geschafft, steigt es um eins. Am Maximum der Range geht das Gewicht hoch und das Ziel zurück auf Minimum.</div>
    `,
    onSubmit(d) {
      const name = d.name.trim(); if (!name) return false;
      const sets = Math.max(1, parseInt(d.sets) || 3), repMin = Math.max(1, parseInt(d.repMin) || 10), repMax = Math.max(repMin, parseInt(d.repMax) || repMin);
      const weight = d.bodyweight ? null : (parseFloat(d.weight) || 0);
      const increment = parseFloat(d.increment) || 2.5;
      const targetReps = Math.min(repMax, Math.max(repMin, parseInt(d.targetReps) || repMin));
      update(s => {
        const day = selectedDay(s);
        if (ex) Object.assign(day.exercises.find(e => e.id === ex.id), { name, sets, repMin, repMax, weight, increment, targetReps });
        else day.exercises.push({ id: uid(), name, sets, repMin, repMax, weight, increment, targetReps });
      });
    },
  });
}

function openHistory(exId) {
  const rows = history(state, exId);
  const ex = selectedDay(state)?.exercises.find(e => e.id === exId);
  const p = progressSinceStart(state, exId);
  openSheet({ title: ex?.name || 'Verlauf',
    html: rows.length ? `${p ? `<div class="stats" style="padding-top:2px"><div class="stat"><div class="v" style="color:${p.pct > 0 ? 'var(--green)' : 'inherit'}">${p.pct > 0 ? '+' : ''}${p.pct}<small>%</small></div><div class="l">seit ${fmtDM(p.first.date)}</div></div><div class="stat"><div class="v">${p.sessions}</div><div class="l">Trainings</div></div><div class="stat"><div class="v" style="font-size:14px;line-height:1.3;padding-top:3px">${esc(progressText(p))}</div><div class="l">Start → jetzt</div></div></div>` : ''}<div class="summary-list">${rows.slice(0, 20).map(e => `<div class="row"><div class="grow"><div class="title">${e.reps.join(' / ')} <span style="color:var(--text2)">· ${wTxt(e.weight)}</span></div><div class="meta">${relDay(e.date)}${e.prs?.length ? ` · 🏆 ${e.prs.join(', ')}` : ''}</div></div>${resultPill(e.result)}</div>`).join('')}</div>` : '<div class="empty">Noch kein Verlauf für diese Übung.</div>' });
}
