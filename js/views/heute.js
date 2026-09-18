import { state, update, dateKey, AREAS, uid, resetState, replaceState } from '../store.js';
import { esc, fmtLong, relDay, ring, check, header, sectionLabel, icons, fmtNum } from '../ui.js';
import { openSheet, closeSheet, field, toggle } from '../sheet.js';
import { dayItems, streak, bestStreak, habitStreak } from '../habits.js';
import { focusAfterRender } from '../app.js';

const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const WD_IDX = [1, 2, 3, 4, 5, 6, 0];

export function render(s) {
  const today = dateKey();
  const d = dayItems(s, today);
  const st = streak(s, today);
  const best = bestStreak(s);
  const groups = {};
  for (const r of d.required) (groups[r.habit.area] ||= []).push(r);

  const trainedToday = s.training.sessions.find(x => x.date === today);
  const nextDay = nextTrainingDay(s);

  const upcoming = s.appointments.filter(a => a.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 3);
  const workToday = s.lists.work.today;
  const privToday = s.lists.private.today;

  return `
    ${header('Heute', fmtLong(today), `<button class="icon-btn" data-action="settings" aria-label="Einstellungen">${icons.gear}</button>`)}

    <div class="card">
      <div class="hero">
        <div class="ring-wrap">${ring(d.pct, d.pct >= 1 ? 'var(--green)' : 'var(--blue)', 74, 8)}<div class="ring-label">${Math.round(d.pct * 100)}%</div></div>
        <div class="grow">
          <div class="big">${d.done === d.total && d.total > 0 ? 'Alles erledigt' : `${d.done} von ${d.total} erledigt`}</div>
          <div class="muted">${st > 0 ? `<span style="color:var(--orange);font-weight:600">🔥 ${st} ${st === 1 ? 'Tag' : 'Tage'} in Folge</span>` : 'Starte heute deine Serie'}${best > st ? ` · Rekord ${best}` : ''}</div>
        </div>
      </div>
    </div>

    ${sectionLabel('Tages-Standards', `<button class="link-btn" data-action="manageHabits">Bearbeiten</button>`)}
    <div class="card">
      ${Object.entries(groups).map(([area, items]) => `
        <div class="group-title"><span class="dot" style="--c:${AREAS[area]?.color || 'var(--blue)'}"></span>${esc(AREAS[area]?.name || 'Sonstiges')}</div>
        ${items.map(r => habitRow(s, r.habit, r.done, today)).join('')}
      `).join('')}
      ${d.weekly.length ? `
        <div class="group-title"><span class="dot" style="--c:var(--purple)"></span>Wochenziele</div>
        ${d.weekly.map(w => `
          <div class="row ${w.done ? 'done' : ''}">
            ${check(w.done, AREAS[w.habit.area]?.color || 'var(--purple)', `data-action="toggleHabit" data-id="${w.habit.id}"`)}
            <div class="grow"><div class="title">${esc(w.habit.name)}</div><div class="meta">${w.count} von ${w.times}× diese Woche</div></div>
            <span class="pill ${w.count >= w.times ? '' : 'gray'}" style="--c:var(--green)">${w.count >= w.times ? 'Geschafft' : `${w.times - w.count} offen`}</span>
          </div>`).join('')}
      ` : ''}
      ${d.stepsItem ? `
        <div class="group-title"><span class="dot" style="--c:var(--green)"></span>Bewegung</div>
        <div class="row ${d.stepsItem.done ? 'done' : ''}" style="flex-wrap:wrap">
          ${check(d.stepsItem.done, 'var(--green)', 'data-action="goSteps"')}
          <div class="grow"><div class="title">${fmtNum(d.stepsItem.goal)} Schritte</div><div class="meta">${d.stepsItem.done ? 'Ziel erreicht' : `${fmtNum(Math.max(0, d.stepsItem.goal - d.stepsItem.steps))} fehlen noch`}</div></div>
          <div class="inline-input"><input type="number" inputmode="numeric" value="${d.stepsItem.steps || ''}" placeholder="0" data-change="setSteps" aria-label="Schritte heute"></div>
          <div style="width:100%;padding:6px 0 2px 39px"><div class="bar" style="--c:var(--green)"><i style="width:${Math.min(100, d.stepsItem.steps / d.stepsItem.goal * 100)}%"></i></div></div>
        </div>` : ''}
      ${!d.required.length && !d.weekly.length && !d.stepsItem ? `<div class="empty">Noch keine Standards. Tippe auf „Bearbeiten“.</div>` : ''}
    </div>

    ${sectionLabel('Training')}
    <div class="card">
      <a class="row link" href="#training" style="color:inherit">
        ${check(!!trainedToday, 'var(--orange)', 'data-action="goTraining"')}
        <div class="grow"><div class="title">${trainedToday ? `${esc(trainedToday.dayName)} absolviert` : nextDay ? `Nächstes Training: ${esc(nextDay.name)}` : 'Kein Trainingsplan'}</div>
        <div class="meta">${trainedToday ? `${trainedToday.entries.length} Übungen · ${summarizeSession(trainedToday)}` : lastTrainingText(s)}</div></div>
        <span class="chev">${icons.chevron}</span>
      </a>
    </div>

    ${sectionLabel('Arbeit', `<button class="link-btn" data-action="addWorkTask">${icons.plus.replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-2px"')} Aufgabe</button>`)}
    <div class="card">
      ${upcoming.map(a => `
        <div class="row">
          <span class="mini-btn" style="color:var(--indigo);background:color-mix(in srgb,var(--indigo) 12%,transparent)">${icons.clock}</span>
          <div class="grow"><div class="title">${esc(a.title)}</div><div class="meta">${relDay(a.date)}${a.time ? ` · ${esc(a.time)} Uhr` : ''}</div></div>
          ${a.date === today ? '<span class="pill" style="--c:var(--indigo)">Heute</span>' : ''}
        </div>`).join('')}
      ${workToday.map(t => taskRow('work', t)).join('')}
      ${!upcoming.length && !workToday.length ? '<div class="empty">Keine Termine oder Aufgaben für heute.</div>' : ''}
      <form class="add-row" data-submit="addTask" data-list="work"><span class="plus">${icons.plus}</span><input name="text" placeholder="Aufgabe für heute…" autocomplete="off"></form>
    </div>

    ${sectionLabel('Privat')}
    <div class="card">
      ${privToday.map(t => taskRow('private', t)).join('')}
      ${!privToday.length ? '<div class="empty">Nichts geplant. Was möchtest du heute umsetzen?</div>' : ''}
      <form class="add-row" data-submit="addTask" data-list="private"><span class="plus">${icons.plus}</span><input name="text" placeholder="Heute umsetzen…" autocomplete="off"></form>
    </div>
  `;
}

function habitRow(s, h, done, today) {
  const hs = habitStreak(s, h, today);
  return `<div class="row ${done ? 'done' : ''}">
    ${check(done, AREAS[h.area]?.color || 'var(--blue)', `data-action="toggleHabit" data-id="${h.id}"`)}
    <div class="grow"><div class="title">${esc(h.name)}</div>${h.schedule?.type === 'days' ? `<div class="meta">${h.schedule.days.map(i => WD[WD_IDX.indexOf(i)]).join(' · ')}</div>` : ''}</div>
    ${hs > 1 ? `<span class="trail">${hs}🔥</span>` : ''}
  </div>`;
}

function taskRow(list, t) {
  const color = list === 'work' ? 'var(--indigo)' : 'var(--teal)';
  return `<div class="row ${t.done ? 'done' : ''}">
    ${check(t.done, color, `data-action="toggleTask" data-list="${list}" data-id="${t.id}"`)}
    <div class="grow"><div class="title">${esc(t.text)}</div></div>
  </div>`;
}

function nextTrainingDay(s) {
  const days = s.training.days;
  if (!days.length) return null;
  const last = s.training.sessions[0];
  if (!last) return days[0];
  const i = days.findIndex(d => d.id === last.dayId);
  return days[(i + 1) % days.length];
}
function lastTrainingText(s) {
  const last = s.training.sessions[0];
  if (!last) return 'Noch kein Training gespeichert';
  return `Zuletzt: ${esc(last.dayName)} · ${relDay(last.date)}`;
}
function summarizeSession(se) {
  const up = se.entries.filter(e => e.result === 'levelup').length;
  const pr = se.entries.filter(e => e.result === 'progress').length;
  const parts = [];
  if (up) parts.push(`${up}× Gewicht hoch`);
  if (pr) parts.push(`${pr}× Fortschritt`);
  return parts.join(' · ') || 'Gehalten';
}

/* ---------- Aktionen ---------- */

export const actions = {
  toggleHabit(el) {
    const id = el.dataset.id, today = dateKey();
    update(s => { const day = s.log[today] ||= {}; if (day[id]) delete day[id]; else day[id] = true; });
  },
  toggleTask(el) {
    update(s => { const t = s.lists[el.dataset.list].today.find(x => x.id === el.dataset.id); if (t) t.done = !t.done; });
  },
  goSteps() { const inp = document.querySelector('[data-change="setSteps"]'); inp?.focus(); },
  goTraining(el, e) { e.preventDefault(); location.hash = '#training'; },
  addWorkTask() { document.querySelector('form[data-list="work"] input')?.focus(); },
  settings() { openSettings(); },
  manageHabits() { openHabitManager(); },
};

export const changes = {
  setSteps(el) {
    const v = parseInt(el.value, 10);
    update(s => { if (v > 0) s.steps[dateKey()] = v; else delete s.steps[dateKey()]; });
  },
};

export const submits = {
  addTask(f) {
    const text = f.text.value.trim(); if (!text) return;
    const list = f.dataset.list;
    focusAfterRender(`form[data-list="${list}"] input`);
    update(s => s.lists[list].today.push({ id: uid(), text, done: false, createdAt: dateKey() }));
  },
};

/* ---------- Sheets ---------- */

function openHabitManager() {
  const s = state;
  openSheet({
    title: 'Tages-Standards',
    html: `
      ${s.habits.map(h => `<div class="row">
        <span class="dot" style="--c:${AREAS[h.area]?.color || 'var(--blue)'}"></span>
        <div class="grow"><div class="title">${esc(h.name)}</div><div class="meta">${scheduleText(h)}</div></div>
        <div class="ex-edit"><button type="button" class="mini-btn" data-action="editHabit" data-id="${h.id}">${icons.pencil}</button><button type="button" class="mini-btn red" data-action="delHabit" data-id="${h.id}">${icons.trash}</button></div>
      </div>`).join('') || '<div class="empty">Noch keine Standards.</div>'}
      <div class="stack"><button type="button" class="btn btn-soft" data-action="newHabit">${icons.plus.replace('<svg', '<svg style="width:16px;height:16px"')} Neuer Standard</button></div>`,
    actions: {
      editHabit: el => openHabitForm(s.habits.find(h => h.id === el.dataset.id)),
      newHabit: () => openHabitForm(null),
      delHabit: el => { if (confirm('Diesen Standard löschen? Die Historie bleibt erhalten.')) { update(x => { x.habits = x.habits.filter(h => h.id !== el.dataset.id); }); openHabitManager(); } },
    },
  });
}

function scheduleText(h) {
  const t = h.schedule?.type;
  if (t === 'weekly') return `${h.schedule.times}× pro Woche`;
  if (t === 'days') return h.schedule.days.map(i => WD[WD_IDX.indexOf(i)]).join(', ');
  return 'Täglich';
}

function openHabitForm(h) {
  const sc = h?.schedule || { type: 'daily' };
  openSheet({
    title: h ? 'Standard bearbeiten' : 'Neuer Standard',
    html: `
      ${field({ label: 'Name', name: 'name', value: h?.name || '', placeholder: 'z. B. Vitamin D3', autofocus: !h, attrs: 'required' })}
      ${field({ label: 'Bereich', name: 'area', value: h?.area || 'supp', options: Object.entries(AREAS).map(([value, a]) => ({ value, label: a.name })) })}
      ${field({ label: 'Rhythmus', name: 'type', value: sc.type, options: [{ value: 'daily', label: 'Täglich' }, { value: 'days', label: 'Bestimmte Wochentage' }, { value: 'weekly', label: 'X-mal pro Woche (flexibel)' }] })}
      <div class="field"><span>Wochentage (nur bei „Bestimmte Wochentage“)</span><div class="daypicker">${WD.map((w, i) => `<label><input type="checkbox" name="days[]" value="${WD_IDX[i]}" ${(sc.days || []).includes(WD_IDX[i]) ? 'checked' : ''}><span>${w}</span></label>`).join('')}</div></div>
      ${field({ label: 'Wie oft pro Woche (nur bei „X-mal pro Woche“)', name: 'times', type: 'number', value: sc.times || 3, attrs: 'min="1" max="7" inputmode="numeric"' })}
    `,
    onSubmit(d) {
      const name = d.name.trim(); if (!name) return false;
      const schedule = d.type === 'weekly' ? { type: 'weekly', times: Math.max(1, parseInt(d.times) || 1) }
        : d.type === 'days' ? { type: 'days', days: (d.days || []).map(Number) }
        : { type: 'daily' };
      if (schedule.type === 'days' && !schedule.days.length) { alert('Bitte mindestens einen Wochentag wählen.'); return false; }
      update(s => {
        if (h) { const x = s.habits.find(y => y.id === h.id); Object.assign(x, { name, area: d.area, schedule }); }
        else s.habits.push({ id: uid(), name, area: d.area, schedule });
      });
      setTimeout(openHabitManager, 300);
    },
  });
}

function openSettings() {
  openSheet({
    title: 'Einstellungen',
    html: `
      ${field({ label: 'Tagesziel Schritte', name: 'stepsGoal', type: 'number', value: state.settings.stepsGoal, attrs: 'min="0" step="500" inputmode="numeric"' })}
      <div class="hint">Setze 0, um Schritte aus den Tages-Standards zu entfernen.</div>
      <div class="section-label" style="padding-left:2px">Daten</div>
      <div class="stack">
        <button type="button" class="btn btn-soft" data-action="exportData">Backup kopieren (JSON)</button>
        <button type="button" class="btn btn-soft" data-action="downloadData">Backup herunterladen</button>
        <label class="btn btn-soft" style="cursor:pointer">Backup einspielen<input type="file" accept="application/json,.json" data-change="importData" style="display:none"></label>
        <button type="button" class="btn btn-danger" data-action="resetData">Alle Daten zurücksetzen</button>
      </div>
      <div class="note" style="padding:6px 2px">Alle Daten liegen nur auf diesem Gerät. Ein Backup hin und wieder lohnt sich.</div>
    `,
    onSubmit(d) { update(s => { s.settings.stepsGoal = Math.max(0, parseInt(d.stepsGoal) || 0); }); },
    actions: {
      exportData: () => { navigator.clipboard?.writeText(JSON.stringify(state)).then(() => alert('Backup in die Zwischenablage kopiert.')).catch(() => alert('Kopieren nicht möglich.')); },
      downloadData: () => {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `zentrum-backup-${dateKey()}.json`; a.click();
      },
      importData: el => {
        const f = el.files?.[0]; if (!f) return;
        f.text().then(txt => { const j = JSON.parse(txt); if (!j.habits || !j.training) throw 0; if (confirm('Aktuelle Daten mit dem Backup ersetzen?')) { replaceState(j); closeSheet(); } }).catch(() => alert('Datei konnte nicht gelesen werden.'));
      },
      resetData: () => { if (confirm('Wirklich alle Daten löschen?') && confirm('Sicher? Das kann nicht rückgängig gemacht werden.')) { resetState(); closeSheet(); } },
    },
  });
}
