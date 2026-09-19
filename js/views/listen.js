import { state, update, dateKey, uid } from '../store.js';
import { esc, header, sectionLabel, segmented, icons, relDay, tile } from '../ui.js';
import { openSheet, field } from '../sheet.js';
import { focusAfterRender } from '../app.js';
import { haptic } from '../fx.js';

let tab = 'work';
let editMode = false;
let showPast = false;

const COLORS = { work: 'var(--indigo)', private: 'var(--teal)' };

export function render(s) {
  const today = dateKey();
  const L = s.lists[tab];
  const apps = [...s.appointments].sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const upcoming = apps.filter(a => a.date >= today), past = apps.filter(a => a.date < today).reverse();
  return `
    ${header('Listen', tab === 'work' ? 'Arbeit' : 'Privat', `<button class="link-btn ${editMode ? 'bold' : ''}" data-action="toggleEdit">${editMode ? 'Fertig' : 'Bearbeiten'}</button>`)}
    ${segmented([{ id: 'work', name: 'Arbeit' }, { id: 'private', name: 'Privat' }], tab, 'selectTab')}

    ${tab === 'work' ? `
      ${sectionLabel('Termine', `<button class="link-btn" data-action="addAppointment">+ Termin</button>`)}
      <div class="card">
        ${upcoming.map(a => apptRow(a, today)).join('')}
        ${!upcoming.length ? '<div class="empty">Keine anstehenden Termine.</div>' : ''}
        ${past.length ? `<div class="row link" data-action="togglePast"><div class="grow meta">${showPast ? 'Vergangene ausblenden' : `${past.length} vergangene anzeigen`}</div></div>${showPast ? past.map(a => apptRow(a, today, true)).join('') : ''}` : ''}
      </div>` : ''}

    ${sectionLabel('Heute', L.today.some(t => t.done) ? `<button class="link-btn" data-action="clearDone">Erledigte entfernen</button>` : '')}
    <div class="card">
      ${L.today.map(t => taskRow('today', t)).join('')}
      ${!L.today.length ? `<div class="empty">${tab === 'work' ? 'Was steht heute an?' : 'Was möchtest du heute umsetzen?'}</div>` : ''}
      <form class="add-row" data-submit="addTask" data-kind="today"><span class="plus">${icons.plus}</span><input name="text" placeholder="Für heute hinzufügen…" autocomplete="off"></form>
    </div>

    ${sectionLabel('Ideen & Anstehendes')}
    <div class="card">
      ${L.ideas.map(t => taskRow('ideas', t)).join('')}
      ${!L.ideas.length ? '<div class="empty">Sammle hier Ideen und Dinge, die demnächst anstehen.</div>' : ''}
      <form class="add-row" data-submit="addTask" data-kind="ideas"><span class="plus">${icons.plus}</span><input name="text" placeholder="Idee notieren…" autocomplete="off"></form>
    </div>
  `;
}

function apptRow(a, today, isPast = false) {
  return `<div class="row" style="${isPast ? 'opacity:.55' : ''}">
    ${tile('clock', 'var(--indigo)', 36)}
    <div class="grow"><div class="title">${esc(a.title)}</div><div class="meta">${relDay(a.date)}${a.time ? ` · ${esc(a.time)} Uhr` : ''}</div></div>
    ${!editMode && a.date === today ? '<span class="pill" style="--c:var(--indigo)">Heute</span>' : ''}
    ${editMode ? `<div class="ex-edit"><button type="button" class="mini-btn" data-action="editAppointment" data-id="${a.id}">${icons.pencil}</button><button type="button" class="mini-btn red" data-action="delAppointment" data-id="${a.id}">${icons.trash}</button></div>` : ''}
  </div>`;
}

