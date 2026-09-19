import { state, update, dateKey, uid } from '../store.js';
import { esc, header, sectionLabel, segmented, icons, relDay, fmtKg } from '../ui.js';
import { openSheet, closeSheet, field, toggle } from '../sheet.js';
import { celebrate, haptic } from '../fx.js';
import { addDays, weekStart } from '../store.js';
import { tile } from '../ui.js';

let editMode = false;

function selectedDay(s) {
  const days = s.training.days;
  return days.find(d => d.id === s.training.selectedDay) || days[0] || null;
}

const wTxt = w => w == null ? 'Eigengewicht' : `${fmtKg(w)} kg`;
const lastEntry = (s, exId) => { for (const se of s.training.sessions) { const e = se.entries.find(x => x.exerciseId === exId); if (e) return { ...e, date: se.date }; } return null; };

function trainingHero(s) {
  const today = dateKey();
  const all = s.training.sessions;
  const trainedToday = all.find(x => x.date === today);
  const ws = weekStart(today);
  const thisWeek = all.filter(x => x.date >= ws).length;
  const last28 = all.filter(x => x.date >= addDays(today, -27));
  const levelups = last28.reduce((n, se) => n + se.entries.filter(e => e.result === 'levelup').length, 0);
  const days = s.training.days;
  let next = null;
  if (days.length) { const last = all[0]; const i = last ? days.findIndex(d => d.id === last.dayId) : -1; next = days[(i + 1) % days.length]; }
  const lastDate = all[0] ? relDay(all[0].date) : null;
  const title = trainedToday ? `${esc(trainedToday.dayName)} absolviert` : next ? `Heute: ${esc(next.name)}` : 'Kein Plan';
  const line = trainedToday ? 'Stark. Erholung ist jetzt Teil des Trainings.' : lastDate ? `Zuletzt ${lastDate}. Dranbleiben.` : 'Dein erstes Training wartet.';
  return `<div class="hero-card compact" style="background:linear-gradient(135deg,#FF9F0A 0%,#FF5E3A 100%)">
    <div class="hero-top">
      <span class="hero-icon">${icons.dumbbell}</span>
      <div class="grow"><div class="hero-big">${title}</div><div class="hero-line">${line}</div></div>
    </div>
    <div class="hero-stats">
      <div><b>${thisWeek}</b><span>diese Woche</span></div>
      <div><b>${last28.length}</b><span>letzte 4 Wochen</span></div>
      <div><b>${levelups}</b><span>× Gewicht hoch</span></div>
    </div>
  </div>`;
}

