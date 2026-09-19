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
  if (w.free) return `${w.free.kind}${w.free.minutes ? ` · ${w.free.minutes} min` : ''}${w.free.km ? ` · ${String(w.free.km).replace('.', ',')} km` : ''}${w.free.avgHr ? ` · Ø ${w.free.avgHr}` : ''}${w.free.load ? ` · ${String(w.free.load).replace('.', ',')} kg` : ''}${w.free.note ? ` · ${w.free.note}` : ''}`;
  return '';
}

export function openFreeWorkout(existing = null, preset = null) {
  if (!existing && preset) existing = { kind: preset.kind, minutes: preset.minutes || '', note: preset.note || '' };
  let kind = KINDS.includes(existing?.kind) ? existing.kind : 'Kraft';
  const render = () => `
    <div class="note" style="padding:0 2px 12px">Zählt als Training für heute, egal nach welchem Plan. Hauptsache bewegt.</div>
    <div class="chips" style="margin-bottom:16px">${KINDS.map(k => `<button type="button" class="chip ${kind === k ? 'on' : ''}" style="--c:var(--orange)" data-action="wkKind" data-k="${esc(k)}">${esc(k)}</button>`).join('')}</div>
    <div class="field-row">${field({ label: 'Dauer in Minuten', name: 'minutes', type: 'number', value: existing?.minutes || '', placeholder: 'z. B. 40', attrs: 'min="1" max="600" inputmode="numeric"' })}${field({ label: 'Strecke in km (optional)', name: 'km', type: 'text', value: existing?.km ? String(existing.km).replace('.', ',') : '', placeholder: 'z. B. 4,5', attrs: 'inputmode="decimal"' })}</div>
    <div class="field-row">${field({ label: 'Ø Puls (optional)', name: 'avgHr', type: 'number', value: existing?.avgHr || '', placeholder: 'Apple Watch', attrs: 'min="40" max="230" inputmode="numeric"' })}${field({ label: 'Zusatzgewicht kg (optional)', name: 'load', type: 'text', value: existing?.load ? String(existing.load).replace('.', ',') : '', placeholder: 'Weste, z. B. 8', attrs: 'inputmode="decimal"' })}</div>
    ${field({ label: 'Notiz (optional)', name: 'note', value: existing?.note || '', placeholder: 'z. B. Steigung, wie es sich angefühlt hat', attrs: 'maxlength="80"' })}`;
  const open = () => openSheet({
    title: existing ? 'Training bearbeiten' : 'Freies Training',
    submitLabel: 'Eintragen',
    html: render(),
    actions: { wkKind: el => { kind = el.dataset.k; haptic(); const form = document.getElementById('sheet-form'); existing = { ...(existing || {}), minutes: form?.minutes?.value, note: form?.note?.value, km: form?.km?.value, avgHr: form?.avgHr?.value, load: form?.load?.value }; open(); } },
    onSubmit(d) {
      const today = dateKey();
      const before = isPerfectDay(state, today), stBefore = streak(state, today);
      const numv = v => parseFloat(String(v || '').replace(',', '.')) || 0;
      update(s => { (s.freeWorkouts ||= {})[today] = { kind, minutes: parseInt(d.minutes) || 0, km: numv(d.km), avgHr: parseInt(d.avgHr) || 0, load: numv(d.load), note: (d.note || '').trim(), at: new Date().toISOString() }; });
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
