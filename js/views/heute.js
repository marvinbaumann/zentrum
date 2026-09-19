import { state, update, dateKey, AREAS, uid, resetState, replaceState } from '../store.js';
import { esc, fmtLong, relDay, ring, check, header, sectionLabel, icons, fmtNum, tile, WD_SHORT } from '../ui.js';
import { openSheet, closeSheet, field, toggle } from '../sheet.js';
import { dayItems, streak, bestStreak, habitStreak, isPerfectDay } from '../habits.js';
import { addDays, weekStart } from '../store.js';
import { focusAfterRender } from '../app.js';
import { celebrate, haptic } from '../fx.js';
import { sync, isConnected, connect, disconnect, push, pull, statusText } from '../sync.js';
import { MONTHS } from '../ui.js';

const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const WD_IDX = [1, 2, 3, 4, 5, 6, 0];
let firstMount = true;
let lastPop = null;

function greeting(h) {
  if (h < 5) return 'Gute Nacht';
  if (h < 11) return 'Guten Morgen';
  if (h < 17) return 'Guten Tag';
  if (h < 22) return 'Guten Abend';
  return 'Gute Nacht';
}
export const MOODS = {
  auto: { name: 'Automatisch (Tageszeit)' },
  sunrise: { name: 'Sonnenaufgang', bg: 'linear-gradient(135deg,#FF9F5A 0%,#FF5E7E 100%)' },
  ocean: { name: 'Ozean', bg: 'linear-gradient(135deg,#3D8BFF 0%,#6C5CE7 100%)' },
  sunset: { name: 'Abendrot', bg: 'linear-gradient(135deg,#7B4DFF 0%,#FF5FA2 100%)' },
  forest: { name: 'Wald', bg: 'linear-gradient(135deg,#2ECC71 0%,#16A085 100%)' },
  night: { name: 'Nacht', bg: 'linear-gradient(135deg,#2C3E8F 0%,#141A4A 100%)' },
  graphite: { name: 'Graphit', bg: 'linear-gradient(135deg,#4B4B55 0%,#1C1C1E 100%)' },
};
function heroTheme(h, perfect, mood = 'auto') {
  if (perfect) return MOODS.forest.bg;
  if (mood !== 'auto' && MOODS[mood]) return MOODS[mood].bg;
  if (h < 5 || h >= 22) return MOODS.night.bg;
  if (h < 11) return MOODS.sunrise.bg;
  if (h < 17) return MOODS.ocean.bg;
  return MOODS.sunset.bg;
}
const LINES = {
  night: ['Erholung ist auch Training.', 'Morgen ist ein neuer Tag. Schlaf gut.', 'Der Tag ist rund. Ruh dich aus.'],
  morning: ['Ein neuer Tag, ein klarer Plan.', 'Kleine Schritte, jeden Tag. Das ist der Weg.', 'Fang mit dem Einfachsten an. Der Rest folgt.', 'Heute zählt. Nicht perfekt, nur konsequent.'],
  day: ['Dranbleiben ist die halbe Miete.', 'Was jetzt erledigt ist, trägt dich durch den Tag.', 'Ein Punkt nach dem anderen.', 'Guter Rhythmus. Weiter so.'],
  evening: ['Zeit, den Tag rund zu machen.', 'Was heute noch geht, geht schnell.', 'Noch ein paar Haken, dann ist Feierabend.', 'Der Abend gehört dir. Schließ den Tag sauber ab.'],
};
function motivation(h, d, st) {
  if (d.total > 0 && d.done === d.total) return 'Perfekter Tag. Genau diese Konsequenz summiert sich.';
  if (st >= 3 && d.pct < 0.5) return `${st} Tage in Folge. Halte die Serie am Leben.`;
  if (d.pct >= 0.5 && h >= 11) return `Mehr als die Hälfte geschafft. Der Rest ist Formsache.`;
  const pool = h < 5 || h >= 22 ? LINES.night : h < 11 ? LINES.morning : h < 17 ? LINES.day : LINES.evening;
  const seed = parseInt(dateKey().replace(/-/g, ''), 10);
  return pool[seed % pool.length];
}
function weekStrip(s, today) {
  const ws = weekStart(today);
  return `<div class="week">${Array.from({ length: 7 }, (_, i) => {
    const k = addDays(ws, i);
    const perfect = isPerfectDay(s, k);
    const isToday = k === today, future = k > today;
    const d = isToday ? dayItems(s, k) : null;
    let cls = perfect ? 'perfect' : isToday ? 'today' : future ? 'future' : 'missed';
    return `<div class="week-day ${cls}"><span class="wl">${WD_SHORT[(i + 1) % 7]}</span><span class="wd">${perfect ? icons.check : isToday ? ring(d.pct, '#fff', 26, 3.5, { track: 'rgba(255,255,255,.28)' }) : ''}</span></div>`;
  }).join('')}</div>`;
}

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
  const hour = new Date().getHours();
  const perfect = d.total > 0 && d.done === d.total;
  const name = (s.settings.name || '').trim();
  const animate = firstMount; firstMount = false;
  const pop = lastPop; lastPop = null;

  return `
    ${header(`${greeting(hour)}${name ? `, ${name}` : ''}`, fmtLong(today), `<button class="icon-btn" data-action="settings" aria-label="Einstellungen">${icons.gear}</button>`)}

    <div class="hero-card tappable ${perfect ? 'perfect' : ''}" style="background:${heroTheme(hour, perfect, s.settings.heroMood)}" data-action="history" role="button" aria-label="Verlauf öffnen">
      <div class="hero-top">
        <div class="ring-wrap">${ring(d.pct, '#fff', 84, 9, { track: 'rgba(255,255,255,.28)', animate })}<div class="ring-label">${perfect ? icons.check.replace('<svg', '<svg style="width:26px;height:26px;color:#fff"') : `${Math.round(d.pct * 100)}%`}</div></div>
        <div class="grow">
          <div class="hero-big">${perfect ? 'Alles erledigt' : `${d.done} von ${d.total} erledigt`}</div>
          <div class="hero-line">${esc(motivation(hour, d, st))}</div>
        </div>
      </div>
      <div class="hero-bottom">
        ${weekStrip(s, today)}
        <div class="hero-streak">${st > 0 ? `<span class="glass">🔥 ${st} ${st === 1 ? 'Tag' : 'Tage'} in Folge</span>` : `<span class="glass">Starte heute deine Serie</span>`}${best > st ? `<span class="glass dim">Rekord ${best}</span>` : ''}</div>
      </div>
    </div>

    ${sectionLabel('Tages-Standards', `<button class="link-btn" data-action="manageHabits">Bearbeiten</button>`)}
    <div class="card">
      ${Object.entries(groups).map(([area, items]) => `
        <div class="group-title">${tile(AREAS[area]?.icon || 'sparkles', AREAS[area]?.color || 'var(--blue)')}${esc(AREAS[area]?.name || 'Sonstiges')}</div>
        ${items.map(r => habitRow(s, r.habit, r.done, today, pop)).join('')}
      `).join('')}
      ${d.weekly.length ? `
        <div class="group-title">${tile('sparkles', 'var(--purple)')}Wochenziele</div>
        ${d.weekly.map(w => `
          <div class="row ${w.done ? 'done' : ''}">
            ${check(w.done, AREAS[w.habit.area]?.color || 'var(--purple)', `data-action="toggleHabit" data-id="${w.habit.id}"`)}
            <div class="grow"><div class="title">${esc(w.habit.name)}</div><div class="meta">${w.count} von ${w.times}× diese Woche</div></div>
            <span class="pill ${w.count >= w.times ? '' : 'gray'}" style="--c:var(--green)">${w.count >= w.times ? 'Geschafft' : `${w.times - w.count} offen`}</span>
          </div>`).join('')}
      ` : ''}
      ${d.stepsItem ? `
        <div class="group-title">${tile('steps', 'var(--green)')}Bewegung</div>
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
        ${tile('dumbbell', 'var(--orange)', 36)}
        <div class="grow"><div class="title">${trainedToday ? `${esc(trainedToday.dayName)} absolviert` : nextDay ? `Nächstes Training: ${esc(nextDay.name)}` : 'Kein Trainingsplan'}</div>
        <div class="meta">${trainedToday ? `${trainedToday.entries.length} Übungen · ${summarizeSession(trainedToday)}` : lastTrainingText(s)}</div></div>
        <span class="chev">${icons.chevron}</span>
      </a>
    </div>

    ${sectionLabel('Arbeit', `<button class="link-btn" data-action="addWorkTask">${icons.plus.replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-2px"')} Aufgabe</button>`)}
    <div class="card">
      ${upcoming.map(a => `
        <div class="row">
          ${tile('clock', 'var(--indigo)', 36)}
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

function habitRow(s, h, done, today, pop) {
  const hs = habitStreak(s, h, today);
  return `<div class="row ${done ? 'done' : ''}">
    ${check(done, AREAS[h.area]?.color || 'var(--blue)', `data-action="toggleHabit" data-id="${h.id}"`).replace('class="check', pop === h.id ? 'class="check pop' : 'class="check')}
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
    lastPop = id;
    haptic();
    const before = isPerfectDay(state, today);
    update(s => { const day = s.log[today] ||= {}; if (day[id]) delete day[id]; else day[id] = true; });
    if (!before && isPerfectDay(state, today)) celebrate();
  },
  toggleTask(el) {
    haptic();
    update(s => { const t = s.lists[el.dataset.list].today.find(x => x.id === el.dataset.id); if (t) t.done = !t.done; });
  },
  history() { openHistorySheet(); },
  histPrev() { histMonth = shiftMonth(histMonth, -1); openHistorySheet(); },
  histNext() { histMonth = shiftMonth(histMonth, 1); openHistorySheet(); },
  goSteps() { const inp = document.querySelector('[data-change="setSteps"]'); inp?.focus(); },
  goTraining(el, e) { e.preventDefault(); location.hash = '#training'; },
  addWorkTask() { document.querySelector('form[data-list="work"] input')?.focus(); },
  settings() { openSettings(); },
  manageHabits() { openHabitManager(); },
};