function taskRow(kind, t) {
  return `<div class="row ${t.done ? 'done' : ''}">
    ${kind === 'today' ? `<button type="button" class="check ${t.done ? 'on' : ''}" style="--c:${COLORS[tab]}" data-action="toggleTask" data-kind="${kind}" data-id="${t.id}">${t.done ? icons.check : ''}</button>` : `<span class="dot" style="--c:${COLORS[tab]};opacity:.5;margin:0 9px"></span>`}
    <div class="grow"><div class="title">${esc(t.text)}</div></div>
    ${editMode ? `<div class="ex-edit">${kind === 'ideas' ? `<button type="button" class="mini-btn" data-action="moveToToday" data-id="${t.id}" title="Für heute">${icons.arrowRight}</button>` : ''}<button type="button" class="mini-btn" data-action="editTask" data-kind="${kind}" data-id="${t.id}">${icons.pencil}</button><button type="button" class="mini-btn red" data-action="delTask" data-kind="${kind}" data-id="${t.id}">${icons.trash}</button></div>`
      : kind === 'ideas' ? `<button type="button" class="mini-btn" data-action="moveToToday" data-id="${t.id}" title="Für heute">${icons.arrowRight}</button>` : ''}
  </div>`;
}

export const actions = {
  selectTab(el) { tab = el.dataset.id; editMode = false; update(() => {}); },
  toggleEdit() { editMode = !editMode; update(() => {}); },
  togglePast() { showPast = !showPast; update(() => {}); },
  toggleTask(el) { haptic(); update(s => { const t = s.lists[tab].today.find(x => x.id === el.dataset.id); if (t) t.done = !t.done; }); },
  clearDone() { update(s => { s.lists[tab].today = s.lists[tab].today.filter(t => !t.done); }); },
  delTask(el) { update(s => { s.lists[tab][el.dataset.kind] = s.lists[tab][el.dataset.kind].filter(t => t.id !== el.dataset.id); }); },
  moveToToday(el) { update(s => { const L = s.lists[tab]; const i = L.ideas.findIndex(t => t.id === el.dataset.id); if (i < 0) return; const [t] = L.ideas.splice(i, 1); t.done = false; L.today.push(t); }); },
  editTask(el) {
    const t = state.lists[tab][el.dataset.kind].find(x => x.id === el.dataset.id); if (!t) return;
    openSheet({ title: 'Bearbeiten', html: field({ label: 'Text', name: 'text', type: 'textarea', value: t.text, autofocus: true }),
      onSubmit(d) { const text = d.text.trim(); if (!text) return false; update(s => { s.lists[tab][el.dataset.kind].find(x => x.id === t.id).text = text; }); } });
  },
  addAppointment() { openAppointmentForm(null); },
  editAppointment(el) { openAppointmentForm(state.appointments.find(a => a.id === el.dataset.id)); },
  delAppointment(el) { if (confirm('Termin löschen?')) update(s => { s.appointments = s.appointments.filter(a => a.id !== el.dataset.id); }); },
};

export const submits = {
  addTask(f) {
    const text = f.text.value.trim(); if (!text) return;
    const kind = f.dataset.kind;
    focusAfterRender(`form[data-kind="${kind}"] input`);
    update(s => s.lists[tab][kind].push({ id: uid(), text, done: false, createdAt: dateKey() }));
  },
};

function openAppointmentForm(a) {
  openSheet({ title: a ? 'Termin bearbeiten' : 'Neuer Termin',
    html: `${field({ label: 'Name', name: 'title', value: a?.title || '', placeholder: 'z. B. Meeting mit …', autofocus: !a, attrs: 'required' })}
      <div class="field-row">${field({ label: 'Datum', name: 'date', type: 'date', value: a?.date || dateKey() })}${field({ label: 'Uhrzeit', name: 'time', type: 'time', value: a?.time || '' })}</div>`,
    onSubmit(d) {
      const title = d.title.trim(); if (!title || !d.date) return false;
      update(s => { if (a) Object.assign(s.appointments.find(x => x.id === a.id), { title, date: d.date, time: d.time }); else s.appointments.push({ id: uid(), title, date: d.date, time: d.time }); });
    } });
}
