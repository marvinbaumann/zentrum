// Freies Training: zählt als Tages-Standard, auch ohne Plan (Ausdauer, spontanes Programm, Sport).
import { state, update, dateKey } from '../store.js';
import { esc } from '../ui.js';
import { openSheet, field } from '../sheet.js';
import { haptic, celebrate } from '../fx.js';
import { isPerfectDay, streak } from '../habits.js';
import { checkMilestones } from './milestone.js';

export const KINDS = ['Kraft', 'Ausdauer', 'Laufen', 'Radfahren', 'Schwimmen', 'Mobility', 'Sport', 'Spaziergang', 'Sonstiges'];

export function todayWorkout(s, key = dateKey()) {
  const plan = (s.training?.sessions || []).find(x => x.date === key) || null;
  const free = s.freeWorkouts?.[key] || null;
  return { plan, free, done: !!(plan || free) };
}

export function workoutText(w) {
  if (w.plan) return `${w.plan.dayName} absolviert`;
  if (w.free) return `${w.free.kind}${w.free.minutes ? ` · ${w.free.minutes} min` : ''}${w.free.note ? ` · ${w.free.note}` : ''}`;
  return '';
}

export function openFreeWorkout(existing = null) {
  let kind = existing?.kind || 'Kraft';
  const render = () => `
    <div class="note" style="padding:0 2px 12px">Zählt als Training für heute, egal nach welchem Plan. Hauptsache bewegt.</div>
    <div class="chips" style="margin-bottom:16px">${KINDS.map(k => `<button type="button" class="chip ${kind === k ? 'on' : ''}" style="--c:var(--orange)" data-action="wkKind" data-k="${esc(k)}">${esc(k)}</button>`).join('')}</div>
    <div class="field-row">${field({ label: 'Dauer in Minuten (optional)', name: 'minutes', type: 'number', value: existing?.minutes || '', placeholder: 'z. B. 40', attrs: 'min="1" max="600" inputmode="numeric"' })}${field({ label: 'Notiz (optional)', name: 'note', value: existing?.note || '', placeholder: 'z. B. 5 km locker', attrs: 'maxlength="60"' })}</div>`;
  const open = () => openSheet({
    title: existing ? 'Training bearbeiten' : 'Freies Training',
    submitLabel: 'Eintragen',
    html: render(),
    actions: { wkKind: el => { kind = el.dataset.k; haptic(); const form = document.getElementById('sheet-form'); const m = form?.minutes?.value, n = form?.note?.value; existing = { ...(existing || {}), minutes: m, note: n }; open(); } },
    onSubmit(d) {
      const today = dateKey();
      const before = isPerfectDay(state, today), stBefore = streak(state, today);
      update(s => { (s.freeWorkouts ||= {})[today] = { kind, minutes: parseInt(d.minutes) || 0, note: (d.note || '').trim(), at: new Date().toISOString() }; });
      haptic();
      if (!before && isPerfectDay(state, today)) celebrate();
      checkMilestones(stBefore);
    },
  });
  open();
}

export function removeFreeWorkout() {
  const today = dateKey();
  if (!state.freeWorkouts?.[today]) return;
  if (!confirm('Training von heute entfernen?')) return;
  update(s => { delete s.freeWorkouts[today]; });
}