export function render(s) {
  const day = selectedDay(s);
  const sessions = s.training.sessions.slice(0, 5);
  return `
    ${header('Training', 'Progressive Overload', `<button class="link-btn ${editMode ? 'bold' : ''}" data-action="toggleEdit">${editMode ? 'Fertig' : 'Plan bearbeiten'}</button>`)}
    ${editMode ? '' : trainingHero(s)}
    ${s.training.days.length ? segmented(s.training.days, day?.id, 'selectDay') : ''}
    ${editMode ? `<div class="btn-row"><button class="btn btn-soft btn-sm" data-action="addDay">${icons.plus.replace('<svg', '<svg style="width:15px;height:15px"')} Tag</button>${day ? `<button class="btn btn-soft btn-sm" data-action="renameDay">Umbenennen</button><button class="btn btn-danger btn-sm" data-action="delDay">Tag löschen</button>` : ''}</div>` : ''}

    ${day ? `
    ${sectionLabel(`${day.name} · ${day.exercises.length} Übungen`, editMode ? `<button class="link-btn" data-action="addExercise">+ Übung</button>` : '')}
    <div class="card">
      ${day.exercises.map((ex, i) => exerciseBlock(s, ex, i, day.exercises.length)).join('')}
      ${!day.exercises.length ? '<div class="empty">Noch keine Übungen. Tippe oben auf „Plan bearbeiten“.</div>' : ''}
    </div>
    ${day.exercises.length && !editMode ? `<div class="stack" style="padding-top:0"><button class="btn btn-primary" data-action="saveSession" style="background:var(--orange)">Training abschließen</button></div>` : ''}
    ` : `<div class="card"><div class="empty">Noch kein Trainingsplan. Tippe auf „Plan bearbeiten“ und lege einen Tag an.</div></div>`}

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
  return `<div class="exercise">
    <div class="ex-head">
      <div class="grow">
        <button type="button" class="ex-name" data-action="history" data-id="${ex.id}">${esc(ex.name)}</button>
        <div class="ex-target">Ziel: ${ex.sets} × ${target} · ${wTxt(ex.weight)} <span style="color:var(--text3)">·</span> Range ${ex.repMin}–${ex.repMax}</div>
      </div>
      ${editMode ? `<div class="ex-edit">
        ${i > 0 ? `<button type="button" class="mini-btn" data-action="moveEx" data-id="${ex.id}" data-dir="-1">${icons.up}</button>` : ''}
        ${i < n - 1 ? `<button type="button" class="mini-btn" data-action="moveEx" data-id="${ex.id}" data-dir="1">${icons.down}</button>` : ''}
        <button type="button" class="mini-btn" data-action="editExercise" data-id="${ex.id}">${icons.pencil}</button>
        <button type="button" class="mini-btn red" data-action="delExercise" data-id="${ex.id}">${icons.trash}</button>
      </div>` : ''}
    </div>
    ${!editMode ? `
    <div class="ex-sets" style="--n:${ex.sets}">
      <label>Gewicht${ex.weight == null ? `<span class="bw">Eigengew.</span>` : `<input type="number" inputmode="decimal" step="0.5" name="w-${ex.id}" value="${ex.weight}">`}</label>
      ${Array.from({ length: ex.sets }, (_, k) => `<label>Satz ${k + 1}<input type="number" inputmode="numeric" name="r-${ex.id}-${k}" placeholder="${target}"></label>`).join('')}
    </div>
    <div class="ex-last">${last ? `<span>Zuletzt (${relDay(last.date)}): ${last.reps.join(' / ')} · ${wTxt(last.weight)}</span>${resultPill(last.result)}` : '<span>Erstes Mal – trage deine Wiederholungen ein.</span>'}</div>
    ` : ''}
  </div>`;
}

function resultPill(r) {
  if (r === 'levelup') return '<span class="pill" style="--c:var(--green)">Gewicht hoch</span>';
  if (r === 'progress') return '<span class="pill" style="--c:var(--blue)">+ Reps</span>';
  if (r === 'hold') return '<span class="pill gray">Gehalten</span>';
  return '';
}
function sessionSummary(se) {
  const up = se.entries.filter(e => e.result === 'levelup').length;
  const pr = se.entries.filter(e => e.result === 'progress').length;
  return [up && `${up}× Gewicht hoch`, pr && `${pr}× Fortschritt`].filter(Boolean).join(' · ') || 'gehalten';
}

/* ---------- Progressive-Overload-Logik ----------
   Ziel = Wiederholungen, die ALLE Sätze schaffen müssen.
   Alle Sätze ≥ Max der Range → Gewicht + Inkrement, Ziel zurück auf Min.
   Alle Sätze ≥ Ziel → Ziel = min(Sätze) + 1.
   Sonst → Ziel bleibt. */
export function evaluate(ex, reps, weight) {
  const target = ex.targetReps || ex.repMin;
  const minReps = Math.min(...reps);
  const sameWeight = (ex.weight == null && weight == null) || Number(weight) === Number(ex.weight);
  if (!sameWeight) return { result: 'hold', next: { targetReps: target, weight: ex.weight }, message: 'Anderes Gewicht als geplant – Ziel bleibt.' };
  if (minReps >= ex.repMax) {
    if (ex.weight == null) return { result: 'levelup', next: { targetReps: ex.repMax, weight: null }, message: 'Maximum erreicht! Zeit für eine schwerere Variante oder Zusatzgewicht.' };
    const nw = Math.round((ex.weight + (ex.increment || 2.5)) * 100) / 100;
    return { result: 'levelup', next: { targetReps: ex.repMin, weight: nw }, message: `Gewicht hoch auf ${fmtKg(nw)} kg · neues Ziel ${ex.sets} × ${ex.repMin}` };
  }
  if (minReps >= target) return { result: 'progress', next: { targetReps: minReps + 1, weight: ex.weight }, message: `Nächstes Ziel: ${ex.sets} × ${minReps + 1}` };
  return { result: 'hold', next: { targetReps: target, weight: ex.weight }, message: `Ziel bleibt: ${ex.sets} × ${target}` };
}

/* ---------- Aktionen ---------- */

export const actions = {
  toggleEdit() { editMode = !editMode; update(() => {}); },
  selectDay(el) { update(s => { s.training.selectedDay = el.dataset.id; }); },
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
      html: `<div class="summary-list">${se.entries.map(e => `<div class="row"><div class="grow"><div class="title">${esc(e.name)}</div><div class="meta">${e.reps.join(' / ')} · ${wTxt(e.weight)}</div></div>${resultPill(e.result)}</div>`).join('')}</div>
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
      const ev = evaluate(ex, reps, weight);
      entries.push({ exerciseId: ex.id, name: ex.name, weight, reps, result: ev.result, targetBefore: ex.targetReps || ex.repMin, message: ev.message });
      updates.push({ id: ex.id, next: ev.next });
    }
    if (!entries.length) { alert('Trage zuerst deine Wiederholungen ein.'); return; }
    haptic();
    const session = { id: uid(), date: dateKey(), dayId: day.id, dayName: day.name, entries };
    update(s => {
      const d = selectedDay(s);
      for (const u of updates) { const ex = d.exercises.find(e => e.id === u.id); ex.targetReps = u.next.targetReps; ex.weight = u.next.weight; }
      s.training.sessions.unshift(session);
      s.training.selectedDay = s.training.days[(s.training.days.findIndex(x => x.id === day.id) + 1) % s.training.days.length]?.id || day.id;
    });
    openSheet({ title: 'Training gespeichert', html: `<div class="summary-list">${entries.map(e => `<div class="row"><div class="grow"><div class="title">${esc(e.name)}</div><div class="meta">${e.reps.join(' / ')} · ${wTxt(e.weight)}</div><div class="session-res res-${e.result}">${esc(e.message)}</div></div></div>`).join('')}</div>
      <div class="stack"><button type="button" class="btn btn-primary" data-action="__closeSheet" style="background:var(--orange)">Stark! Weiter</button></div>` });
    window.scrollTo(0, 0);
    if (entries.some(e => e.result === 'levelup')) celebrate(['#FF9F0A', '#FF5E3A', '#FFD60A', '#FFFFFF']);
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
        ${field({ label: 'Steigerung (kg)', name: 'increment', type: 'number', value: ex?.increment ?? 2.5, attrs: 'min="0" step="0.5" inputmode="decimal"' })}
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
  const rows = [];
  for (const se of state.training.sessions) { const e = se.entries.find(x => x.exerciseId === exId); if (e) rows.push({ ...e, date: se.date }); }
  const ex = selectedDay(state)?.exercises.find(e => e.id === exId);
  openSheet({ title: ex?.name || 'Verlauf',
    html: rows.length ? `<div class="summary-list">${rows.slice(0, 20).map(e => `<div class="row"><div class="grow"><div class="title">${e.reps.join(' / ')} <span style="color:var(--text2)">· ${wTxt(e.weight)}</span></div><div class="meta">${relDay(e.date)}</div></div>${resultPill(e.result)}</div>`).join('')}</div>` : '<div class="empty">Noch kein Verlauf für diese Übung.</div>' });
}
