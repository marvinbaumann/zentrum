// Meilenstein-Momente: Vollbild-Animation bei 7, 14, 30, 66, 100, 200, 365 Tagen Serie und bei einer perfekten Woche.
import { state, update, dateKey, addDays, weekStart } from '../store.js';
import { esc, icons } from '../ui.js';
import { streak, isPerfectDay } from '../habits.js';
import { celebrate, haptic } from '../fx.js';

export const MILESTONES = [7, 14, 30, 66, 100, 200, 365, 500, 1000];
const LINES = {
  7: 'Eine ganze Woche. Der Anfang ist gemacht.',
  14: 'Zwei Wochen. Das ist kein Zufall mehr.',
  30: 'Ein Monat. Das ist jetzt ein Teil von dir.',
  66: 'Sechsundsechzig Tage. Laut Forschung ist es jetzt eine Gewohnheit.',
  100: 'Hundert Tage. Wenige Menschen kommen so weit.',
  200: 'Zweihundert Tage. Beeindruckend.',
  365: 'Ein ganzes Jahr. Das bist du.',
  500: 'Fünfhundert Tage. Unglaublich.',
  1000: 'Tausend Tage. Legendär.',
};

function show({ big, small, line }) {
  if (document.querySelector('.milestone')) return;
  const el = document.createElement('div');
  el.className = 'milestone';
  el.innerHTML = `<div class="welcome-glow"></div><div class="ms-body"><div class="ms-icon">${icons.flame}</div><div class="ms-big">${esc(big)}</div><div class="ms-small">${esc(small)}</div><div class="ms-line">${esc(line)}</div><button type="button" class="btn btn-white" style="width:auto;padding-inline:28px">Weiter</button></div>`;
  document.body.appendChild(el);
  document.body.classList.add('splash-open');
  haptic();
  setTimeout(() => celebrate(['#FFFFFF', '#FFD60A', '#FF9F0A', '#FF5E7E']), 350);
  const close = () => { el.classList.add('out'); document.body.classList.remove('splash-open'); setTimeout(() => el.remove(), 450); };
  el.querySelector('button').addEventListener('click', close);
  el.addEventListener('click', e => { if (e.target === el || e.target.classList.contains('welcome-glow')) close(); });
}

// Nach jeder Änderung an Standards/Schritten aufrufen: prüft neue Meilensteine, zeigt jeden nur einmal.
export function checkMilestones(before) {
  const today = dateKey();
  const after = streak(state, today);
  const shown = state.milestones || {};
  const m = MILESTONES.find(v => after >= v && before < v && !shown[`streak-${v}`]);
  if (m) {
    update(s => { (s.milestones ||= {})[`streak-${m}`] = today; });
    setTimeout(() => show({ big: String(m), small: m === 1 ? 'Tag in Folge' : 'Tage in Folge', line: LINES[m] || 'Weiter so.' }), 250);
    return;
  }
  const ws = weekStart(today);
  const allPerfect = Array.from({ length: 7 }, (_, i) => addDays(ws, i)).every(k => isPerfectDay(state, k));
  if (allPerfect && !shown[`week-${ws}`]) {
    update(s => { (s.milestones ||= {})[`week-${ws}`] = today; });
    setTimeout(() => show({ big: 'Perfekte Woche', small: 'Montag bis Sonntag, alles erledigt', line: 'Sieben von sieben. Das ist Konsequenz, die man sieht.' }), 250);
  }
}
