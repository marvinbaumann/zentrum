// Wichtige Menschen: Kontakt-Intervall, letzter Kontakt, Geburtstag. Ein Tap „Kontakt gehabt“.
import { state, update, dateKey, uid, parseKey, addDays } from '../store.js';
import { esc, icons, tile, relDay, fmtDM } from '../ui.js';
import { openSheet, field } from '../sheet.js';
import { haptic } from '../fx.js';

const INTERVALS = [{ value: 7, label: 'Jede Woche' }, { value: 14, label: 'Alle 2 Wochen' }, { value: 30, label: 'Jeden Monat' }, { value: 60, label: 'Alle 2 Monate' }, { value: 90, label: 'Alle 3 Monate' }, { value: 180, label: 'Alle 6 Monate' }];

export function daysSince(k, today = dateKey()) { if (!k) return null; return Math.round((parseKey(today) - parseKey(k)) / 864e5); }
export function dueIn(p, today = dateKey()) { if (!p.lastContact) return -Infinity; return p.intervalDays - daysSince(p.lastContact, today); }
export function nextBirthday(p, today = dateKey()) {
  if (!p.birthday) return null;
  const m = p.birthday.match(/(\d{2})-(\d{2})$/); if (!m) return null;
  const t = parseKey(today); let d = new Date(t.getFullYear(), Number(m[1]) - 1, Number(m[2]));
  if (d < t) d = new Date(t.getFullYear() + 1, Number(m[1]) - 1, Number(m[2]));
  return Math.round((d - t) / 864e5);
}

export function statusOf(p) {
  const d = dueIn(p);
  if (d === -Infinity) return { cls: 'due', text: 'Noch kein Kontakt eingetragen' };
  if (d < 0) return { cls: 'due', text: `Seit ${daysSince(p.lastContact)} Tagen, fällig` };
  if (d <= 3) return { cls: 'soon', text: `Zuletzt vor ${daysSince(p.lastContact)} Tagen, bald fällig` };
  return { cls: 'ok', text: `Zuletzt vor ${daysSince(p.lastContact)} ${daysSince(p.lastContact) === 1 ? 'Tag' : 'Tagen'}, wieder in ${d} Tagen` };
}

export function duePeople(s, within = 7) {
  return (s.people || []).filter(p => dueIn(p) <= within).sort((a, b) => dueIn(a) - dueIn(b));
}
export function upcomingBirthdays(s, within = 14) {
  return (s.people || []).map(p => ({ p, d: nextBirthday(p) })).filter(x => x.d != null && x.d <= within).sort((a, b) => a.d - b.d);
}

export function personRow(p, editMode = false) {
  const st = statusOf(p);
  const bd = nextBirthday(p);
  return `<div class="row">
    <span class="avatar ${st.cls}">${esc((p.name || '?').trim().charAt(0).toUpperCase())}</span>
    <div class="grow"><div class="title">${esc(p.name)}${bd != null && bd <= 14 ? ` <span class="pill" style="--c:var(--pink)">🎂 ${bd === 0 ? 'Heute' : bd === 1 ? 'Morgen' : `in ${bd} Tagen`}</span>` : ''}</div><div class="meta ${st.cls === 'due' ? 'due-text' : ''}">${esc(st.text)}</div></div>
    ${editMode ? `<div class="ex-edit"><button type="button" class="mini-btn" data-action="editPerson" data-id="${p.id}">${icons.pencil}</button><button type="button" class="mini-btn red" data-action="delPerson" data-id="${p.id}">${icons.trash}</button></div>`
      : `<button type="button" class="contact-btn" data-action="contacted" data-id="${p.id}" aria-label="Kontakt gehabt">${icons.check}<span>Kontakt</span></button>`}
  </div>`;
}

export function section(s, editMode) {
  const list = [...(s.people || [])].sort((a, b) => dueIn(a) - dueIn(b));
  return `${list.map(p => personRow(p, editMode)).join('')}${!list.length ? '<div class="empty">Wen willst du regelmäßig hören oder sehen? Füge die Menschen hinzu, die dir wichtig sind.</div>' : ''}`;
}

export const actions = {
  contacted(el) { haptic(); update(s => { const p = s.people.find(x => x.id === el.dataset.id); if (p) p.lastContact = dateKey(); }); },
  addPerson() { openPersonForm(null); },
  editPerson(el) { openPersonForm(state.people.find(p => p.id === el.dataset.id)); },
  delPerson(el) { const p = state.people.find(x => x.id === el.dataset.id); if (p && confirm(`${p.name} entfernen?`)) update(s => { s.people = s.people.filter(x => x.id !== p.id); }); },
};

function openPersonForm(p) {
  openSheet({
    title: p ? 'Person bearbeiten' : 'Neue Person',
    html: `${field({ label: 'Name', name: 'name', value: p?.name || '', placeholder: 'z. B. Mama, Jonas, Oma', autofocus: !p, attrs: 'required maxlength="40" autocapitalize="words"' })}
      ${field({ label: 'Wie oft melden?', name: 'intervalDays', value: p?.intervalDays || 14, options: INTERVALS })}
      <div class="field-row">${field({ label: 'Letzter Kontakt', name: 'lastContact', type: 'date', value: p?.lastContact || dateKey() })}${field({ label: 'Geburtstag (optional)', name: 'birthday', type: 'date', value: p?.birthday || '' })}</div>
      ${field({ label: 'Notiz oder Geschenkidee (optional)', name: 'note', value: p?.note || '', placeholder: 'z. B. mag Kaffee aus Äthiopien' })}`,
    onSubmit(d) {
      const name = d.name.trim(); if (!name) return false;
      const entry = { id: p?.id || uid(), name, intervalDays: parseInt(d.intervalDays) || 14, lastContact: d.lastContact || null, birthday: d.birthday || '', note: d.note.trim() };
      update(s => { s.people ||= []; const i = s.people.findIndex(x => x.id === entry.id); if (i >= 0) s.people[i] = entry; else s.people.push(entry); });
    },
  });
}