export const changes = {
  setSteps(el) {
    const v = parseInt(el.value, 10);
    const before = isPerfectDay(state, dateKey());
    update(s => { if (v > 0) s.steps[dateKey()] = v; else delete s.steps[dateKey()]; });
    if (!before && isPerfectDay(state, dateKey())) celebrate();
  },
};

/* ---------- Monatsverlauf ---------- */
let histMonth = null;
function shiftMonth(ym, n) { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

function openHistorySheet() {
  const today = dateKey();
  if (!histMonth) histMonth = today.slice(0, 7);
  const [y, m] = histMonth.split('-').map(Number);
  const first = new Date(y, m - 1, 1), daysInMonth = new Date(y, m, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  let perfectCount = 0, cells = '';
  for (let i = 0; i < lead; i++) cells += '<span class="cal-cell empty"></span>';
  for (let d = 1; d <= daysInMonth; d++) {
    const k = `${histMonth}-${String(d).padStart(2, '0')}`;
    const perfect = isPerfectDay(state, k);
    if (perfect) perfectCount++;
    const cls = perfect ? 'perfect' : k === today ? 'today' : k > today || k < state.createdAt ? 'future' : 'missed';
    cells += `<span class="cal-cell ${cls}">${perfect ? icons.check : d}</span>`;
  }
  const st = streak(state, today), best = bestStreak(state);
  let total = 0; for (let k = state.createdAt; k <= today; k = addDays(k, 1)) if (isPerfectDay(state, k)) total++;
  const isCurrent = histMonth === today.slice(0, 7);
  openSheet({
    title: 'Verlauf',
    html: `
      <div class="cal-head">
        <button type="button" class="mini-btn" data-action="histPrev">${icons.chevron.replace('<svg', '<svg style="transform:rotate(180deg)"')}</button>
        <div class="cal-title">${MONTHS[m - 1]} ${y}</div>
        <button type="button" class="mini-btn" data-action="histNext" ${isCurrent ? 'disabled style="opacity:.3"' : ''}>${icons.chevron}</button>
      </div>
      <div class="cal-grid">${WD.map(w => `<span class="cal-wd">${w}</span>`).join('')}${cells}</div>
      <div class="stats" style="padding-top:16px">
        <div class="stat"><div class="v">${perfectCount}</div><div class="l">Perfekt im Monat</div></div>
        <div class="stat"><div class="v">${st}</div><div class="l">Aktuelle Serie</div></div>
        <div class="stat"><div class="v">${best}</div><div class="l">Beste Serie</div></div>
      </div>
      <div class="note" style="padding:0 2px 8px">Ein Tag ist perfekt, wenn alle Tages-Standards und das Schrittziel erledigt sind. Insgesamt ${total} perfekte ${total === 1 ? 'Tag' : 'Tage'} seit dem Start.</div>`,
    actions: { histPrev: actions.histPrev, histNext: actions.histNext },
  });
}

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
      ${field({ label: 'Dein Name', name: 'name', value: state.settings.name || '', placeholder: 'Für die Begrüßung', attrs: 'maxlength="30" autocapitalize="words"' })}
      ${field({ label: 'Tagesziel Schritte', name: 'stepsGoal', type: 'number', value: state.settings.stepsGoal, attrs: 'min="0" step="500" inputmode="numeric"' })}
      ${field({ label: 'Stimmung der Begrüßungskarte', name: 'heroMood', value: state.settings.heroMood || 'auto', options: Object.entries(MOODS).map(([value, m]) => ({ value, label: m.name })) })}
      ${toggle({ label: 'Startscreen beim Öffnen', name: 'splash', checked: state.settings.splash !== false })}
      <div class="mood-row" style="margin-top:12px">${Object.entries(MOODS).filter(([k]) => k !== 'auto').map(([k, m]) => `<span class="mood-swatch" style="background:${m.bg}" title="${m.name}"></span>`).join('')}</div>
      <div class="hint">Setze 0, um Schritte aus den Tages-Standards zu entfernen.</div>
      <div class="section-label" style="padding-left:2px">Cloud-Sicherung</div>
      <div class="row" style="border-bottom:0">${tile('sparkles', isConnected() ? 'var(--green)' : 'var(--text2)', 36)}<div class="grow"><div class="title">${isConnected() ? `Verbunden mit ${esc(sync.owner)}/${esc(sync.repo)}` : 'Nicht eingerichtet'}</div><div class="meta">${esc(statusText())}</div></div></div>
      <div class="stack" style="padding-top:0">
        ${isConnected() ? `<button type="button" class="btn btn-soft" data-action="syncNow">Jetzt synchronisieren</button><button type="button" class="btn btn-danger" data-action="syncOff">Verbindung trennen</button>` : `<button type="button" class="btn btn-primary" data-action="syncSetup">Cloud-Sicherung einrichten</button>`}
      </div>
      <div class="section-label" style="padding-left:2px">Daten</div>
      <div class="stack">
        <button type="button" class="btn btn-soft" data-action="exportData">Backup kopieren (JSON)</button>
        <button type="button" class="btn btn-soft" data-action="downloadData">Backup herunterladen</button>
        <label class="btn btn-soft" style="cursor:pointer">Backup einspielen<input type="file" accept="application/json,.json" data-change="importData" style="display:none"></label>
        <button type="button" class="btn btn-danger" data-action="resetData">Alle Daten zurücksetzen</button>
      </div>
      <div class="note" style="padding:6px 2px">Alle Daten liegen nur auf diesem Gerät. Ein Backup hin und wieder lohnt sich.</div>
    `,
    onSubmit(d) { update(s => { s.settings.stepsGoal = Math.max(0, parseInt(d.stepsGoal) || 0); s.settings.name = (d.name || '').trim(); s.settings.heroMood = MOODS[d.heroMood] ? d.heroMood : 'auto'; s.settings.splash = !!d.splash; }); },
    actions: {
      syncSetup: () => openSyncSheet(),
      syncNow: async () => { await push(); openSettings(); },
      syncOff: () => { if (confirm('Verbindung trennen? Die Daten in der Cloud bleiben erhalten, es wird nur nicht mehr synchronisiert.')) { disconnect(); openSettings(); } },
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


function openSyncSheet() {
  openSheet({
    title: 'Cloud-Sicherung',
    submitLabel: 'Verbinden',
    html: `
      <div class="note" style="padding:2px 2px 14px">Deine Daten werden in ein <strong style="color:var(--text)">privates Repository in deinem GitHub-Konto</strong> gespeichert. Nur du hast Zugriff, die Übertragung ist verschlüsselt. Jede Änderung landet automatisch dort, und nach einer Neuinstallation ist alles sofort wieder da.</div>
      <div class="note" style="padding:0 2px 14px"><strong style="color:var(--text)">Schlüssel erstellen:</strong> Öffne <a href="https://github.com/settings/tokens/new?description=Zentrum%20Sync&scopes=repo" target="_blank" rel="noopener">github.com/settings/tokens/new</a>, wähle bei Expiration „No expiration“, tippe auf „Generate token“ und kopiere den Schlüssel hierher.</div>
      ${field({ label: 'Sync-Schlüssel', name: 'token', value: sync.token || '', placeholder: 'ghp_…', attrs: 'autocapitalize="off" autocorrect="off" spellcheck="false" required', autofocus: true })}
      ${field({ label: 'Name des privaten Repositories', name: 'repo', value: sync.repo || 'zentrum-daten' })}
      <div class="hint">Wird automatisch angelegt, falls es noch nicht existiert.</div>
    `,
    onSubmit(d) {
      const btn = document.querySelector('#sheet-root button[type=submit]');
      if (btn) { btn.disabled = true; btn.textContent = 'Verbinde …'; }
      connect(d.token, d.repo).then(res => {
        closeSheet();
        setTimeout(() => alert(res === 'pulled' ? 'Verbunden. Deine gespeicherten Daten wurden aus der Cloud übernommen.' : 'Verbunden. Deine Daten werden ab jetzt automatisch gesichert.'), 300);
      }).catch(e => { alert(e.message); if (btn) { btn.disabled = false; btn.textContent = 'Verbinden'; } });
      return false;
    },
  });
}
